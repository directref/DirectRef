import postgres from 'postgres';

/**
 * Direct database access, used for exactly one thing: reading tokens that
 * would otherwise arrive by email.
 *
 *  Work-email verification is a link in a referrer's inbox, and posting a job
 *  is gated on it — so without this, the single most important flow in the
 *  product (a referrer posting a role) is untestable. Reading the token and
 *  then hitting the REAL verification endpoint exercises everything except
 *  delivery, which is Resend's problem and not ours.
 *
 *  Everything else in these tests goes through the public API or the browser.
 *  Reach for this only when a value is genuinely unreachable any other way.
 */
const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://directref:directref_pass@localhost:5433/directref_test';

let client: ReturnType<typeof postgres> | null = null;

function db() {
  if (!client) client = postgres(DATABASE_URL, { max: 2, onnotice: () => {} });
  return client;
}

/** The token from the work-email verification link. */
export async function workEmailTokenFor(email: string): Promise<string> {
  const rows = await db()<{ work_email_verify_token: string | null }[]>`
    SELECT work_email_verify_token FROM users WHERE email = ${email.toLowerCase()} LIMIT 1
  `;
  const token = rows[0]?.work_email_verify_token;
  if (!token) throw new Error(`No work-email token for ${email} — was the work email submitted?`);
  return token;
}

/** Age a row so a time-based rule can be observed in a browser.
 *  Used sparingly: the clocks themselves are covered far better by the vitest
 *  integration suite, which can assert on the sweep directly. */
export async function backdateApplication(id: string, days: number): Promise<void> {
  await db()`
    UPDATE applications
       SET created_at = now() - ${days}::int * interval '1 day',
           updated_at = now() - ${days}::int * interval '1 day'
     WHERE id = ${id}
  `;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}
