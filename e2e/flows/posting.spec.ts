import { test, expect } from '@playwright/test';
import http from 'http';
import type { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import { createReferrer, loginViaUi, disposeUsers } from '../fixtures/seed';

/**
 * WHY THIS FILE — the Post a job screen (PRD US-R1):
 *  - PROBLEM: every other test creates its jobs by calling the API. Nobody
 *    had ever filled in the actual form, so the screen that supplies the
 *    whole marketplace could break without a single test noticing.
 *  - COST OF FAILURE: referrers cannot post, so seekers have nothing to apply
 *    to. A form that says "filled in!" over empty fields wastes the
 *    referrer's time and erodes trust in the one person we most need.
 *  - SUCCESS: paste a link, get honest feedback about what was found,
 *    publish, see the posting under "Jobs I Posted" and one credit gone.
 */

test.describe('posting a job through the screen', { tag: ['@refer', '@credits'] }, () => {
  test('paste a link, fill the form, post — it is listed and costs one credit', async ({ page }) => {
    const t = randomUUID().slice(0, 6);
    const referrer = await createReferrer(`post${t}.test`);

    await loginViaUi(page, referrer);
    await expect(page.getByTestId('credit-balance')).toHaveText('5 credits available');

    await page.goto('/jobs/post');
    // A .test domain cannot be fetched, so Autofill comes back empty — this
    // test's subject is the form, not the scraper.
    await page.getByPlaceholder('https://careers.company.com/jobs/...').fill(`https://post${t}.test/careers/${t}`);
    await page.getByRole('button', { name: 'Autofill' }).click();

    await page.getByLabel('Job title *').fill(`Solutions Architect ${t}`);
    await page.getByLabel('Company name *').fill(`post${t}`);
    await page.getByLabel('Location').fill('Tel Aviv');
    await page.getByRole('button', { name: 'Post Job' }).click();

    await expect(page.getByText('Job posted!')).toBeVisible();
    await expect(page.getByRole('link', { name: `Solutions Architect ${t}` })).toBeVisible();
    await expect(page.getByTestId('credit-balance')).toHaveText('4 credits available');

    await disposeUsers(referrer);
  });

  test('Autofill that finds nothing says so, instead of claiming success', async ({ page }) => {
    // Regression for c18f832: an empty scrape used to show "Details filled
    // in!" over a blank form.
    const t = randomUUID().slice(0, 6);
    const referrer = await createReferrer(`fill${t}.test`);

    await loginViaUi(page, referrer);
    await page.goto('/jobs/post');
    await page.getByPlaceholder('https://careers.company.com/jobs/...').fill(`https://fill${t}.test/careers/nothing-here`);
    await page.getByRole('button', { name: 'Autofill' }).click();

    await expect(page.getByText('Could not read that URL automatically. Fill in the details below.')).toBeVisible();
    await expect(page.getByText(/details filled in/i)).toHaveCount(0);
    // The manual form is there to finish by hand.
    await expect(page.getByLabel('Job title *')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Post Job' })).toBeVisible();

    await disposeUsers(referrer);
  });

  test('Buying credits cannot be reached anywhere in the app', async ({ page }) => {
    // Purchasing is switched off for launch (PRD v15). The /credits page is
    // kept for a quick re-enable, so the risk is a link to it coming back by
    // accident.
    const referrer = await createReferrer();
    await loginViaUi(page, referrer);

    for (const path of ['/feed', '/jobs', '/jobs/post', '/applications', '/settings']) {
      await page.goto(path);
      await expect(page.getByText(/buy credits/i), `"Buy credits" on ${path}`).toHaveCount(0);
    }
    expect((await referrer.api.post('/api/credits/purchase', { data: { packageId: 'starter' } })).status()).toBe(404);

    await disposeUsers(referrer);
  });
});

test.describe('signed-out visitors', { tag: ['@refer', '@auth'] }, () => {
  test('reaching for Post a job sends a signed-out visitor to log in, and back afterwards', async ({ page }) => {
    await page.goto('/jobs/post');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    expect(decodeURIComponent(page.url())).toContain('next=/jobs/post');
  });
});

test.describe('Autofill from a real job page', { tag: ['@refer'] }, () => {
  // A job page served from this test, shaped like real careers pages (a
  // schema.org JobPosting block — what Greenhouse, Comeet and most company
  // sites embed). Real third-party sites change and go down, so they cannot
  // be what this test depends on.
  let server: http.Server;
  let pageUrl = '';
  const t = randomUUID().slice(0, 6);
  const domain = `autofill${t}.test`;
  const company = `autofill${t}`;

  test.beforeAll(async () => {
    const jobPosting = {
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      title: `Staff Frontend Engineer ${t}`,
      hiringOrganization: { '@type': 'Organization', name: company },
      jobLocation: { '@type': 'Place', address: { addressLocality: 'Herzliya', addressCountry: 'Israel' } },
      employmentType: 'FULL_TIME',
      description: '<p>Own the design system.</p><ul><li>React</li><li>TypeScript</li></ul>',
    };
    server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html><html><head><title>Careers</title>
        <script type="application/ld+json">${JSON.stringify(jobPosting)}</script></head>
        <body><h1>${jobPosting.title}</h1></body></html>`);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    pageUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/careers/${t}`;
  });
  test.afterAll(() => new Promise<void>((r) => server.close(() => r())));

  test('a readable job page fills the form, and the posting goes live', async ({ page }) => {
    const referrer = await createReferrer(domain);

    await loginViaUi(page, referrer);
    await page.goto('/jobs/post');
    await page.getByPlaceholder('https://careers.company.com/jobs/...').fill(pageUrl);
    await page.getByRole('button', { name: 'Autofill' }).click();

    await expect(page.getByText('Details filled in! Review and publish.')).toBeVisible();
    await expect(page.getByLabel('Job title *')).toHaveValue(`Staff Frontend Engineer ${t}`);
    await expect(page.getByLabel('Company name *')).toHaveValue(company);
    await expect(page.getByLabel('Location')).toHaveValue('Herzliya, Israel');
    await expect(page.getByLabel('Description')).toHaveValue(/Own the design system/);

    await page.getByRole('button', { name: 'Post Job' }).click();
    await expect(page.getByText('Job posted!')).toBeVisible();
    await expect(page.getByRole('link', { name: `Staff Frontend Engineer ${t}` })).toBeVisible();

    await disposeUsers(referrer);
  });
});

test.describe('entering a job by hand', { tag: ['@refer'] }, () => {
  test('"Enter manually instead" asks for the job link and publishes', async ({ page }) => {
    // Regression: the manual form had no field for the job link, so it
    // posted sourceUrl "" and the server refused it ("Must be a valid URL").
    const t = randomUUID().slice(0, 6);
    const referrer = await createReferrer(`manual${t}.test`);

    await loginViaUi(page, referrer);
    await page.goto('/jobs/post');
    await page.getByRole('button', { name: 'Enter manually instead' }).click();
    await expect(page.getByLabel('Job link *')).toHaveValue('');
    await page.getByLabel('Job link *').fill(`https://manual${t}.test/careers/data-analyst`);
    await page.getByLabel('Job title *').fill(`Data Analyst ${t}`);
    await page.getByLabel('Company name *').fill(`manual${t}`);
    const posted = page.waitForResponse((r) => r.url().endsWith('/api/jobs') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Post Job' }).click();

    const res = await posted;
    expect(res.status(), `server said: ${await res.text()}`).toBe(201);
    await expect(page.getByText('Job posted!')).toBeVisible();
    await expect(page.getByRole('link', { name: `Data Analyst ${t}` })).toBeVisible();

    await disposeUsers(referrer);
  });

  test('without a link, nothing is sent and no credit is spent', async ({ page }) => {
    const t = randomUUID().slice(0, 6);
    const referrer = await createReferrer(`nolink${t}.test`);

    await loginViaUi(page, referrer);
    await page.goto('/jobs/post');
    await page.getByRole('button', { name: 'Enter manually instead' }).click();
    await page.getByLabel('Job title *').fill(`Data Analyst ${t}`);
    await page.getByLabel('Company name *').fill(`nolink${t}`);

    let posted = false;
    page.on('request', (r) => { if (r.url().endsWith('/api/jobs') && r.method() === 'POST') posted = true; });
    await page.getByRole('button', { name: 'Post Job' }).click();

    await expect(page.getByText('Job posted!')).toHaveCount(0);
    expect(posted).toBe(false);
    await expect(page.getByTestId('credit-balance')).toHaveText('5 credits available');

    await disposeUsers(referrer);
  });
});
