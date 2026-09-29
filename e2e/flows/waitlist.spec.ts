import { test, expect } from '@playwright/test';
import { waitlistRowsFor } from '../fixtures/db';

/**
 * WHY THIS FILE:
 *  - PROBLEM: at launch the waitlist is the only thing directref.com does.
 *    Every CTA opens it, and the launch plan depends on each signup landing on
 *    the right list — referrers are emailed first, to fill the site.
 *  - COST OF FAILURE: signups silently lost, or tagged wrong so "post your
 *    roles" goes to a job seeker.
 *  - NOTE: these WRITE a row, so no @readonly — never run against production.
 *    Addresses are on .test, so no email is sent and nothing reaches Resend.
 */

const uniqueEmail = (tag: string) => `waitlist-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.test`;

test.describe('waitlist signup', { tag: ['@marketing', '@waitlist'] }, () => {
  test('a seeker CTA puts the visitor on the seeker list, with its source and campaign', async ({ page }) => {
    const email = uniqueEmail('seeker');
    await page.goto('/?utm_source=linkedin');

    await page.getByRole('button', { name: /find a referral/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/email/i).fill(email);
    await dialog.getByRole('button', { name: /^notify me$/i }).click();

    await expect(dialog.getByRole('heading', { name: /you're on the list/i })).toBeVisible();
    await expect(dialog).toContainText(email);
    expect(await waitlistRowsFor(email)).toEqual([{ role: 'seeker', source_cta: 'hero_seeker', utm_source: 'linkedin' }]);
  });

  test('the neutral CTA lets the visitor say they are a referrer', async ({ page }) => {
    const email = uniqueEmail('referrer');
    await page.goto('/');

    await page.getByRole('button', { name: /join the waitlist/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/email/i).fill(email);
    await dialog.getByRole('button', { name: /can refer/i }).click();

    await expect(dialog.getByRole('heading', { name: /you're on the list/i })).toBeVisible();
    expect(await waitlistRowsFor(email)).toEqual([{ role: 'referrer', source_cta: 'nav', utm_source: null }]);
  });

  test('a malformed email is refused with a message, and stores nothing', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /refer someone/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/email/i).fill('not-an-email');
    await dialog.getByRole('button', { name: /^notify me$/i }).click();

    await expect(dialog.getByRole('alert')).toContainText(/valid email/i);
    await expect(dialog.getByRole('heading', { name: /you're on the list/i })).toHaveCount(0);
    expect(await waitlistRowsFor('not-an-email')).toEqual([]);
  });
});
