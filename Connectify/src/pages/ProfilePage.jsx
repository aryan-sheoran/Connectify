import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/ProfilePage.css';

function ProfilePage() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'User';
  const email = localStorage.getItem('email') || 'email@example.com';
  const userImage = localStorage.getItem('userImage') || null;
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Mock data for owned chat rooms - in production this would come from a backend
  const ownedChatRooms = [
    { id: 1, name: 'Tech Enthusiasts', memberCount: 12, createdDate: '2024-01-15' },
    { id: 2, name: 'Gaming Zone', memberCount: 8, createdDate: '2024-02-20' },
    { id: 3, name: 'Design Discussions', memberCount: 5, createdDate: '2024-03-10' }
  ];

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('email');
    localStorage.removeItem('userImage');
    navigate('/');
  };

  return (
    <div className="profile-page">
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
            {/* Profile Header Section */}
            <div className="profile-header">
              <div className="profile-avatar-container">
                <div className="profile-avatar">
                  {userImage ? (
                    <img src={userImage} alt={username} />
                  ) : (
                    <div className="avatar-placeholder">{username.charAt(0).toUpperCase()}</div>
                  )}
                </div>
              </div>
              
              <div className="profile-info">
                <h1 className="profile-username">{username}</h1>
                <div className="profile-detail">
                  <span className="detail-icon">✉️</span>
                  <span className="detail-text">{email}</span>
                </div>
              </div>
            </div>

            {/* Owned Chat Rooms Section */}
            <section className="owned-rooms-section">
              <div className="section-header">
                <h2>Owned Chat Rooms</h2>
                <span className="room-count">{ownedChatRooms.length}</span>
              </div>

              {ownedChatRooms.length > 0 ? (
                <div className="chat-rooms-grid">
                  {ownedChatRooms.map((room) => (
                    <div key={room.id} className="room-card-item">
                      <div className="room-image-wrapper">
                        <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white'}}>{room.name.charAt(0)}</div>
                        <span className="room-badge public">OWNED</span>
                      </div>
                      <div className="room-info">
                        <h3 className="room-name">{room.name}</h3>
                        <p className="room-slogan">"Your personal room"</p>
                        <p className="room-id">ID: <span>ROOM{String(room.id).padStart(3, '0')}</span></p>
                        <p className="room-description">A chat room you manage and created</p>
                        <div className="room-footer">
                          <span className="members-info">👥 {room.memberCount} members</span>
                          <div style={{display: 'flex', gap: '0.5rem'}}>
                            <button className="enter-room-btn" onClick={() => navigate(`/chat-room/${room.id}`)}>Enter</button>
                            <button className="manage-btn" onClick={() => navigate(`/manage-room/${room.id}`)}>Manage</button>
                            <button className="delete-btn">Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-rooms-message">
                  <p>You haven't created any chat rooms yet.</p>
                  <button 
                    className="create-room-link"
                    onClick={() => navigate('/create-room')}
                  >
                    Create your first chat room
                  </button>
                </div>
              )}
            </section>

            {/* Profile Stats Section */}
            <section className="profile-stats">
              <div className="stat-card">
                <span className="stat-number">{ownedChatRooms.length}</span>
                <span className="stat-label">Chat Rooms Created</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{ownedChatRooms.reduce((sum, room) => sum + room.memberCount, 0)}</span>
                <span className="stat-label">Total Members</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">Level 5</span>
                <span className="stat-label">User Status</span>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
