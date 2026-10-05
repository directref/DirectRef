import { test, expect } from '@playwright/test';
import http from 'http';
import type { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import { createReferrer, createSeeker, createJob, loginViaUi, disposeUsers } from '../fixtures/seed';

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
  let missingUrl = '';
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
    server = http.createServer((req, res) => {
      if (req.url?.startsWith('/gone')) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<!doctype html><title>Not found</title><h1>This job no longer exists</h1>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html><html><head><title>Careers</title>
        <script type="application/ld+json">${JSON.stringify(jobPosting)}</script></head>
        <body><h1>${jobPosting.title}</h1></body></html>`);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    pageUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/careers/${t}`;
    missingUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/gone/${t}`;
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

  test('a link to a page that no longer exists (404) says so and offers the manual form', async ({ page }) => {
    const referrer = await createReferrer(`gone${t}.test`);

    await loginViaUi(page, referrer);
    await page.goto('/jobs/post');
    await page.getByPlaceholder('https://careers.company.com/jobs/...').fill(missingUrl);
    await page.getByRole('button', { name: 'Autofill' }).click();

    await expect(page.getByText('Could not read that URL automatically. Fill in the details below.')).toBeVisible();
    await expect(page.getByText(/details filled in/i)).toHaveCount(0);
    await expect(page.getByLabel('Job title *')).toHaveValue('');
    // The link they pasted is kept, so they only fill in the rest.
    await expect(page.getByLabel('Job link *')).toHaveValue(missingUrl);

    await disposeUsers(referrer);
  });
});

test.describe('Autofill input checks', { tag: ['@refer'] }, () => {
  test('with the link field empty, Autofill cannot be pressed', async ({ page }) => {
    const referrer = await createReferrer();
    await loginViaUi(page, referrer);
    await page.goto('/jobs/post');

    const autofill = page.getByRole('button', { name: 'Autofill' });
    await expect(autofill).toBeDisabled();
    await page.getByPlaceholder('https://careers.company.com/jobs/...').fill('   ');
    await page.getByPlaceholder('https://careers.company.com/jobs/...').fill('');
    await expect(autofill).toBeDisabled();

    await disposeUsers(referrer);
  });

  test('text that is not a link is refused with a message, and nothing is sent', async ({ page }) => {
    const referrer = await createReferrer();
    await loginViaUi(page, referrer);
    await page.goto('/jobs/post');

    let scraped = false;
    page.on('request', (r) => { if (r.url().endsWith('/api/jobs/scrape')) scraped = true; });
    await page.getByPlaceholder('https://careers.company.com/jobs/...').fill('careers.acme.com/backend-engineer');
    await page.getByRole('button', { name: 'Autofill' }).click();

    await expect(page.getByText('Enter a valid URL starting with http')).toBeVisible();
    await expect(page.getByLabel('Job title *')).toHaveCount(0); // still on the link step
    expect(scraped).toBe(false);

    await disposeUsers(referrer);
  });
});

test.describe('out of credits', { tag: ['@refer', '@credits'] }, () => {
  test('a referrer with no credits left is told so on screen, and nothing is posted', async ({ page }) => {
    const t = randomUUID().slice(0, 6);
    const referrer = await createReferrer(`spent${t}.test`);
    for (let i = 0; i < 5; i++) await createJob(referrer, { title: `Spent Role ${t} ${i}` });

    await loginViaUi(page, referrer);
    await expect(page.getByTestId('credit-balance')).toHaveText('0 credits available');
    await page.goto('/jobs/post');
    await page.getByRole('button', { name: 'Enter manually instead' }).click();
    await expect(page.getByText("You're out of credits.")).toBeVisible();

    await page.getByLabel('Job link *').fill(`https://spent${t}.test/careers/sixth`);
    await page.getByLabel('Job title *').fill(`Sixth Role ${t}`);
    await page.getByLabel('Company name *').fill(`spent${t}`);
    let posted = false;
    page.on('request', (r) => { if (r.url().endsWith('/api/jobs') && r.method() === 'POST') posted = true; });
    await page.getByRole('button', { name: 'Post Job' }).click();

    const modal = page.getByRole('dialog', { name: "You don't have enough credits" });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Contact support' })).toBeVisible();
    expect(posted).toBe(false);

    await disposeUsers(referrer);
  });
});

test.describe('switching a posting off and on', { tag: ['@refer', '@jobs'] }, () => {
  test('the switch on Jobs I Posted hides the posting from seekers, and brings it back', async ({ page }) => {
    const t = randomUUID().slice(0, 6);
    const referrer = await createReferrer(`toggle${t}.test`, { visibleInBrowse: true });
    const seeker = await createSeeker();
    const job = await createJob(referrer, { title: `Toggle Role ${t}` });
    const seekerSees = async () => {
      const res = await seeker.api.get(`/api/jobs?q=${encodeURIComponent(`Toggle Role ${t}`)}`);
      return ((await res.json()).data as unknown[]).length;
    };
    expect(await seekerSees()).toBe(1);

    await loginViaUi(page, referrer);
    await page.goto('/jobs/post');
    const card = page.getByTestId('my-posting').filter({ hasText: job.title });

    await card.getByRole('switch', { name: 'Deactivate job' }).click();
    await expect(page.getByText('Job deactivated')).toBeVisible();
    await expect(card.getByText('Inactive')).toBeVisible();
    await expect.poll(seekerSees).toBe(0);

    await card.getByRole('switch', { name: 'Reactivate job' }).click();
    await expect(page.getByText('Job reactivated')).toBeVisible();
    await expect(card.getByText('Active', { exact: true })).toBeVisible();
    await expect.poll(seekerSees).toBe(1);

    await disposeUsers(referrer, seeker);
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
