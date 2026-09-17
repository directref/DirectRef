import { test, expect } from '@playwright/test';
import { createSeeker, createReferrer, createJob, loginViaUi, disposeUsers, TEST_CV } from '../fixtures/seed';

/**
 * WHY THIS FILE:
 *  - PROBLEM: this is the product. A seeker sends a C.V. through a referrer,
 *    the referrer reads it and marks it submitted. Everything else — the
 *    clocks, the credits, retention — exists to support this one path.
 *  - COST OF FAILURE: total. If a C.V. cannot be sent or cannot be read,
 *    DirectRef does nothing at all, and its one promise is broken silently.
 *  - NOTE: WRITES. Never runs against production — a test posting would land
 *    in the live feed. Prerequisites (verified referrer, live job) are seeded
 *    through the real API rather than driven through the UI, so a failure here
 *    always points at the flow under test and not at its setup.
 */

test.describe('the referral flow @apply @refer @smoke', () => {
  test('a seeker sends a C.V., and the referrer receives it and marks it submitted', async ({ page, browser }) => {
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const seeker = await createSeeker();

    // ── Seeker sends the C.V. ────────────────────────────────────────────────
    await loginViaUi(page, seeker);
    await page.goto(`/jobs/${job.id}`);

    await expect(page.getByRole('heading', { name: new RegExp(job.title, 'i') }).first()).toBeVisible();

    await page.getByTestId('open-send-cv').click();
    await page.getByTestId('cv-file-input').setInputFiles({
      name: TEST_CV.name,
      mimeType: TEST_CV.mimeType,
      buffer: TEST_CV.buffer,
    });
    // Arm the waiter BEFORE clicking, then await it — clicking and immediately
    // querying the API is a race the test loses under parallel load.
    const submitted = page.waitForResponse(
      (r) => r.url().includes('/api/applications') && r.request().method() === 'POST',
    );
    await page.getByTestId('submit-cv').click();
    const submitRes = await submitted;
    expect(submitRes.status(), `submit returned ${submitRes.status()}`).toBe(201);

    // Applying is free and uncapped — no paywall, no credit prompt. The
    // credit gate lives on the referrer's posting, not the seeker's
    // application (PRD v15), and a regression that moved it here would be
    // invisible except as seekers quietly hitting a wall.
    await expect(page.getByText(/out of credits|buy credits|upgrade/i)).toHaveCount(0);

    // The application must now exist and be visible to its owner.
    const mine = await seeker.api.get('/api/applications/mine');
    expect(mine.ok()).toBeTruthy();
    // Every controller wraps its payload as { data }.
    const applications = (await mine.json()).data;
    expect(applications.length, 'the seeker should see their own application').toBeGreaterThan(0);

    // ── Referrer receives it ─────────────────────────────────────────────────
    const inbox = await referrer.api.get('/api/applications/inbox');
    expect(inbox.ok()).toBeTruthy();
    // getInbox returns joined rows shaped { application, job, seeker } — the id
    // lives on .application, not on the row.
    const received = (await inbox.json()).data;
    expect(received.length, 'the referrer should see the application').toBeGreaterThan(0);

    const applicationId = received[0].application.id;

    // The C.V. must come back as a real file — this is the whole payload of
    // the product, and it travels through multer to disk and back.
    const cv = await referrer.api.get(`/api/applications/${applicationId}/cv`);
    expect(cv.status(), 'referrer must be able to download the C.V.').toBe(200);
    expect((await cv.body()).length).toBeGreaterThan(0);

    // ── Referrer marks it submitted ──────────────────────────────────────────
    // The state machine requires 'forwarded' first — confirming internal
    // submission is only meaningful once the C.V. actually left, and
    // 'forwarded' is what stamps forwardedAt and starts Clock B. Skipping
    // straight to internally_submitted is rejected, which is worth pinning:
    const tooSoon = await referrer.api.patch(`/api/applications/${applicationId}/status`, {
      data: { status: 'internally_submitted' },
    });
    expect(tooSoon.status(), 'must not confirm submission before forwarding').toBe(400);

    const forward = await referrer.api.patch(`/api/applications/${applicationId}/status`, {
      data: { status: 'forwarded' },
    });
    expect(forward.ok(), `forward failed: ${forward.status()} ${await forward.text()}`).toBeTruthy();

    const update = await referrer.api.patch(`/api/applications/${applicationId}/status`, {
      data: { status: 'internally_submitted' },
    });
    expect(update.ok(), `status update failed: ${update.status()} ${await update.text()}`).toBeTruthy();

    const after = await referrer.api.get(`/api/applications/${applicationId}`);
    expect((await after.json()).data.application.status).toBe('internally_submitted');

    await disposeUsers(referrer, seeker);
  });

  test('a seeker cannot read another seeker\'s application', async ({ browser }) => {
    // Applications carry a C.V. and a cover note — the most sensitive thing on
    // the platform. An IDOR here leaks one person's job search to another.
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const owner = await createSeeker();
    const stranger = await createSeeker();

    const submit = await owner.api.post('/api/applications', {
      multipart: {
        jobId: job.id,
        referrerId: job.referrerId as string,
        cv: { name: TEST_CV.name, mimeType: TEST_CV.mimeType, buffer: TEST_CV.buffer },
      },
    });
    expect(submit.ok(), `submit failed: ${submit.status()} ${await submit.text()}`).toBeTruthy();
    const applicationId = (await submit.json()).data.id;

    const peek = await stranger.api.get(`/api/applications/${applicationId}`);
    expect([403, 404], `stranger GET returned ${peek.status()}`).toContain(peek.status());

    const peekCv = await stranger.api.get(`/api/applications/${applicationId}/cv`);
    expect([403, 404], 'a stranger must not download the C.V.').toContain(peekCv.status());

    await disposeUsers(referrer, owner, stranger);
  });
});
