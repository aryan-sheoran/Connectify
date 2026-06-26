import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/FindChatRoomPage.css';

function FindChatRoomPage() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchId, setSearchId] = useState('');
  
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

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

  // Fetch all public rooms initially
  useEffect(() => {
    const fetchAllRooms = async () => {
      setLoading(true);
      try {
        const res = await api.get('/rooms');
        if (res.data.success) {
          setFilteredRooms(res.data.rooms);
        }
      } catch (error) {
        console.error('Failed to load initial rooms:', error);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };
    fetchAllRooms();
  }, []);

  const handleJoinRoom = (roomId) => {
    navigate(`/chat-room/${roomId}`);
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    
    // If search criteria is empty, just fetch all rooms
    if (!searchName.trim() && !searchId.trim()) {
      try {
        const res = await api.get('/rooms');
        if (res.data.success) {
          setFilteredRooms(res.data.rooms);
        }
      } catch (error) {
        console.error('Failed to load rooms:', error);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await api.get('/search/rooms', {
        params: { name: searchName.trim(), id: searchId.trim() }
      });
      if (res.data.success) {
        setFilteredRooms(res.data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

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
            <div className="find-room-container">
              <div className="find-room-header">
                <h2 className="find-room-title">Find Chat Rooms</h2>
                <p className="find-room-subtitle">Discover and join chat rooms that interest you</p>
              </div>

              {/* Search Section */}
              <form className="search-section" onSubmit={handleSearch}>
                <div className="search-fields">
                  <div className="search-field">
                    <label htmlFor="searchName">Room Name</label>
                    <input
                      type="text"
                      id="searchName"
                      placeholder="Search by room name..."
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                    />
                  </div>
                  <div className="search-field">
                    <label htmlFor="searchId">Room ID</label>
                    <input
                      type="text"
                      id="searchId"
                      placeholder="Search by room ID..."
                      value={searchId}
                      onChange={(e) => setSearchId(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="search-btn" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </form>

              {/* Results Count */}
              {!initialLoad && (
                <div className="results-info">
                  <p>Found <span className="count">{filteredRooms.length}</span> chat room(s)</p>
                  {(searchName || searchId) && (
                    <button 
                      className="clear-search" 
                      onClick={() => {
                        setSearchName('');
                        setSearchId('');
                        // Call search with empty fields to reset
                        setTimeout(() => handleSearch(), 0);
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {/* Chat Rooms Grid */}
              <div className="chat-rooms-grid">
                {loading && initialLoad ? (
                   <div style={{ textAlign: 'center', padding: '2rem', width: '100%' }}>Loading rooms...</div>
                ) : filteredRooms.length > 0 ? (
                  filteredRooms.map(room => (
                    <div key={room.id} className="room-card-item">
                      <div className="room-image-wrapper">
                        {room.imageUrl ? (
                           <img src={room.imageUrl} alt={room.name} className="room-image" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                        ) : (
                          <div style={{width: '100%', height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: 'white'}}>{room.name.charAt(0).toUpperCase()}</div>
                        )}
                        <span className={`room-badge ${room.type || 'public'}`}>{(room.type || 'public').toUpperCase()}</span>
                      </div>
                      <div className="room-info">
                        <h3 className="room-name">{room.name}</h3>
                        <p className="room-slogan">"{room.slogan || 'Connect and chat'}"</p>
                        <p className="room-id">ID: <span>{room.id}</span></p>
                        <p className="room-description">{room.description}</p>
                        <div className="room-footer">
                          <span className="members-info">
                            👥 {room.members || 0} member{(room.members !== 1) ? 's' : ''} online
                          </span>
                          <button 
                            className="join-btn"
                            onClick={() => handleJoinRoom(room.id)}
                          >
                            Join Room
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-results" style={{ width: '100%', gridColumn: '1 / -1' }}>
                    <div className="no-results-icon">🔍</div>
                    <h3>No rooms found</h3>
                    <p>Try adjusting your search criteria</p>
                    <button 
                      className="reset-btn"
                      onClick={() => {
                        setSearchName('');
                        setSearchId('');
                        setTimeout(() => handleSearch(), 0);
                      }}
                    >
                      View All Rooms
                    </button>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default FindChatRoomPage;
