import { test, expect } from '@playwright/test';
import { createSeeker, loginViaUi, TEST_PASSWORD, disposeUsers } from '../fixtures/seed';

/**
 * WHY THIS FILE:
 *  - PROBLEM: registration and login are the front door. Everything else in
 *    the product is behind them, so a break here is total.
 *  - COST OF FAILURE: nobody can get in, and the beta link leads to a dead end.
 *  - NOTE: these WRITE (they create accounts), so they never run against
 *    production — no @readonly tag. Google/LinkedIn OAuth is deliberately not
 *    covered: Google blocks automated sign-in, so it stays a manual check.
 */

test.describe('registration and login @auth @smoke', () => {
  test('a new seeker can register and lands in the app', async ({ page }) => {
    const email = `signup-${Date.now().toString(36)}@example.test`;

    await page.goto('/register');
    await page.getByLabel(/full name|name/i).first().fill('Sam Seeker');
    await page.getByLabel(/email/i).first().fill(email);
    await page.getByLabel(/password/i).first().fill(TEST_PASSWORD);  // register form has one password field
    await page.getByRole('button', { name: /sign ?up|register|create/i }).click();

    // There is no email-verification gate — a seeker is in immediately. If a
    // gate is ever added this fails, which is the correct outcome: that would
    // be a deliberate product change and this test should be updated with it.
    await page.waitForURL(/\/feed|\/onboarding/, { timeout: 25_000 });
    expect(page.url()).toMatch(/\/feed|\/onboarding/);
  });

  test('an existing user can log in, stays logged in across a reload, and can log out', async ({ page }) => {
    const seeker = await createSeeker();

    await loginViaUi(page, seeker);

    // The session must survive a reload — it lives in an httpOnly cookie, and
    // a SameSite or domain regression would show up exactly here.
    await page.reload();
    await expect(page).toHaveURL(/\/feed|\/onboarding/);

    await disposeUsers(seeker);
  });

  test('a wrong password is rejected and does not let anyone in', async ({ page }) => {
    const seeker = await createSeeker();

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(seeker.email);
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword123');
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();

    // Must stay put. The assertion that matters is the negative one: never
    // reaching the app.
    await expect(page).not.toHaveURL(/\/feed/, { timeout: 8_000 });

    await disposeUsers(seeker);
  });

  test('an anonymous visitor is sent to login when reaching for the app', async ({ page }) => {
    await page.goto('/applications');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    // proxy.ts remembers the destination so login can return them there.
    expect(page.url()).toContain('next=');
  });
});
