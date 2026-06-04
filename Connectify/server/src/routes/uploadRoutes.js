// routes/uploadRoutes.js
const express = require('express');
const router  = express.Router();

const { uploadRoomImage: handleUpload } = require('../controllers/uploadController');
const { authenticate }                  = require('../middleware/authMiddleware');
const { uploadRoomImage }               = require('../config/cloudinary');

// POST /upload/room-image
// Protected — uploads a single room image to Cloudinary and returns its URL
router.post(
  '/room-image',
  authenticate,
  uploadRoomImage.single('image'),
  handleUpload
);

module.exports = router;
