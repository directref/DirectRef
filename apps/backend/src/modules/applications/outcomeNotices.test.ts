import { describe, it, expect } from 'vitest';
import {
  sendCVDownloadedEmail, sendInternallySubmittedEmail, sendNewMessageEmail, sendCVNotificationEmail, sendCVRejectedEmail,
} from '../../services/email';
import { makeScenario, makeReferrer, makeSeeker, makeJob } from '../../test/factories';
import { useServer, as, pdf, waitForNotification } from '../../test/http';

/**
 * WHY THIS FILE:
 *  - PROBLEM: "never silence" is only true if the seeker is actually told.
 *    The status changes were tested; the telling was not — no test checked a
 *    single notification or email on the decision path, on messages, or on
 *    the notifications page itself.
 *  - COST OF FAILURE: the referrer does everything right and the seeker
 *    still hears nothing, which is indistinguishable from being ghosted —
 *    the exact failure the product promises away.
 *  - SUCCESS: every referrer decision reaches the seeker, every message
 *    reaches the other side, and threads stay open after an application ends.
 */

const { base } = useServer();

const patchStatus = (referrerId: string, id: string, status: string) =>
  as(base, referrerId).patch(`/api/applications/${id}/status`, { status });

describe('the seeker hears about every decision', () => {
  it('a new C.V. reaches the referrer in the app and by email', async () => {
    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);

    await as(base, seeker.id).upload('/api/applications', { jobId: job.id }, { name: 'cv.pdf', bytes: pdf() });

    expect(await waitForNotification(referrer.id, 'cv_received')).toHaveLength(1);
    expect(sendCVNotificationEmail).toHaveBeenCalledWith(
      referrer.email, referrer.fullName, seeker.fullName, job.title, job.companyName, expect.stringContaining('/applications/inbox'),
    );
  });

  it('"Not a fit": the seeker is told in the app and by email', async () => {
    // The email was added 2026-10-04 — a decline is an answer too.
    const { referrer, seeker, application } = await makeScenario({ status: 'viewed' });

    expect((await patchStatus(referrer.id, application.id, 'rejected')).status).toBe(200);

    const [note] = await waitForNotification(seeker.id, 'cv_rejected');
    expect(note.title).toContain(referrer.fullName);
    expect(sendCVRejectedEmail).toHaveBeenCalledWith(
      seeker.email, seeker.fullName, referrer.fullName, expect.any(String), expect.any(String), expect.stringContaining('/applications'),
    );
  });

  it('the referrer downloads the C.V.: the seeker is told in the app and by email', async () => {
    const { referrer, seeker, application } = await makeScenario({ status: 'viewed' });

    await patchStatus(referrer.id, application.id, 'forwarded');

    expect(await waitForNotification(seeker.id, 'cv_forwarded')).toHaveLength(1);
    expect(sendCVDownloadedEmail).toHaveBeenCalledWith(
      seeker.email, seeker.fullName, referrer.fullName, expect.any(String), expect.any(String), expect.any(String),
    );
  });

  it('"Submitted": the seeker is told in the app and by email', async () => {
    const { referrer, seeker, application } = await makeScenario({ status: 'forwarded', forwardedAt: new Date() });

    await patchStatus(referrer.id, application.id, 'internally_submitted');

    const [note] = await waitForNotification(seeker.id, 'cv_internally_submitted');
    expect(note.title).toContain(referrer.fullName);
    expect(sendInternallySubmittedEmail).toHaveBeenCalledWith(
      seeker.email, seeker.fullName, referrer.fullName, expect.any(String), expect.any(String), expect.any(String),
    );
  });

  it('a decision on a closed application is refused, so the seeker never gets two contradicting notices', async () => {
    const { referrer, application } = await makeScenario({ status: 'rejected' });
    expect((await patchStatus(referrer.id, application.id, 'internally_submitted')).status).toBe(400);
  });
});

describe('messages', () => {
  it('a new message notifies the other side in the app and by email, linking to that thread', async () => {
    const { referrer, seeker, application } = await makeScenario();

    await as(base, seeker.id).post(`/api/applications/${application.id}/messages`, { content: 'Happy to share more about my Kafka work.' });

    const [note] = await waitForNotification(referrer.id, 'application_message');
    expect(note.body).toContain('Kafka');
    expect(note.linkUrl).toContain(`openMessage=${application.id}`);
    await expect.poll(() => (sendNewMessageEmail as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
  });

  it('the thread stays open after "Not a fit" — the seeker can still ask for feedback', async () => {
    const { referrer, seeker, application } = await makeScenario({ status: 'rejected' });

    const fromSeeker = await as(base, seeker.id).post(`/api/applications/${application.id}/messages`, { content: 'Any feedback for next time?' });
    const fromReferrer = await as(base, referrer.id).post(`/api/applications/${application.id}/messages`, { content: 'They wanted more Go.' });

    expect(fromSeeker.status).toBe(201);
    expect(fromReferrer.status).toBe(201);
  });

  it('the thread stays open after an auto-close and after "Submitted" too', async () => {
    for (const status of ['expired', 'internally_submitted']) {
      const { seeker, application } = await makeScenario({ status });
      const res = await as(base, seeker.id).post(`/api/applications/${application.id}/messages`, { content: 'Following up.' });
      expect(res.status, status).toBe(201);
    }
  });
});

describe('the notifications page', () => {
  async function withThree() {
    const user = await makeSeeker();
    const { createNotification } = await import('../notifications/notifications.service');
    for (const title of ['first', 'second', 'third']) {
      await createNotification(user.id, 'cv_viewed', title, 'body');
      await new Promise((r) => setTimeout(r, 5));
    }
    return user;
  }
  const list = async (id: string) => (await (await as(base, id).get('/api/notifications')).json() as any).data as Array<{ id: string; title: string; isRead: boolean }>;
  const unread = async (id: string) => (await (await as(base, id).get('/api/notifications/unread-count')).json() as any).data.count as number;

  it('lists my notifications newest first, with an unread count', async () => {
    const user = await withThree();
    expect((await list(user.id)).map((n) => n.title)).toEqual(['third', 'second', 'first']);
    expect(await unread(user.id)).toBe(3);
  });

  it('opening one marks just that one read', async () => {
    const user = await withThree();
    const [newest] = await list(user.id);
    expect((await as(base, user.id).patch(`/api/notifications/${newest.id}/read`)).status).toBe(204);
    expect(await unread(user.id)).toBe(2);
  });

  it('"Mark all as read" clears the count', async () => {
    const user = await withThree();
    expect((await as(base, user.id).patch('/api/notifications/read-all')).status).toBe(204);
    expect(await unread(user.id)).toBe(0);
  });

  it('nobody sees, or can mark, anyone else\'s notifications', async () => {
    const owner = await withThree();
    const other = await makeReferrer();
    const [one] = await list(owner.id);

    expect(await list(other.id)).toEqual([]);
    await as(base, other.id).patch(`/api/notifications/${one.id}/read`);
    expect(await unread(owner.id)).toBe(3);
  });
});
