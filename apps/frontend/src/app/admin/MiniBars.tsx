'use client';

import { useEffect, useRef, useState } from 'react';

/** One metric per day as a small single-series bar chart. The dashboard shows
 *  several side by side (small multiples) instead of one chart with mixed
 *  scales: page views run in the hundreds, CVs sent in single digits. */
const H = 96;
const PAD = { top: 8, bottom: 4 };

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function MiniBars({ title, total, points, color }: {
  title: string;
  total: number;
  points: { date: string; value: number }[];
  color: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(160, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(1, ...points.map((p) => p.value));
  const plotH = H - PAD.top - PAD.bottom;
  const slot = width / Math.max(points.length, 1);
  const barW = Math.max(2, Math.min(16, slot * 0.7));
  const shown = hover === null ? null : points[hover];

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-text-muted uppercase">{title}</h3>
        <span className="text-xs text-text-muted tabular-nums">
          {shown ? `${fmtDay(shown.date)}: ${shown.value}` : `peak ${Math.max(0, ...points.map((p) => p.value))}/day`}
        </span>
      </div>
      <div className="mb-2 text-2xl font-semibold tabular-nums">{total.toLocaleString()}</div>
      <div ref={box}>
        <svg width={width} height={H} role="img" aria-label={`${title} per day`} className="block">
          <line x1={0} x2={width} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--color-border-strong)" />
          {points.map((p, i) => {
            const h = (p.value / max) * plotH;
            const x = i * slot + (slot - barW) / 2;
            return (
              <g key={p.date} opacity={hover === null || hover === i ? 1 : 0.45}>
                {h > 0 && <rect x={x} y={H - PAD.bottom - h} width={barW} height={h} rx={2} fill={color} />}
                <rect
                  x={i * slot} y={0} width={slot} height={H} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
