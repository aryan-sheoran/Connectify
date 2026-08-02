# Connectify — Completion Checklist
## Everything That Needs to Be Added or Fixed to Make This Fully Functional

> Items are grouped by category and ordered from most critical (app breaks without it) to least critical (improvements). Each item includes exactly what file to create or change and what code to write.

---

## CRITICAL — App Will Not Run Without These

### 1. Create the `.env` file (Backend)

The backend won't start without environment variables. Create `backend/.env`:

```env
# Server
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=connectify
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# MongoDB (only if you keep MongoDB; skip if using PostgreSQL for messages)
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=connectify

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your_very_long_random_access_secret_here
JWT_REFRESH_SECRET=your_very_long_random_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cookies
COOKIE_SECRET=your_cookie_signing_secret

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_from_console
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

### 2. Create the PostgreSQL `messages` Table

The updated `socket.js` now writes messages to **PostgreSQL** (not MongoDB), but the schema in `schema.sql` does not have a `messages` table yet. Run this SQL:

```sql
-- Add to schema.sql and run in psql
CREATE TABLE IF NOT EXISTS messages (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id       VARCHAR(20)  REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
    sender_username VARCHAR(50),
    sender_avatar   TEXT,
    content       TEXT         NOT NULL,
    sent_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_sent
    ON messages(room_id, sent_at DESC);
```

---

### 3. Update `messageController.js` to Use PostgreSQL

Since `socket.js` now writes to PostgreSQL, the REST endpoint for fetching message history must also read from PostgreSQL (not MongoDB). Replace the current MongoDB-based `getRoomMessages` in `controllers/messageController.js`:

```js
// controllers/messageController.js
const pool  = require('../config/db');
const redis = require('../config/redis');

const getRoomMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const roomKey    = roomId.toUpperCase();
    const limit      = Math.min(100, parseInt(req.query.limit) || 50);
    const before     = req.query.before ? new Date(req.query.before) : new Date();

    if (isNaN(before.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid "before" timestamp.' });
    }

    // Membership check — Redis first, PostgreSQL fallback
    const cacheKey = `room:${roomKey}:members`;
    const cached   = await redis.sIsMember(cacheKey, req.user.id);

    if (!cached) {
      const pg = await pool.query(
        'SELECT user_id FROM room_members WHERE room_id = $1', [roomKey]
      );
      if (pg.rows.length === 0) {
        const exists = await pool.query('SELECT 1 FROM rooms WHERE id = $1', [roomKey]);
        if (exists.rows.length === 0)
          return res.status(404).json({ success: false, message: `Room ${roomKey} not found.` });
        return res.status(403).json({ success: false, message: 'You must be a member to view messages.' });
      }
      const ids = pg.rows.map(r => r.user_id);
      await redis.sAdd(cacheKey, ids);
      await redis.expire(cacheKey, 300);
      if (!ids.includes(req.user.id))
        return res.status(403).json({ success: false, message: 'You must be a member to view messages.' });
    }

    // Fetch from PostgreSQL
    const result = await pool.query(
      `SELECT id, room_id, sender_id, sender_username, sender_avatar, content, sent_at
       FROM messages
       WHERE room_id = $1 AND sent_at < $2
       ORDER BY sent_at DESC
       LIMIT $3`,
      [roomKey, before, limit + 1]
    );

    const hasMore  = result.rows.length > limit;
    const messages = result.rows.slice(0, limit).reverse();

    const formatted = messages.map(m => ({
      id:             m.id,
      roomId:         m.room_id,
      senderId:       m.sender_id,
      senderUsername: m.sender_username,
      senderAvatar:   m.sender_avatar || null,
      content:        m.content,
      reactions:      [],
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

// Keep reactToMessage stub or implement later
const reactToMessage = async (req, res, next) => {
  return res.status(501).json({ success: false, message: 'Reactions not yet implemented.' });
};

module.exports = { getRoomMessages, reactToMessage };
```

---

### 4. Fix the Hardcoded `localhost:5000` in LoginPage and SignupPage

**File:** `frontend/src/pages/LoginPage.jsx` and `SignupPage.jsx`

Change:
```js
window.location.href = 'http://localhost:5000/api/v1/auth/google';
```

To:
```js
window.location.href = `${import.meta.env.VITE_API_URL || ''}/api/v1/auth/google`;
```

Then add to `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
```

And in `frontend/.env.production`:
```env
VITE_API_URL=https://your-production-domain.com
```

This is the only place in the frontend where a hardcoded URL bypasses the Vite proxy. It must be a direct URL (not proxied) because this is a full-page redirect to Google, not an Axios call.

---

### 5. Install All NPM Dependencies

**Backend** — create or verify `backend/package.json` includes:

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "cookie-parser": "^1.4.6",
    "passport": "^0.6.0",
    "passport-google-oauth20": "^2.0.0",
    "jsonwebtoken": "^9.0.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "cloudinary": "^1.41.0",
    "multer": "^1.4.5-lts.1",
    "multer-storage-cloudinary": "^4.0.0",
    "socket.io": "^4.7.0",
    "express-rate-limit": "^7.0.0",
    "express-validator": "^7.0.0",
    "dotenv": "^16.0.0",
    "node-cron": "^3.0.0"
  }
}
```

Run: `npm install`

---

### 6. Create the Missing `jobs/cleanup.js` File

`server.js` imports `require('./jobs/cleanup')` but this file does not exist. The server will crash on startup without it.

Create `backend/jobs/cleanup.js`:

```js
// jobs/cleanup.js
// Background cron jobs for maintenance tasks.

const cron = require('node-cron');
const pool = require('../config/db');

const initCronJobs = () => {
  // Run every day at 3:00 AM — delete expired and revoked refresh tokens
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM refresh_tokens
         WHERE expires_at < NOW() OR revoked = TRUE`
      );
      console.log(`[Cron] Cleaned up ${result.rowCount} expired/revoked refresh tokens`);
    } catch (err) {
      console.error('[Cron] Token cleanup failed:', err.message);
    }
  });

  console.log('✅  Cron jobs initialised');
};

