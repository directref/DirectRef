'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** One tab per dashboard. Tests and Conversion are planned next and shown
 *  disabled so the shape of the admin area is visible from day one. */
const TABS = [
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: null, label: 'Tests', note: 'soon' },
  { href: null, label: 'Conversion', note: 'soon' },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4 sm:px-6">
        <span className="py-3 text-sm font-bold whitespace-nowrap">DirectRef admin</span>
        <nav className="flex gap-1">
          {TABS.map((t) =>
            t.href ? (
              <Link
                key={t.label}
                href={t.href}
                className={`border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap ${
                  pathname === t.href ? 'border-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                {t.label}
              </Link>
            ) : (
              <span key={t.label} className="border-b-2 border-transparent px-3 py-3 text-sm whitespace-nowrap text-text-muted">
                {t.label} <span className="text-[11px]">({t.note})</span>
              </span>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
