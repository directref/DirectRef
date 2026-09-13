import type { Metadata } from 'next';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { LegalLayout, LegalH2, LegalH3, LegalP, LegalUl, LegalLi, LegalStrong } from '@/components/marketing/LegalLayout';
import { mkt } from '../tokens';

const description =
  'Read the terms governing your use of DirectRef, the platform connecting job seekers with employee referrers at tech companies.';

export const metadata: Metadata = {
  title: 'Terms of Service: DirectRef',
  description,
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service: DirectRef',
    description,
    url: '/terms',
    siteName: 'DirectRef',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service: DirectRef',
    description,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Terms of Service: DirectRef',
  description,
  url: 'https://direct-ref.com/terms',
};

const toc = [
  { id: 'short', label: 'The short version' },
  { id: 's1', label: "1. Who you're contracting with" },
  { id: 's2', label: '2. Eligibility' },
  { id: 's3', label: "3. What DirectRef is, and isn't" },
  { id: 's4', label: '4. The core promise' },
  { id: 's5', label: '5. The response clocks' },
  { id: 's6', label: '6. Credits' },
  { id: 's7', label: '7. Beta' },
  { id: 's8', label: '8. Obligations: seeker' },
  { id: 's9', label: '9. Obligations: referrer' },
  { id: 's10', label: '10. Prohibited conduct' },
  { id: 's11', label: '11. Your content' },
  { id: 's12', label: '12. Our content' },
  { id: 's13', label: '13. Third-party links' },
  { id: 's14', label: '14. Suspension & termination' },
  { id: 's15', label: '15. Disclaimer of warranties' },
  { id: 's16', label: '16. Limitation of liability' },
  { id: 's17', label: '17. Indemnity' },
  { id: 's18', label: '18. Changes to these Terms' },
  { id: 's19', label: '19. Governing law' },
  { id: 's20', label: '20. General' },
  { id: 's21', label: '21. Contact' },
];

const thClass = 'text-left py-2.5 px-3 text-[12px] uppercase tracking-[0.05em]';
const tdClass = 'py-2.5 px-3';
const thStyle = { borderBottom: `2px solid ${mkt.accentSeeker}`, color: mkt.textPrimary };
const linkStyle = { color: mkt.accentSeeker, borderBottom: `1px solid ${mkt.accentSeeker}` };

