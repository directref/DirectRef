import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { LegalLayout, LegalH2, LegalH3, LegalP, LegalUl, LegalLi, LegalStrong, LegalCallout } from '@/components/marketing/LegalLayout';
import { mkt } from '../tokens';

const description =
  'How DirectRef collects, uses, stores and deletes your personal data, including your CV, and exactly who it is shared with.';

export const metadata: Metadata = {
  title: 'Privacy Policy: DirectRef',
  description,
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy: DirectRef',
    description,
    url: '/privacy',
    siteName: 'DirectRef',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy: DirectRef',
    description,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Privacy Policy: DirectRef',
  description,
  url: 'https://direct-ref.com/privacy',
};

const toc = [
  { id: 's1', label: '1. Who we are' },
  { id: 's2', label: '2. What DirectRef does' },
  { id: 's3', label: '3. What we collect' },
  { id: 's4', label: "4. If you don't provide it" },
  { id: 's5', label: '5. Why & legal basis' },
  { id: 's6', label: '6. Who your data is shared with' },
  { id: 's7', label: '7. International transfers' },
  { id: 's8', label: '8. How long we keep it' },
  { id: 's9', label: '9. Cookies' },
  { id: 's10', label: '10. Security' },
  { id: 's11', label: '11. Your rights' },
  { id: 's12', label: '12. Automated decisions' },
  { id: 's13', label: '13. Children' },
  { id: 's14', label: '14. Data Protection Officer' },
  { id: 's15', label: '15. Changes to this policy' },
  { id: 's16', label: '16. Contact' },
];

const thClass = 'text-left py-2.5 px-3 text-[12px] uppercase tracking-[0.05em]';
const tdClass = 'py-2.5 px-3';
const trBorder = { borderBottom: `1px solid ${mkt.border}` };
const thStyle = { borderBottom: `2px solid ${mkt.accentSeeker}`, color: mkt.textPrimary };
const linkStyle = { color: mkt.accentSeeker, borderBottom: `1px solid ${mkt.accentSeeker}` };

const collected: [string, string, string][] = [
  ['Name, email, password (hashed)', 'Sign-up', 'To create and secure your account'],
  ['Google account profile', 'Google sign-in', 'To authenticate you without a separate password'],
  ['Work email address at a company', 'Before posting a role', 'To verify a referrer controls an address at the company they post for'],
  ['Employer name and job title', 'Referrer profile / posting', 'Shown to signed-in seekers on listings'],
  ['Profile picture / avatar', 'Optional', 'Displayed on your profile'],
  ['Your CV file', 'Uploaded to your profile, and copied per application', 'Sent to the referrer you choose; the core of the service'],
  ['Cover note', 'Each application', 'Sent to the referrer with your CV'],
  ['Messages you send', 'Messaging about an application', 'Delivered to the other party'],
  ['Job listing content', 'Referrer posts a role', 'Displayed to signed-in seekers'],
  ['Profile preferences', 'Optional, Settings', 'Powers "Suggested for you": a saved search, no ranking algorithm'],
  ['Saved jobs', 'When you save a role', 'Shown in your Saved tab'],
];

const processors: [string, string, string][] = [
  ['Railway', 'Application hosting, the primary database, and CV file storage', 'EU (europe-west4)'],
  ['Vercel', 'Website and app front-end hosting', 'Global edge network'],
  ['Cloudflare', 'DNS, network protection, and email routing', 'Global edge network'],
  ['Resend', 'Transactional email', 'US / EU'],
  ['Google', '"Sign in with Google" authentication', 'US'],
];

