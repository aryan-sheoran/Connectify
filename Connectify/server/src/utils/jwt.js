// utils/jwt.js
// Helper functions for signing and verifying JWT access and refresh tokens.
// Access tokens are short-lived (15 min) and carry user identity.
// Refresh tokens are long-lived (7 days) and are used only to issue new access tokens.

const jwt = require('jsonwebtoken');

/**
 * Signs a new short-lived access token.
 * @param {object} payload - { id, username }
 * @returns {string} signed JWT
 */
const signAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
};

/**
 * Signs a new long-lived refresh token.
 * @param {object} payload - { id }
 * @returns {string} signed JWT
 */
const signRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

/**
 * Verifies an access token and returns its decoded payload.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

/**
 * Verifies a refresh token and returns its decoded payload.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
