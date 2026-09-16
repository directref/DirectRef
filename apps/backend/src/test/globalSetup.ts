import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

/** Runs ONCE before the whole suite.
 *
 *  Brings the throwaway test database up to the current schema by running the
 *  real migrations — not `drizzle-kit push`, and not a hand-maintained copy of
 *  the schema. That matters: these tests assert on behaviour that depends on
 *  SQL-level constraints (the applications_status_check CHECK, the ON DELETE
 *  CASCADE from applications to application_messages), so the suite has to run
 *  against the same DDL production runs. A drifted test schema would let a
 *  broken migration pass. */
export default async function globalSetup(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('globalSetup: DATABASE_URL is not set');

  if (!url.includes(':5433/')) {
    throw new Error(
      `Refusing to run the suite against ${url} — the test database must be on port 5433. ` +
      'Every test truncates every table; pointing this at the dev or production database would erase it.',
    );
  }

  const client = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await migrate(drizzle(client), {
      migrationsFolder: path.resolve(__dirname, '../db/migrations'),
    });
  } catch (err) {
    throw new Error(
      `Could not migrate the test database at ${url}.\n` +
      'Is it running? Start it with:  npm run test:db:up\n\n' +
      `Original error: ${(err as Error).message}`,
    );
  } finally {
    await client.end();
  }

  // Fresh uploads root — the retention sweep deletes files from here, and a
  // leftover tree from a previous run would make those assertions lie.
  const uploads = path.resolve(process.env.UPLOADS_DIR ?? './.test-uploads');
  await fs.promises.rm(uploads, { recursive: true, force: true });
  await fs.promises.mkdir(path.join(uploads, 'cvs'), { recursive: true });
}
