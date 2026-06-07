// middleware/validationMiddleware.js
// Reusable request validation rules built with express-validator.
// Each exported array is used directly as route-level middleware.
//
// Pattern:
//   1. Define validation rules (check(...))
//   2. Add handleValidationErrors as the last item in the array
//   3. If any rule fails, handleValidationErrors returns 422 immediately

const { body, query, validationResult } = require('express-validator');

// ── Shared handler ─────────────────────────────────────────────────────────
/**
 * Reads the result of all preceding validation rules and, if there are
 * errors, responds with 422 and a list of field-level error messages.
 * Must be the last middleware in every validation array.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      // Return a clean array: [{ field: 'email', message: '...' }]
      errors: errors.array().map(err => ({
        field:   err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

// Auth now uses Google OAuth — no signup/login/password validators needed.

// ── Room validations ───────────────────────────────────────────────────────

const validateCreateRoom = [
  body('roomName')
    .trim()
    .notEmpty()     .withMessage('Room name is required')
    .isLength({ min: 3, max: 100 })
                    .withMessage('Room name must be between 3 and 100 characters'),

  body('description')
    .trim()
    .notEmpty()     .withMessage('Description is required')
    .isLength({ min: 10 })
                    .withMessage('Description must be at least 10 characters'),

  body('slogan')
    .optional()
    .trim()
    .isLength({ max: 100 })
                    .withMessage('Slogan cannot exceed 100 characters'),

  body('isPrivate')
    .optional()
    .isBoolean()    .withMessage('isPrivate must be a boolean value'),

  body('maxMembers')
    .optional()
    .isInt({ min: 2, max: 500 })
                    .withMessage('maxMembers must be a number between 2 and 500'),

  handleValidationErrors,
];

// ── Search validations ─────────────────────────────────────────────────────

const validateRoomSearch = [
  query('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
                    .withMessage('Search name too long'),

  query('id')
    .optional()
    .trim()
    .isLength({ max: 20 })
                    .withMessage('Room ID too long'),

  handleValidationErrors,
];

// ── User update validation ─────────────────────────────────────────────────

const validateUpdateProfile = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
                    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
                    .withMessage('Username can only contain letters, numbers, and underscores'),

  handleValidationErrors,
];

module.exports = {
  validateCreateRoom,
  validateRoomSearch,
  validateUpdateProfile,
  handleValidationErrors,
};
