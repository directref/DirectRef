import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { beforeAll, afterAll, afterEach } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { and, eq } from 'drizzle-orm';
import app from '../app';
import { env } from '../config/env';
import { db, queryClient } from '../config/db';
import { notifications } from '../db/schema';

/** The real Express app on a random port, for tests that need to go through
 *  routing, auth and validation rather than calling a service directly.
 *
 *  Call once at the top level of a test file; `base()` is only valid inside
 *  a test. The uploads directory is created up front because multer writes
 *  into it and does not create it. */
export function useServer(): { base: () => string } {
  let server: Server;
  let url = '';
  beforeAll(async () => {
    await fs.promises.mkdir(path.resolve(env.UPLOADS_DIR, 'cvs'), { recursive: true });
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  afterEach(waitForBackgroundWrites);
  return { base: () => url };
}

/** The server sends notifications and stamps statuses fire-and-forget, after
 *  the response has gone out. If one of those writes is still running when
 *  the next test's setup TRUNCATEs every table, Postgres reports "deadlock
 *  detected" and an unrelated test fails (seen ~1 run in 10). So between
 *  tests, wait until no other session has a query running — several checks
 *  in a row, because a chain of awaits has short idle gaps between queries. */
async function waitForBackgroundWrites() {
  const deadline = Date.now() + 3000;
  let quiet = 0;
  while (Date.now() < deadline && quiet < 4) {
    const [{ n }] = await queryClient<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
       WHERE datname = current_database() AND pid <> pg_backend_pid() AND state = 'active'
    `;
    quiet = n === 0 ? quiet + 1 : 0;
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** A logged-in client for one user (or an anonymous one, with null).
 *
 *  Signs the access-token cookie directly instead of logging in: requireAuth
 *  only checks the JWT's `sub` against the users table, and the factories
 *  create users without a password. Logging in itself is covered by the
 *  browser suite and by passwordReset.test.ts. */
export function as(base: () => string, userId: string | null) {
  const cookie = userId ? `access_token=${jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET)}` : '';
  const headers = (extra: Record<string, string> = {}) => ({ ...(cookie ? { Cookie: cookie } : {}), ...extra });
  const json = (method: string) => (p: string, body?: unknown) =>
    fetch(`${base()}${p}`, {
      method,
      headers: headers({ 'Content-Type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
  return {
    get: (p: string) => fetch(`${base()}${p}`, { headers: headers(), redirect: 'manual' }),
    post: json('POST'),
    patch: json('PATCH'),
    del: json('DELETE'),
    /** multipart/form-data, for the C.V. upload routes. */
    upload: (p: string, fields: Record<string, string>, file?: { name: string; bytes: Buffer }, method = 'POST') => {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      if (file) form.append('cv', new Blob([file.bytes], { type: 'application/pdf' }), file.name);
      return fetch(`${base()}${p}`, { method, headers: headers(), body: form });
    },
  };
}

/** A minimal genuine PDF. multer checks the mimetype, and several tests
 *  download the file back and compare bytes, so each label is distinguishable. */
export const pdf = (label = 'cv') =>
  Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`);

/** Several notifications are created fire-and-forget (the request does not
 *  await them), so reading straight after the response can race the insert.
 *  Polls briefly rather than sleeping a fixed time. */
export async function waitForNotification(userId: string, type: string, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.type, type)));
    if (rows.length) return rows;
    await new Promise((r) => setTimeout(r, 50));
  }
  return [];
}
