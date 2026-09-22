import { test, expect } from '@playwright/test';
import { createSeeker, createReferrer, createJob, disposeUsers, TEST_CV } from '../fixtures/seed';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the referral flow has more endings than "submitted internally".
 *    The referrer can decline, the seeker can withdraw, and either can talk to
 *    the other — and each ending has rules about WHEN it is allowed that only
 *    exist in the service layer. A wrong rule here either traps people in a
 *    state they should be able to leave, or lets them leave one they should not.
 *  - COST OF FAILURE: a seeker who cannot withdraw a C.V. they regret sending,
 *    or a referrer whose "not a fit" silently does nothing.
 *
 *  Deliberately NOT tagged @smoke. These are regression, not liveness — they
 *  run nightly and when their area changes, which is what makes the push
 *  gate's tag narrowing worth anything.
 */

async function applicationFor(seeker: Awaited<ReturnType<typeof createSeeker>>, job: { id: string; referrerId: string }) {
  const res = await seeker.api.post('/api/applications', {
    multipart: {
      jobId: job.id,
      referrerId: job.referrerId,
      cv: { name: TEST_CV.name, mimeType: TEST_CV.mimeType, buffer: TEST_CV.buffer },
    },
  });
  expect(res.ok(), `submit failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).data;
}

test.describe('referrer declines', { tag: ['@refer'] }, () => {
  test('"Not a fit" closes the application, and the seeker keeps their credits', async () => {
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const seeker = await createSeeker();
    const app = await applicationFor(seeker, job);

    const beforeRes = await seeker.api.get('/api/credits/balance');
    const before = beforeRes.ok() ? (await beforeRes.json()).data.total : 0;

    const res = await referrer.api.patch(`/api/applications/${app.id}/status`, { data: { status: 'rejected' } });
    expect(res.ok(), `decline failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    const after = await seeker.api.get(`/api/applications/${app.id}`);
    expect((await after.json()).data.application.status).toBe('rejected');

    // Applying is free and uncapped (PRD v15) — a decline must cost the
    // seeker nothing. What matters is that the balance is UNCHANGED, not that
    // it is zero: grantSignupCredits runs for every registration regardless of
    // role, so seekers are handed 5 credits they have no way to spend. Odd,
    // but not this test's business; a decline silently docking one would be.
    const balance = await seeker.api.get('/api/credits/balance');
    if (balance.ok()) expect((await balance.json()).data.total).toBe(before);

    await disposeUsers(referrer, seeker);
  });

  test('a stranger cannot decline someone else\'s application', async () => {
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const seeker = await createSeeker();
    const outsider = await createReferrer();
    const app = await applicationFor(seeker, job);

    const res = await outsider.api.patch(`/api/applications/${app.id}/status`, { data: { status: 'rejected' } });
    expect([403, 404]).toContain(res.status());

    await disposeUsers(referrer, seeker, outsider);
  });
});

test.describe('seeker withdraws', { tag: ['@apply'] }, () => {
  test('can pull a C.V. back before it has been opened', async () => {
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const seeker = await createSeeker();
    const app = await applicationFor(seeker, job);

    const res = await seeker.api.post(`/api/applications/${app.id}/withdraw`);
    expect(res.ok(), `withdraw failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    const after = await seeker.api.get(`/api/applications/${app.id}`);
    expect((await after.json()).data.application.status).toBe('withdrawn');

    await disposeUsers(referrer, seeker);
  });

  test('cannot withdraw once the referrer has downloaded it', async () => {
    // The honest boundary: once the C.V. is on someone else's machine,
    // "withdraw" would be a promise the product cannot keep.
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const seeker = await createSeeker();
    const app = await applicationFor(seeker, job);

    const download = await referrer.api.get(`/api/applications/${app.id}/cv`);
    expect(download.status()).toBe(200);

    const res = await seeker.api.post(`/api/applications/${app.id}/withdraw`);
    expect(res.status()).toBe(400);
    expect(await res.text()).toContain('ALREADY_VIEWED');

    await disposeUsers(referrer, seeker);
  });

  test('one seeker cannot withdraw another seeker\'s application', async () => {
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const owner = await createSeeker();
    const stranger = await createSeeker();
    const app = await applicationFor(owner, job);

    const res = await stranger.api.post(`/api/applications/${app.id}/withdraw`);
    expect([403, 404]).toContain(res.status());

    await disposeUsers(referrer, owner, stranger);
  });
});

test.describe('in-app messaging', { tag: ['@messaging'] }, () => {
  test('both sides can talk on an application, and each sees the thread', async () => {
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const seeker = await createSeeker();
    const app = await applicationFor(seeker, job);

    const fromSeeker = await seeker.api.post(`/api/applications/${app.id}/messages`, {
      data: { content: 'Happy to answer anything about my background.' },
    });
    expect(fromSeeker.status(), await fromSeeker.text()).toBe(201);

    const fromReferrer = await referrer.api.post(`/api/applications/${app.id}/messages`, {
      data: { content: 'Thanks, taking a look this week.' },
    });
    expect(fromReferrer.status()).toBe(201);

    for (const [who, user] of [['seeker', seeker], ['referrer', referrer]] as const) {
      const thread = (await (await user.api.get(`/api/applications/${app.id}/messages`)).json()).data.messages;
      expect(thread.length, `${who} cannot see the thread`).toBe(2);
      expect(thread.map((m: { content: string }) => m.content).join(' ')).toContain('background');
    }

    await disposeUsers(referrer, seeker);
  });

  test('an empty message is rejected', async () => {
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const seeker = await createSeeker();
    const app = await applicationFor(seeker, job);

    // 422, not 400: validate.ts raises UNPROCESSABLE for schema failures.
    const res = await seeker.api.post(`/api/applications/${app.id}/messages`, { data: { content: '' } });
    expect(res.status()).toBe(422);

    await disposeUsers(referrer, seeker);
  });

  test('an outsider can neither read nor post to the thread', async () => {
    // The thread carries a direct conversation about someone's job search.
    const referrer = await createReferrer();
    const job = await createJob(referrer);
    const seeker = await createSeeker();
    const outsider = await createSeeker();
    const app = await applicationFor(seeker, job);
    await seeker.api.post(`/api/applications/${app.id}/messages`, { data: { content: 'private' } });

    expect([403, 404]).toContain((await outsider.api.get(`/api/applications/${app.id}/messages`)).status());
    expect([403, 404]).toContain(
      (await outsider.api.post(`/api/applications/${app.id}/messages`, { data: { content: 'hello' } })).status(),
    );

    await disposeUsers(referrer, seeker, outsider);
  });
});
