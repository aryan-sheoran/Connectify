// controllers/authController.js
// Handles the OAuth callback, token refresh, and logout.
//
// There is NO signup or login form anymore — identity comes from Google.
//
// Cookie strategy:
//   access_token  — httpOnly, Secure, SameSite=Lax, maxAge 15 min
//   refresh_token — httpOnly, Secure, SameSite=Lax, maxAge 7 days
//
// Why httpOnly cookies instead of localStorage?
//   JavaScript cannot read httpOnly cookies, so XSS attacks cannot
//   steal them. The browser attaches them automatically on every request
//   to our domain, so the frontend never has to manage tokens manually.

const pool  = require('../config/db');
const redis = require('../config/redis');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');

// Shared cookie options — applied to both token cookies
const COOKIE_BASE = {
  httpOnly: true,    // JS cannot read this cookie
  secure:   process.env.NODE_ENV === 'production', // HTTPS only in prod
  sameSite: 'lax',   // Sent on same-site requests + top-level navigation
};

const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: 15 * 60 * 1000,           // 15 minutes in ms
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_BASE,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

// ── GET /auth/google/callback ──────────────────────────────────────────────
// Passport's GoogleStrategy has already verified the OAuth code and
// upserted the user by the time this controller runs.
// req.user is set by Passport's verify callback in config/passport.js.
//
// We issue JWT cookies here and redirect the user to the frontend.
const googleCallback = async (req, res, next) => {
  try {
    const user = req.user; // set by Passport

    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }

    // Issue tokens
    const accessToken  = signAccessToken ({ id: user.id, username: user.username });
    const refreshToken = signRefreshToken({ id: user.id });

    // Persist the refresh token in the DB so we can revoke it on logout
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt] // storing raw token; hash if you want extra security
    );

    // Set both tokens as httpOnly cookies
    res.cookie('access_token',  accessToken,  ACCESS_COOKIE_OPTIONS);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS);

    // Redirect to the frontend home page — the cookies travel with this redirect
    return res.redirect(`${process.env.CLIENT_URL}/user-home`);

  } catch (error) {
    next(error);
  }
};

// ── GET /auth/me ───────────────────────────────────────────────────────────
// Returns the currently authenticated user's identity.
// The frontend calls this once on load to check if the user is logged in.
// authenticate middleware has already verified the access_token cookie.
const getAuthUser = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id:        user.id,
        username:  user.username,
        email:     user.email,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ── POST /auth/refresh ─────────────────────────────────────────────────────
// Issues a new access_token cookie when the old one expires.
// Reads the refresh_token from the httpOnly cookie (not the request body).
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token found. Please log in again.',
      });
    }

    // 1. Verify the token signature and expiry
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(403).json({
        success: false,
        message: 'Refresh token is invalid or expired. Please log in again.',
      });
    }

    // 2. Check it hasn't been revoked in the DB
    const stored = await pool.query(
      `SELECT id FROM refresh_tokens
       WHERE user_id = $1
         AND token_hash = $2
         AND revoked = FALSE
         AND expires_at > NOW()
       LIMIT 1`,
      [decoded.id, refreshToken]
    );

    if (stored.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Refresh token has been revoked. Please log in again.',
      });
    }

    // 3. Fetch fresh user data
    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'User not found.' });
    }

    const user = userResult.rows[0];

    // 4. Issue a new access token cookie (refresh token stays the same)
    const newAccessToken = signAccessToken({ id: user.id, username: user.username });
    res.cookie('access_token', newAccessToken, ACCESS_COOKIE_OPTIONS);

    return res.status(200).json({ success: true, message: 'Token refreshed.' });

  } catch (error) {
    next(error);
  }
};

// ── POST /auth/logout ──────────────────────────────────────────────────────
// Clears the JWT cookies and revokes the refresh token in the DB.
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      // Decode without throwing — token may already be expired
      try {
        const decoded = verifyRefreshToken(refreshToken);

        // Revoke all active refresh tokens for this user
        await pool.query(
          `UPDATE refresh_tokens SET revoked = TRUE
           WHERE user_id = $1 AND revoked = FALSE`,
          [decoded.id]
        );
      } catch {
        // Token already invalid — still clear the cookies below
      }

      // Blocklist the access token in Redis until it naturally expires
      const accessToken = req.cookies?.access_token;
      if (accessToken) {
        await redis.setEx(`blocklist:${accessToken}`, 15 * 60, '1');
      }
    }

    // Clear both cookies from the browser
    res.clearCookie('access_token',  { ...COOKIE_BASE, maxAge: 0 });
    res.clearCookie('refresh_token', { ...COOKIE_BASE, maxAge: 0 });

    return res.status(200).json({ success: true, message: 'Logged out successfully.' });

  } catch (error) {
    next(error);
  }
};

module.exports = { googleCallback, getAuthUser, refresh, logout };
