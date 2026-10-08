import { and, count, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { waitlistSignups, type WaitlistRole } from '../../db/schema/waitlistSignups';
import { sendWaitlistConfirmationEmail } from '../../services/email';
import { syncWaitlistContact } from '../../services/waitlistSegments';
import type { JoinWaitlistDto } from './waitlist.schemas';

/**
 * waitlist.service
 *
 * WHY THIS EXISTS:
 * directref.com launches before it has positions. Every CTA collects an email
 * into one of two lists — seekers and referrers — so referrers can be invited
 * first to fill the site, then seekers once there is something to apply to.
 *
 * CONNECTIONS:
 * - CALLED BY: waitlist.router (public form + unsubscribe page),
 *   admin.service (counts), scripts/sync-waitlist-segments.ts.
 * - CALLS: waitlist_signups table, email.sendWaitlistConfirmationEmail,
 *   waitlistSegments.syncWaitlistContact.
 *
 * DESIGN DECISIONS:
 * - WHY every outcome looks identical to the caller: new signup, repeat
 *   signup and bot all get the same reply, so the form cannot be used to find
 *   out whether an address is on the list.
 * - WHY email and Resend sync never fail the request: the row is what
 *   matters. Mail and sync are best-effort and replayable.
 */

// ─────────────────────────────────────────────────
// WHY: the one write the public marketing site makes.
// WHAT: stores the signup; on a FIRST signup sends the confirmation and syncs
//       the Resend Segment. A repeat is silent — except that re-joining after
//       unsubscribing is a fresh opt-in, so it re-subscribes (still no email).
// CONNECTION: POST /api/waitlist.
// ─────────────────────────────────────────────────
export async function joinWaitlist(input: JoinWaitlistDto): Promise<void> {
  if (input.website) return; // honeypot tripped — pretend it worked

  const [inserted] = await db
    .insert(waitlistSignups)
    .values({
      email: input.email,
      role: input.role,
      sourceCta: input.sourceCta,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmTerm: input.utmTerm,
      utmContent: input.utmContent,
    })
    .onConflictDoNothing({ target: [waitlistSignups.email, waitlistSignups.role] })
    .returning();

  if (inserted) {
    await sendWaitlistConfirmationEmail(inserted.email, inserted.role, inserted.unsubscribeToken).catch((err) =>
      console.error('[waitlist] confirmation email failed:', (err as Error).message),
    );
    await syncRow(inserted.id, inserted.email, inserted.role, false);
    return;
  }

  // Already on this list. Only an unsubscribed row needs anything done.
  const [resubscribed] = await db
    .update(waitlistSignups)
    .set({ unsubscribedAt: null })
    .where(and(
      eq(waitlistSignups.email, input.email),
      eq(waitlistSignups.role, input.role),
      sql`${waitlistSignups.unsubscribedAt} IS NOT NULL`,
    ))
    .returning();
  if (resubscribed) await syncRow(resubscribed.id, resubscribed.email, resubscribed.role, false);
}

// ─────────────────────────────────────────────────
// WHY: the confirmation email promises "unsubscribe anytime", and the launch
//      Broadcast must not reach someone who took that up.
// WHAT: marks the row unsubscribed and mirrors it to Resend. Unknown tokens
//       are ignored silently — same no-oracle rule as joinWaitlist.
// CONNECTION: POST /api/waitlist/unsubscribe (from /waitlist/unsubscribe page).
// ─────────────────────────────────────────────────
export async function unsubscribe(token: string): Promise<void> {
  const [row] = await db
    .update(waitlistSignups)
    .set({ unsubscribedAt: new Date() })
    .where(and(eq(waitlistSignups.unsubscribeToken, token), isNull(waitlistSignups.unsubscribedAt)))
    .returning();
  if (row) await syncRow(row.id, row.email, row.role, true);
}

/** Push one row to its Resend Segment and record whether it landed. */
export async function syncRow(id: string, email: string, role: WaitlistRole, unsubscribed: boolean): Promise<boolean> {
  const ok = await syncWaitlistContact(email, role, unsubscribed);
  await db
    .update(waitlistSignups)
    .set({ resendSyncedAt: ok ? new Date() : null })
    .where(eq(waitlistSignups.id, id));
  return ok;
}

/** Launch-signal numbers for /api/admin/stats. Counts subscribed rows only. */
export async function getWaitlistStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const subscribed = isNull(waitlistSignups.unsubscribedAt);

  const byRole = await db
    .select({ role: waitlistSignups.role, count: count() })
    .from(waitlistSignups)
    .where(subscribed)
    .groupBy(waitlistSignups.role);
  const [joinedToday] = await db
    .select({ count: count() })
    .from(waitlistSignups)
    .where(and(subscribed, gte(waitlistSignups.createdAt, today)));
  const [unsubscribed] = await db
    .select({ count: count() })
    .from(waitlistSignups)
    .where(sql`${waitlistSignups.unsubscribedAt} IS NOT NULL`);
  const [notSynced] = await db
    .select({ count: count() })
    .from(waitlistSignups)
    .where(isNull(waitlistSignups.resendSyncedAt));

  const seekers = byRole.find((r) => r.role === 'seeker')?.count ?? 0;
  const referrers = byRole.find((r) => r.role === 'referrer')?.count ?? 0;
  return {
    seekers,
    referrers,
    total: seekers + referrers,
    joinedToday: joinedToday.count,
    unsubscribed: unsubscribed.count,
    notSyncedToResend: notSynced.count,
  };
}

