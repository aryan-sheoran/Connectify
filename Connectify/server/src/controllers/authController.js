// controllers/authController.js
// Handles Google OAuth callback, OTP verification, profile setup,
// token refresh, and logout.
//
// ── NEW Auth Flow ──────────────────────────────────────────────────────────
//
//  1. googleCallback  — Triggered after Google verifies identity.
//                       Generates OTP, emails it, stores in Redis,
//                       redirects browser to /verify-otp?token=<pendingToken>
//
//  2. verifyOtp       — POST /auth/verify-otp
//                       Frontend sends { token, otp }.
//                       On success:
//                         • New user  → stores setup_token cookie → redirects /setup-profile
//                         • Returning → issues full JWT cookies   → redirects /profile
//
//  3. completeProfile — POST /auth/complete-profile
//                       Protected by setup_token cookie.
//                       Saves username + tagline, marks profile_completed = true,
//                       issues full JWT cookies → redirects /profile.
//
//  4. resendOtp       — POST /auth/resend-otp
//                       Re-generates OTP for existing pendingToken session.
//
// Cookie strategy:
//   access_token  — httpOnly, Secure, SameSite=Lax, maxAge 15 min
//   refresh_token — httpOnly, Secure, SameSite=Lax, maxAge 7 days
//   setup_token   — httpOnly, Secure, SameSite=Lax, maxAge 15 min (new users only)

const pool  = require('../config/db');
const redis = require('../config/redis');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');
const { generateOtp, storeOtp, verifyOtp, storeSetupToken, verifySetupToken } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mailer');

// ── Cookie helpers ─────────────────────────────────────────────────────────

const COOKIE_BASE = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};

const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: 15 * 60 * 1000,           // 15 minutes
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const SETUP_COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: 15 * 60 * 1000,           // 15 minutes — enough to complete setup form
};

/**
 * Issues access + refresh JWT cookies and persists the refresh token in the DB.
 * Extracted to avoid repetition in verifyOtp and completeProfile.
 */
const issueAuthCookies = async (res, user) => {
  const accessToken  = signAccessToken ({ id: user.id, username: user.username });
  const refreshToken = signRefreshToken({ id: user.id });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [user.id, refreshToken, expiresAt]
  );

  res.cookie('access_token',  accessToken,  ACCESS_COOKIE_OPTIONS);
  res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);
};

// ── GET /auth/google/callback ──────────────────────────────────────────────
// Passport has already verified the OAuth code and upserted the user.
// Instead of issuing JWTs immediately, we send an OTP to the user's email.
const googleCallback = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }

    // Generate a 6-digit OTP and a pending session token
    const otp          = generateOtp();
    const isNewUser    = !user.profile_completed;
    const pendingToken = await storeOtp({
      userId:      user.id,
      email:       user.email,
      displayName: user.displayName || 'there',
      otp,
      isNewUser,
    });

    // Email the OTP — non-blocking error handling so the redirect still works
    try {
      await sendOtpEmail(user.email, otp, user.displayName || 'there');
    } catch (mailErr) {
      console.error('❌  Failed to send OTP email:', mailErr.message);
      // In development you can still proceed by reading the OTP from server logs
      console.log(`[DEV] OTP for ${user.email}: ${otp}`);
    }

    // Redirect browser to the OTP verification page
    return res.redirect(`${process.env.CLIENT_URL}/verify-otp?token=${pendingToken}`);

  } catch (error) {
    next(error);
  }
};

