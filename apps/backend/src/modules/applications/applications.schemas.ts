import { z } from 'zod';
import { REFERRER_SETTABLE_STATUSES } from '../../shared/contracts';

export const SubmitApplicationSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
  coverNote: z.string().max(2000).optional(),
  // Multipart fields arrive as strings, not booleans — compare with
  // === 'true' at the point of use. Send the profile CV on file instead of
  // a fresh upload, confirmed by the seeker in the apply modal. Mutually
  // exclusive with a "cv" file in the same request (see submitApplication).
  useProfileCv: z.enum(['true', 'false']).optional(),
});

export const UpdateStatusSchema = z.object({
  // Generated from the shared list, so the API accepts exactly the statuses a
  // referrer is allowed to set — no more, and no less, than the type says.
  status: z.enum(REFERRER_SETTABLE_STATUSES),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
});

export type SubmitApplicationDto = z.infer<typeof SubmitApplicationSchema>;
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
