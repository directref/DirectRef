import Link from 'next/link';
import { mkt } from '@/app/(marketing)/tokens';

interface MarketingHeaderProps {
  /** 'home' shows the full anchor nav. 'sub' shows a back-home link instead. */
  variant?: 'home' | 'sub';
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" style={{ color: mkt.textPrimary }}>
      <svg viewBox="0 0 28 28" className="w-6 h-6" style={{ color: mkt.accentSeeker }} aria-hidden="true">
        <circle cx="14" cy="9" r="4" fill="currentColor" />
        <path d="M5 25c0-4.6 4-8 9-8s9 3.4 9 8" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M21.5 3.5c1.9 1.7 1.9 5.3 0 7M24.5 1c3.2 2.9 3.2 9.1 0 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.55" />
      </svg>
      <span className="text-[17px]">DirectRef</span>
      <span
        className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ background: mkt.cardBg, border: `1px solid ${mkt.borderStrong}`, color: mkt.textMuted }}
      >
        Beta
      </span>
    </Link>
  );
}

const navLinkStyle = { color: mkt.textSecondary };

export function MarketingHeader({ variant = 'home' }: MarketingHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur"
      style={{ borderBottom: `1px solid ${mkt.border}`, background: `color-mix(in oklab, ${mkt.bg} 90%, transparent)` }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        <nav className="flex items-center gap-6 text-[13.5px]">
          {variant === 'home' ? (
            <>
              <Link href="#how" className="hidden sm:inline" style={navLinkStyle}>How it works</Link>
              <Link href="#audiences" className="hidden sm:inline" style={navLinkStyle}>Seekers &amp; referrers</Link>
              <Link href="/our-story" className="hidden sm:inline" style={navLinkStyle}>Our story</Link>
              <Link href="#faq" className="hidden sm:inline" style={navLinkStyle}>FAQ</Link>
            </>
          ) : (
            <>
              <Link href="/" className="hidden sm:inline" style={navLinkStyle}>← Back home</Link>
              <Link href="/our-story" className="hidden sm:inline" style={navLinkStyle}>Our story</Link>
            </>
          )}
          <Link
            href="/login"
            className="rounded-[10px] px-3.5 py-1.5 text-[13.5px] font-medium"
            style={{ border: `1px solid ${mkt.borderStrong}`, color: mkt.textPrimary }}
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
