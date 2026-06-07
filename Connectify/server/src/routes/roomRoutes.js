// routes/roomRoutes.js
// Chat room CRUD + membership routes.
// GET /rooms is public; all others require authentication.

const express = require('express');
const router  = express.Router();

const {
  getAllRooms,
  createRoom,
  getRoomById,
  joinRoom,
  leaveRoom,
  deleteRoom,
} = require('../controllers/roomController');

const { getRoomMessages, reactToMessage } = require('../controllers/messageController');
const { authenticate }      = require('../middleware/authMiddleware');
const { validateCreateRoom } = require('../middleware/validationMiddleware');
const { uploadRoomImage }   = require('../config/cloudinary');

// ── Public routes ──────────────────────────────────────────────────────────

// GET /rooms?name=tech&id=ROOM001&page=1&limit=20
// Lists all public rooms, with optional search filters and pagination
router.get('/', getAllRooms);

// GET /rooms/:roomId
// Returns details for a single room
router.get('/:roomId', getRoomById);

// ── Protected routes (JWT required) ───────────────────────────────────────

// POST /rooms
// Creates a new room. Image upload middleware runs first, then validation.
router.post(
  '/',
  authenticate,
  uploadRoomImage.single('image'),  // Uploads to Cloudinary; result in req.file
  validateCreateRoom,
  createRoom
);

// POST /rooms/:roomId/join
// Adds the authenticated user to the specified room
router.post('/:roomId/join', authenticate, joinRoom);

// DELETE /rooms/:roomId/leave
// Removes the authenticated user from the specified room
router.delete('/:roomId/leave', authenticate, leaveRoom);

// DELETE /rooms/:roomId
// Permanently deletes a room (creator only)
router.delete('/:roomId', authenticate, deleteRoom);

// GET /rooms/:roomId/messages?before=<ISO_TIMESTAMP>&limit=50
// Fetches paginated message history (user must be a room member)
router.get('/:roomId/messages', authenticate, getRoomMessages);

// POST /rooms/:roomId/messages/:messageId/react
// Toggle an emoji reaction on a message (adds if absent, removes if present)
router.post('/:roomId/messages/:messageId/react', authenticate, reactToMessage);

module.exports = router;
