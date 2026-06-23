import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/SetupProfilePage.css';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

function SetupProfilePage() {
  const navigate     = useNavigate();
  const { checkAuth } = useAuth();

  const [username,  setUsername]  = useState('');
  const [tagline,   setTagline]   = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  // ── Derived validation state ─────────────────────────────────────────────
  const usernameValid   = username.length >= 3 && USERNAME_REGEX.test(username);
  const usernameTouched = username.length > 0;

  const getUsernameHint = () => {
    if (!usernameTouched) return '';
    if (username.length < 3)              return 'At least 3 characters required.';
    if (!USERNAME_REGEX.test(username))   return 'Only letters, numbers, and underscores.';
    return '✓ Looks good!';
  };

  const getUsernameHintClass = () => {
    if (!usernameTouched) return '';
    return usernameValid ? 'valid' : 'invalid';
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!usernameValid) {
      setError('Please enter a valid username (min 3 chars, letters/numbers/underscores only).');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/complete-profile', {
        username: username.trim(),
        tagline:  tagline.trim(),
      });

      if (response.data.success) {
        // Refresh the AuthContext so the app knows the user is now authenticated
        await checkAuth();
        navigate(response.data.redirect || '/profile', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="setup-page">
      <div className="setup-card">

        {/* Avatar placeholder */}
        <div className="setup-avatar">
          <div className="setup-avatar-placeholder">👤</div>
        </div>

        <h1>Set up your profile</h1>
        <p className="setup-subtitle">
          Welcome to Connectify! Choose a username and tell people a little about yourself.
        </p>

        {error && <div className="setup-error">{error}</div>}

        <form className="setup-form" onSubmit={handleSubmit} noValidate>

          {/* Username */}
          <div className="setup-field">
            <label htmlFor="username">Username *</label>
            <input
              id="username"
              type="text"
              placeholder="e.g. luffy_op"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              autoComplete="off"
              autoFocus
              maxLength={40}
            />
            {usernameTouched && (
              <span className={`input-hint ${getUsernameHintClass()}`}>
                {getUsernameHint()}
              </span>
            )}
          </div>

          {/* Tagline */}
          <div className="setup-field">
            <label htmlFor="tagline">Tagline <span style={{ color: '#555', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              id="tagline"
              placeholder="A short line about yourself…"
              value={tagline}
              onChange={e => setTagline(e.target.value.slice(0, 100))}
              rows={3}
            />
            <span className={`char-count ${tagline.length >= 90 ? 'near-limit' : ''}`}>
              {tagline.length} / 100
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="setup-submit-btn"
            disabled={loading || !usernameValid}
          >
            {loading ? (
              <><span className="spinner" />Setting up your profile…</>
            ) : (
              'Save & Enter Connectify →'
            )}
          </button>

        </form>
      </div>
    </div>
  );
}

export default SetupProfilePage;
