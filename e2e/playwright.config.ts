import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Two modes, chosen by whether E2E_BASE_URL is set.
 *
 *  LOCAL (default) — Playwright starts both apps itself, pointed at the
 *  throwaway Postgres on 5433. Everything runs here, including the tests that
 *  register users, upload C.V.s and post jobs. Nothing they create can reach
 *  real data.
 *
 *  REMOTE (E2E_BASE_URL set) — no servers started; tests run against a
 *  deployed environment. Only `@readonly` tests are safe here, which is what
 *  the production smoke job runs: a test posting would land in the live feed,
 *  and bouncing addresses erode Resend's sender reputation.
 */
const REMOTE = process.env.E2E_BASE_URL;
const WEB = REMOTE ?? 'http://localhost:3001';
const API = process.env.E2E_API_URL ?? (REMOTE ? 'https://api.direct-ref.com' : 'http://localhost:3000');

const TEST_DATABASE_URL = 'postgresql://directref:directref_pass@localhost:5433/directref_test';
const backendDir = path.resolve(__dirname, '../apps/backend');
const frontendDir = path.resolve(__dirname, '../apps/frontend');

export default defineConfig({
  testDir: './flows',
  outputDir: './test-results',

  // Each test creates its own uniquely-named users and jobs and never
  // truncates — unlike the vitest suite, which owns the database and wipes it
  // between tests. That difference is deliberate: it lets these run in
  // parallel, and it matches how the product is actually used (a database with
  // other people's data already in it).
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github'], ['list']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: WEB,
    // Everything needed to debug a failure without reproducing it: the DOM at
    // each step, the network log, and a video. Only kept for failures, so a
    // green run costs nothing.
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    extraHTTPHeaders: siteGateHeader(),
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Only in local mode. Reuses whatever is already running so a dev with both
  // servers up doesn't pay the startup cost twice.
  webServer: REMOTE ? undefined : [
    {
      command: 'npm run dev',
      cwd: backendDir,
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        PORT: '3000',
        DATABASE_URL: TEST_DATABASE_URL,
        FRONTEND_URL: WEB,
        // Dummy secrets — env.ts requires 32+ chars. Nothing real belongs in
        // a test runner.
        JWT_ACCESS_SECRET: 'e2e_only_access_secret_not_real_0123456789',
        JWT_REFRESH_SECRET: 'e2e_only_refresh_secret_not_real_0123456789',
        COOKIE_SECRET: 'e2e_only_cookie_secret_not_real_0123456789',
        // Empty key: email.ts's Resend call fails and is swallowed by the
        // caller's .catch(). No mail can leave, which is the point.
        RESEND_API_KEY: '',
        UPLOADS_DIR: './.e2e-uploads',
        // The suite registers and uploads far faster than any person, so the
        // production limits (10 auth attempts / 15 min, 10 uploads / hour)
        // trip immediately. Relaxed HERE ONLY — the defaults in env.ts are
        // unchanged, so production is unaffected.
        RATE_LIMIT_AUTH_MAX: '10000',
        RATE_LIMIT_API_MAX: '100000',
        RATE_LIMIT_UPLOAD_MAX: '10000',
        RATE_LIMIT_SCRAPE_MAX: '10000',
      },
    },
    {
      // A PRODUCTION build, not `next dev`, for two reasons. `next dev`
      // compiles each route the first time it is requested, so with several
      // workers hitting a cold /feed at once the first navigation blew past a
      // 30s timeout — tests that passed alone failed in a full run, which is
      // the worst kind of flake. And this is the bundle that actually ships,
      // so the suite exercises what users get rather than a dev-only build.
      // Costs one build up front; every navigation after is fast.
      command: 'npm run build && npm run start -- --port 3001',
      cwd: frontendDir,
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { NEXT_PUBLIC_API_URL: API },
    },
  ],
});

/** The deployed site sits behind a basic-auth gate (proxy.ts) until the beta
 *  opens. Remote runs need the password or every request is a 401. Local runs
 *  have no gate, because SITE_PASSWORD is unset there. */
function siteGateHeader(): Record<string, string> | undefined {
  const pwd = process.env.E2E_SITE_PASSWORD;
  if (!pwd) return undefined;
  return { Authorization: `Basic ${Buffer.from(`site:${pwd}`).toString('base64')}` };
}

export { WEB as WEB_URL, API as API_URL };
