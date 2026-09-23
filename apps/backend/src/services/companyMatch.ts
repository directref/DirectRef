/**
 * Gates job posting to referrers who've verified a work email at the same
 * company (see jobs.service.ts createJob). Two signals, tried in order:
 *
 *  1. The job's sourceUrl domain, when it's the company's own site (most
 *     reliable) — but a large share of postings are scraped from a
 *     third-party ATS's own domain (jobs.lever.co, boards.greenhouse.io,
 *     comeet.com, ...), which reveals nothing about the company's real
 *     domain, so that's explicitly excluded from this check.
 *  2. The free-text company name, normalized and compared against the
 *     email domain's label — the fallback for ATS-hosted URLs, and for any
 *     domain mismatch the first check missed (e.g. a careers subdomain on
 *     a different registrable domain than the company's mail).
 *
 * Deliberately lenient (passes if EITHER signal matches): this is a hard
 * block on a real user action, so a false block is worse than an
 * occasional false pass.
 */

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
  'proton.me', 'zoho.com', 'mail.com', 'yandex.com', 'gmx.com', 'qq.com', '163.com',
  'fastmail.com', 'hey.com',
  // Israeli consumer providers. The list above is entirely US/global, which on
  // a product built for Israeli tech meant a personal walla or bezeq mailbox
  // was auto-verified as proof of employment at signup.
  'walla.com', 'walla.co.il', 'nana10.co.il', 'nana.co.il',
  '012.net.il', 'bezeqint.net', 'netvision.net.il', 'zahav.net.il', 'barak.net.il',
]);

// Third-party ATS/careers-hosting platforms — a job's sourceUrl living here
// says nothing about the employer's own domain.
const KNOWN_ATS_HOSTS = [
  'greenhouse.io', 'lever.co', 'comeet.com', 'workable.com', 'smartrecruiters.com',
  'myworkdayjobs.com', 'myworkday.com', 'icims.com', 'bamboohr.com', 'breezy.hr',
  'recruitee.com', 'jazzhr.com', 'ashbyhq.com', 'personio.de', 'personio.com',
  'teamtailor.com', 'applytojob.com', 'workday.com', 'taleo.net', 'jobvite.com',
];

/** Suffixes where the last two labels are the public suffix, so the
 *  registrable domain needs three. `.co.il` leads this list for a reason:
 *  it is the standard company-domain form in Israel, and treating it as the
 *  registrable domain made EVERY .co.il referrer unable to post — the URL
 *  branch compared "co.il" against their work domain and never matched, and
 *  the name branch got the label "co", which fails the 3-character floor.
 *  A referrer at acme.co.il could not post acme.co.il/careers for "Acme".
 *  Not the Public Suffix List, deliberately: a dependency and a periodic
 *  update for a problem that is, here, mostly .il and a handful of others. */
const MULTI_PART_SUFFIXES = new Set([
  'co.il', 'org.il', 'net.il', 'ac.il', 'gov.il', 'muni.il', 'k12.il',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.jp', 'co.nz', 'co.za', 'co.in', 'co.kr',
  'com.br', 'com.sg', 'com.mx', 'com.tr', 'com.cn', 'com.hk',
]);

function registrableDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 3 && MULTI_PART_SUFFIXES.has(parts.slice(-2).join('.'))) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function isKnownAtsHost(hostname: string): boolean {
  return KNOWN_ATS_HOSTS.some((ats) => hostname === ats || hostname.endsWith(`.${ats}`));
}

export function extractEmailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function isPersonalEmailDomain(domain: string): boolean {
  return PERSONAL_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/**
 * If a just-verified account email belongs to a company domain (not a
 * personal provider), the account-verification step already proved the user
 * owns that mailbox — so there's no reason to make them separately verify a
 * work email too. Returns fields to merge into the user row; `{}` for a
 * personal-domain email (they still go through the dedicated work-email
 * flow in Settings) or a missing email (OAuth without an email scope, which
 * falls back to a synthetic placeholder address that must never be trusted
 * as a work email).
 */
export function autoVerifiedWorkEmailFields(
  email: string | null | undefined,
): { workEmail: string; workEmailVerified: true } | Record<string, never> {
  if (!email) return {};
  const domain = extractEmailDomain(email);
  if (!domain || isPersonalEmailDomain(domain)) return {};
  return { workEmail: email.toLowerCase(), workEmailVerified: true };
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|group|technologies|technology|tech)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Does a verified work-email domain plausibly belong to this job posting? */
export function emailMatchesJob(workEmailDomain: string, sourceUrl: string, companyName: string): boolean {
  try {
    const urlHost = new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
    if (!isKnownAtsHost(urlHost) && registrableDomain(urlHost) === workEmailDomain.toLowerCase()) {
      return true;
    }
  } catch {
    // malformed sourceUrl — fall through to the company-name check
  }

  const emailLabel = registrableDomain(workEmailDomain).split('.')[0];
  const companyNormalized = normalizeCompanyName(companyName);
  // Require a non-trivial label so short/generic ones (e.g. "co", "hq")
  // can't loosely match almost any company name.
  return emailLabel.length >= 3 && companyNormalized.length > 0 && companyNormalized.includes(emailLabel);
}
