-- models/schema.sql
-- Run this file once to set up the Connectify database schema.
-- Command: psql -U postgres -d connectify -f models/schema.sql

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────────
-- No password_hash column — identity is owned by Google OAuth.
-- google_id is the unique subject ID returned by Google.
-- A user signs in with Google → we upsert on google_id.
CREATE TABLE IF NOT EXISTS users (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id    VARCHAR(255) UNIQUE NOT NULL,   -- Google's stable user ID
    username     VARCHAR(50)  UNIQUE NOT NULL,   -- Derived from Google display name
    email        VARCHAR(255) UNIQUE NOT NULL,
    avatar_url   TEXT,                           -- Google profile picture (or custom upload)
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Refresh tokens ────────────────────────────────────────────────────────
-- Stored as httpOnly cookies; tracked here so we can revoke them on logout.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL,            -- SHA-256 hash of the raw token
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN     DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Chat rooms ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
    id          VARCHAR(20)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    slogan      VARCHAR(100),
    description TEXT         NOT NULL,
    image_url   TEXT,
    type        VARCHAR(10)  DEFAULT 'public' CHECK (type IN ('public', 'private')),
    max_members INT,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Room memberships ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_members (
    user_id   UUID        REFERENCES users(id)  ON DELETE CASCADE,
    room_id   VARCHAR(20) REFERENCES rooms(id)  ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, room_id)
);

-- ── Messages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         VARCHAR(20) REFERENCES rooms(id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_username VARCHAR(50),
    sender_avatar   TEXT,
    content         TEXT NOT NULL,
    sent_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Message Reactions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    emoji      VARCHAR(10) NOT NULL,
    PRIMARY KEY (message_id, user_id, emoji)
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_members_user   ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room   ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_type          ON rooms(type);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id     ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_time  ON messages(room_id, sent_at DESC);
