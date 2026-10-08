import { Router, Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import * as adminService from './admin.service';
import { getWaitlistDashboard } from '../waitlist/waitlist.service';
import { env } from '../../config/env';

const router = Router();

/** The default in env.ts is committed to the repo, so it is public. Now that
 *  /admin/waitlist returns real people's email addresses, production refuses
 *  to serve the admin API at all until ADMIN_SECRET is set to something else
 *  — a 503 rather than a crash at boot, so a missing var cannot take the
 *  whole API down. */
const DEFAULT_ADMIN_SECRET = 'directref_admin_2024_secret_key';
const adminDisabled = env.NODE_ENV === 'production'
  && (env.ADMIN_SECRET === DEFAULT_ADMIN_SECRET || env.ADMIN_SECRET.length < 24);

/** Constant-time compare. Hashing first makes both sides the same length. */
function secretMatches(given: unknown): boolean {
  if (typeof given !== 'string') return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(env.ADMIN_SECRET).digest();
  return timingSafeEqual(a, b);
}

// Simple secret-key guard
function adminGuard(req: Request, res: Response, next: NextFunction): void {
  if (adminDisabled) {
    res.status(503).json({ error: { code: 'ADMIN_DISABLED', message: 'Set ADMIN_SECRET to enable the admin API' } });
    return;
  }
  const secret = req.headers['x-admin-secret'] ?? req.query.secret;
  if (!secretMatches(secret)) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid admin secret' } });
    return;
  }
  next();
}

const isTimeZone = (tz: string) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
};

const WaitlistDashboardQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  tz: z.string().max(64).refine(isTimeZone, 'Unknown time zone').default('UTC'),
});

router.use(adminGuard);

router.get('/stats',    asyncHandler(async (_req, res) => {
  const data = await adminService.getStats();
  res.json({ data });
}));

router.get('/activity', asyncHandler(async (_req, res) => {
  const data = await adminService.getRecentActivity();
  res.json({ data });
}));

router.get('/waitlist', asyncHandler(async (req, res) => {
  const parsed = WaitlistDashboardQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
    return;
  }
  const data = await getWaitlistDashboard(parsed.data);
  res.json({ data });
}));

export default router;
