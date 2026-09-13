import type { MetadataRoute } from 'next';

/** Closed to crawlers for the early beta.
 *
 *  The site is public (the Vercel Basic-auth password is off) but deliberately
 *  not indexed yet: the legal pages, pricing model and flows are still moving,
 *  and an indexed snapshot of a half-finished contract is expensive to undo.
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
