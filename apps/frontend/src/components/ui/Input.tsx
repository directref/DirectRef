import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-input border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted',
              'focus:outline-none focus:ring-2 focus:ring-gold-300/40 focus:border-gold-300 transition-colors',
              leftIcon && 'pl-9',
              error && 'border-crit focus:ring-crit/40 focus:border-crit',
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-crit">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';
