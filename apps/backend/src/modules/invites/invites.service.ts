import crypto from 'crypto';
import { db } from '../../config/db';
import { invites, users, connections } from '../../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import { createNotification } from '../notifications/notifications.service';

/** Generate a unique invite token */
function generateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/** users.invite_code is varchar(16) AND UNIQUE. Both halves matter: exceed the
 *  length and the INSERT throws, collide and the INSERT throws — and either way
 *  the user just sees "An unexpected error occurred" and cannot create an
 *  account. */
const CODE_MAX_LEN = 16;
const SUFFIX_CHARS = 6; // 3 random bytes → 16.7M values per prefix
const MAX_PREFIX_LEN = CODE_MAX_LEN - 1 - SUFFIX_CHARS; // 9, leaving room for "-"

/**
 * A short, human-ish invite code derived from a first name (e.g. "maya-x7k2f1").
 *
 * The prefix is TRUNCATED and the result is always within varchar(16). It used
 * to be `${first}-${4 hex}` with no bound, so anyone whose first name ran past
 * 11 characters — Konstantinos, Aleksandrina — overflowed the column and simply
 * could not register.
 *
 * A name written in a non-Latin script strips to nothing (Hebrew, Arabic,
 * Cyrillic...). That used to yield "-a1b2", funnelling every such user into one
 * shared 65k namespace — on a product built for Israeli tech, most of them.
 * Those now get a pure-random code instead: no shared prefix, no readability to
 * lose, and the full keyspace to themselves.
 *
 * Not unique on its own — use generateUniqueInviteCode.
 */
export function generateInviteCode(fullName: string): string {
  const first = (fullName.split(' ')[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const prefix = first.slice(0, MAX_PREFIX_LEN);
  if (!prefix) return crypto.randomBytes(6).toString('hex'); // 12 chars, no prefix to speak of
  return `${prefix}-${crypto.randomBytes(SUFFIX_CHARS / 2).toString('hex')}`;
}

/**
 * A code that is actually free, checked against the table before use.
 *
 * Entropy alone is not an answer to a UNIQUE constraint: the old code had none
 * of this and a collision surfaced as a 500 at signup. After a few attempts it
 * gives up on readability and returns a full-width random code, which cannot
 * realistically collide.
 */
export async function generateUniqueInviteCode(fullName: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode(fullName);
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.inviteCode, code))
      .limit(1);
    if (!taken) return code;
  }
  return crypto.randomBytes(CODE_MAX_LEN / 2).toString('hex'); // exactly 16 chars
}

/** Get or create the user's personal invite link token */
export async function getOrCreateInviteLink(inviterId: string): Promise<string> {
  // Check for existing unused invite (re-use the same one)
  const [existing] = await db
    .select()
    .from(invites)
    .where(and(eq(invites.inviterId, inviterId), eq(invites.usedAt, null as unknown as Date)))
    .limit(1);

  if (existing) {
    return `${env.FRONTEND_URL}/join/${existing.token}`;
  }

  const token = generateToken();
  await db.insert(invites).values({ inviterId, token });
  return `${env.FRONTEND_URL}/join/${token}`;
}

/** Validate a token before signup — returns inviter info */
export async function getInviteInfo(token: string) {
  const [invite] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  if (!invite) throw new AppError(404, 'INVITE_NOT_FOUND', 'Invalid or expired invite link');
  if (invite.usedAt) throw new AppError(400, 'INVITE_USED', 'This invite link has already been used');

  const [inviter] = await db.select({
    id: users.id,
    fullName: users.fullName,
    companyName: users.companyName,
    avatarUrl: users.avatarUrl,
  }).from(users).where(eq(users.id, invite.inviterId)).limit(1);

  if (!inviter) throw new AppError(404, 'INVITE_NOT_FOUND', 'Inviter not found');
  return { inviter, token };
}

/** Redeem an invite after signup — auto-connect inviter + new user */
export async function redeemInvite(token: string, newUserId: string): Promise<void> {
  const [invite] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  if (!invite || invite.usedAt) return; // silently ignore

  // Mark invite as used
  await db.update(invites).set({ usedAt: new Date(), usedByUserId: newUserId }).where(eq(invites.id, invite.id));

  // Mark new user as invited by
  await db.update(users).set({ invitedById: invite.inviterId, updatedAt: new Date() }).where(eq(users.id, newUserId));

  // Check if connection already exists
  const [existingConn] = await db.select().from(connections).where(
    or(
      and(eq(connections.requesterId, invite.inviterId), eq(connections.addresseeId, newUserId)),
      and(eq(connections.requesterId, newUserId), eq(connections.addresseeId, invite.inviterId)),
    ),
  ).limit(1);

  if (!existingConn) {
    // Auto-create an accepted connection — no pending step needed for invite
    await db.insert(connections).values({
      requesterId: invite.inviterId,
      addresseeId: newUserId,
      status: 'accepted',
    });
  }

  // Notify inviter
  const [newUser] = await db.select().from(users).where(eq(users.id, newUserId)).limit(1);
  if (newUser) {
    createNotification(
      invite.inviterId,
      'connection_accepted',
      `${newUser.fullName} joined via your invite`,
      `You're now connected — you can see each other's job postings.`,
      '/network',
    ).catch(() => {});
  }
}

/** Get colleagues — users at the same company, not yet connected */
export async function getColleagues(userId: string, companyName: string) {
  if (!companyName.trim()) return [];

  // Get all user IDs already connected
  const existingConns = await db.select({
    requesterId: connections.requesterId,
    addresseeId: connections.addresseeId,
  }).from(connections).where(
    or(eq(connections.requesterId, userId), eq(connections.addresseeId, userId)),
  );

  const connectedIds = new Set<string>();
  existingConns.forEach((c) => {
    connectedIds.add(c.requesterId === userId ? c.addresseeId : c.requesterId);
  });
  connectedIds.add(userId); // exclude self

  // Find users at same company
  const colleagues = await db.select({
    id: users.id,
    fullName: users.fullName,
    headline: users.headline,
    avatarUrl: users.avatarUrl,
    companyName: users.companyName,
  }).from(users).where(eq(users.companyName, companyName)).limit(20);

  return colleagues.filter((u) => !connectedIds.has(u.id));
}
