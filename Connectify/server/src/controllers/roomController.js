// controllers/roomController.js
// Handles all chat room operations: listing, creating, fetching,
// joining, leaving, and deleting rooms.

const pool           = require('../config/db');
const generateRoomId = require('../utils/generateRoomId');

// ── GET /rooms ─────────────────────────────────────────────────────────────
/**
 * Returns a paginated list of all PUBLIC rooms.
 * Supports optional ?name and ?id query filters.
 * Powers the worldwide rooms section in UserHomePage.jsx.
 */
const getAllRooms = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    // Build query with optional filters
    const conditions = [`r.type = 'public'`];
    const values     = [];
    let   idx        = 1;

    if (req.query.name) {
      conditions.push(`r.name ILIKE $${idx++}`);  // case-insensitive partial match
      values.push(`%${req.query.name}%`);
    }

    if (req.query.id) {
      conditions.push(`r.id ILIKE $${idx++}`);
      values.push(`%${req.query.id}%`);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count for pagination metadata
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM rooms r WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get the actual page of rooms with live member count
    values.push(limit, offset);
    const roomsResult = await pool.query(
      `SELECT
         r.id,
         r.name,
         r.slogan,
         r.description,
         r.image_url,
         r.type,
         r.max_members,
         r.created_at,
         (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count
       FROM rooms r
       WHERE ${whereClause}
       ORDER BY member_count DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );

    const rooms = roomsResult.rows.map(r => ({
      id:          r.id,
      name:        r.name,
      slogan:      r.slogan,
      description: r.description,
      imageUrl:    r.image_url,
      type:        r.type,
      members:     parseInt(r.member_count),
      maxMembers:  r.max_members,
      createdAt:   r.created_at,
    }));

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      rooms,
    });

  } catch (error) {
    next(error);
  }
};

// ── POST /rooms ────────────────────────────────────────────────────────────
/**
 * Creates a new chat room.
 * The room image is uploaded to Cloudinary before this controller runs
 * (via multer middleware) and is available at req.file.path.
 */
const createRoom = async (req, res, next) => {
  try {
    const { roomName, description, slogan, isPrivate, maxMembers } = req.body;

    // Image is required
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Room image is required.',
      });
    }

    const imageUrl   = req.file.path;            // Cloudinary URL
    const roomId     = await generateRoomId();
    const roomType   = isPrivate === 'true' || isPrivate === true ? 'private' : 'public';
    const maxMem     = roomType === 'private' && maxMembers ? parseInt(maxMembers) : null;

    const result = await pool.query(
      `INSERT INTO rooms (id, name, slogan, description, image_url, type, max_members, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, slogan, description, image_url, type, max_members, created_at`,
      [roomId, roomName, slogan || null, description, imageUrl, roomType, maxMem, req.user.id]
    );

    const room = result.rows[0];

    // Auto-join the creator to their own room
    await pool.query(
      'INSERT INTO room_members (user_id, room_id) VALUES ($1, $2)',
      [req.user.id, roomId]
    );

    return res.status(201).json({
      success:  true,
      message:  'Chat room created successfully',
      room: {
        id:          room.id,
        name:        room.name,
        slogan:      room.slogan,
        description: room.description,
        imageUrl:    room.image_url,
        type:        room.type,
        maxMembers:  room.max_members,
        createdBy:   req.user.id,
        createdAt:   room.created_at,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ── GET /rooms/:roomId ─────────────────────────────────────────────────────
/**
 * Returns the full details of a single room.
 */
const getRoomById = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    const result = await pool.query(
      `SELECT
         r.*,
         u.username AS creator_username,
         (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count
       FROM rooms r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = $1`,
      [roomId.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Room ${roomId} not found.`,
      });
    }

    const r = result.rows[0];

    return res.status(200).json({
      success: true,
      room: {
        id:              r.id,
        name:            r.name,
        slogan:          r.slogan,
        description:     r.description,
        imageUrl:        r.image_url,
        type:            r.type,
        members:         parseInt(r.member_count),
        maxMembers:      r.max_members,
        createdBy:       r.created_by,
        creatorUsername: r.creator_username,
        createdAt:       r.created_at,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ── POST /rooms/:roomId/join ───────────────────────────────────────────────
/**
 * Adds the authenticated user to a room.
 * Checks: room exists, not already a member, room not full, room is public.
 */
const joinRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId     = req.user.id;

    // 1. Does the room exist?
    const roomResult = await pool.query(
      'SELECT id, type, max_members FROM rooms WHERE id = $1',
      [roomId.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Room ${roomId} not found.`,
      });
    }

    const room = roomResult.rows[0];

    // 2. Is the room private?
    if (room.type === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This room is private. You need an invitation to join.',
      });
    }

    // 3. Is the user already a member?
    const memberCheck = await pool.query(
      'SELECT 1 FROM room_members WHERE user_id = $1 AND room_id = $2',
      [userId, room.id]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'You are already a member of this room.',
      });
    }

    // 4. Is the room full? (only if maxMembers is set)
    if (room.max_members) {
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM room_members WHERE room_id = $1',
        [room.id]
      );
      const currentMembers = parseInt(countResult.rows[0].count);

      if (currentMembers >= room.max_members) {
        return res.status(410).json({
          success: false,
          message: 'This room is full.',
        });
      }
    }

    // 5. All checks passed — join the room
    await pool.query(
      'INSERT INTO room_members (user_id, room_id) VALUES ($1, $2)',
      [userId, room.id]
    );

    return res.status(200).json({
      success: true,
      message: `Successfully joined room ${room.id}`,
    });

  } catch (error) {
    next(error);
  }
};

// ── DELETE /rooms/:roomId/leave ────────────────────────────────────────────
/**
 * Removes the authenticated user from a room.
 */
const leaveRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const userId     = req.user.id;

    const result = await pool.query(
      'DELETE FROM room_members WHERE user_id = $1 AND room_id = $2 RETURNING *',
      [userId, roomId.toUpperCase()]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'You are not a member of this room.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Left room ${roomId} successfully`,
    });

  } catch (error) {
    next(error);
  }
};

// ── DELETE /rooms/:roomId ──────────────────────────────────────────────────
/**
 * Deletes a room. Only the room creator is permitted to do this.
 * Cascade rules in the DB schema will also delete all messages and memberships.
 */
const deleteRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;

    // Verify ownership
    const ownerCheck = await pool.query(
      'SELECT created_by FROM rooms WHERE id = $1',
      [roomId.toUpperCase()]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Room ${roomId} not found.`,
      });
    }

    if (ownerCheck.rows[0].created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the room creator can delete this room.',
      });
    }

    await pool.query('DELETE FROM rooms WHERE id = $1', [roomId.toUpperCase()]);

    return res.status(200).json({
      success: true,
      message: `Room ${roomId} has been deleted.`,
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllRooms,
  createRoom,
  getRoomById,
  joinRoom,
  leaveRoom,
  deleteRoom,
};
