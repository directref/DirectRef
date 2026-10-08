'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** One tab per dashboard. */
const TABS = [
  { href: '/admin/waitlist', label: 'Waitlist' },
  { href: '/admin/conversion', label: 'Conversion' },
  { href: '/admin/tests', label: 'Tests' },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4 sm:px-6">
        <Link href="/feed" className="py-3 text-sm whitespace-nowrap text-text-muted hover:text-text-primary">← Back to app</Link>
        <span className="py-3 text-sm font-bold whitespace-nowrap">Admin Panel</span>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <Link
              key={t.label}
              href={t.href}
              className={`border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap ${
                pathname === t.href ? 'border-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
