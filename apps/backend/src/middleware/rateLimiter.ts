import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/** Strict limit for auth endpoints (login, register) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again in 15 minutes.' } },
});

/** Relaxed limit for general API */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } },
});

/** Tight limit for CV upload (expensive operation) */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: env.RATE_LIMIT_UPLOAD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please try again in an hour.' } },
});

/** Limit for URL scraping */
export const scrapeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.RATE_LIMIT_SCRAPE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many scrape requests. Please try again later.' } },
});

/** Public, unauthenticated waitlist form — the one write anyone on the
 *  internet can make. 10 per IP per hour is far above what a person needs
 *  (one per list) and far below what makes a bot run worthwhile. */
export const waitlistLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.RATE_LIMIT_WAITLIST_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
});
