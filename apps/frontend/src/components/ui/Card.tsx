import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  accent?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover, accent, children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-card rounded-xl border border-border',
        hover && 'transition-all duration-150 cursor-pointer hover:bg-card-hover hover:border-border-strong hover:shadow-lg hover:-translate-y-px',
        accent && 'border-gold-300/30',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
Card.displayName = 'Card';
