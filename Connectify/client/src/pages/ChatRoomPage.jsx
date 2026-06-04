import { useNavigate, useParams } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import '../styles/ChatRoomPage.css';

function ChatRoomPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const username = localStorage.getItem('username') || 'User';
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState([
    { id: 1, user: 'Alex', message: 'Hey everyone! Welcome to Tech Enthusiasts', timestamp: '10:30 AM', isOwn: false },
    { id: 2, user: username, message: 'Thanks! Excited to be here', timestamp: '10:32 AM', isOwn: true },
    { id: 3, user: 'Jordan', message: 'This is a great community!', timestamp: '10:35 AM', isOwn: false },
    { id: 4, user: 'Sam', message: 'Looking forward to discussing new technologies', timestamp: '10:37 AM', isOwn: false },
  ]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef(null);

  // Mock room data - would come from backend/route params
  const roomData = {
    id: roomId || 1,
    name: 'Tech Enthusiasts',
    image: null,
    description: 'A community for tech enthusiasts to discuss latest technologies, programming, and digital innovation.',
    tagline: 'Connect, Learn, and Innovate Together',
    memberCount: 145,
    owner: 'TechGuru',
    createdDate: '2024-01-15',
    isPrivate: false, // Change to true for private rooms
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    navigate('/');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() === '') return;

    const newMessage = {
      id: messages.length + 1,
      user: username,
      message: messageInput,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
    };

    setMessages([...messages, newMessage]);
    setMessageInput('');
  };

  return (
    <div className="chat-room-page">
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
          <div className="chat-room-container">
        {/* Left Side - Room Details */}
        <aside className="room-details-panel">
          <button className="back-to-rooms-btn" onClick={() => navigate('/user-home')}>
            ← Back to Home
          </button>

          <div className="room-avatar-section">
            <div className="room-avatar">
              {roomData.image ? (
                <img src={roomData.image} alt={roomData.name} />
              ) : (
                <div className="avatar-placeholder">{roomData.name.charAt(0)}</div>
              )}
            </div>
          </div>

          <div className="room-info">
            <h1 className="room-name">{roomData.name}</h1>
            <p className="room-tagline">"{roomData.tagline}"</p>
            
            <div className="room-description">
              <h3>Description</h3>
              <p>{roomData.description}</p>
            </div>

            <div className="room-details-grid">
              <div className="detail-item">
                <span className="detail-label">Members</span>
                <span className="detail-value">{roomData.memberCount}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Owner</span>
                <span className="detail-value">{roomData.owner}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Created</span>
                <span className="detail-value">{new Date(roomData.createdDate).toLocaleDateString()}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Type</span>
                <span className="detail-value">{roomData.isPrivate ? 'Private' : 'Public'}</span>
              </div>
            </div>

            <div className="room-actions">
              <button className="action-btn secondary-btn">Leave Room</button>
            </div>

            {/* Active Members Preview - Only for Private Rooms */}
            {roomData.isPrivate && (
              <div className="room-members-preview">
                <h3>Active Members</h3>
                <div className="members-list">
                  <div className="member-item">
                    <div className="member-avatar">A</div>
                    <span className="member-name">Alex</span>
                    <div className="online-indicator"></div>
                  </div>
                  <div className="member-item">
                    <div className="member-avatar">J</div>
                    <span className="member-name">Jordan</span>
                    <div className="online-indicator"></div>
                  </div>
                  <div className="member-item">
                    <div className="member-avatar">S</div>
                    <span className="member-name">Sam</span>
                    <div className="online-indicator"></div>
                  </div>
                  <div className="member-item">
                    <div className="member-avatar">M</div>
                    <span className="member-name">Morgan</span>
                    <div className="online-indicator"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Side - Chat Section */}
        <section className="chat-panel">
          <div className="chat-header">
            <div className="chat-header-info">
              <h2 className="chat-room-title">{roomData.name}</h2>
              <span className="member-count">{roomData.memberCount} members online</span>
            </div>
            <button className="chat-options-btn">⋯</button>
          </div>

          <div className="messages-container">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.isOwn ? 'own-message' : 'other-message'}`}>
                <div className="message-avatar">
                  {!msg.isOwn && <span>{msg.user.charAt(0)}</span>}
                </div>
                <div className="message-content">
                  {!msg.isOwn && <span className="message-username">{msg.user}</span>}
                  <div className={`message-bubble ${msg.isOwn ? 'own-bubble' : 'other-bubble'}`}>
                    <p className="message-text">{msg.message}</p>
                  </div>
                  <span className="message-timestamp">{msg.timestamp}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="message-input-form" onSubmit={handleSendMessage}>
            <div className="input-wrapper">
              <input
                type="text"
                className="message-input"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
              <button type="submit" className="send-btn">
                📤
              </button>
            </div>
          </form>
        </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatRoomPage;
