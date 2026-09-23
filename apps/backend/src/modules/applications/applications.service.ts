import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/db';
import { applications, applicationMessages, jobs, users } from '../../db/schema';
import { eq, and, desc, ne, inArray, isNotNull } from 'drizzle-orm';
import { AppError } from '../../middleware/errorHandler';
import { areFriends } from '../connections/connections.service';
import { createNotification } from '../notifications/notifications.service';
import {
  sendCVNotificationEmail,
  // sendCVViewedEmail, // paused — see the commented call sites below
  sendCVDownloadedEmail,
  sendInternallySubmittedEmail,
  sendNewMessageEmail,
} from '../../services/email';
import { env } from '../../config/env';
import type { SubmitApplicationDto } from './applications.schemas';

/** Submit a CV to a referrer for a specific job */
/** Copies the seeker's profile CV into a fresh, independent file for this
 *  application — never the same disk file, so later replacing or removing
 *  this application's CV (or a different application also started from the
 *  profile CV) never touches the profile copy or any other application. */
async function copyProfileCvForApplication(seekerId: string) {
  const [seeker] = await db
    .select({ cvFilename: users.cvFilename, cvOriginalName: users.cvOriginalName, cvMimetype: users.cvMimetype, cvSizeBytes: users.cvSizeBytes })
    .from(users)
    .where(eq(users.id, seekerId))
    .limit(1);
  if (!seeker?.cvFilename) throw new AppError(400, 'NO_PROFILE_CV', 'No CV on file in your profile');

  const sourcePath = path.resolve(env.UPLOADS_DIR, 'cvs', seeker.cvFilename);
  if (!fs.existsSync(sourcePath)) throw new AppError(404, 'FILE_NOT_FOUND', 'Profile CV file not found on server');

  const filename = `${Date.now()}-${uuidv4()}${path.extname(seeker.cvFilename)}`;
  await fs.promises.copyFile(sourcePath, path.resolve(env.UPLOADS_DIR, 'cvs', filename));

  return {
    cvFilename: filename,
    cvOriginalName: seeker.cvOriginalName!,
    cvMimetype: seeker.cvMimetype!,
    cvSizeBytes: seeker.cvSizeBytes!,
  };
}

export async function submitApplication(
  seekerId: string,
  dto: SubmitApplicationDto,
  file: Express.Multer.File | undefined,
) {
  const cleanupUploadedFile = () => { if (file) fs.unlink(file.path, () => {}); };

  // 1. Load the job
  const [job] = await db.select().from(jobs).where(eq(jobs.id, dto.jobId)).limit(1);
  if (!job || !job.isActive) {
    cleanupUploadedFile();
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found or no longer active');
  }

  // 2. Can't apply to your own posting
  if (job.referrerId === seekerId) {
    cleanupUploadedFile();
    throw new AppError(400, 'SELF_APPLICATION', 'You cannot apply to your own job posting');
  }

  // 3. No duplicate applications — across this exact posting AND any sibling
  //    posting of the same real-world listing (same sourceUrl) by a different
  //    referrer. Picking another referrer on what's visually the same grouped
  //    card still counts as "already applied" to that job.
  const siblingJobs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.sourceUrl, job.sourceUrl));
  const siblingJobIds = siblingJobs.map((j) => j.id);

  const [existing] = await db
    .select()
    .from(applications)
    .where(and(inArray(applications.jobId, siblingJobIds), eq(applications.seekerId, seekerId)))
    .limit(1);

  if (existing) {
    cleanupUploadedFile();
    throw new AppError(409, 'ALREADY_APPLIED', 'You have already sent your CV for this job');
  }

  // 4. Resolve the CV: either the freshly uploaded file, or a copy of the
  //    seeker's profile CV (never the same file — see copyProfileCvForApplication).
  const cv = dto.useProfileCv === 'true' || !file
    ? await copyProfileCvForApplication(seekerId)
    : { cvFilename: file.filename, cvOriginalName: file.originalname, cvMimetype: file.mimetype, cvSizeBytes: file.size };
  if (file && dto.useProfileCv === 'true') cleanupUploadedFile(); // shouldn't happen from our own client, but don't leak a stray upload

  // 5. Insert application — sending a CV is free for seekers; credits only
  //    gate the referrer side (posting a job), see jobs.service.ts createJob.
  const [application] = await db.insert(applications).values({
    jobId: dto.jobId,
    seekerId,
    referrerId: job.referrerId,
    ...cv,
    coverNote: dto.coverNote,
  }).returning();

  // 6. Notify referrer — in-app + email (fire-and-forget)
  const [referrer] = await db.select().from(users).where(eq(users.id, job.referrerId)).limit(1);
  const [seeker] = await db.select().from(users).where(eq(users.id, seekerId)).limit(1);

  if (referrer && seeker) {
    const dashboardUrl = `${env.FRONTEND_URL}/applications/inbox`;
    // In-app notification
    createNotification(
      referrer.id,
      'cv_received',
      `${seeker.fullName} applied with a CV`,
      `Submitted for ${job.title} at ${job.companyName}.`,
      dashboardUrl,
    ).catch(() => {});
    // Email
    sendCVNotificationEmail(
      referrer.email,
      referrer.fullName,
      seeker.fullName,
      job.title,
      job.companyName,
      dashboardUrl,
    ).catch((err) => console.error('[email] CV notification failed:', err));
  }

  return application;
}

