'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api/client';
import { ROUTES } from '@/lib/constants';
import { DailyChart, SERIES } from './DailyChart';
import type { WaitlistDashboardData } from './types';

const RANGES = [7, 30, 90] as const;
const REFRESH_MS = 60_000;

/** First launch dashboard: is anyone joining, onto which list, and through
 *  which button / campaign. Refreshes every minute while open. */
export function WaitlistDashboard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [showTable, setShowTable] = useState(false);
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);

  const { data, error, isLoading, mutate } = useSWR<WaitlistDashboardData, ApiError>(
    `/api/admin/waitlist?days=${days}&tz=${encodeURIComponent(tz)}`,
    async (path: string) => (await api.get<{ data: WaitlistDashboardData }>(path)).data,
    { refreshInterval: REFRESH_MS, keepPreviousData: true, shouldRetryOnError: false },
  );

  // Access is decided by the backend (a verified account on ADMIN_EMAILS);
  // the page only explains a refusal.
  if (error?.status === 401 || error?.status === 403) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-xl border border-border bg-card p-6 text-center">
        <h1 className="mb-1 text-lg font-bold">{error.status === 401 ? 'Please log in' : 'Admins only'}</h1>
        <p className="mb-4 text-sm text-text-muted">
          {error.status === 401
            ? 'Your session has expired.'
            : 'This account does not have access to the admin dashboards.'}
        </p>
        {error.status === 401 ? (
          <Link href={`${ROUTES.login}?next=/admin/waitlist`} className="text-sm font-semibold underline">Log in</Link>
        ) : (
          <p className="text-sm text-text-muted">Log out and sign in with an admin account.</p>
        )}
      </div>
    );
  }

  const today = data?.daily.at(-1);
  const last7 = data?.daily.slice(-7).reduce((n, d) => n + d.seekers + d.referrers, 0);
  const inRange = data?.daily.reduce((n, d) => n + d.seekers + d.referrers, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Waitlist</h1>
          <p className="text-xs text-text-muted">Days in {tz} · refreshes every minute</p>
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

      {data && (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Tile label="On the waitlist" value={data.totals.total} hint="subscribed, all time" strong />
            <Tile label="Seekers" value={data.totals.seekers} swatch={SERIES[0].color} />
            <Tile label="Referrers" value={data.totals.referrers} swatch={SERIES[1].color} />
            <Tile label="Joined today" value={(today?.seekers ?? 0) + (today?.referrers ?? 0)} />
            <Tile label="Last 7 days" value={last7 ?? 0} />
            <Tile label="Unsubscribed" value={data.totals.unsubscribed} />
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Signups per day <span className="font-normal text-text-muted">· {inRange} in the last {days} days</span></h2>
              <div className="flex items-center gap-4 text-xs">
                {SERIES.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                ))}
                <button onClick={() => setShowTable((v) => !v)} className="text-text-muted underline">{showTable ? 'Chart' : 'Table'}</button>
              </div>
            </div>
            {showTable ? (
              <Table head={['Day', 'Seekers', 'Referrers', 'Total']} rows={[...data.daily].reverse().map((d) => [d.date, d.seekers, d.referrers, d.seekers + d.referrers])} />
            ) : (
              <DailyChart daily={data.daily} />
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="min-w-0 rounded-xl border border-border bg-card p-4">
              <h2 className="mb-1 text-sm font-bold">By button (CTA)</h2>
              <p className="mb-3 text-xs text-text-muted">Which waitlist button they clicked · last {days} days</p>
              <Table head={['CTA', 'Seekers', 'Referrers', 'Total']} rows={data.bySource.map((r) => [r.source ?? '(none)', r.seekers, r.referrers, r.total])} />
            </section>
            <section className="min-w-0 rounded-xl border border-border bg-card p-4">
              <h2 className="mb-1 text-sm font-bold">By campaign (UTM)</h2>
              <p className="mb-3 text-xs text-text-muted">Tag the links you share with ?utm_source=…&amp;utm_campaign=… · last {days} days</p>
              <Table
                head={['Source', 'Medium', 'Campaign', 'Seekers', 'Referrers', 'Total']}
                rows={data.byCampaign.map((r) => [r.utmSource ?? '(direct)', r.utmMedium ?? '—', r.utmCampaign ?? '—', r.seekers, r.referrers, r.total])}
              />
            </section>
          </div>

          <section className="min-w-0 rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold">Latest signups</h2>
            <Table
              head={['When', 'Email', 'List', 'CTA', 'Source', 'Campaign']}
              rows={data.recent.map((r) => [
                new Date(r.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
                r.unsubscribed ? `${r.email} (unsubscribed)` : r.email,
                r.role === 'seeker' ? 'Seeker' : 'Referrer',
                r.source ?? '—',
                r.utmSource ?? '—',
                r.utmCampaign ?? '—',
              ])}
            />
          </section>

          {data.totals.notSyncedToResend > 0 && (
            <p className="text-xs text-text-muted">
              {data.totals.notSyncedToResend} signup(s) not yet synced to Resend — run scripts/sync-waitlist-segments.ts.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, hint, swatch, strong }: { label: string; value: number; hint?: string; swatch?: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
        {swatch && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />}
        {label}
      </div>
      <div className={`tabular-nums ${strong ? 'text-3xl font-bold' : 'text-2xl font-semibold'}`}>{value.toLocaleString()}</div>
      {hint && <div className="text-[11px] text-text-muted">{hint}</div>}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-text-muted">Nothing yet.</p>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr>{head.map((h, i) => <th key={h} className={`border-b border-border py-1.5 pr-3 text-xs font-semibold text-text-muted ${i === 0 || typeof rows[0][i] === 'string' ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((c, j) => <td key={j} className={`py-1.5 pr-3 ${typeof c === 'number' ? 'text-right tabular-nums' : 'text-left'} whitespace-nowrap`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
