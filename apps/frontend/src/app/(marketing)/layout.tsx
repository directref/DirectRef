import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import { mkt } from './tokens';
import { WaitlistProvider } from '@/components/marketing/Waitlist';

/** Indexable: the marketing pages are what search engines should find (see
 *  app/robots.ts). Each page sets its own title, description and canonical
 *  URL; a page that must stay out of search sets its own `robots` metadata. */
export const metadata: Metadata = {
  robots: { index: true, follow: true },
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
      <WaitlistProvider>{children}</WaitlistProvider>
    </div>
  );
}
