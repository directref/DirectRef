'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants';
import { Tile, Table } from '../ui';
import { MiniBars } from '../MiniBars';
import type { TestRun, TestsDashboardData } from './types';

const RANGES = [7, 30, 90] as const;
const REFRESH_MS = 60_000;

const SUITE_LABEL: Record<TestRun['suite'], string> = { e2e: 'End-to-end', backend: 'Backend' };

const duration = (ms: number | null) => {
  if (ms === null) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

const ago = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Status always carries an icon and a word, never colour alone. */
function Result({ run }: { run: Pick<TestRun, 'failed' | 'flaky'> }) {
  if (run.failed > 0) {
    return <span className="inline-flex items-center gap-1 font-semibold text-crit"><XCircle className="h-4 w-4" />{run.failed} failed</span>;
  }
  if (run.flaky > 0) {
    return <span className="inline-flex items-center gap-1 font-semibold text-warn"><AlertTriangle className="h-4 w-4" />Passed, {run.flaky} flaky</span>;
  }
  return <span className="inline-flex items-center gap-1 font-semibold text-good"><CheckCircle2 className="h-4 w-4" />Passed</span>;
}

/** Every run of every suite CI reports: how many tests ran, how many failed,
 *  and what keeps failing. Refreshes every minute while open. */
export function TestsDashboard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  const { data, error, isLoading, mutate } = useSWR<TestsDashboardData, ApiError>(
    `/api/admin/tests?days=${days}&tz=${encodeURIComponent(tz)}`,
    async (path: string) => (await api.get<{ data: TestsDashboardData }>(path)).data,
    { refreshInterval: REFRESH_MS, keepPreviousData: true, shouldRetryOnError: false },
  );

  if (error?.status === 401 || error?.status === 403) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="mb-1 text-lg font-bold">{error.status === 401 ? 'Please log in' : 'Admins only'}</h1>
        <p className="mb-4 text-sm text-text-muted">
          {error.status === 401 ? 'Your session has expired.' : 'This account does not have access to the admin dashboards.'}
        </p>
        {error.status === 401 && (
          <Link href={`${ROUTES.login}?next=/admin/tests`} className="text-sm font-semibold underline">Log in</Link>
        )}
      </div>
    );
  }

  const runs = data?.runs ?? [];
  const failedRuns = runs.filter((r) => r.failed > 0).length;
  const testsRun = runs.reduce((n, r) => n + r.total, 0);
  const testsFailed = runs.reduce((n, r) => n + r.failed, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Tests</h1>
          <p className="text-xs text-text-muted">Every CI run of the backend and end-to-end suites · days in {tz} · refreshes every minute</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                aria-pressed={days === r}
                className={`rounded-md px-3 py-1 text-sm font-semibold ${days === r ? 'bg-text-primary text-white' : 'text-text-muted hover:text-text-primary'}`}
              >
                {r}d
              </button>
            ))}
          </div>
          <button onClick={() => mutate()} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold">Refresh</button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-border bg-card p-3 text-sm text-crit" role="alert">{error.message}</p>}
      {isLoading && !data && <p className="text-sm text-text-muted">Loading…</p>}

      {data && data.latest.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm">
          <h2 className="mb-1 font-bold">No test runs reported yet</h2>
          <p className="text-text-muted">
            CI posts a summary after every test run once <code>TEST_REPORT_TOKEN</code> is set to the same value in GitHub
            (repository secret) and on Railway (backend variable). The next push, PR or nightly run will then show up here.
          </p>
        </div>
      )}

      {data && data.latest.length > 0 && (
        <>
          <section>
            <h2 className="mb-2 text-sm font-bold">Right now</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.latest.map((r) => (
                <div key={`${r.workflow}-${r.suite}`} className="min-w-0 rounded-xl border border-border bg-card p-4">
                  <div className="mb-1 text-xs font-semibold tracking-wide text-text-muted uppercase">
                    {r.workflow} · {SUITE_LABEL[r.suite]}
                  </div>
                  <div className="mb-1 text-lg"><Result run={r} /></div>
                  <div className="text-sm tabular-nums">
                    {r.total} tests · {r.passed} passed · {r.failed} failed{r.flaky ? ` · ${r.flaky} flaky` : ''}{r.skipped ? ` · ${r.skipped} skipped` : ''}
                  </div>
                  <div className="mt-1 truncate text-xs text-text-muted">
                    {ago(r.createdAt)} · {duration(r.durationMs)}
                    {r.branch ? ` · ${r.branch}` : ''}
                    {r.commitSha ? ` · ${r.commitSha.slice(0, 7)}` : ''}
                    {r.runUrl && <> · <a href={r.runUrl} target="_blank" rel="noreferrer" className="underline">run</a></>}
                  </div>
                  {r.failures.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {r.failures.slice(0, 3).map((f, i) => (
                        <li key={i} className="truncate" title={f.title}>{f.kind === 'flaky' ? '⚠' : '✗'} {f.title}</li>
                      ))}
                      {r.failures.length > 3 && <li className="text-text-muted">+{r.failures.length - 3} more</li>}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Runs" value={runs.length} hint={`last ${days} days`} />
            <Tile label="Runs with failures" value={failedRuns} hint={runs.length ? `${Math.round((failedRuns / runs.length) * 100)}% of runs` : undefined} />
            <Tile label="Tests executed" value={testsRun} />
            <Tile label="Tests failed" value={testsFailed} />
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <MiniBars title="Runs per day" total={runs.length} color="var(--color-blue)" points={data.daily.map((d) => ({ date: d.date, value: d.runs }))} />
            <MiniBars title="Failed tests per day" total={testsFailed} color="var(--color-blue)" points={data.daily.map((d) => ({ date: d.date, value: d.testsFailed }))} />
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-card p-4">
            <h2 className="mb-1 text-sm font-bold">Failing most often</h2>
            <p className="mb-3 text-xs text-text-muted">Tests that failed or flaked in the last {days} days</p>
            <Table
              head={['Test', 'File', 'Failed', 'Flaky', 'Last seen']}
              rows={data.topFailures.map((f) => [
                <span key="t" className="block max-w-[28rem] truncate" title={f.title}>{f.title}</span>,
                f.file ?? '—', f.failed, f.flaky, ago(f.lastSeen),
              ])}
            />
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold">Recent runs</h2>
            <Table
              head={['When', 'Workflow', 'Suite', 'Result', 'Tests', 'Passed', 'Failed', 'Flaky', 'Time', 'Branch', '']}
              rows={runs.map((r) => [
                when(r.createdAt),
                r.workflow,
                r.scope ? `${SUITE_LABEL[r.suite]} (${r.scope})` : SUITE_LABEL[r.suite],
                <Result key="r" run={r} />,
                r.total, r.passed, r.failed, r.flaky,
                duration(r.durationMs),
                r.branch ?? '—',
                r.runUrl ? <a key="l" href={r.runUrl} target="_blank" rel="noreferrer" className="underline">View</a> : '',
              ])}
            />
          </section>
        </>
      )}
    </div>
  );
}
