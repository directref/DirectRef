import { cn } from '@/lib/utils';

type BadgeVariant = 'violet' | 'teal' | 'amber' | 'rose' | 'blue' | 'muted' | 'good' | 'warn' | 'crit';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantMap: Record<BadgeVariant, string> = {
  violet: 'bg-gold-300/15 text-gold-300 border-gold-300/25',
  teal:   'bg-teal/15 text-teal border-teal/25',
  amber:  'bg-amber/15 text-amber border-amber/25',
  rose:   'bg-rose/15 text-rose border-rose/25',
  blue:   'bg-blue/15 text-blue border-blue/25',
  muted:  'bg-border text-text-secondary border-border-strong',
  good:   'bg-good/15 text-good border-good/25',
  warn:   'bg-warn/15 text-warn border-warn/25',
  crit:   'bg-crit/15 text-crit border-crit/25',
};

export function Badge({ variant = 'muted', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
        variantMap[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
