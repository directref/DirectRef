import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users, jobs, applications, applicationMessages, notifications } from '../../db/schema';
import { deleteAccount } from './users.service';
import {
  makeSeeker, makeReferrer, makeJob, makeApplication, makeMessage,
  writeCvFile, cvFileExists,
} from '../../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: "delete my account" is the loudest promise the Privacy Policy
 *    makes, and the one most likely to be quietly half-kept. Before the
 *    2026-09-11 rewrite it was a one-line db.delete(users) that cascaded over
 *    other people's live applications and left EVERY C.V. file orphaned on
 *    disk — the rows vanished, the documents did not.
 *  - COST OF FAILURE: in one direction, C.V.s of people who asked to be
 *    forgotten sitting on a server indefinitely. In the other, a seeker's
 *    application disappearing with no explanation because someone else left.
 *  - SUCCESS: the account and everything it put on disk is gone, and every
 *    seeker whose application went with it was told first.
 */

describe('deleting a referrer', () => {
  it('removes the account, its postings, and the applications on them', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    const application = await makeApplication({
      jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, withCvFile: true,
    });

    await deleteAccount(referrer.id);

    expect(await db.select().from(users).where(eq(users.id, referrer.id))).toHaveLength(0);
    expect(await db.select().from(jobs).where(eq(jobs.id, job.id))).toHaveLength(0);
    expect(await db.select().from(applications).where(eq(applications.id, application.id))).toHaveLength(0);

    // The seeker is a different person and must survive entirely.
    expect(await db.select().from(users).where(eq(users.id, seeker.id))).toHaveLength(1);
  });

  it('tells each affected seeker BEFORE their application disappears', async () => {
    // Deleted silently, a seeker just finds their application gone and
    // assumes the product lost it.
    const referrer = await makeReferrer();
    const seekerA = await makeSeeker();
    const seekerB = await makeSeeker();
    const job = await makeJob(referrer.id);
    await makeApplication({ jobId: job.id, seekerId: seekerA.id, referrerId: referrer.id, withCvFile: true });
    const job2 = await makeJob(referrer.id);
    await makeApplication({ jobId: job2.id, seekerId: seekerB.id, referrerId: referrer.id, withCvFile: true });

    await deleteAccount(referrer.id);

    for (const s of [seekerA, seekerB]) {
      const notes = await db.select().from(notifications).where(eq(notifications.userId, s.id));
      expect(notes.map((n) => n.type), `seeker ${s.id} was not told`).toContain('referrer_left');
    }
  });

  it('unlinks every C.V. file the account touched', async () => {
    // The specific bug the rewrite fixed: rows went, files stayed.
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    const app = await makeApplication({
      jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, withCvFile: true,
    });
    expect(cvFileExists(app.cvFilename)).toBe(true);

    await deleteAccount(referrer.id);

    expect(cvFileExists(app.cvFilename), 'C.V. file survived the deletion').toBe(false);
  });

  it('takes the message threads with it', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    const app = await makeApplication({
      jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, withCvFile: true,
    });
    await makeMessage(app.id, seeker.id);
    await makeMessage(app.id, referrer.id);

    await deleteAccount(referrer.id);

    const left = await db.select().from(applicationMessages).where(eq(applicationMessages.applicationId, app.id));
    expect(left).toHaveLength(0);
  });
});

describe('deleting a seeker', () => {
  it('removes their applications and C.V. copies but leaves the posting standing', async () => {
    // A seeker leaving must not destroy the referrer's job listing — it is
    // not theirs, and other people may have applied to it.
    const referrer = await makeReferrer();
    const leaving = await makeSeeker();
    const staying = await makeSeeker();
    const job = await makeJob(referrer.id);

    const leavingApp = await makeApplication({
      jobId: job.id, seekerId: leaving.id, referrerId: referrer.id, withCvFile: true,
    });
    const stayingApp = await makeApplication({
      jobId: job.id, seekerId: staying.id, referrerId: referrer.id, withCvFile: true,
    });

    await deleteAccount(leaving.id);

    expect(await db.select().from(applications).where(eq(applications.id, leavingApp.id))).toHaveLength(0);
    expect(cvFileExists(leavingApp.cvFilename)).toBe(false);

    expect(await db.select().from(jobs).where(eq(jobs.id, job.id))).toHaveLength(1);
    expect(await db.select().from(applications).where(eq(applications.id, stayingApp.id))).toHaveLength(1);
    expect(cvFileExists(stayingApp.cvFilename), "another seeker's C.V. was deleted").toBe(true);
    expect(await db.select().from(users).where(eq(users.id, referrer.id))).toHaveLength(1);
  });

  it('removes the profile C.V. too, not just application copies', async () => {
    // users.cvFilename is the C.V. of record, a separate file from any
    // application's copy. Missing it leaves the most personal document behind.
    const seeker = await makeSeeker();
    const profileCv = 'profile-cv-under-test.pdf';
    await writeCvFile(profileCv);
    await db.update(users).set({ cvFilename: profileCv, cvOriginalName: 'cv.pdf' }).where(eq(users.id, seeker.id));

    await deleteAccount(seeker.id);

    expect(cvFileExists(profileCv), 'profile C.V. survived the deletion').toBe(false);
  });
});

describe('deleting an account — edge cases', () => {
  it('works for an account with nothing attached', async () => {
    const lonely = await makeSeeker();
    await deleteAccount(lonely.id);
    expect(await db.select().from(users).where(eq(users.id, lonely.id))).toHaveLength(0);
  });

  it('completes even when a C.V. file is already gone', async () => {
    // Withdrawing deletes the file and keeps the row, so ENOENT is a normal
    // state here. If it threw, the account would be left half-deleted.
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    await makeApplication({
      jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, withCvFile: false,
    });

    await expect(deleteAccount(referrer.id)).resolves.toBeUndefined();
    expect(await db.select().from(users).where(eq(users.id, referrer.id))).toHaveLength(0);
  });

  it('rejects an account that does not exist', async () => {
    await expect(deleteAccount('00000000-0000-0000-0000-000000000000'))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
