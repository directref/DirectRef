import { describe, it, expect, vi } from 'vitest';
import { db } from '../../config/db';
import { waitlistSignups } from '../../db/schema';
import { useServer, as } from '../../test/http';
import { daysAgo, makeUser } from '../../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: after the launch posts go out, /admin/waitlist is how we tell
 *    whether anyone is joining, from which group, and through which button.
 *  - COST OF FAILURE: a quiet day that reads as zero because of a missing
 *    date, a campaign credited to the wrong list, or an email list readable
 *    without logging in as one of the ADMIN_EMAILS accounts.
 *  - SUCCESS: every day in range appears once, per-list counts add up, and
 *    nothing comes back unless the caller is a verified admin account.
 */

vi.mock('../../services/waitlistSegments', () => ({
  syncWaitlistContact: vi.fn().mockResolvedValue(true),
  isSegmentSyncConfigured: vi.fn().mockReturnValue(true),
}));

const { base } = useServer();
const ADMIN = 'shaiatar@gmail.com'; // in the ADMIN_EMAILS default
const makeAdmin = () => makeUser({ email: ADMIN, emailVerified: true });
const getAs = (userId: string | null, query = '') => as(base, userId).get(`/api/admin/waitlist${query}`);
const get = async (query = '') => getAs((await makeAdmin()).id, query);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dashboard = async (query = ''): Promise<any> => ((await (await get(query)).json()) as { data: unknown }).data;

async function seed() {
  await db.insert(waitlistSignups).values([
    { email: 'a@example.com', role: 'seeker',   sourceCta: 'hero_seeker',   utmSource: 'whatsapp', utmCampaign: 'launch' },
    { email: 'b@example.com', role: 'referrer', sourceCta: 'hero_referrer', utmSource: 'whatsapp', utmCampaign: 'launch' },
    { email: 'c@example.com', role: 'seeker',   sourceCta: 'nav',           createdAt: daysAgo(2) },
    { email: 'd@example.com', role: 'seeker',   sourceCta: 'nav',           createdAt: daysAgo(2), unsubscribedAt: new Date() },
    { email: 'old@example.com', role: 'referrer', sourceCta: 'nav',         createdAt: daysAgo(60) },
  ]);
}

describe('GET /api/admin/waitlist', () => {
  it('refuses anyone not logged in as a verified admin account', async () => {
    expect((await getAs(null)).status).toBe(401);

    const stranger = await makeUser({ email: 'someone@example.com', emailVerified: true });
    expect((await getAs(stranger.id)).status).toBe(403);

    // Registered an admin address but never proved they own it.
    const squatter = await makeUser({ email: 'anatatar83@gmail.com', emailVerified: false });
    expect((await getAs(squatter.id)).status).toBe(403);
  });

  it('lets in each listed admin, matching the email case-insensitively', async () => {
    const anat = await makeUser({ email: 'Anatatar83@Gmail.com', emailVerified: true });
    expect((await getAs(anat.id)).status).toBe(200);
    expect((await get()).status).toBe(200);
  });

  it('guards the older admin endpoints the same way', async () => {
    const stranger = await makeUser({ email: 'someone@example.com', emailVerified: true });
    expect((await as(base, stranger.id).get('/api/admin/stats')).status).toBe(403);
    expect((await as(base, (await makeAdmin()).id).get('/api/admin/stats')).status).toBe(200);
  });

  it('returns one entry per day in range, zero-filled, ending today', async () => {
    await seed();
    const data = await dashboard('?days=7');

    expect(data.daily).toHaveLength(7);
    const [today, , twoDaysAgo] = [...data.daily].reverse();
    expect(today).toMatchObject({ seekers: 1, referrers: 1 });
    // The day keeps the signup that later unsubscribed — it did join that day.
    expect(twoDaysAgo).toMatchObject({ seekers: 2, referrers: 0 });
    expect(data.daily.reduce((n: number, d: { seekers: number; referrers: number }) => n + d.seekers + d.referrers, 0)).toBe(4);
  });

  it('headline totals exclude unsubscribes and include signups older than the range', async () => {
    await seed();
    const data = await dashboard('?days=7');
    expect(data.totals).toMatchObject({ seekers: 2, referrers: 2, total: 4, unsubscribed: 1 });
  });

  it('breaks the range down by CTA and by campaign', async () => {
    await seed();
    const data = await dashboard('?days=7');

    expect(data.bySource).toContainEqual({ source: 'nav', seekers: 2, referrers: 0, total: 2 });
    expect(data.bySource.find((r: { source: string }) => r.source === 'nav').total).toBe(2); // the 60-day-old one is out of range
    expect(data.byCampaign.find((r: { utmSource: string | null }) => r.utmSource === 'whatsapp')).toMatchObject({ utmSource: 'whatsapp', utmCampaign: 'launch', seekers: 1, referrers: 1, total: 2 });
  });

  it('lists the latest signups first', async () => {
    await seed();
    const data = await dashboard();
    expect(data.recent).toHaveLength(5);
    expect(data.recent.at(-1).email).toBe('old@example.com');
    expect(data.recent.find((r: { email: string }) => r.email === 'd@example.com').unsubscribed).toBe(true);
  });

  it('cuts days in the requested time zone, and rejects an unknown one', async () => {
    const admin = (await makeAdmin()).id;
    expect((await getAs(admin, '?tz=Asia/Jerusalem')).status).toBe(200);
    expect((await getAs(admin, '?tz=Not/AZone')).status).toBe(422);
    expect((await getAs(admin, '?days=0')).status).toBe(422);
  });
});

describe('isAdmin on the caller\'s own account — drives the sidebar link', () => {
  it('is true only for a verified admin account', async () => {
    const admin = await makeAdmin();
    const stranger = await makeUser({ email: 'someone@example.com', emailVerified: true });
    const squatter = await makeUser({ email: 'anatatar83@gmail.com', emailVerified: false });

    for (const path of ['/api/auth/me', '/api/users/me']) {
      const flag = async (id: string) => ((await (await as(base, id).get(path)).json()) as { data: { isAdmin: boolean } }).data.isAdmin;
      expect(await flag(admin.id)).toBe(true);
      expect(await flag(stranger.id)).toBe(false);
      expect(await flag(squatter.id)).toBe(false);
    }
  });
});
