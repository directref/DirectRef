import { describe, it, expect } from 'vitest';
import { makeReferrer, makeSeeker, makeJob } from '../../test/factories';
import { useServer, as } from '../../test/http';

/**
 * WHY THIS FILE:
 *  - PROBLEM: "Suggested for you" (PRD v6, US-S5) promises to be a saved
 *    search over the seeker's own preferences — nothing more — and to stay
 *    hidden when they set none. The privacy policy repeats that promise.
 *    Built, never tested.
 *  - COST OF FAILURE: a generic list dressed up as personal suggestions, or
 *    a role matching one field and contradicting another (a Haifa job for
 *    someone who chose Tel Aviv), which reads as the product not listening.
 *  - SUCCESS: nothing without preferences, and every result matches every
 *    preference the seeker set.
 */

const { base } = useServer();

const suggestedTitles = async (userId: string) =>
  ((await (await as(base, userId).get('/api/jobs/suggested')).json() as any).data as Array<{ job: { title: string } }>)
    .map((r) => r.job.title).sort();

describe('Suggested for you', () => {
  it('shows nothing to a seeker who set no preferences', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    await makeJob(referrer.id, { title: 'Backend Engineer', sourceUrl: 'https://acme.test/1' });

    expect(await suggestedTitles(seeker.id)).toEqual([]);
  });

  it('matches the desired role through the words real postings use', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker({ desiredRole: 'Back-End Developer' });
    await makeJob(referrer.id, { title: 'Senior Backend Engineer', sourceUrl: 'https://acme.test/1' });
    await makeJob(referrer.id, { title: 'Product Designer', sourceUrl: 'https://acme.test/2' });

    expect(await suggestedTitles(seeker.id)).toEqual(['Senior Backend Engineer']);
  });

  it('matches a region through the cities inside it', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker({ preferredLocation: 'Sharon' });
    await makeJob(referrer.id, { title: 'In Herzliya', location: 'Herzliya, Israel', sourceUrl: 'https://acme.test/1' });
    await makeJob(referrer.id, { title: 'In Haifa', location: 'Haifa, Israel', sourceUrl: 'https://acme.test/2' });

    expect(await suggestedTitles(seeker.id)).toEqual(['In Herzliya']);
  });

  it('requires EVERY preference to match, not just one', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker({ desiredRole: 'Back-End Developer', preferredLocation: 'Tel Aviv' });
    await makeJob(referrer.id, { title: 'Backend Engineer', location: 'Tel Aviv', sourceUrl: 'https://acme.test/1' });
    await makeJob(referrer.id, { title: 'Backend Engineer', location: 'Haifa', sourceUrl: 'https://acme.test/2' });
    await makeJob(referrer.id, { title: 'Product Designer', location: 'Tel Aviv', sourceUrl: 'https://acme.test/3' });

    const res = await as(base, seeker.id).get('/api/jobs/suggested');
    const jobs = ((await res.json()) as any).data as Array<{ job: { title: string; location: string } }>;
    expect(jobs.map((r) => `${r.job.title} @ ${r.job.location}`)).toEqual(['Backend Engineer @ Tel Aviv']);
  });

  it('treats "mid" as "neither senior nor junior"', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker({ seniority: 'mid' });
    await makeJob(referrer.id, { title: 'Product Manager', sourceUrl: 'https://acme.test/1' });
    await makeJob(referrer.id, { title: 'Senior Product Manager', sourceUrl: 'https://acme.test/2' });

    expect(await suggestedTitles(seeker.id)).toEqual(['Product Manager']);
  });

  it('never suggests a closed posting, a test account posting, or my own', async () => {
    const referrer = await makeReferrer();
    const tester = await makeReferrer({ isTestAccount: true });
    const seeker = await makeSeeker({ desiredRole: 'Back-End Developer', isReferrer: true });
    await makeJob(referrer.id, { title: 'Backend Closed', isActive: false, sourceUrl: 'https://acme.test/1' });
    await makeJob(tester.id, { title: 'Backend Probe', sourceUrl: 'https://acme.test/2' });
    await makeJob(seeker.id, { title: 'Backend Mine', sourceUrl: 'https://acme.test/3' });
    await makeJob(referrer.id, { title: 'Backend Open', sourceUrl: 'https://acme.test/4' });

    expect(await suggestedTitles(seeker.id)).toEqual(['Backend Open']);
  });
});
