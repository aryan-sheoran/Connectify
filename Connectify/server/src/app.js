// app.js
// Express application setup.
// Registers all middleware, routes, and error handlers.

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const passport     = require('./config/passport');

// ── Routes ────────────────────────────────────────────────────────────────
const authRoutes   = require('./routes/authRoutes');
const userRoutes   = require('./routes/userRoutes');
const roomRoutes   = require('./routes/roomRoutes');
const searchRoutes = require('./routes/searchRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// ── Middleware ────────────────────────────────────────────────────────────
const { apiLimiter }                                     = require('./middleware/rateLimitMiddleware');
const { multerErrorHandler, errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');

const app = express();

// ── Core middleware ───────────────────────────────────────────────────────

// CORS — allow only the frontend origin in production
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,                  // Allow cookies / auth headers
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse httpOnly cookies — required for reading JWT access/refresh tokens
app.use(cookieParser(process.env.COOKIE_SECRET));

// Initialise Passport (no sessions — JWT cookies handle persistence)
app.use(passport.initialize());

// Parse JSON bodies (up to 10kb — images go through multer, not JSON)
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded form data
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Apply general rate limiting to all API routes
app.use('/api', apiLimiter);

// ── Health check ──────────────────────────────────────────────────────────
// Useful for uptime monitors and load balancer health checks
app.get('/health', (req, res) => {
  res.status(200).json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    service:   'connectify-api',
  });
});

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api/v1/auth',   authRoutes);
app.use('/api/v1/users',  userRoutes);
app.use('/api/v1/rooms',  roomRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/upload', uploadRoutes);

// ── Error handling ────────────────────────────────────────────────────────
// Order matters: multer errors → 404 → general errors
app.use(multerErrorHandler);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
