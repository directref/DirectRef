import { and, count, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../../config/db';
import { waitlistSignups, type WaitlistRole } from '../../db/schema/waitlistSignups';
import { sendWaitlistConfirmationEmail } from '../../services/email';
import { upsertWaitlistContact } from '../../services/waitlistAudience';
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
 *   admin.service (counts), scripts/sync-waitlist-audiences.ts.
 * - CALLS: waitlist_signups table, email.sendWaitlistConfirmationEmail,
 *   waitlistAudience.upsertWaitlistContact.
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
//       the Resend Audience. A repeat is silent — except that re-joining after
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

/** Push one row to its Resend Audience and record whether it landed. */
export async function syncRow(id: string, email: string, role: WaitlistRole, unsubscribed: boolean): Promise<boolean> {
  const ok = await upsertWaitlistContact(email, role, unsubscribed);
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
