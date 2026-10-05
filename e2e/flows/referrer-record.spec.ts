import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { createSeeker, createReferrer, createJob, applyViaApi, loginViaUi, disposeUsers } from '../fixtures/seed';

/**
 * WHY THIS FILE — the referrer's response record, as a seeker sees it
 * (PRD US-R5, v7):
 *  - PROBLEM: the score is tested on the backend; whether a seeker ever sees
 *    it, and in honest words, was not. It is the one piece of information a
 *    seeker has when choosing between two referrers on the same role.
 *  - COST OF FAILURE: a ghosting referrer looks as good as one who answers
 *    everyone, so seekers waste their C.V. on the wrong person.
 *  - SUCCESS: a referrer with history shows "Answered N of M", a new one
 *    says so, on the job page and in the Send CV window alike.
 */

async function twoReferrersOneRole() {
  const t = randomUUID().slice(0, 6);
  const domain = `record${t}.test`;
  // Distinct names: the test tells the two apart by name on screen.
  const answers = await createReferrer(domain, { fullName: `Avi Answers ${t}` });
  const brandNew = await createReferrer(domain, { fullName: `Noa Newcomer ${t}` });
  const url = `https://${domain}/careers/${t}`;
  const jobA = await createJob(answers, { sourceUrl: url, title: `Site Reliability Engineer ${t}` });
  await createJob(brandNew, { sourceUrl: url, title: `Site Reliability Engineer ${t}` });

  // Give `answers` a track record: one earlier C.V., downloaded (an answer).
  const earlier = await createSeeker();
  const otherJob = await createJob(answers);
  const app = await applyViaApi(earlier, otherJob.id);
  expect((await answers.api.get(`/api/applications/${app.id}/cv`)).ok()).toBeTruthy();
  const fwd = await answers.api.patch(`/api/applications/${app.id}/status`, { data: { status: 'forwarded' } });
  expect(fwd.ok(), `forward: ${fwd.status()}`).toBeTruthy();

  return { answers, brandNew, earlier, jobA };
}

test.describe('response record in the Send CV window', { tag: ['@apply'] }, () => {
  test('shows "Answered 1 of 1" for a referrer with history, and "New referrer" for one without', async ({ page }) => {
    const { answers, brandNew, earlier, jobA } = await twoReferrersOneRole();
    const seeker = await createSeeker();

    await loginViaUi(page, seeker);
    await page.goto(`/jobs/${jobA.id}`);
    await page.getByTestId('open-send-cv').click();

    const modal = page.getByRole('dialog', { name: /request a referral/i });
    await expect(modal.getByRole('button', { name: new RegExp(answers.fullName) })).toContainText('Answered 1 of 1');
    await expect(modal.getByRole('button', { name: new RegExp(brandNew.fullName) })).toContainText('New referrer, no track record yet');

    await disposeUsers(answers, brandNew, earlier, seeker);
  });
});

test.describe('response record on the job page', { tag: ['@apply'] }, () => {
  test('uses the same honest wording as the Send CV window', async ({ page }) => {
    // Regression: the job page said "Responds N% of the time" over a number
    // that is a speed-weighted score, not a percentage (1 of 1 showed as 70%).
    const { answers, brandNew, earlier, jobA } = await twoReferrersOneRole();
    const seeker = await createSeeker();

    try {
      await loginViaUi(page, seeker);
      await page.goto(`/jobs/${jobA.id}`);

      const person = page.getByTestId('person-inside').filter({ hasText: answers.fullName });
      await expect(person).toContainText('Answered 1 of 1');
      await expect(person).not.toContainText(/% of the time/);
      await expect(page.getByTestId('person-inside').filter({ hasText: brandNew.fullName })).toContainText('New referrer, no track record yet');
    } finally {
      await disposeUsers(answers, brandNew, earlier, seeker);
    }
  });
});
