// config/db.js
// PostgreSQL connection pool using the 'pg' library.
// All queries across the app go through this single pool,
// which manages up to 20 concurrent connections efficiently.

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Keep up to 20 clients in the pool
  max: 20,
  // Close idle clients after 30 seconds
  idleTimeoutMillis: 30000,
  // Fail fast if a client can't connect within 2 seconds
  connectionTimeoutMillis: 2000,
});

// Test the connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  Database connection failed:', err.message);
  } else {
    console.log('✅  PostgreSQL connected successfully');
    release();
  }
});

module.exports = pool;
