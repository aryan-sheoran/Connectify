import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/ManageChatRoomPage.css';

function ManageChatRoomPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { currentUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [removingMember, setRemovingMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [roomData, setRoomData] = useState(null);
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    slogan: '',
    description: '',
  });

  const username = currentUser?.username || 'User';

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

  useEffect(() => {
    const fetchRoomAndMembers = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch room details
        const roomRes = await api.get(`/rooms/${roomId}`);
        if (!roomRes.data.success) {
          throw new Error('Failed to load room details');
        }
        
        const room = roomRes.data.room;
        setRoomData(room);
        setFormData({
          name: room.name || '',
          slogan: room.slogan || '',
          description: room.description || '',
        });

        // 2. Fetch members list
        const membersRes = await api.get(`/rooms/${roomId}/members`);
        if (membersRes.data.success) {
          setMembers(membersRes.data.members);
        }
      } catch (err) {
        console.error('Error fetching manage page data:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load data.');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser && roomId) {
      fetchRoomAndMembers();
    }
  }, [roomId, currentUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaveStatus('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveStatus('');
    try {
      const response = await api.put(`/rooms/${roomId}`, {
        name: formData.name,
        slogan: formData.slogan,
        description: formData.description,
      });
      if (response.data.success) {
        setRoomData((prev) => ({
          ...prev,
          name: formData.name,
          slogan: formData.slogan,
          description: formData.description,
        }));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save room details:', err);
      alert(err.response?.data?.message || 'Failed to save changes.');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member from the room?')) return;
    setRemovingMember(memberId);
    try {
      const response = await api.delete(`/rooms/${roomId}/members/${memberId}`);
      if (response.data.success) {
        // Animate out, then remove
        setTimeout(() => {
          setMembers((prev) => prev.filter((m) => m.id !== memberId));
          setRemovingMember(null);
        }, 400);
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
      alert(err.response?.data?.message || 'Failed to remove member.');
      setRemovingMember(null);
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this room? This action cannot be undone.')) return;
    try {
      const response = await api.delete(`/rooms/${roomId}`);
      if (response.data.success) {
        navigate('/user-home');
      }
    } catch (err) {
      console.error('Failed to delete room:', err);
      alert(err.response?.data?.message || 'Failed to delete room.');
    }
  };

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Loading...</div>;
  }

  if (error || !roomData) {
    return (
      <div style={{ color: 'red', textAlign: 'center', marginTop: '20vh' }}>
        Error: {error || 'Room not found'} <br /><br />
        <button onClick={() => navigate('/user-home')} className="back-home-btn">Go Home</button>
      </div>
    );
  }

  const isOwner = roomData.createdBy === currentUser?.id;

  // Only the owner can access this page
  if (!isOwner) {
    return (
      <div className="user-home-page">
        <div className="page-content">
          <nav className="user-navbar">
            <div className="user-navbar-content">
              <div className="navbar-left">
                <h1 className="user-logo">CONNECTIFY</h1>
              </div>
            </div>
          </nav>
          <div className="manage-access-denied">
            <div className="access-denied-icon">🔒</div>
            <h2>Access Denied</h2>
            <p>Only the room owner can manage this chat room.</p>
            <button className="back-home-btn" onClick={() => navigate('/user-home')}>Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-home-page">
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
            <div className="manage-room-container">
              {/* Header */}
              <div className="manage-room-header">
                <div className="manage-header-top">
                  <button className="manage-back-btn" onClick={() => navigate(`/chat-room/${roomId}`)}>← Back to Room</button>
                  <span className={`room-type-badge ${roomData.type === 'private' ? 'private' : 'public'}`}>
                    {roomData.type === 'private' ? '🔒 Private' : '🌐 Public'}
                  </span>
                </div>
                <h2 className="manage-room-title">Manage Chat Room</h2>
                <p className="manage-room-subtitle">Configure settings for <strong>{roomData.name}</strong></p>
              </div>

              {/* Settings Form */}
              <form className="manage-room-form" onSubmit={handleSave}>
                <div className="manage-section">
                  <div className="manage-section-header">
                    <span className="manage-section-icon">⚙️</span>
                    <h3>Room Settings</h3>
                  </div>

                  <div className="manage-form-group">
                    <label htmlFor="manage-name">Room Name</label>
                    <input
                      type="text"
                      id="manage-name"
                      name="name"
                      placeholder="Enter room name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="manage-form-group">
                    <label htmlFor="manage-slogan">Slogan / Tagline</label>
                    <input
                      type="text"
                      id="manage-slogan"
                      name="slogan"
                      placeholder="A catchy tagline for your room"
                      value={formData.slogan}
                      onChange={handleChange}
                      maxLength="100"
                    />
                    <span className="manage-char-count">{formData.slogan.length}/100</span>
                  </div>

                  <div className="manage-form-group">
                    <label htmlFor="manage-description">Description</label>
                    <textarea
                      id="manage-description"
                      name="description"
                      placeholder="Describe the purpose of this chat room"
                      value={formData.description}
                      onChange={handleChange}
                      rows="5"
                      required
                    />
                  </div>
                </div>

                {/* Room Info (read-only) */}
                <div className="manage-section">
                  <div className="manage-section-header">
                    <span className="manage-section-icon">📊</span>
                    <h3>Room Info</h3>
                  </div>
                  <div className="manage-info-grid">
                    <div className="manage-info-card">
                      <span className="info-label">Room ID</span>
                      <span className="info-value">{roomData.id}</span>
                    </div>
                    <div className="manage-info-card">
                      <span className="info-label">Creator Username</span>
                      <span className="info-value">{roomData.creatorUsername || 'You'}</span>
                    </div>
                    <div className="manage-info-card">
                      <span className="info-label">Members</span>
                      <span className="info-value">{members.length}</span>
                    </div>
                    <div className="manage-info-card">
                      <span className="info-label">Created</span>
                      <span className="info-value">{new Date(roomData.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="manage-form-actions">
                  <button type="button" className="manage-btn-cancel" onClick={() => navigate(`/chat-room/${roomId}`)}>
                    Cancel
                  </button>
                  <button type="submit" className={`manage-btn-save ${saveStatus === 'saved' ? 'saved' : ''}`}>
                    {saveStatus === 'saved' ? '✓ Saved' : 'Save Changes'}
                  </button>
                </div>
              </form>

              {/* Members Management */}
              <div className="manage-section manage-members-section">
                <div className="manage-section-header">
                  <span className="manage-section-icon">👥</span>
                  <h3>Members ({members.length})</h3>
                </div>
                <p className="manage-members-hint">Remove members from your chat room. This action cannot be undone.</p>

                <div className="manage-members-list">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className={`manage-member-row ${removingMember === member.id ? 'removing' : ''}`}
                    >
                      <div className="manage-member-left">
                        <div className="manage-member-avatar">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt={member.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            member.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="manage-member-info">
                          <span className="manage-member-name">{member.username}</span>
                          <span className="manage-member-joined">Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {member.id !== currentUser?.id && (
                        <button
                          className="manage-remove-btn"
                          onClick={() => handleRemoveMember(member.id)}
                          title={`Remove ${member.username}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}

                  {members.length === 0 && (
                    <div className="manage-no-members">
                      <p>No members to display.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="manage-section manage-danger-section">
                <div className="manage-section-header">
                  <span className="manage-section-icon">⚠️</span>
                  <h3>Danger Zone</h3>
                </div>
                <div className="manage-danger-actions">
                  <div className="manage-danger-item">
                    <div className="danger-item-info">
                      <h4>Delete Chat Room</h4>
                      <p>Permanently delete this room and all its messages. This action cannot be undone.</p>
                    </div>
                    <button className="manage-delete-btn" onClick={handleDeleteRoom}>
                      Delete Room
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default ManageChatRoomPage;