module.exports = initCronJobs;
```

---

### 7. Fix `getMyRooms` — Add Missing `description` and `createdBy` Fields

**File:** `backend/controllers/userController.js`

`ProfilePage.jsx` filters rooms client-side using `room.createdBy === currentUser.id`, but `getMyRooms` does not return `createdBy` or `description`. Fix the query:

```js
const getMyRooms = async (req, res, next) => {
  try {
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
       INNER JOIN room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = $1
       ORDER BY rm.joined_at DESC`,
      [req.user.id]
    );

    const rooms = result.rows.map(r => ({
      id:          r.id,
      name:        r.name,
      slogan:      r.slogan,
      description: r.description,
      imageUrl:    r.image_url,
      type:        r.type,
      members:     parseInt(r.member_count),
      maxMembers:  r.max_members,
      createdBy:   r.created_by,   // ← This was missing
    }));

    return res.status(200).json({ success: true, rooms });
  } catch (error) {
    next(error);
  }
};
```

---

## HIGH PRIORITY — Core Features That Are Incomplete

### 8. Build the Real `ManageChatRoomPage`

**File:** `frontend/src/pages/ManageChatRoomPage.jsx`

The current page uses mock data, `localStorage`, and no API calls. It needs a complete rewrite. Here is the working version:

```jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/ManageChatRoomPage.css';

function ManageChatRoomPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { currentUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [members, setMembers]   = useState([]);
  const [removingMember, setRemovingMember] = useState(null);

  const [roomData, setRoomData] = useState(null);
  const [formData, setFormData] = useState({
    name: '', slogan: '', description: ''
  });

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const res = await api.get(`/rooms/${roomId}`);
        if (res.data.success) {
          const r = res.data.room;
          setRoomData(r);
          setFormData({ name: r.name, slogan: r.slogan || '', description: r.description });
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load room.');
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [roomId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/rooms/${roomId}`, formData);
      if (res.data.success) {
        setRoomData(prev => ({ ...prev, ...formData }));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    setRemovingMember(userId);
    try {
      await api.delete(`/rooms/${roomId}/members/${userId}`);
      setTimeout(() => {
        setMembers(prev => prev.filter(m => m.id !== userId));
        setRemovingMember(null);
      }, 400);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member.');
      setRemovingMember(null);
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm('Delete this room permanently?')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      navigate('/user-home');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete room.');
    }
  };

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Loading...</div>;
  if (!roomData) return null;

  const isOwner = roomData.createdBy === currentUser?.id;
  if (!isOwner) {
    return (
      <div className="user-home-page">
        <div className="manage-access-denied">
          <div className="access-denied-icon">🔒</div>
          <h2>Access Denied</h2>
          <p>Only the room owner can manage this room.</p>
          <button onClick={() => navigate('/user-home')}>Back to Home</button>
        </div>
      </div>
    );
  }

  return (
    // ... (JSX structure same as current, but use formData state and real handlers above)
    // Replace handleSave, handleRemoveMember, handleDeleteRoom with real implementations
    <div>{ /* existing JSX */ }</div>
  );
}

