'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  children,
  className,
  title,
  description,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  onClose?: () => void;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
          'bg-card border border-border-strong rounded-2xl shadow-2xl',
          'w-full max-w-lg mx-4',
          'focus:outline-none',
          className,
        )}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
            <div>
              {title && (
                <DialogPrimitive.Title className="text-base font-bold text-text-primary">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-sm text-text-secondary mt-0.5">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            {onClose && (
              <DialogPrimitive.Close
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-border-strong transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </DialogPrimitive.Close>
            )}
          </div>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
