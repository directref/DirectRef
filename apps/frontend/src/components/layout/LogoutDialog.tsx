'use client';

import { useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface LogoutDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Built on raw Dialog primitives rather than the shared DialogContent — that
 *  component always renders a bordered header block when given a title,
 *  which reads as two stacked sections; this is meant to be one unified card. */
export function LogoutDialog({ open, onClose, onConfirm }: LogoutDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in-0 duration-150" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            confirmRef.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-sm sm:max-w-md rounded-2xl bg-card p-6 shadow-2xl focus:outline-none animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between gap-3">
            <DialogPrimitive.Title className="text-lg font-semibold leading-tight text-text-primary">
              Are you sure you want to log out?
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 rounded-full bg-border flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-border-strong transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-text-muted">
            You can always sign back in when you&apos;re ready.
          </DialogPrimitive.Description>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[12px] bg-input px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-card-hover"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              className="flex-1 rounded-[12px] bg-gold-300 px-4 py-2 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-gold-400"
            >
              Log out
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