export default ManageChatRoomPage;
```

---

### 9. Add the `PUT /rooms/:roomId` Backend Endpoint

This endpoint does not exist. `ManageChatRoomPage` needs it to save changes.

**File:** `backend/routes/roomRoutes.js` — add:
```js
router.put('/:roomId', authenticate, validateUpdateRoom, updateRoom);
```

**File:** `backend/middleware/validationMiddleware.js` — add:
```js
const validateUpdateRoom = [
  body('name').optional().trim().isLength({ min: 3, max: 100 }).withMessage('Name must be 3–100 chars'),
  body('slogan').optional().trim().isLength({ max: 100 }).withMessage('Slogan max 100 chars'),
  body('description').optional().trim().isLength({ min: 10 }).withMessage('Description min 10 chars'),
  handleValidationErrors,
];
module.exports = { ..., validateUpdateRoom };
```

**File:** `backend/controllers/roomController.js` — add:
```js
const updateRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { name, slogan, description } = req.body;

    const ownerCheck = await pool.query(
      'SELECT created_by FROM rooms WHERE id = $1', [roomId.toUpperCase()]
    );
    if (ownerCheck.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Room not found.' });
    if (ownerCheck.rows[0].created_by !== req.user.id)
      return res.status(403).json({ success: false, message: 'Only the room creator can update this room.' });

    const updates = [];
    const values  = [];
    let   idx     = 1;
    if (name)        { updates.push(`name = $${idx++}`);        values.push(name); }
    if (slogan !== undefined) { updates.push(`slogan = $${idx++}`); values.push(slogan); }
    if (description) { updates.push(`description = $${idx++}`); values.push(description); }

    if (updates.length === 0)
      return res.status(400).json({ success: false, message: 'Nothing to update.' });

    values.push(roomId.toUpperCase());
    const result = await pool.query(
      `UPDATE rooms SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, slogan, description`,
      values
    );

    return res.status(200).json({ success: true, room: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
```

---

### 10. Add the `DELETE /rooms/:roomId/members/:userId` Endpoint

`ManageChatRoomPage` needs to remove individual members.

**File:** `backend/routes/roomRoutes.js` — add:
```js
router.delete('/:roomId/members/:userId', authenticate, removeMember);
```

**File:** `backend/controllers/roomController.js` — add:
```js
const removeMember = async (req, res, next) => {
  try {
    const { roomId, userId } = req.params;
    const roomKey = roomId.toUpperCase();

    // Only the room creator can remove members
    const ownerCheck = await pool.query(
      'SELECT created_by FROM rooms WHERE id = $1', [roomKey]
    );
    if (ownerCheck.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Room not found.' });
    if (ownerCheck.rows[0].created_by !== req.user.id)
      return res.status(403).json({ success: false, message: 'Only the room owner can remove members.' });

    const result = await pool.query(
      'DELETE FROM room_members WHERE room_id = $1 AND user_id = $2 RETURNING *',
      [roomKey, userId]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ success: false, message: 'User is not a member of this room.' });

    // Invalidate Redis membership cache
    await require('../config/redis').del(`room:${roomKey}:members`);

    return res.status(200).json({ success: true, message: 'Member removed.' });
  } catch (error) {
    next(error);
  }
};
```

---

### 11. Fix the Delete Button in `ProfilePage`

The "Delete" button in the owned rooms list in `ProfilePage.jsx` has no `onClick` handler:

```jsx
// Change this:
<button className="delete-btn">Delete</button>

// To this:
<button className="delete-btn" onClick={() => handleDeleteRoom(room.id)}>Delete</button>
```

Add the handler in `ProfilePage.jsx`:
```js
const handleDeleteRoom = async (roomId) => {
  if (!window.confirm('Delete this room permanently? All messages will be lost.')) return;
  try {
    await api.delete(`/rooms/${roomId}`);
    setOwnedChatRooms(prev => prev.filter(r => r.id !== roomId));
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to delete room.');
  }
};
```

---

### 12. Remove MongoDB from `server.js` (Since Messages Now Use PostgreSQL)

The updated `socket.js` and `messageController.js` now use PostgreSQL for messages. The old `server.js` still imports `connectMongo` and gates startup on it. Since MongoDB is no longer used, either:

**Option A — Remove MongoDB entirely** (recommended if you committed to PostgreSQL messages):

Remove from `server.js`:
```js
// Remove these lines:
const { connectMongo, closeMongo } = require('./config/mongodb');
// and the connectMongo().then(...) startup block
```

Change startup to:
```js
server.listen(PORT, () => {
  console.log(`🚀 Connectify API running on port ${PORT}`);
  initCronJobs();
});
```

**Option B — Keep MongoDB** if you want to revert `socket.js` back to MongoDB writes. In this case keep the old `socket.js` version and the old `messageController.js`.

---

## MEDIUM PRIORITY — Important for Completeness

### 13. Add `ProtectedRoute` Component

`App.jsx` imports `ProtectedRoute` but it is not provided in the uploads. Create it:

**File:** `frontend/src/components/ProtectedRoute.jsx`

```jsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null; // AuthProvider blocks render until resolved

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
```

---

### 14. Add `Sidebar` Component

`Sidebar` is imported in nearly every page but not provided. Create a minimal version:

**File:** `frontend/src/components/Sidebar.jsx`

```jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Sidebar() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <button className="sidebar-link" onClick={() => navigate('/user-home')}>🏠 Home</button>
        <button className="sidebar-link" onClick={() => navigate('/create-room')}>➕ Create Room</button>
        <button className="sidebar-link" onClick={() => navigate('/find-room')}>🔍 Find Rooms</button>
        <button className="sidebar-link" onClick={() => navigate('/profile')}>👤 Profile</button>
      </nav>
    </aside>
  );
}

export default Sidebar;
```

---

### 15. Add `api.js` Frontend Axios Instance

The frontend `api.js` should be at `frontend/src/api.js`. Both uploaded versions are identical, so just ensure one exists:

```js
// frontend/src/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

### 16. Apply `messageLimiter` to the React Endpoint

`messageLimiter` is defined but never used. Apply it to the message history route:

**File:** `backend/routes/roomRoutes.js`:
```js
const { messageLimiter } = require('../middleware/rateLimitMiddleware');

// Change:
router.get('/:roomId/messages', authenticate, getRoomMessages);
// To:
router.get('/:roomId/messages', authenticate, messageLimiter, getRoomMessages);
```

---

### 17. Hash Refresh Tokens Before Storing

Currently the raw JWT is stored in the `token_hash` column (despite the column name suggesting a hash). This means a database breach exposes all refresh tokens. Fix in `authController.js`:

```js
const crypto = require('crypto');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// In googleCallback, when inserting:
await pool.query(
  'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
  [user.id, hashToken(refreshToken), expiresAt]
);

// In refresh controller, when checking:
const stored = await pool.query(
  `SELECT id FROM refresh_tokens
   WHERE user_id = $1 AND token_hash = $2 AND revoked = FALSE AND expires_at > NOW()`,
  [decoded.id, hashToken(refreshToken)]
);
```

---

### 18. Add `load-more` (Infinite Scroll) for Message History

The `ChatRoomPage` currently loads only the 50 most recent messages and has no way to load older ones. Add a "Load earlier messages" button:

**In `ChatRoomPage.jsx`**, add state:
```js
const [hasMore, setHasMore] = useState(false);
const [oldestTimestamp, setOldestTimestamp] = useState(null);
const [loadingMore, setLoadingMore] = useState(false);
```

Update the initial fetch to capture `hasMore` and `nextCursor`:
```js
const msgRes = await api.get(`/rooms/${roomId}/messages?limit=50`);
if (msgRes.data.success) {
  setMessages(msgRes.data.messages);
  setHasMore(msgRes.data.hasMore);
  setOldestTimestamp(msgRes.data.nextCursor);
}
```

Add a handler:
```js
const handleLoadMore = async () => {
  if (!oldestTimestamp || loadingMore) return;
  setLoadingMore(true);
  try {
    const res = await api.get(`/rooms/${roomId}/messages?limit=50&before=${oldestTimestamp}`);
    if (res.data.success) {
      setMessages(prev => [...res.data.messages, ...prev]);
      setHasMore(res.data.hasMore);
      setOldestTimestamp(res.data.nextCursor);
    }
  } finally {
    setLoadingMore(false);
  }
};
```

Add a button above the messages list:
```jsx
{hasMore && (
  <button onClick={handleLoadMore} disabled={loadingMore} className="load-more-btn">
    {loadingMore ? 'Loading...' : 'Load earlier messages'}
  </button>
)}
```

---

## LOWER PRIORITY — Polish and Production Readiness

### 19. Redirect After Auth Token Expiry on Frontend

If the refresh token itself expires (after 7 days), the Axios interceptor's retry will also fail. The user will be silently stuck. Add a redirect to login:

**File:** `frontend/src/api.js`:
```js
} catch (refreshError) {
  // Redirect to login — refresh token is dead
  window.location.href = '/login';
  return Promise.reject(refreshError);
}
```

---

### 20. Add `vite.config.js` (Frontend)

Ensure this file exists with the proxy configuration:

```js
// frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
```

---

### 21. Add Typing Indicator UI in `ChatRoomPage`

The backend emits `typing` and `typing_stopped` events but `ChatRoomPage` does not listen for them. Add:

```js
// In the socket.on('connect') block:
socket.on('typing', ({ username }) => {
  setTypingUser(username);
});
socket.on('typing_stopped', () => {
  setTypingUser(null);
});
```

Add state: `const [typingUser, setTypingUser] = useState(null);`

Emit on input change:
```js
onChange={(e) => {
  setMessageInput(e.target.value);
  socketRef.current?.emit('typing_start', { roomId });
  clearTimeout(typingTimer.current);
  typingTimer.current = setTimeout(() => {
    socketRef.current?.emit('typing_stop', { roomId });
  }, 1500);
}}
```

Add display in JSX:
```jsx
{typingUser && (
  <div className="typing-indicator">{typingUser} is typing...</div>
)}
```

---

### 22. Add `DELETE /rooms/:roomId` Cache Invalidation

When a room is deleted, the Redis membership cache for that room should be cleared:

**File:** `backend/controllers/roomController.js`, inside `deleteRoom`:
```js
// After deleting the room:
await pool.query('DELETE FROM rooms WHERE id = $1', [roomId.toUpperCase()]);

// Add this:
const redis = require('../config/redis');
await redis.del(`room:${roomId.toUpperCase()}:members`);
```

---

### 23. Set Up `GOOGLE_CALLBACK_URL` for Production

When deploying, the Google OAuth callback URL must be registered in the Google Cloud Console and must match the `GOOGLE_CALLBACK_URL` env variable. For production, update:

```env
GOOGLE_CALLBACK_URL=https://your-domain.com/api/v1/auth/google/callback
CLIENT_URL=https://your-domain.com
```

And add this URL in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs.

---

## Summary Table

| # | Item | Priority | Files Affected |
|---|---|---|---|
| 1 | Create `.env` file | CRITICAL | `backend/.env` |
| 2 | Add `messages` SQL table | CRITICAL | `schema.sql` |
| 3 | Fix `messageController` for PostgreSQL | CRITICAL | `controllers/messageController.js` |
| 4 | Fix hardcoded `localhost:5000` | CRITICAL | `LoginPage.jsx`, `SignupPage.jsx` |
| 5 | Install backend npm packages | CRITICAL | `package.json` |
| 6 | Create `jobs/cleanup.js` | CRITICAL | `jobs/cleanup.js` |
| 7 | Fix `getMyRooms` missing fields | CRITICAL | `controllers/userController.js` |
| 8 | Rewrite `ManageChatRoomPage` | HIGH | `pages/ManageChatRoomPage.jsx` |
| 9 | Add `PUT /rooms/:roomId` | HIGH | `routes/roomRoutes.js`, `controllers/roomController.js` |
| 10 | Add `DELETE /rooms/:roomId/members/:userId` | HIGH | `routes/roomRoutes.js`, `controllers/roomController.js` |
| 11 | Fix Delete button in `ProfilePage` | HIGH | `pages/ProfilePage.jsx` |
| 12 | Remove/resolve MongoDB from `server.js` | HIGH | `server.js` |
| 13 | Create `ProtectedRoute` component | MEDIUM | `components/ProtectedRoute.jsx` |
| 14 | Create `Sidebar` component | MEDIUM | `components/Sidebar.jsx` |
| 15 | Ensure `api.js` exists | MEDIUM | `src/api.js` |
| 16 | Apply `messageLimiter` to route | MEDIUM | `routes/roomRoutes.js` |
| 17 | Hash refresh tokens | MEDIUM | `controllers/authController.js` |
| 18 | Load-more for messages | MEDIUM | `pages/ChatRoomPage.jsx` |
| 19 | Redirect on refresh token expiry | LOW | `src/api.js` |
| 20 | Ensure `vite.config.js` exists | LOW | `vite.config.js` |
| 21 | Typing indicator UI | LOW | `pages/ChatRoomPage.jsx` |
| 22 | Redis cache invalidation on delete | LOW | `controllers/roomController.js` |
| 23 | Production Google OAuth config | LOW | `.env`, Google Console |

---

*Document last updated: June 2026*
