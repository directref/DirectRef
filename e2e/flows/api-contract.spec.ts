import { test, expect } from '@playwright/test';
import { API_URL } from '../fixtures/seed';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the two endpoints that must answer before anything else works,
 *    and the one assertion that makes a post-deploy check mean anything —
 *    whether the build serving traffic is the one that was just shipped.
 *  - COST OF FAILURE: a green deploy that isn't actually deployed. This
 *    happened repeatedly on 2026-09-16: /health returned 200 from the OLD
 *    build every time, and confirming a release meant a human reading a
 *    dashboard.
 *
 *  @readonly — safe against production. This is the core of the prod smoke job.
 */

test.describe('API contract @api @smoke @readonly', () => {
  test('/health reports ok with database and uploads both usable', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('connected');
    // The uploads volume holds every C.V. on the platform. If it is not
    // writable, applications fail at the last step with the file already chosen.
    expect(body.checks.uploads).toBe('writable');
  });

  test('/health identifies which build is serving', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    const { commit } = await res.json();

    expect(commit, '/health must report a commit — see app.ts').toBeTruthy();

    // In CI the deployed SHA must equal the one this run shipped. Without this
    // comparison the whole smoke suite can pass against a stale build and
    // report that a failed deploy went fine.
    const expected = process.env.E2E_EXPECTED_COMMIT;
    if (expected) {
      expect(commit, 'deployed commit does not match the commit under test').toBe(expected.slice(0, 7));
    } else {
      expect(commit).toMatch(/^[0-9a-f]{7}$|^unknown$/);
    }
  });

  test('the frontend identifies its build too', async ({ request }) => {
    // Lives under /api, which proxy.ts's matcher excludes — so it answers even
    // while SITE_PASSWORD gates the site, which is exactly when a deploy most
    // needs confirming.
    const res = await request.get('/api/version');
    expect(res.status()).toBe(200);

    const { commit } = await res.json();
    expect(commit).toBeTruthy();

    const expected = process.env.E2E_EXPECTED_COMMIT;
    if (expected) expect(commit).toBe(expected.slice(0, 7));
  });

  test('the public jobs sample is reachable and well-shaped', async ({ request }) => {
    // Powers the landing page's "real jobs" teaser. The only unauthenticated
    // jobs endpoint, so a regression here is visible to every visitor.
    const res = await request.get(`${API_URL}/api/jobs/sample`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    const jobs = Array.isArray(body) ? body : (body.jobs ?? body.data ?? []);
    expect(Array.isArray(jobs), 'sample should return a list').toBeTruthy();

    // Empty is legitimate — the teaser hides itself when there is nothing to
    // show — but anything returned must carry what the teaser renders.
    for (const job of jobs) {
      expect(job).toHaveProperty('title');
      expect(job).toHaveProperty('companyName');
    }
  });

  test('an unauthenticated request cannot reach another user\'s data', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/applications/mine`);
    expect([401, 403]).toContain(res.status());
  });
});
