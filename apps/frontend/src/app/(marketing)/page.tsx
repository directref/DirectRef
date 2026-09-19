import Link from 'next/link';
import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { mkt } from './tokens';
import { API_BASE } from '@/lib/constants';

const description =
  'Skip the black hole of job boards. DirectRef connects you directly with real employees at top tech companies who can refer you internally.';

export const metadata: Metadata = {
  title: 'DirectRef: Get Referred by Tech Insiders',
  description,
  alternates: { canonical: '/' },
  openGraph: {
    title: 'DirectRef: Get Referred by Tech Insiders',
    description,
    url: '/',
    siteName: 'DirectRef',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DirectRef: Get Referred by Tech Insiders',
    description,
  },
};

const seekerPoints = [
  'Get your resume directly to hiring managers without relying on job portals.',
  'Connect with employees inside target companies who can champion your profile.',
  'Get full visibility as your CV is delivered directly into the internal referral portal.',
];

const referrerPoints = [
  'Help qualified peers land roles at your company by vouching for talent you trust.',
  'Open doors for skilled professionals using your insider network.',
  'Earn referral bonuses when the people you refer get hired.',
];

const phases = [
  {
    label: 'Phase 1 · Getting a decision',
    clock: 'Up to 5 days',
    steps: [
      { eyebrow: 'Submitted', title: 'You send one CV', desc: 'One CV, one short note, sent to a named person inside the company. No long form to fill out.' },
      { eyebrow: 'Viewed', title: 'Your referrer reads it', desc: 'You are notified the moment someone inside the company actually opens your CV.' },
    ],
    close: 'Your referrer has to answer: refer, or "Not a fit." We send a reminder on day 1 and a follow-up on day 2 — if they still haven’t answered, we close the application on day 5 and let you know.',
  },
  {
    label: 'Phase 2 · Getting it submitted',
    clock: null,
    steps: [
      { eyebrow: 'Downloaded', title: 'Your referrer downloads it', desc: "The referrer downloads your CV to submit it through their company's internal referral program." },
      { eyebrow: 'With HR', title: "It lands on the recruiter's desk", desc: "Your CV is in the hands of the hiring team. From here it's their call: if you fit the role, they contact you directly." },
    ],
    close: 'We chase the confirmation for you. Two days after the download we remind your referrer to put your CV through their internal process and mark it submitted here. If that confirmation never comes, we close the application and tell you.',
  },
];

const declinedStep = {
  eyebrow: 'Declined',
  title: 'Or you get a straight no',
  desc: 'If the referrer passes or HR says no, we tell you that too. A clear no beats days of refreshing an empty inbox.',
};

interface SampleJob {
  title: string;
  companyName: string;
  location: string | null;
  jobType: string | null;
}

/** Live sample for the teaser. Returns [] on any failure or when nothing is
 *  live — the section hides itself rather than inventing listings. */
