'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { pfx } from './tokens';
import { useAuth } from '@/lib/context/AuthContext';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { LinkedInCard } from '@/components/settings/LinkedInCard';
import { WorkEmailCard } from '@/components/settings/WorkEmailCard';
import { BillingCard } from '@/components/settings/BillingCard';
import { DeleteAccountCard } from '@/components/settings/DeleteAccountCard';

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledLinkedInParam = useRef(false);

  // Landed back here from the LinkedIn "Connect" OAuth round-trip.
  useEffect(() => {
    const linkedin = searchParams.get('linkedin');
    if (!linkedin || handledLinkedInParam.current) return;
    handledLinkedInParam.current = true;

    if (linkedin === 'connected') {
      refresh();
      toast.success("LinkedIn connected. We'll use it to sharpen your matches.");
    } else if (linkedin === 'error') {
      const reason = searchParams.get('reason');
      toast.error(
        reason === 'already_linked'
          ? 'That LinkedIn account is already linked to another DirectRef account.'
          : 'Could not connect LinkedIn. Please try again.',
      );
    }
    router.replace('/settings');
  }, [searchParams, refresh, router]);

  return (
    <div className="mx-auto px-4 py-8" style={{ maxWidth: '42rem' }}>
      <div className="mb-6">
        <h1 className="text-[26px] font-bold tracking-[-0.02em]" style={{ color: pfx.ink }}>
          Profile &amp; preferences
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: pfx.inkSecondary }}>
          What referrers see, and what we match you against.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <ProfileCard />
        <LinkedInCard />
        {user?.isReferrer && <WorkEmailCard />}
        <BillingCard />
        <DeleteAccountCard />
      </div>
    </div>
  );
}
