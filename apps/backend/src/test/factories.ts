import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../config/db';
import { users, jobs, applications, applicationMessages } from '../db/schema';
import { env } from '../config/env';

/** Time travel, the only kind these sweeps need.
 *
 *  Every clock in this codebase compares `Date.now()` against a column, so a
 *  row written with a backdated timestamp is indistinguishable from one that
 *  has genuinely been sitting there. No fake timers, no clock injection, no
 *  production code aware it is under test. */
export const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
export const hoursAgo = (n: number): Date => new Date(Date.now() - n * 60 * 60 * 1000);

let seq = 0;
const uniqueEmail = (prefix: string) => `${prefix}-${++seq}-${randomUUID().slice(0, 8)}@example.test`;

export async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [row] = await db
    .insert(users)
    .values({
      email: uniqueEmail('user'),
      fullName: 'Test Person',
      isSeeker: true,
      isReferrer: false,
      ...overrides,
    })
    .returning();
  return row;
}

export const makeSeeker = (o: Partial<typeof users.$inferInsert> = {}) =>
  makeUser({ email: uniqueEmail('seeker'), fullName: 'Sam Seeker', isSeeker: true, ...o });

export const makeReferrer = (o: Partial<typeof users.$inferInsert> = {}) =>
  makeUser({
    email: uniqueEmail('referrer'),
    fullName: 'Rae Referrer',
    isReferrer: true,
    workEmail: 'rae@acme.test',
    workEmailVerified: true,
    ...o,
  });

export async function makeJob(referrerId: string, overrides: Partial<typeof jobs.$inferInsert> = {}) {
  const [row] = await db
    .insert(jobs)
    .values({
      referrerId,
      sourceUrl: 'https://acme.test/careers/senior-engineer',
      title: 'Senior Engineer',
      companyName: 'Acme',
      ...overrides,
    })
    .returning();
  return row;
}

/** An application, optionally aged.
 *
 *  `createdAt` drives Clock A, `forwardedAt` drives Clock B, and `updatedAt`
 *  drives retention — so all three are settable. `updatedAt` defaults to
 *  whatever `createdAt` is rather than to now(), because an application that
 *  was created six days ago and never touched since should look that way; a
 *  row aged on one column but fresh on another is a state the app can't
 *  actually produce, and testing against it would prove nothing. */
export async function makeApplication(opts: {
  jobId: string;
  seekerId: string;
  referrerId: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  forwardedAt?: Date | null;
  withCvFile?: boolean;
  overrides?: Partial<typeof applications.$inferInsert>;
}) {
  const createdAt = opts.createdAt ?? new Date();
  const cvFilename = `${randomUUID()}.pdf`;

  if (opts.withCvFile) await writeCvFile(cvFilename);

  const [row] = await db
    .insert(applications)
    .values({
      jobId: opts.jobId,
      seekerId: opts.seekerId,
      referrerId: opts.referrerId,
      cvFilename,
      cvOriginalName: 'cv.pdf',
      cvMimetype: 'application/pdf',
      cvSizeBytes: 1024,
      status: opts.status ?? 'submitted',
      createdAt,
      updatedAt: opts.updatedAt ?? createdAt,
      forwardedAt: opts.forwardedAt ?? null,
      ...opts.overrides,
    })
    .returning();
  return row;
}

export async function makeMessage(applicationId: string, senderId: string, createdAt = new Date()) {
  const [row] = await db
    .insert(applicationMessages)
    .values({ applicationId, senderId, content: 'Any update on this?', createdAt })
    .returning();
  return row;
}

/** A complete referrer + seeker + job + application in one call — the shape
 *  every clock test starts from. */
export async function makeScenario(opts: {
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
  forwardedAt?: Date | null;
  withCvFile?: boolean;
  overrides?: Partial<typeof applications.$inferInsert>;
} = {}) {
  const referrer = await makeReferrer();
  const seeker = await makeSeeker();
  const job = await makeJob(referrer.id);
  const application = await makeApplication({
    jobId: job.id,
    seekerId: seeker.id,
    referrerId: referrer.id,
    ...opts,
  });
  return { referrer, seeker, job, application };
}

// ── C.V. files on disk ────────────────────────────────────────────────────────

export const cvPath = (filename: string) => path.resolve(env.UPLOADS_DIR, 'cvs', filename);

export async function writeCvFile(filename: string): Promise<string> {
  const p = cvPath(filename);
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  await fs.promises.writeFile(p, '%PDF-1.4 test cv');
  return p;
}

export const cvFileExists = (filename: string): boolean => fs.existsSync(cvPath(filename));
