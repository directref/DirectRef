'use client';

import { useState } from 'react';
import { mkt } from '../../tokens';
import { api } from '@/lib/api/client';

/**
 * WHY A BUTTON, not an automatic unsubscribe on page load: mail scanners
 * (corporate security gateways, Outlook Safe Links) open every link in an
 * email. If loading this page unsubscribed you, a scanner would unsubscribe
 * people who never clicked anything.
 */
export function UnsubscribeForm({ token }: { token: string | null }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  if (!token) {
    return (
      <p className="text-[15px]" style={{ color: mkt.textSecondary }}>
        This unsubscribe link is incomplete. Use the link from the email itself, or write to{' '}
        <a href="mailto:support@direct-ref.com" className="underline">support@direct-ref.com</a>.
      </p>
    );
  }

  if (state === 'done') {
    return (
      <>
        <h1 className="text-[26px] font-bold">You&apos;re unsubscribed</h1>
        <p className="mt-3 text-[15px]" style={{ color: mkt.textSecondary }}>
          We won&apos;t email you about the DirectRef launch. Changed your mind? Join again from the home page.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[26px] font-bold">Leave the DirectRef waitlist?</h1>
      <p className="mt-3 text-[15px]" style={{ color: mkt.textSecondary }}>
        We&apos;ll stop emailing you about DirectRef opening.
      </p>
      <button
        type="button"
        disabled={state === 'working'}
        onClick={async () => {
          setState('working');
          try {
            await api.post('/api/waitlist/unsubscribe', { token });
            setState('done');
          } catch {
            setState('error');
          }
        }}
        className="mt-6 rounded-[10px] text-[14px] font-semibold disabled:opacity-60"
        style={{ background: mkt.accentSeeker, color: '#1a1206', padding: '13px 22px' }}
      >
        {state === 'working' ? 'Unsubscribing…' : 'Unsubscribe'}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-3 text-[13px]" style={{ color: '#c0392b' }}>
          That didn&apos;t work. Please try again, or write to support@direct-ref.com.
        </p>
      )}
    </>
  );
}
