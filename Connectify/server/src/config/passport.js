// config/passport.js
// Configures Passport.js with the Google OAuth 2.0 strategy.
//
// Flow:
//   1. User clicks "Login with Google" → browser goes to /api/v1/auth/google
//   2. Google redirects back to /api/v1/auth/google/callback with a code
//   3. Passport exchanges the code for the user's Google profile
//   4. We upsert the user in our DB (create on first login, find on return)
//   5. authController.googleCallback issues JWT cookies and redirects to frontend
//
// We use session: false throughout because we rely on JWT cookies,
// not server-side sessions.

const passport      = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool          = require('./db');

/**
 * Derives a safe, unique username from a Google display name.
 * Strips non-alphanumeric characters and appends a short random suffix
 * so two users called "John Smith" don't collide.
 *
 * Example: "John Smith" → "johnsmith_a3f2"
 */
const deriveUsername = (displayName) => {
  const base   = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6); // 4 random chars
  return `${base}_${suffix}`;
};

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL,
      // Ask Google for the user's profile + email
      scope: ['profile', 'email'],
    },

    // Verify callback — runs after Google returns the user's profile
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId  = profile.id;
        const email     = profile.emails?.[0]?.value;
        const avatarUrl = profile.photos?.[0]?.value;
        const displayName = profile.displayName || 'User';

        if (!email) {
          return done(new Error('Google account did not provide an email address.'), null);
        }

        // ── Upsert the user ──────────────────────────────────────────────
        // If google_id already exists → return that user (returning login)
        // If not → create a new user row (first login)
        //
        // ON CONFLICT on google_id updates email/avatar in case they changed
        // in Google's system since the last login.
        const username = deriveUsername(displayName);

        const result = await pool.query(
          `INSERT INTO users (google_id, username, email, avatar_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (google_id) DO UPDATE
             SET email      = EXCLUDED.email,
                 avatar_url = EXCLUDED.avatar_url
           RETURNING id, username, email, avatar_url, profile_completed`,
          [googleId, username, email, avatarUrl]
        );

        const user = result.rows[0];
        // Also expose the Google display name so we can personalise the OTP email
        user.displayName = displayName;

        // Pass the user to Passport — available as req.user in the callback route
        return done(null, user);

      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// We're not using Passport sessions (JWT cookies handle persistence),
// but these stubs are required by Passport to avoid errors.
passport.serializeUser((user, done)   => done(null, user.id));
passport.deserializeUser((id, done)   => done(null, { id }));

module.exports = passport;
