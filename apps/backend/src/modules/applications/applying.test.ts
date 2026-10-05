import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { applications } from '../../db/schema';
import { makeReferrer, makeSeeker, makeJob, makeApplication, makeScenario } from '../../test/factories';
import { markViewedIfNew } from './applications.service';
import { useServer, as, pdf, waitForNotification } from '../../test/http';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the apply step has rules the browser test never reaches: one
 *    application per role, the C.V. on file (PRD v14) and its promise that a
 *    sent C.V. never changes afterwards, and the referrer's in-browser
 *    preview. All built, none tested.
 *  - COST OF FAILURE: a referrer flooded with the same seeker twice; a
 *    seeker who updates their C.V. and silently rewrites what a referrer is
 *    already holding; a preview that leaks a C.V. to a stranger.
 *  - SUCCESS: every application holds its own frozen copy of the C.V. it was
 *    sent with, and only the two people on it can open it.
 */

const { base } = useServer();

async function scenario() {
  const referrer = await makeReferrer();
  const seeker = await makeSeeker();
  const job = await makeJob(referrer.id);
  return { referrer, seeker, job, seekerApi: as(base, seeker.id), referrerApi: as(base, referrer.id) };
}

const apply = (api: ReturnType<typeof as>, jobId: string, fields: Record<string, string> = {}, bytes?: Buffer) =>
  api.upload('/api/applications', { jobId, ...fields }, bytes ? { name: 'cv.pdf', bytes } : undefined);

const appId = async (res: Response) => (await res.json() as any).data.id as string;
const bytesOf = async (res: Response) => Buffer.from(await res.arrayBuffer());

describe('one application per seeker per role', () => {
  it('a second application to the same role is refused, and the first is untouched', async () => {
    const { seekerApi, job } = await scenario();
    const first = await apply(seekerApi, job.id, {}, pdf('first'));
    expect(first.status).toBe(201);

    const second = await apply(seekerApi, job.id, {}, pdf('second'));

    expect(second.status).toBe(409);
    expect(JSON.stringify(await second.json() as any)).toContain('ALREADY_APPLIED');
    expect(await db.select().from(applications)).toHaveLength(1);
  });

  // Product decision 2026-10-04: a C.V. withdrawn before the referrer opened
  // it may be sent again. Once the referrer has it, the role stays closed.
  it('after withdrawing an unopened C.V., the seeker can apply again — with a fresh clock', async () => {
    const { referrer, seekerApi, referrerApi, job } = await scenario();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf('first')));
    await seekerApi.post(`/api/applications/${id}/withdraw`);
    await db.update(applications).set({ createdAt: new Date(Date.now() - 3 * 86_400_000) }).where(eq(applications.id, id));

    const again = await apply(seekerApi, job.id, { coverNote: 'Updated CV attached.' }, pdf('second'));

    expect(again.status).toBe(201);
    const rows = await db.select().from(applications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'submitted', withdrawnAt: null, coverNote: 'Updated CV attached.' });
    expect(Date.now() - rows[0].createdAt.getTime()).toBeLessThan(60_000);
    expect((await bytesOf(await referrerApi.get(`/api/applications/${rows[0].id}/cv`))).equals(pdf('second'))).toBe(true);
    expect((await waitForNotification(referrer.id, 'cv_received')).length).toBeGreaterThanOrEqual(2);
  });

  it('once the referrer has opened the C.V., the seeker cannot apply again', async () => {
    const { seekerApi, referrerApi, job } = await scenario();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf()));
    await referrerApi.get(`/api/applications/${id}/cv`);
    await waitForStatus(id, 'viewed');

    expect((await apply(seekerApi, job.id, {}, pdf())).status).toBe(409);
  });

  it('whatever the referrer answered, the seeker cannot apply again', async () => {
    for (const status of ['rejected', 'forwarded', 'internally_submitted', 'expired']) {
      const { referrer, seeker, job } = await scenario();
      await makeApplication({ jobId: job.id, seekerId: seeker.id, referrerId: referrer.id, status });
      const res = await apply(as(base, seeker.id), job.id, {}, pdf());
      expect(res.status, status).toBe(409);
    }
  });

  it('a referrer cannot apply to their own posting', async () => {
    const { referrerApi, job } = await scenario();
    expect((await apply(referrerApi, job.id, {}, pdf())).status).toBe(400);
  });
});

