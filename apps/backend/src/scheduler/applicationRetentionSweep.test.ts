import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { applications, applicationMessages, notifications } from '../db/schema';
import { runApplicationRetentionSweep } from './applicationRetentionSweep';
import { daysAgo, makeScenario, makeMessage, cvFileExists } from '../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the retention rule has two halves that pull in opposite
 *    directions — "a closed application inactive for 30 days is erased" and
 *    "nothing active is EVER deleted". A bug in the first half keeps data the
 *    Privacy Policy promises to delete; a bug in the second half destroys a
 *    live application, its message thread and its C.V. That second failure has
 *    already happened once here: jobCleanupSweep used to cascade over
 *    in-flight applications when a referrer deactivated a posting.
 *  - COST OF FAILURE: silent, irreversible data loss for a seeker who did
 *    nothing wrong — or a public promise the product quietly breaks.
 *  - METHOD: a 30-day window is unreachable in real time, so rows are written
 *    with backdated timestamps. Nothing in production knows these tests exist.
 */

const exists = async (id: string) =>
  (await db.select({ id: applications.id }).from(applications).where(eq(applications.id, id))).length > 0;

describe('retention — erasing closed, inactive applications', () => {
  it.each(['rejected', 'expired', 'internally_submitted', 'withdrawn'])(
    'erases a %s application after 30 days of inactivity',
    async (status) => {
      const { application } = await makeScenario({
        status,
        createdAt: daysAgo(60),
        updatedAt: daysAgo(31),
        withCvFile: true,
      });

      await runApplicationRetentionSweep();

      expect(await exists(application.id)).toBe(false);
      expect(cvFileExists(application.cvFilename)).toBe(false);
    },
  );

  it('takes the message thread with it', async () => {
    const { application, seeker } = await makeScenario({
      status: 'rejected',
      createdAt: daysAgo(90),
      updatedAt: daysAgo(40),
      withCvFile: true,
    });
    await makeMessage(application.id, seeker.id, daysAgo(85));

    await runApplicationRetentionSweep();

    const left = await db
      .select()
      .from(applicationMessages)
      .where(eq(applicationMessages.applicationId, application.id));
    expect(left).toHaveLength(0);
  });

  it('tells the seeker before the record disappears', async () => {
    // In-app only, by decision — a closed application quiet for a month does
    // not warrant an email, but it must not vanish silently either.
    const { application, seeker } = await makeScenario({
      status: 'rejected',
      createdAt: daysAgo(60),
      updatedAt: daysAgo(31),
      withCvFile: true,
    });

    await runApplicationRetentionSweep();

    const notes = await db.select().from(notifications).where(eq(notifications.userId, seeker.id));
    expect(notes.map((n) => n.type)).toContain('application_erased');
    expect(await exists(application.id)).toBe(false);
  });

  it('survives a C.V. file that is already gone', async () => {
    // Withdrawing deletes the file but keeps the row, so ENOENT here is the
    // normal path, not an error. If it threw, the row would outlive its window.
    const { application } = await makeScenario({
      status: 'withdrawn',
      createdAt: daysAgo(60),
      updatedAt: daysAgo(31),
      withCvFile: false,
    });

    await runApplicationRetentionSweep();

    expect(await exists(application.id)).toBe(false);
  });
});

describe('retention — what must never be erased', () => {
  it.each(['submitted', 'viewed', 'forwarded'])(
    'never erases a LIVE %s application, however old it is',
    async (status) => {
      // The hard half of the rule. A year of silence on a live application is
      // still not permission to delete it.
      const { application } = await makeScenario({
        status,
        createdAt: daysAgo(400),
        updatedAt: daysAgo(400),
        withCvFile: true,
      });

      await runApplicationRetentionSweep();

      expect(await exists(application.id)).toBe(true);
      expect(cvFileExists(application.cvFilename)).toBe(true);
    },
  );

  it('keeps a closed application that is inactive for 29 days', async () => {
    const { application } = await makeScenario({
      status: 'rejected',
      createdAt: daysAgo(60),
      updatedAt: daysAgo(29),
      withCvFile: true,
    });

    await runApplicationRetentionSweep();

    expect(await exists(application.id)).toBe(true);
    expect(cvFileExists(application.cvFilename)).toBe(true);
  });

  it('a recent message resets the clock even when the row itself is stale', async () => {
    // "Activity" means the row changed OR a message was sent. sendMessage never
    // bumps updatedAt, so without the message check a conversation continuing
    // on a closed application would be erased mid-thread.
    const { application, seeker } = await makeScenario({
      status: 'rejected',
      createdAt: daysAgo(90),
      updatedAt: daysAgo(45),
      withCvFile: true,
    });
    await makeMessage(application.id, seeker.id, daysAgo(2));

    await runApplicationRetentionSweep();

    expect(await exists(application.id)).toBe(true);
    expect(cvFileExists(application.cvFilename)).toBe(true);
  });

  it('an OLD message does not save it', async () => {
    const { application, seeker } = await makeScenario({
      status: 'rejected',
      createdAt: daysAgo(120),
      updatedAt: daysAgo(60),
      withCvFile: true,
    });
    await makeMessage(application.id, seeker.id, daysAgo(59));

    await runApplicationRetentionSweep();

    expect(await exists(application.id)).toBe(false);
  });

  it('erases only what is due, leaving everything else untouched', async () => {
    const due = await makeScenario({
      status: 'rejected', createdAt: daysAgo(60), updatedAt: daysAgo(31), withCvFile: true,
    });
    const live = await makeScenario({
      status: 'submitted', createdAt: daysAgo(60), updatedAt: daysAgo(60), withCvFile: true,
    });
    const recent = await makeScenario({
      status: 'expired', createdAt: daysAgo(20), updatedAt: daysAgo(10), withCvFile: true,
    });

    await runApplicationRetentionSweep();

    expect(await exists(due.application.id)).toBe(false);
    expect(await exists(live.application.id)).toBe(true);
    expect(await exists(recent.application.id)).toBe(true);
    expect(cvFileExists(live.application.cvFilename)).toBe(true);
    expect(cvFileExists(recent.application.cvFilename)).toBe(true);
  });
});
