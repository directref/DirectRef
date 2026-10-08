import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import * as adminService from './admin.service';
import { getWaitlistDashboard } from '../waitlist/waitlist.service';
import { requireAuth } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { isAdmin } from './admin.access';

const router = Router();

/** Admin = a logged-in DirectRef account that isAdmin() accepts (a verified
 *  email on ADMIN_EMAILS — see admin.access.ts).
 *
 *  Replaces the old shared ADMIN_SECRET: these routes return real people's
 *  email addresses, and a shared password leaks with a screenshot and can
 *  only be revoked by rotating it for everyone. An account is revoked by
 *  removing it from the list. */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!isAdmin(req.user)) return next(new AppError(403, 'FORBIDDEN', 'Admin access only'));
    next();
  });
}

router.use(requireAdmin);

const isTimeZone = (tz: string) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
};

const WaitlistDashboardQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  tz: z.string().max(64).refine(isTimeZone, 'Unknown time zone').default('UTC'),
});

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
