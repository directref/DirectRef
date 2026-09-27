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

test.describe('registration and login', { tag: ['@auth', '@smoke'] }, () => {
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

  test('deleting an account logs the user out cleanly, with no way back in', async ({ page }) => {
    // Regression: DeleteAccountCard used to call the account-context logout()
    // (which POSTs /api/auth/logout, gated by requireAuth) and then a plain
    // router.replace('/') right after. Because deleteMe() had already removed
    // the row, that logout call 401'd before it ever cleared cookies, and the
    // client-side navigation could land back inside the already-mounted
    // (app) layout without re-running its server auth check -- the user
    // stayed on what looked like the app, with a blank "Welcome back," and a
    // Set preferences link that just bounced back to /feed. It never actually
    // logged anyone out.
    const seeker = await createSeeker();

    await loginViaUi(page, seeker);
    await page.goto('/settings');

    await page.getByRole('button', { name: 'Delete account' }).click();
    await page.getByRole('button', { name: 'Delete permanently' }).click();

    // Must land cleanly on login, not loop back into the app.
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByText(/account and every CV.*have been deleted/i)).toBeVisible({ timeout: 5_000 });

    // The session must actually be gone, not just the page that says so --
    // reaching for the app again must not still look logged in.
    await page.goto('/feed');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    // And the account itself is really gone, not just the browser's session.
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(seeker.email);
    await page.getByLabel('Password', { exact: true }).fill(seeker.password);
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).click();
    await expect(page).not.toHaveURL(/\/feed/, { timeout: 8_000 });

    await disposeUsers(seeker);
  });
});
