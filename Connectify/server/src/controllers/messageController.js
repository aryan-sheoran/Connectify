// controllers/messageController.js
// Fetches paginated message history from MongoDB (REST endpoint).
// Live message writes happen in socket.js via the send_message event.
//
// Why MongoDB for messages?
//   Messages are a pure append-only time series — no JOINs needed,
//   extremely high write volume, and the document shape is fixed.
//   MongoDB's compound index on (room_id, sent_at) makes range-based
//   cursor pagination fast even at millions of documents.

const pool       = require('../config/db');   // PostgreSQL — for membership check only
const redis      = require('../config/redis');
const { getMongo } = require('../config/mongodb');

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
    // Key: room:{roomId}:members  →  Redis SET containing user UUIDs
    // Avoids a PostgreSQL round-trip on every message load
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
        // Room exists but user is not a member
        return res.status(403).json({
          success: false,
          message: 'You must be a member of this room to view messages.',
        });
      }

      // Populate Redis SET with all member IDs, TTL 5 minutes
      const memberIds = pgResult.rows.map(r => r.user_id);
      await redis.sAdd(cacheKey, memberIds);
      await redis.expire(cacheKey, 300);

      // Now check if our user is actually in the set
      if (!memberIds.includes(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'You must be a member of this room to view messages.',
        });
      }
    }

    // ── 2. Fetch message history from MongoDB ──────────────────────────
    const db   = getMongo();
    const coll = db.collection('messages');

    // Fetch limit+1 so we can detect whether a next page exists
    const docs = await coll
      .find({
        room_id: roomKey,
        sent_at: { $lt: before },
      })
      .sort({ sent_at: -1 })   // newest first for slicing
      .limit(limit + 1)
      .toArray();

    const hasMore  = docs.length > limit;
    // Reverse the kept slice back to chronological order for the client
    const messages = docs.slice(0, limit).reverse();

    const formatted = messages.map(m => ({
      id:             m._id.toString(),
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
      // The oldest message's timestamp becomes the next cursor
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
 * Uses MongoDB's $addToSet / $pull on the reactions array.
 * This is a toggle — calling it twice removes the reaction.
 */
const reactToMessage = async (req, res, next) => {
  try {
    const { roomId, messageId } = req.params;
    const { emoji }             = req.body;
    const roomKey               = roomId.toUpperCase();

    if (!emoji || typeof emoji !== 'string' || emoji.length > 8) {
      return res.status(400).json({ success: false, message: 'Invalid emoji.' });
    }

    const db   = getMongo();
    const coll = db.collection('messages');
    const { ObjectId } = require('mongodb');

    let msgId;
    try { msgId = new ObjectId(messageId); }
    catch { return res.status(400).json({ success: false, message: 'Invalid message ID.' }); }

    // Check if user already reacted with this emoji
    const existing = await coll.findOne({
      _id:     msgId,
      room_id: roomKey,
      'reactions': { $elemMatch: { emoji, user_ids: req.user.id } },
    });

    let update;
    if (existing) {
      // Remove the reaction
      update = { $pull: { 'reactions.$.user_ids': req.user.id } };
      // Clean up empty reaction buckets
      await coll.updateOne({ _id: msgId }, update);
      await coll.updateOne(
        { _id: msgId },
        { $pull: { reactions: { user_ids: { $size: 0 } } } }
      );
    } else {
      // Add the reaction — upsert into the reactions array
      const alreadyHasEmoji = await coll.findOne({
        _id:               msgId,
        'reactions.emoji': emoji,
      });

      if (alreadyHasEmoji) {
        update = { $addToSet: { 'reactions.$.user_ids': req.user.id } };
        await coll.updateOne({ _id: msgId, 'reactions.emoji': emoji }, update);
      } else {
        update = { $push: { reactions: { emoji, user_ids: [req.user.id] } } };
        await coll.updateOne({ _id: msgId }, update);
      }
    }

    // Return the updated reactions array
    const updated = await coll.findOne({ _id: msgId }, { projection: { reactions: 1 } });

    return res.status(200).json({
      success:   true,
      reactions: updated?.reactions || [],
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getRoomMessages, reactToMessage };
