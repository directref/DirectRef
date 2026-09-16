import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { safeNextPath } from '@/lib/utils';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/join',
];

// Reachable regardless of auth state, no redirect either way. Work-email
// verification in particular is normally clicked while still logged in
// (submitted from Settings, unlike account signup verification) — putting
// it in PUBLIC_PATHS above would bounce an authenticated visitor to /feed
// before the page ever renders and fires the verify call.
const NEUTRAL_PATHS = ['/our-story', '/terms', '/privacy', '/verify-work-email'];

// The actual authenticated app — everything under src/app/(app)/. Matched
// as an allowlist (rather than "everything not public") so a genuinely
// nonexistent URL falls through to Next's own routing and 404s, instead of
// silently being redirected to /login like a real protected page.
const PROTECTED_PREFIXES = [
  '/feed',
  '/jobs',
  '/applications',
  '/network',
  '/notifications',
  '/settings',
  '/onboarding',
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Decode the exp claim from a JWT without verifying the signature.
 *  Returns true if the token exists and has not expired. */
function isTokenAlive(token: string | undefined): boolean {
  if (!token) return false;
  try {
    // JWT uses base64url — convert to standard base64 before decoding
    const part = token.split('.')[1];
    const base64 = part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64));
    // exp is in seconds; give a 10s buffer for clock skew
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 10_000;
  } catch {
    return false;
  }
}

const SITE_PASSWORD = process.env.SITE_PASSWORD;

/** Basic-auth gate that fronts the whole site while it's not public yet.
 *  Successful auth is remembered via a cookie so users aren't re-prompted
 *  on every request. */
function checkSiteGate(req: NextRequest): NextResponse | null {
  if (!SITE_PASSWORD) return null;
  if (req.cookies.get('site-access')?.value === SITE_PASSWORD) return null;

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const [, pwd] = atob(auth.split(' ')[1]).split(':');
    if (pwd === SITE_PASSWORD) {
      const res = NextResponse.next();
      res.cookies.set('site-access', SITE_PASSWORD, {
        httpOnly: true,
        secure: true,
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
  }

  return new NextResponse('Not available yet', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="DirectRef"' },
  });
}

export function proxy(req: NextRequest) {
  const gateResponse = checkSiteGate(req);
  if (gateResponse) return gateResponse;

  const { pathname } = req.nextUrl;

  if (NEUTRAL_PATHS.some((p) => pathname === p)) return NextResponse.next();

  // The marketing home page is public, but — like the login/register pages —
  // an already-authenticated visitor gets bounced into the app instead.
  const isPublic    = pathname === '/' || matchesPrefix(pathname, PUBLIC_PATHS);
  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const token       = req.cookies.get('access_token')?.value;
  const alive       = isTokenAlive(token);

  // Unauthenticated (no valid token) hitting a protected app route → login,
  // remembering where they were headed so we can return them there.
  if (!alive && isProtected) {
    const requested = safeNextPath(`${pathname}${req.nextUrl.search}`, '/feed');
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', requested);
    return NextResponse.redirect(url);
  }

  // Authenticated with a live token hitting the home page or a public auth
  // page → feed
  if (alive && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.redirect(url);
  }

  // Forward the pathname so server components (e.g. the (app) layout's own
  // session check) can build a `next=` target without their own request access.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', `${pathname}${req.nextUrl.search}`);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|public|api/).*)'],
};
