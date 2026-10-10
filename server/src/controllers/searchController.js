// controllers/searchController.js
// Handles room search queries from FindChatRoomPage.jsx.
// Replaces the frontend-only filter with a real database search.

const pool = require('../config/db');

// ── GET /search/rooms ──────────────────────────────────────────────────────
/**
 * Searches public rooms by name (partial, case-insensitive) and/or ID.
 * Uses PostgreSQL ILIKE for case-insensitive partial matching.
 */
const searchRooms = async (req, res, next) => {
  try {
    const { name, id } = req.query;

    // If neither filter is provided, return empty results
    // (full listing is handled by GET /rooms)
    if (!name && !id) {
      return res.status(200).json({
        success: true,
        results: [],
        total:   0,
        message: 'Please provide a name or ID to search.',
      });
    }

    const conditions = [`type = 'public'`];
    const values     = [];
    let   idx        = 1;

    if (name) {
      conditions.push(`name ILIKE $${idx++}`);
      values.push(`%${name}%`);
    }

    if (id) {
      conditions.push(`id ILIKE $${idx++}`);
      values.push(`%${id.toUpperCase()}%`);
    }

    const whereClause = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT
         r.id,
         r.name,
         r.slogan,
         r.description,
         r.image_url,
         r.type,
         r.max_members,
         r.created_by,
         (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count
       FROM rooms r
       WHERE ${whereClause}
       ORDER BY member_count DESC
       LIMIT 50`,
      values
    );

    const results = result.rows.map(r => ({
      id:          r.id,
      name:        r.name,
      slogan:      r.slogan,
      description: r.description,
      imageUrl:    r.image_url,
      type:        r.type,
      members:     parseInt(r.member_count),
      maxMembers:  r.max_members,
      createdBy:   r.created_by,
    }));

    return res.status(200).json({
      success: true,
      results,
      total:   results.length,
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { searchRooms };