// utils/generateRoomId.js
// Generates unique sequential-style room IDs like ROOM001, ROOM002, etc.
// In production you may want to use UUIDs or a DB sequence instead.

const pool = require('../config/db');

/**
 * Generates the next available room ID by checking the highest existing one.
 * Example output: "ROOM042"
 * @returns {Promise<string>}
 */
const generateRoomId = async () => {
  const result = await pool.query(
    `SELECT id FROM rooms WHERE id LIKE 'ROOM%' ORDER BY id DESC LIMIT 1`
  );

  if (result.rows.length === 0) {
    return 'ROOM001';
  }

  const lastId  = result.rows[0].id;              // e.g. "ROOM042"
  const lastNum = parseInt(lastId.replace('ROOM', ''), 10);
  const nextNum = lastNum + 1;

  // Zero-pad to at least 3 digits: 1 → "001", 100 → "100"
  return `ROOM${String(nextNum).padStart(3, '0')}`;
};

module.exports = generateRoomId;
