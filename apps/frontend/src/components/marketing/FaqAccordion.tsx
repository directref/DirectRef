'use client';

import { useState } from 'react';
import { mkt } from '@/app/(marketing)/tokens';

interface FaqItem {
  q: string;
  a: string;
}

function ToggleIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0" style={{ color: mkt.textMuted }} aria-hidden="true"
    >
      <path d="M5 12h14" />
      {!open && <path d="M12 5v14" />}
    </svg>
  );
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col divide-y" style={{ borderTop: `1px solid ${mkt.border}`, borderBottom: `1px solid ${mkt.border}`, borderColor: mkt.border }}>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.q} style={{ borderColor: mkt.border }}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className="text-[15px] font-medium" style={{ color: mkt.textPrimary }}>{item.q}</span>
              <ToggleIcon open={open} />
            </button>
            {open && (
              <p className="pb-5 pr-8 text-[13.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
