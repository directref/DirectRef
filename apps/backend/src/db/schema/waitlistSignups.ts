import { pgTable, uuid, varchar, timestamp, uniqueIndex, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * WHY THIS TABLE: the marketing site launches before there are positions to
 * browse, so every CTA collects an email instead of opening the app. Seekers
 * and referrers are two lists because the launch emails go out in order —
 * referrers first ("post the roles you can refer into"), seekers once there is
 * something to apply to.
 *
 * DESIGN DECISIONS:
 *  - ONE table with a role column, not two tables: same shape, one endpoint,
 *    and a person can legitimately be on both lists (unique on email + role).
 *  - This table is the source of truth. The Resend Audiences are a copy for
 *    sending; resend_synced_at records which rows made it across, so a missed
 *    sync can be replayed by scripts/sync-waitlist-audiences.ts.
 *  - unsubscribe_token is random, not derived from the email, so an
 *    unsubscribe link cannot be forged for someone else's address.
 */
export const WAITLIST_ROLES = ['seeker', 'referrer'] as const;
export type WaitlistRole = (typeof WAITLIST_ROLES)[number];

export const waitlistSignups = pgTable(
  'waitlist_signups',
  {
    id:               uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email:            varchar('email', { length: 320 }).notNull(), // stored lower-cased
    role:             varchar('role', { length: 16 }).notNull().$type<WaitlistRole>(),
    // Which button opened the modal (e.g. "hero_seeker", "nav"). Tells us which
    // message converts; free text on purpose so a new CTA needs no migration.
    sourceCta:        varchar('source_cta', { length: 64 }),
    utmSource:        varchar('utm_source', { length: 128 }),
    utmMedium:        varchar('utm_medium', { length: 128 }),
    utmCampaign:      varchar('utm_campaign', { length: 128 }),
    utmTerm:          varchar('utm_term', { length: 128 }),
    utmContent:       varchar('utm_content', { length: 128 }),
    unsubscribeToken: uuid('unsubscribe_token').notNull().unique().default(sql`gen_random_uuid()`),
    unsubscribedAt:   timestamp('unsubscribed_at', { withTimezone: true }),
    resendSyncedAt:   timestamp('resend_synced_at', { withTimezone: true }),
    createdAt:        timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex('waitlist_signups_email_role_idx').on(t.email, t.role),
    index('waitlist_signups_role_idx').on(t.role),
    check('waitlist_signups_role_check', sql`${t.role} IN ('seeker', 'referrer')`),
  ],
);
