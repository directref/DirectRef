import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users, jobs } from '../../db/schema';
import { sendWorkEmailVerificationEmail, sendWorkEmailVerifiedEmail } from '../../services/email';
import { grantSignupCredits, getBalance } from '../credits/credits.service';
import { makeUser } from '../../test/factories';
import { useServer, as, waitForNotification } from '../../test/http';

/**
 * WHY THIS FILE:
 *  - PROBLEM: a verified work email is the only thing stopping anyone from
 *    posting a "referral" for a company they do not work at. It is the
 *    product's anti-abuse spine, and the round-trip that grants it — submit
 *    an address, click the link, become verified — had no test, while being
 *    changed twice in September (PRs #6, #7).
 *  - COST OF FAILURE: either nobody can post (the marketplace has no supply)
 *    or anybody can post for any company (seekers send C.V.s to strangers).
 *    And a blocked post that still spends a credit charges people for our
 *    refusal.
 *  - SUCCESS: only the mailbox owner can verify, verifying unlocks posting
 *    and says so, and a refused post leaves the balance exactly where it was.
 */

const { base } = useServer();

const reload = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];

async function referrerWithCredits(overrides = {}) {
  const user = await makeUser({ email: 'rae@gmail.com', fullName: 'Rae Cohen', isReferrer: true, ...overrides });
  await grantSignupCredits(user.id);
  return user;
}

const acmeJob = {
  sourceUrl: 'https://acme.co.il/careers/backend-engineer',
  title: 'Backend Engineer',
  companyName: 'Acme',
  location: 'Tel Aviv',
};

describe('verifying a work email', () => {
  it('submitting an address emails a link, and the link verifies it', async () => {
    const user = await referrerWithCredits();
    const api = as(base, user.id);

    // The settings card trims before sending; the server still lowercases.
    const submit = await api.post('/api/users/me/work-email', { workEmail: 'Rae@Acme.co.il' });
    expect(submit.status).toBeLessThan(300);

    const pending = await reload(user.id);
    expect(pending.workEmail).toBe('rae@acme.co.il');
    expect(pending.workEmailVerified).toBe(false);
    expect(sendWorkEmailVerificationEmail).toHaveBeenCalledWith('rae@acme.co.il', 'Rae Cohen', pending.workEmailVerifyToken);

    // The link is opened from the inbox, usually in a fresh browser — no login.
    const click = await as(base, null).get(`/api/auth/verify-work-email/${pending.workEmailVerifyToken}`);
    expect(click.status).toBe(200);

    const after = await reload(user.id);
    expect(after.workEmailVerified).toBe(true);
    expect(after.workEmailVerifyToken).toBeNull();
  });

  it('tells the referrer they can post now — in the app and by email', async () => {
    const user = await referrerWithCredits();
    await as(base, user.id).post('/api/users/me/work-email', { workEmail: 'rae@acme.co.il' });
    const { workEmailVerifyToken } = await reload(user.id);

    await as(base, null).get(`/api/auth/verify-work-email/${workEmailVerifyToken}`);

    const [note] = await waitForNotification(user.id, 'work_email_verified');
    expect(note?.linkUrl).toBe('/jobs/post');
    expect(sendWorkEmailVerifiedEmail).toHaveBeenCalledWith('rae@acme.co.il', 'Rae Cohen', 'rae@acme.co.il', null);
  });

  it('refuses a personal mailbox outright', async () => {
    const user = await referrerWithCredits();
    const res = await as(base, user.id).post('/api/users/me/work-email', { workEmail: 'rae@walla.co.il' });

    expect(res.status).toBe(400);
    expect((await res.json() as any).error?.code ?? '').toContain('PERSONAL_EMAIL');
    expect(sendWorkEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it('refuses a link older than an hour', async () => {
    const user = await referrerWithCredits();
    await as(base, user.id).post('/api/users/me/work-email', { workEmail: 'rae@acme.co.il' });
    const { workEmailVerifyToken } = await reload(user.id);
    await db.update(users).set({ workEmailVerifyTokenExp: new Date(Date.now() - 60_000) }).where(eq(users.id, user.id));

    const res = await as(base, null).get(`/api/auth/verify-work-email/${workEmailVerifyToken}`);
    expect(res.status).toBe(400);
    expect((await reload(user.id)).workEmailVerified).toBe(false);
  });

  it('changing to a new work email takes away the old verification until the new one is clicked', async () => {
    const user = await referrerWithCredits({ workEmail: 'rae@acme.co.il', workEmailVerified: true });
    await as(base, user.id).post('/api/users/me/work-email', { workEmail: 'rae@globex.com' });

    const after = await reload(user.id);
    expect(after.workEmail).toBe('rae@globex.com');
    expect(after.workEmailVerified).toBe(false);
  });
});

describe('posting is blocked before any credit is spent', () => {
  it('no verified work email: refused, and the balance is untouched', async () => {
    const user = await referrerWithCredits();
    const before = (await getBalance(user.id)).total;

    const res = await as(base, user.id).post('/api/jobs', acmeJob);

    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json() as any)).toContain('WORK_EMAIL_REQUIRED');
    expect((await getBalance(user.id)).total).toBe(before);
    expect(await db.select().from(jobs)).toHaveLength(0);
  });

  it('submitted but not yet clicked counts as unverified', async () => {
    const user = await referrerWithCredits();
    await as(base, user.id).post('/api/users/me/work-email', { workEmail: 'rae@acme.co.il' });

    const res = await as(base, user.id).post('/api/jobs', acmeJob);
    expect(res.status).toBe(403);
  });

  it('verified at a different company: refused, and the balance is untouched', async () => {
    const user = await referrerWithCredits({ workEmail: 'rae@globex.com', workEmailVerified: true });
    const before = (await getBalance(user.id)).total;

    const res = await as(base, user.id).post('/api/jobs', acmeJob);

    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json() as any)).toContain('COMPANY_MISMATCH');
    expect((await getBalance(user.id)).total).toBe(before);
  });

  it('verified at the right company: posts, and costs exactly one credit', async () => {
    const user = await referrerWithCredits({ workEmail: 'rae@acme.co.il', workEmailVerified: true });
    const before = (await getBalance(user.id)).total;

    const res = await as(base, user.id).post('/api/jobs', acmeJob);

    expect(res.status).toBe(201);
    expect((await getBalance(user.id)).total).toBe(before - 1);
  });
});
