/** Mirrors getTestsDashboard() in apps/backend/src/modules/admin/tests.service.ts. */
export interface TestRun {
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
  failures: { title: string; file?: string; kind: 'failed' | 'flaky' }[];
  createdAt: string;
}

export interface TestsDashboardData {
  range: { days: number; tz: string };
  latest: TestRun[];
  runs: TestRun[];
  daily: { date: string; runs: number; failedRuns: number; testsFailed: number }[];
  topFailures: { title: string; file: string | null; failed: number; flaky: number; lastSeen: string }[];
}