const retention: [string, string][] = [
  ['Live applications and their CVs', 'Kept for as long as the application is open. Nothing active is ever deleted.'],
  ['Closed applications, with their CV copy, cover note and messages', 'Erased after 30 consecutive days with no activity on the application'],
  ['The CV on your profile', 'Kept until you replace it, remove it, or delete your account'],
  ['Account profile, preferences, saved jobs', 'For as long as your account is open'],
  ['Credit ledger', 'For as long as your account is open'],
  ['Job listings', 'While active, plus 30 days after being deactivated'],
  ['Security and access logs', '12 months'],
];

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingHeader variant="sub" />

      <LegalLayout title="Privacy Policy" effectiveDate="Effective 11 September 2026 · Last updated 11 September 2026" toc={toc}>
        <LegalH2 id="s1">1. Who we are</LegalH2>
        <LegalP>DirectRef (&quot;DirectRef&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a cross-company referral marketplace operated by <LegalStrong>Shai Atar and Anat Atar Lachmish</LegalStrong>, jointly, as private individuals in Israel. DirectRef is not currently incorporated.</LegalP>
        <LegalP>We are the controller of the personal data described in this policy, meaning we decide why and how it is processed.</LegalP>
        <LegalP>Contact for anything in this policy, including to exercise your rights: <a href="mailto:support@direct-ref.com" style={linkStyle}>support@direct-ref.com</a></LegalP>

        <LegalH2 id="s2">2. What DirectRef does, and why that matters for your data</LegalH2>
        <LegalP>DirectRef connects two kinds of people:</LegalP>
        <LegalUl>
          <LegalLi><LegalStrong>Seekers</LegalStrong>: people looking for a job, who send their CV to a specific person at a hiring company.</LegalLi>
          <LegalLi><LegalStrong>Referrers</LegalStrong>: people employed at a hiring company, who post an open role and decide whether to refer a seeker internally.</LegalLi>
        </LegalUl>
        <LegalCallout>
          When you apply to a role as a seeker, you are deliberately sending your CV, your cover note and your name to a named individual at another company. Once a referrer forwards it into their employer&apos;s hiring process, your CV is in that employer&apos;s hands and this policy no longer governs what they do with it.
        </LegalCallout>
        <LegalP>We tell you who that person is before you apply. You choose them. <LegalStrong>You are never matched to a referrer you did not see, and your application is never passed to anyone else.</LegalStrong> If your referrer never answers, the application closes and we tell you. It is not reassigned.</LegalP>

        <LegalH2 id="s3">3. What we collect</LegalH2>
        <LegalH3>3.1 Information you give us</LegalH3>
        <div className="overflow-x-auto mb-5">
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr>
                <th className={thClass} style={thStyle}>Data</th>
                <th className={thClass} style={thStyle}>When</th>
                <th className={thClass} style={thStyle}>Why we need it</th>
              </tr>
            </thead>
            <tbody>
              {collected.map(([data, when, why], i, arr) => (
                <tr key={data} style={i < arr.length - 1 ? trBorder : undefined}>
                  <td className={`${tdClass} font-medium`} style={{ color: mkt.textPrimary }}>{data}</td>
                  <td className={tdClass} style={{ color: mkt.textSecondary }}>{when}</td>
                  <td className={tdClass} style={{ color: mkt.textSecondary }}>{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <LegalH3>3.2 Information we generate</LegalH3>
        <LegalUl>
          <LegalLi><LegalStrong>Application records</LegalStrong>: which role, which referrer, when you applied, the decision, and the timestamps of every step in the response clocks.</LegalLi>
          <LegalLi><LegalStrong>Credit balance and credit ledger</LegalStrong>: how many credits you hold and each grant and deduction. Credits are spent by referrers to post roles; applying costs nothing.</LegalLi>
          <LegalLi><LegalStrong>Notification records</LegalStrong>: what we sent you.</LegalLi>
        </LegalUl>

        <LegalH3>3.3 Information collected automatically</LegalH3>
        <LegalUl>
          <LegalLi>IP address, browser and device type, and operating system.</LegalLi>
          <LegalLi>Access and security logs: sign-in attempts, timestamps, and requests to our API.</LegalLi>
          <LegalLi>A strictly necessary cookie holding your sign-in session. See §9.</LegalLi>
        </LegalUl>
        <LegalP>We do not currently run any product analytics, session replay, or third-party crash reporting. If we add any, we will update this policy under §15 first.</LegalP>

        <LegalH3>3.4 What we do not collect</LegalH3>
        <LegalP>We do not ask for and do not want: your national ID number, bank details, payment card numbers, health information, biometric data, political or religious affiliation, or trade union membership. <LegalStrong>DirectRef takes no payments at all, so no payment data is collected anywhere on the Service.</LegalStrong></LegalP>
        <LegalP>If you volunteer sensitive information inside your CV or a message, we process it because it is inside a document you chose to send, but we do not ask for it, do not index it, and do not use it for anything other than delivering it to the referrer you selected.</LegalP>

        <LegalH2 id="s4">4. What happens if you don&apos;t provide it</LegalH2>
        <LegalP>Israeli law requires us to tell you the consequences of declining to give us data. Plainly:</LegalP>
        <LegalUl>
          <LegalLi><LegalStrong>Email and password (or Google login):</LegalStrong> required. No account without them.</LegalLi>
          <LegalLi><LegalStrong>CV file:</LegalStrong> required to apply for a role. You can browse without one.</LegalLi>
          <LegalLi><LegalStrong>A work email at the company (referrers):</LegalStrong> required to post a role.</LegalLi>
          <LegalLi><LegalStrong>Profile preferences, avatar, saved jobs:</LegalStrong> entirely optional.</LegalLi>
        </LegalUl>

        <LegalH2 id="s5">5. Why we process your data, and on what legal basis</LegalH2>
        <LegalP>We process data to run and secure your account, deliver applications to the referrer you chose, run the response clocks, send transactional notifications, manage credits, prevent fraud, improve the product, and meet legal obligations, resting on your consent, contract performance, our legitimate interests, or a legal obligation, as applicable under Israeli law and GDPR where it applies.</LegalP>
        <LegalP><LegalStrong>We do not sell your personal data. We do not share it with advertisers. We do not use your CV to train machine learning models. We are not a data broker.</LegalStrong></LegalP>

        <LegalH2 id="s6">6. Who your data is shared with</LegalH2>
        <LegalH3>6.1 Other DirectRef users</LegalH3>
        <LegalUl>
          <LegalLi>The referrer you choose receives your name, your CV file, your cover note, and any messages you send about that application. They can download your CV.</LegalLi>
          <LegalLi>A seeker who applies to your role sees your name, your employer, your job title and your public profile.</LegalLi>
          <LegalLi>Job listings are visible to signed-in users and include the referrer&apos;s name and company.</LegalLi>
          <LegalLi>A small sample of live listings, showing <LegalStrong>job title, company, location and job type only</LegalStrong>, is shown on our public home page. It never includes the referrer&apos;s name or any seeker&apos;s data.</LegalLi>
        </LegalUl>

        <LegalH3>6.2 Service providers who process data on our behalf</LegalH3>
        <LegalP>We use third parties to run the service, each bound by contract to process data only on our instructions:</LegalP>
        <div className="overflow-x-auto mb-5">
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr>
                <th className={thClass} style={thStyle}>Provider</th>
                <th className={thClass} style={thStyle}>What it handles</th>
                <th className={thClass} style={thStyle}>Where</th>
              </tr>
            </thead>
            <tbody>
              {processors.map(([provider, what, where], i, arr) => (
                <tr key={provider} style={i < arr.length - 1 ? trBorder : undefined}>
                  <td className={`${tdClass} font-medium`} style={{ color: mkt.textPrimary }}>{provider}</td>
                  <td className={tdClass} style={{ color: mkt.textSecondary }}>{what}</td>
                  <td className={tdClass} style={{ color: mkt.textSecondary }}>{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <LegalH3>6.3 Everyone else</LegalH3>
        <LegalP>We disclose personal data outside the above only where we are legally required to (a court order, a lawful demand from a competent authority, or to establish, exercise or defend a legal claim), or where strictly necessary to protect the safety or rights of a person.</LegalP>
        <LegalP>If DirectRef is ever acquired, merged, or transferred to a company we incorporate to operate it, personal data may transfer with it. We will notify you beforehand and you will be able to delete your account first.</LegalP>

        <LegalH2 id="s7">7. International transfers</LegalH2>
        <LegalP>We are based in Israel. Several of our providers are in the United States and the European Union, so your data is transferred outside Israel.</LegalP>
        <LegalUl>
          <LegalLi>Israel benefits from a European Commission adequacy decision, so transfers from the EU to DirectRef in Israel are permitted without additional safeguards.</LegalLi>
          <LegalLi>For transfers to providers outside Israel and the EU, we rely on EU Standard Contractual Clauses or an equivalent adequacy finding.</LegalLi>
        </LegalUl>

        <LegalH2 id="s8">8. How long we keep it</LegalH2>
        <LegalCallout>
          The rule in one line: <LegalStrong>nothing active is ever deleted.</LegalStrong> An application that is still open stays, however long it takes. Once it closes, it is erased after 30 consecutive days with no activity, and &quot;activity&quot; includes a message sent on it.
        </LegalCallout>
        <div className="overflow-x-auto mb-5">
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr>
                <th className={thClass} style={thStyle}>Data</th>
                <th className={thClass} style={thStyle}>Retention</th>
              </tr>
            </thead>
            <tbody>
              {retention.map(([data, keep], i, arr) => (
                <tr key={data} style={i < arr.length - 1 ? trBorder : undefined}>
                  <td className={`${tdClass} font-medium`} style={{ color: mkt.textPrimary }}>{data}</td>
                  <td className={tdClass} style={{ color: mkt.textSecondary }}>{keep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LegalP>Each application carries its own copy of the CV that was sent with it, so a CV you later replace on your profile does not change what a referrer already received. That copy is erased with the application.</LegalP>
        <LegalP><LegalStrong>When you delete your account, we delete your personal data, including every CV file you have uploaded.</LegalStrong> The only exception is anything under a legal hold. Backups are purged on their own rotation, within 30 days.</LegalP>
        <LegalP>Deleting your account does not retract a CV a referrer has already downloaded or forwarded to their employer. If you want a CV removed from a company&apos;s hiring process, you have to ask that company.</LegalP>

        <LegalH2 id="s9">9. Cookies</LegalH2>
        <LegalP>We use <LegalStrong>strictly necessary cookies only</LegalStrong>: your authentication session and CSRF protection. No consent is required for these, and you cannot turn them off while using the service.</LegalP>
        <LegalP>We do not use advertising cookies, cross-site tracking, or analytics cookies. There is no cookie banner because there is nothing optional to consent to. If that changes, we will ask you before setting anything new.</LegalP>

        <LegalH2 id="s10">10. Security</LegalH2>
        <LegalUl>
          <LegalLi>All traffic is encrypted in transit with TLS.</LegalLi>
          <LegalLi>CV files are stored on our application host&apos;s server storage, outside the public web root. They are never served as static files and cannot be reached by guessing a URL.</LegalLi>
          <LegalLi><LegalStrong>Every request for a CV is authorisation-checked.</LegalStrong> Only the seeker who uploaded it and the referrer assigned to that application can retrieve it; anyone else gets a refusal.</LegalLi>
          <LegalLi>Passwords are stored hashed and salted. We never see your password.</LegalLi>
          <LegalLi>Access to production systems is limited to the two founders.</LegalLi>
        </LegalUl>
        <LegalP>No system is perfectly secure, and we won&apos;t claim otherwise. DirectRef is in beta, run by two people. If a breach occurs that is likely to harm you, we will notify you and the Privacy Protection Authority as required under Amendment 13 to the Privacy Protection Law, without undue delay.</LegalP>

        <LegalH2 id="s11">11. Your rights</LegalH2>
        <LegalP>You may:</LegalP>
        <LegalUl>
          <LegalLi><LegalStrong>Access</LegalStrong> the personal data we hold about you.</LegalLi>
          <LegalLi><LegalStrong>Correct</LegalStrong> it if it is wrong, incomplete or out of date. Most of it you can edit yourself in Settings.</LegalLi>
          <LegalLi><LegalStrong>Delete</LegalStrong> your account and your data, from Settings. Immediately, yourself, including every CV file you have uploaded. Or email us and we will do it for you.</LegalLi>
          <LegalLi><LegalStrong>Export</LegalStrong> a copy of your data in a portable format. Email us and we will send it within 30 days.</LegalLi>
          <LegalLi><LegalStrong>Object to or restrict</LegalStrong> processing based on legitimate interests.</LegalLi>
          <LegalLi><LegalStrong>Withdraw consent</LegalStrong> at any time, without affecting anything done before you withdrew it.</LegalLi>
          <LegalLi><LegalStrong>Opt out of marketing email</LegalStrong> in one click. You cannot opt out of transactional email.</LegalLi>
        </LegalUl>
        <LegalP>To exercise any of these, email <a href="mailto:support@direct-ref.com" style={linkStyle}>support@direct-ref.com</a>. We will respond within 30 days. We may ask you to confirm your identity first, so that we don&apos;t hand your CV to someone impersonating you.</LegalP>
        <LegalP><LegalStrong>Complaints.</LegalStrong> If you think we&apos;ve handled your data badly, tell us first. We would rather fix it. You also have the right to complain to the Israeli Privacy Protection Authority (ppa.gov.il). If you are in the EU or UK, you may complain to your local supervisory authority.</LegalP>

        <LegalH2 id="s12">12. Automated decision-making</LegalH2>
        <LegalP>We do not make automated decisions that produce legal or similarly significant effects about you.</LegalP>
        <LegalP>Specifically: there is no matching algorithm, no compatibility score, and no ranking of candidates. &quot;Suggested for you&quot; is a saved search that runs the same filters you set yourself. <LegalStrong>Every decision about whether to refer you is made by a human being.</LegalStrong></LegalP>
        <LegalP>The only automated actions in the system are the response-clock mechanics in the <a href="/terms" style={linkStyle}>Terms</a> (reminders to your referrer, and closing the application and telling you if they never answer) and the retention rule in §8. These are published, fixed rules, not judgements about you.</LegalP>

        <LegalH2 id="s13">13. Children</LegalH2>
        <LegalP>DirectRef is for people aged 18 and over. We do not knowingly collect data from anyone under 18. If we discover that we have, we delete the account and its data. If you believe a minor has an account, email us.</LegalP>

        <LegalH2 id="s14">14. Data Protection Officer</LegalH2>
        <LegalP>Based on the volume and nature of the data we process, we are not currently required to appoint a Data Protection Officer under Amendment 13 to the Privacy Protection Law. Privacy questions are handled by Shai Atar at <a href="mailto:support@direct-ref.com" style={linkStyle}>support@direct-ref.com</a>.</LegalP>

        <LegalH2 id="s15">15. Changes to this policy</LegalH2>
        <LegalP>If we change this policy in a way that materially affects your rights or how we use your data, we will email you and show a notice in the app at least 14 days before it takes effect. Minor clarifications take effect on publication. The effective date at the top always tells you which version you&apos;re reading, and we keep previous versions available on request.</LegalP>

        <LegalH2 id="s16">16. Contact</LegalH2>
        <LegalP>Shai Atar and Anat Atar Lachmish, Israel</LegalP>
        <LegalP><a href="mailto:support@direct-ref.com" style={linkStyle}>support@direct-ref.com</a></LegalP>
      </LegalLayout>

      <MarketingFooter />
    </>
  );
}
