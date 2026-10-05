import { test, expect, Page } from '@playwright/test';
import { createSeeker, createReferrer, createJob, applyViaApi, loginViaUi, disposeUsers, TestUser } from '../fixtures/seed';

/**
 * WHY THIS FILE — the referrer's CV inbox, clicked the way a referrer does
 * (PRD US-R2, US-R3):
 *  - PROBLEM: "Download", "Submitted" and "Not a fit" are the referrer's half
 *    of the product's promise. Their rules were tested through the API, but
 *    no test ever pressed the buttons — a broken button passed everything.
 *  - COST OF FAILURE: a referrer who tries to answer and can't looks exactly
 *    like a referrer who ghosted. The seeker waits five days for nothing.
 *  - SUCCESS: the inbox shows who applied, for what, with what note and
 *    when; each button moves the application to the right state, and the
 *    seeker sees that state.
 */

async function openInbox(page: Page, referrer: TestUser, seekerName: string) {
  await loginViaUi(page, referrer);
  await page.goto('/applications?tab=received');
  await page.getByTestId('inbox-row').filter({ hasText: seekerName }).click();
  return page.getByTestId('inbox-detail');
}

const statusSeenBy = async (user: TestUser, id: string) =>
  (await (await user.api.get(`/api/applications/${id}`)).json()).data.application.status as string;

test.describe('referrer CV inbox', { tag: ['@refer'] }, () => {
  test('shows the seeker, the role, their note, the CV and when they applied', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer, { title: 'Backend Engineer, Payments' });
    await applyViaApi(seeker, job.id, { coverNote: 'Five years on payment ledgers at a fintech.' });

    await loginViaUi(page, referrer);
    await page.goto('/applications?tab=received');

    const row = page.getByTestId('inbox-row').filter({ hasText: seeker.fullName });
    await expect(row).toContainText('Backend Engineer, Payments');
    await expect(row).toContainText('Five years on payment ledgers');
    await expect(row).toContainText('Today');
    await expect(row.getByTestId('inbox-row-status')).toHaveText('Awaiting review');

    await row.click();
    const detail = page.getByTestId('inbox-detail');
    await expect(detail).toContainText(seeker.fullName);
    await expect(detail).toContainText('Backend Engineer, Payments');
    await expect(detail).toContainText('Five years on payment ledgers at a fintech.');
    await expect(detail).toContainText('test-cv.pdf');

    await disposeUsers(referrer, seeker);
  });

  test('Download, then "Submitted": the application ends up submitted internally', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);

    const detail = await openInbox(page, referrer, seeker.fullName);

    const download = page.waitForEvent('download');
    await detail.getByTestId('inbox-download').click();
    expect((await download).suggestedFilename()).toBe('test-cv.pdf');
    await expect(detail).toContainText('Did you submit this to your internal system yet?');
    await expect.poll(() => statusSeenBy(seeker, application.id)).toBe('forwarded');

    await detail.getByTestId('inbox-submitted').click();

    await expect(detail.getByTestId('inbox-outcome')).toHaveText(/submitted internally/i);
    await expect.poll(() => statusSeenBy(seeker, application.id)).toBe('internally_submitted');

    await disposeUsers(referrer, seeker);
  });

  test('"Not a fit" on a new C.V. closes it, and the seeker sees the answer', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);

    const detail = await openInbox(page, referrer, seeker.fullName);
    await detail.getByTestId('inbox-not-a-fit').click();

    await expect(detail.getByTestId('inbox-outcome')).toHaveText(/marked not a fit/i);
    await expect(detail.getByTestId('inbox-download')).toHaveCount(0);
    await expect.poll(() => statusSeenBy(seeker, application.id)).toBe('rejected');

    await disposeUsers(referrer, seeker);
  });

  test('"Not a fit" after downloading is still possible', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);

    const detail = await openInbox(page, referrer, seeker.fullName);
    const download = page.waitForEvent('download');
    await detail.getByTestId('inbox-download').click();
    await download;
    await expect(detail.getByTestId('inbox-submitted')).toBeVisible();

    await detail.getByTestId('inbox-not-a-fit').click();

    await expect(detail.getByTestId('inbox-outcome')).toHaveText(/marked not a fit/i);
    await expect.poll(() => statusSeenBy(seeker, application.id)).toBe('rejected');

    await disposeUsers(referrer, seeker);
  });

  test('a C.V. the seeker withdrew is shown as withdrawn, with nothing to decide', async ({ page }) => {
    const referrer = await createReferrer();
    const seeker = await createSeeker();
    const job = await createJob(referrer);
    const application = await applyViaApi(seeker, job.id);
    await seeker.api.post(`/api/applications/${application.id}/withdraw`);

    await loginViaUi(page, referrer);
    await page.goto('/applications?tab=received');
    // Withdrawn ones sit under the "All" chip rather than the default view.
    await page.getByRole('button', { name: /^all/i }).first().click();
    await page.getByTestId('inbox-row').filter({ hasText: seeker.fullName }).click();

    const detail = page.getByTestId('inbox-detail');
    await expect(detail.getByTestId('inbox-outcome')).toHaveText(/withdrawn by the seeker/i);
    await expect(detail.getByTestId('inbox-download')).toHaveCount(0);
    await expect(detail.getByTestId('inbox-not-a-fit')).toHaveCount(0);

    await disposeUsers(referrer, seeker);
  });
});