/** Swap the CV on a pending application for a different file. Only the
 *  seeker who submitted it can do this, and only before the referrer has
 *  opened it (status === 'submitted') — once it's been viewed, downloading
 *  or forwarding may already be in motion on the old file. */
export async function replaceCv(applicationId: string, seekerId: string, file: Express.Multer.File) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) { fs.unlink(file.path, () => {}); throw new AppError(404, 'NOT_FOUND', 'Application not found'); }
  if (app.seekerId !== seekerId) { fs.unlink(file.path, () => {}); throw new AppError(403, 'FORBIDDEN', 'Access denied'); }
  if (app.status !== 'submitted') {
    fs.unlink(file.path, () => {});
    throw new AppError(400, 'ALREADY_VIEWED', 'This CV has already been viewed by the referrer and can no longer be changed');
  }

  const [updated] = await db.update(applications).set({
    cvFilename: file.filename,
    cvOriginalName: file.originalname,
    cvMimetype: file.mimetype,
    cvSizeBytes: file.size,
    updatedAt: new Date(),
  }).where(eq(applications.id, applicationId)).returning();

  fs.unlink(path.resolve(env.UPLOADS_DIR, 'cvs', app.cvFilename), () => {});

  return updated;
}

/** Withdraw a pending application — only the seeker who submitted it, and
 *  only before the referrer has opened it. The CV file is deleted; the
 *  application row is kept (marked withdrawn) rather than deleted outright,
 *  so history/response-time stats stay consistent. */
