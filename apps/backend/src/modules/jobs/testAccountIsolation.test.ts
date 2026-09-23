import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../db/schema';
import { register } from '../auth/auth.service';
import { grantSignupCredits } from '../credits/credits.service';
import { getPublicSample, searchJobs, createJob } from './jobs.service';
import { isTestAccountEmail } from '../../config/testAccounts';

/**
 * WHY THIS FILE:
 *  - PROBLEM: to check that applying for a job actually works on the LIVE
 *    site, an automated test has to post a real job and send a real C.V.
 *    there. Without isolation that posting appears in the feed real seekers
 *    are browsing, and they waste an application on a job that does not exist.
 *  - COST OF FAILURE: a seeker sends their C.V. to a robot. On a product whose
 *    promise is that a real person reads it, that is the worst possible bug to
 *    ship in the name of testing.
 *  - SUCCESS: a test account can do everything a real referrer can, and none
 *    of it is ever visible to anyone else.
 */

const realEmail = () => `real-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@acme.example.com`;
const testEmail = () => `probe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@direct-ref.test`;

async function referrerWithJob(email: string, title: string) {
  const user = await register({ email, password: 'TestPass123', fullName: 'Rae Tester', isReferrer: true });
  await db.update(users)
    .set({ workEmail: `rae@acme.test`, workEmailVerified: true })
    .where(eq(users.id, user.id));
  await grantSignupCredits(user.id);
  // A unique sourceUrl per posting. groupBySourceUrl deliberately merges
  // postings that share one — that is the multi-referrer listing feature —
  // and two fixtures sharing a URL collapse into a single group.
  const job = await createJob(user.id, {
    sourceUrl: `https://acme.test/careers/${title.toLowerCase().replace(/\W+/g, '-')}`,
    title,
    companyName: 'acme',
  } as never);
  return { user, job };
}

describe('recognising a test address', () => {
  it.each([
    'probe@direct-ref.test',
    'seeker@example.test',
    'x@sub.domain.test',
    'MIXED@Example.TEST',
  ])('treats %s as a test account', (email) => {
    expect(isTestAccountEmail(email)).toBe(true);
  });

  it.each([
    'rae@acme.com',
    'someone@gmail.com',
    'a@test.com', // .test must be the TLD, not just present
    'b@testing.co.il',
  ])('treats %s as a real person', (email) => {
    expect(isTestAccountEmail(email)).toBe(false);
  });

  it('is safe on nothing at all', () => {
    expect(isTestAccountEmail(null)).toBe(false);
    expect(isTestAccountEmail(undefined)).toBe(false);
    expect(isTestAccountEmail('')).toBe(false);
    expect(isTestAccountEmail('not-an-email')).toBe(false);
  });
});

describe('the flag is set without anyone remembering to set it', () => {
  it('marks an account registered on a .test address', async () => {
    const user = await register({
      email: testEmail(), password: 'TestPass123', fullName: 'Probe Tester', isReferrer: true,
    });
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored.isTestAccount).toBe(true);
  });

  it('leaves a real account alone', async () => {
    const user = await register({
      email: realEmail(), password: 'TestPass123', fullName: 'Real Person', isReferrer: true,
    });
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored.isTestAccount).toBe(false);
  });
});

describe('a test account\'s postings are invisible to everyone else', () => {
  it('never appear in the landing page sample', async () => {
    // The most exposed surface: unauthenticated, and the first thing a
    // visitor sees.
    const probe = await referrerWithJob(testEmail(), 'Probe Only Role');
    const real = await referrerWithJob(realEmail(), 'Genuine Open Role');

    const sample = await getPublicSample(50);
    const titles = sample.map((j) => j.title);

    expect(titles, 'a test posting reached the landing page').not.toContain('Probe Only Role');
    expect(titles, 'a real posting was hidden by mistake').toContain('Genuine Open Role');
    expect(probe.job).toBeTruthy(); // it was created — just not shown
    expect(real.job).toBeTruthy();
  });

  it('never appear in search', async () => {
    await referrerWithJob(testEmail(), 'Probe Searchable Role');
    await referrerWithJob(realEmail(), 'Genuine Searchable Role');

    // searchJobs returns GroupedJob[] — the row is nested under .job, and
    // postings sharing a sourceUrl are merged into one group.
    const found = await searchJobs('Searchable', undefined, 1, 50);
    const titles = found.map((r) => r.job.title);

    expect(titles).not.toContain('Probe Searchable Role');
    expect(titles).toContain('Genuine Searchable Role');
  });

  it('the posting still exists and works for its own owner', async () => {
    // Hidden from others, not broken. The whole point is that a test account
    // exercises the real flow end to end.
    const probe = await referrerWithJob(testEmail(), 'Probe Working Role');
    expect(probe.job.id).toBeTruthy();
    expect(probe.job.isActive).toBe(true);
  });
});
