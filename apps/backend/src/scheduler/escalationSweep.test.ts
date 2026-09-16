import { describe, it, expect, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { applications, notifications } from '../db/schema';
import { runEscalationSweep } from './escalationSweep';
import * as email from '../services/email';
import { daysAgo, makeScenario, makeMessage } from '../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: both escalation clocks are wall-clock driven — Day 1, Day 2 and
 *    Day 5 from CV sent (Clock A), Day 2 and Day 5 from download (Clock B).
 *    Nobody waits five days, so a browser can never exercise them. Before this
 *    file they had zero coverage of any kind.
 *  - COST OF FAILURE: the escalation ladder IS the product promise. DirectRef
 *    sells "you will hear back". A silently broken clock means seekers are
 *    ghosted by the platform that exists to stop them being ghosted, and
 *    nothing surfaces it.
 *  - METHOD: the sweeps compare Date.now() against DB columns, so an aged row
 *    is indistinguishable from one that really has been sitting. No fake
 *    timers, no clock injection, no production code that knows it is in a test.
 */

const reload = (id: string) =>
  db.select().from(applications).where(eq(applications.id, id)).limit(1).then((r) => r[0]);

const notificationsFor = (userId: string) =>
  db.select().from(notifications).where(eq(notifications.userId, userId));

describe('Clock A — from CV sent, while awaiting a decision', () => {
  it('Day 1: nudges the referrer and stamps reminderSentAt', async () => {
    const { application, referrer, seeker } = await makeScenario({ createdAt: daysAgo(1.5) });

    await runEscalationSweep();

    expect((await reload(application.id)).reminderSentAt).not.toBeNull();
    expect(email.sendReminderEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(email.sendReminderEmail).mock.calls[0][0]).toBe(referrer.email);

    const notes = await notificationsFor(referrer.id);
    expect(notes.map((n) => n.type)).toContain('cv_reminder');

    // The seeker is deliberately NOT told at Day 1 — they learn when it resolves.
    expect(await notificationsFor(seeker.id)).toHaveLength(0);
  });

  it('leaves an application younger than a day completely alone', async () => {
    const { application, referrer } = await makeScenario({ createdAt: daysAgo(0.5) });

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.reminderSentAt).toBeNull();
    expect(after.escalatedAt).toBeNull();
    expect(after.status).toBe('submitted');
    expect(email.sendReminderEmail).not.toHaveBeenCalled();
    expect(await notificationsFor(referrer.id)).toHaveLength(0);
  });

  it('Day 2: sends the stronger reminder and stamps escalatedAt', async () => {
    const { application, referrer } = await makeScenario({ createdAt: daysAgo(2.5) });

    await runEscalationSweep();

    expect((await reload(application.id)).escalatedAt).not.toBeNull();
    expect(email.sendSecondReminderEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(email.sendSecondReminderEmail).mock.calls[0][0]).toBe(referrer.email);
  });

  it('a 3-day-old application skips Day 1 rather than getting both nudges at once', async () => {
    // The scenario after downtime, or for rows that predate the feature: it is
    // past both lines. The Day 1 query is window-bounded (gt createdAt,
    // escalateCutoff) precisely so this gets the *current* step, not a backlog
    // of every step it ever missed.
    const { application } = await makeScenario({ createdAt: daysAgo(3) });

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.escalatedAt).not.toBeNull();
    expect(after.reminderSentAt).toBeNull();
    expect(email.sendSecondReminderEmail).toHaveBeenCalledOnce();
    expect(email.sendReminderEmail).not.toHaveBeenCalled();
  });

  it('Day 5: auto-closes, tells both sides, and marks the application expired', async () => {
    const { application, referrer, seeker } = await makeScenario({ createdAt: daysAgo(6) });

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.status).toBe('expired');
    expect(after.autoCancelledAt).not.toBeNull();

    expect(email.sendExpiredEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(email.sendExpiredEmail).mock.calls[0][0]).toBe(seeker.email);

    expect((await notificationsFor(seeker.id)).map((n) => n.type)).toContain('cv_expired');
    expect((await notificationsFor(referrer.id)).map((n) => n.type)).toContain('cv_expired');
  });

  it('an expired application never also receives a "please respond" in the same tick', async () => {
    // runEscalationSweep runs cancellations BEFORE reminders so the status has
    // already left PENDING_STATUSES by the time the reminder queries run.
    // Getting chased and closed in one tick would be an obvious nonsense to a
    // referrer, and the ordering is the only thing preventing it.
    const { application } = await makeScenario({ createdAt: daysAgo(6) });

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.status).toBe('expired');
    expect(after.reminderSentAt).toBeNull();
    expect(after.escalatedAt).toBeNull();
    expect(email.sendReminderEmail).not.toHaveBeenCalled();
    expect(email.sendSecondReminderEmail).not.toHaveBeenCalled();
  });

  it('an active conversation pauses auto-cancel — a talking pair is never cut off', async () => {
    const { application, seeker } = await makeScenario({ createdAt: daysAgo(6) });
    await makeMessage(application.id, seeker.id);

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.status).toBe('submitted');
    expect(after.autoCancelledAt).toBeNull();
    expect(email.sendExpiredEmail).not.toHaveBeenCalled();
  });

  it('only the SEEKER messaging pauses it — a referrer reply does not', async () => {
    // seekerHasMessaged filters on senderId = seekerId. A referrer who says
    // "looking at it" and then goes quiet is exactly who the clock exists for.
    const { application, referrer } = await makeScenario({ createdAt: daysAgo(6) });
    await makeMessage(application.id, referrer.id);

    await runEscalationSweep();

    expect((await reload(application.id)).status).toBe('expired');
  });

  it('is idempotent — running the sweep repeatedly never double-sends', async () => {
    // The real scheduler ticks every 15 minutes, so most rows are seen by many
    // sweeps between steps. Each step is guarded by its own *_At column.
    const { application } = await makeScenario({ createdAt: daysAgo(1.5) });

    await runEscalationSweep();
    await runEscalationSweep();
    await runEscalationSweep();

    expect(email.sendReminderEmail).toHaveBeenCalledOnce();
    expect((await reload(application.id)).reminderSentAt).not.toBeNull();
  });

  it('chases a viewed application too — opening a CV is not responding to it', async () => {
    const { application } = await makeScenario({ status: 'viewed', createdAt: daysAgo(1.5) });

    await runEscalationSweep();

    expect((await reload(application.id)).reminderSentAt).not.toBeNull();
  });

  it('never touches an application the referrer already decided on', async () => {
    const { application } = await makeScenario({ status: 'rejected', createdAt: daysAgo(30) });

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.status).toBe('rejected');
    expect(after.reminderSentAt).toBeNull();
    expect(after.autoCancelledAt).toBeNull();
  });
});

