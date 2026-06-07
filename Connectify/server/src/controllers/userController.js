// controllers/userController.js
// Handles user profile retrieval, updates, and fetching joined rooms.
// All routes here are protected — req.user is set by authMiddleware.

const pool = require('../config/db');

// ── GET /users/me ──────────────────────────────────────────────────────────
/**
 * Returns the authenticated user's full profile including their joined rooms.
 */
const getMe = async (req, res, next) => {
  try {
    // Fetch the user's basic profile
    const userResult = await pool.query(
      `SELECT id, username, email, avatar_url, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = userResult.rows[0];

    // Fetch the list of room IDs this user has joined
    const roomsResult = await pool.query(
      'SELECT room_id FROM room_members WHERE user_id = $1',
      [req.user.id]
    );
    const joinedRooms = roomsResult.rows.map(r => r.room_id);

    return res.status(200).json({
      success: true,
      user: {
        id:          user.id,
        username:    user.username,
        email:       user.email,
        avatarUrl:   user.avatar_url,
        joinedRooms,
        createdAt:   user.created_at,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ── PUT /users/me ──────────────────────────────────────────────────────────
/**
 * Updates the authenticated user's profile.
 * Accepts an optional new username and/or avatar image.
 * The avatar file, if provided, is already uploaded to Cloudinary by multer
 * middleware before this controller runs — it's available on req.file.
 */
const updateMe = async (req, res, next) => {
  try {
    const { username } = req.body;

    // Build the update dynamically — only change what was sent
    const updates = [];
    const values  = [];
    let   idx     = 1;

    if (username) {
      // Make sure the new username isn't already taken by someone else
      const conflict = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, req.user.id]
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'This username is already taken.',
        });
      }
      updates.push(`username = $${idx++}`);
      values.push(username);
    }

    if (req.file) {
      // req.file.path is the Cloudinary URL set by multer-storage-cloudinary
      updates.push(`avatar_url = $${idx++}`);
      values.push(req.file.path);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided to update.',
      });
    }

    values.push(req.user.id); // for WHERE clause
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, username, avatar_url`,
      values
    );

    const updatedUser = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id:        updatedUser.id,
        username:  updatedUser.username,
        avatarUrl: updatedUser.avatar_url,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ── GET /users/me/rooms ────────────────────────────────────────────────────
/**
 * Returns the full details of all rooms the authenticated user has joined.
 * This powers the "Joined Chat Rooms" section in UserHomePage.jsx.
 */
const getMyRooms = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id,
         r.name,
         r.slogan,
         r.image_url,
         r.type,
         r.max_members,
         (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count
       FROM rooms r
       INNER JOIN room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = $1
       ORDER BY rm.joined_at DESC`,
      [req.user.id]
    );

    const rooms = result.rows.map(r => ({
      id:           r.id,
      name:         r.name,
      slogan:       r.slogan,
      imageUrl:     r.image_url,
      type:         r.type,
      members:      parseInt(r.member_count),
      maxMembers:   r.max_members,
    }));

    return res.status(200).json({
      success: true,
      rooms,
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getMe, updateMe, getMyRooms };
