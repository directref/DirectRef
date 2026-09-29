/**
 * Push every waitlist row that has not reached Resend yet into its Audience.
 *
 * WHY: signups are stored even when the Resend sync is not configured or
 * Resend is down (see services/waitlistAudience.ts). Run this once after
 * setting RESEND_CONTACTS_API_KEY and the two audience IDs, and before sending
 * any launch Broadcast, so the Audiences hold everyone the table holds.
 *
 *   npx tsx src/scripts/sync-waitlist-audiences.ts            # dry run: counts only
 *   npx tsx src/scripts/sync-waitlist-audiences.ts --apply    # actually sync
 *
 * Safe to re-run: it only touches rows with resend_synced_at IS NULL, and the
 * contact upsert is idempotent.
 */
import { isNull } from 'drizzle-orm';
import { db, queryClient } from '../config/db';
import { waitlistSignups } from '../db/schema';
import { isAudienceSyncConfigured } from '../services/waitlistAudience';
import { syncRow } from '../modules/waitlist/waitlist.service';

const apply = process.argv.includes('--apply');
// Resend rate-limits to ~2 req/s and each row can take two calls.
const GAP_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const pending = await db.select().from(waitlistSignups).where(isNull(waitlistSignups.resendSyncedAt));
  const seekers = pending.filter((r) => r.role === 'seeker').length;
  console.log(`${pending.length} row(s) not yet in Resend (${seekers} seekers, ${pending.length - seekers} referrers).`);

  if (!apply) {
    console.log('Dry run. Re-run with --apply to sync.');
    return;
  }
  if (!isAudienceSyncConfigured()) {
    console.error('RESEND_CONTACTS_API_KEY / RESEND_AUDIENCE_*_ID are not all set — nothing synced.');
    process.exitCode = 1;
    return;
  }

  let failed = 0;
  for (const row of pending) {
    const ok = await syncRow(row.id, row.email, row.role, row.unsubscribedAt !== null);
    if (!ok) failed += 1;
    await sleep(GAP_MS);
  }
  console.log(failed ? `Done, ${failed} failed — re-run to retry them.` : 'Done, all synced.');
  if (failed) process.exitCode = 1;
}

main().finally(() => queryClient.end());
