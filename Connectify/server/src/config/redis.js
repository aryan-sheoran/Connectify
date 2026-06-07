// config/redis.js
// Redis client used for two purposes:
//   1. Refresh token blocklist (logout invalidation)
//   2. Socket.IO Pub/Sub adapter (real-time scaling)

const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('connect',   () => console.log('✅  Redis connected successfully'));
redisClient.on('error',  (err) => console.error('❌  Redis error:', err.message));

// Connect immediately when this module is first imported
(async () => {
  await redisClient.connect();
})();

module.exports = redisClient;
