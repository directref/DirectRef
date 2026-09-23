/**
 * Accounts that exist only so automated checks can exercise the real product
 * against the real deployment.
 *
 * WHY A RESERVED DOMAIN, not a column someone sets by hand: `.test` is
 * reserved by RFC 6761 and can never be registered, so no real person can
 * ever land on it by accident or on purpose. That makes the marker
 * self-evident from the address alone — no lookup needed in the mail path,
 * and no way to create a test account and forget to flag it.
 *
 * Two consequences, both deliberate:
 *   1. Their job postings are hidden from every public and seeker-facing
 *      listing, so a smoke test can post a job on the live site without a real
 *      seeker ever seeing it.
 *   2. No mail is sent to them. Every message would bounce — the domain does
 *      not resolve — and repeated bounces are what destroys a sending domain's
 *      reputation. On a product whose entire promise is that email arrives,
 *      that is the one cost not worth paying for test coverage.
 *
 * The flag is still stored on the user row (users.isTestAccount) so the feed
 * queries can filter on an indexed boolean rather than a string match.
 */
export const TEST_ACCOUNT_EMAIL_SUFFIX = '.test';

/** Is this address a test account's? Safe to call on anything. */
export function isTestAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.trim().toLowerCase().split('@')[1];
  return !!domain && domain.endsWith(TEST_ACCOUNT_EMAIL_SUFFIX);
}
