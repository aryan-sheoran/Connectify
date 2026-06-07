import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/UserHomePage.css';

function UserHomePage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const username = currentUser?.username || 'User';

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        // Fetch joined rooms
        const joinedRes = await api.get('/users/me/rooms');
        if (joinedRes.data.success) {
          setJoinedRooms(joinedRes.data.rooms);
        }

        // Fetch public worldwide rooms
        const publicRes = await api.get('/rooms');
        if (publicRes.data.success) {
          setPublicRooms(publicRes.data.rooms);
        }
      } catch (error) {
        console.error('Failed to fetch rooms', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchRooms();
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading rooms...</div>
        ) : (
          <>
            <section className="chat-rooms-section">
              <div className="section-header">
                <h3>Joined Chat Rooms</h3>
              </div>
              {joinedRooms.length > 0 ? (
                <div className="chat-rooms-grid">
                  {joinedRooms.map(room => (
                    <div key={room.id} className="room-card-item">
                      <div className="room-image-wrapper">
                        {room.imageUrl ? (
                          <img src={room.imageUrl} alt={room.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                        ) : (
                          <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white'}}>{room.name.charAt(0).toUpperCase()}</div>
                        )}
                        <span className="room-badge public">JOINED</span>
                      </div>
                      <div className="room-info">
                        <h3 className="room-name">{room.name}</h3>
                        <p className="room-slogan">"{room.slogan || 'Connect and chat'}"</p>
                        <p className="room-id">ID: <span>{room.id}</span></p>
                        <p className="room-description">{room.description}</p>
                        <div className="room-footer">
                          <span className="members-info">👥 {room.members || 0} members</span>
                          <button className="join-btn" onClick={() => navigate(`/chat-room/${room.id}`)}>Enter</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>You haven't joined any rooms yet. Browse public rooms below!</p>
              )}
            </section>

            <section className="worldwide-rooms-section">
              <div className="section-header">
                <h3>World Wide Chat Rooms</h3>
              </div>
              <div className="chat-rooms-grid">
                {publicRooms.map(room => (
                  <div key={room.id} className="room-card-item">
                    <div className="room-image-wrapper">
                      {room.imageUrl ? (
                          <img src={room.imageUrl} alt={room.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                        ) : (
                          <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white'}}>{room.name.charAt(0).toUpperCase()}</div>
                        )}
                      <span className="room-badge public">PUBLIC</span>
                    </div>
                    <div className="room-info">
                      <h3 className="room-name">{room.name}</h3>
                      <p className="room-slogan">"{room.slogan || 'Connect with the world'}"</p>
                      <p className="room-id">ID: <span>{room.id}</span></p>
                      <p className="room-description">{room.description}</p>
                      <div className="room-footer">
                        <span className="members-info">👥 {room.members || 0} members</span>
                        <button className="join-btn" onClick={() => navigate(`/chat-room/${room.id}`)}>Join Room</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
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
