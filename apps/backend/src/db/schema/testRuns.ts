import { pgTable, uuid, varchar, integer, jsonb, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * WHY THIS TABLE: test results only lived inside GitHub Actions logs, so
 * "how many E2E tests ran last night and how many failed" meant opening a
 * workflow run. CI now posts a summary of every suite run here
 * (scripts/report-test-results.mjs) and the Tests dashboard reads it.
 *
 * DESIGN DECISIONS:
 *  - One row per (GitHub run, attempt, suite): a re-run of a workflow is a new
 *    attempt and gets its own row; a retried POST of the same attempt
 *    overwrites instead of duplicating.
 *  - `failures` holds only the names of failed / flaky tests (capped), not
 *    logs or traces — those stay in the GitHub run, linked by run_url.
 */
export const TEST_SUITES = ['backend', 'e2e'] as const;
export type TestSuite = (typeof TEST_SUITES)[number];

export type TestFailure = { title: string; file?: string; kind: 'failed' | 'flaky' };

export const testRuns = pgTable(
  'test_runs',
  {
    id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    suite:       varchar('suite', { length: 16 }).notNull().$type<TestSuite>(),
    workflow:    varchar('workflow', { length: 64 }).notNull(),  // "Push gate", "Nightly regression", ...
    trigger:     varchar('trigger', { length: 32 }),             // push | pull_request | schedule | workflow_dispatch
    scope:       varchar('scope', { length: 256 }),              // Playwright tag filter, or null for everything
    branch:      varchar('branch', { length: 256 }),
    commitSha:   varchar('commit_sha', { length: 40 }),
    runId:       varchar('run_id', { length: 32 }).notNull(),
    runAttempt:  integer('run_attempt').notNull().default(1),
    runUrl:      varchar('run_url', { length: 512 }),
    total:       integer('total').notNull(),
    passed:      integer('passed').notNull(),
    failed:      integer('failed').notNull(),
    flaky:       integer('flaky').notNull().default(0),
    skipped:     integer('skipped').notNull().default(0),
    durationMs:  integer('duration_ms'),
    failures:    jsonb('failures').$type<TestFailure[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('test_runs_run_suite_idx').on(t.runId, t.runAttempt, t.suite),
    index('test_runs_created_idx').on(t.createdAt),
    check('test_runs_suite_check', sql`${t.suite} IN ('backend', 'e2e')`),
  ],
);
