import { describe, it, expect } from 'vitest';
import { getResponseStatsForReferrers } from './applications.service';
import { daysAgo, hoursAgo, makeReferrer, makeSeeker, makeJob, makeApplication } from '../../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: this number is shown at the moment a seeker chooses WHICH
 *    referrer to trust with their C.V. It is the product's only comparison
 *    signal, and it is meant to make responsiveness worth competing on.
 *
 *    Until now it measured hours from apply to *opened*, and — worse —
 *    excluded every application that was never opened at all. So the
 *    score-maximising strategy was: open every C.V. instantly, then do
 *    nothing. The badge rewarded the exact behaviour DirectRef exists to
 *    eliminate, and ignoring someone could not lower it, because ignored
 *    applications were not in the sample.
 *
 *  - COST OF FAILURE: a seeker picks the ghoster over the person who would
 *    actually have forwarded their C.V., on the product's own recommendation.
 *  - SUCCESS: answering is the only way to score well.
 */

/** An application the referrer DECIDED on — forwarded, submitted internally,
 *  or turned down. All three are real answers; "not a fit" still tells the
 *  seeker where they stand. */
async function decided(referrerId: string, opts: { hours: number; status?: string }) {
  const seeker = await makeSeeker();
  const job = await makeJob(referrerId);
  const created = hoursAgo(opts.hours + 1);
  return makeApplication({
    jobId: job.id,
    seekerId: seeker.id,
    referrerId,
    status: opts.status ?? 'forwarded',
    createdAt: created,
    updatedAt: new Date(created.getTime() + opts.hours * 3_600_000),
    forwardedAt: new Date(created.getTime() + opts.hours * 3_600_000),
  });
}

/** An application that timed out at day 5 with no decision — the ghosting
 *  the product exists to prevent. */
async function ghosted(referrerId: string, opts: { opened?: boolean } = {}) {
  const seeker = await makeSeeker();
  const job = await makeJob(referrerId);
  const created = daysAgo(10);
  return makeApplication({
    jobId: job.id,
    seekerId: seeker.id,
    referrerId,
    status: 'expired',
    createdAt: created,
    updatedAt: daysAgo(5),
    overrides: {
      autoCancelledAt: daysAgo(5),
      // Opened within the hour and then abandoned — the case the old formula
      // scored as near-perfect.
      viewedAt: opts.opened ? new Date(created.getTime() + 3_600_000) : null,
    },
  });
}

const scoreFor = async (referrerId: string) =>
  (await getResponseStatsForReferrers([referrerId])).get(referrerId);

describe('ignoring people must lower the score', () => {
  it('the ghoster who opens instantly and never answers scores BADLY', async () => {
    // The headline regression. Under the old formula this was ~98/green,
    // because unopened... in fact OPENED-and-abandoned applications were the
    // only ones counted, and they were counted as fast.
    const referrer = await makeReferrer();
    await decided(referrer.id, { hours: 2 });
    await decided(referrer.id, { hours: 2 });
    for (let i = 0; i < 8; i += 1) await ghosted(referrer.id, { opened: true });

    const stats = await scoreFor(referrer.id);
    expect(stats!.decided).toBe(2);
    expect(stats!.total).toBe(10);
    expect(stats!.score, `score was ${stats!.score} — opening fast must not rescue a ghoster`).toBeLessThan(40);
    expect(stats!.band).toBe('red');
  });

  it('the slower referrer who answers EVERYONE scores better than the fast ghoster', async () => {
    // The comparison a seeker actually makes in the picker. If this inverts,
    // the product is recommending the wrong person.
    const ghoster = await makeReferrer();
    await decided(ghoster.id, { hours: 2 });
    await decided(ghoster.id, { hours: 2 });
    for (let i = 0; i < 8; i += 1) await ghosted(ghoster.id, { opened: true });

    const reliable = await makeReferrer();
    for (let i = 0; i < 10; i += 1) await decided(reliable.id, { hours: 30 });

    const g = await scoreFor(ghoster.id);
    const r = await scoreFor(reliable.id);
    expect(r!.score).toBeGreaterThan(g!.score);
  });

  it('counts a turned-down application as a real answer', async () => {
    // "Not a fit" is a response. A referrer who declines promptly is doing
    // the job — the seeker knows where they stand and can move on.
    const referrer = await makeReferrer();
    for (let i = 0; i < 6; i += 1) await decided(referrer.id, { hours: 5, status: 'rejected' });

    const stats = await scoreFor(referrer.id);
    expect(stats!.decided).toBe(6);
    expect(stats!.score).toBeGreaterThan(75);
  });

  it('counts internally_submitted too', async () => {
    const referrer = await makeReferrer();
    for (let i = 0; i < 6; i += 1) await decided(referrer.id, { hours: 5, status: 'internally_submitted' });
    expect((await scoreFor(referrer.id))!.decided).toBe(6);
  });
});

