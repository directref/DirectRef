import { z } from 'zod';
import { WAITLIST_ROLES } from '../../db/schema/waitlistSignups';

const utm = z.string().trim().max(128).optional();

export const JoinWaitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(320),
  role: z.enum(WAITLIST_ROLES),
  sourceCta: z.string().trim().max(64).optional(),
  utmSource: utm,
  utmMedium: utm,
  utmCampaign: utm,
  utmTerm: utm,
  utmContent: utm,
  // Honeypot. Hidden from people, filled in by form-stuffing bots. Accepted
  // here (not rejected by validation) so a bot gets the same success reply a
  // person does and learns nothing.
  website: z.string().optional(),
});

export const UnsubscribeSchema = z.object({
  token: z.string().uuid(),
});

export type JoinWaitlistDto = z.infer<typeof JoinWaitlistSchema>;
