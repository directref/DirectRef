import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { waitlistSignups } from '../../db/schema';
import { sendWaitlistConfirmationEmail } from '../../services/email';
import { syncWaitlistContact } from '../../services/waitlistSegments';
import { joinWaitlist, unsubscribe, getWaitlistStats } from './waitlist.service';
import app from '../../app';

/**
 * WHY THIS FILE:
 *  - PROBLEM: at launch the waitlist is the ONLY thing the marketing site
 *    does. Every CTA writes here, and the launch plan depends on two clean
 *    lists: referrers get emailed first to fill the site with positions.
 *  - COST OF FAILURE: a lost signup is a lost early user we never hear about;
 *    a wrong role tag sends "post your roles" to a job seeker; a duplicate
 *    email annoys someone on day one; an unsubscribe that doesn't stick puts
 *    the sending domain at risk.
 *  - SUCCESS: one row per (email, role), one email per first signup, the
 *    same reply whatever happened, and unsubscribes that reach Resend.
 */

vi.mock('../../services/waitlistSegments', () => ({
  syncWaitlistContact: vi.fn().mockResolvedValue(true),
  isSegmentSyncConfigured: vi.fn().mockReturnValue(true),
}));

const rows = (email: string) => db.select().from(waitlistSignups).where(eq(waitlistSignups.email, email));

