'use client';

/**
 * Waitlist
 *
 * WHY THIS EXISTS:
 * directref.com launches before it has positions to browse. Instead of
 * sending visitors into an empty app, every CTA on the marketing site opens
 * this modal and collects an email into one of two lists — seekers and
 * referrers — so referrers can be invited first to fill the site.
 *
 * CONNECTIONS:
 * - RENDERED BY: app/(marketing)/layout.tsx (WaitlistProvider wraps every
 *   marketing page, so any button on any of them can open the modal).
 * - CALLED BY: WaitlistButton — the hero, audience cards, closing section,
 *   header and footer.
 * - CALLS: POST /api/waitlist (backend modules/waitlist), and POST /api/events
 *   for each marketing page view and CTA click (the Conversion dashboard).
 *
 * DESIGN DECISIONS:
 * - WHY the button decides the role: a seeker CTA and a referrer CTA already
 *   say who the visitor is, so the form stays a single email field. Neutral
 *   buttons (header, footer) have no role, so the modal offers two submit
 *   buttons instead of guessing.
 * - WHY UTM tags are remembered for the session: a visitor who lands from a
 *   campaign link and reads Our Story before signing up would otherwise lose
 *   the attribution on the second page.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { mkt } from '@/app/(marketing)/tokens';
import { api, ApiError } from '@/lib/api/client';
import { API_BASE } from '@/lib/constants';

export type WaitlistRole = 'seeker' | 'referrer';

interface OpenOptions {
  /** Preset by audience-specific CTAs; null = ask (two submit buttons). */
  role: WaitlistRole | null;
  /** Which button opened the modal — stored for attribution. */
  source: string;
}

const WaitlistContext = createContext<((opts: OpenOptions) => void) | null>(null);

// Final copy from Shai, 2026-09-29. One block per way into the modal.
const BUTTON = {
  seeker: "I'm looking for a job",
  referrer: 'I want to refer candidates',
} as const;

const COPY = {
  seeker: {
    title: 'Positions are on their way',
    body: "We're gathering roles from insiders who can refer. Leave your email and we'll let you know as soon as DirectRef opens.",
    placeholder: 'you@example.com',
  },
  referrer: {
    title: 'Share open roles & claim your bonus',
    body: "DirectRef is launching soon. Join the waitlist now to get early access so you can post your company's open positions before job seekers start applying.",
    // A hint, not a rule: any address is accepted. Work-email verification
    // happens later, before a referrer can post.
    placeholder: 'work.email@company.com',
  },
  neutral: {
    title: 'Join the DirectRef waitlist',
    body: "We're gathering positions from insiders who can refer. Leave your email and we'll let you know as soon as DirectRef opens.",
    placeholder: 'you@example.com',
  },
} as const;

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
const UTM_STORAGE_KEY = 'directref-utm';

/** Read UTM tags from the landing URL, falling back to what this tab saw first. */
function readUtm(): Record<string, string> {
  const fromUrl: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) fromUrl[k] = v.slice(0, 128);
  }
  try {
    if (Object.keys(fromUrl).length) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    return JSON.parse(sessionStorage.getItem(UTM_STORAGE_KEY) ?? '{}');
  } catch {
    return fromUrl; // storage blocked (private mode etc.) — attribution is best-effort
  }
}

/** Anonymous page view / CTA click for the Conversion dashboard. Fire and
 *  forget: keepalive lets it finish even if the click navigates away, and a
 *  failure must never get in the way of the page. No cookies are sent. */
function trackEvent(event: { type: 'page_view' | 'cta_click'; cta?: string; role?: WaitlistRole | null }) {
  try {
    const utm = readUtm();
    void fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: event.type,
        cta: event.cta?.slice(0, 64),
        role: event.role ?? undefined,
        path: window.location.pathname.slice(0, 256),
        utmSource: utm.utm_source,
        utmMedium: utm.utm_medium,
        utmCampaign: utm.utm_campaign,
      }),
    }).catch(() => {});
  } catch { /* tracking is best-effort */ }
}

type Status = 'idle' | 'submitting' | 'done';

