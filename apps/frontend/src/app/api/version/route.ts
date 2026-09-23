import { NextResponse } from 'next/server';

/**
 * WHY THIS EXISTS:
 *  A 200 from the site only proves "some version of the frontend is alive".
 *  A failed build, a deploy still in flight, or a rollback all answer 200 from
 *  the OLD bundle — so a post-deploy check can pass while the commit you just
 *  shipped is nowhere near production. This reports which build is actually
 *  serving, so the smoke test can compare it against the SHA it deployed.
 *
 *  VERCEL_GIT_COMMIT_SHA is injected by Vercel on every deploy; nothing needs
 *  configuring. Locally it is absent, hence 'unknown'.
 *
 *  Deploys are gated on the push gate passing — see scripts/deploy-gate.mjs.
 *  If a check fails, Vercel cancels the build rather than shipping; put
 *  [force-deploy] in the commit message to override for one release.
 *
 *  Deliberately under /api: proxy.ts's matcher excludes `api/`, so this stays
 *  reachable while SITE_PASSWORD gates the rest of the site — which is the
 *  whole point, since the beta gate is up precisely when we most want to know
 *  whether a deploy landed. Nothing secret is exposed: the repo is public, and
 *  a commit SHA identifies a build, it does not grant anything.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
}