async function getSampleJobs(): Promise<SampleJob[]> {
  try {
    const res = await fetch(`${API_BASE}/api/jobs/sample`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}


const doPoints = [
  'Put your CV in the hands of a real employee inside the company.',
  'Get it submitted through their internal referral program, onto the recruiter’s desk.',
  'Notify you at every step: submitted, viewed, downloaded, or declined.',
  'Chase your referrer on a fixed clock, and close the application and tell you if they never answer.',
];

const dontPoints = [
  'Guarantee an interview. The employer reads your CV and decides.',
  'Guarantee a job offer, or influence the hiring decision in any way.',
  'Promise every referrer will take your request. Some will decline, and you’ll be told.',
  'Rewrite, score, or filter your CV. It goes across exactly as you sent it.',
];

const faqItems = [
  {
    q: "What's a referral, and why does it matter?",
    a: "A referral means someone already inside the company vouches to submit your CV internally. It usually moves your application past the résumé pile and straight to a recruiter's inbox.",
  },
  {
    q: 'Do I have to pay to use DirectRef?',
    a: "Not if you're looking for a job. Applying is free, with no limit on how many roles you apply to. Referrers spend one credit to post a role; everyone gets 5 credits when they join and 1 more each month, and they never expire. There's currently no way to buy credits.",
  },
  {
    q: 'Why does posting a role cost a credit?',
    a: 'To keep listings deliberate. One credit, one position. It costs a referrer something to put a role up, so the board stays real rather than filling with copy-pasted listings nobody intends to follow through on.',
  },
  {
    q: "What if I don't know anyone at the company?",
    a: "That's the point. You don't need to. Sign in, browse the open roles, and apply to the one you want. The person who posted it is the person who gets your CV.",
  },
  {
    q: 'What happens if nobody responds?',
    a: "We chase them: a reminder on day 1, a firmer one on day 2. If your referrer still hasn't answered by day 5 we close the application and tell you. You'll never be left refreshing an inbox. Applying is free and unlimited, so you can send your CV to another role, or another person at the same company, straight away.",
  },
  {
    q: 'Who can see my CV?',
    a: 'Only the referrer you chose. Not the company, not other users, not us for anything beyond delivering it. Once your referrer forwards it into their company\u2019s hiring process it\u2019s in that company\u2019s hands, and their rules apply from there.',
  },
  {
    q: 'Is this only for tech roles?',
    a: "No, it depends on what our community brings to the platform. But we're starting with high-tech roles, since that's where our first community lives. More industries can follow.",
  },
  {
    q: 'What do referrers get out of it?',
    a: 'Referrers help people they believe in get a real shot, and most companies pay out a referral bonus when their referral gets hired. Posting a role costs one credit, and everyone gets 5 to start plus 1 a month.',
  },
];

const trustPoints = [
  {
    title: 'Who sees your CV',
    desc: 'Only the referrer you chose. Not the company, not other users, not us for anything beyond delivering it.',
  },
  {
    title: 'What we verify',
    desc: "Every referrer confirms an email at the company's own domain before they can post a role. That proves they can receive mail there. It doesn't prove they'll still work there next month, and we say so in the terms.",
  },
  {
    title: "After it's forwarded",
    desc: "Once your CV goes into a company's hiring process, that company's rules apply and we can't pull it back.",
  },
  {
    title: 'Deleting it',
    desc: 'Delete your account from Settings and every CV you uploaded goes with it. Closed applications, their CV and their messages are erased after 30 days of inactivity.',
  },
];

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'DirectRef',
    url: 'https://direct-ref.com',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DirectRef',
    url: 'https://direct-ref.com',
  },
];

