// socket.js
// Real-time WebSocket server built with Socket.IO.
//
// Database usage per event:
//   join_room    → Redis SET lookup (cache) → PostgreSQL fallback on miss
//   send_message → MongoDB insert → Redis PUBLISH (broadcast)
//   typing_*     → Redis PUBLISH only (no DB write)
//   disconnect   → Redis DEL online presence key

const { Server }            = require('socket.io');
const { ObjectId }          = require('mongodb');
const { verifyAccessToken } = require('./utils/jwt');
const pool                  = require('./config/db');        // PostgreSQL
const redis                 = require('./config/redis');     // Redis
const { getMongo }          = require('./config/mongodb');   // MongoDB

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin:      process.env.CLIENT_URL || 'http://localhost:3000',
      methods:     ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout:  60000,
    pingInterval: 25000,
  });

  // ── Auth middleware ────────────────────────────────────────────────────────
  // Reads access_token from the httpOnly cookie sent in the WS handshake.
  io.use((socket, next) => {
    try {
      const rawCookies = socket.handshake.headers?.cookie || '';
      const cookies    = Object.fromEntries(
        rawCookies.split(';').map(c => {
          const [key, ...val] = c.trim().split('=');
          return [key, decodeURIComponent(val.join('='))];
        })
      );

      const token = cookies['access_token'];
      if (!token) return next(new Error('No access token cookie found.'));

      const decoded   = verifyAccessToken(token);
      socket.userId   = decoded.id;
      socket.username = decoded.username;
      next();
    } catch {
      next(new Error('Invalid or expired access token.'));
    }
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Checks room membership.
   * 1. Redis SET lookup  (sub-ms, primary path)
   * 2. PostgreSQL query  (fallback on cache miss, re-populates cache)
   * Returns true if the user is a member, false otherwise.
   */
  const isMember = async (userId, roomId) => {
    const cacheKey = `room:${roomId}:members`;

    // Fast path — Redis SET
    const hit = await redis.sIsMember(cacheKey, userId);
    if (hit) return true;

    // Slow path — PostgreSQL, then repopulate Redis
    const result = await pool.query(
      'SELECT user_id FROM room_members WHERE room_id = $1',
      [roomId]
    );

    if (result.rows.length === 0) return false;

    const memberIds = result.rows.map(r => r.user_id);

    // Repopulate the Redis SET with a 5-minute TTL
    await redis.sAdd(cacheKey, memberIds);
    await redis.expire(cacheKey, 300);

    return memberIds.includes(userId);
  };

  /**
   * Sets the user's online presence key in Redis with a 35-second TTL.
   * The client must call this (via join_room or a heartbeat) to stay "online".
   * TTL slightly longer than pingInterval (25s) to survive one missed ping.
   */
  const setOnline = (userId, roomId) =>
    redis.setEx(`user:${userId}:online`, 35, roomId);

  // ── Connection ────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.username} (${socket.id})`);

    // ── join_room ──────────────────────────────────────────────────────────
    socket.on('join_room', async ({ roomId }, callback) => {
      try {
        if (!roomId) return callback?.({ success: false, message: 'roomId is required.' });

        const roomKey = roomId.toUpperCase();

        const allowed = await isMember(socket.userId, roomKey);
        if (!allowed) {
          return callback?.({ success: false, message: 'You are not a member of this room.' });
        }

        socket.join(roomKey);
        await setOnline(socket.userId, roomKey);

        socket.to(roomKey).emit('user_joined', {
          userId:   socket.userId,
          username: socket.username,
          roomId:   roomKey,
        });

        console.log(`👥 ${socket.username} joined ${roomKey}`);
        callback?.({ success: true });

      } catch (err) {
        console.error('join_room error:', err.message);
        callback?.({ success: false, message: 'Server error joining room.' });
      }
    });

    // ── leave_room ─────────────────────────────────────────────────────────
    socket.on('leave_room', async ({ roomId }) => {
      if (!roomId) return;
      const roomKey = roomId.toUpperCase();

      socket.leave(roomKey);
      await redis.del(`user:${socket.userId}:online`);

      socket.to(roomKey).emit('user_left', {
        userId:   socket.userId,
        username: socket.username,
        roomId:   roomKey,
      });

      console.log(`🚪 ${socket.username} left ${roomKey}`);
    });

    // ── send_message ───────────────────────────────────────────────────────
    // 1. Verify membership (Redis cache)
    // 2. Persist to MongoDB
    // 3. Broadcast via Socket.IO (Redis pub/sub handles multi-instance delivery)
    socket.on('send_message', async ({ roomId, content }, callback) => {
      try {
        if (!roomId || !content?.trim()) {
          return callback?.({ success: false, message: 'roomId and content are required.' });
        }

        const roomKey          = roomId.toUpperCase();
        const sanitizedContent = content.trim().slice(0, 2000);

        // Membership check — must still be a member when sending
        const allowed = await isMember(socket.userId, roomKey);
        if (!allowed) {
          return callback?.({ success: false, message: 'You are not a member of this room.' });
        }

        // Fetch sender's current avatar from PostgreSQL
        // (Cached in socket object after first lookup to avoid repeated queries)
        if (!socket.avatarUrl) {
          const userRow = await pool.query(
            'SELECT avatar_url FROM users WHERE id = $1',
            [socket.userId]
          );
          socket.avatarUrl = userRow.rows[0]?.avatar_url || null;
        }

        // Write to MongoDB
        const db  = getMongo();
        const now = new Date();

        const doc = {
          room_id:         roomKey,
          sender_id:       socket.userId,
          sender_username: socket.username,
          sender_avatar:   socket.avatarUrl,
          content:         sanitizedContent,
          reactions:       [],          // empty array ready for emoji reactions
          sent_at:         now,
        };

        const result = await db.collection('messages').insertOne(doc);

        // Refresh online presence TTL on every message
        await setOnline(socket.userId, roomKey);

        const payload = {
          id:             result.insertedId.toString(),
          roomId:         roomKey,
          senderId:       socket.userId,
          senderUsername: socket.username,
          senderAvatar:   socket.avatarUrl,
          content:        sanitizedContent,
          reactions:      [],
          sentAt:         now.toISOString(),
        };

        // Broadcast to all sockets in the room (including the sender for confirmation)
        io.to(roomKey).emit('new_message', payload);

        callback?.({ success: true, message: payload });

      } catch (err) {
        console.error('send_message error:', err.message);
        callback?.({ success: false, message: 'Failed to send message.' });
      }
    });

    // ── delete_message ─────────────────────────────────────────────────────
    // Only the sender can delete their own message.
    socket.on('delete_message', async ({ roomId, messageId }, callback) => {
      try {
        if (!roomId || !messageId) {
          return callback?.({ success: false, message: 'roomId and messageId are required.' });
        }

        const roomKey = roomId.toUpperCase();

        let msgId;
        try { msgId = new ObjectId(messageId); }
        catch { return callback?.({ success: false, message: 'Invalid messageId.' }); }

        const db   = getMongo();
        const result = await db.collection('messages').deleteOne({
          _id:       msgId,
          room_id:   roomKey,
          sender_id: socket.userId,   // sender ownership enforced here
        });

        if (result.deletedCount === 0) {
          return callback?.({ success: false, message: 'Message not found or not yours.' });
        }

        // Notify all room members so they can remove it from their UI
        io.to(roomKey).emit('message_deleted', { messageId, roomId: roomKey });

        callback?.({ success: true });

      } catch (err) {
        console.error('delete_message error:', err.message);
        callback?.({ success: false, message: 'Failed to delete message.' });
      }
    });

    // ── typing indicators ──────────────────────────────────────────────────
    // Pure pub/sub — no DB writes. Redis handles cross-instance delivery.
    socket.on('typing_start', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId.toUpperCase()).emit('typing', {
        username: socket.username,
        roomId:   roomId.toUpperCase(),
      });
    });

    socket.on('typing_stop', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId.toUpperCase()).emit('typing_stopped', {
        username: socket.username,
        roomId:   roomId.toUpperCase(),
      });
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.log(`❌ Disconnected: ${socket.username} — ${reason}`);
      // Clear the online presence key immediately on clean disconnect.
      // On network drop, the 35-second TTL handles expiry automatically.
      await redis.del(`user:${socket.userId}:online`).catch(() => {});
    });
  });

  return io;
};

module.exports = initSocket;
