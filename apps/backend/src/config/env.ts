import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  FRONTEND_URL: z.string().url(),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 chars'),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:3000/api/auth/google/callback'),

  LINKEDIN_CLIENT_ID: z.string().default(''),
  LINKEDIN_CLIENT_SECRET: z.string().default(''),
  LINKEDIN_CALLBACK_URL: z.string().default('http://localhost:3000/api/auth/callback/linkedin'),

  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('support@direct-ref.com'),

  // Waitlist → Resend Segments. A SEPARATE key on purpose: managing contacts
  // needs a full-access Resend key, and RESEND_API_KEY is deliberately a
  // send-only one. Keeping them apart means the key every email path uses can
  // still only send. All three empty = signups are stored but not synced; run
  // scripts/sync-waitlist-segments.ts once they are set to catch up.
  RESEND_CONTACTS_API_KEY: z.string().default(''),
  RESEND_SEGMENT_SEEKERS_ID: z.string().default(''),
  RESEND_SEGMENT_REFERRERS_ID: z.string().default(''),

  // Rate limits. Defaults are exactly the values these were hard-coded to, so
  // production behaviour is unchanged unless a var is explicitly set. They are
  // configurable because an automated suite legitimately registers and uploads
  // far faster than a person, and because ops wants to tune these without a
  // deploy. NEVER raise them in production.
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(10),
  RATE_LIMIT_API_MAX: z.coerce.number().default(1500),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().default(10),
  RATE_LIMIT_SCRAPE_MAX: z.coerce.number().default(30),
  RATE_LIMIT_WAITLIST_MAX: z.coerce.number().default(10),

  // Accounts allowed into /admin (comma-separated, matched against a verified
  // account email). See modules/admin/admin.router.ts.
  ADMIN_EMAILS: z.string().default('shaiatar@gmail.com,anatatar83@gmail.com'),
  UPLOADS_DIR: z.string().default('./uploads'),
  MAX_CV_SIZE_MB: z.coerce.number().default(10),

  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
