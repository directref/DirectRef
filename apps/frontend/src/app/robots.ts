import type { MetadataRoute } from 'next';

/** Open to search engines since 9 October 2026.
 *
 *  Crawlers may read the public marketing pages (/, /our-story, /terms,
 *  /privacy — the ones listed in sitemap.ts). Everything behind a login, the
 *  sign-in flows, the admin dashboards and the API are disallowed: they have
 *  nothing to index and would only show up as login redirects.
 *
 *  Paired with the marketing layout, which no longer sets `noindex`. Pages
 *  that must stay out of search results (e.g. /waitlist/unsubscribe) set their
 *  own `robots: { index: false }` in metadata — that tag only works on a page
 *  crawlers are allowed to fetch, so do not also disallow those here.
 *
 *  KEEP IN SYNC with PROTECTED_PREFIXES / PUBLIC_PATHS in proxy.ts when a new
 *  app route is added. */
const PRIVATE_PATHS = [
  // The logged-in app
  '/feed',
  '/jobs',
  '/applications',
  '/network',
  '/notifications',
  '/settings',
  '/onboarding',
  '/credits',
  '/support',
  // Sign-in and account flows
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-work-email',
  '/auth',
  '/join',
  // Internal
  '/admin',
  '/api/',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_PATHS,
    },
    sitemap: 'https://direct-ref.com/sitemap.xml',
  };
}
