import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import { mkt } from './tokens';

/** Closed to search engines for the early beta — paired with the blanket
 *  disallow in app/robots.ts. Remove BOTH when going public; either one alone
 *  leaves the site half-open. Child pages set their own title/description and
 *  inherit this robots block. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const rubik = Rubik({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-rubik',
});

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${rubik.variable} min-h-screen`}
      style={{ fontFamily: 'var(--font-rubik)', background: mkt.bg, color: mkt.textPrimary }}
    >
      {children}
    </div>
  );
}
