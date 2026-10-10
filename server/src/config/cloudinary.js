// config/cloudinary.js
// Configures the Cloudinary SDK and creates a multer storage engine
// that streams uploads directly to Cloudinary — no local disk storage needed.

const cloudinary  = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Room image upload storage ──────────────────────────────────────────────
const roomImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'connectify/rooms',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    transformation: [{ width: 800, height: 600, crop: 'limit' }],
  },
});

// ── Avatar upload storage ──────────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'connectify/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 200, height: 200, crop: 'fill' }],
  },
});

// File filter — rejects anything that isn't an image
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// 5 MB size limit
const MAX_SIZE = 5 * 1024 * 1024;

const uploadRoomImage = multer({
  storage: roomImageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_SIZE },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_SIZE },
});

module.exports = { cloudinary, uploadRoomImage, uploadAvatar };
