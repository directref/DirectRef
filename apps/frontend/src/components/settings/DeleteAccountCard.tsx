'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { pfx } from '@/app/(app)/settings/tokens';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usersApi } from '@/lib/api/users';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

/** Self-serve account deletion — the right the Privacy Policy grants.
 *
 *  Deliberately a small text link rather than a card: what deleting does is
 *  already spelled out in Terms/Privacy, and the confirm dialog repeats the
 *  one-sentence version right before the irreversible click, which is the
 *  moment that consequence actually matters. */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await usersApi.deleteMe();
      // Not router.push/replace: the account no longer exists, but a
      // client-side navigation can land back inside the already-mounted
      // (app) layout without re-running its auth check (Next.js doesn't
      // re-fetch a persisted layout for a sibling route), which rendered a
      // broken, half-logged-in shell instead of the login page. A hard
      // navigation is the only way to guarantee a clean landing.
      await authApi.logout().catch(() => {});
      window.location.href = '/login?accountDeleted=1';
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not delete your account';
      toast.error(msg);
      setIsDeleting(false);
      setOpen(false);
    }
  };

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[12px] underline underline-offset-2"
        style={{ color: pfx.inkMuted }}
      >
        Delete account
      </button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="Your profile, your CV, your applications and any roles you posted are permanently deleted. Seekers who applied to your roles are notified that you have left. This cannot be undone."
        confirmLabel="Delete permanently"
        onConfirm={handleDelete}
        isLoading={isDeleting}
        destructive
      />
    </div>
  );
}
