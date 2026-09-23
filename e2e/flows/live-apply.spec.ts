import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';
import { API_URL, TEST_PASSWORD, TEST_CV } from '../fixtures/seed';

/**
 * WHY THIS FILE:
 *  - PROBLEM: every other check that runs against production only READS. They
 *    all pass even if sending a C.V. is broken there — an expired storage
 *    credential, a disk that filled, a setting that differs from the test
 *    environment. The one thing the product must be able to do would be broken
 *    and every light would still be green. The first person to find out would
 *    be a seeker.
 *  - COST OF FAILURE: the product silently does nothing, during a beta, while
 *    the dashboard says healthy.
 *  - SUCCESS: a C.V. goes in through the real API on the real deployment, and
 *    comes back out byte-for-byte to the referrer who was meant to receive it.
 *
 *  SAFE AGAINST PRODUCTION, by construction rather than by care:
 *    · Both accounts use `.test` addresses, which the backend marks as test
 *      accounts — their postings are excluded from the landing page, search
 *      and suggestions, so no seeker can see or apply to this job.
 *    · No mail can be sent to them; the send path drops it.
 *    · Everything created is deleted at the end, and the deletion cascades.
 *  Nothing here depends on database access, because against production there
 *  is none — it is all the public API, exactly as a real user would use it.
 */

const unique = () => `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

/** `.test` can never be a real domain (RFC 6761), so these can never collide
 *  with a real person, and acme.test matches the job's source URL — which is
 *  what lets the posting gate accept it. */
const referrerEmail = () => `probe-referrer-${unique()}@acme.test`;
const seekerEmail = () => `probe-seeker-${unique()}@example.test`;

async function newUser(email: string, isReferrer: boolean): Promise<APIRequestContext> {
  const api = await pwRequest.newContext({ baseURL: API_URL });
  const res = await api.post('/api/auth/register', {
    data: { email, password: TEST_PASSWORD, fullName: 'Probe Tester', isReferrer },
  });
  expect(res.ok(), `register failed on ${API_URL}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return api;
}

test.describe('applying for a job actually works here', { tag: ['@prodsafe', '@apply'] }, () => {
  // Serial: it creates and then deletes accounts, and a parallel copy of
  // itself would be cleaning up under the other one.
  test.describe.configure({ mode: 'serial' });

  test('a C.V. sent on this deployment reaches the referrer intact', async () => {
    const referrerAddress = referrerEmail();
    const referrer = await newUser(referrerAddress, true);
    const seeker = await newUser(seekerEmail(), false);

    try {
      // ── The referrer posts a role ──────────────────────────────────────────
      // A test account is verified at creation — it can never receive a
      // verification email, so it is not gated on one. That makes this the
      // real posting path, credit spend and matching gate included.
      const slug = unique();
      const postRes = await referrer.post('/api/jobs', {
        data: {
          sourceUrl: `https://acme.test/careers/${slug}`,
          title: `Automated liveness probe ${slug}`,
          companyName: 'acme',
          location: 'Tel Aviv',
          description: 'Created by the production smoke check. Not a real vacancy.',
        },
      });
      expect(postRes.ok(), `posting failed: ${postRes.status()} ${await postRes.text()}`).toBeTruthy();
      const job = (await postRes.json()).data;
      expect(job.id).toBeTruthy();

      // ── It must NOT be visible to anyone ───────────────────────────────────
      // Asserted against the live site, not just unit-tested, because this is
      // the promise that makes writing to production acceptable at all.
      const sample = await (await pwRequest.newContext({ baseURL: API_URL })).get('/api/jobs/sample');
      if (sample.ok()) {
        const body = await sample.json();
        const titles = JSON.stringify(body.data ?? body);
        expect(titles, 'a probe posting reached the public landing page').not.toContain('Automated liveness probe');
      }

      // ── The seeker applies, C.V. and all ───────────────────────────────────
      const applyRes = await seeker.post('/api/applications', {
        multipart: {
          jobId: job.id,
          referrerId: job.referrerId,
          cv: { name: TEST_CV.name, mimeType: TEST_CV.mimeType, buffer: TEST_CV.buffer },
        },
      });
      expect(applyRes.status(), `applying failed: ${await applyRes.text()}`).toBe(201);
      const applicationId = (await applyRes.json()).data.id;

      // ── The referrer receives it ───────────────────────────────────────────
      const inbox = await referrer.get('/api/applications/inbox');
      expect(inbox.ok()).toBeTruthy();
      const received = (await inbox.json()).data;
      expect(received.map((r: { application: { id: string } }) => r.application.id)).toContain(applicationId);

      // ── And the C.V. itself survived the round trip ────────────────────────
      // The assertion that matters. Upload can appear to succeed while the
      // file never lands — a full disk, a mis-set uploads path, a volume that
      // did not mount. Comparing the bytes back is the only proof.
      const cv = await referrer.get(`/api/applications/${applicationId}/cv`);
      expect(cv.status(), 'the referrer could not download the C.V. on this deployment').toBe(200);
      const bytes = await cv.body();
      expect(bytes.length, 'the C.V. came back empty').toBeGreaterThan(0);
      expect(bytes.equals(TEST_CV.buffer), 'the C.V. came back different from the one sent').toBe(true);
    } finally {
      // Always, even on failure — a failed run must not leave accounts behind
      // on production. Deleting the users cascades their jobs, applications,
      // messages and C.V. files.
      for (const api of [seeker, referrer]) {
        await api.delete('/api/users/me').catch(() => {});
        await api.dispose();
      }
    }
  });

  test('it cleans up after itself', async () => {
    // Proves the teardown above actually works, rather than assuming it. If
    // deletion silently failed, production would accumulate probe accounts
    // and postings for as long as this job keeps running.
    const address = referrerEmail();
    const api = await newUser(address, true);
    const del = await api.delete('/api/users/me');
    expect(del.ok(), `deleting the probe account failed: ${del.status()}`).toBeTruthy();

    // The account is gone: logging back in must fail.
    const fresh = await pwRequest.newContext({ baseURL: API_URL });
    const login = await fresh.post('/api/auth/login', { data: { email: address, password: TEST_PASSWORD } });
    expect(login.ok(), 'the probe account still exists after deletion').toBeFalsy();

    await api.dispose();
    await fresh.dispose();
  });
});
