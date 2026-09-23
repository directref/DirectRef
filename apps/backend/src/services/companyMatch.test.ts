import { describe, it, expect } from 'vitest';
import {
  extractEmailDomain,
  isPersonalEmailDomain,
  autoVerifiedWorkEmailFields,
  emailMatchesJob,
} from './companyMatch';

/**
 * WHY THIS FILE:
 *  - PROBLEM: this decides who is allowed to post a job at all. A referrer
 *    whose verified work email does not "match" the posting is refused, full
 *    stop — it is the one hard block on a real user action in the product.
 *  - COST OF FAILURE: asymmetric, and the code says so explicitly ("a false
 *    block is worse than an occasional false pass"). Too strict and a genuine
 *    employee cannot post the role they can actually refer into, which is the
 *    entire supply side of a referral network. Too loose and someone posts a
 *    job for a company they do not work at, which the work-email verification
 *    was there to prevent.
 *  - METHOD: pure functions, no database, no network. These run in
 *    milliseconds and are the cheapest coverage in the codebase.
 */

describe('recognising a personal mailbox', () => {
  it.each(['gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'yahoo.com'])(
    'treats %s as personal',
    (domain) => {
      // Auto-verifying a personal domain as a WORK email would hand anyone
      // proof of employment at whatever company shares their mailbox label.
      expect(isPersonalEmailDomain(domain)).toBe(true);
    },
  );

  it.each(['walla.co.il', 'walla.com', 'nana10.co.il', '012.net.il', 'bezeqint.net', 'netvision.net.il'])(
    'treats the Israeli consumer provider %s as personal',
    (domain) => {
      // The original list was entirely US/global. On a product for Israeli
      // tech that meant a personal walla or bezeq mailbox arrived already
      // marked workEmailVerified at signup.
      expect(isPersonalEmailDomain(domain)).toBe(true);
    },
  );

  it.each(['acme.test', 'monday.com', 'wix.com', 'fiverr.com'])('treats %s as a company domain', (domain) => {
    expect(isPersonalEmailDomain(domain)).toBe(false);
  });

  it('is case-insensitive — nobody types their address consistently', () => {
    expect(isPersonalEmailDomain('GMAIL.COM')).toBe(true);
  });

  it('pulls the domain off an address, trimmed and lowercased', () => {
    expect(extractEmailDomain('  Rae@Acme.TEST ')).toBe('acme.test');
    expect(extractEmailDomain('not-an-email')).toBe('');
  });
});

describe('auto-verifying a work email from the account email', () => {
  it('accepts a company address — verifying the account already proved the mailbox', async () => {
    expect(autoVerifiedWorkEmailFields('rae@acme.test')).toEqual({
      workEmail: 'rae@acme.test',
      workEmailVerified: true,
    });
  });

  it('refuses a personal address', () => {
    // They still go through the dedicated work-email flow in Settings.
    expect(autoVerifiedWorkEmailFields('rae@gmail.com')).toEqual({});
  });

  it('refuses a missing address', () => {
    // OAuth without an email scope falls back to a synthetic placeholder that
    // must never be trusted as proof of employment.
    expect(autoVerifiedWorkEmailFields(null)).toEqual({});
    expect(autoVerifiedWorkEmailFields(undefined)).toEqual({});
    expect(autoVerifiedWorkEmailFields('')).toEqual({});
  });

  it('normalises case on the way in', () => {
    expect(autoVerifiedWorkEmailFields('Rae@ACME.test')).toMatchObject({ workEmail: 'rae@acme.test' });
  });
});

describe('matching a work email to a posting — the permissive cases', () => {
  it('matches when the posting is on the company\'s own careers site', () => {
    expect(emailMatchesJob('acme.test', 'https://acme.test/careers/eng', 'Acme')).toBe(true);
  });

  it('matches a careers subdomain', () => {
    expect(emailMatchesJob('acme.test', 'https://careers.acme.test/eng', 'Acme')).toBe(true);
  });

  it('ignores a www prefix', () => {
    expect(emailMatchesJob('acme.test', 'https://www.acme.test/jobs/1', 'Acme')).toBe(true);
  });

  it.each([
    'https://boards.greenhouse.io/acme/jobs/1',
    'https://jobs.lever.co/acme/1',
    'https://acme.comeet.com/jobs/1',
    'https://apply.workable.com/acme/j/1',
    'https://acme.bamboohr.com/careers/1',
  ])('falls back to the company name when the posting is on an ATS (%s)', (url) => {
    // A large share of real postings live on a third-party ATS, whose domain
    // says nothing about the employer. Without the name fallback, most
    // legitimate referrers would be blocked.
    expect(emailMatchesJob('acme.test', url, 'Acme')).toBe(true);
  });

  it('matches through common company suffixes', () => {
    for (const name of ['Acme Inc', 'Acme Ltd.', 'Acme Technologies', 'Acme Group', 'ACME CORP']) {
      expect(emailMatchesJob('acme.test', 'https://boards.greenhouse.io/x/1', name), name).toBe(true);
    }
  });

  it('matches when the company name carries punctuation or spacing', () => {
    expect(emailMatchesJob('acme.test', 'https://jobs.lever.co/x/1', 'A.C.M.E.')).toBe(true);
    expect(emailMatchesJob('acme.test', 'https://jobs.lever.co/x/1', 'Acme  ')).toBe(true);
  });

  it('still matches when the sourceUrl is malformed', () => {
    // A bad URL is not evidence about the employer — fall through to the name.
    expect(emailMatchesJob('acme.test', 'not a url', 'Acme')).toBe(true);
  });
});

describe('Israeli company domains — the case that was entirely blocked', () => {
  // registrableDomain took the last two labels, so acme.co.il reduced to
  // "co.il": the URL branch never matched, and the name branch got the label
  // "co", below the 3-character floor. Every .co.il referrer was refused —
  // on a product built for Israeli tech, where .co.il is the standard
  // company-domain form. The exact false block the module warns against.
  it('lets a .co.il referrer post on their own careers page', () => {
    expect(emailMatchesJob('acme.co.il', 'https://acme.co.il/careers/1', 'Acme')).toBe(true);
  });

  it('lets a .co.il referrer post an ATS-hosted role for their company', () => {
    expect(emailMatchesJob('monday.co.il', 'https://boards.greenhouse.io/monday/jobs/1', 'Monday')).toBe(true);
  });

  it('handles a careers subdomain on a .co.il domain', () => {
    expect(emailMatchesJob('acme.co.il', 'https://careers.acme.co.il/1', 'Acme')).toBe(true);
  });

  it.each(['co.uk', 'com.au', 'co.jp', 'com.br'])('handles %s the same way', (suffix) => {
    expect(emailMatchesJob(`acme.${suffix}`, `https://acme.${suffix}/careers/1`, 'Acme')).toBe(true);
  });

  it('still refuses a .co.il referrer posting for a different company', () => {
    // The fix must widen the match, not remove it.
    expect(emailMatchesJob('acme.co.il', 'https://boards.greenhouse.io/other/jobs/1', 'Other Corp')).toBe(false);
  });
});

describe('matching a work email to a posting — what it refuses', () => {
  it('refuses an unrelated company', () => {
    expect(emailMatchesJob('acme.test', 'https://other.test/careers/1', 'Other Corp')).toBe(false);
  });

  it('refuses an ATS-hosted posting for a different company', () => {
    expect(emailMatchesJob('acme.test', 'https://boards.greenhouse.io/other/jobs/1', 'Other Corp')).toBe(false);
  });

  it('does not let an ATS domain itself count as a match', () => {
    // Someone with a greenhouse.io address must not thereby be able to post
    // every job hosted on greenhouse.
    expect(emailMatchesJob('greenhouse.io', 'https://boards.greenhouse.io/other/jobs/1', 'Other Corp')).toBe(false);
  });

  it('refuses a short email label that would otherwise match almost anything', () => {
    // "co" appears inside a great many normalised company names. The
    // three-character floor is what stops it matching them all.
    expect(emailMatchesJob('co.test', 'https://jobs.lever.co/x/1', 'Something Cosmic')).toBe(false);
  });

  it('refuses an empty company name', () => {
    expect(emailMatchesJob('acme.test', 'https://jobs.lever.co/x/1', '')).toBe(false);
  });

  it('refuses when the company name is only a generic suffix', () => {
    // "Inc" normalises to nothing, so there is nothing left to match against.
    expect(emailMatchesJob('acme.test', 'https://jobs.lever.co/x/1', 'Inc')).toBe(false);
  });
});
