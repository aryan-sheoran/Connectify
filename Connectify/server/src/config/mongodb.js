// config/mongodb.js
// MongoDB connection using the native driver.
// Used exclusively for the messages collection.
// Mongoose is intentionally NOT used — the native driver is lighter
// and messages have a fixed, simple shape that needs no ODM validation.

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME   = process.env.MONGO_DB_NAME || 'connectify';

let db;
let client;

/**
 * Connects to MongoDB once and reuses the connection.
 * Call this from server.js on startup.
 * @returns {Promise<Db>}
 */
const connectMongo = async () => {
  if (db) return db;

  client = new MongoClient(MONGO_URI, {
    maxPoolSize:         20,
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS:     30000,
  });

  await client.connect();
  db = client.db(DB_NAME);

  // ── Create indexes on first connect ────────────────────────────────────
  // compound index: room_id first (equality filter) + sent_at desc (sort)
  // this is the exact shape of every message query we run
  await db.collection('messages').createIndex(
    { room_id: 1, sent_at: -1 },
    { background: true }
  );

  // TTL index: automatically delete messages older than 90 days
  // set expireAfterSeconds: 0 and store a `expires_at` field to control per-doc
  // OR use a fixed TTL — adjust seconds to taste (7776000 = 90 days)
  await db.collection('messages').createIndex(
    { sent_at: 1 },
    { expireAfterSeconds: 7776000, background: true }
  );

  // index for reactions sub-document queries
  await db.collection('messages').createIndex(
    { 'reactions.user_ids': 1 },
    { background: true }
  );

  console.log('✅  MongoDB connected successfully');
  return db;
};

/**
 * Returns the active db instance.
 * Throws if connectMongo() hasn't been called yet.
 */
const getMongo = () => {
  if (!db) throw new Error('MongoDB not connected. Call connectMongo() first.');
  return db;
};

/**
 * Graceful shutdown — call on SIGTERM.
 */
const closeMongo = async () => {
  if (client) await client.close();
};

module.exports = { connectMongo, getMongo, closeMongo };
