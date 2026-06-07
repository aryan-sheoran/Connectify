import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/ProfilePage.css';

function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ownedChatRooms, setOwnedChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  const username = currentUser?.username || 'User';
  const email = currentUser?.email || 'email@example.com';
  const userImage = currentUser?.avatarUrl || null;

  useEffect(() => {
    const fetchMyRooms = async () => {
      try {
        // Fetch rooms where the current user is a member/owner
        // The backend `GET /users/me/rooms` returns all rooms the user has joined.
        // For owned rooms, we might need to filter by `created_by` or just show joined rooms.
        // Assuming backend returns an array of rooms
        const response = await api.get('/users/me/rooms');
        if (response.data.success) {
          // Filter if we only want to show rooms they own. 
          // The current DB schema has a created_by field.
          const myRooms = response.data.rooms.filter(room => room.createdBy === currentUser?.id);
          setOwnedChatRooms(myRooms);
        }
      } catch (error) {
        console.error("Failed to fetch user rooms:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchMyRooms();
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
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

              {loading ? (
                <p>Loading rooms...</p>
              ) : ownedChatRooms.length > 0 ? (
                <div className="chat-rooms-grid">
                  {ownedChatRooms.map((room) => (
                    <div key={room.id} className="room-card-item">
                      <div className="room-image-wrapper">
                        {room.imageUrl ? (
                           <img src={room.imageUrl} alt={room.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                        ) : (
                          <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white'}}>{room.name.charAt(0)}</div>
                        )}
                        <span className="room-badge public">OWNED</span>
                      </div>
                      <div className="room-info">
                        <h3 className="room-name">{room.name}</h3>
                        <p className="room-slogan">"{room.slogan || 'Your personal room'}"</p>
                        <p className="room-id">ID: <span>{room.id}</span></p>
                        <p className="room-description">{room.description}</p>
                        <div className="room-footer">
                          <span className="members-info">👥 {room.members || 0} members</span>
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
                <span className="stat-number">{ownedChatRooms.reduce((sum, room) => sum + (room.members || 0), 0)}</span>
                <span className="stat-label">Total Members in Your Rooms</span>
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
