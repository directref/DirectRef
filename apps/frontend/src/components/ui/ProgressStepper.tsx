import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressStepperProps {
  steps: string[];
  current: number; // 0-indexed
}

export function ProgressStepper({ steps, current }: ProgressStepperProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                i < current && 'bg-gold-300 text-white',
                i === current && 'bg-gold-300/20 text-gold-300 ring-1 ring-gold-300',
                i > current && 'bg-border text-text-muted',
              )}
            >
              {i < current ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : i + 1}
            </div>
            <span
              className={cn(
                'text-xs font-medium hidden sm:block',
                i === current ? 'text-text-primary font-semibold' : 'text-text-muted',
              )}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn('flex-1 h-px mx-2', i < current ? 'bg-gold-300/50' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  );
}