export async function withdrawApplication(applicationId: string, seekerId: string) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (app.seekerId !== seekerId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  if (app.status !== 'submitted') {
    throw new AppError(400, 'ALREADY_VIEWED', 'This CV has already been viewed by the referrer and can no longer be withdrawn');
  }

  const [updated] = await db.update(applications).set({
    status: 'withdrawn',
    withdrawnAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(applications.id, applicationId)).returning();

  fs.unlink(path.resolve(env.UPLOADS_DIR, 'cvs', app.cvFilename), () => {});

  const [job] = await db.select().from(jobs).where(eq(jobs.id, app.jobId)).limit(1);
  const [seeker] = await db.select().from(users).where(eq(users.id, seekerId)).limit(1);
  if (job && seeker) {
    createNotification(
      app.referrerId,
      'cv_withdrawn',
      `${seeker.fullName} withdrew their application`,
      `${seeker.fullName} withdrew the CV for ${job.title} at ${job.companyName} before it was reviewed.`,
      `${env.FRONTEND_URL}/applications/inbox`,
    ).catch(() => {});
  }

  return updated;
}

// ── Response-time scoring ────────────────────────────────────────────────────
// "Response time" = time from the seeker clicking Send (applications.createdAt)
// to the referrer downloading/opening the CV (applications.viewedAt) — the
// moment we assume they've actually looked at it. Not tracked past that point.
//
// Hours → 0-100 score, banded so it can be colored in the UI:
//   0–24h  → green,  score 80–100
//   24–48h → orange, score 50–80
//   >48h   → red,    score 0–50 (floors at 0 by 96h)
// Slower average response = lower score, by design.

export type ResponseBand = 'green' | 'orange' | 'red';
export interface ResponseStats {
  score: number;
  band: ResponseBand;
  /** Applications this referrer actually answered. */
  decided: number;
  /** Answered + timed out. The denominator that makes ignoring count. */
  total: number;
  /** Median hours to a decision, among those answered. */
  medianHours: number;
}

/** An answer, of any kind. "Not a fit" is a response — the seeker knows where
 *  they stand and can move on, which is the whole promise. */
const DECIDED_STATUSES = ['forwarded', 'internally_submitted', 'rejected'] as const;
/** No answer at all: the day-5 auto-close. This is the ghosting the product
 *  exists to prevent, and it must count against the referrer. Applications
 *  still in flight are excluded entirely — the clocks have not run out, so
 *  nothing has been decided either way. Withdrawn is excluded too: the seeker
 *  pulled out, which says nothing about the referrer. */
const GHOSTED_STATUS = 'expired';

/** How the hours-to-answer map onto 0–100. Unchanged, and deliberately: the
 *  breakpoints are the escalation ladder the product already commits to —
 *  24h before the first nudge, 48h before the firm one, and by 96h the
 *  application is nearly auto-closed. */
function speedScore(hours: number): number {
  if (hours <= 24) return 100 - (hours / 24) * 20;
  if (hours <= 48) return 80 - ((hours - 24) / 24) * 30;
  return Math.max(0, 50 - ((hours - 48) / 48) * 50);
}

/** Thin records are pulled toward the middle rather than hidden.
 *
 *  A hard "show nothing under N applications" would blank the badge for
 *  almost every referrer through the whole early beta — exactly the window
 *  where it is supposed to shape behaviour. Instead each referrer carries a
 *  few notional average answers that real ones gradually outweigh: one lucky
 *  fast response reads as promising rather than perfect, and cannot outrank
 *  nine-out-of-ten. The displayed "9 of 10" tells the seeker how much
 *  evidence is behind it. */
const PRIOR_WEIGHT = 3;
const PRIOR_RATE = 0.6;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * How reliably a referrer answers, and how quickly — the number a seeker sees
 * when choosing between referrers on the same posting.
 *
 * Deliberately built on DECISIONS, not opens. It previously measured hours
 * from apply to `viewedAt` and filtered out every application that was never
 * opened, which made the score-maximising strategy "open everything instantly,
 * then do nothing" — rewarding precisely the behaviour this product exists to
 * eliminate, and making ignoring someone literally unable to lower the score.
 *
 * Referrers with nothing resolved yet are absent from the map: no evidence is
 * not the same as bad evidence, and the UI says "new referrer" instead.
 */
export async function getResponseStatsForReferrers(referrerIds: string[]): Promise<Map<string, ResponseStats>> {
  const result = new Map<string, ResponseStats>();
  if (referrerIds.length === 0) return result;

  const rows = await db
    .select({
      referrerId: applications.referrerId,
      status: applications.status,
      createdAt: applications.createdAt,
      forwardedAt: applications.forwardedAt,
      updatedAt: applications.updatedAt,
    })
    .from(applications)
    .where(and(
      inArray(applications.referrerId, referrerIds),
      inArray(applications.status, [...DECIDED_STATUSES, GHOSTED_STATUS]),
    ));

  const byReferrer = new Map<string, { hours: number[]; ghosted: number }>();
  for (const row of rows) {
    const entry = byReferrer.get(row.referrerId) ?? { hours: [], ghosted: 0 };
    if (row.status === GHOSTED_STATUS) {
      entry.ghosted += 1;
    } else {
      // forwardedAt is the moment the referrer acted, and is exact for the
      // forwarded and internally_submitted paths. A rejection stamps no
      // dedicated column, so updatedAt stands in — accurate in practice,
      // since a declined application is rarely touched again.
      const decidedAt = row.forwardedAt ?? row.updatedAt;
      entry.hours.push(Math.max(0, (decidedAt.getTime() - row.createdAt.getTime()) / 3_600_000));
    }
    byReferrer.set(row.referrerId, entry);
  }

  for (const [referrerId, { hours, ghosted }] of byReferrer) {
    const decided = hours.length;
    const total = decided + ghosted;
    if (total === 0) continue;

    // No answers at all is a real, and bad, record — score it on the rate
    // alone rather than skipping the referrer.
    const medianHours = decided > 0 ? median(hours) : 0;
    const rate = (decided + PRIOR_WEIGHT * PRIOR_RATE) / (total + PRIOR_WEIGHT);
    const score = Math.round((decided > 0 ? speedScore(medianHours) : 0) * rate);
    const band: ResponseBand = score >= 80 ? 'green' : score >= 50 ? 'orange' : 'red';

    result.set(referrerId, { score, band, decided, total, medianHours: Math.round(medianHours * 10) / 10 });
  }
  return result;
}

/** Referrer's inbox — CVs they received */
export async function getInbox(referrerId: string, status: string | undefined, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const conditions = [eq(applications.referrerId, referrerId)];
  if (status) conditions.push(eq(applications.status, status));

  return db
    .select({
      application: {
        id: applications.id,
        status: applications.status,
        coverNote: applications.coverNote,
        createdAt: applications.createdAt,
        cvOriginalName: applications.cvOriginalName,
        cvSizeBytes: applications.cvSizeBytes,
      },
      job: { id: jobs.id, title: jobs.title, companyName: jobs.companyName },
      seeker: {
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        headline: users.headline,
        yearsOfExperience: users.yearsOfExperience,
      },
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(users, eq(users.id, applications.seekerId))
    .where(and(...conditions))
    .orderBy(desc(applications.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Seeker's sent applications */
export async function getMineApplications(seekerId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;
  return db
    .select({
      application: {
        id: applications.id,
        status: applications.status,
        coverNote: applications.coverNote,
        createdAt: applications.createdAt,
      },
      job: { id: jobs.id, title: jobs.title, companyName: jobs.companyName },
      referrer: { id: users.id, fullName: users.fullName, avatarUrl: users.avatarUrl },
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(users, eq(users.id, applications.referrerId))
    .where(eq(applications.seekerId, seekerId))
    .orderBy(desc(applications.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Get single application — accessible by seeker or referrer */
export async function getApplicationById(applicationId: string, userId: string) {
  const [row] = await db
    .select({
      application: applications,
      job: { id: jobs.id, title: jobs.title, companyName: jobs.companyName },
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.id, applicationId))
    .limit(1);

  if (!row) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (row.application.seekerId !== userId && row.application.referrerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  // Strip internal cv_filename before returning
  const { cvFilename: _, ...safeApplication } = row.application;
  return { ...row, application: safeApplication };
}

export async function updateStatus(
  applicationId: string,
  referrerId: string,
  status: 'viewed' | 'forwarded' | 'rejected' | 'internally_submitted',
) {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (app.referrerId !== referrerId) throw new AppError(403, 'FORBIDDEN', 'Access denied');
  // Once an application has reached an end state, nothing should move it
  // elsewhere — most importantly 'withdrawn': the seeker pulled it and its
  // CV file is already deleted from disk, so "Download" or "Not a fit"
  // reaching here would either 404 or silently override a decision that
  // was never the referrer's to make.
  const TERMINAL_STATUSES = ['withdrawn', 'rejected', 'expired'];
  if (TERMINAL_STATUSES.includes(app.status)) {
    throw new AppError(400, 'ALREADY_DECIDED', 'This application has already reached a final state and can no longer be updated');
  }
  // 'internally_submitted' stays terminal for every transition except one:
  // HR can still pass on the candidate after the referrer already submitted
  // their CV internally, and the referrer needs a way to tell the seeker —
  // so marking it 'rejected' after the fact is the one exception.
  if (app.status === 'internally_submitted' && status !== 'rejected') {
    throw new AppError(400, 'ALREADY_DECIDED', 'This application has already reached a final state and can no longer be updated');
  }
  // Confirming internal submission only makes sense after the CV was actually
  // downloaded — that's what starts Clock B in the first place.
  if (status === 'internally_submitted' && app.status !== 'forwarded') {
    throw new AppError(400, 'NOT_DOWNLOADED', 'Download the CV before confirming internal submission');
  }

  const [updated] = await db
    .update(applications)
    .set({
      status,
      updatedAt: new Date(),
      ...(status === 'viewed' && !app.viewedAt ? { viewedAt: new Date() } : {}),
      ...(status === 'forwarded' && !app.forwardedAt ? { forwardedAt: new Date() } : {}),
    })
    .where(eq(applications.id, applicationId))
    .returning();

  // Notify seeker of the referrer's decision
  if (status === 'rejected' || status === 'forwarded' || status === 'internally_submitted') {
    const [job]      = await db.select().from(jobs).where(eq(jobs.id, app.jobId)).limit(1);
    const [referrer] = await db.select().from(users).where(eq(users.id, referrerId)).limit(1);
    const [seeker]   = await db.select().from(users).where(eq(users.id, app.seekerId)).limit(1);
    if (job && referrer && seeker) {
      const appsUrl = `${env.FRONTEND_URL}/applications`;
      if (status === 'rejected') {
        createNotification(
          app.seekerId,
          'cv_rejected',
          `${referrer.fullName} couldn't move forward with your CV`,
          `Your application for ${job.title} at ${job.companyName} wasn't the right fit this time.`,
          appsUrl,
        ).catch(() => {});
      } else if (status === 'forwarded') {
        createNotification(
          app.seekerId,
          'cv_forwarded',
          `${referrer.fullName} downloaded your CV`,
          `Your application for ${job.title} at ${job.companyName} was accepted — ${referrer.fullName} downloaded the CV to apply.`,
          appsUrl,
        ).catch(() => {});
        sendCVDownloadedEmail(seeker.email, seeker.fullName, referrer.fullName, job.title, job.companyName, appsUrl)
          .catch((err) => console.error('[email] CV downloaded notify failed:', err));
      } else {
        createNotification(
          app.seekerId,
          'cv_internally_submitted',
          `${referrer.fullName} submitted your CV internally`,
          `Great news! Your CV for ${job.title} at ${job.companyName} was submitted into the internal system.`,
          appsUrl,
        ).catch(() => {});
        sendInternallySubmittedEmail(seeker.email, seeker.fullName, referrer.fullName, job.title, job.companyName, appsUrl)
          .catch((err) => console.error('[email] internally submitted notify failed:', err));
      }
    }
  }

  return updated;
}

/** Stream CV file inline (for viewing in browser) */
export async function getCVPreviewPath(applicationId: string, userId: string): Promise<{ filePath: string; mimeType: string }> {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (app.seekerId !== userId && app.referrerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  const filePath = path.resolve(env.UPLOADS_DIR, 'cvs', app.cvFilename);
  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'FILE_NOT_FOUND', 'CV file not found on server');
  }

  // Auto-mark as viewed when referrer previews
  if (app.referrerId === userId && app.status === 'submitted') {
    db.update(applications)
      .set({ status: 'viewed', viewedAt: new Date(), updatedAt: new Date() })
      .where(eq(applications.id, applicationId))
      .execute()
      .then(async () => {
        const [job]      = await db.select().from(jobs).where(eq(jobs.id, app.jobId)).limit(1);
        const [seeker]   = await db.select().from(users).where(eq(users.id, app.seekerId)).limit(1);
        const [referrer] = await db.select().from(users).where(eq(users.id, app.referrerId)).limit(1);
        if (job && seeker && referrer) {
          const appsUrl = `${env.FRONTEND_URL}/applications`;
          createNotification(seeker.id, 'cv_viewed', `${referrer.fullName} viewed your CV`, `Your CV for ${job.title} at ${job.companyName} was reviewed.`, appsUrl).catch(() => {});
          // "CV viewed" email paused — the seeker's first email is the download, not the view.
          // sendCVViewedEmail(seeker.email, seeker.fullName, referrer.fullName, job.title, job.companyName, appsUrl)
          //   .catch((err) => console.error('[email] CV viewed notify failed:', err));
        }
      }).catch(() => {});
  }

  return { filePath, mimeType: app.cvMimetype };
}

/** Stream CV file — accessible by seeker (uploader) or referrer */
export async function getCVPath(applicationId: string, userId: string): Promise<{ filePath: string; originalName: string }> {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (app.seekerId !== userId && app.referrerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  const filePath = path.resolve(env.UPLOADS_DIR, 'cvs', app.cvFilename);
  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'FILE_NOT_FOUND', 'CV file not found on server');
  }

  // Auto-mark as viewed when referrer downloads — and notify the seeker
  if (app.referrerId === userId && app.status === 'submitted') {
    db.update(applications)
      .set({ status: 'viewed', viewedAt: new Date(), updatedAt: new Date() })
      .where(eq(applications.id, applicationId))
      .execute()
      .then(async () => {
        // Notify the seeker that their CV was viewed
        const [job]        = await db.select().from(jobs).where(eq(jobs.id, app.jobId)).limit(1);
        const [seeker]     = await db.select().from(users).where(eq(users.id, app.seekerId)).limit(1);
        const [referrer]   = await db.select().from(users).where(eq(users.id, app.referrerId)).limit(1);
        if (job && seeker && referrer) {
          const appsUrl = `${env.FRONTEND_URL}/applications`;
          // In-app notification
          createNotification(
            seeker.id,
            'cv_viewed',
            `${referrer.fullName} viewed your CV`,
            `Your CV for ${job.title} at ${job.companyName} was reviewed.`,
            appsUrl,
          ).catch(() => {});
          // "CV viewed" email paused — the seeker's first email is the download, not the view.
          // sendCVViewedEmail(
          //   seeker.email,
          //   seeker.fullName,
          //   referrer.fullName,
          //   job.title,
          //   job.companyName,
          //   appsUrl,
          // ).catch((err) => console.error('[email] CV viewed notify failed:', err));
        }
      })
      .catch(() => {});
  }

  return { filePath, originalName: app.cvOriginalName };
}

// ── Messaging ─────────────────────────────────────────────────────────────────

export interface MessageRow {
  id: string;
  applicationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

/** Fetch the message thread for an application.
 *  Also marks all messages sent by the OTHER party as read. */
export async function getMessages(
  applicationId: string,
  userId: string,
): Promise<{ messages: MessageRow[]; unreadCount: number }> {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (app.seekerId !== userId && app.referrerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  // Count unread messages from the other party BEFORE marking them read
  const allMessages = await db
    .select({
      id: applicationMessages.id,
      applicationId: applicationMessages.applicationId,
      senderId: applicationMessages.senderId,
      senderName: users.fullName,
      senderAvatarUrl: users.avatarUrl,
      content: applicationMessages.content,
      isRead: applicationMessages.isRead,
      createdAt: applicationMessages.createdAt,
    })
    .from(applicationMessages)
    .innerJoin(users, eq(users.id, applicationMessages.senderId))
    .where(eq(applicationMessages.applicationId, applicationId))
    .orderBy(applicationMessages.createdAt);

  const unreadCount = allMessages.filter((m) => !m.isRead && m.senderId !== userId).length;

  // Mark the other party's messages as read (fire-and-forget)
  db.update(applicationMessages)
    .set({ isRead: true })
    .where(
      and(
        eq(applicationMessages.applicationId, applicationId),
        ne(applicationMessages.senderId, userId),
        eq(applicationMessages.isRead, false),
      ),
    )
    .execute()
    .catch(() => {});

  return { messages: allMessages, unreadCount };
}

/** Send a message within an application thread */
export async function sendMessage(
  applicationId: string,
  senderId: string,
  content: string,
): Promise<MessageRow> {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (app.seekerId !== senderId && app.referrerId !== senderId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  const [inserted] = await db
    .insert(applicationMessages)
    .values({ applicationId, senderId, content })
    .returning();

  // Notify the other party — fire-and-forget. Deep-links straight into this
  // application's own thread (tab=received for the referrer's CV Inbox,
  // tab=sent for the seeker's Sent CV) instead of the bare list, which used
  // to leave the recipient hunting for which of several applicants the new
  // message belonged to.
  const recipientId = senderId === app.seekerId ? app.referrerId : app.seekerId;
  const recipientLinkUrl =
    senderId === app.seekerId
      ? `${env.FRONTEND_URL}/applications?tab=received&openMessage=${applicationId}`
      : `${env.FRONTEND_URL}/applications?tab=sent&openMessage=${applicationId}`;

  db.select({ fullName: users.fullName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, senderId))
    .limit(1)
    .then(([sender]) => {
      if (!sender) return;
      const preview = content.length > 120 ? `${content.slice(0, 117)}…` : content;
      createNotification(
        recipientId,
        'application_message',
        `${sender.fullName} sent you a message`,
        preview,
        recipientLinkUrl,
      ).catch(() => {});
      db.select({ email: users.email, fullName: users.fullName })
        .from(users)
        .where(eq(users.id, recipientId))
        .limit(1)
        .then(([recipient]) => {
          if (!recipient) return;
          sendNewMessageEmail(recipient.email, recipient.fullName, sender.fullName, preview, recipientLinkUrl)
            .catch((err) => console.error('[email] message notify failed:', err));
        })
        .catch(() => {});
    })
    .catch(() => {});

  // Return with sender info joined
  const [row] = await db
    .select({
      id: applicationMessages.id,
      applicationId: applicationMessages.applicationId,
      senderId: applicationMessages.senderId,
      senderName: users.fullName,
      senderAvatarUrl: users.avatarUrl,
      content: applicationMessages.content,
      isRead: applicationMessages.isRead,
      createdAt: applicationMessages.createdAt,
    })
    .from(applicationMessages)
    .innerJoin(users, eq(users.id, applicationMessages.senderId))
    .where(eq(applicationMessages.id, inserted.id))
    .limit(1);

  return row;
}

/** Get unread message count for an application (for badge display without opening thread) */
export async function getUnreadMessageCount(applicationId: string, userId: string): Promise<number> {
  const [app] = await db.select().from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (app.seekerId !== userId && app.referrerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Access denied');
  }

  const rows = await db
    .select({ id: applicationMessages.id })
    .from(applicationMessages)
    .where(
      and(
        eq(applicationMessages.applicationId, applicationId),
        ne(applicationMessages.senderId, userId),
        eq(applicationMessages.isRead, false),
      ),
    );

  return rows.length;
}
