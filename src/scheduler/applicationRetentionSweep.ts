import path from 'path';
import fs from 'fs';
import { db } from '../config/db';
import { applications, jobs } from '../db/schema';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { env } from '../config/env';
import { APPLICATION_RETENTION_DAYS, APPLICATION_RETENTION_MS } from '../config/escalation';
import { createNotification } from '../modules/notifications/notifications.service';

/** Statuses that mean the application is finished. Anything not in this list
 *  is live and is NEVER erased, however long it has been sitting — that is the
 *  first half of the retention rule and the reason this sweep exists at all. */
const CLOSED_STATUSES = ['rejected', 'expired', 'internally_submitted', 'withdrawn'] as const;

/** Erase closed applications that have had no activity for the retention
 *  window: the row itself untouched, and no message sent on it, since the
 *  cutoff. Deleting the row cascades its message thread; the C.V. copy on
 *  disk is unlinked separately because it isn't a database row.
 *
 *  The C.V. here is always this application's own copy — submitApplication
 *  either stores a freshly uploaded file or takes a copy of the profile C.V.
 *  (copyProfileCvForApplication), never a shared reference — so unlinking it
 *  can never remove the seeker's profile C.V. */
async function eraseInactiveClosedApplications(): Promise<number> {
  const cutoff = new Date(Date.now() - APPLICATION_RETENTION_MS.ERASE);

  const rows = await db
    .select({
      id: applications.id,
      seekerId: applications.seekerId,
      cvFilename: applications.cvFilename,
      jobTitle: jobs.title,
      companyName: jobs.companyName,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(
      inArray(applications.status, [...CLOSED_STATUSES]),
      lte(applications.updatedAt, cutoff),
      sql`NOT EXISTS (
        SELECT 1 FROM application_messages m
        WHERE m.application_id = ${applications.id} AND m.created_at > ${cutoff}
      )`,
    ));

  let erased = 0;
  for (const row of rows) {
    try {
      // Tell the seeker before the record leaves their list. In-app only —
      // a closed application that has been quiet for a month doesn't warrant
      // an email, but it shouldn't vanish silently either.
      await createNotification(
        row.seekerId,
        'application_erased',
        `Your closed application to ${row.jobTitle} was deleted`,
        `It closed over ${APPLICATION_RETENTION_DAYS.ERASE} days ago. We keep closed applications, their C.V. and their messages for ${APPLICATION_RETENTION_DAYS.ERASE} days of inactivity, then erase them.`,
        `${env.FRONTEND_URL}/applications`,
      ).catch(() => {});

      // Row first: messages cascade in the database regardless of whether the
      // file is still on disk, and a failed unlink shouldn't leave the row.
      await db.delete(applications).where(eq(applications.id, row.id));

      const filePath = path.resolve(env.UPLOADS_DIR, 'cvs', row.cvFilename);
      await fs.promises.unlink(filePath).catch((err) => {
        // ENOENT is expected for withdrawn applications — withdrawing already
        // deletes the C.V. and keeps the row.
        if (err.code !== 'ENOENT') console.error('[retention] failed to delete CV file', filePath, err);
      });

      erased += 1;
    } catch (err) {
      console.error('[retention] erase failed for application', row.id, err);
    }
  }
  return erased;
}

export async function runApplicationRetentionSweep(): Promise<void> {
  try {
    const erased = await eraseInactiveClosedApplications();
    if (erased) console.log(`[retention] sweep: ${erased} closed application(s) erased`);
  } catch (err) {
    console.error('[retention] sweep failed:', err);
  }
}
