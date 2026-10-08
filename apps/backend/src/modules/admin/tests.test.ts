import { describe, it, expect } from 'vitest';
import { db } from '../../config/db';
import { testRuns } from '../../db/schema';
import { useServer, as } from '../../test/http';
import { daysAgo, makeUser } from '../../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: test results lived only in GitHub Actions logs. CI now posts a
 *    summary per suite run, and /admin/tests shows them.
 *  - COST OF FAILURE: anyone able to write fake results (or a dashboard that
 *    shows green while the suite is red); a re-sent report double-counting a
 *    run; the "what keeps failing" list blaming the wrong test.
 *  - SUCCESS: only the CI token can write, a retried report replaces itself,
 *    and the admin view shows the latest state per workflow plus the
 *    most-failing tests.
 */

const { base } = useServer();
const TOKEN = 'test_only_report_token';

const report = (body: Record<string, unknown>, token: string | null = TOKEN) =>
  fetch(`${base()}/api/test-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

const run = (o: Record<string, unknown> = {}) => ({
  suite: 'e2e', workflow: 'Nightly regression', trigger: 'schedule', branch: 'main',
  commitSha: 'e87fad19358578c3bd1b75ea41fe37162e175a89', runId: '1001', runAttempt: 1,
  runUrl: 'https://github.com/directref/DirectRef/actions/runs/1001',
  total: 69, passed: 67, failed: 1, flaky: 1, skipped: 0, durationMs: 180_000,
  failures: [
    { title: 'apply sends a CV', file: 'apply.spec.ts', kind: 'failed' },
    { title: 'inbox shows new CVs', file: 'referrer-inbox.spec.ts', kind: 'flaky' },
  ],
  ...o,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dashboard = async (query = '?days=7'): Promise<any> => {
  const admin = await makeUser({ email: 'shaiatar@gmail.com', emailVerified: true });
  return ((await (await as(base, admin.id).get(`/api/admin/tests${query}`)).json()) as { data: unknown }).data;
};

describe('POST /api/test-runs — CI uploads a suite result', () => {
  it('refuses without the CI token, or with the wrong one', async () => {
    expect((await report(run(), null)).status).toBe(401);
    expect((await report(run(), 'nope')).status).toBe(401);
    expect(await db.select().from(testRuns)).toHaveLength(0);
  });

  it('stores the counts and the names of what failed or flaked', async () => {
    expect((await report(run())).status).toBe(201);
    const [row] = await db.select().from(testRuns);
    expect(row).toMatchObject({ suite: 'e2e', workflow: 'Nightly regression', total: 69, passed: 67, failed: 1, flaky: 1 });
    expect(row.failures).toHaveLength(2);
  });

  it('a re-sent report for the same run replaces itself; a re-run attempt is a new row', async () => {
    await report(run());
    await report(run({ passed: 68, failed: 0, failures: [] }));
    expect(await db.select().from(testRuns)).toHaveLength(1);
    expect((await db.select().from(testRuns))[0]).toMatchObject({ passed: 68, failed: 0 });

    await report(run({ runAttempt: 2 }));
    expect(await db.select().from(testRuns)).toHaveLength(2);
  });

  it('rejects malformed input', async () => {
    expect((await report(run({ suite: 'unit' }))).status).toBe(422);
    expect((await report(run({ runId: 'abc' }))).status).toBe(422);
    expect((await report(run({ failed: -1 }))).status).toBe(422);
    expect((await report(run({ failures: [{ title: 'x', kind: 'broken' }] }))).status).toBe(422);
  });
});

describe('GET /api/admin/tests', () => {
  it('is admins only', async () => {
    expect((await as(base, null).get('/api/admin/tests')).status).toBe(401);
    const stranger = await makeUser({ email: 'someone@example.com', emailVerified: true });
    expect((await as(base, stranger.id).get('/api/admin/tests')).status).toBe(403);
  });

  it('shows the latest run of each workflow and suite, the runs in range, and what fails most', async () => {
    await db.insert(testRuns).values([
      { ...run({ runId: '1', createdAt: daysAgo(2) }), failures: [{ title: 'apply sends a CV', file: 'apply.spec.ts', kind: 'failed' }] },
      { ...run({ runId: '2', failed: 0, passed: 69, flaky: 0 }), failures: [] }, // latest nightly e2e: green
      { ...run({ runId: '3', workflow: 'Push gate', suite: 'backend', total: 372, passed: 371, failed: 1 }),
        failures: [{ title: 'apply sends a CV', file: 'apply.spec.ts', kind: 'failed' }] },
      { ...run({ runId: '4', createdAt: daysAgo(40) }) }, // outside the range
    ] as (typeof testRuns.$inferInsert)[]);

    const data = await dashboard();

    const nightly = data.latest.find((r: { workflow: string; suite: string }) => r.workflow === 'Nightly regression' && r.suite === 'e2e');
    expect(nightly).toMatchObject({ passed: 69, failed: 0 });
    expect(data.latest).toHaveLength(2);

    expect(data.runs).toHaveLength(3);
    expect(data.daily).toHaveLength(7);
    expect(data.daily.at(-1)).toMatchObject({ runs: 2, failedRuns: 1, testsFailed: 1 });

    expect(data.topFailures[0]).toMatchObject({ title: 'apply sends a CV', failed: 2, flaky: 0 });
  });
});
