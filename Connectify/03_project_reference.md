# Connectify — Complete Project Reference
## Everything About This Project in One Document

> This document is the single source of truth for the Connectify codebase. It covers every file, every decision, every API, and every known issue. Use this as context when asking for new features or fixes.

---

## Table of Contents

1. [What Connectify Is](#1-what-connectify-is)
2. [Tech Stack](#2-tech-stack)
3. [Project File Structure](#3-project-file-structure)
4. [Database Architecture](#4-database-architecture)
5. [Backend — File by File](#5-backend--file-by-file)
6. [Frontend — File by File](#6-frontend--file-by-file)
7. [Authentication Flow](#7-authentication-flow)
8. [Real-Time System](#8-real-time-system)
9. [All API Endpoints](#9-all-api-endpoints)
10. [All Socket.IO Events](#10-all-socketio-events)
11. [Environment Variables](#11-environment-variables)
12. [Known Issues and Pending Work](#12-known-issues-and-pending-work)
13. [Data Shapes — What the Frontend Expects](#13-data-shapes--what-the-frontend-expects)

---

## 1. What Connectify Is

Connectify is a real-time anonymous group chat web application. Users sign in with Google (no passwords), join or create chat rooms, and send messages that appear instantly for everyone in the room. It is similar in concept to Discord channels or IRC rooms.

**Core user flows:**
- Sign in with Google → redirected to home page
- Browse public rooms on the home page or on Find Rooms
- Click a room → auto-joined → see message history → start chatting
- Create a new room with a name, description, slogan, and image
- Leave or delete rooms
- Edit your username on your profile page

---

## 2. Tech Stack

### Backend
| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js | CommonJS modules (`require`) throughout |
| Framework | Express.js | REST API |
| Auth | Passport.js + Google OAuth 2.0 | No username/password login |
| Tokens | JWT (jsonwebtoken) | httpOnly cookies, never localStorage |
| Real-time | Socket.IO v4 | WebSocket server on same HTTP server |
| Primary DB | PostgreSQL (pg library) | Users, rooms, memberships, messages, tokens |
| Cache/Pub-Sub | Redis (redis v4 library) | Membership cache, presence, token blocklist |
| File storage | Cloudinary | Room images and user avatars via multer |
| Validation | express-validator | Room creation, search, profile update |
| Rate limiting | express-rate-limit | Auth, API, and message routes |
| Scheduled jobs | node-cron | Token cleanup (3am daily) |

### Frontend
| Layer | Choice | Notes |
|---|---|---|
| Framework | React 19 | Functional components + hooks throughout |
| Build tool | Vite 8 | Dev proxy for API and Socket.IO |
| Routing | React Router v7 | `BrowserRouter` with `ProtectedRoute` wrapper |
| HTTP client | Axios | `withCredentials: true`, token refresh interceptor |
| WebSocket | socket.io-client v4 | Connected inside `ChatRoomPage` |
| State | React Context (AuthContext) | Global auth state only; all other state is local |
| Styling | Plain CSS per page | No CSS framework |

---

## 3. Project File Structure

```
connectify/
├── backend/
│   ├── server.js                  Entry point — HTTP server + Socket.IO init
│   ├── app.js                     Express app — middleware + routes
│   ├── socket.js                  Socket.IO event handlers
│   ├── config/
│   │   ├── db.js                  PostgreSQL pool (pg library)
│   │   ├── redis.js               Redis client (redis v4)
│   │   ├── mongodb.js             MongoDB client (NOT used in updated code)
│   │   ├── cloudinary.js          Multer + Cloudinary upload configs
│   │   └── passport.js            Google OAuth strategy + user upsert
│   ├── controllers/
│   │   ├── authController.js      googleCallback, getAuthUser, refresh, logout
│   │   ├── roomController.js      getAllRooms, createRoom, getRoomById, joinRoom, leaveRoom, deleteRoom
│   │   ├── messageController.js   getRoomMessages (PostgreSQL), reactToMessage (stub)
│   │   ├── userController.js      getMe, updateMe, getMyRooms
│   │   ├── searchController.js    searchRooms
│   │   └── uploadController.js    uploadRoomImage (standalone endpoint)
│   ├── routes/
│   │   ├── authRoutes.js          /auth/*
│   │   ├── roomRoutes.js          /rooms/*
│   │   ├── userRoutes.js          /users/*
│   │   ├── searchRoutes.js        /search/*
│   │   └── uploadRoutes.js        /upload/*
│   ├── middleware/
│   │   ├── authMiddleware.js      authenticate (JWT + Redis blocklist check)
│   │   ├── errorMiddleware.js     multerErrorHandler, notFoundHandler, errorHandler
│   │   ├── rateLimitMiddleware.js authLimiter, apiLimiter, messageLimiter
│   │   └── validationMiddleware.js validateCreateRoom, validateRoomSearch, validateUpdateProfile
│   ├── utils/
│   │   ├── jwt.js                 signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken
│   │   └── generateRoomId.js      Generates ROOM001, ROOM002, etc. from DB
│   ├── jobs/
│   │   └── cleanup.js             Daily cron: delete expired/revoked refresh tokens
│   └── models/
│       └── schema.sql             PostgreSQL DDL — run once to set up tables
│
└── frontend/
    ├── index.html
    ├── vite.config.js             Dev proxy: /api → :5000, /socket.io → :5000 (ws)
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx                Routes + AuthProvider wrapper
        ├── api.js                 Axios instance + TOKEN_EXPIRED interceptor
        ├── context/
        │   └── AuthContext.jsx    currentUser, isAuthenticated, loading, checkAuth, logout
        ├── components/
        │   ├── ProtectedRoute.jsx Redirects unauthenticated users to /login
        │   └── Sidebar.jsx        Navigation links (Home, Create Room, Find Rooms, Profile)
        └── pages/
            ├── IntroPage.jsx       Public landing page
            ├── LoginPage.jsx       Google login button → redirects to backend OAuth
            ├── SignupPage.jsx      Same as LoginPage (same Google OAuth flow)
            ├── UserHomePage.jsx    Shows joined rooms + all public rooms
            ├── ChatRoomPage.jsx    Full chat interface with Socket.IO
            ├── CreateChatRoomPage.jsx  Room creation form with image upload
            ├── FindChatRoomPage.jsx    Search + browse public rooms
            ├── ProfilePage.jsx     Username edit + owned rooms list
            └── ManageChatRoomPage.jsx  Room settings (CURRENTLY USES MOCK DATA — incomplete)
```

---

## 4. Database Architecture

### PostgreSQL Tables

**`users`**
```
id           UUID PK (gen_random_uuid)
google_id    VARCHAR(255) UNIQUE   ← Google's stable user identifier
username     VARCHAR(50) UNIQUE    ← Derived from Google display name + 4-char random suffix
email        VARCHAR(255) UNIQUE
avatar_url   TEXT                  ← Google photo initially, can be changed
created_at   TIMESTAMPTZ
```

**`rooms`**
```
id           VARCHAR(20) PK        ← Format: ROOM001, ROOM002, etc.
name         VARCHAR(100)
slogan       VARCHAR(100)
description  TEXT
image_url    TEXT                  ← Cloudinary CDN URL
type         VARCHAR(10)           ← 'public' or 'private'
max_members  INT                   ← NULL for unlimited (only set for private rooms)
created_by   UUID FK → users(id) ON DELETE SET NULL
created_at   TIMESTAMPTZ
```

**`room_members`**
```
user_id      UUID FK → users(id) ON DELETE CASCADE
room_id      VARCHAR(20) FK → rooms(id) ON DELETE CASCADE
joined_at    TIMESTAMPTZ
PRIMARY KEY  (user_id, room_id)    ← Prevents duplicate memberships
```

**`refresh_tokens`**
```
id           UUID PK
user_id      UUID FK → users(id) ON DELETE CASCADE
token_hash   TEXT                  ← Raw JWT currently (should be SHA-256 hash)
expires_at   TIMESTAMPTZ
revoked      BOOLEAN DEFAULT FALSE
created_at   TIMESTAMPTZ
```

**`messages`** *(must be added manually — see completion checklist)*
```
id               UUID PK (gen_random_uuid)
room_id          VARCHAR(20) FK → rooms(id) ON DELETE CASCADE
sender_id        UUID FK → users(id) ON DELETE SET NULL
sender_username  VARCHAR(50)
sender_avatar    TEXT
content          TEXT NOT NULL
sent_at          TIMESTAMPTZ DEFAULT NOW()
INDEX: (room_id, sent_at DESC)
```

### Redis Keys

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `room:{roomId}:members` | SET | 5 min | Membership cache (user UUIDs) |
| `user:{userId}:online` | String | 35 sec | Online presence (value = current roomId) |
| `blocklist:{accessToken}` | String | 15 min | Logged-out token blocklist |

---

## 5. Backend — File by File

### `server.js`
Entry point. Creates `http.createServer(app)` (raw HTTP server required for Socket.IO). Calls `initSocket(server)`. Starts listening on `PORT` (default 5000). Calls `initCronJobs()` after server starts. Has SIGTERM handler for graceful shutdown.

**Important:** MongoDB import was in the old version but has been removed in the updated version. The updated `server.js` does NOT gate startup on MongoDB.

### `app.js`
Express setup. Middleware order (matters):
1. CORS (origin from `CLIENT_URL` env, `credentials: true`)
2. cookieParser (signed with `COOKIE_SECRET`)
3. passport.initialize() (no sessions)
4. express.json() (10kb limit)
5. express.urlencoded() (10kb limit)
6. apiLimiter on `/api/*`
7. Routes
8. multerErrorHandler → notFoundHandler → errorHandler

CORS origin in the updated `app.js` is `http://localhost:5173` (Vite default port) — the old version used `http://localhost:3000`.

### `socket.js` (Updated Version)
Key changes from the old version:
- **Removed MongoDB** — `send_message` now writes to PostgreSQL `messages` table
- **Removed `getMongo()`** — no longer imported
- `delete_message` now deletes from PostgreSQL instead of MongoDB
- Everything else is the same

Auth middleware reads cookie from WS handshake headers, parses manually, verifies JWT, attaches `socket.userId` and `socket.username`.

Two-tier `isMember()` helper: Redis SET → PostgreSQL fallback with 5-min TTL repopulation.

`setOnline()` sets `user:{userId}:online` with 35-second TTL.

### `config/passport.js`
Google OAuth 2.0 strategy. On every login:
- Extracts `google_id`, `email`, `avatarUrl`, `displayName` from Google profile
- Calls `deriveUsername(displayName)` → lowercased + alphanumeric only + `_` + 4 random chars
- `INSERT INTO users ... ON CONFLICT (google_id) DO UPDATE SET email, avatar_url`
- Returns user object to `done()` → available as `req.user` in `googleCallback`

`passport.serializeUser` / `deserializeUser` are stubs (required by Passport even with `session: false`).

### `config/db.js`
pg Pool, max 20 connections, 30s idle timeout, 2s connection timeout. Tests connection on startup.

### `config/redis.js`
Single redis v4 client. Connects immediately on import. Shared across app.

### `config/cloudinary.js`
Two multer instances: `uploadRoomImage` (800x600 max, folder `connectify/rooms`) and `uploadAvatar` (200x200 fill crop, folder `connectify/avatars`). Both reject non-image MIME types. 5MB size limit. File URL available at `req.file.path` after middleware runs.

### `utils/generateRoomId.js`
Queries `MAX(id)` from rooms where id starts with `ROOM`, extracts the number, increments, zero-pads to 3 digits. Not race-condition safe for high concurrency (consider DB sequences for production scale).

### `utils/jwt.js`
Four functions: `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, `verifyRefreshToken`. Uses `process.env.JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Throws `TokenExpiredError` or `JsonWebTokenError` on failure — these are caught in `authMiddleware`.

### `controllers/authController.js`
- `googleCallback`: Issues access + refresh JWT cookies, inserts refresh token to DB, redirects to `CLIENT_URL/user-home`
- `getAuthUser`: Returns user profile from PostgreSQL (runs after `authenticate` middleware)
- `refresh`: Reads refresh_token cookie → verifies → checks DB not revoked → issues new access_token cookie
- `logout`: Revokes all refresh tokens for user in DB → blocklists access token in Redis → clears both cookies

### `controllers/roomController.js`
- `getAllRooms`: Public rooms only, paginated, optional name/id filters, ordered by member count
- `createRoom`: Requires image (`req.file` from multer), generates room ID, auto-joins creator
- `getRoomById`: Joins with users for creator username, counts members
- `joinRoom`: 5 checks: exists, not private, not already member, not full → INSERT
- `leaveRoom`: DELETE from room_members
- `deleteRoom`: Owner-only check → DELETE (cascades to memberships in DB)
- `updateRoom`: *(needs to be added)* Owner-only → UPDATE rooms
- `removeMember`: *(needs to be added)* Owner-only → DELETE from room_members + Redis cache invalidation

### `controllers/userController.js`
- `getMe`: Full profile + list of joined room IDs
- `updateMe`: Dynamic UPDATE for username and/or avatar_url (avatar from `req.file.path` via multer)
- `getMyRooms`: All rooms the user has joined, ordered by `joined_at DESC`. **Bug:** currently missing `description` and `createdBy` fields — causes ProfilePage owned room filter to always return empty

### `controllers/messageController.js`
- `getRoomMessages`: Two-tier membership check → SELECT from messages WHERE room_id AND sent_at < before, DESC, limit+1 trick for hasMore, reversed to chronological for response
- `reactToMessage`: **Stub** — returns 501 Not Implemented

### `middleware/authMiddleware.js`
Reads `access_token` cookie → Redis blocklist check → `verifyAccessToken()` → attaches `req.user = { id, username }`. Returns specific error codes: `NO_TOKEN`, `TOKEN_REVOKED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`.

### `middleware/rateLimitMiddleware.js`
Three limiters defined. Only `authLimiter` (on `/auth/refresh`) and `apiLimiter` (on all `/api/*`) are currently applied. `messageLimiter` is defined but not applied to any route yet.

---

## 6. Frontend — File by File

### `App.jsx`
Wraps everything in `<AuthProvider>` and `<BrowserRouter>`. Public routes: `/`, `/login`, `/signup`. All other routes are wrapped in `<ProtectedRoute>` which redirects to `/login` if not authenticated.

### `AuthContext.jsx`
Calls `GET /auth/me` on mount to check auth state. Provides `currentUser`, `isAuthenticated`, `loading`, `checkAuth`, `logout`. Renders `{!loading && children}` — blocks the entire app from rendering until auth check resolves (prevents flash of unauthenticated content).

`logout()` calls `POST /auth/logout` then clears local state. Does not navigate — the calling component navigates after.

### `api.js`
Axios instance with `baseURL: '/api/v1'` and `withCredentials: true`. Response interceptor catches 401 + `TOKEN_EXPIRED` → silently calls `/auth/refresh` → retries original request. Uses `_retry` flag to prevent infinite loops.

### `pages/IntroPage.jsx`
Static marketing page. No auth required. Links to `/signup` and `/login`.

### `pages/LoginPage.jsx` and `SignupPage.jsx`
Both redirect to `http://localhost:5000/api/v1/auth/google` on button click. **This is a hardcoded URL — must be fixed for production** using `VITE_API_URL` env variable. The OAuth flow is identical for both login and signup — it's the same Google endpoint.

### `pages/UserHomePage.jsx`
Fetches two lists in parallel on mount:
- `GET /users/me/rooms` → "Joined Chat Rooms" section
- `GET /rooms` → "World Wide Chat Rooms" section

Clicking any room card navigates to `/chat-room/{roomId}`. Does not directly join rooms here — joining happens inside ChatRoomPage.

### `pages/ChatRoomPage.jsx`
Most complex page. On mount (when `currentUser` and `roomId` are available):
1. `POST /rooms/{roomId}/join` (ignores 409 Already Member)
2. `GET /rooms/{roomId}` → sets roomData
3. `GET /rooms/{roomId}/messages?limit=50` → sets messages
4. `io('/', { withCredentials: true })` → connects Socket.IO
5. On `connect`: emits `join_room { roomId }` with acknowledgement callback
6. Listens for `new_message` → appends to messages array
7. Listens for `message_deleted` → filters from messages array

Sends messages via `socket.emit('send_message', { roomId, content })`.

Cleanup on unmount: emits `leave_room`, disconnects socket.

`isOwner` is derived from `roomData.createdBy === currentUser?.id` — shows "Delete Room" for owners, "Leave Room" for others.

### `pages/CreateChatRoomPage.jsx`
Form with: room name, slogan, description, type (public/private radio), image file picker, maxMembers (only if private). Submits as `multipart/form-data` to `POST /rooms`. On success, navigates to `/chat-room/{newRoomId}`.

### `pages/FindChatRoomPage.jsx`
On mount: loads all public rooms via `GET /rooms`. Search form hits `GET /search/rooms?name=...&id=...`. Clicking "Join Room" navigates to `/chat-room/{roomId}` (joining happens there).

### `pages/ProfilePage.jsx`
Fetches `/users/me/rooms` and filters client-side by `room.createdBy === currentUser.id` to show only owned rooms. **This filter currently always returns empty** because `getMyRooms` doesn't return `createdBy` — a known bug.

Has inline username editing: `PUT /users/me` with `{ username }` → calls `checkAuth()` to refresh `currentUser` in context.

The "Delete" button on room cards has no handler — another known bug.

### `pages/ManageChatRoomPage.jsx`
**INCOMPLETE — Uses entirely mock data.** Uses `localStorage.getItem('username')` for auth (inconsistent with `AuthContext`). All save/remove/delete operations are local state only, not connected to any API. Needs complete rewrite.

---

## 7. Authentication Flow

```
1. User clicks "Login with Google"
   → window.location.href = 'http://localhost:5000/api/v1/auth/google'
   → Passport redirects to Google's consent page

2. Google verifies identity and redirects back
   → GET /api/v1/auth/google/callback?code=...
   → Passport exchanges code for Google profile
   → config/passport.js: UPSERT user in PostgreSQL
   → authController.googleCallback:
       - Signs access_token JWT (15 min)
       - Signs refresh_token JWT (7 days)
       - Inserts refresh_token into DB
       - Sets both as httpOnly cookies
       - Redirects to http://localhost:5173/user-home

3. Frontend loads /user-home
   → AuthContext.checkAuth() runs
   → GET /api/v1/auth/me with cookie
   → authMiddleware: validates access_token cookie
   → Returns user object → AuthContext.currentUser set

4. Access token expires (15 min)
   → Any API call returns 401 { code: 'TOKEN_EXPIRED' }
   → Axios interceptor catches it
   → Calls POST /api/v1/auth/refresh (uses refresh_token cookie)
   → New access_token cookie issued
   → Original request retried automatically

5. User clicks Logout
   → POST /api/v1/auth/logout
   → DB: all refresh tokens for this user marked revoked = TRUE
   → Redis: access_token added to blocklist (15-min TTL)
   → Both cookies cleared
   → Frontend: currentUser = null, navigate to '/'
```

---

## 8. Real-Time System

### Connection Lifecycle

```
ChatRoomPage mounts
  → Socket.IO client connects to / (proxied by Vite to :5000)
  → WS handshake includes access_token cookie
  → socket.js auth middleware verifies JWT
  → socket.userId and socket.username attached to socket

On 'connect':
  → socket.emit('join_room', { roomId })
  → Server verifies membership (Redis/PostgreSQL)
  → socket.join(roomKey) — joins Socket.IO channel
  → Redis: user:online key set with 35s TTL

User sends message:
  → socket.emit('send_message', { roomId, content })
  → Server: membership check → PostgreSQL INSERT → io.to(room).emit('new_message', payload)
  → All clients including sender receive 'new_message'

ChatRoomPage unmounts:
  → socket.emit('leave_room', { roomId })
  → socket.disconnect()
  → Server: Redis online key deleted
```

### Events Summary

**Client → Server:**
- `join_room { roomId }` → acknowledgement `{ success, message? }`
- `leave_room { roomId }` → no acknowledgement
- `send_message { roomId, content }` → acknowledgement `{ success, message? }`
- `delete_message { roomId, messageId }` → acknowledgement `{ success, message? }`
- `typing_start { roomId }` → no acknowledgement
- `typing_stop { roomId }` → no acknowledgement

**Server → Client:**
- `new_message { id, roomId, senderId, senderUsername, senderAvatar, content, reactions, sentAt }`
- `message_deleted { messageId, roomId }`
- `user_joined { userId, username, roomId }`
- `user_left { userId, username, roomId }`
- `typing { username, roomId }`
- `typing_stopped { username, roomId }`

---

## 9. All API Endpoints

### Auth — `/api/v1/auth/*`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/auth/google` | Public | Redirect to Google OAuth |
| GET | `/auth/google/callback` | Public | OAuth callback (sets cookies, redirects) |
| GET | `/auth/me` | JWT | Get current user profile |
| POST | `/auth/refresh` | Cookie | Issue new access token |
| POST | `/auth/logout` | JWT | Revoke tokens + clear cookies |

### Users — `/api/v1/users/*`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | JWT | Get own profile + joined room IDs |
| PUT | `/users/me` | JWT | Update username and/or avatar image |
| GET | `/users/me/rooms` | JWT | Get full details of all joined rooms |

### Rooms — `/api/v1/rooms/*`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/rooms` | Public | List all public rooms (paginated) |
| POST | `/rooms` | JWT | Create a new room (multipart) |
| GET | `/rooms/:roomId` | Public | Get single room details |
| PUT | `/rooms/:roomId` | JWT | Update room settings (owner only) ← **needs to be added** |
| DELETE | `/rooms/:roomId` | JWT | Delete room (owner only) |
| POST | `/rooms/:roomId/join` | JWT | Join a room |
| DELETE | `/rooms/:roomId/leave` | JWT | Leave a room |
| DELETE | `/rooms/:roomId/members/:userId` | JWT | Remove a member (owner only) ← **needs to be added** |
| GET | `/rooms/:roomId/messages` | JWT | Paginated message history |
| POST | `/rooms/:roomId/messages/:messageId/react` | JWT | Toggle emoji reaction ← **stub, not implemented** |

### Search — `/api/v1/search/*`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/search/rooms?name=&id=` | Public | Search public rooms by name/id |

### Upload — `/api/v1/upload/*`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/upload/room-image` | JWT | Standalone image upload to Cloudinary |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | Public | Server health check |

---

## 10. All Socket.IO Events

See Section 8 for the full list. Key implementation details:
- All events require the WS connection to be authenticated (JWT cookie at handshake)
- `join_room` must succeed before `send_message` will work (Socket.IO room not joined otherwise)
- `send_message` broadcasts to **all** sockets in the room including the sender
- `typing_*` events are sent to **other** sockets only (using `socket.to()` not `io.to()`)
- `message_deleted` is sent to **all** sockets in the room

---

## 11. Environment Variables

### Backend (`backend/.env`)

| Variable | Example Value | Required |
|---|---|---|
| `NODE_ENV` | `development` | Yes |
| `PORT` | `5000` | No (default: 5000) |
| `CLIENT_URL` | `http://localhost:5173` | Yes |
| `DB_HOST` | `localhost` | Yes |
| `DB_PORT` | `5432` | No (default: 5432) |
| `DB_NAME` | `connectify` | Yes |
| `DB_USER` | `postgres` | Yes |
| `DB_PASSWORD` | `your_password` | Yes |
| `REDIS_URL` | `redis://localhost:6379` | No (default: local) |
| `JWT_ACCESS_SECRET` | long random string | Yes |
| `JWT_REFRESH_SECRET` | different long random string | Yes |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | No (default: 15m) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | No (default: 7d) |
| `COOKIE_SECRET` | long random string | Yes |
| `GOOGLE_CLIENT_ID` | from Google Console | Yes |
| `GOOGLE_CLIENT_SECRET` | from Google Console | Yes |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5000/api/v1/auth/google/callback` | Yes |
| `CLOUDINARY_CLOUD_NAME` | from Cloudinary dashboard | Yes |
| `CLOUDINARY_API_KEY` | from Cloudinary dashboard | Yes |
| `CLOUDINARY_API_SECRET` | from Cloudinary dashboard | Yes |

### Frontend (`frontend/.env`)

| Variable | Example Value | Required |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | Yes (for OAuth redirect) |

---

## 12. Known Issues and Pending Work

### Bugs (Cause Incorrect Behavior)

| # | Bug | Location | Impact |
|---|---|---|---|
| B1 | `getMyRooms` doesn't return `createdBy` or `description` | `userController.js` | ProfilePage shows 0 owned rooms always |
| B2 | Delete button on ProfilePage has no onClick handler | `ProfilePage.jsx` | Delete button is completely broken |
| B3 | Hardcoded `localhost:5000` in auth redirect | `LoginPage.jsx`, `SignupPage.jsx` | Breaks in any non-local environment |
| B4 | Refresh tokens stored raw despite column named `token_hash` | `authController.js` | Security risk if DB is breached |

### Missing Files (App Won't Start Without These)

| # | File | Impact |
|---|---|---|
| M1 | `jobs/cleanup.js` | `server.js` crashes on startup (`require` fails) |
| M2 | `messages` table in schema.sql | `send_message` Socket events crash with DB error |
| M3 | `.env` file | All DB connections fail |

### Incomplete Features

| # | Feature | Location | Status |
|---|---|---|---|
| I1 | ManageChatRoomPage | `ManageChatRoomPage.jsx` | All mock data, no API calls |
| I2 | `PUT /rooms/:roomId` endpoint | Backend | Does not exist |
| I3 | `DELETE /rooms/:roomId/members/:userId` endpoint | Backend | Does not exist |
| I4 | `reactToMessage` controller | `messageController.js` | Returns 501 stub |
| I5 | `messageLimiter` not applied | `rateLimitMiddleware.js` | Defined but unused |
| I6 | Typing indicator UI | `ChatRoomPage.jsx` | Events emitted/received by socket but UI not built |
| I7 | Load more messages (pagination) | `ChatRoomPage.jsx` | `hasMore`/`nextCursor` returned by API but not used |

---

## 13. Data Shapes — What the Frontend Expects

### User Object (from `/auth/me` and AuthContext)
```json
{
  "id": "uuid-string",
  "username": "johnsmith_a3f2",
  "email": "john@gmail.com",
  "avatarUrl": "https://lh3.googleusercontent.com/...",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### Room Object (from `/rooms`, `/rooms/:id`, `/users/me/rooms`)
```json
{
  "id": "ROOM001",
  "name": "Tech Enthusiasts",
  "slogan": "Connect, Learn, and Innovate",
  "description": "A room for tech lovers...",
  "imageUrl": "https://res.cloudinary.com/...",
  "type": "public",
  "members": 42,
  "maxMembers": null,
  "createdBy": "uuid-string",
  "creatorUsername": "alice_x4r2",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Note: `createdBy` and `creatorUsername` are only returned by `GET /rooms/:roomId`. The `/users/me/rooms` endpoint currently does not return `createdBy` (bug B1).

### Message Object (from `/rooms/:id/messages` and socket `new_message` event)
```json
{
  "id": "uuid-string",
  "roomId": "ROOM001",
  "senderId": "uuid-string",
  "senderUsername": "alice_x4r2",
  "senderAvatar": "https://lh3.googleusercontent.com/...",
  "content": "Hello everyone!",
  "reactions": [],
  "sentAt": "2026-06-15T10:30:00.000Z"
}
```

### Paginated Messages Response
```json
{
  "success": true,
  "messages": [ /* array of message objects, chronological */ ],
  "hasMore": true,
  "nextCursor": "2026-06-15T10:00:00.000Z"
}
```

To load the next page: `GET /rooms/:roomId/messages?before={nextCursor}&limit=50`

---

*Document last updated: June 2026 — reflects the state of all uploaded files including the most recent updates to `socket.js`, `server.js`, `app.js`, `authController.js`, `authMiddleware.js`, `validationMiddleware.js`, and `authRoutes.js`.*
