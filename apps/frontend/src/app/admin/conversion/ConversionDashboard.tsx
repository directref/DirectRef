'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants';
import { Tile, Table } from '../ui';
import { MiniBars } from './MiniBars';
import type { ConversionDashboardData, DailyMetric } from './types';

const RANGES = [7, 30, 90] as const;
const REFRESH_MS = 60_000;

const MARKETING = 'var(--color-blue)';
const PRODUCT = 'var(--color-amber)';

const CHARTS: { key: DailyMetric; title: string; color: string }[] = [
  { key: 'pageViews', title: 'Page views', color: MARKETING },
  { key: 'ctaClicks', title: 'CTA clicks', color: MARKETING },
  { key: 'waitlistSignups', title: 'Waitlist signups', color: MARKETING },
  { key: 'accountSignups', title: 'Accounts created', color: PRODUCT },
  { key: 'jobsPosted', title: 'Job descriptions posted', color: PRODUCT },
  { key: 'cvsSent', title: 'CVs sent', color: PRODUCT },
];

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

/** Is the marketing site turning visits into signups, and is the product
 *  turning signups into job posts and CVs? Test accounts are excluded
 *  server-side. Refreshes every minute while open. */
export function ConversionDashboard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  const { data, error, isLoading, mutate } = useSWR<ConversionDashboardData, ApiError>(
    `/api/admin/conversion?days=${days}&tz=${encodeURIComponent(tz)}`,
    async (path: string) => (await api.get<{ data: ConversionDashboardData }>(path)).data,
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
          <Link href={`${ROUTES.login}?next=/admin/conversion`} className="text-sm font-semibold underline">Log in</Link>
        )}
      </div>
    );
  }

  const t = data?.totals;
  const f = data?.cvFunnel;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Conversion</h1>
          <p className="text-xs text-text-muted">Last {days} days · days in {tz} · test accounts excluded · refreshes every minute</p>
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

      {data && t && f && (
        <>
          <section>
            <h2 className="mb-2 text-sm font-bold">Marketing site</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label="Page views" value={t.pageViews} hint="marketing pages" />
              <Tile label="CTA clicks" value={t.ctaClicks} hint={`${pct(t.ctaClicks, t.pageViews)} of page views`} />
              <Tile label="Waitlist signups" value={t.waitlistSignups} hint={`${pct(t.waitlistSignups, t.ctaClicks)} of CTA clicks`} strong />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold">Product</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label="Accounts created" value={t.accountSignups} hint={`${data.allTime.accounts.toLocaleString()} all time`} />
              <Tile label="Job descriptions posted" value={t.jobsPosted} hint={`${data.allTime.jobs.toLocaleString()} all time · ${data.allTime.activeJobs.toLocaleString()} active`} strong />
              <Tile label="CVs sent" value={t.cvsSent} hint={`${data.allTime.cvs.toLocaleString()} all time`} strong />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold">Per day</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CHARTS.map((c) => (
                <MiniBars
                  key={c.key}
                  title={c.title}
                  total={t[c.key]}
                  color={c.color}
                  points={data.daily.map((d) => ({ date: d.date, value: d[c.key] }))}
                />
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="min-w-0 rounded-xl border border-border bg-card p-4">
              <h2 className="mb-1 text-sm font-bold">CTA conversion</h2>
              <p className="mb-3 text-xs text-text-muted">Clicks on each waitlist button, and how many became a signup</p>
              <Table
                head={['CTA', 'Clicks', 'Signups', 'Conversion']}
                rows={data.ctas.map((c) => [c.cta, c.clicks, c.signups, pct(c.signups, c.clicks)])}
              />
            </section>

            <section className="min-w-0 rounded-xl border border-border bg-card p-4">
              <h2 className="mb-1 text-sm font-bold">What happened to the CVs</h2>
              <p className="mb-3 text-xs text-text-muted">CVs sent in the last {days} days, by how far they got</p>
              <Funnel
                steps={[
                  { label: 'Sent', value: f.sent },
                  { label: 'Opened by the referrer', value: f.opened },
                  { label: 'Downloaded', value: f.downloaded },
                  { label: 'Submitted internally', value: f.submittedInternally },
                ]}
              />
              <p className="mt-3 text-xs text-text-muted">
                Still awaiting a decision: {f.awaiting} · Not a fit: {f.notAFit} · Expired: {f.expired} · Withdrawn: {f.withdrawn}
              </p>
            </section>
          </div>

          <p className="text-xs text-text-muted">
            Page views and CTA clicks are anonymous counts and started being recorded when this dashboard shipped; earlier days show none.
          </p>
        </>
      )}
    </div>
  );
}

/** Horizontal bars, each step as a share of the first. Text stays in ink;
 *  the bar alone carries the proportion. */
function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = steps[0]?.value ?? 0;
  return (
    <div className="space-y-2.5">
      {steps.map((s) => (
        <div key={s.label}>
          <div className="mb-1 flex justify-between gap-2 text-sm">
            <span>{s.label}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{s.value}</span>
              <span className="ml-2 text-text-muted">{pct(s.value, top)}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-input">
            <div className="h-2 rounded-full" style={{ width: top > 0 ? `${(s.value / top) * 100}%` : 0, background: PRODUCT }} />
          </div>
        </div>
      ))}
    </div>
  );
}