export default async function LandingPage() {
  const sampleJobs = await getSampleJobs();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingHeader variant="home" />

      {/* HERO */}
      <section className="border-b" style={{ borderColor: mkt.border }}>
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.15fr_1fr] lg:py-20 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>
              Referral-first job network
            </p>
            <h1 className="mt-5 text-[38px] sm:text-[48px] leading-[1.08] font-extrabold tracking-[-0.02em] text-balance">
              Get referred from the inside.
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed" style={{ color: mkt.textSecondary }}>
              Send your CV to a named person inside the company, and find out exactly what happened to it. No black hole, no silence.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-[10px] text-[14px] font-semibold"
                style={{ background: mkt.accentSeeker, color: '#1a1206', padding: '13px 22px' }}
              >
                Find a referral →
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-[10px] text-[14px] font-medium"
                style={{ border: `1px solid ${mkt.borderStrong}`, color: mkt.textPrimary, padding: '12.5px 22px' }}
              >
                Refer someone
              </Link>
            </div>
            <p className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]" style={{ color: mkt.textMuted }}>
              <span>Free for job seekers</span>
              <span>Referrers verify a work email</span>
              <span>You always hear back</span>
            </p>
          </div>

          {/* Illustrative application-status schematic — not a screenshot, not real data */}
          <div className="rounded-2xl p-5 self-start" style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}` }}>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>
              Your applications (schematic)
            </p>
            <div className="space-y-3">
              <div className="rounded-xl p-3.5" style={{ border: `1px solid ${mkt.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold" style={{ color: mkt.textPrimary }}>Frontend Engineer</span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap"
                    style={{ background: mkt.statusWarnBg, color: mkt.statusWarnText }}
                  >
                    Submitted
                  </span>
                </div>
                <p className="mt-1 text-[12.5px]" style={{ color: mkt.textMuted }}>Series C fintech · via John Doe</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: mkt.border }}>
                  <div className="h-full rounded-full" style={{ width: '38%', background: mkt.accentSeeker }} />
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: mkt.textMuted }}>Day 2 of 5 · reminder sent</p>
              </div>
              <div className="rounded-xl p-3.5" style={{ border: `1px solid ${mkt.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold" style={{ color: mkt.textPrimary }}>Frontend Engineer</span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap"
                    style={{ background: mkt.statusGoodBg, color: mkt.statusGoodText }}
                  >
                    Downloaded
                  </span>
                </div>
                <p className="mt-1 text-[12.5px]" style={{ color: mkt.textMuted }}>Series B cybersecurity · via Jane Doe</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM STATEMENT */}
      <section className="border-b" style={{ borderColor: mkt.border }}>
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>If you are job hunting</p>
            <h2 className="mt-3 text-[22px] font-bold leading-snug">
              Applying today feels like <span style={{ color: mkt.accentSeeker }}>shouting into a void</span>.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: mkt.textSecondary }}>
              You press Easy Apply, your CV lands in a queue with <span className="font-semibold" style={{ color: mkt.textPrimary }}>hundreds of others</span>, and nothing comes back. Not a no. Not a maybe. Just weeks of refreshing an inbox for a message nobody intends to send.
            </p>
          </div>
          <div className="md:pl-10" style={{ borderColor: mkt.border }}>
            <div className="md:border-l md:pl-10" style={{ borderColor: mkt.border }}>
              <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>If you work somewhere hiring</p>
              <h2 className="mt-3 text-[22px] font-bold leading-snug">
                You have a <span style={{ color: mkt.accentSeeker }}>bonus to claim</span> and nobody left to refer.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: mkt.textSecondary }}>
                You post the link to LinkedIn, a dozen people like it, <span className="font-semibold" style={{ color: mkt.textPrimary }}>none of them are looking</span>. The candidates worth referring are somewhere you can't reach.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE SPLIT */}
      <section id="audiences" className="max-w-6xl mx-auto px-5 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-2xl p-7 flex flex-col gap-3.5" style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}` }}>
            <p className="text-[17px] font-semibold" style={{ color: mkt.textPrimary }}>For seekers</p>
            <div className="flex flex-col gap-3">
              {seekerPoints.map((pt) => (
                <div key={pt} className="flex gap-3 items-start">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: mkt.accentSeeker }} />
                  <p className="text-[13.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>{pt}</p>
                </div>
              ))}
            </div>
            <Link href="/login" className="self-start mt-1 text-[14px] font-semibold" style={{ color: mkt.accentSeeker }}>
              Find a referral →
            </Link>
          </div>

          <div className="rounded-2xl p-7 flex flex-col gap-3.5" style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}` }}>
            <p className="text-[17px] font-semibold" style={{ color: mkt.textPrimary }}>For referrers</p>
            <div className="flex flex-col gap-3">
              {referrerPoints.map((pt) => (
                <div key={pt} className="flex gap-3 items-start">
                  <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: mkt.accentReferral }} />
                  <p className="text-[13.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>{pt}</p>
                </div>
              ))}
            </div>
            <Link href="/login" className="self-start mt-1 text-[14px] font-semibold" style={{ color: mkt.textPrimary }}>
              Refer someone →
            </Link>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — two clocks, named */}
      <section id="how" className="border-b" style={{ borderColor: mkt.border }}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>How it works</p>
          <h2 className="mt-3 text-[26px] font-bold">You see every step your CV takes.</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: mkt.textSecondary }}>
            Every status change is a notification. Your application runs on two clocks: one to get you a decision, one to get that decision acted on. You are told where it stands at the end of each.
          </p>

          <div className="mt-10 flex flex-col gap-10">
            {phases.map((phase) => (
              <div key={phase.label} className="max-w-2xl">
                <div className="flex flex-wrap items-baseline gap-3">
                  <p className="text-[15px] font-semibold" style={{ color: mkt.textPrimary }}>{phase.label}</p>
                  {phase.clock && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[12px] font-medium"
                      style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}`, color: mkt.textMuted }}
                    >
                      {phase.clock}
                    </span>
                  )}
                </div>
                <ol className="mt-5" style={{ borderLeft: `1px solid ${mkt.border}` }}>
                  {phase.steps.map((step) => (
                    <li key={step.title} className="relative pb-7 pl-8">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: mkt.accentSeeker }} />
                      <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>{step.eyebrow}</p>
                      <p className="mt-1 text-[17px] font-semibold" style={{ color: mkt.textPrimary }}>{step.title}</p>
                      <p className="mt-1 text-[14px]" style={{ color: mkt.textSecondary }}>{step.desc}</p>
                    </li>
                  ))}
                </ol>
                <p className="pl-8 text-[13.5px] leading-relaxed" style={{ color: mkt.textMuted }}>{phase.close}</p>
              </div>
            ))}

            <div className="max-w-2xl">
              <ol style={{ borderLeft: `1px solid ${mkt.border}` }}>
                <li className="relative pl-8">
                  <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: mkt.borderStrong }} />
                  <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>{declinedStep.eyebrow}</p>
                  <p className="mt-1 text-[17px] font-semibold" style={{ color: mkt.textPrimary }}>{declinedStep.title}</p>
                  <p className="mt-1 text-[14px]" style={{ color: mkt.textSecondary }}>{declinedStep.desc}</p>
                </li>
              </ol>
            </div>
          </div>

          <p className="mt-8 max-w-2xl text-[13.5px]" style={{ color: mkt.textMuted }}>
            Messaging pauses the clock. An active conversation is the system working, not failing.
          </p>
        </div>
      </section>

      {/* LIVE POSITIONS TEASER — real listings only; hidden when nothing is live */}
      {sampleJobs.length > 0 && (
        <section id="positions" className="max-w-6xl mx-auto px-5 py-16">
          <div className="flex items-baseline justify-between mb-8 flex-wrap gap-3">
            <div>
              <h2 className="text-[26px] font-bold">Roles with a way in, right now</h2>
              <p className="mt-2 text-[15px]" style={{ color: mkt.textSecondary }}>A sample of what&apos;s live on DirectRef today.</p>
            </div>
            <Link href="/login" className="font-semibold text-[14px] whitespace-nowrap" style={{ color: mkt.accentSeeker }}>
              Sign in to browse →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sampleJobs.map((job) => (
              <div key={`${job.title}-${job.companyName}`} className="rounded-2xl p-6 flex flex-col gap-3.5" style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}` }}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold mb-1" style={{ color: mkt.textPrimary }}>{job.title}</h3>
                    <p className="text-[13px]" style={{ color: mkt.textSecondary }}>
                      {[job.companyName, job.location].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {job.jobType && (
                    <span
                      className="text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ color: mkt.textMuted, background: mkt.bg, border: `1px solid ${mkt.border}` }}
                    >
                      {job.jobType}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TRUST */}
      <section id="trust" className="border-b" style={{ borderColor: mkt.border }}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>Your CV</p>
          <h2 className="mt-3 text-[26px] font-bold">Where it goes, and who we check.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {trustPoints.map((pt) => (
              <div key={pt.title} className="rounded-2xl p-6" style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}` }}>
                <p className="text-[15px] font-semibold" style={{ color: mkt.textPrimary }}>{pt.title}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>{pt.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLAINLY */}
      <section className="border-b" style={{ borderColor: mkt.border }}>
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.09em]" style={{ color: mkt.textMuted }}>Plainly</p>
          <h2 className="mt-3 text-[26px] font-bold">What we do, and what we do not.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl p-6" style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}` }}>
              <p className="text-xs font-semibold" style={{ color: mkt.accentSeeker }}>What we do</p>
              <ul className="mt-4 flex flex-col gap-3">
                {doPoints.map((pt) => (
                  <li key={pt} className="flex gap-3 text-[13.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: mkt.accentSeeker }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl p-6" style={{ background: mkt.cardBg, border: `1px solid ${mkt.border}` }}>
              <p className="text-xs font-semibold" style={{ color: mkt.textMuted }}>What we do not</p>
              <ul className="mt-4 flex flex-col gap-3">
                {dontPoints.map((pt) => (
                  <li key={pt} className="flex gap-3 text-[13.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: mkt.borderStrong }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Q&A */}
      <section id="faq" className="max-w-3xl mx-auto px-5 pt-16 pb-16">
        <h2 className="text-[26px] font-bold mb-8 text-center">Q&amp;A</h2>
        <FaqAccordion items={faqItems} />
      </section>

      {/* CLOSING CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h2 className="text-[26px] sm:text-[28px] font-bold leading-tight">One CV. A real person. Onto the recruiter's desk.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed" style={{ color: mkt.textSecondary }}>
            We will not promise you an interview. We will make sure your CV is actually read by the people who decide, and tell you exactly where it stands.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="rounded-[10px] text-[14px] font-semibold"
              style={{ background: mkt.accentSeeker, color: '#1a1206', padding: '13px 22px' }}
            >
              Get referred for free
            </Link>
            <Link
              href="/login"
              className="rounded-[10px] text-[14px] font-medium"
              style={{ border: `1px solid ${mkt.borderStrong}`, color: mkt.textPrimary, padding: '12.5px 22px' }}
            >
              Post a role at your company
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}
