// controllers/uploadController.js
// Handles the standalone image upload endpoint POST /upload/room-image.
// The actual upload to Cloudinary is performed by multer middleware
// before this controller runs — this controller just returns the URL.

// ── POST /upload/room-image ────────────────────────────────────────────────
/**
 * Returns the Cloudinary URL of the uploaded room image.
 * multer + CloudinaryStorage have already processed the file by the time
 * this function is called. The URL lives in req.file.path.
 */
const uploadRoomImage = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided.',
      });
    }

    return res.status(200).json({
      success:  true,
      imageUrl: req.file.path,  // Cloudinary CDN URL
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { uploadRoomImage };
