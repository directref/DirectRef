import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { db } from '../../config/db';
import { users, applications, jobs } from '../../db/schema';
import { eq, ilike, or, and, ne } from 'drizzle-orm';
import { AppError } from '../../middleware/errorHandler';
import { sanitizeUser } from '../auth/auth.service';
import { extractEmailDomain, isPersonalEmailDomain } from '../../services/companyMatch';
import { sendWorkEmailVerificationEmail } from '../../services/email';
import { env } from '../../config/env';
import { createNotification } from '../notifications/notifications.service';
import type { UpdateProfileDto } from './users.schemas';

export async function getProfile(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return sanitizeUser(user);
}

export async function updateProfile(userId: string, dto: UpdateProfileDto) {
  const [updated] = await db
    .update(users)
    .set({ ...dto, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return sanitizeUser(updated);
}

/** Submits (or replaces) a work email and sends a confirmation link. Doesn't
 *  mark it verified until the link is clicked (see auth.service.ts verifyWorkEmail). */
export async function requestWorkEmailVerification(userId: string, workEmail: string): Promise<void> {
  const normalized = workEmail.trim().toLowerCase();
  const domain = extractEmailDomain(normalized);
  if (isPersonalEmailDomain(domain)) {
    throw new AppError(400, 'PERSONAL_EMAIL', 'Please use your work email, not a personal email provider');
  }

  const [user] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const token = crypto.randomBytes(32).toString('hex');
  const tokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour, same window as password reset

  await db.update(users).set({
    workEmail: normalized,
    workEmailVerified: false,
    workEmailVerifyToken: token,
    workEmailVerifyTokenExp: tokenExp,
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  await sendWorkEmailVerificationEmail(normalized, user.fullName, token);
}

export async function searchUsers(q: string, page: number, limit: number, requesterId: string) {
  const offset = (page - 1) * limit;

  // If no query — return all users except self (for "People you may know")
  const whereClause = q.trim()
    ? and(
        or(ilike(users.fullName, `%${q}%`), ilike(users.companyName, `%${q}%`)),
        ne(users.id, requesterId),
      )
    : ne(users.id, requesterId);

  const results = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      headline: users.headline,
      avatarUrl: users.avatarUrl,
      companyName: users.companyName,
      isReferrer: users.isReferrer,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause)
    .limit(limit)
    .offset(offset);
  return results;
}

/** Delete an account, everything it owns, and every C.V. file it put on disk.
 *
 *  Deleting the user row cascades to their jobs, their applications (on both
 *  sides), message threads and notifications. Two things the cascade cannot do,
 *  which is the whole reason this function is more than one line:
 *
 *  1. **Tell the seekers.** A referrer leaving takes their postings with them,
 *     and every application sent to those postings goes too. Those applications
 *     belong to seekers who are waiting on an answer. They are notified in-app
 *     before the delete — no email; the account is going either way and there is
 *     nothing for them to act on.
 *  2. **Remove the C.V. files.** Files live on disk, not in the database, so a
 *     cascade leaves them orphaned forever. This collects every one — the
 *     profile C.V., every copy sent as this user's own application, and every
 *     copy sitting in an application they received — and unlinks them after the
 *     rows are gone. The Privacy Policy promises exactly this. */
export async function deleteAccount(userId: string): Promise<void> {
  const [user] = await db
    .select({ fullName: users.fullName, cvFilename: users.cvFilename })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  // Applications this user RECEIVED as a referrer — their seekers need telling.
  const received = await db
    .select({
      seekerId: applications.seekerId,
      cvFilename: applications.cvFilename,
      jobTitle: jobs.title,
      companyName: jobs.companyName,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.referrerId, userId));

  // Applications this user SENT as a seeker — no one to notify, but the C.V.
  // copies are theirs and must go.
  const sent = await db
    .select({ cvFilename: applications.cvFilename })
    .from(applications)
    .where(eq(applications.seekerId, userId));

  for (const app of received) {
    await createNotification(
      app.seekerId,
      'referrer_left',
      `${user.fullName} is no longer on DirectRef`,
      `Your application for ${app.jobTitle} at ${app.companyName} has been closed and removed, because the person you sent it to deleted their account. Applying is free — if someone else inside the company posts this role, you can send your C.V. again.`,
      `${env.FRONTEND_URL}/jobs`,
    ).catch(() => {});
  }

  // Rows first — an unlink that fails must never leave the account half-deleted.
  await db.delete(users).where(eq(users.id, userId));

  const filenames = [
    user.cvFilename,
    ...received.map((a) => a.cvFilename),
    ...sent.map((a) => a.cvFilename),
  ].filter((f): f is string => Boolean(f));

  for (const filename of new Set(filenames)) {
    await fs.promises.unlink(path.resolve(env.UPLOADS_DIR, 'cvs', filename)).catch((err) => {
      if (err.code !== 'ENOENT') console.error('[delete-account] failed to delete CV file', filename, err);
    });
  }
}

// ── Profile CV (CV of record) ────────────────────────────────────────────────
// A CV kept on the profile, separate from any application's CV. Applying to a
// job can reuse it, but always by copying it into a new file for that
// application (see applications.service.ts submitApplication) — so later
// replacing or removing an application's CV never touches this one, or any
// other application that also started from it.

export async function uploadProfileCv(userId: string, file: Express.Multer.File) {
  const [existing] = await db.select({ cvFilename: users.cvFilename }).from(users).where(eq(users.id, userId)).limit(1);

  const [updated] = await db.update(users).set({
    cvFilename: file.filename,
    cvOriginalName: file.originalname,
    cvMimetype: file.mimetype,
    cvSizeBytes: file.size,
    updatedAt: new Date(),
  }).where(eq(users.id, userId)).returning();

  if (existing?.cvFilename) {
    fs.unlink(path.resolve(env.UPLOADS_DIR, 'cvs', existing.cvFilename), () => {});
  }

  return sanitizeUser(updated);
}

export async function removeProfileCv(userId: string) {
  const [existing] = await db.select({ cvFilename: users.cvFilename }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const [updated] = await db.update(users).set({
    cvFilename: null,
    cvOriginalName: null,
    cvMimetype: null,
    cvSizeBytes: null,
    updatedAt: new Date(),
  }).where(eq(users.id, userId)).returning();

  if (existing.cvFilename) {
    fs.unlink(path.resolve(env.UPLOADS_DIR, 'cvs', existing.cvFilename), () => {});
  }

  return sanitizeUser(updated);
}

async function getOwnCvFile(userId: string) {
  const [user] = await db
    .select({ cvFilename: users.cvFilename, cvOriginalName: users.cvOriginalName, cvMimetype: users.cvMimetype })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.cvFilename) throw new AppError(404, 'NO_CV_ON_FILE', 'No CV on file');

  const filePath = path.resolve(env.UPLOADS_DIR, 'cvs', user.cvFilename);
  if (!fs.existsSync(filePath)) throw new AppError(404, 'FILE_NOT_FOUND', 'CV file not found on server');

  return { filePath, originalName: user.cvOriginalName!, mimeType: user.cvMimetype! };
}

export async function getProfileCvPath(userId: string) {
  const { filePath, originalName } = await getOwnCvFile(userId);
  return { filePath, originalName };
}

export async function getProfileCvPreviewPath(userId: string) {
  const { filePath, mimeType } = await getOwnCvFile(userId);
  return { filePath, mimeType };
}
