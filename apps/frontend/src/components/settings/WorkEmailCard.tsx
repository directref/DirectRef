'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Briefcase } from 'lucide-react';
import { pfx } from '@/app/(app)/settings/tokens';
import { useAuth } from '@/lib/context/AuthContext';
import { usersApi } from '@/lib/api/users';
import { ApiError } from '@/lib/api/client';
import { Field } from './fields';
import { PrimaryButton } from './buttons';

export const WORK_EMAIL_ANCHOR = 'work-email';
// Deliberately distinct from WORK_EMAIL_ANCHOR — Field auto-generates an id
// from its label ("Work email" -> "work-email"), which would otherwise
// collide with the card's own anchor id above (two elements can't share one).
const WORK_EMAIL_INPUT_ID = 'work-email-input';

/** Lets a referrer prove which company they work at, by verifying a work
 *  email — required before posting a job for that company (see
 *  jobs/post/page.tsx and backend/src/services/companyMatch.ts). Arriving
 *  via #work-email (the Post Job page's "Verify work email" links this
 *  here) scrolls this card into view and briefly highlights it, instead of
 *  just landing at the top of a long settings page. */
export function WorkEmailCard() {
  const { user, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [highlighted, setHighlighted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash !== `#${WORK_EMAIL_ANCHOR}`) return;
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // preventScroll so this doesn't fight the smooth scroll above with its
    // own jump-to-focused-element behavior — no-op if already verified,
    // since the input isn't rendered in that case.
    document.getElementById(WORK_EMAIL_INPUT_ID)?.focus({ preventScroll: true });
    setHighlighted(true);
    const t = setTimeout(() => setHighlighted(false), 2500);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async () => {
    if (!email.trim() || isLoading) return;
    setIsLoading(true);
    try {
      await usersApi.submitWorkEmail(email.trim());
      await refresh();
      setJustSent(true);
      toast.success('Verification email sent — check your inbox.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to send verification email');
    } finally {
      setIsLoading(false);
    }
  };

  const pendingEmail = !user?.workEmailVerified && user?.workEmail;

  return (
    <div
      id={WORK_EMAIL_ANCHOR}
      ref={cardRef}
      className={`rounded-2xl p-4 sm:p-5 scroll-mt-6 transition-shadow duration-700 ${highlighted ? 'ring-2 ring-gold-300' : ''}`}
      style={{ background: pfx.surface, border: `1px solid ${pfx.border}` }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: pfx.goldSoft, color: pfx.gold }}
        >
          <Briefcase className="w-[18px] h-[18px]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold" style={{ color: pfx.ink }}>Verify your work email</p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: pfx.inkSecondary }}>
            Please verify your work email to confirm your employer before posting a job.
          </p>

          {user?.workEmailVerified ? (
            <div className="mt-4 flex items-center gap-2 text-[13.5px] font-medium" style={{ color: pfx.ink }}>
              <CheckCircle2 className="w-4 h-4 text-good shrink-0" strokeWidth={1.8} />
              Verified: {user.workEmail}
            </div>
          ) : (
            <>
              {pendingEmail && !justSent && (
                <div className="mt-4 flex items-center gap-2 text-[13.5px]" style={{ color: pfx.inkMuted }}>
                  <Clock className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                  {user.workEmail} — verification pending, check your inbox or resend below.
                </div>
              )}
              {justSent && (
                <div className="mt-4 flex items-center gap-2 text-[13.5px]" style={{ color: pfx.inkMuted }}>
                  <Clock className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                  Verification link sent to {user?.workEmail}. It&apos;s valid for 1 hour.
                </div>
              )}
              <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <Field
                    id={WORK_EMAIL_INPUT_ID}
                    label="Work email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@yourcompany.com"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
                <PrimaryButton onClick={handleSubmit} disabled={!email.trim() || isLoading}>
                  {isLoading ? 'Sending…' : pendingEmail ? 'Resend link' : 'Send verification'}
                </PrimaryButton>
              </div>
              <p className="mt-2.5 text-[11.5px] leading-relaxed" style={{ color: pfx.inkMuted }}>
                Used for employment verification only. We will never send notifications to this email.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
