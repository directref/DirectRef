import { APIRequestContext, Browser, Page, request as pwRequest, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { workEmailTokenFor } from './db';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
export const WEB_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

/** Every test invents its own users, so tests never collide and the suite can
 *  run fully parallel without truncating anything. */
const unique = (p: string) => `${p}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

/** Must satisfy RegisterSchema: 8+ chars, one uppercase, one digit. */
export const TEST_PASSWORD = 'TestPass123';

export interface TestUser {
  email: string;
  password: string;
  fullName: string;
  api: APIRequestContext; // authenticated as this user
}

async function newApiContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: API_URL });
}

async function register(opts: { emailPrefix: string; fullName: string; isReferrer: boolean; emailDomain?: string }): Promise<TestUser> {
  const api = await newApiContext();
  const email = `${unique(opts.emailPrefix)}@${opts.emailDomain ?? 'example.test'}`;

  const res = await api.post('/api/auth/register', {
    data: { email, password: TEST_PASSWORD, fullName: opts.fullName, isReferrer: opts.isReferrer },
  });
  if (res.status() === 429) {
    // Almost always a stale backend on port 3000 rather than a real limit.
    // playwright.config relaxes the auth limit for the server IT starts, but
    // reuseExistingServer is on locally — so a server left running from an
    // earlier session, or started by hand, is reused with production limits
    // and every registration 429s. The message matters: the failure otherwise
    // reads as a product bug and takes a while to place.
    throw new Error(
      'Registration was rate-limited (429).\n' +
      'This is usually a leftover backend on port 3000 that Playwright reused, ' +
      'started without the relaxed test limits.\n' +
      'Fix:  lsof -nP -tiTCP:3000 -tiTCP:3001 -sTCP:LISTEN | xargs -r kill -9\n' +
      'then re-run, letting Playwright start the servers itself.',
    );
  }
  expect(res.ok(), `register failed: ${res.status()} ${await res.text()}`).toBeTruthy();

  return { email, password: TEST_PASSWORD, fullName: opts.fullName, api };
}

/** Deliberately AWKWARD names. This suite found two registration bugs in
 *  generateInviteCode — a first name over 11 characters overflowed the
 *  varchar(16) invite_code column, and a non-Latin name stripped to empty so
 *  every such user shared one namespace. Both are fixed now, and the fixtures
 *  keep using the shapes that broke it so a regression fails here too rather
 *  than only in the unit tests. */
const AWKWARD_NAMES = ['Konstantinos', 'Aleksandrina', 'יוסי', 'Владимир', 'Bartholomew', 'Sam'];
const awkwardName = () =>
  `${AWKWARD_NAMES[Math.floor(Math.random() * AWKWARD_NAMES.length)]} Tester`;

export const createSeeker = () =>
  register({ emailPrefix: 'seeker', fullName: awkwardName(), isReferrer: false });

/**
 * A referrer who can actually post.
 *
 * Posting is gated on a VERIFIED work email whose domain matches the job
 * (jobs.service.ts:118 + companyMatch.ts). So this submits the work email,
 * reads the token straight from the database — it would otherwise be in an
 * inbox — and then follows the real verification endpoint. Everything but the
 * delivery is genuine.
 */
export async function createReferrer(
  companyDomain = 'acme.test',
  opts: { visibleInBrowse?: boolean; fullName?: string } = {},
): Promise<TestUser & { companyDomain: string }> {
  // A .test account's postings are hidden from search, the feed and the
  // landing sample (config/testAccounts.ts) — by design, so a probe never
  // reaches real seekers. Tests of Browse Jobs itself need postings a seeker
  // can actually see, so they register on a non-.test domain instead. Safe
  // locally: the throwaway backend has no Resend key, so no mail can leave.
  const user = await register({
    emailPrefix: 'referrer',
    // Random awkward names repeat (6 to pick from), so a test that tells two
    // referrers apart by name passes its own.
    fullName: opts.fullName ?? awkwardName(),
    isReferrer: true,
    emailDomain: opts.visibleInBrowse ? 'example.com' : undefined,
  });

  const workEmail = `${unique('rae')}@${companyDomain}`;
  const submit = await user.api.post('/api/users/me/work-email', { data: { workEmail } });
  expect(submit.ok(), `work-email submit failed: ${submit.status()} ${await submit.text()}`).toBeTruthy();

  const token = await workEmailTokenFor(user.email);
  const verify = await user.api.get(`/api/auth/verify-work-email/${token}`, { maxRedirects: 0 });
  // The endpoint redirects into the app on success, so 2xx and 3xx both mean verified.
  expect([200, 302, 301].includes(verify.status()), `work-email verify: ${verify.status()}`).toBeTruthy();

  return { ...user, companyDomain };
}

/** A live posting. sourceUrl and companyName both point at the referrer's work
 *  domain so either branch of companyMatch passes. */
export async function createJob(
  referrer: TestUser & { companyDomain: string },
  overrides: Record<string, unknown> = {},
) {
  const res = await referrer.api.post('/api/jobs', {
    data: {
      sourceUrl: `https://${referrer.companyDomain}/careers/${unique('role')}`,
      title: 'Senior Backend Engineer',
      companyName: referrer.companyDomain.split('.')[0],
      location: 'Tel Aviv',
      description: 'Build the thing. Then build more of the thing.',
      ...overrides,
    },
  });
  expect(res.ok(), `create job failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return body.job ?? body.data ?? body;
}

/** Log in through the real form, so the test exercises the same path a person
 *  does — cookies, proxy redirect and all. */
export async function loginViaUi(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(user.email);
  // exact: the show/hide toggle is aria-label="Show password", so a loose
  // /password/i matches two elements.
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();
  await page.waitForURL(/\/feed|\/onboarding/, { timeout: 20_000 });
}

/** Apply through the API — for tests whose subject starts after the C.V. is sent. */
export async function applyViaApi(
  seeker: TestUser,
  jobId: string,
  opts: { cv?: typeof TEST_CV; coverNote?: string } = {},
): Promise<{ id: string }> {
  const cv = opts.cv ?? TEST_CV;
  const res = await seeker.api.post('/api/applications', {
    multipart: {
      jobId,
      cv: { name: cv.name, mimeType: cv.mimeType, buffer: cv.buffer },
      ...(opts.coverNote ? { coverNote: opts.coverNote } : {}),
    },
  });
  expect(res.ok(), `apply failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

/** A small real PDF — multer checks the mimetype, and the referrer-side tests
 *  download it back, so it has to be a genuine file rather than a stub. */
export const TEST_CV = {
  name: 'test-cv.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
      'trailer<</Root 1 0 R>>\n%%EOF\n',
  ),
};

export async function disposeUsers(...users: Array<{ api: APIRequestContext }>): Promise<void> {
  await Promise.all(users.map((u) => u.api.dispose()));
}

export type { Browser };
