import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../db/schema';
import { generateInviteCode, generateUniqueInviteCode } from './invites.service';
import { register } from '../auth/auth.service';

/**
 * WHY THIS FILE:
 *  - PROBLEM: users.invite_code is varchar(16) AND UNIQUE, and the generator
 *    respected neither. `${firstName}-${4 hex}` overflowed the column for any
 *    first name past 11 characters, and a name in a non-Latin script stripped
 *    to empty — so every Hebrew-named user shared one 65,536-value namespace,
 *    with no retry when two of them met.
 *  - COST OF FAILURE: the user cannot create an account at all. Both paths end
 *    in an INSERT that throws and a bare "An unexpected error occurred". For a
 *    product built for Israeli tech, the second path is most of the audience.
 *  - SUCCESS: every name produces a code that fits and is free.
 */

const MAX_LEN = 16;

describe('generateInviteCode — the column will not accept anything longer', () => {
  it.each([
    ['Shai', 'a short name'],
    ['Christopher', 'exactly the old breaking point'],
    ['Konstantinos', 'the name that used to 500'],
    ['Aleksandrina', 'another that used to 500'],
    ['Bartholomew', 'long but previously ok'],
    ['Wolfeschlegelsteinhausenbergerdorff', 'absurd, still must not overflow'],
  ])('%s (%s) fits varchar(16)', (first) => {
    const code = generateInviteCode(`${first} Tester`);
    expect(code.length, `"${code}" is ${code.length} chars`).toBeLessThanOrEqual(MAX_LEN);
    expect(code.length).toBeGreaterThan(0);
  });

  it.each([
    ['יוסי כהן', 'Hebrew'],
    ['נועה לוי', 'Hebrew'],
    ['أحمد حسن', 'Arabic'],
    ['Владимир Петров', 'Cyrillic'],
    ['王 伟', 'Chinese'],
  ])('%s (%s) gets a real code, not a bare suffix', (name) => {
    const code = generateInviteCode(name);
    expect(code.length).toBeLessThanOrEqual(MAX_LEN);
    // The old generator returned "-a1b2" here: a shared empty prefix that put
    // every non-Latin-named user in the same small namespace.
    expect(code.startsWith('-'), `"${code}" still has an empty prefix`).toBe(false);
    expect(code.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps the name readable when it fits', () => {
    expect(generateInviteCode('Maya Levi')).toMatch(/^maya-[0-9a-f]{6}$/);
  });

  it('truncates rather than overflowing', () => {
    expect(generateInviteCode('Konstantinos Papadopoulos')).toMatch(/^konstant-[0-9a-f]{6}$|^konstanti-[0-9a-f]{6}$/);
  });

  it('draws from a keyspace large enough that clashes are rare', () => {
    // Deliberately NOT "2000 draws give 2000 distinct codes". With 16.7M
    // values the birthday paradox makes an occasional clash in 2,000 draws
    // entirely expected (~11% per run) — an earlier version of this test
    // asserted perfection and was itself flaky, which CI caught before a
    // human did.
    //
    // The threshold separates the two implementations cleanly. The old 4-hex
    // suffix had 65,536 values and would clash ~30 times in 2,000 draws
    // (~1,969 distinct); 6 hex clashes ~0.1 times (~2,000 distinct). Anything
    // above 1,990 could only have come from the larger keyspace.
    //
    // Actual uniqueness is not this function's job at all — it is
    // generateUniqueInviteCode's, which checks the table. See below.
    const codes = new Set(Array.from({ length: 2_000 }, () => generateInviteCode('David Cohen')));
    expect(codes.size).toBeGreaterThan(1_990);
    expect(generateInviteCode('David Cohen')).toMatch(/^david-[0-9a-f]{6}$/);
  });
});

describe('generateUniqueInviteCode — checks the table, does not just hope', () => {
  it('avoids a code that is already taken', async () => {
    const taken = generateInviteCode('Maya Levi');
    await db.insert(users).values({
      email: 'holder@example.test',
      fullName: 'Maya Levi',
      inviteCode: taken,
    });

    for (let i = 0; i < 20; i += 1) {
      expect(await generateUniqueInviteCode('Maya Levi')).not.toBe(taken);
    }
  });

  it('always returns something the column accepts', async () => {
    for (const name of ['Konstantinos P', 'יוסי כהן', 'Maya Levi', '   ']) {
      const code = await generateUniqueInviteCode(name);
      expect(code.length).toBeLessThanOrEqual(MAX_LEN);
      expect(code.length).toBeGreaterThan(0);
    }
  });
});

describe('registration actually succeeds for these names', () => {
  // The real regression test: these two used to throw on INSERT.
  it.each([
    ['Konstantinos Papadopoulos', 'konstantinos@example.test'],
    ['יוסי כהן', 'yossi@example.test'],
    ['Aleksandrina Petrova', 'aleksandrina@example.test'],
  ])('%s can create an account', async (fullName, email) => {
    const user = await register({ email, password: 'TestPass123', fullName, isReferrer: false });

    expect(user.id).toBeTruthy();
    expect(user.inviteCode!.length).toBeLessThanOrEqual(MAX_LEN);

    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    expect(stored.fullName).toBe(fullName);
  });

  it('two people sharing a first name both get in', async () => {
    const a = await register({ email: 'david1@example.test', password: 'TestPass123', fullName: 'David Cohen', isReferrer: false });
    const b = await register({ email: 'david2@example.test', password: 'TestPass123', fullName: 'David Levi', isReferrer: false });
    expect(a.inviteCode).not.toBe(b.inviteCode);
  });

  it('two people with Hebrew names both get in', async () => {
    // Previously both drew from the same "-XXXX" namespace.
    const a = await register({ email: 'heb1@example.test', password: 'TestPass123', fullName: 'יוסי כהן', isReferrer: false });
    const b = await register({ email: 'heb2@example.test', password: 'TestPass123', fullName: 'נועה לוי', isReferrer: false });
    expect(a.inviteCode).not.toBe(b.inviteCode);
  });
});
