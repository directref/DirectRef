import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { jobs } from '../../db/schema';
import { makeReferrer, makeSeeker, makeJob, makeApplication } from '../../test/factories';
import { useServer, as, waitForNotification, pdf } from '../../test/http';

/**
 * WHY THIS FILE:
 *  - PROBLEM: what a referrer does to a posting after publishing it — edit
 *    it, switch it off, switch it back on — and what happens when two
 *    colleagues post the same opening, had no tests. Each of these changes
 *    what seekers see and whether they can still apply.
 *  - COST OF FAILURE: a seeker applies to a role the referrer already closed
 *    and waits on nobody; two cards for one opening split applications and
 *    look like spam; a stranger edits someone else's posting.
 *  - SUCCESS: one card per real opening, a closed posting accepts nothing
 *    and tells the seekers already waiting on it, and only the owner can
 *    change it.
 */

const { base } = useServer();

const search = async (viewerId: string, q = '') =>
  (await (await as(base, viewerId).get(`/api/jobs?q=${encodeURIComponent(q)}`)).json() as any).data as Array<{
    job: { id: string; sourceUrl: string; title: string };
    referrers: Array<{ id: string; jobId: string }>;
  }>;

const reload = async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0];

describe('two colleagues post the same opening', () => {
  it('seekers see one listing carrying both referrers', async () => {
    const a = await makeReferrer({ fullName: 'Rae Cohen' });
    const b = await makeReferrer({ fullName: 'Avi Levi' });
    const seeker = await makeSeeker();
    const url = 'https://acme.test/careers/backend-engineer';
    await makeJob(a.id, { sourceUrl: url, title: 'Backend Engineer' });
    await makeJob(b.id, { sourceUrl: url, title: 'Backend Engineer' });

    const results = await search(seeker.id, 'Backend');

    expect(results).toHaveLength(1);
    expect(results[0].referrers.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('a different link stays a separate listing — there is no fuzzy matching', async () => {
    const a = await makeReferrer();
    const b = await makeReferrer();
    const seeker = await makeSeeker();
    await makeJob(a.id, { sourceUrl: 'https://acme.test/careers/backend-engineer', title: 'Backend Engineer' });
    await makeJob(b.id, { sourceUrl: 'https://acme.test/careers/backend-engineer?ref=li', title: 'Backend Engineer' });

    expect(await search(seeker.id, 'Backend')).toHaveLength(2);
  });

  it('applying through one colleague counts as applied to the shared listing', async () => {
    const a = await makeReferrer();
    const b = await makeReferrer();
    const seeker = await makeSeeker();
    const url = 'https://acme.test/careers/backend-engineer';
    const jobA = await makeJob(a.id, { sourceUrl: url });
    const jobB = await makeJob(b.id, { sourceUrl: url });

    const first = await as(base, seeker.id).upload('/api/applications', { jobId: jobA.id }, { name: 'cv.pdf', bytes: pdf() });
    expect(first.status).toBe(201);
    const second = await as(base, seeker.id).upload('/api/applications', { jobId: jobB.id }, { name: 'cv.pdf', bytes: pdf() });
    expect(second.status).toBe(409);
  });
});

describe('editing a posting', () => {
  it('the owner can fix the title', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id, { title: 'Backend Enginer' });

    const res = await as(base, referrer.id).patch(`/api/jobs/${job.id}`, { title: 'Backend Engineer' });

    expect(res.status).toBe(200);
    expect((await reload(job.id)).title).toBe('Backend Engineer');
  });

  it('nobody else can edit or close it', async () => {
    const owner = await makeReferrer();
    const stranger = await makeReferrer();
    const job = await makeJob(owner.id, { title: 'Backend Engineer' });

    expect((await as(base, stranger.id).patch(`/api/jobs/${job.id}`, { title: 'Hacked' })).status).toBe(403);
    expect((await as(base, stranger.id).patch(`/api/jobs/${job.id}`, { isActive: false })).status).toBe(403);
    expect((await as(base, stranger.id).del(`/api/jobs/${job.id}`)).status).toBe(403);

    const after = await reload(job.id);
    expect(after.title).toBe('Backend Engineer');
    expect(after.isActive).toBe(true);
  });
});

describe('deactivating and reactivating a posting', () => {
  it('a deactivated posting disappears from search and accepts no new C.V.s', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id, { title: 'Backend Engineer' });

    await as(base, referrer.id).patch(`/api/jobs/${job.id}`, { isActive: false });

    expect(await search(seeker.id, 'Backend')).toHaveLength(0);
    const apply = await as(base, seeker.id).upload('/api/applications', { jobId: job.id }, { name: 'cv.pdf', bytes: pdf() });
    expect(apply.status).toBe(404);
  });

  it('starts the 30-day deletion clock', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id);

    await as(base, referrer.id).patch(`/api/jobs/${job.id}`, { isActive: false });

    expect((await reload(job.id)).deactivatedAt).not.toBeNull();
  });

  it('tells seekers whose C.V. is still waiting, and nobody whose was already handled', async () => {
    const referrer = await makeReferrer();
    const waiting = await makeSeeker();
    const handled = await makeSeeker();
    const job = await makeJob(referrer.id);
    await makeApplication({ jobId: job.id, seekerId: waiting.id, referrerId: referrer.id, status: 'submitted' });
    await makeApplication({ jobId: job.id, seekerId: handled.id, referrerId: referrer.id, status: 'internally_submitted' });

    await as(base, referrer.id).patch(`/api/jobs/${job.id}`, { isActive: false });

    expect(await waitForNotification(waiting.id, 'job_deactivated')).toHaveLength(1);
    expect(await waitForNotification(handled.id, 'job_deactivated', 300)).toHaveLength(0);
  });

  it('switching it back on makes it visible again and cancels the deletion clock', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id, { title: 'Backend Engineer' });

    await as(base, referrer.id).patch(`/api/jobs/${job.id}`, { isActive: false });
    await as(base, referrer.id).patch(`/api/jobs/${job.id}`, { isActive: true });

    expect((await reload(job.id)).deactivatedAt).toBeNull();
    expect(await search(seeker.id, 'Backend')).toHaveLength(1);
  });

  it('"Delete" from My postings only deactivates — the applications on it survive', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    await makeApplication({ jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, status: 'internally_submitted' });

    const res = await as(base, referrer.id).del(`/api/jobs/${job.id}`);

    expect(res.status).toBe(204);
    const after = await reload(job.id);
    expect(after).toBeDefined();
    expect(after.isActive).toBe(false);
  });
});
