import Link from 'next/link';
import { mkt } from '@/app/(marketing)/tokens';

function FooterLogo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight" style={{ color: mkt.textPrimary }}>
      <svg viewBox="0 0 28 28" className="w-6 h-6" style={{ color: mkt.accentSeeker }} aria-hidden="true">
        <circle cx="14" cy="9" r="4" fill="currentColor" />
        <path d="M5 25c0-4.6 4-8 9-8s9 3.4 9 8" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M21.5 3.5c1.9 1.7 1.9 5.3 0 7M24.5 1c3.2 2.9 3.2 9.1 0 12" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.55" />
      </svg>
      <span className="text-[17px]">DirectRef</span>
    </span>
  );
}

const footerLinkStyle = { color: mkt.textSecondary };

export function MarketingFooter() {
  return (
    <footer style={{ borderTop: `1px solid ${mkt.border}` }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <FooterLogo />
          <p className="mt-2 text-[13px]" style={{ color: mkt.textMuted }}>Connecting people to their next role.</p>
        </div>
        <nav className="flex flex-wrap gap-5 text-[13.5px]">
          <Link href="/our-story" style={footerLinkStyle}>Our story</Link>
          <Link href="/login" style={footerLinkStyle}>Sign in</Link>
          <Link href="/register" style={footerLinkStyle}>Create an account</Link>
        </nav>
      </div>
      <div className="flex justify-center gap-5 flex-wrap pb-3.5">
        <Link href="/terms" className="text-[13px]" style={{ color: mkt.textMuted }}>Terms</Link>
        <Link href="/privacy" className="text-[13px]" style={{ color: mkt.textMuted }}>Privacy</Link>
        <a href="mailto:support@direct-ref.com" className="text-[13px]" style={{ color: mkt.textMuted }}>Contact</a>
      </div>
      <p className="text-center text-[13px] pb-7" style={{ color: mkt.textMuted }}>
        DirectRef is in early beta. · © 2026 DirectRef.
      </p>
    </footer>
  );
}
