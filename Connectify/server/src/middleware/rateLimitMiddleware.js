// middleware/rateLimitMiddleware.js
// Prevents brute-force attacks and API abuse by capping request rates
// per IP address using the express-rate-limit library.
//
// Three limiters are defined:
//   authLimiter   — strict, applied to /auth/login and /auth/signup
//   apiLimiter    — general, applied to all /api/* routes
//   messageLimiter — applied to message-send routes

const rateLimit = require('express-rate-limit');

// ── Auth limiter ───────────────────────────────────────────────────────────
// Only 10 login/signup attempts per IP per 15 minutes.
// This protects against credential stuffing and brute-force attacks.
const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15-minute sliding window
  max:              10,
  standardHeaders:  true,            // Include RateLimit headers in response
  legacyHeaders:    false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please wait 15 minutes and try again.',
  },
  skipSuccessfulRequests: true,      // Only count failed attempts toward the limit
});

// ── General API limiter ────────────────────────────────────────────────────
// 100 requests per IP per 15 minutes for all other routes.
const apiLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down.',
  },
});

// ── Message limiter ────────────────────────────────────────────────────────
// 30 messages per user per minute via REST (WebSocket has its own throttle).
const messageLimiter = rateLimit({
  windowMs:        60 * 1000, // 1-minute window
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'You are sending messages too quickly. Please slow down.',
  },
});

module.exports = { authLimiter, apiLimiter, messageLimiter };
