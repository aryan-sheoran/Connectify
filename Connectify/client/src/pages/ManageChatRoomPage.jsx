import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import '../styles/ManageChatRoomPage.css';

function ManageChatRoomPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { currentUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [removingMember, setRemovingMember] = useState(null);

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

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Mock room data — in production this would come from the backend
  const [roomData, setRoomData] = useState({
    id: roomId || '1',
    name: 'Tech Enthusiasts',
    title: 'Welcome to Tech Enthusiasts',
    description: 'A community for tech enthusiasts to discuss latest technologies, programming, and digital innovation.',
    slogan: 'Connect, Learn, and Innovate Together',
    isPrivate: true,
    owner: username,
    memberCount: 145,
    createdDate: '2024-01-15',
  });

  // Mock members list for private rooms
  const [members, setMembers] = useState([
    { id: 1, name: 'Alex', joinedDate: '2024-02-01', status: 'online' },
    { id: 2, name: 'Jordan', joinedDate: '2024-02-05', status: 'online' },
    { id: 3, name: 'Sam', joinedDate: '2024-03-10', status: 'offline' },
    { id: 4, name: 'Morgan', joinedDate: '2024-03-15', status: 'online' },
    { id: 5, name: 'Taylor', joinedDate: '2024-04-01', status: 'offline' },
    { id: 6, name: 'Casey', joinedDate: '2024-04-20', status: 'online' },
  ]);



  const handleChange = (e) => {
    const { name, value } = e.target;
    setRoomData((prev) => ({ ...prev, [name]: value }));
    setSaveStatus('');
  };

  const handleSave = (e) => {
    e.preventDefault();
    // In production, send updated roomData to backend
    console.log('Saving room data:', roomData);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleRemoveMember = (memberId) => {
    setRemovingMember(memberId);
    // Animate out, then remove
    setTimeout(() => {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setRemovingMember(null);
    }, 400);
  };

  // Only the owner can access this page
  if (roomData.owner !== username) {
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
                  <span className={`room-type-badge ${roomData.isPrivate ? 'private' : 'public'}`}>
                    {roomData.isPrivate ? '🔒 Private' : '🌐 Public'}
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
                      value={roomData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="manage-form-group">
                    <label htmlFor="manage-title">Room Title</label>
                    <input
                      type="text"
                      id="manage-title"
                      name="title"
                      placeholder="Enter a display title for the room"
                      value={roomData.title}
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
                      value={roomData.slogan}
                      onChange={handleChange}
                      maxLength="100"
                    />
                    <span className="manage-char-count">{roomData.slogan.length}/100</span>
                  </div>

                  <div className="manage-form-group">
                    <label htmlFor="manage-description">Description</label>
                    <textarea
                      id="manage-description"
                      name="description"
                      placeholder="Describe the purpose of this chat room"
                      value={roomData.description}
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
                      <span className="info-label">Owner</span>
                      <span className="info-value">{roomData.owner}</span>
                    </div>
                    <div className="manage-info-card">
                      <span className="info-label">Members</span>
                      <span className="info-value">{roomData.isPrivate ? members.length : roomData.memberCount}</span>
                    </div>
                    <div className="manage-info-card">
                      <span className="info-label">Created</span>
                      <span className="info-value">{new Date(roomData.createdDate).toLocaleDateString()}</span>
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

              {/* Members Management — Private rooms only */}
              {roomData.isPrivate && (
                <div className="manage-section manage-members-section">
                  <div className="manage-section-header">
                    <span className="manage-section-icon">👥</span>
                    <h3>Members ({members.length})</h3>
                  </div>
                  <p className="manage-members-hint">Remove members from your private chat room. This action cannot be undone.</p>

                  <div className="manage-members-list">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className={`manage-member-row ${removingMember === member.id ? 'removing' : ''}`}
                      >
                        <div className="manage-member-left">
                          <div className="manage-member-avatar">
                            {member.name.charAt(0)}
                            <span className={`manage-status-dot ${member.status}`}></span>
                          </div>
                          <div className="manage-member-info">
                            <span className="manage-member-name">{member.name}</span>
                            <span className="manage-member-joined">Joined {new Date(member.joinedDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <button
                          className="manage-remove-btn"
                          onClick={() => handleRemoveMember(member.id)}
                          title={`Remove ${member.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}

                    {members.length === 0 && (
                      <div className="manage-no-members">
                        <p>No members to display.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                    <button className="manage-delete-btn" onClick={() => alert('Delete room — would trigger confirmation in production')}>
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
