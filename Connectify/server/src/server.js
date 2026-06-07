// server.js
// Application entry point.
// Creates the HTTP server, initialises Socket.IO,
// and starts the server after database connections are established.

require('dotenv').config();
const http   = require('http');
const app    = require('./app');

// ── Config & utilities ─────────────────────────────────────────────────────
require('./config/db');                          // PostgreSQL pool
require('./config/redis');                       // Redis client
const { connectMongo, closeMongo } = require('./config/mongodb');

// ── Socket.IO ────────────────────────────────────────────────────────────
const initSocket = require('./socket');

// ─────────────────────────────────────────────────────────────────────────
const server = http.createServer(app);  // Wrap Express in raw HTTP server for Socket.IO

// ── Socket.IO ─────────────────────────────────────────────────────────────
initSocket(server);

// ── Start server ──────────────────────────────────────────────────────────
// MongoDB must be connected before we accept traffic — message writes and
// reads depend on it. PostgreSQL and Redis connect lazily on first query,
// but MongoDB needs the index setup in connectMongo() to run first.
const PORT = process.env.PORT || 5000;

connectMongo().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 Connectify API running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
    console.log(`   REST base   : http://localhost:${PORT}/api/v1`);
    console.log(`   WebSocket   : ws://localhost:${PORT}`);
    console.log(`   Health      : http://localhost:${PORT}/health\n`);
  });
}).catch(err => {
  console.error('❌  Failed to connect to MongoDB, aborting startup:', err.message);
  process.exit(1);
});

// Graceful shutdown — close all DB connections on SIGTERM (Docker / PM2)
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await closeMongo();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
