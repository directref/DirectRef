#!/usr/bin/env node
/**
 * Post one suite run's results to the Tests dashboard.
 *
 *   node scripts/report-test-results.mjs --suite e2e     --file e2e/results.json [--scope "@smoke|@api"]
 *   node scripts/report-test-results.mjs --suite backend --file apps/backend/vitest-results.json
 *
 * WHY THIS EXISTS: test counts only lived in GitHub Actions logs. Each
 * workflow now runs this after its tests (`if: always()`), and the backend
 * stores the summary in test_runs for /admin/tests.
 *
 * READS the JSON reporter output of Playwright (stats + suites tree) or Vitest
 * (numTotalTests + testResults), plus GitHub's own GITHUB_* variables for the
 * workflow, commit and run link.
 *
 * NEVER FAILS THE BUILD. Reporting is a side channel: a missing token (forks,
 * local runs), a missing results file (the job died before tests ran) or an
 * unreachable API is logged and the script exits 0, so the test step's own
 * result is the only thing that decides red or green.
 *
 * ENV: TEST_REPORT_TOKEN (GitHub secret; required to post)
 *      REPORT_COMMIT_SHA (optional; the PR head commit on pull_request runs)
 *      TEST_REPORT_URL   (default https://api.direct-ref.com)
 */
import fs from 'node:fs';
import path from 'node:path';

const say = (m) => console.log(`[report-test-results] ${m}`);
const done = (m) => { say(m); process.exit(0); };

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const suite = args.suite;
if (suite !== 'e2e' && suite !== 'backend') done(`--suite must be e2e or backend (got ${suite}); not reporting.`);

const token = process.env.TEST_REPORT_TOKEN;
if (!token) done('TEST_REPORT_TOKEN is not set (fork, local run, or secret not configured); not reporting.');

let report;
try {
  report = JSON.parse(fs.readFileSync(args.file, 'utf8'));
} catch (err) {
  done(`Could not read ${args.file} (${err.message}) — the tests probably never ran; not reporting.`);
}

const MAX_FAILURES = 100;

/** Playwright JSON reporter: stats, plus a suites → specs → tests tree. */
function fromPlaywright(r) {
  const failures = [];
  const walk = (s) => {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const kind = t.status === 'unexpected' ? 'failed' : t.status === 'flaky' ? 'flaky' : null;
        if (kind) failures.push({ title: spec.title, file: spec.file, kind });
      }
    }
    (s.suites ?? []).forEach(walk);
  };
  (r.suites ?? []).forEach(walk);
  const { expected = 0, unexpected = 0, flaky = 0, skipped = 0, duration } = r.stats ?? {};
  return {
    total: expected + unexpected + flaky + skipped,
    passed: expected,
    failed: unexpected,
    flaky,
    skipped,
    durationMs: duration === undefined ? undefined : Math.round(duration),
    failures,
  };
}

/** Vitest JSON reporter (Jest-compatible shape). A file that failed to load
 *  has no assertions but is still a failure, so it is counted as one. */
function fromVitest(r) {
  const failures = [];
  let brokenFiles = 0;
  let end = r.startTime ?? 0;
  for (const file of r.testResults ?? []) {
    end = Math.max(end, file.endTime ?? 0);
    const rel = path.relative(process.cwd(), file.name ?? '');
    const failedHere = (file.assertionResults ?? []).filter((a) => a.status === 'failed');
    for (const a of failedHere) failures.push({ title: a.fullName ?? a.title, file: rel, kind: 'failed' });
    if (file.status === 'failed' && failedHere.length === 0) {
      brokenFiles += 1;
      failures.push({ title: `${rel} failed to run`, file: rel, kind: 'failed' });
    }
  }
  const skipped = (r.numPendingTests ?? 0) + (r.numTodoTests ?? 0);
  return {
    total: (r.numTotalTests ?? 0) + brokenFiles,
    passed: r.numPassedTests ?? 0,
    failed: (r.numFailedTests ?? 0) + brokenFiles,
    flaky: 0,
    skipped,
    durationMs: r.startTime && end > r.startTime ? Math.round(end - r.startTime) : undefined,
    failures,
  };
}

const counts = suite === 'e2e' ? fromPlaywright(report) : fromVitest(report);
const e = process.env;
const server = e.GITHUB_SERVER_URL ?? 'https://github.com';
const body = {
  suite,
  workflow: (e.GITHUB_WORKFLOW ?? 'local').slice(0, 64),
  trigger: e.GITHUB_EVENT_NAME,
  scope: args.scope ? String(args.scope).slice(0, 256) : undefined,
  branch: (e.GITHUB_HEAD_REF || e.GITHUB_REF_NAME || undefined)?.slice(0, 256),
  // On a pull_request, GITHUB_SHA is GitHub's temporary merge commit; the
  // workflow passes the PR's real head commit instead.
  commitSha: e.REPORT_COMMIT_SHA || e.GITHUB_SHA,
  runId: e.GITHUB_RUN_ID ?? String(Date.now()),
  runAttempt: Number(e.GITHUB_RUN_ATTEMPT ?? 1),
  runUrl: e.GITHUB_RUN_ID && e.GITHUB_REPOSITORY ? `${server}/${e.GITHUB_REPOSITORY}/actions/runs/${e.GITHUB_RUN_ID}` : undefined,
  ...counts,
  failures: counts.failures.map((f) => ({ ...f, title: String(f.title).slice(0, 512), file: f.file?.slice(0, 256) })).slice(0, MAX_FAILURES),
};

const url = `${(e.TEST_REPORT_URL ?? 'https://api.direct-ref.com').replace(/\/$/, '')}/api/test-runs`;
try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) done(`POST ${url} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  done(`Reported ${suite}: ${body.passed} passed, ${body.failed} failed, ${body.flaky} flaky, ${body.skipped} skipped of ${body.total}.`);
} catch (err) {
  done(`Could not reach ${url} (${err.message}); not reporting.`);
}
