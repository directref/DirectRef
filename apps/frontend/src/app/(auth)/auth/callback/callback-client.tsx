'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usersApi } from '@/lib/api/users';

export default function CallbackClient() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get('success');
    const error   = searchParams.get('error');

    if (error || !success) {
      router.replace(`/login?error=${error ?? 'oauth_failed'}`);
      return;
    }

    // Cookies were set by the backend — just verify the session is live
    usersApi.me()
      .then(() => router.replace('/feed'))
      .catch(() => router.replace('/login?error=session_missing'));
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-text-secondary">
      <div className="w-6 h-6 rounded-full border-2 border-gold-300 border-t-transparent animate-spin" />
      <p className="text-sm">Signing you in…</p>
    </div>
  );
}
