import { env } from '../config/env';
import { isTestAccountEmail } from '../config/testAccounts';
import type { WaitlistRole } from '../db/schema/waitlistSignups';

/**
 * waitlistSegments
 *
 * WHY THIS EXISTS:
 * The launch emails ("we're live — post your roles") are sent as Resend
 * Broadcasts, which target a Segment. This keeps two Segments — Seekers and
 * Referrers — in step with the waitlist_signups table.
 *
 * CONNECTIONS:
 * - CALLED BY: waitlist.service (on signup / unsubscribe) and
 *   scripts/sync-waitlist-segments.ts (backfill).
 * - CALLS: Resend Contacts + Segments REST API, with RESEND_CONTACTS_API_KEY.
 *
 * DESIGN DECISIONS:
 * - WHY Segments, not Audiences: Resend deprecated Audiences (still working,
 *   "will be removed in the future"). Contacts are now global — one per email
 *   across the account — and a Segment is a list a contact belongs to. That
 *   maps exactly onto our two lists.
 * - WHY plain fetch: the installed SDK (resend 4.8) predates Segments. Three
 *   endpoints don't justify a major-version SDK upgrade under every email path.
 * - WHY unsubscribing REMOVES from the Segment rather than setting the
 *   contact's global `unsubscribed` flag: our unsubscribe is per list (leaving
 *   the seeker list must not silence the referrer list). Resend's own global
 *   unsubscribe, from a Broadcast footer, still applies on top.
 * - WHY a boolean instead of throwing: the database row is the source of
 *   truth. A Resend outage must never fail a signup; the caller records
 *   whether the sync happened and the backfill script retries the rest.
 */

const API = 'https://api.resend.com';

function segmentIdFor(role: WaitlistRole): string {
  return role === 'referrer' ? env.RESEND_SEGMENT_REFERRERS_ID : env.RESEND_SEGMENT_SEEKERS_ID;
}

/** Is syncing configured at all? False locally and in tests. */
export function isSegmentSyncConfigured(): boolean {
  return !!env.RESEND_CONTACTS_API_KEY && !!env.RESEND_SEGMENT_SEEKERS_ID && !!env.RESEND_SEGMENT_REFERRERS_ID;
}

function call(method: string, path: string, body?: unknown) {
  return fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.RESEND_CONTACTS_API_KEY}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ─────────────────────────────────────────────────
// WHY: a Broadcast to "Referrers" must reach exactly the people on the
//      referrer list, and nobody who left it.
// WHAT: joining → ensure the contact exists, then add it to the role's
//       Segment. Leaving → remove it from that Segment.
// CONNECTION: waitlist.service.syncRow, sync script.
// ─────────────────────────────────────────────────
export async function syncWaitlistContact(
  email: string,
  role: WaitlistRole,
  unsubscribed: boolean,
): Promise<boolean> {
  if (!isSegmentSyncConfigured()) return false;
  // Same rule as outbound mail: a .test address can never receive a
  // Broadcast, so it has no business in a Segment.
  if (isTestAccountEmail(email)) return false;

  const segment = encodeURIComponent(segmentIdFor(role));
  const contact = encodeURIComponent(email);
  try {
    if (unsubscribed) {
      const res = await call('DELETE', `/contacts/${contact}/segments/${segment}`);
      // Already gone is the outcome we wanted.
      if (res.ok || res.status === 404) return true;
      console.error(`[waitlist] Resend segment removal failed (${role}): ${res.status} ${await res.text()}`);
      return false;
    }

    // Create is allowed to fail — the contact may already exist from the
    // other list. Adding to the Segment is what has to succeed.
    await call('POST', '/contacts', { email });
    const res = await call('POST', `/contacts/${contact}/segments/${segment}`);
    if (res.ok) return true;
    console.error(`[waitlist] Resend segment add failed (${role}): ${res.status} ${await res.text()}`);
    return false;
  } catch (err) {
    console.error(`[waitlist] Resend sync threw (${role}):`, (err as Error).message);
    return false;
  }
}
