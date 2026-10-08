import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { eventsLimiter } from '../../middleware/rateLimiter';
import { db } from '../../config/db';
import { marketingEvents, MARKETING_EVENT_TYPES } from '../../db/schema/marketingEvents';
import { WAITLIST_ROLES } from '../../db/schema/waitlistSignups';

/** Public — no auth. The marketing site reports landing page views and CTA
 *  clicks here, fire-and-forget, for the Conversion dashboard. Anonymous by
 *  design: see db/schema/marketingEvents.ts. */
const router = Router();

const text = (max: number) => z.string().trim().max(max).optional();

const EventSchema = z.object({
  type: z.enum(MARKETING_EVENT_TYPES),
  cta: text(64),
  role: z.enum(WAITLIST_ROLES).optional(),
  path: text(256),
  utmSource: text(128),
  utmMedium: text(128),
  utmCampaign: text(128),
});

router.post('/', eventsLimiter, validate(EventSchema), asyncHandler(async (req, res) => {
  const e = req.body as z.infer<typeof EventSchema>;
  await db.insert(marketingEvents).values({
    ...e,
    // A CTA name only means something on a click.
    cta: e.type === 'cta_click' ? e.cta : undefined,
  });
  res.status(202).json({ data: { ok: true } });
}));

export default router;
