import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AuthPage.css';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add login logic here
    console.log('Login:', { email, password });
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <button className="back-btn" onClick={() => navigate('/')}>&larr; Back</button>
        
        <div className="auth-form">
          <h1>Login to Connectify</h1>
          <p className="auth-subtitle">Welcome back! Sign in to your account</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-large">
              Login
            </button>
          </form>

          <div className="auth-footer">
            <p>Don't have an account? <button onClick={() => navigate('/signup')} className="link-btn">Sign up here</button></p>
            <p><button className="link-btn">Forgot password?</button></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
