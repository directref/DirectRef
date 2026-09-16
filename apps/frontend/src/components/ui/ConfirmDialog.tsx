'use client';

import { Dialog, DialogContent } from './Dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No X — Cancel below is the only dismiss action, so there's exactly
          one way to back out instead of two that do the same thing. */}
      <DialogContent title={title} description={description} className="max-w-[420px]">
        <div className="px-6 pb-6 pt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-[10px] border border-border-strong px-4 py-2.5 text-[13.5px] font-medium text-text-primary hover:bg-border transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold transition-colors disabled:opacity-50',
              destructive ? 'bg-crit text-white hover:bg-crit/90' : 'bg-gold-300 text-[#0A0A0A] hover:bg-gold-400',
            )}
          >
            {isLoading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
