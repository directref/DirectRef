'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { pfx } from '@/app/(app)/settings/tokens';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/context/AuthContext';
import { ApiError } from '@/lib/api/client';

/** Self-serve account deletion — the right the Privacy Policy grants.
 *
 *  Deliberately spells out the consequence for other people before the
 *  confirm: deleting a referrer's account takes their postings with it, and
 *  every application sent to those postings goes too. Those seekers are
 *  notified in-app by the server (see users.service.ts deleteAccount), but
 *  the person pressing the button should know that's what they're doing. */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await usersApi.deleteMe();
      toast.success('Your account and every CV you uploaded have been deleted.');
      await logout().catch(() => {});
      router.replace('/');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not delete your account';
      toast.error(msg);
      setIsDeleting(false);
      setOpen(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: pfx.surface, border: `1px solid ${pfx.border}` }}>
      <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: pfx.inkMuted }}>
        Delete account
      </p>

      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: pfx.inkSecondary }}>
        Deletes your profile, your CV, every application you sent, and any role you posted.
        Every CV file you uploaded is removed from our servers. This cannot be undone.
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: pfx.inkSecondary }}>
        If you have posted roles, the applications sent to them are removed too. Those
        seekers are told their referrer has left, so nobody is left waiting on an answer
        that will never come.
      </p>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[10px] px-4 py-2 text-[13.5px] font-semibold"
          style={{ border: `1px solid ${pfx.border}`, color: pfx.danger, background: 'transparent' }}
        >
          Delete my account
        </button>
      </div>

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