describe('the C.V. on file', () => {
  it('can be used to apply without uploading anything', async () => {
    const { seekerApi, referrerApi, job } = await scenario();
    await seekerApi.upload('/api/users/me/cv', {}, { name: 'profile.pdf', bytes: pdf('profile') });

    const res = await apply(seekerApi, job.id, { useProfileCv: 'true' });
    expect(res.status).toBe(201);

    const download = await referrerApi.get(`/api/applications/${await appId(res)}/cv`);
    expect(download.status).toBe(200);
    expect((await bytesOf(download)).equals(pdf('profile'))).toBe(true);
  });

  it('applying "with the C.V. on file" when there is none is refused clearly', async () => {
    const { seekerApi, job } = await scenario();
    const res = await apply(seekerApi, job.id, { useProfileCv: 'true' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json() as any)).toContain('NO_PROFILE_CV');
  });

  it('replacing it later does not change the C.V. a referrer already has', async () => {
    const { seekerApi, referrerApi, job } = await scenario();
    await seekerApi.upload('/api/users/me/cv', {}, { name: 'v1.pdf', bytes: pdf('version-1') });
    const id = await appId(await apply(seekerApi, job.id, { useProfileCv: 'true' }));

    await seekerApi.upload('/api/users/me/cv', {}, { name: 'v2.pdf', bytes: pdf('version-2') });

    const sent = await bytesOf(await referrerApi.get(`/api/applications/${id}/cv`));
    expect(sent.equals(pdf('version-1'))).toBe(true);
    const onFile = await bytesOf(await seekerApi.get('/api/users/me/cv'));
    expect(onFile.equals(pdf('version-2'))).toBe(true);
  });

  it('removing it does not take the C.V. away from a referrer who has it', async () => {
    const { seekerApi, referrerApi, job } = await scenario();
    await seekerApi.upload('/api/users/me/cv', {}, { name: 'v1.pdf', bytes: pdf('version-1') });
    const id = await appId(await apply(seekerApi, job.id, { useProfileCv: 'true' }));

    expect((await seekerApi.del('/api/users/me/cv')).status).toBeLessThan(300);

    expect((await referrerApi.get(`/api/applications/${id}/cv`)).status).toBe(200);
    expect((await seekerApi.get('/api/users/me/cv')).status).toBe(404);
  });

  it('a seeker can swap the C.V. on an application the referrer has not opened yet', async () => {
    const { seekerApi, referrerApi, job } = await scenario();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf('typo')));

    const swap = await seekerApi.upload(`/api/applications/${id}/cv`, {}, { name: 'fixed.pdf', bytes: pdf('fixed') }, 'PATCH');
    expect(swap.status).toBe(200);
    expect((await bytesOf(await referrerApi.get(`/api/applications/${id}/cv`))).equals(pdf('fixed'))).toBe(true);
  });

  it('but not once the referrer has opened it', async () => {
    const { seekerApi, referrerApi, job } = await scenario();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf('original')));
    await referrerApi.get(`/api/applications/${id}/cv/preview`);
    await waitForStatus(id, 'viewed');

    const swap = await seekerApi.upload(`/api/applications/${id}/cv`, {}, { name: 'late.pdf', bytes: pdf('late') }, 'PATCH');
    expect(swap.status).toBe(400);
  });
});