export type WaitlistDashboardOptions = { days: number; tz: string };

// ─────────────────────────────────────────────────
// WHY: the first thing to watch after the launch posts went out — is anyone
//      joining, from which group, and through which button.
// WHAT: headline counts (getWaitlistStats), a gap-free daily series per list,
//       breakdowns by CTA and by UTM, and the latest signups.
// CONNECTION: GET /api/admin/waitlist → frontend /admin/waitlist.
//
// - WHY the daily series counts every signup, unsubscribed or not: it answers
//   "how many joined that day", and an unsubscribe a week later should not
//   rewrite the history of the day a post went out. The headline totals are
//   the ones that exclude unsubscribes.
// - WHY days are cut in the viewer's time zone: a post that went out at 23:30
//   Israel time is "today" to the person reading the chart, not UTC tomorrow.
//   tz is validated by the router; it is passed as a bound parameter anyway.
// ─────────────────────────────────────────────────
export async function getWaitlistDashboard({ days, tz }: WaitlistDashboardOptions) {
  const localDay = sql`(${waitlistSignups.createdAt} AT TIME ZONE ${tz})::date`;
  const since = sql`(now() AT TIME ZONE ${tz})::date - ${days - 1}::int`;

  const daily = await db.execute<{ date: string; seekers: number; referrers: number }>(sql`
    WITH d AS (
      SELECT generate_series(${since}, (now() AT TIME ZONE ${tz})::date, interval '1 day')::date AS day
    )
    SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
           (count(w.id) FILTER (WHERE w.role = 'seeker'))::int   AS seekers,
           (count(w.id) FILTER (WHERE w.role = 'referrer'))::int AS referrers
    FROM d
    LEFT JOIN ${waitlistSignups} w ON (w.created_at AT TIME ZONE ${tz})::date = d.day
    GROUP BY d.day
    ORDER BY d.day
  `);

  const seekers = sql<number>`(count(*) FILTER (WHERE ${waitlistSignups.role} = 'seeker'))::int`;
  const referrers = sql<number>`(count(*) FILTER (WHERE ${waitlistSignups.role} = 'referrer'))::int`;
  const inRange = sql`${localDay} >= ${since}`;

  const bySource = await db
    .select({ source: waitlistSignups.sourceCta, seekers, referrers, total: count() })
    .from(waitlistSignups)
    .where(inRange)
    .groupBy(waitlistSignups.sourceCta)
    .orderBy(sql`count(*) DESC`);

  const byCampaign = await db
    .select({
      utmSource: waitlistSignups.utmSource,
      utmMedium: waitlistSignups.utmMedium,
      utmCampaign: waitlistSignups.utmCampaign,
      seekers,
      referrers,
      total: count(),
    })
    .from(waitlistSignups)
    .where(inRange)
    .groupBy(waitlistSignups.utmSource, waitlistSignups.utmMedium, waitlistSignups.utmCampaign)
    .orderBy(sql`count(*) DESC`)
    .limit(25);

  const recent = await db
    .select({
      email: waitlistSignups.email,
      role: waitlistSignups.role,
      source: waitlistSignups.sourceCta,
      utmSource: waitlistSignups.utmSource,
      utmCampaign: waitlistSignups.utmCampaign,
      unsubscribed: sql<boolean>`${waitlistSignups.unsubscribedAt} IS NOT NULL`,
      createdAt: waitlistSignups.createdAt,
    })
    .from(waitlistSignups)
    .orderBy(sql`${waitlistSignups.createdAt} DESC`)
    .limit(50);

  return {
    range: { days, tz },
    totals: await getWaitlistStats(),
    daily: [...daily],
    bySource,
    byCampaign,
    recent,
  };
}
