import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { UnsubscribeForm } from './UnsubscribeForm';

export const metadata: Metadata = {
  title: 'Unsubscribe: DirectRef',
  robots: { index: false, follow: false },
};

/** Landing page for the "Unsubscribe" link in waitlist emails. */
export default async function WaitlistUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <MarketingHeader variant="sub" />
      <main className="mx-auto max-w-md px-5 py-20">
        <UnsubscribeForm token={token ?? null} />
      </main>
      <MarketingFooter />
    </>
  );
}
