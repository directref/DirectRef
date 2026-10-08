import { describe, it, expect, vi } from 'vitest';
import { db } from '../../config/db';
import { waitlistSignups } from '../../db/schema';
import { env } from '../../config/env';
import { useServer } from '../../test/http';
import { daysAgo } from '../../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: after the launch posts go out, /admin/waitlist is how we tell
 *    whether anyone is joining, from which group, and through which button.
 *  - COST OF FAILURE: a quiet day that reads as zero because of a missing
 *    date, a campaign credited to the wrong list, or an email list readable
 *    without the secret.
 *  - SUCCESS: every day in range appears once, per-list counts add up, and
 *    nothing comes back without the admin secret.
 */

vi.mock('../../services/waitlistSegments', () => ({
  syncWaitlistContact: vi.fn().mockResolvedValue(true),
  isSegmentSyncConfigured: vi.fn().mockReturnValue(true),
}));

const { base } = useServer();
const get = (query = '', secret: string | null = env.ADMIN_SECRET) =>
  fetch(`${base()}/api/admin/waitlist${query}`, { headers: secret ? { 'x-admin-secret': secret } : {} });
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
  it('refuses without the admin secret, or with the wrong one', async () => {
    expect((await get('', null)).status).toBe(401);
    expect((await get('', 'wrong')).status).toBe(401);
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
    expect((await get('?tz=Asia/Jerusalem')).status).toBe(200);
    expect((await get('?tz=Not/AZone')).status).toBe(422);
    expect((await get('?days=0')).status).toBe(422);
  });
});
