import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/ProfilePage.css';

function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser, logout, checkAuth } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-open sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [ownedChatRooms, setOwnedChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profile editing states
  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

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

  const handleStartEdit = () => {
    setNewUsername(username);
    setIsEditing(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    const trimmedUsername = newUsername.trim();
    if (trimmedUsername === '') return;
    if (trimmedUsername === username) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await api.put('/users/me', { username: trimmedUsername });
      if (response.data.success) {
        await checkAuth(); // Refresh currentUser context
        setIsEditing(false);
        setSuccessMessage('Username updated successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error("Failed to update username:", err);
      // Express validator returns error array inside err.response.data.errors
      if (err.response?.data?.errors) {
        setError(err.response.data.errors[0]?.message || 'Invalid username format.');
      } else {
        setError(err.response?.data?.message || 'Failed to update username.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="page-content">
        <nav className="user-navbar">
          <div className="user-navbar-content">
            <div className="navbar-left">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="navbar-sidebar-toggle"
                aria-label="Toggle sidebar"
              >
                ☰
              </button>
              <h1 className="user-logo">CONNECTIFY</h1>
            </div>
            <div className="user-nav-right">
              <span className="user-greeting">Hey, {username}!</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          </div>
        </nav>
        <div className={`content-wrapper ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <Sidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
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
                {isEditing ? (
                  <form onSubmit={handleSaveUsername} className="edit-username-form">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => {
                        setNewUsername(e.target.value);
                        setError(null);
                      }}
                      className="edit-username-input"
                      placeholder="Choose username"
                      maxLength={50}
                      autoFocus
                      required
                    />
                    <div className="edit-username-actions">
                      <button type="submit" className="save-username-btn" disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" className="cancel-username-btn" onClick={handleCancelEdit} disabled={saving}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="profile-username-wrapper">
                    <h1 className="profile-username">{username}</h1>
                    <button onClick={handleStartEdit} className="edit-profile-btn" title="Edit Username">
                      ✏️
                    </button>
                  </div>
                )}
                {error && <div className="profile-alert error">{error}</div>}
                {successMessage && <div className="profile-alert success">{successMessage}</div>}
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
