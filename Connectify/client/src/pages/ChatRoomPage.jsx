import { useNavigate, useParams } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/ChatRoomPage.css';

function ChatRoomPage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { currentUser, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-open sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 768);
      setDetailsPanelOpen(window.innerWidth > 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    const fetchRoomAndConnect = async () => {
      try {
        setLoading(true);

        try {
          await api.post(`/rooms/${roomId}/join`);
        } catch (joinErr) {
          if (joinErr.response?.status !== 409) throw joinErr;
        }

        const roomRes = await api.get(`/rooms/${roomId}`);
        if (roomRes.data.success && isMounted) setRoomData(roomRes.data.room);

        const msgRes = await api.get(`/rooms/${roomId}/messages?limit=50`);
        if (msgRes.data.success && isMounted) setMessages(msgRes.data.messages);

        const socket = io('/', { withCredentials: true, reconnection: true });
        socketRef.current = socket;

        socket.on('connect', () => {
          socket.emit('join_room', { roomId }, (response) => {
            if (!response?.success) console.error('Failed to join room via socket:', response?.message);
          });
        });

        socket.on('new_message', (message) => {
          if (isMounted) setMessages((prev) => [...prev, message]);
        });

        socket.on('message_deleted', ({ messageId }) => {
          if (isMounted) setMessages((prev) => prev.filter(msg => msg.id !== messageId));
        });

        socket.on('connect_error', (err) => console.error('Socket connect error:', err.message));

      } catch (err) {
        console.error('Failed to initialize room:', err);
        if (isMounted) setError(err.response?.data?.message || 'Failed to load room.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (currentUser && roomId) fetchRoomAndConnect();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.emit('leave_room', { roomId });
        socketRef.current.disconnect();
      }
    };
  }, [roomId, currentUser]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() === '' || !socketRef.current) return;
    socketRef.current.emit('send_message', { roomId, content: messageInput }, (response) => {
      if (!response?.success) console.error('Failed to send message:', response?.message);
    });
    setMessageInput('');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleLeaveRoom = async () => {
    try {
      await api.delete(`/rooms/${roomId}/leave`);
      navigate('/user-home');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to leave room');
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      navigate('/user-home');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete room');
    }
  };

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Loading...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', marginTop: '20vh' }}>Error: {error} <br /><br /><button onClick={() => navigate('/user-home')} className="btn btn-primary">Go Home</button></div>;
  if (!roomData) return null;

  const isOwner = roomData.createdBy === currentUser?.id;

  return (
    <div className="chat-room-page">
      <div className="page-content">
        <nav className="user-navbar">
          <div className="user-navbar-content">
            <div className="navbar-left">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="navbar-sidebar-toggle" aria-label="Toggle sidebar">☰</button>
              <h1 className="user-logo">CONNECTIFY</h1>
            </div>
            <div className="user-nav-right">
              {/* Mobile: toggle room details panel */}
              <button
                className="chat-details-toggle"
                onClick={() => setDetailsPanelOpen(!detailsPanelOpen)}
                aria-label="Toggle room details"
              >
                ℹ️
              </button>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          </div>
        </nav>

        <div className={`content-wrapper ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {/* Mobile details overlay backdrop */}
          {detailsPanelOpen && (
            <div className="details-overlay active" onClick={() => setDetailsPanelOpen(false)} />
          )}

          <div className={`chat-room-container ${detailsPanelOpen ? 'details-open' : 'details-closed'}`}>
            {/* Left Side - Room Details */}
            <aside className={`room-details-panel ${detailsPanelOpen ? 'panel-open' : ''}`}>
              <button className="back-to-rooms-btn" onClick={() => navigate('/user-home')}>
                ← Back to Home
              </button>

              <div className="room-avatar-section">
                <div className="room-avatar">
                  {roomData.imageUrl ? (
                    <img src={roomData.imageUrl} alt={roomData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="avatar-placeholder" style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white' }}>
                      {roomData.name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              <div className="room-info">
                <h1 className="room-name">{roomData.name}</h1>
                <p className="room-tagline">"{roomData.slogan || 'Connect and chat'}"</p>

                <div className="room-description">
                  <h3>Description</h3>
                  <p>{roomData.description}</p>
                </div>

                <div className="room-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Members</span>
                    <span className="detail-value">{roomData.members || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Owner</span>
                    <span className="detail-value">{roomData.creatorUsername || 'System'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Created</span>
                    <span className="detail-value">{new Date(roomData.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Type</span>
                    <span className="detail-value" style={{ textTransform: 'capitalize' }}>{roomData.type || 'public'}</span>
                  </div>
                </div>

                <div className="room-actions">
                  {isOwner ? (
                    <button className="action-btn secondary-btn" style={{ backgroundColor: '#e53e3e', color: 'white', borderColor: '#e53e3e' }} onClick={handleDeleteRoom}>Delete Room</button>
                  ) : (
                    <button className="action-btn secondary-btn" onClick={handleLeaveRoom}>Leave Room</button>
                  )}
                </div>
              </div>
            </aside>

            {/* Right Side - Chat */}
            <section className="chat-panel">
              <div className="chat-header">
                <div className="chat-header-info">
                  <h2 className="chat-room-title">{roomData.name}</h2>
                  <span className="member-count">{roomData.members || 0} members joined</span>
                </div>
                <button className="chat-options-btn">⋯</button>
              </div>

              <div className="messages-container">
                {messages.map((msg) => {
                  const isOwn = msg.senderId === currentUser?.id;
                  const timeString = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={msg.id} className={`message ${isOwn ? 'own-message' : 'other-message'}`}>
                      <div className="message-avatar">
                        {!isOwn && (
                          msg.senderAvatar
                            ? <img src={msg.senderAvatar} alt={msg.senderUsername} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                            : <span>{msg.senderUsername?.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="message-content">
                        {!isOwn && <span className="message-username">{msg.senderUsername}</span>}
                        <div className={`message-bubble ${isOwn ? 'own-bubble' : 'other-bubble'}`}>
                          <p className="message-text">{msg.content}</p>
                        </div>
                        <span className="message-timestamp">{timeString}</span>
                      </div>
                    </div>
                  );
                })}
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
                  <button type="submit" className="send-btn">📤</button>
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
