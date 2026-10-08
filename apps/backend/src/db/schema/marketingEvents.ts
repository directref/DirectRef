import { pgTable, uuid, varchar, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * WHY THIS TABLE: the waitlist only records people who finish signing up, so
 * a CTA that gets clicked a lot but rarely converts looked the same as one
 * nobody clicks. This records the top of the marketing funnel — landing page
 * views and CTA clicks — for the Conversion dashboard.
 *
 * DESIGN DECISIONS:
 *  - Anonymous on purpose: no IP, no cookie, no visitor id, no email. These
 *    are counts, not people, so they need no consent banner and can never
 *    leak anything about a person.
 *  - Free-text `cta` (same values as waitlist_signups.source_cta) so a new
 *    button needs no migration, and clicks join to signups by that name.
 *  - Counts are approximate: a public endpoint can be replayed. It is rate
 *    limited, and the numbers are for spotting trends, not billing.
 */
export const MARKETING_EVENT_TYPES = ['page_view', 'cta_click'] as const;
export type MarketingEventType = (typeof MARKETING_EVENT_TYPES)[number];

export const marketingEvents = pgTable(
  'marketing_events',
  {
    id:          uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    type:        varchar('type', { length: 16 }).notNull().$type<MarketingEventType>(),
    cta:         varchar('cta', { length: 64 }),      // cta_click only, e.g. "hero_seeker"
    role:        varchar('role', { length: 16 }),     // the list the button pre-selects, if any
    path:        varchar('path', { length: 256 }),
    utmSource:   varchar('utm_source', { length: 128 }),
    utmMedium:   varchar('utm_medium', { length: 128 }),
    utmCampaign: varchar('utm_campaign', { length: 128 }),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index('marketing_events_type_created_idx').on(t.type, t.createdAt),
    check('marketing_events_type_check', sql`${t.type} IN ('page_view', 'cta_click')`),
  ],
);
