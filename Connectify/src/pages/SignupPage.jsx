import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AuthPage.css';
import image from '../assets/images/signup.png';

function SignupPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    // Store username in localStorage
    localStorage.setItem('username', formData.username);
    // Redirect to user home page
    navigate('/user-home');
  };

  return (
    <div className="auth-page">
      <button className="back-btn" onClick={() => navigate('/')}>&larr; Back</button>
      
      <div className="auth-wrapper">
        <div className="auth-image-section">
          <div className="image-placeholder">
            <img src={image} alt="Signup" />
          </div>
        </div>
        
        <div className="auth-container">
          <div className="auth-form">
            <h1>Join Connectify</h1>
            <p className="auth-subtitle">Create your account and start connecting</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Choose a username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-large">
                Sign Up
              </button>
            </form>

            <div className="auth-footer">
              <p>Already have an account? <button onClick={() => navigate('/login')} className="link-btn">Login here</button></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
