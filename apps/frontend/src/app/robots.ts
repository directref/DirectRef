import type { MetadataRoute } from 'next';

/** Closed to crawlers for the early beta.
 *
 *  Two separate gates, and as of 2026-09-20 BOTH are still up:
 *    1. The basic-auth password gate in proxy.ts — the site answers 401 to
 *       anyone without it. It lifts by deleting SITE_PASSWORD in Vercel and
 *       redeploying (the var is read at module load, so a redeploy is
 *       required; Vercel does not redeploy on an env change by itself).
 *    2. This file plus the marketing layout's robots block — no indexing.
 *
 *  They lift in that order and NOT together: the password goes first so the
 *  beta link works, and indexing stays off until the early beta closes,
 *  because the legal pages, pricing model and flows are still moving and an
 *  indexed snapshot of a half-finished contract is expensive to undo.
 *
 *  (An earlier version of this comment claimed the password was already off.
 *  It was not — the site was returning 401 the whole time.)
 *
 *  TO GO PUBLIC: swap the rule below back to `allow: '/'` with the app routes
 *  disallowed (git history has the previous version), and remove the `noindex`
 *  robots block in the marketing layout. Do both together — either one alone
 *  leaves the site half-open. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
    sitemap: 'https://direct-ref.com/sitemap.xml',
  };
}
