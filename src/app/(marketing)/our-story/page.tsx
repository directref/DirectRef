import type { Metadata } from 'next';
import Image from 'next/image';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { mkt } from '../tokens';

const description =
  'Meet the founders of DirectRef and learn why we built a platform that connects job seekers directly with verified employees at top tech companies.';

export const metadata: Metadata = {
  title: 'Our Story: DirectRef',
  description,
  alternates: { canonical: '/our-story' },
  openGraph: {
    title: 'Our Story: DirectRef',
    description,
    url: '/our-story',
    siteName: 'DirectRef',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Our Story: DirectRef',
    description,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Our Story: DirectRef',
  description,
  url: 'https://direct-ref.com/our-story',
};

const founders = [
  { name: 'Shai Atar', title: 'Co-Founder, DirectRef', linkedin: 'https://www.linkedin.com/in/shai-atar/', photo: '/founders/shai-atar.jpg' },
  { name: 'Anat Atar Lachmish', title: 'Co-Founder, DirectRef', linkedin: 'https://www.linkedin.com/in/anat-atar-lachmish-a07690b7/', photo: '/founders/anat-atar-lachmish.jpg' },
];

export default function OurStoryPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingHeader variant="sub" />

      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>Our story</p>
        <h1 className="mt-3 text-[32px] font-bold leading-tight">We did not set out to build a job board.</h1>

        <div className="mt-7 space-y-5 text-[15px] leading-relaxed" style={{ color: mkt.textSecondary }}>
          <p>
            Hi! We&apos;re Anat and Shai, a married tech couple who found ourselves unexpectedly laid off in the summer of 2026 amid a massive shift in the tech market. Armed with technical know-how, extra time on our hands, and the shared anxiety of job hunting, we dove headfirst into applying for roles online. Like so many of you, we quickly realized how broken standard job boards can be: sending resumes into black holes, competing against thousands of applicants, and hoping a screening algorithm takes mercy on our CVs.
          </p>
          <p>
            We knew there had to be a better way. In tech, direct employee referrals are universally known as the gold standard for hiring. Employers love them, and employees get referral bonuses for bringing in great talent. Yet, the process of finding an insider to submit your CV was tedious and hit-or-miss. So, we built DirectRef to bridge that gap. We created a win-win platform where company insiders can publish open roles and job seekers can connect directly with them to tap into internal referral programs. Built by job hunters, for job hunters, DirectRef is our way of helping our community cut through the noise and get hired.
          </p>
        </div>

        <h2 className="mt-14 text-[20px] font-semibold">The founders</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {founders.map((founder) => (
            <a
              key={founder.name}
              href={founder.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl p-6 flex flex-col items-center text-center gap-1"
              style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}` }}
            >
              <Image
                src={founder.photo}
                alt={founder.name}
                width={96}
                height={96}
                className="w-24 h-24 rounded-full object-cover"
              />
              <p className="mt-4 text-[16.5px] font-semibold" style={{ color: mkt.textPrimary }}>{founder.name}</p>
              <p className="mt-1.5 text-[13.5px]" style={{ color: mkt.textSecondary }}>{founder.title}</p>
              <span className="mt-4 inline-block text-[13px] font-medium" style={{ color: mkt.accentReferral, borderBottom: `1px solid ${mkt.accentReferral}` }}>
                LinkedIn
              </span>
            </a>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </>
  );
}
