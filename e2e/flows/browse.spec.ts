import { test, expect, Page } from '@playwright/test';
import { randomUUID } from 'crypto';
import { createSeeker, createReferrer, createJob, loginViaUi, disposeUsers } from '../fixtures/seed';

/**
 * WHY THIS FILE — Browse Jobs, the seeker's way in (PRD US-S1, US-S5):
 *  - PROBLEM: searching, filtering, the empty state and the Saved tab are all
 *    built and all run in the browser (the filters are client-side), and none
 *    had a test. The test strategy planned a "feed, search, detail" smoke
 *    test that was never written.
 *  - COST OF FAILURE: a seeker who cannot find the role is a seeker who never
 *    applies. A blank screen on zero results reads as "the site is broken".
 *  - SUCCESS: every filter narrows to the right roles, zero results explain
 *    themselves and offer a way back, and a saved role is waiting on the
 *    Saved tab.
 *
 *  Serial: these postings must be visible to search (non-.test referrers),
 *  so they share the feed with each other. Each test uses its own invented
 *  company and city names so leftovers from earlier runs cannot match.
 */
test.describe.configure({ mode: 'serial' });

const tag = () => randomUUID().slice(0, 6);

async function browse(page: Page) {
  await page.goto('/jobs');
  await expect(page.getByPlaceholder('Search jobs…')).toBeVisible();
}

test.describe('browsing and filtering jobs', { tag: ['@jobs'] }, () => {
  test('the search box narrows the list, and a job card opens its detail page', async ({ page }) => {
    const t = tag();
    const referrer = await createReferrer(`zephyr${t}.test`, { visibleInBrowse: true });
    const seeker = await createSeeker();
    const job = await createJob(referrer, { title: `Data Engineer ${t}`, location: 'Haifa', description: `Pipelines for ${t}.` });

    await loginViaUi(page, seeker);
    await browse(page);
    await page.getByPlaceholder('Search jobs…').fill(t);

    const card = page.getByRole('link', { name: `${job.title} at ${job.companyName}` });
    await expect(card).toHaveCount(1);
    await card.click();

    await expect(page.getByRole('heading', { name: job.title }).first()).toBeVisible();
    await expect(page.getByText(`Pipelines for ${t}.`)).toBeVisible();
    await expect(page.getByText(referrer.fullName).first()).toBeVisible();

    await disposeUsers(referrer, seeker);
  });

  test('the Company filter shows only that company, and Clear brings everything back', async ({ page }) => {
    const t = tag();
    const north = await createReferrer(`north${t}.test`, { visibleInBrowse: true });
    const south = await createReferrer(`south${t}.test`, { visibleInBrowse: true });
    const seeker = await createSeeker();
    const a = await createJob(north, { title: `Platform Engineer ${t}` });
    const b = await createJob(south, { title: `Platform Engineer ${t}` });

    await loginViaUi(page, seeker);
    await browse(page);
    await page.getByPlaceholder('Search jobs…').fill(t);
    await expect(page.getByRole('link', { name: new RegExp(`Platform Engineer ${t} at`) })).toHaveCount(2);

    const companies = page.getByTestId('filter-Company');
    await companies.getByPlaceholder('Search companies…').fill(`north${t}`);
    await companies.getByText(a.companyName, { exact: true }).click();

    await expect(page.getByRole('link', { name: `${a.title} at ${a.companyName}` })).toHaveCount(1);
    await expect(page.getByRole('link', { name: `${b.title} at ${b.companyName}` })).toHaveCount(0);

    await page.getByRole('button', { name: 'Clear all' }).click();
    await page.getByPlaceholder('Search jobs…').fill(t);
    await expect(page.getByRole('link', { name: new RegExp(`Platform Engineer ${t} at`) })).toHaveCount(2);

    await disposeUsers(north, south, seeker);
  });

  test('no matches shows a clear empty state with a way back, not a blank page', async ({ page }) => {
    const seeker = await createSeeker();
    await loginViaUi(page, seeker);
    await browse(page);

    await page.getByPlaceholder('Search jobs…').fill(`no-such-role-${tag()}`);

    const empty = page.getByTestId('jobs-empty');
    await expect(empty).toContainText(/no jobs match/i);
    await empty.getByRole('button', { name: /reset filters/i }).click();
    await expect(page.getByPlaceholder('Search jobs…')).toHaveValue('');
    await expect(page.getByTestId('jobs-empty')).toHaveCount(0);

    await disposeUsers(seeker);
  });

  test('the same city typed two ways is one Location entry', async ({ page }) => {
    // Regression for PR #2: "Ramat Gan" and "ramat gan" were listed twice.
    const t = tag();
    const referrer = await createReferrer(`loc${t}.test`, { visibleInBrowse: true });
    const seeker = await createSeeker();
    await createJob(referrer, { title: `QA Engineer ${t}`, location: `Kiryat ${t}` });
    await createJob(referrer, { title: `QA Lead ${t}`, location: `kiryat ${t.toUpperCase()}  ` });

    await loginViaUi(page, seeker);
    await browse(page);

    const locations = page.getByTestId('filter-Location');
    await locations.getByPlaceholder('Search locations…').fill(t);
    const entries = locations.locator('label').filter({ hasText: new RegExp(`kiryat ${t}`, 'i') });
    await expect(entries).toHaveCount(1);
    await expect(entries).toContainText('2');

    await disposeUsers(referrer, seeker);
  });

  test('a saved job waits on the Saved tab, and Remove takes it off', async ({ page }) => {
    const t = tag();
    const referrer = await createReferrer(`saved${t}.test`, { visibleInBrowse: true });
    const seeker = await createSeeker();
    const job = await createJob(referrer, { title: `Security Engineer ${t}` });

    await loginViaUi(page, seeker);
    await browse(page);
    await page.getByPlaceholder('Search jobs…').fill(t);
    await page.getByRole('button', { name: 'Save job' }).first().click();

    await page.goto('/applications?tab=saved');
    await expect(page.getByText(job.title)).toBeVisible();
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText(/no saved jobs/i)).toBeVisible();

    await disposeUsers(referrer, seeker);
  });
});

test.describe('Browse Jobs shows every live role', { tag: ['@jobs'] }, () => {
  test('a role is still findable when more than 20 are live', async ({ page }) => {
    // Regression: Browse Jobs used to request /api/jobs with no page size,
    // the server defaulted to 20, and search + filters ran on those 20 only —
    // the 21st-newest live role could not be found from Browse at all.
    test.setTimeout(120_000);
    const t = tag();
    const domain = `bulk${t}.test`;
    const referrers = await Promise.all([0, 1, 2, 3, 4].map(() => createReferrer(domain, { visibleInBrowse: true })));
    for (const r of referrers) {
      for (let i = 0; i < 5; i++) await createJob(r, { title: `Bulk Role ${t} ${i}` });
    }
    const seeker = await createSeeker();

    try {
      await loginViaUi(page, seeker);
      await browse(page);
      await page.getByPlaceholder('Search jobs…').fill(t);

      await expect(page.getByRole('link', { name: new RegExp(`Bulk Role ${t}`) })).toHaveCount(25);
    } finally {
      // Fails on purpose until fixed — dispose the API contexts either way.
      await disposeUsers(seeker, ...referrers);
    }
  });
});