describe('speed still matters, among those who answer', () => {
  it('ranks a same-day answerer above a four-day answerer', async () => {
    const fast = await makeReferrer();
    for (let i = 0; i < 8; i += 1) await decided(fast.id, { hours: 6 });

    const slow = await makeReferrer();
    for (let i = 0; i < 8; i += 1) await decided(slow.id, { hours: 96 });

    expect((await scoreFor(fast.id))!.score).toBeGreaterThan((await scoreFor(slow.id))!.score);
  });

  it('uses the median, so one outlier does not define a record', async () => {
    // With beta-sized samples a single 200-hour answer would otherwise drag
    // an otherwise-prompt referrer into the red.
    const referrer = await makeReferrer();
    for (let i = 0; i < 9; i += 1) await decided(referrer.id, { hours: 4 });
    await decided(referrer.id, { hours: 200 });

    const stats = await scoreFor(referrer.id);
    expect(stats!.medianHours).toBeLessThan(10);
    expect(stats!.score).toBeGreaterThan(70);
  });
});

describe('thin records are kept modest rather than hidden', () => {
  it('does not award a perfect score off a single application', async () => {
    // Shown next to someone with nine out of ten, "100" from one lucky
    // response is confident noise at the moment of maximum trust.
    const referrer = await makeReferrer();
    await decided(referrer.id, { hours: 1 });

    const stats = await scoreFor(referrer.id);
    expect(stats!.total).toBe(1);
    expect(stats!.score).toBeLessThan(85);
    expect(stats!.score).toBeGreaterThan(50); // visible, not punished
  });

  it('lets a strong record outrank a thin perfect one', async () => {
    const thin = await makeReferrer();
    await decided(thin.id, { hours: 1 });

    const proven = await makeReferrer();
    for (let i = 0; i < 9; i += 1) await decided(proven.id, { hours: 6 });
    await ghosted(proven.id);

    expect((await scoreFor(proven.id))!.score).toBeGreaterThan((await scoreFor(thin.id))!.score);
  });

  it('a referrer with no applications at all has no record', async () => {
    // Nothing to shrink toward. The UI shows "new referrer" rather than a
    // number invented from no evidence.
    const referrer = await makeReferrer();
    expect(await scoreFor(referrer.id)).toBeUndefined();
  });

  it('a referrer whose only applications are still open has no record yet', async () => {
    // In flight is not a failure — the clocks have not run out.
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    await makeApplication({ jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, status: 'submitted' });

    expect(await scoreFor(referrer.id)).toBeUndefined();
  });

  it('ignores withdrawn applications — the seeker pulled out, not the referrer', async () => {
    const referrer = await makeReferrer();
    for (let i = 0; i < 6; i += 1) await decided(referrer.id, { hours: 5 });
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    await makeApplication({
      jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, status: 'withdrawn', createdAt: daysAgo(9),
    });

    expect((await scoreFor(referrer.id))!.total).toBe(6);
  });
});

describe('the numbers behind the score are returned for display', () => {
  it('reports decided, total and median so the UI can show "9 of 10"', async () => {
    const referrer = await makeReferrer();
    for (let i = 0; i < 9; i += 1) await decided(referrer.id, { hours: 12 });
    await ghosted(referrer.id);

    const stats = await scoreFor(referrer.id);
    expect(stats!.decided).toBe(9);
    expect(stats!.total).toBe(10);
    expect(stats!.medianHours).toBeCloseTo(12, 0);
  });

  it('scores several referrers in one call', async () => {
    const a = await makeReferrer();
    const b = await makeReferrer();
    for (let i = 0; i < 6; i += 1) await decided(a.id, { hours: 3 });
    for (let i = 0; i < 6; i += 1) await decided(b.id, { hours: 80 });

    const stats = await getResponseStatsForReferrers([a.id, b.id]);
    expect(stats.size).toBe(2);
    expect(stats.get(a.id)!.score).toBeGreaterThan(stats.get(b.id)!.score);
  });
});
