import { Resend } from 'resend';
import { env } from '../config/env';
import { isTestAccountEmail } from '../config/testAccounts';
import type { WaitlistRole } from '../db/schema/waitlistSignups';

/**
 * waitlistAudience
 *
 * WHY THIS EXISTS:
 * The launch emails ("we're live — post your roles") are sent from Resend's
 * Broadcasts, which send to an Audience. This keeps the two Audiences —
 * Seekers and Referrers — in step with the waitlist_signups table.
 *
 * CONNECTIONS:
 * - CALLED BY: waitlist.service (on signup / unsubscribe) and
 *   scripts/sync-waitlist-audiences.ts (backfill).
 * - CALLS: Resend Contacts API, with RESEND_CONTACTS_API_KEY.
 *
 * DESIGN DECISIONS:
 * - WHY return a boolean instead of throwing: the database row is the source
 *   of truth. A Resend outage must never fail a signup; the caller records
 *   whether the sync happened and the backfill script retries the rest.
 */

const client = env.RESEND_CONTACTS_API_KEY ? new Resend(env.RESEND_CONTACTS_API_KEY) : null;

function audienceIdFor(role: WaitlistRole): string {
  return role === 'referrer' ? env.RESEND_AUDIENCE_REFERRERS_ID : env.RESEND_AUDIENCE_SEEKERS_ID;
}

/** Is syncing configured at all? False locally and in tests. */
export function isAudienceSyncConfigured(): boolean {
  return !!client && !!env.RESEND_AUDIENCE_SEEKERS_ID && !!env.RESEND_AUDIENCE_REFERRERS_ID;
}

// ─────────────────────────────────────────────────
// WHY: a contact must exist in the right Audience, with the right
//      subscription state, before a Broadcast can reach (or skip) them.
// WHAT: creates the contact, or updates it if it already exists.
// CONNECTION: waitlist.service.signup / unsubscribe, sync script.
// ─────────────────────────────────────────────────
export async function upsertWaitlistContact(
  email: string,
  role: WaitlistRole,
  unsubscribed: boolean,
): Promise<boolean> {
  if (!client || !isAudienceSyncConfigured()) return false;
  // Same rule as outbound mail: a .test address can never receive a
  // Broadcast, so it has no business in the Audience.
  if (isTestAccountEmail(email)) return false;

  const audienceId = audienceIdFor(role);
  try {
    const created = await client.contacts.create({ audienceId, email, unsubscribed });
    if (!created.error) return true;

    // Most likely it already exists — update its subscription state instead.
    const updated = await client.contacts.update({ audienceId, email, unsubscribed });
    if (!updated.error) return true;

    console.error(`[waitlist] Resend contact sync failed for ${role}:`, updated.error.message);
    return false;
  } catch (err) {
    console.error(`[waitlist] Resend contact sync threw for ${role}:`, (err as Error).message);
    return false;
  }
}
