import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { users } from '../db/schema';
import { runCreditGrantSweep } from './creditGrantSweep';
import { getBalance, grantSignupCredits } from '../modules/credits/credits.service';
import { makeReferrer } from '../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: the last of the five sweeps without its own test. Thin — it
 *    just calls grantMonthlyCredits, which is covered — but "thin" is how a
 *    wrapper ends up silently not doing its job.
 *  - COST OF FAILURE: quiet in both directions. Broken, referrers slowly run
 *    out of credits and simply stop being able to post, with nothing to
 *    explain why. Over-granting, and the gate that makes posting cost
 *    something stops meaning anything.
 */

describe('the monthly credit grant sweep', () => {
  it('gives a credit to a referrer who has not had one this month', async () => {
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id);
    await db.update(users).set({ freeCreditsMonth: '2020-01' }).where(eq(users.id, referrer.id));

    await runCreditGrantSweep();

    expect((await getBalance(referrer.id)).total).toBe(6); // 5 at signup + 1
  });

  it('grants once a month however often it runs', async () => {
    // The scheduler calls this every 15 minutes — about 96 times a day.
    // Without the per-month guard that is 96 credits a day, and the posting
    // gate stops being a gate at all.
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id);
    await db.update(users).set({ freeCreditsMonth: '2020-01' }).where(eq(users.id, referrer.id));

    for (let i = 0; i < 5; i += 1) await runCreditGrantSweep();

    expect((await getBalance(referrer.id)).total).toBe(6);
  });

  it('does nothing to a referrer already granted this month', async () => {
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id); // stamps the current month

    await runCreditGrantSweep();

    expect((await getBalance(referrer.id)).total).toBe(5);
  });

  it('runs cleanly with no users at all', async () => {
    await expect(runCreditGrantSweep()).resolves.toBeUndefined();
  });
});
