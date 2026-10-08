import { describe, it, expect } from 'vitest';
import { db } from '../../config/db';
import { marketingEvents, waitlistSignups } from '../../db/schema';
import { useServer, as } from '../../test/http';
import { daysAgo, makeUser, makeSeeker, makeReferrer, makeJob, makeApplication } from '../../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the Conversion dashboard is how we judge the launch — which
 *    CTAs turn clicks into signups, and whether signups turn into job posts
 *    and CVs sent.
 *  - COST OF FAILURE: test-account activity from every deploy counted as real
 *    usage; a CTA's conversion rate computed against the wrong clicks; click
 *    tracking that anyone could use to write arbitrary data.
 *  - SUCCESS: the public endpoint stores only the anonymous fields it should,
 *    and the admin numbers add up with test accounts left out.
 */

const { base } = useServer();
const anon = () => as(base, null);
const admin = async () => as(base, (await makeUser({ email: 'shaiatar@gmail.com', emailVerified: true })).id);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dashboard = async (query = '?days=7'): Promise<any> =>
  ((await (await (await admin()).get(`/api/admin/conversion${query}`)).json()) as { data: unknown }).data;

describe('POST /api/events — anonymous marketing events', () => {
  it('records a CTA click with its button, list and campaign', async () => {
    const res = await anon().post('/api/events', {
      type: 'cta_click', cta: 'hero_seeker', role: 'seeker', path: '/', utmSource: 'whatsapp', utmCampaign: 'launch',
    });
    expect(res.status).toBe(202);
    const [row] = await db.select().from(marketingEvents);
    expect(row).toMatchObject({ type: 'cta_click', cta: 'hero_seeker', role: 'seeker', utmSource: 'whatsapp', utmCampaign: 'launch' });
  });

  it('drops a CTA name sent with a page view', async () => {
    await anon().post('/api/events', { type: 'page_view', cta: 'hero_seeker', path: '/' });
    const [row] = await db.select().from(marketingEvents);
    expect(row).toMatchObject({ type: 'page_view', cta: null });
  });

  it('rejects unknown event types, roles and oversized fields', async () => {
    expect((await anon().post('/api/events', { type: 'purchase' })).status).toBe(422);
    expect((await anon().post('/api/events', { type: 'cta_click', role: 'admin' })).status).toBe(422);
    expect((await anon().post('/api/events', { type: 'cta_click', cta: 'x'.repeat(65) })).status).toBe(422);
    expect(await db.select().from(marketingEvents)).toHaveLength(0);
  });
});

describe('GET /api/admin/conversion', () => {
  it('is admins only', async () => {
    expect((await anon().get('/api/admin/conversion')).status).toBe(401);
    const stranger = await makeUser({ email: 'someone@example.com', emailVerified: true });
    expect((await as(base, stranger.id).get('/api/admin/conversion')).status).toBe(403);
  });

  it('counts views, clicks, signups, job posts and CVs per day — leaving test accounts out', async () => {
    await db.insert(marketingEvents).values([
      { type: 'page_view' }, { type: 'page_view' }, { type: 'page_view' },
      { type: 'cta_click', cta: 'hero_seeker' },
      { type: 'cta_click', cta: 'nav', createdAt: daysAgo(2) },
      { type: 'page_view', createdAt: daysAgo(30) }, // out of range
    ]);
    await db.insert(waitlistSignups).values({ email: 'w@example.com', role: 'seeker', sourceCta: 'hero_seeker' });

    const referrer = await makeReferrer();
    const seeker = await makeSeeker();
    const job = await makeJob(referrer.id);
    await makeApplication({ jobId: job.id, seekerId: seeker.id, referrerId: referrer.id });

    // A deploy's smoke check: must not count.
    const bot = await makeReferrer({ isTestAccount: true });
    const botSeeker = await makeSeeker({ isTestAccount: true });
    const botJob = await makeJob(bot.id);
    await makeApplication({ jobId: botJob.id, seekerId: botSeeker.id, referrerId: bot.id });
    await makeApplication({ jobId: job.id, seekerId: botSeeker.id, referrerId: referrer.id });

    const data = await dashboard();
    expect(data.daily).toHaveLength(7);
    expect(data.daily.at(-1)).toMatchObject({ pageViews: 3, ctaClicks: 1, waitlistSignups: 1, jobsPosted: 1, cvsSent: 1 });
    expect(data.totals).toMatchObject({ pageViews: 3, ctaClicks: 2, waitlistSignups: 1, jobsPosted: 1, cvsSent: 1 });
    // referrer + seeker; the admin account the request logs in with counts too.
    expect(data.totals.accountSignups).toBe(3);
    expect(data.allTime).toMatchObject({ jobs: 1, activeJobs: 1, cvs: 1, accounts: 3 });
  });

  it('matches each CTA\'s clicks to the signups it brought', async () => {
    await db.insert(marketingEvents).values([
      { type: 'cta_click', cta: 'hero_seeker' }, { type: 'cta_click', cta: 'hero_seeker' },
      { type: 'cta_click', cta: 'hero_seeker' }, { type: 'cta_click', cta: 'nav' },
    ]);
    await db.insert(waitlistSignups).values([
      { email: 'a@example.com', role: 'seeker', sourceCta: 'hero_seeker' },
      { email: 'b@example.com', role: 'referrer', sourceCta: 'footer' }, // signups with no tracked click still show
    ]);

    const { ctas } = await dashboard();
    expect(ctas).toEqual([
      { cta: 'hero_seeker', clicks: 3, signups: 1 },
      { cta: 'nav', clicks: 1, signups: 0 },
      { cta: 'footer', clicks: 0, signups: 1 },
    ]);
  });

  it('follows the CVs sent in range through to their outcome', async () => {
    const referrer = await makeReferrer();
    const job = await makeJob(referrer.id);
    const send = async (status: string, extra: Record<string, unknown> = {}) =>
      makeApplication({ jobId: job.id, seekerId: (await makeSeeker()).id, referrerId: referrer.id, status, overrides: extra });

    await send('submitted');
    await send('viewed', { viewedAt: new Date() });
    await send('forwarded', { viewedAt: new Date(), forwardedAt: new Date() });
    await send('internally_submitted', { viewedAt: new Date(), forwardedAt: new Date() });
    await send('rejected', { viewedAt: new Date() });

    expect((await dashboard()).cvFunnel).toEqual({
      sent: 5, opened: 4, downloaded: 2, submittedInternally: 1, notAFit: 1, expired: 0, withdrawn: 0, awaiting: 2,
    });
  });

  it('validates the range and time zone', async () => {
    const a = await admin();
    expect((await a.get('/api/admin/conversion?tz=Asia/Jerusalem&days=90')).status).toBe(200);
    expect((await a.get('/api/admin/conversion?tz=Nope/Nope')).status).toBe(422);
  });
});
