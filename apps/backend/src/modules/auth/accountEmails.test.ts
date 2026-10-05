import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db';
import { users } from '../../db/schema';
import { sendPasswordResetEmail } from '../../services/email';
import { register } from './auth.service';
import { useServer, as } from '../../test/http';
import { makeUser } from '../../test/factories';

/**
 * WHY THIS FILE:
 *  - PROBLEM: forgot-password and confirm-your-email are the two flows where
 *    the only proof of identity is a link in someone's inbox. Neither had a
 *    single test. The link itself needs a real mailbox, but everything around
 *    it — issuing the token, honouring it once, refusing it after — does not.
 *  - COST OF FAILURE: a locked-out user with no way back in (they cannot
 *    reach support through the app), or a reset link that works twice or
 *    never expires, which is an account takeover waiting for a leaked email.
 *  - SUCCESS: the token we would have emailed resets the password exactly
 *    once, inside its hour, and the form never reveals who has an account.
 */

const { base } = useServer();
const anon = () => as(base, null);

const tokenFor = async (email: string) =>
  (await db.select().from(users).where(eq(users.email, email)))[0];

const login = (email: string, password: string) => anon().post('/api/auth/login', { email, password });

describe('forgot password → email link → new password', () => {
  it('emails a reset link and the link sets a new password that logs in', async () => {
    await register({ email: 'dana@example.test', password: 'OldPass123', fullName: 'Dana Levi', isReferrer: false });

    const ask = await anon().post('/api/auth/forgot-password', { email: 'dana@example.test' });
    expect(ask.status).toBe(200);

    const { resetToken } = await tokenFor('dana@example.test');
    expect(resetToken).toBeTruthy();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith('dana@example.test', resetToken);

    const reset = await anon().post('/api/auth/reset-password', { token: resetToken, newPassword: 'NewPass456' });
    expect(reset.status).toBe(200);

    expect((await login('dana@example.test', 'NewPass456')).status).toBe(200);
    expect((await login('dana@example.test', 'OldPass123')).status).toBe(401);
  });

  it('a reset link works once — the second click is refused', async () => {
    await register({ email: 'dana@example.test', password: 'OldPass123', fullName: 'Dana Levi', isReferrer: false });
    await anon().post('/api/auth/forgot-password', { email: 'dana@example.test' });
    const { resetToken } = await tokenFor('dana@example.test');

    await anon().post('/api/auth/reset-password', { token: resetToken, newPassword: 'NewPass456' });
    const again = await anon().post('/api/auth/reset-password', { token: resetToken, newPassword: 'Hijack789' });

    expect(again.status).toBe(400);
    expect((await login('dana@example.test', 'NewPass456')).status).toBe(200);
  });

  it('a link older than an hour is refused', async () => {
    await register({ email: 'dana@example.test', password: 'OldPass123', fullName: 'Dana Levi', isReferrer: false });
    await anon().post('/api/auth/forgot-password', { email: 'dana@example.test' });
    const { resetToken } = await tokenFor('dana@example.test');
    await db.update(users).set({ resetTokenExp: new Date(Date.now() - 60_000) }).where(eq(users.email, 'dana@example.test'));

    const res = await anon().post('/api/auth/reset-password', { token: resetToken, newPassword: 'NewPass456' });
    expect(res.status).toBe(400);
    expect((await login('dana@example.test', 'OldPass123')).status).toBe(200);
  });

  it('answers an unknown address exactly like a real one, and sends nothing', async () => {
    const res = await anon().post('/api/auth/forgot-password', { email: 'nobody@example.test' });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('refuses a weak new password', async () => {
    await register({ email: 'dana@example.test', password: 'OldPass123', fullName: 'Dana Levi', isReferrer: false });
    await anon().post('/api/auth/forgot-password', { email: 'dana@example.test' });
    const { resetToken } = await tokenFor('dana@example.test');

    const res = await anon().post('/api/auth/reset-password', { token: resetToken, newPassword: 'short' });
    expect(res.status).toBe(422);
    expect((await login('dana@example.test', 'OldPass123')).status).toBe(200);
  });
});

describe('confirming an email address', () => {
  // register() confirms test addresses and mail-less environments on the spot
  // (an account that cannot receive mail must not be gated on it), so these
  // start from a user who is genuinely waiting on the link.
  const unconfirmed = (email: string) =>
    makeUser({ email, emailVerified: false, emailVerifyToken: 'a'.repeat(64) });

  it('the emailed link marks the address confirmed', async () => {
    const user = await unconfirmed('dana@example.test');

    const res = await anon().get(`/api/auth/verify-email/${'a'.repeat(64)}`);
    expect(res.status).toBe(200);
    const after = await tokenFor(user.email);
    expect(after.emailVerified).toBe(true);
    expect(after.emailVerifyToken).toBeNull();
  });

  it('a made-up link is refused and confirms nobody', async () => {
    const user = await unconfirmed('dana@example.test');
    const res = await anon().get(`/api/auth/verify-email/${'b'.repeat(64)}`);
    expect(res.status).toBe(400);
    expect((await tokenFor(user.email)).emailVerified).toBe(false);
  });

  it('confirming a company address also verifies it as the work email', async () => {
    // The posting gate relies on this: a referrer who signed up with
    // rae@acme.co.il should not have to verify the same mailbox twice.
    const user = await unconfirmed('rae@acme.co.il');
    await anon().get(`/api/auth/verify-email/${'a'.repeat(64)}`);

    const after = await tokenFor(user.email);
    expect(after.workEmail).toBe('rae@acme.co.il');
    expect(after.workEmailVerified).toBe(true);
  });

  it('confirming a Gmail address does not make it a work email', async () => {
    const user = await unconfirmed('dana@gmail.com');
    await anon().get(`/api/auth/verify-email/${'a'.repeat(64)}`);
    expect((await tokenFor(user.email)).workEmailVerified).toBe(false);
  });
});
