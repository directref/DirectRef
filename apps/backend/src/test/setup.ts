import { beforeEach, afterAll, vi } from 'vitest';
// Static import is safe here: vitest hoists the vi.mock call below above every
// import in this file, so the module graph is already stubbed when this binds.
import { queryClient } from '../config/db';

/** Outbound email is the one thing that must never be real in a test.
 *
 *  Mocked at the module boundary rather than at the Resend client, so tests can
 *  assert *which* mail a sweep decided to send and to whom — "the referrer got
 *  the Day 1 reminder" is a real behavioural assertion, not an implementation
 *  detail. Every export is stubbed, including the ones no test touches: an
 *  unmocked one would reach for Resend with an empty API key and fail inside a
 *  `.catch()` that swallows it, turning a broken test into a silently passing
 *  one. */
vi.mock('../services/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendWorkEmailVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCVNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendCVViewedEmail: vi.fn().mockResolvedValue(undefined),
  sendCVForwardedEmail: vi.fn().mockResolvedValue(undefined),
  sendReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendSecondReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendExpiredEmail: vi.fn().mockResolvedValue(undefined),
  sendReferrerExpiredEmail: vi.fn().mockResolvedValue(undefined),
  sendCVDownloadedEmail: vi.fn().mockResolvedValue(undefined),
  sendSubmitReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendSubmitFollowupEmail: vi.fn().mockResolvedValue(undefined),
  sendInternallySubmittedEmail: vi.fn().mockResolvedValue(undefined),
  sendNewMessageEmail: vi.fn().mockResolvedValue(undefined),
  sendJobDeletionWarningEmail: vi.fn().mockResolvedValue(undefined),
}));

/** Wipe every table between tests.
 *
 *  Truncation rather than a transaction-per-test: the sweeps open their own
 *  connections from the pool, so a transaction held on one connection would be
 *  invisible to them. CASCADE handles the FK graph, RESTART IDENTITY keeps
 *  sequences from drifting across a run. */
beforeEach(async () => {
  await queryClient.unsafe(`
    SET client_min_messages = warning;
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
  vi.clearAllMocks();
});

afterAll(async () => {
  await queryClient.end();
});
