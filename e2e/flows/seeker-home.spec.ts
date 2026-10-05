import { test, expect } from '@playwright/test';
import { createSeeker, createReferrer, createJob, applyViaApi, loginViaUi, disposeUsers, TEST_CV } from '../fixtures/seed';
import { backdateApplication } from '../fixtures/db';

/**
 * WHY THIS FILE — what a seeker sees after applying:
 *  - PROBLEM: the "Needs your attention" panel (PRD v12/v13), the messaging
 *    screen (US-S4) and the C.V. on file in the apply modal (v14) are all
 *    built and were only ever exercised through the API, if at all.
 *  - COST OF FAILURE: the seeker cannot see that the clock is running for
 *    them, cannot reach the referrer, or re-uploads the same PDF every time.
 *  - SUCCESS: the panel says whose move it is and which day it is, a message
 *    typed on screen reaches the referrer and the reply comes back, and the
 *    C.V. on file goes out without an upload.
 */

test.describe('Needs your attention', { tag: ['@apply'] }, () => {
  test('shows the application waiting on the referrer, and which day of five it is', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);
    await backdateApplication(application.id, 1); // one full day in → Day 2

    await loginViaUi(page, seeker);
    await page.goto('/feed');

    const panel = page.getByTestId('needs-attention');
    await expect(panel).toContainText('Your applications — waiting on a referrer');
    await expect(panel).toContainText(`Waiting on ${referrer.fullName} to respond`);
    await expect(panel).toContainText('Day 2 of 5');

    await disposeUsers(referrer, seeker);
  });

  test('shows the referrer the C.V. that needs their decision', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    await applyViaApi(seeker, job.id);

    await loginViaUi(page, referrer);
    await page.goto('/feed');

    const panel = page.getByTestId('needs-attention');
    await expect(panel).toContainText('CVs waiting on your review');
    await expect(panel).toContainText(`${seeker.fullName}'s CV needs a decision from you`);

    await disposeUsers(referrer, seeker);
  });
});

test.describe('messaging screen', { tag: ['@messaging'] }, () => {
  test('a message typed on screen reaches the referrer, and their reply shows up', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);

    await loginViaUi(page, seeker);
    await page.goto('/applications?tab=sent');
    await page.getByTestId('sent-application').filter({ hasText: job.title }).getByTestId('open-messages').click();

    const thread = page.getByRole('dialog', { name: new RegExp(`chat with`, 'i') });
    await thread.getByTestId('message-input').fill('Happy to walk you through my Kafka work.');
    await thread.getByTestId('send-message').click();
    await expect(thread.getByText('Happy to walk you through my Kafka work.')).toBeVisible();

    const seen = await referrer.api.get(`/api/applications/${application.id}/messages`);
    expect(JSON.stringify(await seen.json())).toContain('Kafka work');

    await referrer.api.post(`/api/applications/${application.id}/messages`, { data: { content: 'Great, sending it to HR today.' } });
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByTestId('sent-application').filter({ hasText: job.title }).getByTestId('open-messages').click();
    await expect(page.getByRole('dialog').getByText('Great, sending it to HR today.')).toBeVisible();

    await disposeUsers(referrer, seeker);
  });
});

test.describe('the C.V. on file', { tag: ['@apply'] }, () => {
  test('pre-fills the apply modal and is sent without uploading anything', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const upload = await seeker.api.post('/api/users/me/cv', {
      multipart: { cv: { name: 'my-profile-cv.pdf', mimeType: TEST_CV.mimeType, buffer: TEST_CV.buffer } },
    });
    expect(upload.ok(), `profile CV upload: ${upload.status()}`).toBeTruthy();

    await loginViaUi(page, seeker);
    await page.goto(`/jobs/${job.id}`);
    await page.getByTestId('open-send-cv').click();

    const modal = page.getByRole('dialog', { name: /request a referral/i });
    await expect(modal.getByText('my-profile-cv.pdf')).toBeVisible();
    await expect(modal.getByText(/from your profile/i)).toBeVisible();
    await expect(modal.getByTestId('cv-file-input')).toHaveCount(0);

    const submitted = page.waitForResponse((r) => r.url().endsWith('/api/applications') && r.request().method() === 'POST');
    await modal.getByTestId('submit-cv').click();
    expect((await submitted).status()).toBe(201);

    const inbox = await (await referrer.api.get('/api/applications/inbox')).json();
    const received = inbox.data.find((r: { job: { id: string } }) => r.job.id === job.id);
    expect(received?.application.cvOriginalName).toBe('my-profile-cv.pdf');

    await disposeUsers(referrer, seeker);
  });
});
