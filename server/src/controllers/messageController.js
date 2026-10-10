// controllers/messageController.js
// Fetches paginated message history from PostgreSQL (REST endpoint).
// Live message writes happen in socket.js via the send_message event.

const pool       = require('../config/db');
const redis      = require('../config/redis');

// ── GET /rooms/:roomId/messages ────────────────────────────────────────────
/**
 * Returns paginated message history using cursor-based pagination.
 * Client sends ?before=<ISO_TIMESTAMP> to load older messages.
 *
 * Membership check order (cheapest first):
 *   1. Redis cache  → sub-millisecond SET lookup
 *   2. PostgreSQL   → only if cache misses (then re-caches for 5 min)
 */
const getRoomMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const roomKey    = roomId.toUpperCase();
    const limit      = Math.min(100, parseInt(req.query.limit) || 50);
    const before     = req.query.before ? new Date(req.query.before) : new Date();

    if (isNaN(before.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid "before" timestamp. Use an ISO 8601 date string.',
      });
    }

    // ── 1. Membership check via Redis cache ────────────────────────────
    const cacheKey     = `room:${roomKey}:members`;
    const cachedMember = await redis.sIsMember(cacheKey, req.user.id);

    if (!cachedMember) {
      // Cache miss — fall back to PostgreSQL and re-populate the cache
      const pgResult = await pool.query(
        'SELECT user_id FROM room_members WHERE room_id = $1',
        [roomKey]
      );

      if (pgResult.rows.length === 0) {
        // Room has no members at all — check if the room exists
        const roomExists = await pool.query(
          'SELECT 1 FROM rooms WHERE id = $1',
          [roomKey]
        );
        if (roomExists.rows.length === 0) {
          return res.status(404).json({ success: false, message: `Room ${roomKey} not found.` });
        }
        return res.status(403).json({
          success: false,
          message: 'You must be a member of this room to view messages.',
        });
      }

      const memberIds = pgResult.rows.map(r => r.user_id);
      await redis.sAdd(cacheKey, memberIds);
      await redis.expire(cacheKey, 300);

      if (!memberIds.includes(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'You must be a member of this room to view messages.',
        });
      }
    }

    // ── 2. Fetch message history from PostgreSQL ───────────────────────
    const query = `
      SELECT 
          m.*, 
          COALESCE(
              jsonb_agg(
                  jsonb_build_object(
                      'emoji', r.emoji, 
                      'user_ids', r.user_ids
                  )
              ) FILTER (WHERE r.emoji IS NOT NULL), '[]'::jsonb
          ) as reactions
      FROM messages m
      LEFT JOIN (
          SELECT message_id, emoji, array_agg(user_id) as user_ids
          FROM message_reactions
          GROUP BY message_id, emoji
      ) r ON m.id = r.message_id
      WHERE m.room_id = $1 AND m.sent_at < $2
      GROUP BY m.id
      ORDER BY m.sent_at DESC
      LIMIT $3
    `;

    const pgResult = await pool.query(query, [roomKey, before, limit + 1]);
    const docs = pgResult.rows;

    const hasMore  = docs.length > limit;
    const messages = docs.slice(0, limit).reverse();

    const formatted = messages.map(m => ({
      id:             m.id,
      roomId:         m.room_id,
      senderId:       m.sender_id,
      senderUsername: m.sender_username,
      senderAvatar:   m.sender_avatar  || null,
      content:        m.content,
      reactions:      m.reactions      || [],
      sentAt:         m.sent_at,
    }));

    return res.status(200).json({
      success:    true,
      messages:   formatted,
      hasMore,
      nextCursor: hasMore && formatted.length > 0
        ? formatted[0].sentAt.toISOString()
        : null,
    });

  } catch (error) {
    next(error);
  }
};

// ── POST /rooms/:roomId/messages/:messageId/react ──────────────────────────
/**
 * Adds or removes an emoji reaction on a message.
 * Uses PostgreSQL's INSERT ON CONFLICT to toggle reactions.
 */
const reactToMessage = async (req, res, next) => {
  try {
    const { roomId, messageId } = req.params;
    const { emoji }             = req.body;

    if (!emoji || typeof emoji !== 'string' || emoji.length > 8) {
      return res.status(400).json({ success: false, message: 'Invalid emoji.' });
    }

    // Check if reaction exists
    const checkResult = await pool.query(
      'SELECT 1 FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [messageId, req.user.id, emoji]
    );

    if (checkResult.rows.length > 0) {
      // Remove it
      await pool.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [messageId, req.user.id, emoji]
      );
    } else {
      // Add it
      await pool.query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [messageId, req.user.id, emoji]
      );
    }

    // Return the updated reactions array
    const updatedResult = await pool.query(`
      SELECT COALESCE(
          jsonb_agg(
              jsonb_build_object(
                  'emoji', r.emoji, 
                  'user_ids', r.user_ids
              )
          ), '[]'::jsonb
      ) as reactions
      FROM (
          SELECT emoji, array_agg(user_id) as user_ids
          FROM message_reactions
          WHERE message_id = $1
          GROUP BY emoji
      ) r
    `, [messageId]);

    return res.status(200).json({
      success:   true,
      reactions: updatedResult.rows[0].reactions || [],
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getRoomMessages, reactToMessage };
