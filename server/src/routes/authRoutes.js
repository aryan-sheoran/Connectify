// routes/authRoutes.js
// Google OAuth 2.0 flow + OTP verification + profile setup + token refresh + logout.
//
// Complete browser flow:
//   1. Frontend links to   GET  /api/v1/auth/google
//   2. Google redirects to GET  /api/v1/auth/google/callback
//   3. Passport verifies → googleCallback emails OTP → redirects to /verify-otp?token=<t>
//   4. Frontend POSTs     POST /api/v1/auth/verify-otp  { token, otp }
//      • New user  → setup_token cookie set → response: { redirect: '/setup-profile' }
//      • Returning → full JWT cookies set   → response: { redirect: '/profile' }
//   5. (New users only)   POST /api/v1/auth/complete-profile  { username, tagline }
//      → full JWT cookies set → response: { redirect: '/profile' }
//   6. Frontend calls     GET  /api/v1/auth/me       (to load user data)
//   7. When access token expires, frontend calls POST /api/v1/auth/refresh
//   8. Logout:            POST /api/v1/auth/logout

const express  = require('express');
const router   = express.Router();
const passport = require('../config/passport');

const {
  googleCallback,
  verifyOtpHandler,
  resendOtp,
  completeProfile,
  getAuthUser,
  refresh,
  logout,
} = require('../controllers/authController');

const { authenticate } = require('../middleware/authMiddleware');
const { authLimiter }  = require('../middleware/rateLimitMiddleware');

// ── Step 1: Redirect browser to Google's OAuth consent screen ───────────────
router.get(
  '/google',
  passport.authenticate('google', {
    scope:   ['profile', 'email'],
    prompt:  'select_account',
    session: false,
  })
);

// ── Step 2: Google redirects back → Passport verifies → email OTP ───────────
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session:         false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
  }),
  googleCallback
);

// ── Step 3: Verify OTP submitted by the user ─────────────────────────────────
router.post('/verify-otp', authLimiter, verifyOtpHandler);

// ── Step 4: Resend OTP (same pending session, fresh code) ────────────────────
router.post('/resend-otp', authLimiter, resendOtp);

// ── Step 5: New user completes their profile (username + tagline) ─────────────
router.post('/complete-profile', completeProfile);

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', authenticate, getAuthUser);

// ── POST /auth/refresh ─────────────────────────────────────────────────────
router.post('/refresh', authLimiter, refresh);

// ── POST /auth/logout ──────────────────────────────────────────────────────
router.post('/logout', authenticate, logout);

module.exports = router;
