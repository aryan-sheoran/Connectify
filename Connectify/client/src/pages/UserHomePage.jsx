import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/UserHomePage.css';

function UserHomePage() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'User';
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('username');
    navigate('/');
  };

  return (
    <div className="user-home-page">
      <div className="page-content">
      <nav className="user-navbar">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="navbar-sidebar-toggle">☰</button>
        <div className="user-navbar-content">
          <h1 className="user-logo">CONNECTIFY</h1>
          <div className="user-nav-right">
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </nav>
      <div className={`content-wrapper ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Sidebar />
        <main className="user-main">
        <div className="welcome-section">
          <h2 className="welcome-title">Welcome to Connectify, <span className="username-highlight">{username}</span></h2>
          <p className="welcome-subtitle">Connect, Chat, and Share Anonymously</p>
        </div>

        <section className="chat-rooms-section">
          <div className="section-header">
            <h3>Joined Chat Rooms</h3>
          </div>
          <div className="chat-rooms-grid">
            <div className="room-card-item">
              <div className="room-image-wrapper">
                <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem'}}>T</div>
                <span className="room-badge public">JOINED</span>
              </div>
              <div className="room-info">
                <h3 className="room-name">Tech Enthusiasts</h3>
                <p className="room-slogan">"Connect, Learn, and Innovate Together"</p>
                <p className="room-id">ID: <span>ROOM001</span></p>
                <p className="room-description">A community for tech enthusiasts to discuss latest technologies</p>
                <div className="room-footer">
                  <span className="members-info">👥 12 members online</span>
                  <button className="join-btn" onClick={() => navigate('/chat-room/1')}>Enter</button>
                </div>
              </div>
            </div>
            <div className="room-card-item">
              <div className="room-image-wrapper">
                <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem'}}>G</div>
                <span className="room-badge public">JOINED</span>
              </div>
              <div className="room-info">
                <h3 className="room-name">Gaming Zone</h3>
                <p className="room-slogan">"Game on!"</p>
                <p className="room-id">ID: <span>ROOM002</span></p>
                <p className="room-description">Discuss your favorite games and find gaming buddies</p>
                <div className="room-footer">
                  <span className="members-info">👥 8 members online</span>
                  <button className="join-btn" onClick={() => navigate('/chat-room/2')}>Enter</button>
                </div>
              </div>
            </div>
            <div className="room-card-item">
              <div className="room-image-wrapper">
                <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #764ba2 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem'}}>M</div>
                <span className="room-badge public">JOINED</span>
              </div>
              <div className="room-info">
                <h3 className="room-name">Music Lovers</h3>
                <p className="room-slogan">"Feel the beat"</p>
                <p className="room-id">ID: <span>ROOM003</span></p>
                <p className="room-description">Share your favorite music and discuss artists</p>
                <div className="room-footer">
                  <span className="members-info">👥 15 members online</span>
                  <button className="join-btn" onClick={() => navigate('/chat-room/3')}>Enter</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="worldwide-rooms-section">
          <div className="section-header">
            <h3>World Wide Chat Rooms</h3>
          </div>
          <div className="chat-rooms-grid">
            <div className="room-card-item">
              <div className="room-image-wrapper">
                <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem'}}>G</div>
                <span className="room-badge public">PUBLIC</span>
              </div>
              <div className="room-info">
                <h3 className="room-name">Global Chat</h3>
                <p className="room-slogan">"Connect with the world"</p>
                <p className="room-id">ID: <span>ROOM004</span></p>
                <p className="room-description">A worldwide community for general conversations</p>
                <div className="room-footer">
                  <span className="members-info">👥 256 members online</span>
                  <button className="join-btn" onClick={() => navigate('/chat-room/4')}>Join Room</button>
                </div>
              </div>
            </div>
            <div className="room-card-item">
              <div className="room-image-wrapper">
                <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem'}}>R</div>
                <span className="room-badge public">PUBLIC</span>
              </div>
              <div className="room-info">
                <h3 className="room-name">Random Talks</h3>
                <p className="room-slogan">"Anything goes"</p>
                <p className="room-id">ID: <span>ROOM005</span></p>
                <p className="room-description">A space for random discussions and conversations</p>
                <div className="room-footer">
                  <span className="members-info">👥 189 members online</span>
                  <button className="join-btn" onClick={() => navigate('/chat-room/5')}>Join Room</button>
                </div>
              </div>
            </div>
            <div className="room-card-item">
              <div className="room-image-wrapper">
                <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #764ba2 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem'}}>A</div>
                <span className="room-badge public">PUBLIC</span>
              </div>
              <div className="room-info">
                <h3 className="room-name">Art & Design</h3>
                <p className="room-slogan">"Create and inspire"</p>
                <p className="room-id">ID: <span>ROOM006</span></p>
                <p className="room-description">Share your artistic work and discuss design trends</p>
                <div className="room-footer">
                  <span className="members-info">👥 94 members online</span>
                  <button className="join-btn" onClick={() => navigate('/chat-room/6')}>Join Room</button>
                </div>
              </div>
            </div>
            <div className="room-card-item">
              <div className="room-image-wrapper">
                <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem'}}>S</div>
                <span className="room-badge public">PUBLIC</span>
              </div>
              <div className="room-info">
                <h3 className="room-name">Sports Discussion</h3>
                <p className="room-slogan">"Score big in conversations"</p>
                <p className="room-id">ID: <span>ROOM007</span></p>
                <p className="room-description">Discuss your favorite sports and teams</p>
                <div className="room-footer">
                  <span className="members-info">👥 156 members online</span>
                  <button className="join-btn" onClick={() => navigate('/chat-room/7')}>Join Room</button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      </div>

      <footer className="user-footer">
        <div className="quotes-container">
          <div className="quote">
            <p>"In anonymity, we find the freedom to be ourselves."</p>
          </div>
          <div className="quote">
            <p>"Real connections happen when people feel safe to share."</p>
          </div>
          <div className="quote">
            <p>"Anonymous chatting builds genuine friendships based on thoughts, not judgment."</p>
          </div>
        </div>
        <p className="footer-copyright">&copy; 2026 Connectify. All rights reserved.</p>
      </footer>
      </div>
    </div>
  );
}

export default UserHomePage;