export function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<OpenOptions>({ role: null, source: 'unknown' });
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  // Capture UTM tags on first load, before the visitor navigates away from
  // the campaign URL.
  useEffect(() => { readUtm(); }, []);

  // One page view per marketing page the visitor lands on or moves to.
  const pathname = usePathname();
  useEffect(() => { trackEvent({ type: 'page_view' }); }, [pathname]);

  const openWaitlist = useCallback((next: OpenOptions) => {
    trackEvent({ type: 'cta_click', cta: next.source, role: next.role });
    setOpts(next);
    setStatus('idle');
    setError(null);
    setOpen(true);
  }, []);

  async function submit(role: WaitlistRole) {
    if (status === 'submitting') return;
    setError(null);
    setStatus('submitting');
    const utm = readUtm();
    try {
      await api.post('/api/waitlist', {
        email,
        role,
        sourceCta: opts.source,
        utmSource: utm.utm_source,
        utmMedium: utm.utm_medium,
        utmCampaign: utm.utm_campaign,
        utmTerm: utm.utm_term,
        utmContent: utm.utm_content,
        website: honeypot.current?.value || undefined,
      });
      setStatus('done');
    } catch (err) {
      setStatus('idle');
      if (err instanceof ApiError && err.status === 422) setError('Please enter a valid email address.');
      else if (err instanceof ApiError && err.status === 429) setError('Too many attempts. Please try again in a little while.');
      else setError('Something went wrong. Please try again.');
    }
  }

  const copy = COPY[opts.role ?? 'neutral'];
  const submitting = status === 'submitting';

  return (
    <WaitlistContext.Provider value={openWaitlist}>
      {children}
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-7 shadow-2xl focus:outline-none"
            style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}`, color: mkt.textPrimary, fontFamily: 'var(--font-rubik)' }}
          >
            <DialogPrimitive.Close
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ color: mkt.textMuted }}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </DialogPrimitive.Close>

            {status === 'done' ? (
              <div className="pr-6">
                <DialogPrimitive.Title className="text-[22px] font-bold leading-tight">You&apos;re on the list ✓</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-3 text-[14.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>
                  Check your inbox. We&apos;ve sent a confirmation to <span className="font-semibold" style={{ color: mkt.textPrimary }}>{email}</span>.
                </DialogPrimitive.Description>
                <DialogPrimitive.Close
                  className="mt-6 rounded-[10px] text-[14px] font-semibold"
                  style={{ background: mkt.accentSeeker, color: '#1a1206', padding: '12px 20px' }}
                >
                  Done
                </DialogPrimitive.Close>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  // Enter key. With no preset role we don't guess — a wrong tag
                  // would send "post your roles" to a job seeker.
                  if (opts.role) void submit(opts.role);
                  else setError('Choose one of the two options below.');
                }}
              >
                <DialogPrimitive.Title className="pr-6 text-[22px] font-bold leading-tight">{copy.title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-3 text-[14.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>
                  {copy.body}
                </DialogPrimitive.Description>

                <label htmlFor="waitlist-email" className="mt-6 block text-[13px] font-medium" style={{ color: mkt.textSecondary }}>
                  Email
                </label>
                <input
                  id="waitlist-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={copy.placeholder}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'waitlist-error' : undefined}
                  className="mt-1.5 w-full rounded-[10px] px-3.5 py-3 text-[15px] outline-none focus:ring-2"
                  style={{ border: `1px solid ${error ? '#c0392b' : mkt.borderStrong}`, background: mkt.bg, color: mkt.textPrimary }}
                />
                {/* Honeypot: off-screen and skipped by keyboard and screen readers. */}
                <input
                  ref={honeypot}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] h-px w-px opacity-0"
                />
                {error && (
                  <p id="waitlist-error" role="alert" className="mt-2 text-[13px]" style={{ color: '#c0392b' }}>{error}</p>
                )}

                <div className="mt-5 flex flex-col gap-2.5">
                  {opts.role ? (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-[10px] text-[14px] font-semibold disabled:opacity-60"
                      style={{ background: mkt.accentSeeker, color: '#1a1206', padding: '13px 22px' }}
                    >
                      {submitting ? 'Adding you…' : BUTTON[opts.role]}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void submit('seeker')}
                        className="rounded-[10px] text-[14px] font-semibold disabled:opacity-60"
                        style={{ background: mkt.accentSeeker, color: '#1a1206', padding: '13px 22px' }}
                      >
                        {BUTTON.seeker}
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void submit('referrer')}
                        className="rounded-[10px] text-[14px] font-medium disabled:opacity-60"
                        style={{ border: `1px solid ${mkt.borderStrong}`, color: mkt.textPrimary, padding: '12.5px 22px' }}
                      >
                        {BUTTON.referrer}
                      </button>
                    </>
                  )}
                </div>

                <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: mkt.textMuted }}>
                  We&apos;ll email you when DirectRef opens. Unsubscribe anytime. See our{' '}
                  <a href="/privacy" className="underline">privacy policy</a>.
                </p>
              </form>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </WaitlistContext.Provider>
  );
}

/** A CTA that opens the waitlist instead of navigating. Styled by the caller,
 *  so each call site keeps the look its <Link> had. */
export function WaitlistButton({
  role,
  source,
  className,
  style,
  children,
}: {
  role: WaitlistRole | null;
  source: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const openWaitlist = useContext(WaitlistContext);
  if (!openWaitlist) throw new Error('WaitlistButton must be rendered inside WaitlistProvider');
  return (
    <button type="button" className={`cursor-pointer ${className ?? ''}`} style={style} onClick={() => openWaitlist({ role, source })}>
      {children}
    </button>
  );
}
