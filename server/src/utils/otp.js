// utils/otp.js
// Helpers for generating, storing, and verifying OTPs using Redis.
//
// Redis key schema:
//   otp:<pendingToken>  →  JSON { userId, email, otp, isNewUser, attempts }
//   TTL: 10 minutes
//
// pendingToken is a UUID that acts as a short-lived session key
// between the Google OAuth callback and OTP verification.

const redis   = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

const OTP_TTL_SECONDS  = 10 * 60; // 10 minutes
const MAX_ATTEMPTS     = 3;

/**
 * Generates a cryptographically random 6-digit OTP string.
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Stores OTP data in Redis under a new pending token.
 *
 * @param {object} data  - { userId, email, displayName, otp, isNewUser }
 * @returns {string}       pendingToken — the UUID key for this pending session
 */
const storeOtp = async ({ userId, email, displayName, otp, isNewUser }) => {
  const pendingToken = uuidv4();
  const key = `otp:${pendingToken}`;

  await redis.setEx(
    key,
    OTP_TTL_SECONDS,
    JSON.stringify({ userId, email, displayName, otp, isNewUser, attempts: 0 })
  );

  return pendingToken;
};

/**
 * Verifies an OTP against the stored value.
 *
 * @param {string} pendingToken - The UUID from the URL query param
 * @param {string} inputOtp     - The code submitted by the user
 * @returns {{ success: boolean, data?: object, error?: string, attemptsLeft?: number }}
 */
const verifyOtp = async (pendingToken, inputOtp) => {
  const key = `otp:${pendingToken}`;
  const raw = await redis.get(key);

  if (!raw) {
    return { success: false, error: 'OTP expired or invalid. Please log in again.' };
  }

  const stored = JSON.parse(raw);
  stored.attempts += 1;

  if (stored.attempts > MAX_ATTEMPTS) {
    await redis.del(key);
    return { success: false, error: 'Too many incorrect attempts. Please log in again.' };
  }

  if (stored.otp !== inputOtp.trim()) {
    // Save the incremented attempt count back
    const ttl = await redis.ttl(key);
    await redis.setEx(key, ttl > 0 ? ttl : OTP_TTL_SECONDS, JSON.stringify(stored));
    return {
      success:      false,
      error:        'Incorrect code. Please try again.',
      attemptsLeft: MAX_ATTEMPTS - stored.attempts,
    };
  }

  // ✅ OTP matched — delete it so it can't be reused
  await redis.del(key);
  return { success: true, data: stored };
};

/**
 * Issues a short-lived "setup token" in Redis for new users who have
 * verified their OTP but haven't completed their profile yet.
 *
 * @param {string} userId
 * @returns {string} setupToken — UUID stored in Redis for 15 minutes
 */
const storeSetupToken = async (userId) => {
  const setupToken = uuidv4();
  await redis.setEx(`setup:${setupToken}`, 15 * 60, String(userId));
  return setupToken;
};

/**
 * Verifies a setup token and returns the userId it belongs to.
 * Deletes the token after retrieval (single-use).
 *
 * @param {string} setupToken
 * @returns {string|null} userId or null if invalid/expired
 */
const verifySetupToken = async (setupToken) => {
  const key = `setup:${setupToken}`;
  const userId = await redis.get(key);
  if (!userId) return null;
  await redis.del(key);
  return userId;
};

module.exports = { generateOtp, storeOtp, verifyOtp, storeSetupToken, verifySetupToken };
