import { describe, it, expect } from 'vitest';
import { makeReferrer, makeSeeker, makeJob } from '../../test/factories';
import { useServer, as } from '../../test/http';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the Saved tab (PRD v6, US-S5) is where a seeker parks a role
 *    they are not ready to apply to yet. It was built with no test.
 *  - COST OF FAILURE: a seeker comes back for the role they saved and it is
 *    gone, or someone else's saved list shows up in theirs.
 *  - SUCCESS: save, see it, unsave, and nobody sees anyone else's list.
 */

const { base } = useServer();

const savedIds = async (userId: string) =>
  ((await (await as(base, userId).get('/api/saved-jobs')).json() as any).data as Array<{ job: { id: string } }>)
    .map((r) => r.job.id);

describe('saving a job for later', () => {
  it('a saved job shows up in the Saved list, and unsaving removes it', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    const api = as(base, seeker.id);

    expect((await api.post(`/api/saved-jobs/${job.id}`)).status).toBeLessThan(300);
    expect(await savedIds(seeker.id)).toEqual([job.id]);

    expect((await api.del(`/api/saved-jobs/${job.id}`)).status).toBeLessThan(300);
    expect(await savedIds(seeker.id)).toEqual([]);
  });

  it('saving twice keeps one entry', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);

    await as(base, seeker.id).post(`/api/saved-jobs/${job.id}`);
    await as(base, seeker.id).post(`/api/saved-jobs/${job.id}`);

    expect(await savedIds(seeker.id)).toEqual([job.id]);
  });

  it("each seeker sees only their own saved jobs", async () => {
    const referrer = await makeReferrer();
    const dana = await makeSeeker();
    const noa = await makeSeeker();
    const job = await makeJob(referrer.id);

    await as(base, dana.id).post(`/api/saved-jobs/${job.id}`);

    expect(await savedIds(noa.id)).toEqual([]);
  });

  it('requires being logged in', async () => {
    expect((await as(base, null).get('/api/saved-jobs')).status).toBe(401);
  });
});
