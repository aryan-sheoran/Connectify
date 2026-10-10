// middleware/authMiddleware.js
// Protects routes by verifying the JWT access token stored in the
// httpOnly 'access_token' cookie (set by the OAuth callback).
//
// On success:  attaches req.user = { id, username } and calls next()
// On failure:  responds 401 so the frontend knows to trigger a token refresh

const { verifyAccessToken } = require('../utils/jwt');
const redis = require('../config/redis');

/**
 * authenticate
 * Drop-in middleware for all protected routes.
 * Reads the JWT from the httpOnly cookie — never from a header or body.
 *
 * Usage:
 *   router.get('/protected', authenticate, (req, res) => { ... });
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please log in.',
        code:    'NO_TOKEN',
      });
    }

    // Check the Redis blocklist first (covers logged-out tokens that haven't
    // expired yet — access tokens live 15 min so this window is short)
    const isBlocklisted = await redis.get(`blocklist:${token}`);
    if (isBlocklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please log in again.',
        code:    'TOKEN_REVOKED',
      });
    }

    // Verify signature and expiry
    const decoded = verifyAccessToken(token);

    // Attach identity for downstream controllers
    req.user = {
      id:       decoded.id,
      username: decoded.username,
    };

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access token expired. Please refresh.',
        code:    'TOKEN_EXPIRED',   // Frontend catches this code to call /auth/refresh
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        code:    'TOKEN_INVALID',
      });
    }

    return res.status(500).json({ success: false, message: 'Authentication error.' });
  }
};

module.exports = { authenticate };
