import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  charCount?: boolean;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, charCount, maxLength, value, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    const currentLen = typeof value === 'string' ? value.length : 0;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-text-secondary mb-1.5">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          value={value}
          maxLength={maxLength}
          rows={4}
          className={cn(
            'w-full bg-input border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted resize-none',
            'focus:outline-none focus:ring-2 focus:ring-gold-300/40 focus:border-gold-300 transition-colors',
            error && 'border-crit focus:ring-crit/40',
            className,
          )}
          {...props}
        />
        <div className="flex justify-between mt-1">
          {error && <p className="text-xs text-crit">{error}</p>}
          {charCount && maxLength && (
            <p className="text-xs text-text-muted ml-auto">
              {currentLen}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
