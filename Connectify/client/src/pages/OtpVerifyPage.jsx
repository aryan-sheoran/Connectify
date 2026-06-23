import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';
import '../styles/OtpVerifyPage.css';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds before resend is allowed

function OtpVerifyPage() {
  const [searchParams]         = useSearchParams();
  const navigate               = useNavigate();
  const pendingToken           = searchParams.get('token');

  // OTP boxes — one value per digit
  const [digits,    setDigits]    = useState(Array(OTP_LENGTH).fill(''));
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [loading,   setLoading]   = useState(false);

  // Countdown timer for resend
  const [countdown,    setCountdown]    = useState(RESEND_COOLDOWN);
  const [canResend,    setCanResend]    = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const inputRefs = useRef([]);

  // If no token in URL, redirect to login
  useEffect(() => {
    if (!pendingToken) {
      navigate('/login', { replace: true });
    }
  }, [pendingToken, navigate]);

  // Start the countdown immediately on mount
  useEffect(() => {
    let remaining = RESEND_COOLDOWN;
    const timer = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setCanResend(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Focus the first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Format mm:ss from raw seconds
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Digit input handlers ─────────────────────────────────────────────────

  const handleChange = (index, value) => {
    // Accept only one digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    // Auto-advance to the next box
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      const newDigits = [...digits];
      if (digits[index]) {
        // Clear current box
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        // Move to previous box
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  // Handle paste — spread digits across boxes
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const newDigits = Array(OTP_LENGTH).fill('');
    pasted.split('').forEach((ch, i) => { newDigits[i] = ch; });
    setDigits(newDigits);
    const nextEmpty = pasted.length < OTP_LENGTH ? pasted.length : OTP_LENGTH - 1;
    inputRefs.current[nextEmpty]?.focus();
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/verify-otp', {
        token: pendingToken,
        otp,
      });

      if (response.data.success) {
        setSuccess('Verified! Redirecting…');
        // Small delay so the user sees the success state
        setTimeout(() => {
          navigate(response.data.redirect, { replace: true });
        }, 600);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed. Please try again.';
      setError(msg);
      // Shake + clear boxes on wrong OTP
      setDigits(Array(OTP_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }, [digits, pendingToken, navigate]);

  // ── Resend OTP ───────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (!canResend || resendLoading) return;
    setResendLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/auth/resend-otp', { token: pendingToken });
      setSuccess('A new code has been sent to your email.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();

      // Restart the countdown
      setCanResend(false);
      let remaining = RESEND_COOLDOWN;
      setCountdown(remaining);
      const timer = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
          setCanResend(true);
        }
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not resend OTP. Please try logging in again.';
      setError(msg);
    } finally {
      setResendLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const allFilled = digits.every(d => d !== '');

  return (
    <div className="otp-page">
      <div className="otp-card">

        {/* Icon */}
        <div className="otp-icon">✉️</div>

        <h1>Check your email</h1>
        <p className="otp-subtitle">
          We sent a 6-digit verification code to your email address.
        </p>
        <p className="otp-email">Enter the code below to continue.</p>

        {/* 6-box OTP input */}
        <div className="otp-inputs" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={el => inputRefs.current[index] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              className={`otp-box ${digit ? 'filled' : ''} ${error ? 'error-box' : ''}`}
              autoComplete="off"
            />
          ))}
        </div>

        {/* Error / success messages */}
        {error   && <div className="otp-error">{error}</div>}
        {success && <div className="otp-success">{success}</div>}

        {/* Submit button */}
        <button
          className="otp-submit-btn"
          onClick={handleSubmit}
          disabled={!allFilled || loading}
        >
          {loading ? (
            <><span className="spinner" />Verifying…</>
          ) : (
            'Verify Code'
          )}
        </button>

        {/* Timer and resend */}
        <div className="otp-footer">
          {!canResend && (
            <p className="otp-timer">
              Resend code in <span>{formatTime(countdown)}</span>
            </p>
          )}

          <button
            className="resend-btn"
            onClick={handleResend}
            disabled={!canResend || resendLoading}
          >
            {resendLoading ? 'Sending…' : 'Resend code'}
          </button>

          <button
            className="back-to-login"
            onClick={() => navigate('/login', { replace: true })}
          >
            ← Back to login
          </button>
        </div>

      </div>
    </div>
  );
}

export default OtpVerifyPage;
