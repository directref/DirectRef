import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  delta?: string;
  accent?: boolean;
}

export function StatTile({ label, value, icon, delta, accent }: StatTileProps) {
  return (
    <div className={`bg-card rounded-xl border p-4 text-center ${accent ? 'border-gold-300/30' : 'border-border'}`}>
      <div className="flex items-center justify-center gap-2 mb-2">
        {icon && <span className="text-base">{icon}</span>}
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      </div>
      <div className={`text-2xl font-bold mb-1 ${accent ? 'text-gold-300' : 'text-text-primary'}`}>
        {value}
      </div>
      {delta && (
        <div className="text-xs font-semibold text-good">↑ {delta}</div>
      )}
    </div>
  );
}