export default function TermsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingHeader variant="sub" />

      <LegalLayout title="Terms of Service" effectiveDate="Effective 11 September 2026 · Last updated 11 September 2026" toc={toc}>
        <LegalH2 id="short">The short version</LegalH2>
        <LegalP>This box is a summary, not the agreement. The numbered sections below are what actually binds us.</LegalP>
        <LegalUl>
          <LegalLi><LegalStrong>We guarantee the signal, not the outcome.</LegalStrong> DirectRef gets your CV in front of a real person and guarantees you find out what happened. It does not guarantee a referral, an interview, or a job.</LegalLi>
          <LegalLi><LegalStrong>Referrers are strangers to you.</LegalStrong> Before anyone can post a role, they must verify an email address at that company&apos;s own domain. That is a real check, and it is not proof of employment. We do not employ referrers and cannot control what they do.</LegalLi>
          <LegalLi><LegalStrong>You choose who sees your CV.</LegalStrong> Applying sends it to a named person, deliberately. Once they forward it to their employer, it&apos;s out of our hands.</LegalLi>
          <LegalLi><LegalStrong>Applying is free.</LegalStrong> There is no cap on how many roles you apply to, and no charge. Credits apply only to referrers posting roles.</LegalLi>
          <LegalLi><LegalStrong>Credits cannot currently be bought.</LegalStrong> Everyone is granted them; nothing is for sale on DirectRef today.</LegalLi>
          <LegalLi><LegalStrong>DirectRef is in free beta.</LegalStrong> Nothing costs money.</LegalLi>
        </LegalUl>

        <LegalH2 id="s1">1. Who you&apos;re contracting with</LegalH2>
        <LegalP>These Terms of Service (the &quot;Terms&quot;) are an agreement between you and <LegalStrong>Shai Atar and Anat Atar Lachmish</LegalStrong>, who operate DirectRef jointly as private individuals in Israel (&quot;DirectRef&quot;, &quot;we&quot;, &quot;us&quot;). DirectRef is not currently incorporated. If that changes, we will update these Terms under §18 and tell you before the change takes effect.</LegalP>
        <LegalP>They govern your use of the DirectRef website, application and services (together, the &quot;Service&quot;).</LegalP>
        <LegalP><LegalStrong>By creating an account or using the Service, you agree to these Terms.</LegalStrong> If you don&apos;t agree, don&apos;t use the Service.</LegalP>
        <LegalP>Our <a href="/privacy" style={linkStyle}>Privacy Policy</a> is part of these Terms.</LegalP>

        <LegalH2 id="s2">2. Eligibility</LegalH2>
        <LegalP>You must be <LegalStrong>at least 18 years old</LegalStrong> and legally able to enter a binding contract. You must provide accurate information and keep it current. One person, one account. You may not create an account for someone else, share your credentials, or let another person use your account.</LegalP>
        <LegalP>If you use the Service on behalf of an organisation, you confirm you are authorised to bind that organisation.</LegalP>

        <LegalH2 id="s3">3. What DirectRef is, and what it isn&apos;t</LegalH2>
        <LegalP>DirectRef is a <LegalStrong>platform</LegalStrong>. We connect seekers with individual employees (&quot;referrers&quot;) at hiring companies. That&apos;s the whole of it.</LegalP>
        <LegalP><LegalStrong>DirectRef is not:</LegalStrong></LegalP>
        <LegalUl>
          <LegalLi>an employer, and does not offer employment;</LegalLi>
          <LegalLi>a recruitment agency, staffing agency, headhunter, or employment placement service, and does not act as agent for any employer or candidate;</LegalLi>
          <LegalLi>a party to any employment relationship, referral bounty, offer, or hiring decision that results from use of the Service.</LegalLi>
        </LegalUl>
        <LegalP>We do not participate in, influence, or take a fee from any hiring decision. Every hiring decision is made entirely by the employer, under its own process, on its own criteria.</LegalP>

        <LegalH2 id="s4">4. The core promise, stated precisely</LegalH2>
        <LegalP><LegalStrong>We guarantee the signal, not the outcome.</LegalStrong></LegalP>
        <LegalP>What we do guarantee, for every application you submit:</LegalP>
        <LegalUl>
          <LegalLi>Your CV is delivered to a specific, named referrer whom you selected before applying.</LegalLi>
          <LegalLi>That referrer is required to give a binary answer: &quot;I&apos;ll refer this one&quot; or &quot;Not a fit.&quot;</LegalLi>
          <LegalLi>If they say they&apos;ll refer you, they must confirm with a separate tap once they have actually forwarded your CV, and you are notified.</LegalLi>
          <LegalLi>If they do nothing, an escalation runs on your behalf, and if they still never answer we close the application and tell you. You are never left without an answer.</LegalLi>
          <LegalLi>Applying is free and unlimited, so a referrer who never answers costs you nothing but time. You may apply to another role, or to another person at the same company, immediately.</LegalLi>
        </LegalUl>
        <LegalP><LegalStrong>What we expressly do not guarantee:</LegalStrong></LegalP>
        <LegalUl>
          <LegalLi>that a referrer will refer you;</LegalLi>
          <LegalLi>that a referral will lead to a screening call, an interview, an offer, or a job;</LegalLi>
          <LegalLi>that an employer will look at, respond to, or acknowledge a forwarded CV;</LegalLi>
          <LegalLi>that a job listing is genuine, currently open, accurately described, or still funded;</LegalLi>
          <LegalLi>that a referrer still works at the company they verified an email address at (see §15);</LegalLi>
          <LegalLi>that a referrer who taps &quot;I submitted it&quot; genuinely did so.</LegalLi>
        </LegalUl>
        <LegalP><LegalStrong>No statement made by DirectRef, on the website, in an email, in marketing, or by a founder, constitutes a promise, guarantee or representation of employment.</LegalStrong></LegalP>

        <LegalH2 id="s5">5. The response clocks</LegalH2>
        <LegalP>An application runs on <LegalStrong>two</LegalStrong> clocks, one after the other. Each is five days long, so an application can take up to ten days end to end. You are notified at every step of both.</LegalP>

        <LegalH3>Clock A: getting a decision</LegalH3>
        <LegalP>Runs from the moment you send your CV, while the referrer has yet to decide.</LegalP>
        <div className="overflow-x-auto mb-5">
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr>
                <th className={thClass} style={thStyle}>When</th>
                <th className={thClass} style={thStyle}>What happens</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${tdClass} font-semibold`} style={{ borderBottom: `1px solid ${mkt.border}`, color: mkt.textPrimary }}>Day 1</td>
                <td className={tdClass} style={{ borderBottom: `1px solid ${mkt.border}`, color: mkt.textSecondary }}>The referrer is reminded by email if they haven&apos;t acted.</td>
              </tr>
              <tr>
                <td className={`${tdClass} font-semibold`} style={{ borderBottom: `1px solid ${mkt.border}`, color: mkt.textPrimary }}>Day 2</td>
                <td className={tdClass} style={{ borderBottom: `1px solid ${mkt.border}`, color: mkt.textSecondary }}>The referrer gets a firmer reminder with a deadline, and you are told they haven&apos;t responded yet.</td>
              </tr>
              <tr>
                <td className={`${tdClass} font-semibold`} style={{ color: mkt.textPrimary }}>Day 5</td>
                <td className={tdClass} style={{ color: mkt.textSecondary }}>The application closes and you are told, in the app and by email.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <LegalH3>Clock B: getting it submitted</LegalH3>
        <LegalP>Starts when the referrer downloads your CV to put it through their company&apos;s internal process, and runs until they confirm they did.</LegalP>
        <div className="overflow-x-auto mb-5">
          <table className="w-full border-collapse text-[14.5px]">
            <thead>
              <tr>
                <th className={thClass} style={thStyle}>When</th>
                <th className={thClass} style={thStyle}>What happens</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${tdClass} font-semibold`} style={{ borderBottom: `1px solid ${mkt.border}`, color: mkt.textPrimary }}>Day 2</td>
                <td className={tdClass} style={{ borderBottom: `1px solid ${mkt.border}`, color: mkt.textSecondary }}>The referrer is asked whether they submitted it internally.</td>
              </tr>
              <tr>
                <td className={`${tdClass} font-semibold`} style={{ color: mkt.textPrimary }}>Day 5</td>
                <td className={tdClass} style={{ color: mkt.textSecondary }}>The application closes and you are told, in the app and by email.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <LegalP>Additionally:</LegalP>
        <LegalUl>
          <LegalLi><LegalStrong>Messaging pauses the clock.</LegalStrong> You may message the referrer at any point after applying. Sending a message pauses the auto-close timer, because we treat an active conversation as the system working, not failing.</LegalLi>
          <LegalLi><LegalStrong>A &quot;Not a fit&quot; closes the application.</LegalStrong> It is a real answer, delivered on purpose, and it is the outcome the Service exists to guarantee you receive.</LegalLi>
          <LegalLi>We may adjust these intervals as the Service develops. If we do, we will tell you before the change applies to new applications, and applications already in flight keep the timings they started with.</LegalLi>
        </LegalUl>

        <LegalH2 id="s6">6. Credits</LegalH2>
        <LegalP><LegalStrong>Applying for a role is free, and there is no limit on how many roles you apply to.</LegalStrong> Credits exist on the other side of the market: a referrer spends one credit to post a role.</LegalP>
        <LegalUl>
          <LegalLi>Every account is granted <LegalStrong>5 credits on sign-up and 1 more each month</LegalStrong>. They accumulate and they never expire.</LegalLi>
          <LegalLi>Posting a role costs 1 credit and also requires a verified work email at the company you are posting for (see §9).</LegalLi>
          <LegalLi><LegalStrong>Credits cannot currently be bought.</LegalStrong> There is no store, no pricing, and no payment processing on DirectRef, and no payment details are collected from you anywhere on the Service.</LegalLi>
          <LegalLi>Credits are personal and non-transferable. They have no cash value, and are not stored value, a payment instrument, or a security.</LegalLi>
          <LegalLi>Deleting your account forfeits any remaining credits.</LegalLi>
        </LegalUl>
        <LegalP>If we ever introduce paid credits, we will publish new terms covering price, expiry, refunds and your statutory cancellation rights, and give you notice under §18 before they take effect. <LegalStrong>You will never be charged without an explicit purchase.</LegalStrong></LegalP>

        <LegalH2 id="s7">7. Beta</LegalH2>
        <LegalP>DirectRef is currently in free beta. During the beta:</LegalP>
        <LegalUl>
          <LegalLi>The Service is provided free of charge. Nothing is sold and no payments are taken.</LegalLi>
          <LegalLi>Features may change, break, or be removed without notice.</LegalLi>
          <LegalLi>There is no uptime commitment and no service level agreement.</LegalLi>
          <LegalLi>Data may be lost. Keep your own copy of your CV.</LegalLi>
          <LegalLi>We may contact you for feedback. You can decline.</LegalLi>
        </LegalUl>

        <LegalH2 id="s8">8. Your obligations as a seeker</LegalH2>
        <LegalUl>
          <LegalLi>Submit your own CV, describing your own experience, accurately. Submitting someone else&apos;s CV, or a fabricated one, is a material breach of these Terms.</LegalLi>
          <LegalLi>Apply to roles you genuinely want, and not use applications to test the system or spam referrers.</LegalLi>
          <LegalLi>Treat referrers as the volunteers they largely are. They are under no obligation to refer you, and a decline is not a wrong done to you.</LegalLi>
          <LegalLi>Not use messaging to harass, pressure, abuse, or repeatedly contact a referrer who has answered you.</LegalLi>
          <LegalLi>Understand that once your CV reaches an employer, that employer&apos;s own privacy practices apply and we cannot retrieve it.</LegalLi>
        </LegalUl>

        <LegalH2 id="s9">9. Your obligations as a referrer</LegalH2>
        <LegalUl>
          <LegalLi><LegalStrong>Verify a work email at the company whose roles you post</LegalStrong>, actually work there, and describe your role there accurately. Tell us, or stop posting, if that stops being true.</LegalLi>
          <LegalLi>Post only genuine, currently open positions you have a real basis to believe exist.</LegalLi>
          <LegalLi>Only tap &quot;I submitted it&quot; once you have genuinely forwarded the CV. Falsely confirming a submission is the most serious breach available on this platform, and we will terminate accounts for it.</LegalLi>
          <LegalLi>Give an honest binary decision within the clock in §5.</LegalLi>
          <LegalLi>Handle the CVs you receive lawfully, for the single, specific purpose of considering that person for the role they applied to.</LegalLi>
          <LegalLi>Comply with your own employer&apos;s policies on referrals, external tools, confidentiality and recruitment. That is entirely your responsibility, not ours.</LegalLi>
          <LegalLi>Post nothing that discriminates on grounds prohibited by the Equal Employment Opportunities Law, 5748-1988.</LegalLi>
        </LegalUl>
        <LegalP><LegalStrong>Referral bounties.</LegalStrong> If your employer pays you a bounty for a referral, that is strictly between you and your employer. DirectRef is not a party to it, takes no share of it, does not guarantee you&apos;ll receive it, and will not mediate any dispute about it.</LegalP>

        <LegalH2 id="s10">10. Prohibited conduct</LegalH2>
        <LegalP>You may not:</LegalP>
        <LegalUl>
          <LegalLi>impersonate any person, company, or employee, or misrepresent your affiliation with any of them;</LegalLi>
          <LegalLi>post fake, expired, duplicate or misleading listings, or listings for companies you don&apos;t work at;</LegalLi>
          <LegalLi>upload malware, or any file that isn&apos;t a genuine CV document;</LegalLi>
          <LegalLi>scrape, crawl, harvest, or bulk-extract listings, profiles, CVs, or any other data from the Service;</LegalLi>
          <LegalLi>use the Service to build a competing database, or to source candidates for anyone other than the role posted;</LegalLi>
          <LegalLi>resell, sublicense, or commercially exploit access to the Service;</LegalLi>
          <LegalLi>attempt to bypass credit limits or create multiple accounts;</LegalLi>
          <LegalLi>probe, scan, or test the security of the Service, or circumvent any access control;</LegalLi>
          <LegalLi>send unsolicited commercial messages, recruiting pitches, or spam through messaging;</LegalLi>
          <LegalLi>harass, threaten, defame, or discriminate against any user;</LegalLi>
          <LegalLi>use the Service unlawfully or in violation of anyone&apos;s rights.</LegalLi>
        </LegalUl>
        <LegalP>We may investigate suspected breaches and take any action we consider appropriate, including removing content, suspending or terminating accounts, and reporting to the authorities.</LegalP>

        <LegalH2 id="s11">11. Your content</LegalH2>
        <LegalP>You keep ownership of everything you upload: your CV, your notes, your messages, your listings.</LegalP>
        <LegalP>You grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, transmit and display that content, solely for the purpose of operating the Service. This licence ends when you delete the content or your account, subject to the retention periods in the <a href="/privacy" style={linkStyle}>Privacy Policy</a>.</LegalP>
        <LegalP>We do not use your CV to train machine learning models, do not license your content to third parties, and do not use it in marketing.</LegalP>
        <LegalP>You confirm you have the right to upload everything you upload, and that it doesn&apos;t infringe anyone&apos;s rights or breach any confidentiality obligation you owe.</LegalP>
        <LegalP>We do not pre-screen content. We may remove anything that breaches these Terms, at our discretion, without notice.</LegalP>

        <LegalH2 id="s12">12. Our content</LegalH2>
        <LegalP>The Service, its software, design, branding and content are owned by us or our licensors and protected by intellectual property law. We grant you a limited, revocable, non-transferable, non-exclusive licence to use the Service as intended. You may not copy, modify, reverse-engineer, or create derivative works from it.</LegalP>
        <LegalP>&quot;DirectRef&quot; and our logo are our trademarks. Don&apos;t use them without written permission.</LegalP>

        <LegalH2 id="s13">13. Third-party links and job sources</LegalH2>
        <LegalP>Listings are created by pasting a URL from a company careers page, job board, or referral link, and the details are extracted automatically. That extraction can be wrong, incomplete, or out of date, and the underlying posting may have been filled or withdrawn. We do not verify listings, do not endorse any employer, and are not responsible for the content of any linked site.</LegalP>

        <LegalH2 id="s14">14. Suspension and termination</LegalH2>
        <LegalP>You may delete your account at any time from Settings, or by emailing <a href="mailto:support@direct-ref.com" style={linkStyle}>support@direct-ref.com</a>. Deleting your account forfeits any remaining credits. If you have posted roles, deleting your account removes them and the applications sent to them; those seekers are notified that you have left.</LegalP>
        <LegalP>We may suspend or terminate your account, with notice where practical and immediately where not, if you breach these Terms, if we reasonably suspect fraud or falsely confirmed submissions, if required by law, or if we discontinue the Service.</LegalP>
        <LegalP>Sections 4, 11, 12, and 15 through 20 survive termination.</LegalP>

        <LegalH2 id="s15">15. Disclaimer of warranties</LegalH2>
        <LegalP>The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranty of any kind, express or implied, including any implied warranty of merchantability, fitness for a particular purpose, accuracy, or non-infringement.</LegalP>
        <LegalP>Without limiting that, we do not warrant that the Service will be uninterrupted, secure or error-free; that listings are genuine, accurate, current or lawful; that any application will lead to a referral, interview or job; or that any data will not be lost.</LegalP>
        <LegalP><LegalStrong>On referrer verification, specifically:</LegalStrong> before a referrer can post a role, we require them to verify control of an email address at that company&apos;s own domain. That is the check we perform, and it is the extent of it. It does not prove they are employed there, what their role or seniority is, whether they are authorised to refer anyone, or that they still work there after the day they verified. We also cannot warrant that a referrer who taps &quot;I submitted it&quot; genuinely did so.</LegalP>
        <LegalP>We are a two-person platform connecting strangers. We check what we reasonably can, and we cannot verify the rest.</LegalP>

        <LegalH2 id="s16">16. Limitation of liability</LegalH2>
        <LegalP>To the maximum extent permitted by law:</LegalP>
        <LegalP>(a) We are not liable for indirect, incidental, special, consequential, punitive or exemplary damages, or for loss of profit, revenue, opportunity, data, goodwill, or any lost job opportunity, lost employment, lost salary, or lost referral bounty.</LegalP>
        <LegalP>(b) Our total aggregate liability arising from or relating to the Service, in any twelve-month period, is capped at <LegalStrong>ILS 500</LegalStrong>. The Service is provided free of charge and you pay us nothing.</LegalP>
        <LegalP>(c) We are not liable for the acts or omissions of any user: a referrer who ghosts you, lies about submitting your CV, misuses your CV, or doesn&apos;t work where they claim; an employer that ignores a forwarded CV; or a seeker who submits a false CV.</LegalP>
        <LegalP>(d) Nothing here excludes liability that cannot lawfully be excluded, including liability for fraud, wilful misconduct, or death or personal injury caused by negligence.</LegalP>

        <LegalH2 id="s17">17. Indemnity</LegalH2>
        <LegalP>You will indemnify and hold harmless DirectRef and its founders against any claim, liability, loss, damage, cost or expense (including reasonable legal fees) arising out of your use of the Service, your content, your breach of these Terms or of any law, or any dispute between you and another user or an employer.</LegalP>

        <LegalH2 id="s18">18. Changes to these Terms</LegalH2>
        <LegalP>We may update these Terms. If a change materially affects your rights or obligations, we will email you and show a notice in the app at least 14 days before it takes effect. If you don&apos;t accept it, delete your account before it takes effect.</LegalP>

        <LegalH2 id="s19">19. Governing law and jurisdiction</LegalH2>
        <LegalP>These Terms are governed by the laws of the State of Israel. The competent courts of Tel Aviv-Jaffa, Israel have exclusive jurisdiction over any dispute, and you consent to that jurisdiction.</LegalP>
        <LegalP>If you are a consumer resident elsewhere, this does not deprive you of the protection of mandatory consumer law in your country of residence.</LegalP>

        <LegalH2 id="s20">20. General</LegalH2>
        <LegalUl>
          <LegalLi><LegalStrong>Entire agreement.</LegalStrong> These Terms and the Privacy Policy are the whole agreement between us about the Service.</LegalLi>
          <LegalLi><LegalStrong>Severability.</LegalStrong> If any provision is held unenforceable, the rest stays in force.</LegalLi>
          <LegalLi><LegalStrong>No waiver.</LegalStrong> If we don&apos;t enforce something immediately, we haven&apos;t given up the right to enforce it later.</LegalLi>
          <LegalLi><LegalStrong>Assignment.</LegalStrong> You may not assign these Terms. We may assign them to a successor in connection with a merger, acquisition or sale of assets, including to a company we incorporate to operate DirectRef.</LegalLi>
          <LegalLi><LegalStrong>No third-party beneficiaries.</LegalStrong> Nobody outside this agreement gains rights under it.</LegalLi>
          <LegalLi><LegalStrong>Force majeure.</LegalStrong> Neither party is liable for failure to perform due to events beyond its reasonable control.</LegalLi>
          <LegalLi><LegalStrong>Language.</LegalStrong> These Terms are written in English. If we publish a Hebrew translation and the two conflict, the English version prevails.</LegalLi>
          <LegalLi><LegalStrong>Notices.</LegalStrong> We&apos;ll reach you at the email on your account. Reach us at the address below.</LegalLi>
        </LegalUl>

        <LegalH2 id="s21">21. Contact</LegalH2>
        <LegalP>Shai Atar and Anat Atar Lachmish, Israel</LegalP>
        <LegalP><a href="mailto:support@direct-ref.com" style={linkStyle}>support@direct-ref.com</a></LegalP>
      </LegalLayout>

      <MarketingFooter />
    </>
  );
}
