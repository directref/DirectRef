import { sql } from 'drizzle-orm';
import { db } from '../../config/db';
import type { TestFailure } from '../../db/schema/testRuns';

/**
 * tests.service
 *
 * WHY THIS EXISTS: "is the suite green, how many tests ran, what keeps
 * failing" — answered from the summaries CI posts to test_runs, instead of
 * opening GitHub Actions run by run.
 *
 * CONNECTIONS:
 * - CALLED BY: admin.router (GET /api/admin/tests) → frontend /admin/tests.
 * - READS: test_runs, written by testRuns.router from
 *   scripts/report-test-results.mjs in each workflow.
 */
export type TestsOptions = { days: number; tz: string };

export type TestRunRow = {
  id: string;
  suite: 'backend' | 'e2e';
  workflow: string;
  trigger: string | null;
  scope: string | null;
  branch: string | null;
  commitSha: string | null;
  runUrl: string | null;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number | null;
  failures: TestFailure[];
  createdAt: string;
};

const COLUMNS = sql.raw(`
  id, suite, workflow, trigger, scope, branch, commit_sha AS "commitSha", run_url AS "runUrl",
  total, passed, failed, flaky, skipped, duration_ms AS "durationMs", failures, created_at AS "createdAt"
`);

export async function getTestsDashboard({ days, tz }: TestsOptions) {
  const today = sql`(now() AT TIME ZONE ${tz})::date`;
  const firstDay = sql`(${today} - ${days - 1}::int)`;
  const since = sql`(${firstDay}::timestamp AT TIME ZONE ${tz})`;

  // The most recent run of each workflow × suite: the "is it green right now" board.
  const latest = await db.execute<TestRunRow>(sql`
    SELECT DISTINCT ON (workflow, suite) ${COLUMNS}
    FROM test_runs ORDER BY workflow, suite, created_at DESC
  `);

  const runs = await db.execute<TestRunRow>(sql`
    SELECT ${COLUMNS} FROM test_runs
    WHERE created_at >= ${since} ORDER BY created_at DESC LIMIT 200
  `);

  const daily = await db.execute<{ date: string; runs: number; failedRuns: number; testsFailed: number }>(sql`
    WITH d AS (SELECT generate_series(${firstDay}, ${today}, interval '1 day')::date AS day),
    r AS (
      SELECT (created_at AT TIME ZONE ${tz})::date AS day,
             count(*) AS runs,
             count(*) FILTER (WHERE failed > 0) AS failed_runs,
             sum(failed) AS tests_failed
      FROM test_runs WHERE created_at >= ${since} GROUP BY 1
    )
    SELECT to_char(d.day, 'YYYY-MM-DD')        AS "date",
           coalesce(r.runs, 0)::int            AS "runs",
           coalesce(r.failed_runs, 0)::int     AS "failedRuns",
           coalesce(r.tests_failed, 0)::int    AS "testsFailed"
    FROM d LEFT JOIN r ON r.day = d.day ORDER BY d.day
  `);

  // Which tests fail or flake most often in the range.
  const topFailures = await db.execute<{ title: string; file: string | null; failed: number; flaky: number; lastSeen: string }>(sql`
    SELECT f->>'title'                                         AS "title",
           f->>'file'                                          AS "file",
           (count(*) FILTER (WHERE f->>'kind' = 'failed'))::int AS "failed",
           (count(*) FILTER (WHERE f->>'kind' = 'flaky'))::int  AS "flaky",
           max(t.created_at)                                   AS "lastSeen"
    FROM test_runs t, jsonb_array_elements(t.failures) f
    WHERE t.created_at >= ${since}
    GROUP BY 1, 2
    ORDER BY count(*) DESC, max(t.created_at) DESC
    LIMIT 20
  `);

  return { range: { days, tz }, latest: [...latest], runs: [...runs], daily: [...daily], topFailures: [...topFailures] };
}
