/** Single source of truth for the referral response-time escalation ladders.
 *  Change the day counts here — everything that reads them (the sweep, and
 *  any future copy) follows automatically. */

// Clock A — from CV sent, while status is submitted/viewed.
export const ESCALATION_DAYS = {
  REMINDER: 1,    // referrer gets a nudge
  ESCALATE: 2,    // referrer gets a stronger reminder with a deadline
  AUTO_CANCEL: 5, // application auto-closes
} as const;

// Clock B — from download (forwardedAt), while status is forwarded and the
// referrer hasn't confirmed internal submission yet. Day 2 reminder, Day 5
// auto-cancel. There was a Day 3 "final reminder" too; its email was already
// paused and its in-app notification was removed on 2026-09-13, so the whole
// step went — one reminder after download is enough. The
// applications.submit_followup_sent_at column is now unused and can be dropped
// with the next migration.
export const SUBMIT_ESCALATION_DAYS = {
  REMINDER: 2,    // referrer asked whether they submitted it internally
  AUTO_CANCEL: 5, // application auto-closes
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const ESCALATION_MS = {
  REMINDER: ESCALATION_DAYS.REMINDER * MS_PER_DAY,
  ESCALATE: ESCALATION_DAYS.ESCALATE * MS_PER_DAY,
  AUTO_CANCEL: ESCALATION_DAYS.AUTO_CANCEL * MS_PER_DAY,
} as const;

export const SUBMIT_ESCALATION_MS = {
  REMINDER: SUBMIT_ESCALATION_DAYS.REMINDER * MS_PER_DAY,
  AUTO_CANCEL: SUBMIT_ESCALATION_DAYS.AUTO_CANCEL * MS_PER_DAY,
} as const;

// From a job posting going inactive (jobs.deactivatedAt) — the referrer gets
// a warning email, then the posting and everything attached to it (its
// applications, messages, and CVs on disk) is permanently deleted.
export const JOB_CLEANUP_DAYS = {
  DELETION_WARNING: 27, // 3 days before deletion
  DELETE: 30,
} as const;

/** Retention — how long a CLOSED application (and its C.V. copy, cover note
 *  and message thread) is kept after its last activity.
 *
 *  The rule, decided 2026-09-11 (PRD v16): nothing active is ever deleted. An
 *  application in a live status (submitted / viewed / forwarded) is never
 *  erased, however long it sits. Once it closes — rejected, expired,
 *  internally_submitted or withdrawn — it is erased after 30 consecutive days
 *  with no activity, where "activity" means the application row changed or a
 *  message was sent on it. */
export const APPLICATION_RETENTION_DAYS = {
  ERASE: 30,
} as const;

export const APPLICATION_RETENTION_MS = {
  ERASE: APPLICATION_RETENTION_DAYS.ERASE * MS_PER_DAY,
} as const;

export const JOB_CLEANUP_MS = {
  DELETION_WARNING: JOB_CLEANUP_DAYS.DELETION_WARNING * MS_PER_DAY,
  DELETE: JOB_CLEANUP_DAYS.DELETE * MS_PER_DAY,
} as const;