// ── POST /auth/verify-otp ─────────────────────────────────────────────────
// Called from the OtpVerifyPage with { token, otp } in the request body.
const verifyOtpHandler = async (req, res, next) => {
  try {
    const { token, otp } = req.body;

    if (!token || !otp) {
      return res.status(400).json({ success: false, message: 'Token and OTP are required.' });
    }

    const result = await verifyOtp(token, otp);

    if (!result.success) {
      return res.status(400).json({
        success:      false,
        message:      result.error,
        attemptsLeft: result.attemptsLeft,
      });
    }

    const { userId, isNewUser } = result.data;

    // Fetch the latest user row from DB
    const userResult = await pool.query(
      'SELECT id, username, email, avatar_url, profile_completed FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = userResult.rows[0];

    if (isNewUser) {
      // New user — issue a short-lived setup_token cookie and send them to /setup-profile
      const setupToken = await storeSetupToken(userId);
      res.cookie('setup_token', setupToken, SETUP_COOKIE_OPTIONS);
      return res.status(200).json({ success: true, redirect: '/setup-profile' });
    }

    // Returning user — issue full JWT cookies
    await issueAuthCookies(res, user);
    return res.status(200).json({ success: true, redirect: '/profile' });

  } catch (error) {
    next(error);
  }
};

// ── POST /auth/resend-otp ─────────────────────────────────────────────────
// Generates a fresh OTP for an existing pending session identified by token.
const resendOtp = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required.' });
    }

    // Check if the pending session still exists
    const raw = await redis.get(`otp:${token}`);
    if (!raw) {
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please log in again.',
      });
    }

    const stored = JSON.parse(raw);

    // Generate a fresh OTP and replace the existing entry
    const newOtp = generateOtp();
    await redis.setEx(
      `otp:${token}`,
      10 * 60,
      JSON.stringify({ ...stored, otp: newOtp, attempts: 0 })
    );

    // Send the new OTP
    try {
      await sendOtpEmail(stored.email, newOtp, stored.displayName || 'there');
    } catch (mailErr) {
      console.error('❌  Failed to resend OTP email:', mailErr.message);
      console.log(`[DEV] Resent OTP for ${stored.email}: ${newOtp}`);
    }

    return res.status(200).json({ success: true, message: 'OTP resent successfully.' });

  } catch (error) {
    next(error);
  }
};

// ── POST /auth/complete-profile ───────────────────────────────────────────
// Called from SetupProfilePage after a new user fills in username + tagline.
// Protected by setup_token cookie (not the normal JWT).
const completeProfile = async (req, res, next) => {
  try {
    const setupToken = req.cookies?.setup_token;
    if (!setupToken) {
      return res.status(401).json({ success: false, message: 'Setup session expired. Please log in again.' });
    }

    const userId = await verifySetupToken(setupToken);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Setup session expired. Please log in again.' });
    }

    const { username, tagline } = req.body;

    // Validate username
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters.' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, and underscores.' });
    }

    // Check for username conflicts
    const conflict = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username.trim(), userId]
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'This username is already taken. Please choose another.' });
    }

    // Update the user record
    const result = await pool.query(
      `UPDATE users
         SET username = $1, tagline = $2, profile_completed = TRUE
       WHERE id = $3
       RETURNING id, username, email, avatar_url, tagline`,
      [username.trim(), (tagline || '').trim().slice(0, 100), userId]
    );

    const user = result.rows[0];

    // Clear the setup_token cookie
    res.clearCookie('setup_token', { ...COOKIE_BASE, maxAge: 0 });

    // Issue full JWT auth cookies
    await issueAuthCookies(res, user);

    return res.status(200).json({ success: true, redirect: '/profile' });

  } catch (error) {
    next(error);
  }
};

// ── GET /auth/me ───────────────────────────────────────────────────────────
const getAuthUser = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, avatar_url, tagline, profile_completed, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id:               user.id,
        username:         user.username,
        email:            user.email,
        avatarUrl:        user.avatar_url,
        tagline:          user.tagline,
        profileCompleted: user.profile_completed,
        createdAt:        user.created_at,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ── POST /auth/refresh ─────────────────────────────────────────────────────
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token found. Please log in again.',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(403).json({
        success: false,
        message: 'Refresh token is invalid or expired. Please log in again.',
      });
    }

    const stored = await pool.query(
      `SELECT id FROM refresh_tokens
       WHERE user_id = $1 AND token_hash = $2 AND revoked = FALSE AND expires_at > NOW()
       LIMIT 1`,
      [decoded.id, refreshToken]
    );

    if (stored.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Refresh token has been revoked. Please log in again.',
      });
    }

    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'User not found.' });
    }

    const user = userResult.rows[0];
    const newAccessToken = signAccessToken({ id: user.id, username: user.username });
    res.cookie('access_token', newAccessToken, ACCESS_COOKIE_OPTIONS);

    return res.status(200).json({ success: true, message: 'Token refreshed.' });

  } catch (error) {
    next(error);
  }
};

// ── POST /auth/logout ──────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken(refreshToken);
        await pool.query(
          `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE`,
          [decoded.id]
        );
      } catch {
        // Token already invalid — still clear the cookies
      }

      const accessToken = req.cookies?.access_token;
      if (accessToken) {
        await redis.setEx(`blocklist:${accessToken}`, 15 * 60, '1');
      }
    }

    res.clearCookie('access_token',  { ...COOKIE_BASE, maxAge: 0 });
    res.clearCookie('refresh_token', { ...COOKIE_BASE, maxAge: 0 });

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });

  } catch (error) {
    next(error);
  }
};

module.exports = { googleCallback, verifyOtpHandler, resendOtp, completeProfile, getAuthUser, refresh, logout };
