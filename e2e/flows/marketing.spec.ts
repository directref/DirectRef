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

test.describe('marketing pages', { tag: ['@marketing', '@smoke', '@readonly'] }, () => {
  test('landing page renders its hero and both audience CTAs', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status(), 'landing page should not error').toBeLessThan(400);

    await expect(page.getByRole('heading', { name: /get referred from the inside/i })).toBeVisible();

    // Relabelled to actions rather than identities on 2026-09-13. Both
    // audiences must have a way in — dropping one silently halves the funnel.
    // Since 2026-09-29 they are buttons that open the waitlist, not links.
    await expect(page.getByRole('button', { name: /find a referral/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /refer someone/i }).first()).toBeVisible();
  });

  test('pre-launch, nothing on the home page leads into the empty app', async ({ page }) => {
    // Decision 2026-09-29: the site launches with a waitlist while positions
    // are gathered. A stray /login link drops a visitor into an app with no
    // roles in it, and the test listings from the beta must not show.
    await page.goto('/');
    await expect(page.locator('a[href="/login"], a[href="/register"]')).toHaveCount(0);
    await expect(page.getByText(/roles with a way in/i)).toHaveCount(0);
  });

  test('every CTA opens the waitlist with the right question', async ({ page }) => {
    await page.goto('/');

    // Audience buttons: one submit, role already decided by the button.
    await page.getByRole('button', { name: /find a referral/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /positions are on their way/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /looking for a job/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /refer candidates/i })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /refer someone/i }).first().click();
    await expect(dialog.getByRole('heading', { name: /share open roles/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /refer candidates/i })).toBeVisible();
    await page.keyboard.press('Escape');

    // Neutral button: no role to infer, so the visitor picks one.
    await page.getByRole('button', { name: /join the waitlist/i }).first().click();
    await expect(dialog.getByRole('button', { name: /looking for a job/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /refer candidates/i })).toBeVisible();
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
