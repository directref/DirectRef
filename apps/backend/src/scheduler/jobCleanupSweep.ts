import { db } from '../config/db';
import { jobs, applications, users } from '../db/schema';
import { eq, and, lte, isNull, isNotNull, sql } from 'drizzle-orm';
import { env } from '../config/env';
import { JOB_CLEANUP_MS } from '../config/escalation';
import { createNotification } from '../modules/notifications/notifications.service';
import { sendJobDeletionWarningEmail } from '../services/email';

/** Day 27 from deactivation — warn the referrer the posting will be deleted in 3 days. */
async function sendDeletionWarnings(): Promise<number> {
  const cutoff = new Date(Date.now() - JOB_CLEANUP_MS.DELETION_WARNING);
  const rows = await db
    .select({ job: jobs })
    .from(jobs)
    .where(and(
      eq(jobs.isActive, false),
      isNotNull(jobs.deactivatedAt),
      lte(jobs.deactivatedAt, cutoff),
      isNull(jobs.deletionWarningEmailSentAt),
    ));

  let warned = 0;
  for (const { job } of rows) {
    try {
      const [referrer] = await db.select().from(users).where(eq(users.id, job.referrerId)).limit(1);
      if (!referrer) continue;

      await db.update(jobs)
        .set({ deletionWarningEmailSentAt: new Date() })
        .where(eq(jobs.id, job.id));

      const jobsUrl = `${env.FRONTEND_URL}/jobs/post`;
      await createNotification(
        referrer.id,
        'job_deletion_warning',
        `${job.title} will be deleted in 3 days`,
        `This posting has been inactive for 27 days. Reactivate it before then, or it will be permanently deleted once the applications on it have closed.`,
        jobsUrl,
      ).catch(() => {});
      await sendJobDeletionWarningEmail(referrer.email, referrer.fullName, job.title, job.companyName, jobsUrl)
        .catch((err) => console.error('[job-cleanup] deletion warning email failed:', err));

      warned += 1;
    } catch (err) {
      console.error('[job-cleanup] deletion warning failed for job', job.id, err);
    }
  }
  return warned;
}

/** Day 30 from deactivation — permanently delete the posting, but ONLY once no
 *  applications are left hanging off it.
 *
 *  Applications are never destroyed here. They are erased on their own clock by
 *  applicationRetentionSweep (closed + 30 days of inactivity), which is the only
 *  place an application, its messages and its C.V. are deleted. A posting whose
 *  applications are still live — or closed but inside the retention window —
 *  is simply skipped and re-checked on the next tick; it disappears on the
 *  first sweep after its last application has been erased.
 *
 *  This is the "nothing active is ever deleted" half of the retention rule.
 *  Before 2026-09-11 this function deleted the job row and let the foreign key
 *  cascade take every application with it, live ones included — which erased
 *  in-flight applications, their message threads and their C.V.s without ever
 *  telling the seeker. */
async function deleteEmptyExpiredJobs(): Promise<{ deleted: number; skipped: number }> {
  const cutoff = new Date(Date.now() - JOB_CLEANUP_MS.DELETE);
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(
      eq(jobs.isActive, false),
      isNotNull(jobs.deactivatedAt),
      lte(jobs.deactivatedAt, cutoff),
      sql`NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = ${jobs.id})`,
    ));

  let deleted = 0;
  for (const { id: jobId } of rows) {
    try {
      // Re-check inside the loop: the retention sweep and this one run in the
      // same tick, and a seeker can apply right up until deactivation.
      const [stillHasApplications] = await db
        .select({ id: applications.id })
        .from(applications)
        .where(eq(applications.jobId, jobId))
        .limit(1);
      if (stillHasApplications) continue;

      await db.delete(jobs).where(eq(jobs.id, jobId));
      deleted += 1;
    } catch (err) {
      console.error('[job-cleanup] deletion failed for job', jobId, err);
    }
  }

  const [{ count: pending }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(
      eq(jobs.isActive, false),
      isNotNull(jobs.deactivatedAt),
      lte(jobs.deactivatedAt, cutoff),
      sql`EXISTS (SELECT 1 FROM applications a WHERE a.job_id = ${jobs.id})`,
    ));

  return { deleted, skipped: pending };
}

export async function runJobCleanupSweep(): Promise<void> {
  try {
    const { deleted, skipped } = await deleteEmptyExpiredJobs();
    const warned = await sendDeletionWarnings();
    if (deleted || warned || skipped) {
      console.log(`[job-cleanup] sweep: ${warned} deletion warning(s) sent, ${deleted} empty job(s) deleted, ${skipped} held (applications still retained)`);
    }
  } catch (err) {
    console.error('[job-cleanup] sweep failed:', err);
  }
}