describe('joinWaitlist — who ends up on which list', () => {
  it('stores a first signup with its role and source, emails once, and syncs to Resend', async () => {
    await joinWaitlist({ email: 'dana@example.com', role: 'referrer', sourceCta: 'hero_referrer', utmSource: 'linkedin' });

    const [row] = await rows('dana@example.com');
    expect(row).toMatchObject({ role: 'referrer', sourceCta: 'hero_referrer', utmSource: 'linkedin', unsubscribedAt: null });
    expect(row.resendSyncedAt).not.toBeNull();
    expect(sendWaitlistConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(sendWaitlistConfirmationEmail).toHaveBeenCalledWith('dana@example.com', 'referrer', row.unsubscribeToken);
    expect(syncWaitlistContact).toHaveBeenCalledWith('dana@example.com', 'referrer', false);
  });

  it('a repeat signup for the same list changes nothing and sends no second email', async () => {
    await joinWaitlist({ email: 'dana@example.com', role: 'seeker' });
    await joinWaitlist({ email: 'dana@example.com', role: 'seeker' });

    expect(await rows('dana@example.com')).toHaveLength(1);
    expect(sendWaitlistConfirmationEmail).toHaveBeenCalledTimes(1);
  });

  it('the same person can be on both lists', async () => {
    await joinWaitlist({ email: 'dana@example.com', role: 'seeker' });
    await joinWaitlist({ email: 'dana@example.com', role: 'referrer' });

    expect((await rows('dana@example.com')).map((r) => r.role).sort()).toEqual(['referrer', 'seeker']);
    expect(sendWaitlistConfirmationEmail).toHaveBeenCalledTimes(2);
  });

  it('a filled honeypot stores nothing and sends nothing', async () => {
    await joinWaitlist({ email: 'bot@example.com', role: 'seeker', website: 'http://spam.example' });

    expect(await rows('bot@example.com')).toHaveLength(0);
    expect(sendWaitlistConfirmationEmail).not.toHaveBeenCalled();
  });

  it('keeps the signup when Resend sync fails, marked for the backfill script', async () => {
    vi.mocked(syncWaitlistContact).mockResolvedValueOnce(false);
    await joinWaitlist({ email: 'offline@example.com', role: 'seeker' });

    const [row] = await rows('offline@example.com');
    expect(row).toBeDefined();
    expect(row.resendSyncedAt).toBeNull();
  });

  it('keeps the signup when the confirmation email fails', async () => {
    vi.mocked(sendWaitlistConfirmationEmail).mockRejectedValueOnce(new Error('Resend down'));
    await joinWaitlist({ email: 'nomail@example.com', role: 'seeker' });

    expect(await rows('nomail@example.com')).toHaveLength(1);
  });
});

describe('unsubscribe — "unsubscribe anytime" has to be true', () => {
  it('marks the row and tells Resend', async () => {
    await joinWaitlist({ email: 'leaver@example.com', role: 'seeker' });
    const [before] = await rows('leaver@example.com');

    await unsubscribe(before.unsubscribeToken);

    const [after] = await rows('leaver@example.com');
    expect(after.unsubscribedAt).not.toBeNull();
    expect(syncWaitlistContact).toHaveBeenLastCalledWith('leaver@example.com', 'seeker', true);
  });

  it('only affects the one list the link came from', async () => {
    await joinWaitlist({ email: 'both@example.com', role: 'seeker' });
    await joinWaitlist({ email: 'both@example.com', role: 'referrer' });
    const seeker = (await rows('both@example.com')).find((r) => r.role === 'seeker')!;

    await unsubscribe(seeker.unsubscribeToken);

    const after = await rows('both@example.com');
    expect(after.find((r) => r.role === 'seeker')!.unsubscribedAt).not.toBeNull();
    expect(after.find((r) => r.role === 'referrer')!.unsubscribedAt).toBeNull();
  });

  it('signing up again after unsubscribing re-subscribes, without another email', async () => {
    await joinWaitlist({ email: 'back@example.com', role: 'referrer' });
    const [row] = await rows('back@example.com');
    await unsubscribe(row.unsubscribeToken);

    await joinWaitlist({ email: 'back@example.com', role: 'referrer' });

    const [after] = await rows('back@example.com');
    expect(after.unsubscribedAt).toBeNull();
    expect(sendWaitlistConfirmationEmail).toHaveBeenCalledTimes(1);
    expect(syncWaitlistContact).toHaveBeenLastCalledWith('back@example.com', 'referrer', false);
  });

  it('an unknown token is a silent no-op', async () => {
    await expect(unsubscribe('00000000-0000-0000-0000-000000000000')).resolves.toBeUndefined();
  });
});

describe('getWaitlistStats — the launch signal', () => {
  it('counts each list, excluding people who unsubscribed', async () => {
    await joinWaitlist({ email: 'a@example.com', role: 'seeker' });
    await joinWaitlist({ email: 'b@example.com', role: 'seeker' });
    await joinWaitlist({ email: 'c@example.com', role: 'referrer' });
    const [b] = await rows('b@example.com');
    await unsubscribe(b.unsubscribeToken);

    expect(await getWaitlistStats()).toMatchObject({ seekers: 1, referrers: 1, total: 2, joinedToday: 2, unsubscribed: 1 });
  });
});

describe('POST /api/waitlist — the public endpoint', () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/waitlist`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('normalises the email so "Dana@Example.com " and "dana@example.com" are one person', async () => {
    const res = await post('', { email: '  Dana@Example.COM ', role: 'seeker', sourceCta: 'nav' });
    expect(res.status).toBe(201);
    expect(await rows('dana@example.com')).toHaveLength(1);
  });

  it('answers a repeat signup exactly like a new one, so the form reveals nothing', async () => {
    const first = await post('', { email: 'same@example.com', role: 'seeker' });
    const second = await post('', { email: 'same@example.com', role: 'seeker' });
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
  });

  it('rejects a malformed email or an unknown role', async () => {
    expect((await post('', { email: 'not-an-email', role: 'seeker' })).status).toBe(422);
    expect((await post('', { email: 'x@example.com', role: 'recruiter' })).status).toBe(422);
    expect((await post('', { email: 'x@example.com' })).status).toBe(422);
  });

  it('unsubscribe requires a well-formed token', async () => {
    expect((await post('/unsubscribe', { token: 'nope' })).status).toBe(422);
    expect((await post('/unsubscribe', { token: '00000000-0000-0000-0000-000000000000' })).status).toBe(200);
  });
});