async function waitForStatus(id: string, status: string) {
  for (let i = 0; i < 60; i++) {
    const [row] = await db.select().from(applications).where(eq(applications.id, id));
    if (row?.status === status) {
      // Opening a C.V. flips the status and THEN notifies the seeker, both
      // after the response has gone out. Wait for the notice too, or its
      // insert can still be running when the next test truncates the tables
      // ("deadlock detected", roughly one run in four).
      if (status === 'viewed' && !(await waitForNotification(row.seekerId, 'cv_viewed')).length) break;
      return;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`application ${id} never reached status '${status}'`);
}

describe('the withdraw window', () => {
  // The user-facing rule: a seeker can pull a C.V. back until the referrer
  // OPENS it — and a quick in-browser preview counts as opening, not only a
  // download. lifecycle.spec.ts covers the download case.
  it('a seeker can withdraw an unopened C.V., and the referrer is told', async () => {
    const { referrer, seekerApi, job } = await scenario();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf()));

    expect((await seekerApi.post(`/api/applications/${id}/withdraw`)).status).toBe(200);
    expect(await waitForNotification(referrer.id, 'cv_withdrawn')).toHaveLength(1);
  });

  it('once the referrer has previewed it, withdrawing is refused', async () => {
    const { seekerApi, referrerApi, job } = await scenario();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf()));
    await referrerApi.get(`/api/applications/${id}/cv/preview`);
    await waitForStatus(id, 'viewed');

    const res = await seekerApi.post(`/api/applications/${id}/withdraw`);
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain('ALREADY_VIEWED');
  });
});

describe('previewing a C.V. in the browser', () => {
  it('shows the referrer the PDF inline, marks it viewed, and tells the seeker', async () => {
    const { seeker, seekerApi, referrerApi, job } = await scenario();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf('preview')));

    const res = await referrerApi.get(`/api/applications/${id}/cv/preview`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    expect(res.headers.get('content-disposition') ?? 'inline').not.toContain('attachment');
    expect((await bytesOf(res)).equals(pdf('preview'))).toBe(true);
    await waitForStatus(id, 'viewed');
    expect((await db.select().from(applications).where(eq(applications.id, id)))[0].status).toBe('viewed');
    expect(await waitForNotification(seeker.id, 'cv_viewed')).toHaveLength(1);
  });

  it('nobody outside the application can preview it', async () => {
    const { seekerApi, job } = await scenario();
    const stranger = await makeSeeker();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf()));

    expect([403, 404]).toContain((await as(base, stranger.id).get(`/api/applications/${id}/cv/preview`)).status);
    expect((await as(base, null).get(`/api/applications/${id}/cv/preview`)).status).toBe(401);
  });
});

describe('opening a C.V. never undoes a later decision', () => {
  // Regression, found by referrer-inbox.spec.ts: the Download button sends
  // PATCH forwarded and the browser starts the file request milliseconds
  // later, so the download read 'submitted' while 'forwarded' was being
  // written, then its unconditional "mark viewed" landed second and reverted
  // the application. The interleaving is timing-dependent, so these tests
  // pin the rule that makes it impossible: the write itself only changes a
  // C.V. that is still 'submitted'.
  it.each(['forwarded', 'internally_submitted', 'rejected', 'withdrawn', 'expired'])(
    'a stale "mark viewed" leaves a %s application alone',
    async (status) => {
      const { application, seeker } = await makeScenario({ status });

      expect(await markViewedIfNew(application.id)).toBe(false);

      expect((await db.select().from(applications).where(eq(applications.id, application.id)))[0].status).toBe(status);
      expect(await waitForNotification(seeker.id, 'cv_viewed', 200)).toHaveLength(0);
    },
  );

  it('a new C.V. becomes viewed, and the seeker is told once', async () => {
    const { application, seeker } = await makeScenario({ status: 'submitted' });

    expect(await markViewedIfNew(application.id)).toBe(true);
    expect(await markViewedIfNew(application.id)).toBe(false);

    const [row] = await db.select().from(applications).where(eq(applications.id, application.id));
    expect(row.status).toBe('viewed');
    expect(row.viewedAt).not.toBeNull();
    expect(await waitForNotification(seeker.id, 'cv_viewed')).toHaveLength(1);
  });

  it('previewing after a decision does not reopen it', async () => {
    const { seekerApi, referrerApi, job } = await scenario();
    const id = await appId(await apply(seekerApi, job.id, {}, pdf()));
    await referrerApi.patch(`/api/applications/${id}/status`, { status: 'rejected' });

    await referrerApi.get(`/api/applications/${id}/cv/preview`);

    expect((await db.select().from(applications).where(eq(applications.id, id)))[0].status).toBe('rejected');
  });
});
