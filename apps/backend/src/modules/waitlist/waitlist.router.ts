import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { waitlistLimiter } from '../../middleware/rateLimiter';
import { JoinWaitlistSchema, UnsubscribeSchema } from './waitlist.schemas';
import * as svc from './waitlist.service';

/** Public — no auth. The marketing site posts here from every CTA. */
const router = Router();

router.post('/', waitlistLimiter, validate(JoinWaitlistSchema), asyncHandler(async (req, res) => {
  await svc.joinWaitlist(req.body);
  res.status(201).json({ data: { ok: true } });
}));

router.post('/unsubscribe', waitlistLimiter, validate(UnsubscribeSchema), asyncHandler(async (req, res) => {
  await svc.unsubscribe(req.body.token);
  res.json({ data: { ok: true } });
}));

export default router;
