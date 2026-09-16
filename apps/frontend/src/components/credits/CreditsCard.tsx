'use client';

import { useState } from 'react';
// import Link from 'next/link';
import { useCreditBalance } from '@/lib/hooks/useCredits';

/** Sidebar credits card — dark palette matches Sidebar.tsx's own hardcoded
 *  colors rather than the light-surface Tailwind tokens, since it lives in
 *  that same dark nav column. */
export function CreditsCard() {
  const { balance, isLoading } = useCreditBalance();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const total = balance?.total ?? 0;

  return (
    <div className="rounded-[14px] p-2.5" style={{ background: '#1A1410', border: '1px solid rgba(212,175,122,0.08)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[12.5px] font-semibold uppercase tracking-[0.03em]" style={{ color: '#A89070' }}>
          Credits
        </span>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            onFocus={() => setTooltipVisible(true)}
            onBlur={() => setTooltipVisible(false)}
            className="w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] shrink-0"
            style={{ borderColor: 'rgba(168,144,112,0.5)', color: '#A89070' }}
            aria-label="What are credits?"
          >
            ?
          </button>
          {tooltipVisible && (
            <div
              className="absolute left-0 bottom-6 z-50 w-48 text-[11px] leading-snug px-2.5 py-2 rounded-lg pointer-events-none"
              style={{ background: '#2A2118', color: '#E8DCC8', border: '1px solid rgba(212,175,122,0.15)' }}
            >
              Each job post costs 1 credit. You received 5 credits when you joined, plus 1 free credit every month.
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-[13px]" style={{ color: '#A89070' }}>Loading…</p>
      ) : (
        <p className="text-[15px] font-bold" style={{ color: '#F0E8D8' }}>
          {total} credit{total === 1 ? '' : 's'} available
        </p>
      )}

      {/* Buy credits is disabled — kept for a quick re-enable, not shown. */}
      {/* <Link
        href="/credits"
        className="w-full flex items-center justify-center py-1.5 rounded-lg text-[13px] font-semibold transition-colors hover:bg-white/5 mt-1.5"
        style={{ border: '1px solid rgba(168,144,112,0.4)', color: '#D9C9A8' }}
      >
        Buy credits
      </Link> */}
    </div>
  );
}