describe('Clock B — from download, awaiting confirmation of internal submission', () => {
  it('Day 2: asks the referrer whether they submitted it internally', async () => {
    const { application, referrer } = await makeScenario({
      status: 'forwarded',
      createdAt: daysAgo(10),
      forwardedAt: daysAgo(3),
    });

    await runEscalationSweep();

    expect((await reload(application.id)).submitReminderSentAt).not.toBeNull();
    expect(email.sendSubmitReminderEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(email.sendSubmitReminderEmail).mock.calls[0][0]).toBe(referrer.email);
  });

  it('measures from the download, not from when the CV was sent', async () => {
    // An application sent 20 days ago but downloaded an hour ago is at the
    // START of Clock B. Reading the wrong column would auto-close it instantly.
    const { application } = await makeScenario({
      status: 'forwarded',
      createdAt: daysAgo(20),
      forwardedAt: daysAgo(0.04),
    });

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.status).toBe('forwarded');
    expect(after.submitReminderSentAt).toBeNull();
    expect(after.autoCancelledAt).toBeNull();
  });

  it('Day 5: auto-closes when the referrer never confirms', async () => {
    const { application, seeker } = await makeScenario({
      status: 'forwarded',
      createdAt: daysAgo(12),
      forwardedAt: daysAgo(6),
    });

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.status).toBe('expired');
    expect(after.autoCancelledAt).not.toBeNull();
    expect(vi.mocked(email.sendExpiredEmail).mock.calls[0][0]).toBe(seeker.email);
  });

  it('an active conversation pauses Clock B too', async () => {
    const { application, seeker } = await makeScenario({
      status: 'forwarded',
      createdAt: daysAgo(12),
      forwardedAt: daysAgo(6),
    });
    await makeMessage(application.id, seeker.id);

    await runEscalationSweep();

    expect((await reload(application.id)).status).toBe('forwarded');
  });

  it('stops entirely once the referrer confirms internal submission', async () => {
    const { application } = await makeScenario({
      status: 'internally_submitted',
      createdAt: daysAgo(12),
      forwardedAt: daysAgo(9),
    });

    await runEscalationSweep();

    const after = await reload(application.id);
    expect(after.status).toBe('internally_submitted');
    expect(after.autoCancelledAt).toBeNull();
    expect(after.submitReminderSentAt).toBeNull();
  });

  it('the day-3 follow-up is gone — one reminder per download, not two', async () => {
    // Removed 2026-09-13. The email function still exists in email.ts but is
    // dead code; if a call site ever comes back, this fails.
    const { application } = await makeScenario({
      status: 'forwarded',
      createdAt: daysAgo(12),
      forwardedAt: daysAgo(4),
    });

    await runEscalationSweep();
    await runEscalationSweep();

    expect(email.sendSubmitFollowupEmail).not.toHaveBeenCalled();
    expect((await reload(application.id)).submitFollowupSentAt).toBeNull();
    expect(email.sendSubmitReminderEmail).toHaveBeenCalledOnce();
  });
});
