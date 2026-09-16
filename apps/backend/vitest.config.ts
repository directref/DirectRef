import { defineConfig } from 'vitest/config';

/** The throwaway test database (docker-compose service `postgres-test`, port
 *  5433). Deliberately NOT 5432 — the dev database must never be reachable
 *  from the suite, because every test truncates every table. */
const TEST_DATABASE_URL = 'postgresql://directref:directref_pass@localhost:5433/directref_test';

/** Uploads root for the suite. The retention sweep unlinks C.V. files from
 *  disk, so tests need a real directory they own and can safely empty. */
const TEST_UPLOADS_DIR = './.test-uploads';

// globalSetup runs in the main vitest process, which does not receive
// `test.env` — so set it here too, where both can see it.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setup.ts'],

    // Every test truncates the whole database, so test FILES cannot run in
    // parallel against one shared server. Tests inside a file are sequential
    // anyway. These are fast enough that this costs little.
    fileParallelism: false,

    // Migrating 20 migrations on a cold container takes a moment.
    testTimeout: 20_000,
    hookTimeout: 30_000,

    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      UPLOADS_DIR: TEST_UPLOADS_DIR,
      FRONTEND_URL: 'http://localhost:5173',

      // Dummy values that satisfy env.ts's 32-char minimum. Nothing real is
      // ever needed here — the suite signs no token a human will use, and
      // production secrets must never reach a test runner.
      JWT_ACCESS_SECRET: 'test_only_access_secret_not_real_0123456789',
      JWT_REFRESH_SECRET: 'test_only_refresh_secret_not_real_0123456789',
      COOKIE_SECRET: 'test_only_cookie_secret_not_real_0123456789',

      // Empty on purpose: the email module is mocked in setup.ts, so no
      // outbound mail is possible even if a mock were missed.
      RESEND_API_KEY: '',
    },
  },
});
