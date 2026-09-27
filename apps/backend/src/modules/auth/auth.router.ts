import { Router } from 'express';
import passport from 'passport';
import * as ctrl from './auth.controller';
import { validate } from '../../middleware/validate';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from './auth.schemas';

const router = Router();

router.post('/register', authLimiter, validate(RegisterSchema), ctrl.register);
router.post('/login', authLimiter, validate(LoginSchema), ctrl.login);
// optionalAuth, not requireAuth: logout's only job is clearing cookies, and
// that must succeed even for a token whose user no longer exists (e.g. the
// account was just deleted) -- requireAuth 401ing here left the cookies in
// place, so the browser kept sending a technically-valid-but-orphaned
// access token and the app rendered a broken, half-logged-in shell.
router.post('/logout', optionalAuth, ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
router.post('/refresh', ctrl.refresh);
router.get('/verify-email/:token', ctrl.verifyEmail);
router.get('/verify-work-email/:token', ctrl.verifyWorkEmail);
router.post('/forgot-password', authLimiter, validate(ForgotPasswordSchema), ctrl.forgotPassword);
router.post('/reset-password', validate(ResetPasswordSchema), ctrl.resetPassword);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback', ctrl.googleCallback);

// LinkedIn OAuth — login/signup (anonymous)
router.get('/linkedin', ctrl.linkedinLogin);
// LinkedIn OAuth — connect to the current account (from Settings), not a login
router.get('/linkedin/connect', requireAuth, ctrl.linkedinConnect);
router.get('/callback/linkedin', ctrl.linkedinCallback);

export default router;
