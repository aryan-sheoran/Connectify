import { useNavigate } from 'react-router-dom';
import '../styles/AuthPage.css';
import image from '../assets/images/signup.png';

function SignupPage() {
  const navigate = useNavigate();

  const handleGoogleSignup = () => {
    // Redirect to the backend Google OAuth endpoint
    window.location.href = 'http://localhost:5000/api/v1/auth/google';
  };

  return (
    <div className="auth-page">
      <button className="back-btn" onClick={() => navigate('/')}>&larr; Back</button>
      
      <div className="auth-wrapper reverse">
        <div className="auth-image-section">
          <div className="image-placeholder">
            <img src={image} alt="Sign up" />
          </div>
        </div>
        
        <div className="auth-container">
          <div className="auth-form" style={{ textAlign: 'center' }}>
            <h1>Create an Account</h1>
            <p className="auth-subtitle">Join Connectify and start connecting with others globally securely with Google.</p>

            <div style={{ marginTop: '2rem' }}>
              <button 
                onClick={handleGoogleSignup} 
                className="btn btn-primary btn-large"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
              >
                <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google logo" style={{ width: '20px' }} />
                Sign up with Google
              </button>
            </div>

            <div className="auth-footer" style={{ marginTop: '2rem' }}>
              <p>Already have an account? <button onClick={() => navigate('/login')} className="link-btn">Log in here</button></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
