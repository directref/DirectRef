'use client';

import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

interface OutOfCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export function OutOfCreditsModal({ open, onClose }: OutOfCreditsModalProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="You don't have enough credits" onClose={onClose}>
        <div className="px-6 py-5">
          <p className="text-sm text-text-secondary">
            You need a credit to post a job. Reach out to support and we&apos;ll help you out.
          </p>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>Not now</Button>
          <Button variant="primary" onClick={() => { onClose(); router.push('/support'); }}>
            Contact support
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
