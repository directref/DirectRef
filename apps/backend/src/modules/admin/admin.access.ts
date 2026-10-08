import { env } from '../../config/env';

/** Who counts as an admin: a VERIFIED account email listed in ADMIN_EMAILS.
 *
 *  Verified, because otherwise anyone could register an unclaimed admin
 *  address with a password and be let in before verifying it. Account emails
 *  cannot be changed after signup, so a verified match stays valid.
 *
 *  CALLED BY: admin.router (the real gate on every /api/admin route) and
 *  auth.service.sanitizeUser (the `isAdmin` flag the sidebar uses to show the
 *  Admin Panel link — display only; the router decides access). */
const adminEmails = new Set(
  env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
);

export function isAdmin(user: { email: string; emailVerified: boolean } | undefined): boolean {
  return !!user && user.emailVerified && adminEmails.has(user.email.toLowerCase());
}
