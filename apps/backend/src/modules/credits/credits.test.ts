import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users, creditPurchases, jobs } from '../../db/schema';
import { getBalance, spendCredit, grantSignupCredits, grantMonthlyCredits } from './credits.service';
import { createJob } from '../jobs/jobs.service';
import { register } from '../auth/auth.service';
import { makeReferrer } from '../../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: credits are the only thing standing between DirectRef and an
 *    unlimited free job board. A referrer gets 5 at signup and +1 a month,
 *    spends one per posting, and is blocked at zero. Get the arithmetic wrong
 *    in either direction and it is invisible: too generous and the gate does
 *    nothing, too strict and referrers are locked out of the one action the
 *    product needs them to take.
 *  - COST OF FAILURE: silent. Nobody reports "I was given too many credits".
 *  - NOTE: the grant is per CALENDAR month and idempotent via
 *    users.free_credits_month, which is why these assert on that column and
 *    not on elapsed time.
 */

describe('credits — what a new account gets', () => {
  it('grants 5 at signup', async () => {
    // NB: the PRD says 3. The code says 5 and this test pins the code, which
    // is what ships. See the open question in the workplan — whichever wins,
    // this number and SIGNUP_CREDITS move together.
    const user = await register({
      email: 'fresh@example.test', password: 'TestPass123', fullName: 'Fresh Tester', isReferrer: true,
    });
    expect((await getBalance(user.id)).total).toBe(5);
  });

  it('stamps the signup month so the monthly sweep does not also grant', async () => {
    // Without the stamp a user who signs up on the 1st gets 5 + 1 immediately.
    const user = await register({
      email: 'stamped@example.test', password: 'TestPass123', fullName: 'Stamp Tester', isReferrer: true,
    });

    await grantMonthlyCredits();

    expect((await getBalance(user.id)).total).toBe(5);
  });
});

describe('credits — spending', () => {
  it('a posting costs exactly one', async () => {
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id);

    await spendCredit(referrer.id);

    expect((await getBalance(referrer.id)).total).toBe(4);
  });

  it('spends the OLDEST grant first', async () => {
    // FIFO matters because grants can differ: if a dated grant is ever
    // reintroduced, spending the newest first would strand the older one.
    const referrer = await makeReferrer();
    await db.insert(creditPurchases).values({
      userId: referrer.id, packageId: 'signup', credits: 2, remainingCredits: 2,
      pricePaid: '0', currency: 'ILS',
      expiresAt: new Date(Date.now() + 10 * 365 * 864e5),
      purchasedAt: new Date(Date.now() - 60 * 864e5),
    });
    await db.insert(creditPurchases).values({
      userId: referrer.id, packageId: 'monthly', credits: 1, remainingCredits: 1,
      pricePaid: '0', currency: 'ILS',
      expiresAt: new Date(Date.now() + 10 * 365 * 864e5),
      purchasedAt: new Date(),
    });

    await spendCredit(referrer.id);

    const rows = await db.select().from(creditPurchases).where(eq(creditPurchases.userId, referrer.id));
    expect(rows.find((r) => r.packageId === 'signup')!.remainingCredits).toBe(1);
    expect(rows.find((r) => r.packageId === 'monthly')!.remainingCredits).toBe(1);
  });

  it('refuses at zero rather than going negative', async () => {
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id);
    for (let i = 0; i < 5; i += 1) await spendCredit(referrer.id);

    expect((await getBalance(referrer.id)).total).toBe(0);
    await expect(spendCredit(referrer.id)).rejects.toMatchObject({ code: 'OUT_OF_CREDITS' });
    expect((await getBalance(referrer.id)).total).toBe(0);
  });
});

describe('credits — the posting gate', () => {
  const posting = (referrerId: string, n: number) => createJob(referrerId, {
    sourceUrl: `https://acme.test/careers/role-${n}`,
    title: `Engineer ${n}`,
    companyName: 'acme',
  } as never);

  it('a referrer can post five times and is blocked on the sixth', async () => {
    // The whole gate, end to end, at the service layer.
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id);

    for (let n = 1; n <= 5; n += 1) await posting(referrer.id, n);

    expect((await db.select().from(jobs).where(eq(jobs.referrerId, referrer.id))).length).toBe(5);
    expect((await getBalance(referrer.id)).total).toBe(0);

    await expect(posting(referrer.id, 6)).rejects.toMatchObject({ code: 'OUT_OF_CREDITS' });

    // And the blocked attempt must not have created a job anyway.
    expect((await db.select().from(jobs).where(eq(jobs.referrerId, referrer.id))).length).toBe(5);
  });
});

describe('credits — the monthly grant', () => {
  it('gives +1 to a user who has not been granted this month', async () => {
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id);
    // Pretend the last grant was a previous month.
    await db.update(users).set({ freeCreditsMonth: '2020-01' }).where(eq(users.id, referrer.id));

    await grantMonthlyCredits();

    expect((await getBalance(referrer.id)).total).toBe(6);
  });

  it('is idempotent — running the sweep repeatedly grants once per month', async () => {
    // The scheduler ticks every 15 minutes, so this runs ~96 times a day.
    // Without the freeCreditsMonth guard that is 96 credits a day.
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id);
    await db.update(users).set({ freeCreditsMonth: '2020-01' }).where(eq(users.id, referrer.id));

    await grantMonthlyCredits();
    await grantMonthlyCredits();
    await grantMonthlyCredits();

    expect((await getBalance(referrer.id)).total).toBe(6);
  });

  it('credits accumulate and never expire', async () => {
    // PRD v15: accumulating, never expiring. A referrer who is quiet for
    // months should find the credits waiting, not swept away.
    const referrer = await makeReferrer();
    await grantSignupCredits(referrer.id);

    for (const month of ['2020-01', '2020-02', '2020-03']) {
      await db.update(users).set({ freeCreditsMonth: month }).where(eq(users.id, referrer.id));
      await grantMonthlyCredits();
    }

    expect((await getBalance(referrer.id)).total).toBe(8); // 5 + 3
  });
});
