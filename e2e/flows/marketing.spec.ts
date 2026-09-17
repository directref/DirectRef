import { test, expect } from '@playwright/test';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the four pre-login pages are the entire first impression, and
 *    they are edited often — a copy pass on 2026-09-13 rewrote both hero CTAs
 *    and touched 77 em dashes across all four. A build that renders one of
 *    them blank is invisible until someone opens it.
 *  - COST OF FAILURE: the beta link lands on a broken or empty page.
 *
 *  These assert on TEXT on purpose, against the rule used everywhere else in
 *  this suite. On marketing pages the copy IS the thing under test, so a
 *  deliberate wording change SHOULD fail here and be updated — unlike an app
 *  button, where the behaviour is the contract and the label is incidental.
 *
 *  @readonly — no writes, no mail. Safe against production, which is what the
 *  post-deploy smoke job runs.
 */

test.describe('marketing pages @marketing @smoke @readonly', () => {
  test('landing page renders its hero and both audience CTAs', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status(), 'landing page should not error').toBeLessThan(400);

    await expect(page.getByRole('heading', { name: /get referred from the inside/i })).toBeVisible();

    // Relabelled to actions rather than identities on 2026-09-13. Both
    // audiences must have a way in — dropping one silently halves the funnel.
    await expect(page.getByRole('link', { name: /find a referral/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /refer someone/i }).first()).toBeVisible();
  });

  // One assertion per page, each pinned to something that would actually
  // matter if it vanished — not a generic "a heading exists".
  for (const [path, heading] of [
    // Naming both founders is the 2026-09-11 decision that stands in for having
    // no legal entity: they ARE the contracting parties named in the Terms.
    ['/our-story', /the founders/i],
    ['/terms', /terms/i],
    ['/privacy', /privacy/i],
  ] as const) {
    test(`${path} renders`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should not error`).toBeLessThan(400);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();

      // Both contracts were rewritten end to end on 2026-09-11 specifically to
      // remove placeholders. One reappearing means an unfinished edit shipped.
      const body = await page.textContent('body');
      expect(body).not.toMatch(/\[ENTITY NAME\]|\[COMPANY\]|\bLorem ipsum\b|TODO/i);
    });
  }

  test('the site is not indexable while the beta is closed', async ({ page }) => {
    // Decision 2026-09-11: stay noindex until the early beta closes. Losing
    // this silently would put a half-finished product into Google.
    await page.goto('/');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots ?? '').toMatch(/noindex/i);
  });
});
