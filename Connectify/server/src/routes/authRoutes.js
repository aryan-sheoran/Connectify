// routes/authRoutes.js
// Google OAuth 2.0 flow + token refresh + logout.
//
// Complete browser flow:
//   1. Frontend links to   GET /api/v1/auth/google
//   2. Google redirects to GET /api/v1/auth/google/callback
//   3. Passport verifies → googleCallback sets cookies → redirects to /user-home
//   4. Frontend calls     GET /api/v1/auth/me     (to get user data on load)
//   5. When access token expires, frontend calls POST /api/v1/auth/refresh
//   6. Logout:            POST /api/v1/auth/logout


const express = require('express');
const router = express.Router();
const passport = require('../config/password');

const {googleCallback , getAuthUser , refresh , logout} = require('../controllers/authController')

const {authenticate} = require('../middlewares/authMiddleware');

const {authLimiter} = require('../middlewares/rateLimitMiddleware');

// ── Step 1: Redirect the browser to Google's OAuth consent screen ──────────
// passport.authenticate starts the OAuth flow — no controller needed here.
// 'prompt: select_account' forces Google to show the account chooser every time,
// which is good for an anonymous chat app where users may want to switch accounts.

router.get(
    '/google',
    passport.authenticate('google' , {
        scope: ['profile' , 'email'],
        prompt: 'select_account',
        session: false
    })
);



// ── Step 2: Google redirects back here with ?code=... ─────────────────────
// Passport verifies the code, upserts the user in DB, sets req.user,
// then our googleCallback controller sets cookies and redirects to the frontend.

router.get(
    '/google/callback',
    passport.authenticate('google',{
        session: false,
        failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
    }),
    googleCallback
);


// ── GET /auth/me ───────────────────────────────────────────────────────────
// Called by the frontend on app load to check auth state and get user data.
// Returns 401 with code TOKEN_EXPIRED if the access cookie has expired
// (the frontend should then call /auth/refresh silently).
router.get('/me', authenticate, getAuthUser);


// ── POST /auth/refresh ─────────────────────────────────────────────────────
// Silently issues a new access_token cookie using the refresh_token cookie.
// No body needed — both tokens come from httpOnly cookies.
router.post('/refresh', authLimiter, refresh);


// ── POST /auth/logout ──────────────────────────────────────────────────────
// Revokes the refresh token and clears both cookies.
router.post('/logout', authenticate, logout);



module.exports = router;