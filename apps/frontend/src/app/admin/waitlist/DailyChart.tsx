'use client';

import { useEffect, useRef, useState } from 'react';
import type { WaitlistDashboardData } from './types';

/** Seekers and referrers per day, stacked. Colors are the app's own series
 *  tokens (--color-blue / --color-amber), validated as a CVD-safe pair. */
export const SERIES = [
  { key: 'seekers', label: 'Seekers', color: 'var(--color-blue)' },
  { key: 'referrers', label: 'Referrers', color: 'var(--color-amber)' },
] as const;

const H = 220;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };
const GAP = 2; // surface gap between stacked segments

function niceMax(n: number) {
  if (n <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(n)));
  return Math.ceil(n / step) * step;
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function DailyChart({ daily }: { daily: WaitlistDashboardData['daily'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(800);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = niceMax(Math.max(0, ...daily.map((d) => d.seekers + d.referrers)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(daily.length, 1);
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const y = (v: number) => (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(daily.length / Math.max(2, Math.floor(plotW / 60)));
  const h = hover === null ? null : daily[hover];

  return (
    <div className="relative" ref={box}>
      <svg width={width} height={H} role="img" aria-label="Daily waitlist signups by list" className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH - y(t)} y2={PAD.top + plotH - y(t)} stroke="var(--color-border)" />
            <text x={PAD.left - 6} y={PAD.top + plotH - y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-text-muted)">{t}</text>
          </g>
        ))}
        {daily.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const sH = y(d.seekers);
          const rH = y(d.referrers);
          const base = PAD.top + plotH;
          return (
            <g key={d.date} opacity={hover === null || hover === i ? 1 : 0.45}>
              {sH > 0 && <rect x={x} y={base - sH} width={barW} height={sH} rx={rH > 0 ? 0 : 3} fill={SERIES[0].color} />}
              {rH > 0 && (
                <rect x={x} y={base - sH - rH} width={barW} height={Math.max(0, rH - (sH > 0 ? GAP : 0))} rx={3} fill={SERIES[1].color} />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">{fmtDay(d.date)}</text>
              )}
              {/* hit target: the full column, bigger than the bar */}
              <rect
                x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg border border-border-strong bg-card px-3 py-2 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(PAD.left + hover * slot + slot / 2 - 70, 0), width - 140),
            width: 140,
          }}
        >
          <div className="mb-1 font-semibold">{fmtDay(h.date)}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
              <span className="font-semibold tabular-nums">{h[s.key]}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-border pt-1 text-text-muted">
            <span>Total</span><span className="tabular-nums">{h.seekers + h.referrers}</span>
          </div>
        </div>
      )}
    </div>
  );
}
