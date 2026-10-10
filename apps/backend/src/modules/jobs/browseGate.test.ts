import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { env } from '../../config/env';
import { makeReferrer, makeSeeker, makeJob, makeUser } from '../../test/factories';
import { useServer, as } from '../../test/http';

/**
 * WHY THIS FILE:
 *  - PROBLEM: marketing sends people to Browse Jobs before the board has
 *    enough roles on it. A board with six roles reads as a dead product.
 *  - COST OF FAILURE: either the gate leaks (sparse board shown to the first
 *    wave of visitors) or it never opens (seekers can't find any roles even
 *    once there are plenty).
 *  - SUCCESS: until BROWSE_MIN_JOBS listings are live, Browse, Feed and
 *    Suggested return nothing and say the board is closed; at the threshold
 *    they open; admins see the board all along; a job's own page always works.
 *
 * The suite runs with BROWSE_MIN_JOBS=0 (vitest.config.ts) so every other
 * test sees an open board. This file sets a small threshold for itself.
 */

const { base } = useServer();
const THRESHOLD = 3;
let saved: number;

beforeEach(() => { saved = env.BROWSE_MIN_JOBS; env.BROWSE_MIN_JOBS = THRESHOLD; });
afterEach(() => { env.BROWSE_MIN_JOBS = saved; });

const get = async (userId: string, path: string) => (await as(base, userId).get(path)).json() as Promise<any>;

async function postListings(n: number) {
  const referrer = await makeReferrer();
  for (let i = 0; i < n; i++) {
    await makeJob(referrer.id, { sourceUrl: `https://acme.test/careers/${i}`, title: `Backend Engineer ${i}` });
  }
  return referrer;
}

describe('the job board before it has enough roles', () => {
  it('Browse returns no jobs and says the board is closed', async () => {
    await postListings(THRESHOLD - 1);
    const seeker = await makeSeeker();

    const body = await get(seeker.id, '/api/jobs');

    expect(body.data).toEqual([]);
    expect(body.gate).toMatchObject({ open: false, liveCount: THRESHOLD - 1, threshold: THRESHOLD });
  });

  it('Home\'s matched and feed lists stay empty too', async () => {
    await postListings(THRESHOLD - 1);
    const seeker = await makeSeeker({ desiredRole: 'Back-End Developer' });

    expect((await get(seeker.id, '/api/jobs/suggested')).data).toEqual([]);
    expect((await get(seeker.id, '/api/jobs/feed')).data).toEqual([]);
  });

  it('a job\'s own page still opens, so a shared link works', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id);
    const seeker = await makeSeeker();

    const res = await as(base, seeker.id).get(`/api/jobs/${job.id}`);

    expect(res.status).toBe(200);
  });

  it('counts listings, not postings: two colleagues on one opening are one role', async () => {
    const a = await makeReferrer();
    const b = await makeReferrer();
    await postListings(THRESHOLD - 2);
    await makeJob(a.id, { sourceUrl: 'https://acme.test/careers/shared' });
    await makeJob(b.id, { sourceUrl: 'https://acme.test/careers/shared' });
    const seeker = await makeSeeker();

    const body = await get(seeker.id, '/api/jobs');

    expect(body.gate).toMatchObject({ open: false, liveCount: THRESHOLD - 1 });
  });

  it('closed postings and test-account postings do not count', async () => {
    const referrer = await postListings(THRESHOLD - 1);
    await makeJob(referrer.id, { sourceUrl: 'https://acme.test/careers/closed', isActive: false });
    const tester = await makeReferrer({ isTestAccount: true });
    await makeJob(tester.id, { sourceUrl: 'https://acme.test/careers/smoke' });
    const seeker = await makeSeeker();

    expect((await get(seeker.id, '/api/jobs')).gate.open).toBe(false);
  });

  it('admins see the jobs anyway', async () => {
    await postListings(1);
    const admin = await makeUser({ email: env.ADMIN_EMAILS.split(',')[0].trim(), emailVerified: true });

    const body = await get(admin.id, '/api/jobs');

    expect(body.gate.open).toBe(true);
    expect(body.data).toHaveLength(1);
  });
});

describe('the job board once it reaches the threshold', () => {
  it('opens to everyone', async () => {
    await postListings(THRESHOLD);
    const seeker = await makeSeeker();

    const body = await get(seeker.id, '/api/jobs');

    expect(body.gate.open).toBe(true);
    expect(body.data).toHaveLength(THRESHOLD);
  });
});
