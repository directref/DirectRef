import { Router, Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { env } from '../../config/env';
import { db } from '../../config/db';
import { testRuns, TEST_SUITES } from '../../db/schema/testRuns';

/** CI → POST /api/test-runs, one summary per suite run (see
 *  scripts/report-test-results.mjs). Guarded by TEST_REPORT_TOKEN, which
 *  lives in GitHub Actions secrets and on Railway. The token can only add
 *  test results; it reads nothing. Unset = the endpoint is off. */
const router = Router();

function ciGuard(req: Request, res: Response, next: NextFunction): void {
  if (!env.TEST_REPORT_TOKEN) {
    res.status(503).json({ error: { code: 'DISABLED', message: 'TEST_REPORT_TOKEN is not set' } });
    return;
  }
  const given = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  // Hash both sides so the compare is constant-time whatever the lengths.
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(env.TEST_REPORT_TOKEN).digest();
  if (!timingSafeEqual(a, b)) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    return;
  }
  next();
}

const count = z.number().int().min(0).max(1_000_000);
const str = (max: number) => z.string().max(max).optional();

const TestRunSchema = z.object({
  suite: z.enum(TEST_SUITES),
  workflow: z.string().min(1).max(64),
  trigger: str(32),
  scope: str(256),
  branch: str(256),
  commitSha: z.string().regex(/^[0-9a-f]{7,40}$/).optional(),
  runId: z.string().regex(/^\d{1,32}$/),
  runAttempt: z.number().int().min(1).max(100).default(1),
  runUrl: z.string().url().max(512).optional(),
  total: count,
  passed: count,
  failed: count,
  flaky: count.default(0),
  skipped: count.default(0),
  durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
  failures: z.array(z.object({
    title: z.string().min(1).max(512),
    file: str(256),
    kind: z.enum(['failed', 'flaky']),
  })).max(100).default([]),
});

router.post('/', ciGuard, validate(TestRunSchema), asyncHandler(async (req, res) => {
  const run = req.body as z.infer<typeof TestRunSchema>;
  await db
    .insert(testRuns)
    .values(run)
    .onConflictDoUpdate({
      target: [testRuns.runId, testRuns.runAttempt, testRuns.suite],
      set: { ...run, createdAt: new Date() },
    });
  res.status(201).json({ data: { ok: true } });
}));

export default router;
