import { test, expect } from '@playwright/test';
import { createSeeker, createReferrer, createJob, applyViaApi, loginViaUi, disposeUsers, TEST_CV } from '../fixtures/seed';

/**
 * WHY THIS FILE — the withdraw flow, as a seeker actually does it:
 *  - PROBLEM: lifecycle.spec.ts proves the server rule (withdraw before the
 *    referrer opens the C.V., never after) by calling the API. Nothing proved
 *    the Withdraw button on "Sent CVs" exists, asks for confirmation, and
 *    disappears at the right moment — the part a person touches.
 *  - COST OF FAILURE: a seeker who regrets sending a C.V. (wrong file, wrong
 *    role) has no way to pull it back; or the button still shows after the
 *    referrer downloaded it and fails with an error.
 *  - SUCCESS: Withdraw is offered only while the C.V. is unopened, confirming
 *    it marks the card Withdrawn, and the referrer can no longer act on it.
 */

test.describe('withdraw flow', { tag: ['@apply'] }, () => {
  test('a seeker withdraws a C.V. the referrer has not opened yet', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);

    await loginViaUi(page, seeker);
    await page.goto('/applications?tab=sent');

    const card = page.getByTestId('sent-application').filter({ hasText: job.title });
    await expect(card.getByTestId('application-status')).toHaveText('Pending');

    await card.getByTestId('withdraw-application').click();
    const confirm = page.getByRole('dialog', { name: /withdraw this application/i });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Withdraw' }).click();

    await expect(card.getByTestId('application-status')).toHaveText('Withdrawn');
    await expect(card.getByTestId('withdraw-application')).toHaveCount(0);

    // The referrer sees it as withdrawn and can no longer decide on it.
    const seen = await (await referrer.api.get(`/api/applications/${application.id}`)).json();
    expect(seen.data.application.status).toBe('withdrawn');
    const decide = await referrer.api.patch(`/api/applications/${application.id}/status`, { data: { status: 'rejected' } });
    expect(decide.status()).toBe(400);

    await disposeUsers(referrer, seeker);
  });

  test('after withdrawing, the seeker can send a C.V. to the same role again', async ({ page }) => {
    // Product decision 2026-10-04: withdrawn before the referrer opened it
    // means the referrer never saw it — the role is open to this seeker again.
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);
    expect((await seeker.api.post(`/api/applications/${application.id}/withdraw`)).ok()).toBeTruthy();

    await loginViaUi(page, seeker);
    await page.goto(`/jobs/${job.id}`);
    await page.getByTestId('open-send-cv').click();
    await page.getByTestId('cv-file-input').setInputFiles({ name: TEST_CV.name, mimeType: TEST_CV.mimeType, buffer: TEST_CV.buffer });
    const sent = page.waitForResponse((r) => r.url().endsWith('/api/applications') && r.request().method() === 'POST');
    await page.getByTestId('submit-cv').click();
    expect((await sent).status()).toBe(201);

    await page.goto('/applications?tab=sent');
    await expect(page.getByTestId('sent-application').filter({ hasText: job.title }).getByTestId('application-status')).toHaveText('Pending');

    await disposeUsers(referrer, seeker);
  });

  test('cancelling the confirmation keeps the application', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    await applyViaApi(seeker, job.id);

    await loginViaUi(page, seeker);
    await page.goto('/applications?tab=sent');
    const card = page.getByTestId('sent-application').filter({ hasText: job.title });

    await card.getByTestId('withdraw-application').click();
    await page.getByRole('dialog').getByRole('button', { name: /cancel/i }).click();

    await expect(card.getByTestId('application-status')).toHaveText('Pending');
    await expect(card.getByTestId('withdraw-application')).toBeVisible();

    await disposeUsers(referrer, seeker);
  });

  test('once the referrer downloads the C.V., Withdraw is no longer offered', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);
    expect((await referrer.api.get(`/api/applications/${application.id}/cv`)).status()).toBe(200);
    // Opening the C.V. flips it to 'viewed' just after the response is sent;
    // wait for that rather than racing the page load.
    await expect.poll(async () =>
      (await (await seeker.api.get(`/api/applications/${application.id}`)).json()).data.application.status,
    ).toBe('viewed');

    await loginViaUi(page, seeker);
    await page.goto('/applications?tab=sent');
    const card = page.getByTestId('sent-application').filter({ hasText: job.title });

    await expect(card.getByTestId('application-status')).toHaveText('Reviewed');
    await expect(card.getByTestId('withdraw-application')).toHaveCount(0);

    await disposeUsers(referrer, seeker);
  });
});
