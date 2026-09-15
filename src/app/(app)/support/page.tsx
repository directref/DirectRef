'use client';

import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useCreditBalance } from '@/lib/hooks/useCredits';
import { Button } from '@/components/ui/Button';

const SUPPORT_EMAIL = 'support@direct-ref.com';

export default function SupportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance } = useCreditBalance();

  const mailtoHref = `mailto:${SUPPORT_EMAIL}` +
    `?subject=${encodeURIComponent('Requesting more credits')}` +
    `&body=${encodeURIComponent(
      `Hi,\n\nI'd like to request more credits.\n\nAccount email: ${user?.email ?? ''}\nCurrent balance: ${balance?.total ?? '?'}\n\nThanks!`,
    )}`;

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push('/feed'))}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-6 transition-colors"
      >
        ← Back
      </button>

      <div className="bg-card border border-border rounded-2xl p-8">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-input flex items-center justify-center">
          <Mail className="w-5 h-5 text-text-muted" strokeWidth={1.8} />
        </div>
        <h1 className="text-[20px] font-bold text-text-primary mb-2">Need more credits?</h1>
        {balance && (
          <p className="text-sm text-text-secondary mb-3">
            You currently have {balance.total} credit{balance.total === 1 ? '' : 's'} remaining.
          </p>
        )}
        <p className="text-sm text-text-secondary mb-6">
          DirectRef is currently in beta, so we&apos;re happy to top up your account for free! Just reach out to our team and let us know how many credits you need.
        </p>
        <a href={mailtoHref}>
          <Button variant="primary" size="lg" className="w-full">Contact support</Button>
        </a>
      </div>
    </div>
  );
}
