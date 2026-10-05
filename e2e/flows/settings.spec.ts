import { test, expect } from '@playwright/test';
import { createSeeker, loginViaUi, disposeUsers } from '../fixtures/seed';
import { linkBothOAuthProviders } from '../fixtures/db';

/**
 * WHY THIS FILE:
 *  - PROBLEM: PR #5 fixed Settings reporting "signed in with Google" for an
 *    account that also has LinkedIn connected. It shipped without a test.
 *  - COST OF FAILURE: a person is told they use a sign-in method they don't,
 *    and goes looking for the wrong button next time.
 *  - SUCCESS: every connected provider is named.
 */
test.describe('settings', { tag: ['@auth'] }, () => {
  test('an account with both Google and LinkedIn connected shows both', async ({ page }) => {
    const seeker = await createSeeker();
    await linkBothOAuthProviders(seeker.email);

    await loginViaUi(page, seeker);
    await page.goto('/settings');

    await expect(page.getByText(`${seeker.email} · signed in with Google & LinkedIn`)).toBeVisible();

    await disposeUsers(seeker);
  });

  test('an email-and-password account says so', async ({ page }) => {
    const seeker = await createSeeker();
    await loginViaUi(page, seeker);
    await page.goto('/settings');

    await expect(page.getByText(`${seeker.email} · signed in with email & password`)).toBeVisible();

    await disposeUsers(seeker);
  });
});
