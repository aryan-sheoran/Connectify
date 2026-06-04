import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AuthPage.css';
import image from '../assets/images/login.png';

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Store username in localStorage
    localStorage.setItem('username', username);
    // Redirect to user home page
    navigate('/user-home');
  };

  return (
    <div className="auth-page">
      <button className="back-btn" onClick={() => navigate('/')}>&larr; Back</button>
      
      <div className="auth-wrapper">
        <div className="auth-image-section">
          <div className="image-placeholder">
            <img src={image} alt="Login" />
          </div>
        </div>
        
        <div className="auth-container">
          <div className="auth-form">
            <h1>Login to Connectify</h1>
            <p className="auth-subtitle">Welcome back! Sign in to your account</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
