/** Building blocks shared by the admin dashboards. */

export function Tile({ label, value, hint, swatch, strong }: { label: string; value: number | string; hint?: string; swatch?: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
        {swatch && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} />}
        {label}
      </div>
      <div className={`tabular-nums ${strong ? 'text-3xl font-bold' : 'text-2xl font-semibold'}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {hint && <div className="text-[11px] text-text-muted">{hint}</div>}
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
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
