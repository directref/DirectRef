import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { jobs, notifications } from '../db/schema';
import { runJobLivenessSweep } from './jobLivenessSweep';
import type { LivenessResult } from '../services/jobScraper';
import { daysAgo, hoursAgo, makeReferrer, makeSeeker, makeJob, makeApplication } from '../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: this sweep DEACTIVATES real postings, unattended, on a timer,
 *    based on an HTTP check of someone else's website. Deactivating a job
 *    also closes the applications sitting on it. It is the only automated
 *    process in the product that destroys a referrer's work on the strength
 *    of a third party's response code.
 *  - COST OF FAILURE: asymmetric, which is the whole point. Too eager and a
 *    live posting vanishes along with pending seekers' applications, for no
 *    reason anyone can see. Too shy and a filled role lingers — annoying, but
 *    nobody loses anything. The code is written to fail in the second
 *    direction; these tests exist to keep it that way.
 *  - METHOD: `runJobLivenessSweep` takes an injectable checker precisely so
 *    this is testable without the network. Nothing here touches a real site.
 */

const reload = (id: string) => db.select().from(jobs).where(eq(jobs.id, id)).limit(1).then((r) => r[0]);
const always = (r: LivenessResult) => vi.fn(async () => r);

/** Due for a check = never checked, or checked more than a day ago. */
const makeDueJob = (referrerId: string, overrides = {}) =>
  makeJob(referrerId, { lastLivenessCheckAt: daysAgo(2), ...overrides });

describe('a confirmed-dead link', () => {
  it('deactivates the posting and starts its deletion clock', async () => {
    const referrer = await makeReferrer();
    const job = await makeDueJob(referrer.id);

    await runJobLivenessSweep(always('dead'));

    const after = await reload(job.id);
    expect(after.isActive).toBe(false);
    // deactivatedAt is what jobCleanupSweep later counts 27 and 30 days from.
    // Without it the posting is deactivated but never cleaned up.
    expect(after.deactivatedAt).not.toBeNull();
  });

  it('tells the seekers whose applications are still pending', async () => {
    // Their application just became unanswerable through no fault of theirs
    // and no action by the referrer. Silence here is the product failing at
    // the exact thing it promises.
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeDueJob(referrer.id);
    await makeApplication({ jobId: job.id, seekerId: seeker.id, referrerId: referrer.id });

    await runJobLivenessSweep(always('dead'));

    const notes = await db.select().from(notifications).where(eq(notifications.userId, seeker.id));
    expect(notes.length, 'the seeker was not told the posting went away').toBeGreaterThan(0);
  });
});

describe('anything short of confirmed dead', () => {
  // The conservative half of the rule, and the one that matters most: an
  // ambiguous answer must never be read as evidence. Most ATS platforms
  // return 200 for a filled role and simply change the page text, so
  // "unknown" is the normal reply for a job that IS closed — acting on it
  // would deactivate healthy postings constantly.
  it.each<LivenessResult>(['alive', 'unknown'])('leaves the posting alone on "%s"', async (result) => {
    const referrer = await makeReferrer();
    const job = await makeDueJob(referrer.id);

    await runJobLivenessSweep(always(result));

    const after = await reload(job.id);
    expect(after.isActive).toBe(true);
    expect(after.deactivatedAt).toBeNull();
  });

  it('leaves the posting alone when the check itself throws', async () => {
    // A timeout or DNS failure is the site's problem, not the posting's.
    const referrer = await makeReferrer();
    const job = await makeDueJob(referrer.id);

    await runJobLivenessSweep(vi.fn(async () => { throw new Error('ETIMEDOUT'); }));

    expect((await reload(job.id)).isActive).toBe(true);
  });

  it('one failing check does not stop the rest of the batch', async () => {
    // Each job is checked in its own try/catch. Without that, a single
    // unreachable site would silently stop every later job being checked.
    const referrer = await makeReferrer();
    const bad = await makeDueJob(referrer.id, { sourceUrl: 'https://acme.test/careers/explodes' });
    const good = await makeDueJob(referrer.id, { sourceUrl: 'https://acme.test/careers/fine' });

    await runJobLivenessSweep(vi.fn(async (url: string) => {
      if (url.includes('explodes')) throw new Error('boom');
      return 'dead' as LivenessResult;
    }));

    expect((await reload(bad.id)).isActive, 'the failing one should be untouched').toBe(true);
    expect((await reload(good.id)).isActive, 'the healthy one should still have been processed').toBe(false);
  });
});

describe('which postings get checked at all', () => {
  it('checks a job that has never been checked', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id, { lastLivenessCheckAt: null });

    const check = always('alive');
    await runJobLivenessSweep(check);

    expect(check).toHaveBeenCalledOnce();
    expect((await reload(job.id)).lastLivenessCheckAt).not.toBeNull();
  });

  it('skips a job checked within the last day', async () => {
    // The scheduler ticks every 15 minutes. Without this bound the sweep
    // would hammer every employer's careers page 96 times a day, which is
    // indistinguishable from abuse from their side.
    const referrer = await makeReferrer();
    await makeJob(referrer.id, { lastLivenessCheckAt: hoursAgo(2) });

    const check = always('dead');
    await runJobLivenessSweep(check);

    expect(check).not.toHaveBeenCalled();
  });

  it('never checks an already-deactivated posting', async () => {
    const referrer = await makeReferrer();
    await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(3), lastLivenessCheckAt: daysAgo(2) });

    const check = always('dead');
    await runJobLivenessSweep(check);

    expect(check).not.toHaveBeenCalled();
  });

  it('stamps lastLivenessCheckAt even when the posting stays alive', async () => {
    // The stamp is what stops it being re-checked tomorrow-and-every-tick.
    // If only the 'dead' path stamped, live jobs would be checked forever.
    const referrer = await makeReferrer();
    const job = await makeDueJob(referrer.id);

    await runJobLivenessSweep(always('alive'));

    const after = await reload(job.id);
    expect(after.lastLivenessCheckAt!.getTime()).toBeGreaterThan(hoursAgo(1).getTime());
  });

  it('caps how many it checks in one tick', async () => {
    // JOB_LIVENESS_BATCH_SIZE is 20. A growing jobs table must not turn one
    // tick into a burst of hundreds of simultaneous outbound requests.
    const referrer = await makeReferrer();
    for (let i = 0; i < 25; i += 1) {
      await makeJob(referrer.id, { sourceUrl: `https://acme.test/careers/r${i}`, lastLivenessCheckAt: daysAgo(2) });
    }

    const check = always('alive');
    await runJobLivenessSweep(check);

    expect(check.mock.calls.length).toBeLessThanOrEqual(20);
    expect(check.mock.calls.length).toBeGreaterThan(0);
  });

  it('is idempotent — a second run in the same day re-checks nothing', async () => {
    const referrer = await makeReferrer();
    await makeDueJob(referrer.id);

    const check = always('alive');
    await runJobLivenessSweep(check);
    await runJobLivenessSweep(check);

    expect(check).toHaveBeenCalledOnce();
  });
});
