// routes/userRoutes.js
// All user profile routes. Every route here is protected — the
// authenticate middleware verifies the JWT before controllers run.

const express = require('express');
const router  = express.Router();

const { getMe, updateMe, getMyRooms } = require('../controllers/userController');
const { authenticate }                = require('../middleware/authMiddleware');
const { validateUpdateProfile }       = require('../middleware/validationMiddleware');
const { uploadAvatar }                = require('../config/cloudinary');

// All routes below require a valid JWT
router.use(authenticate);

// GET /users/me
// Returns the authenticated user's profile + joined room IDs
router.get('/me', getMe);

// PUT /users/me
// Updates username and/or avatar image
// uploadAvatar.single('avatar') processes the multipart form file before the controller
router.put('/me', uploadAvatar.single('avatar'), validateUpdateProfile, updateMe);

// GET /users/me/rooms
// Returns full details of all rooms the user has joined
router.get('/me/rooms', getMyRooms);

module.exports = router;
