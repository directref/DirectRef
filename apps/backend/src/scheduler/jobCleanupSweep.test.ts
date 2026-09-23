import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { jobs, applications } from '../db/schema';
import { runJobCleanupSweep } from './jobCleanupSweep';
import * as email from '../services/email';
import { daysAgo, makeReferrer, makeSeeker, makeJob, makeApplication, cvFileExists } from '../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: this sweep permanently deletes job postings 30 days after they
 *    are deactivated, and it has already been wrong once in the most expensive
 *    way possible. Before 2026-09-11 it deleted the job row and let the foreign
 *    key cascade take every application with it — LIVE ones included — erasing
 *    in-flight applications, their message threads and their C.V.s without ever
 *    telling the seeker. A referrer quietly deactivating a listing destroyed
 *    other people's job searches a month later.
 *  - COST OF FAILURE: irreversible, invisible, and suffered by someone who did
 *    nothing. The rewrite made it hold a posting until no applications remain;
 *    these tests are what stop that regressing.
 *  - NOTE: the 27/30-day windows mean this cannot act for a month after a
 *    deactivation, so rows are backdated. Nothing here waits.
 */

const jobExists = async (id: string) =>
  (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id))).length > 0;

describe('deleting a long-deactivated posting', () => {
  it('deletes one that no longer has any applications', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(31) });

    await runJobCleanupSweep();

    expect(await jobExists(job.id)).toBe(false);
  });

  it('keeps one deactivated only 29 days', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(29) });

    await runJobCleanupSweep();

    expect(await jobExists(job.id)).toBe(true);
  });

  it('never touches an ACTIVE posting, however old', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id, { isActive: true, deactivatedAt: null });

    await runJobCleanupSweep();

    expect(await jobExists(job.id)).toBe(true);
  });
});

describe('the rule that was broken before, and must not break again', () => {
  it('HOLDS a posting that still has applications on it, however long ago it was deactivated', async () => {
    // The 2026-09-11 bug, pinned. This used to delete the job and cascade over
    // the application, its messages and its C.V. — silently, a month later.
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(90) });
    const application = await makeApplication({
      jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, withCvFile: true,
    });

    await runJobCleanupSweep();

    expect(await jobExists(job.id), 'the posting was deleted with an application still on it').toBe(true);
    expect(
      await db.select().from(applications).where(eq(applications.id, application.id)),
      'the application was cascaded away',
    ).toHaveLength(1);
    expect(cvFileExists(application.cvFilename), "the seeker's C.V. was destroyed").toBe(true);
  });

  it.each(['submitted', 'viewed', 'forwarded', 'rejected', 'expired', 'withdrawn'])(
    'holds it for a %s application — the sweep does not judge status, only presence',
    async (status) => {
      // Deliberately status-blind. Deciding which applications are "finished
      // enough" to destroy is the retention sweep's job, and it erases the
      // APPLICATION, never the posting underneath other people's records.
      const referrer = await makeReferrer();
      const seeker = await makeSeeker();
      const job = await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(60) });
      await makeApplication({ jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, status });

      await runJobCleanupSweep();

      expect(await jobExists(job.id)).toBe(true);
    },
  );

  it('deletes it once the last application has gone', async () => {
    // The two halves in sequence: held while occupied, collected once empty.
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(60) });
    const application = await makeApplication({
      jobId: job.id, seekerId: seeker.id, referrerId: referrer.id,
    });

    await runJobCleanupSweep();
    expect(await jobExists(job.id)).toBe(true);

    await db.delete(applications).where(eq(applications.id, application.id));
    await runJobCleanupSweep();

    expect(await jobExists(job.id)).toBe(false);
  });
});

describe('the deletion warning', () => {
  it('warns the referrer at day 27, three days before deletion', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(28) });

    await runJobCleanupSweep();

    expect(email.sendJobDeletionWarningEmail).toHaveBeenCalled();
    const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(row.deletionWarningEmailSentAt).not.toBeNull();
  });

  it('does not warn at day 20', async () => {
    const referrer = await makeReferrer();
    await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(20) });

    await runJobCleanupSweep();

    expect(email.sendJobDeletionWarningEmail).not.toHaveBeenCalled();
  });

  it('warns once, not every tick', async () => {
    // The scheduler runs this every 15 minutes. Guarded by
    // deletionWarningEmailSentAt, or it is ~96 identical emails a day.
    const referrer = await makeReferrer();
    await makeJob(referrer.id, { isActive: false, deactivatedAt: daysAgo(28) });

    await runJobCleanupSweep();
    await runJobCleanupSweep();
    await runJobCleanupSweep();

    expect(email.sendJobDeletionWarningEmail).toHaveBeenCalledOnce();
  });

  it('does not warn about an active posting', async () => {
    const referrer = await makeReferrer();
    await makeJob(referrer.id, { isActive: true, deactivatedAt: null });

    await runJobCleanupSweep();

    expect(email.sendJobDeletionWarningEmail).not.toHaveBeenCalled();
  });
});
