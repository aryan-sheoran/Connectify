# Connectify — Backend API & System Design Document

> A complete reference for making Connectify fully functional, covering every required API endpoint, data models, and the overall system architecture.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
   - [Authentication](#1-authentication)
   - [User](#2-user)
   - [Chat Rooms](#3-chat-rooms)
   - [Messaging (WebSocket)](#4-messaging-websocket)
   - [Search](#5-search)
   - [Media Upload](#6-media-upload)
2. [System Design](#system-design)
   - [High-Level Architecture](#high-level-architecture)
   - [Components Breakdown](#components-breakdown)
   - [Database Schema](#database-schema)
   - [Real-Time Communication Design](#real-time-communication-design)
   - [Security Considerations](#security-considerations)
   - [Scalability Considerations](#scalability-considerations)
3. [Tech Stack Recommendation](#tech-stack-recommendation)
4. [Further Reading & Resources](#further-reading--resources)

---

## API Endpoints

> **Base URL:** `https://api.connectify.com/v1`
> All protected routes require `Authorization: Bearer <JWT_TOKEN>` header.

---

### 1. Authentication

These endpoints handle user registration, login, logout, and token refresh. The current `LoginPage.jsx` and `SignupPage.jsx` only store `username` in `localStorage` — these APIs will replace that with proper server-side auth.

---

#### `POST /auth/signup`

Registers a new user.

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response `201 Created`:**
```json
{
  "message": "Account created successfully",
  "token": "<JWT_ACCESS_TOKEN>",
  "refreshToken": "<JWT_REFRESH_TOKEN>",
  "user": {
    "id": "usr_abc123",
    "username": "john_doe",
    "email": "john@example.com",
    "createdAt": "2026-06-01T10:00:00Z"
  }
}
```

**Error Responses:**
- `409 Conflict` — Username or email already exists
- `422 Unprocessable Entity` — Validation failed (e.g., weak password)

---

#### `POST /auth/login`

Authenticates an existing user.

**Request Body:**
```json
{
  "username": "john_doe",
  "password": "SecurePass123!"
}
```

**Response `200 OK`:**
```json
{
  "token": "<JWT_ACCESS_TOKEN>",
  "refreshToken": "<JWT_REFRESH_TOKEN>",
  "user": {
    "id": "usr_abc123",
    "username": "john_doe"
  }
}
```

**Error Responses:**
- `401 Unauthorized` — Invalid credentials
- `404 Not Found` — User does not exist

---

#### `POST /auth/logout`

🔒 Protected. Invalidates the refresh token server-side.

**Request Body:**
```json
{
  "refreshToken": "<JWT_REFRESH_TOKEN>"
}
```

**Response `200 OK`:**
```json
{ "message": "Logged out successfully" }
```

---

#### `POST /auth/refresh`

Issues a new access token using the refresh token.

**Request Body:**
```json
{
  "refreshToken": "<JWT_REFRESH_TOKEN>"
}
```

**Response `200 OK`:**
```json
{
  "token": "<NEW_JWT_ACCESS_TOKEN>"
}
```

**Error Responses:**
- `403 Forbidden` — Refresh token expired or invalid

---

### 2. User

Endpoints to manage the logged-in user's profile and room memberships. These power the `UserHomePage.jsx` welcome section and `Sidebar`.

---

#### `GET /users/me`

🔒 Protected. Returns the current logged-in user's profile.

**Response `200 OK`:**
```json
{
  "id": "usr_abc123",
  "username": "john_doe",
  "email": "john@example.com",
  "avatarUrl": "https://cdn.connectify.com/avatars/usr_abc123.png",
  "joinedRooms": ["ROOM001", "ROOM003"],
  "createdAt": "2026-06-01T10:00:00Z"
}
```

---

#### `PUT /users/me`

🔒 Protected. Updates the user's profile (username, avatar).

**Request Body (multipart/form-data):**
```
username: new_username
avatar: <image_file>
```

**Response `200 OK`:**
```json
{
  "message": "Profile updated",
  "user": {
    "id": "usr_abc123",
    "username": "new_username",
    "avatarUrl": "https://cdn.connectify.com/avatars/new_img.png"
  }
}
```

---

#### `GET /users/me/rooms`

🔒 Protected. Returns all chat rooms the user has joined (powers "Joined Chat Rooms" in `UserHomePage.jsx`).

**Response `200 OK`:**
```json
{
  "rooms": [
    {
      "id": "ROOM001",
      "name": "Tech Enthusiasts",
      "slogan": "For tech lovers",
      "imageUrl": "https://cdn.connectify.com/rooms/ROOM001.jpg",
      "onlineMembers": 12,
      "type": "public"
    }
  ]
}
```

---

### 3. Chat Rooms

Powers `CreateChatRoomPage.jsx`, `FindChatRoomPage.jsx`, and the worldwide rooms section in `UserHomePage.jsx`.

---

#### `GET /rooms`

Returns a paginated list of all **public** chat rooms (worldwide rooms feed).

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |
| `name` | string | Filter by room name |
| `id` | string | Filter by room ID |

**Response `200 OK`:**
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "rooms": [
    {
      "id": "ROOM001",
      "name": "Tech Enthusiasts",
      "slogan": "For tech lovers",
      "description": "A room dedicated to technology discussions.",
      "imageUrl": "https://cdn.connectify.com/rooms/ROOM001.jpg",
      "type": "public",
      "members": 45,
      "maxMembers": null
    }
  ]
}
```

---

#### `POST /rooms`

🔒 Protected. Creates a new chat room (from `CreateChatRoomPage.jsx`).

**Request Body (multipart/form-data):**
```
roomName: Tech Enthusiasts
description: A room for tech lovers
slogan: Build. Break. Repeat.
isPrivate: false
maxMembers: 50
image: <image_file>
```

**Response `201 Created`:**
```json
{
  "message": "Chat room created",
  "room": {
    "id": "ROOM007",
    "name": "Tech Enthusiasts",
    "description": "A room for tech lovers",
    "slogan": "Build. Break. Repeat.",
    "type": "public",
    "imageUrl": "https://cdn.connectify.com/rooms/ROOM007.jpg",
    "maxMembers": null,
    "createdBy": "usr_abc123",
    "createdAt": "2026-06-04T12:00:00Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Missing required fields
- `413 Payload Too Large` — Image exceeds 5MB

---

#### `GET /rooms/:roomId`

Returns details for a specific room.

**Response `200 OK`:**
```json
{
  "id": "ROOM001",
  "name": "Tech Enthusiasts",
  "description": "A room for tech lovers.",
  "slogan": "For tech lovers",
  "type": "public",
  "imageUrl": "https://cdn.connectify.com/rooms/ROOM001.jpg",
  "members": 45,
  "maxMembers": null,
  "createdBy": "usr_abc123",
  "createdAt": "2026-01-10T09:00:00Z"
}
```

**Error Responses:**
- `404 Not Found` — Room does not exist

---

#### `POST /rooms/:roomId/join`

🔒 Protected. Adds the current user to a chat room.

**Response `200 OK`:**
```json
{ "message": "Successfully joined room ROOM001" }
```

**Error Responses:**
- `403 Forbidden` — Room is private (invitation required)
- `409 Conflict` — User is already a member
- `410 Gone` — Room is full (maxMembers reached)

---

#### `DELETE /rooms/:roomId/leave`

🔒 Protected. Removes the current user from a chat room.

**Response `200 OK`:**
```json
{ "message": "Left room ROOM001" }
```

---

#### `DELETE /rooms/:roomId`

🔒 Protected. Deletes a room (only the creator can do this).

**Response `200 OK`:**
```json
{ "message": "Room deleted" }
```

**Error Responses:**
- `403 Forbidden` — User is not the room creator

---

### 4. Messaging (WebSocket)

Real-time messaging is handled via **WebSocket** (Socket.IO or native WebSocket). REST endpoints are used for loading message history; WebSocket is used for live messaging.

---

#### `GET /rooms/:roomId/messages`

🔒 Protected. Fetches paginated message history for a room.

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `before` | ISO timestamp | Load messages before this time (cursor-based pagination) |
| `limit` | number | Number of messages (default: 50) |

**Response `200 OK`:**
```json
{
  "messages": [
    {
      "id": "msg_001",
      "roomId": "ROOM001",
      "senderId": "usr_abc123",
      "senderUsername": "john_doe",
      "content": "Hello everyone!",
      "sentAt": "2026-06-04T11:00:00Z"
    }
  ],
  "hasMore": true
}
```

---

#### WebSocket Events

Connect to: `wss://api.connectify.com/socket`

**Client → Server events:**

| Event | Payload | Description |
|---|---|---|
| `join_room` | `{ roomId }` | Subscribe to a room's live messages |
| `leave_room` | `{ roomId }` | Unsubscribe from a room |
| `send_message` | `{ roomId, content }` | Send a new message |
| `typing_start` | `{ roomId }` | Broadcast "user is typing" |
| `typing_stop` | `{ roomId }` | Stop typing indicator |

**Server → Client events:**

| Event | Payload | Description |
|---|---|---|
| `new_message` | `{ id, roomId, senderId, senderUsername, content, sentAt }` | New message broadcast to all room members |
| `user_joined` | `{ userId, username, roomId }` | A user joined the room |
| `user_left` | `{ userId, username, roomId }` | A user left the room |
| `typing` | `{ username, roomId }` | A user is typing |
| `error` | `{ code, message }` | Socket-level error |

---

### 5. Search

Powers the search feature in `FindChatRoomPage.jsx`.

---

#### `GET /search/rooms`

Searches across all public rooms by name or ID.

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `name` | string | Partial room name search |
| `id` | string | Exact or partial room ID |

**Response `200 OK`:**
```json
{
  "results": [
    {
      "id": "ROOM001",
      "name": "Tech Enthusiasts",
      "slogan": "For tech lovers",
      "type": "public",
      "members": 45,
      "imageUrl": "https://cdn.connectify.com/rooms/ROOM001.jpg"
    }
  ],
  "total": 1
}
```

---

### 6. Media Upload

Handles room image uploads from `CreateChatRoomPage.jsx`.

---

#### `POST /upload/room-image`

🔒 Protected. Uploads a room image to cloud storage (S3 / Cloudinary).

**Request Body (multipart/form-data):**
```
image: <image_file>   (JPG, PNG, GIF — max 5MB)
```

**Response `200 OK`:**
```json
{
  "imageUrl": "https://cdn.connectify.com/rooms/uploaded_image.jpg"
}
```

**Error Responses:**
- `400 Bad Request` — Invalid file type
- `413 Payload Too Large` — File exceeds 5MB

---

---

## System Design

### High-Level Architecture

```
                          ┌─────────────────────────────────────┐
                          │          React Frontend               │
                          │  (IntroPage, LoginPage, UserHome,    │
                          │   CreateRoom, FindRoom pages)        │
                          └────────────┬────────────────┬────────┘
                                       │ HTTPS REST     │ WebSocket (WSS)
                          ┌────────────▼────────────────▼────────┐
                          │          API Gateway / Load Balancer  │
                          │          (Nginx / AWS ALB)            │
                          └──────┬──────────────┬────────────────┘
                                 │              │
                    ┌────────────▼──┐     ┌─────▼──────────────┐
                    │  REST API     │     │  WebSocket Server   │
                    │  (Node/Express│     │  (Socket.IO cluster)│
                    │   or Django)  │     └─────────┬───────────┘
                    └──────┬────────┘               │
                           │                  ┌─────▼──────┐
              ┌────────────┼──────────────────►  Redis      │
              │            │                  │  (Pub/Sub + │
              │     ┌──────▼──────┐           │  Sessions)  │
              │     │  PostgreSQL  │           └────────────┘
              │     │  (Main DB)  │
              │     └────────────┘
              │
        ┌─────▼──────────┐
        │  Cloud Storage  │
        │  (S3/Cloudinary)│
        │  Room images,   │
        │  avatars        │
        └────────────────┘
```

---

### Components Breakdown

#### 1. Frontend (React)

The existing codebase. Key missing pieces to add:

- **Auth Context** — Replace `localStorage` username with a proper auth context holding JWT tokens, user ID, and session state.
- **API Service Layer** — A centralized `api.js` using `axios` or `fetch` with interceptors for attaching JWT headers and handling 401 token refresh.
- **WebSocket Client** — A `socket.js` service using `socket.io-client` to connect to the real-time server.
- **Protected Routes** — A `PrivateRoute` wrapper that redirects unauthenticated users away from `/user-home`, `/create-room`, and `/find-room`.

📚 Resources:
- [React Context API](https://react.dev/reference/react/createContext)
- [Axios interceptors](https://axios-http.com/docs/interceptors)
- [Socket.IO Client docs](https://socket.io/docs/v4/client-api/)
- [React Router v6 — protected routes](https://reactrouter.com/en/main/start/concepts)

---

#### 2. REST API Server

Handles authentication, room management, and message history.

**Recommended:** Node.js + Express or Django REST Framework

Responsibilities:
- User registration, login, JWT issuance
- CRUD operations for chat rooms
- Room membership management (join/leave)
- Fetching paginated message history from the database

📚 Resources:
- [Express.js — Getting Started](https://expressjs.com/en/starter/installing.html)
- [JWT authentication in Node.js](https://jwt.io/introduction)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [bcrypt for password hashing](https://github.com/kelektiv/node.bcrypt.js)

---

#### 3. WebSocket Server (Real-Time)

Manages live messaging, online presence, and typing indicators.

**Recommended:** Socket.IO on top of the same Node.js server (or a separate microservice)

Responsibilities:
- Authenticate socket connections using JWT (passed as a query param or handshake header)
- Manage room-based channels using Socket.IO rooms
- Broadcast messages to all members in a room
- Emit `user_joined`, `user_left`, and `typing` events
- Use Redis Pub/Sub to synchronize events across multiple server instances

📚 Resources:
- [Socket.IO — Server docs](https://socket.io/docs/v4/server-api/)
- [Socket.IO with Redis adapter](https://socket.io/docs/v4/redis-adapter/)
- [Building a chat app with Socket.IO](https://socket.io/get-started/chat)

---

#### 4. PostgreSQL (Primary Database)

Stores all persistent data: users, rooms, memberships, and messages.

Key tables: `users`, `rooms`, `room_members`, `messages` (see Database Schema below).

**Recommended ORM:** Prisma (Node.js) or Django ORM

📚 Resources:
- [PostgreSQL official docs](https://www.postgresql.org/docs/)
- [Prisma ORM — Getting Started](https://www.prisma.io/docs/getting-started)
- [Database indexing fundamentals](https://use-the-index-luke.com/)

---

#### 5. Redis

Used for two purposes:

- **Session / Token Store** — Store refresh token allow/blocklist for fast lookup and logout invalidation
- **Pub/Sub for WebSocket** — When multiple WebSocket server instances are running, Redis Pub/Sub ensures a message sent on server A is broadcast to clients connected on server B

📚 Resources:
- [Redis official docs](https://redis.io/docs/)
- [Redis Pub/Sub guide](https://redis.io/docs/manual/pubsub/)
- [Socket.IO Redis adapter](https://github.com/socketio/socket.io-redis-adapter)

---

#### 6. Cloud Storage (S3 / Cloudinary)

Handles room cover images and user avatars uploaded in `CreateChatRoomPage.jsx`.

Flow:
1. Frontend sends image to `POST /upload/room-image`
2. Backend validates file type and size
3. Backend streams the file to S3 or Cloudinary
4. Backend returns the permanent CDN URL to frontend
5. Frontend uses this URL when calling `POST /rooms`

📚 Resources:
- [AWS S3 — Node.js SDK](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-example-creating-buckets.html)
- [Cloudinary — Node.js integration](https://cloudinary.com/documentation/node_integration)
- [Multer — Node.js file upload middleware](https://github.com/expressjs/multer)

---

#### 7. API Gateway / Load Balancer

Sits in front of all backend services in production.

Responsibilities:
- Route `/api/*` requests to the REST server
- Route `/socket.io/*` to the WebSocket server
- SSL termination (HTTPS/WSS)
- Rate limiting to prevent abuse

**Recommended:** Nginx (self-hosted) or AWS Application Load Balancer

📚 Resources:
- [Nginx reverse proxy guide](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- [Nginx + Socket.IO configuration](https://socket.io/docs/v4/reverse-proxy/#nginx)
- [AWS ALB docs](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)

---

### Database Schema

```sql
-- Users table
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(50) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chat rooms table
CREATE TABLE rooms (
    id          VARCHAR(20) PRIMARY KEY,   -- e.g. ROOM001
    name        VARCHAR(100) NOT NULL,
    slogan      VARCHAR(100),
    description TEXT NOT NULL,
    image_url   TEXT,
    type        VARCHAR(10) DEFAULT 'public',  -- 'public' | 'private'
    max_members INT,                           -- NULL for unlimited
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Room memberships (many-to-many)
CREATE TABLE room_members (
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    room_id     VARCHAR(20) REFERENCES rooms(id) ON DELETE CASCADE,
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, room_id)
);

-- Messages table
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     VARCHAR(20) REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    content     TEXT NOT NULL,
    sent_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_room_id ON messages(room_id, sent_at DESC);
CREATE INDEX idx_room_members_user ON room_members(user_id);
```

---

### Real-Time Communication Design

```
User A sends "Hello!"
        │
        ▼
  Socket.IO Server (Instance 1)
        │
        ├──► Saves message to PostgreSQL
        │
        └──► Publishes event to Redis Pub/Sub channel: "room:ROOM001"
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
  Socket.IO Server        Socket.IO Server
  (Instance 1)            (Instance 2)
  broadcasts to           broadcasts to
  its connected           its connected
  clients in ROOM001      clients in ROOM001
```

This design ensures horizontal scalability — you can run multiple WebSocket servers without losing message delivery.

---

### Security Considerations

| Concern | Solution |
|---|---|
| Password storage | Hash with **bcrypt** (cost factor ≥ 12), never store plaintext |
| Authentication | Short-lived **JWT access tokens** (15 min) + long-lived refresh tokens (7 days) stored in `httpOnly` cookies |
| Authorization | Verify room membership before allowing WebSocket join and message send |
| File uploads | Validate MIME type server-side (not just file extension), limit to 5MB, scan with antivirus if needed |
| SQL injection | Use parameterized queries / ORM (Prisma or Django ORM) — never string-concatenate SQL |
| XSS | Sanitize message content before storing; escape on render (React does this by default) |
| Rate limiting | Limit auth endpoints (5 req/min per IP), message sending (30 msg/min per user) |
| CORS | Allow only your frontend origin, not `*` in production |

---

### Scalability Considerations

| Layer | Strategy |
|---|---|
| REST API | Horizontal scaling behind a load balancer; stateless (JWT means no server-side session) |
| WebSocket | Redis Pub/Sub adapter allows multiple Socket.IO instances |
| Database | Read replicas for heavy read workloads; index `messages(room_id, sent_at)` for fast history queries |
| Message history | Archive old messages (>30 days) to cold storage (S3) to keep the DB lean |
| Media storage | Serve all images from CDN (CloudFront / Cloudinary) — never directly from your server |
| Search | For advanced room search, add **Elasticsearch** or use PostgreSQL full-text search (`tsvector`) |

---

## Tech Stack Recommendation

| Layer | Recommended Choice | Alternative |
|---|---|---|
| Frontend | React (existing) + Axios + Socket.IO Client | — |
| REST API | Node.js + Express + TypeScript | Django REST Framework (Python) |
| WebSocket | Socket.IO | ws (native WebSocket library) |
| Database | PostgreSQL | MySQL |
| ORM | Prisma | Sequelize / TypeORM |
| Cache / Pub-Sub | Redis | — |
| File Storage | Cloudinary (simpler) | AWS S3 |
| Auth | JWT (jsonwebtoken library) + bcrypt | Passport.js |
| API Gateway | Nginx | AWS ALB |
| Deployment | Railway / Render (easy) | AWS ECS / DigitalOcean |

---

## Further Reading & Resources

### Foundational Concepts
- [REST API Design Best Practices — Microsoft](https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design)
- [WebSocket vs REST — When to use which](https://ably.com/topic/websockets-vs-rest)
- [JWT Handbook](https://auth0.com/resources/ebooks/jwt-handbook)

### Real-Time & WebSocket
- [Socket.IO Official Docs](https://socket.io/docs/v4/)
- [Building Scalable Real-Time Apps — Ably Blog](https://ably.com/blog/introduction-to-websockets)
- [Redis Pub/Sub explained](https://redis.io/docs/manual/pubsub/)

### Database & Schema Design
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [Prisma — Getting Started](https://www.prisma.io/docs/getting-started)
- [Database Indexing for Developers](https://use-the-index-luke.com/)

### Security
- [OWASP Top 10 Web Security Risks](https://owasp.org/www-project-top-ten/)
- [JWT Security Best Practices](https://curity.io/resources/learn/jwt-best-practices/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)

### File Uploads
- [Cloudinary Node.js SDK Docs](https://cloudinary.com/documentation/node_integration)
- [Multer middleware — GitHub](https://github.com/expressjs/multer)

### Deployment & DevOps
- [Docker for Node.js apps](https://docs.docker.com/language/nodejs/)
- [Deploying on Railway](https://docs.railway.app/)
- [Nginx Reverse Proxy Setup](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)

### System Design (General)
- [System Design Primer — GitHub](https://github.com/donnemartin/system-design-primer) ⭐ Highly recommended
- [Designing Data-Intensive Applications — Book](https://dataintensive.net/)
- [ByteByteGo — System Design Newsletter](https://bytebytego.com/)

---

*Document prepared for Connectify project. Last updated: June 2026.*
