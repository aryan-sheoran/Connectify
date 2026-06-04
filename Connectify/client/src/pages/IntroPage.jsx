import { useNavigate } from 'react-router-dom';
import '../styles/IntroPage.css';
import introBackground from '../assets/images/intro.jpg';
import intro1 from '../assets/images/image(intro1).jpg';
import intro2 from '../assets/images/image(intro2).jpg';
import intro3 from '../assets/images/image(intro3).jpg';
import intro4 from '../assets/images/intro2.jpg';

function IntroPage() {
  const navigate = useNavigate();

  return (
    <div className="intro-container">
      {/* Hero Section with Background Image */}
      <section className="hero-section" style={{ backgroundImage: `url(${introBackground})` }}>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">CONNECTIFY</h1>
          <p className="hero-tagline">Anonymous Chatting Site</p>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="about-content">
          <h2>About Connectify</h2>
          <div className="about-bullets">
            {/* First Bullet - Right */}
            <div className="bullet-item bullet-right">
              <div className="bullet-image">
                <img src={intro1} alt="Real-time Communication" />
              </div>
              <div className="bullet-text">
                <span className="bullet-title">Real-time Global Communication</span>
                <p>Connect instantly with millions of people around the world in real-time group chats</p>
              </div>
            </div>

            {/* Second Bullet - Left */}
            <div className="bullet-item bullet-left">
              <div className="bullet-text">
                <span className="bullet-title">Interest-based Communities</span>
                <p>Join or create communities based on your interests - from gaming and tech to music and hobbies</p>
              </div>
              <div className="bullet-image">
                <img src={intro2} alt="Interest-based Communities" />
              </div>
            </div>

            {/* Third Bullet - Right */}
            <div className="bullet-item bullet-right">
              <div className="bullet-image">
                <img src={intro3} alt="Anonymous & Safe" />
              </div>
              <div className="bullet-text">
                <span className="bullet-title">Anonymous & Safe</span>
                <p>Chat anonymously with privacy-first approach, control your presence, and connect freely without concerns</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Login & Signup Section */}
      <section className="auth-section">
        <div className="auth-content">
          <div className="auth-text">
            <h2>Join Connectify Today</h2>
            <p>Start connecting with people from around the globe</p>
            <div className="auth-buttons">
              <button className="btn btn-primary btn-large" onClick={() => navigate('/signup')}>
                Sign Up
              </button>
              <button className="btn btn-secondary btn-large" onClick={() => navigate('/login')}>
                Login
              </button>
            </div>
          </div>
          <div className="auth-image">
            <img src={intro4} alt="Join Community" />
          </div>
        </div>
      </section>
    </div>
  );
}

export default IntroPage;
