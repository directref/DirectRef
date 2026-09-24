import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../config/db';
import {
  APPLICATION_STATUSES,
  CLOSED_APPLICATION_STATUSES,
  PENDING_APPLICATION_STATUSES,
  DECIDED_APPLICATION_STATUSES,
  REFERRER_SETTABLE_STATUSES,
} from './contracts';

/**
 * WHY THIS FILE:
 *  - PROBLEM: contracts.ts makes the two halves of the product share one
 *    vocabulary, but the DATABASE is a third party to that agreement. The
 *    Drizzle schema builds its CHECK constraint from APPLICATION_STATUSES, so
 *    the two agree in the source — and then a migration is generated, reviewed
 *    and applied by hand. Add a status, skip the migration, and the code is
 *    confident about a value the database will reject at 3am.
 *  - COST OF FAILURE: an application the product believes it can write and
 *    Postgres refuses. In the sweeps that means a swallowed error and a job
 *    that quietly does nothing — exactly how the retention sweep sat dead for
 *    nine days.
 *  - SUCCESS: the list in TypeScript and the constraint in the live database
 *    are the same set, proven against a real Postgres rather than assumed.
 */
describe('the shared contract and the database agree', () => {
  it('the live CHECK constraint allows exactly APPLICATION_STATUSES', async () => {
    const rows = await db.execute<{ def: string }>(sql`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conname = 'applications_status_check'
    `);

    const def = rows[0]?.def;
    // No constraint at all is a failure, not a pass — otherwise this test goes
    // green on a database that accepts any string whatsoever.
    expect(def, 'applications_status_check is missing from the database').toBeTruthy();

    const inDatabase = [...def!.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(inDatabase).toEqual([...APPLICATION_STATUSES].sort());
  });

  it('every subset list is drawn from APPLICATION_STATUSES', () => {
    // `satisfies` already proves this at compile time. Asserting it again at
    // runtime is cheap and states the rule where a reader will look for it.
    for (const [name, list] of [
      ['CLOSED', CLOSED_APPLICATION_STATUSES],
      ['PENDING', PENDING_APPLICATION_STATUSES],
      ['DECIDED', DECIDED_APPLICATION_STATUSES],
      ['REFERRER_SETTABLE', REFERRER_SETTABLE_STATUSES],
    ] as const) {
      for (const status of list) {
        expect(APPLICATION_STATUSES, `${name} contains unknown status "${status}"`).toContain(status);
      }
    }
  });

  it('closed and pending never overlap', () => {
    // The retention sweep erases CLOSED rows. If a PENDING status ever leaked
    // into that list, live applications would be deleted.
    const overlap = CLOSED_APPLICATION_STATUSES.filter((s) =>
      (PENDING_APPLICATION_STATUSES as readonly string[]).includes(s),
    );
    expect(overlap).toEqual([]);
  });

  it("a referrer cannot set 'expired' — only the sweep may", () => {
    expect(REFERRER_SETTABLE_STATUSES as readonly string[]).not.toContain('expired');
  });
});
