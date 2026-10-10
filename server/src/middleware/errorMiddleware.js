// middleware/errorMiddleware.js
// Global error handling middleware. Express identifies it by the four-argument
// signature (err, req, res, next) and calls it whenever next(err) is invoked
// from any route or middleware.
//
// Must be registered LAST in server.js after all routes.

/**
 * Handles multer-specific errors (file too large, wrong type).
 * Must come before the general errorHandler below.
 */
const multerErrorHandler = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum allowed size is 5MB.',
    });
  }

  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only JPG, PNG, and GIF images are accepted.',
    });
  }

  next(err);
};

/**
 * General error handler — catches all unhandled errors thrown in routes.
 * In development, includes the full stack trace.
 * In production, only a generic message is sent to the client.
 */
const errorHandler = (err, req, res, next) => {
  // Log the full error server-side regardless of environment
  console.error(`[${new Date().toISOString()}] ERROR:`, err.stack);

  const statusCode = err.statusCode || err.status || 500;

  const response = {
    success: false,
    message: err.message || 'An unexpected server error occurred.',
  };

  // Expose stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 handler — catches requests to routes that don't exist.
 * Register this AFTER all routes but BEFORE errorHandler.
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { multerErrorHandler, errorHandler, notFoundHandler };
