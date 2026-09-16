'use client';

import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { WORK_EMAIL_ANCHOR } from '@/components/settings/WorkEmailCard';

interface WorkEmailRequiredModalProps {
  open: boolean;
  onClose: () => void;
  /** COMPANY_MISMATCH gets a message naming the mismatch; WORK_EMAIL_REQUIRED
   *  (or anything else) falls back to the generic "verify first" message. */
  reason: 'WORK_EMAIL_REQUIRED' | 'COMPANY_MISMATCH' | null;
  companyName?: string;
}

export function WorkEmailRequiredModal({ open, onClose, reason, companyName }: WorkEmailRequiredModalProps) {
  const router = useRouter();

  const body = reason === 'COMPANY_MISMATCH'
    ? `Your verified work email doesn't match ${companyName ?? 'this company'}. You can only post jobs for the company you work at.`
    : 'Verify your work email before posting a job — it confirms you actually work at the company you\'re posting for.';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Work email required" onClose={onClose}>
        <div className="px-6 py-5">
          <p className="text-sm text-text-secondary">{body}</p>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>Not now</Button>
          <Button variant="primary" onClick={() => { onClose(); router.push(`/settings#${WORK_EMAIL_ANCHOR}`); }}>
            Verify work email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
