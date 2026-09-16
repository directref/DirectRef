import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChipProps {
  label: string;
  active?: boolean;
  onToggle?: () => void;
  icon?: ReactNode;
}

export function Chip({ label, active, onToggle, icon }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap',
        active
          ? 'bg-gold-300/15 border-gold-300/40 text-gold-300'
          : 'bg-input border-border-strong text-text-secondary hover:border-gold-300/30 hover:text-text-primary',
      )}
    >
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}
