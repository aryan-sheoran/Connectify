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
          <div className="rooms-container">
            <div className="room-card">
              <h4>Tech Enthusiasts</h4>
              <p>12 members online</p>
              <button className="enter-btn">Enter</button>
            </div>
            <div className="room-card">
              <h4>Gaming Zone</h4>
              <p>8 members online</p>
              <button className="enter-btn">Enter</button>
            </div>
            <div className="room-card">
              <h4>Music Lovers</h4>
              <p>15 members online</p>
              <button className="enter-btn">Enter</button>
            </div>
          </div>
        </section>

        <section className="worldwide-rooms-section">
          <div className="section-header">
            <h3>World Wide Chat Rooms</h3>
          </div>
          <div className="rooms-container">
            <div className="room-card public-room">
              <h4>Global Chat</h4>
              <p>256 members online</p>
              <button className="join-btn">Join Room</button>
            </div>
            <div className="room-card public-room">
              <h4>Random Talks</h4>
              <p>189 members online</p>
              <button className="join-btn">Join Room</button>
            </div>
            <div className="room-card public-room">
              <h4>Art & Design</h4>
              <p>94 members online</p>
              <button className="join-btn">Join Room</button>
            </div>
            <div className="room-card public-room">
              <h4>Sports Discussion</h4>
              <p>156 members online</p>
              <button className="join-btn">Join Room</button>
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
