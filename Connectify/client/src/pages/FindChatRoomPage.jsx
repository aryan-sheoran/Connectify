import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import '../styles/FindChatRoomPage.css';

function FindChatRoomPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [searchId, setSearchId] = useState('');

  // Mock data - In a real app, this would come from your backend
  const allChatRooms = [
    {
      id: 'ROOM001',
      name: 'Tech Enthusiasts',
      slogan: 'For tech lovers',
      description: 'A room dedicated to technology discussions, coding, and innovation.',
      image: 'https://via.placeholder.com/300x200?text=Tech+Enthusiasts',
      type: 'public',
      members: 45,
      maxMembers: null,
    },
    {
      id: 'ROOM002',
      name: 'Gaming Zone',
      slogan: 'Game on!',
      description: 'Discuss your favorite games, share tips, and find gaming buddies.',
      image: 'https://via.placeholder.com/300x200?text=Gaming+Zone',
      type: 'public',
      members: 32,
      maxMembers: null,
    },
    {
      id: 'ROOM003',
      name: 'Music Lovers',
      slogan: 'Feel the beat',
      description: 'Share your favorite music, playlists, and discuss artists.',
      image: 'https://via.placeholder.com/300x200?text=Music+Lovers',
      type: 'public',
      members: 28,
      maxMembers: null,
    },
    {
      id: 'ROOM004',
      name: 'Global Chat',
      slogan: 'Connect with the world',
      description: 'A worldwide community for general conversations and making friends.',
      image: 'https://via.placeholder.com/300x200?text=Global+Chat',
      type: 'public',
      members: 156,
      maxMembers: null,
    },
    {
      id: 'ROOM005',
      name: 'Random Talks',
      slogan: 'Anything goes',
      description: 'A space for random discussions and unexpected conversations.',
      image: 'https://via.placeholder.com/300x200?text=Random+Talks',
      type: 'public',
      members: 89,
      maxMembers: null,
    },
    {
      id: 'ROOM006',
      name: 'Art & Design',
      slogan: 'Create and inspire',
      description: 'Share your artistic work, get feedback, and discuss design trends.',
      image: 'https://via.placeholder.com/300x200?text=Art+and+Design',
      type: 'public',
      members: 34,
      maxMembers: null,
    },
  ];

  // Filter chat rooms based on search criteria
  const filteredRooms = allChatRooms.filter(room => {
    const nameMatch = room.name.toLowerCase().includes(searchName.toLowerCase());
    const idMatch = room.id.toLowerCase().includes(searchId.toLowerCase());
    
    // If both fields are empty, show all rooms
    if (!searchName && !searchId) return true;
    
    // If one field is filled, match that field
    if (searchName && !searchId) return nameMatch;
    if (!searchName && searchId) return idMatch;
    
    // If both fields are filled, both must match
    return nameMatch && idMatch;
  });

  const handleJoinRoom = (roomId) => {
    navigate(`/chat-room/${roomId}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Search is already handled by the filter above
  };

  return (
    <div className="user-home-page">
      <div className="page-content">
        <nav className="user-navbar">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="navbar-sidebar-toggle">☰</button>
          <div className="user-navbar-content">
            <h1 className="user-logo">CONNECTIFY</h1>
            <div className="user-nav-right">
              <button onClick={() => navigate('/')} className="logout-btn">Logout</button>
            </div>
          </div>
        </nav>
        <div className={`content-wrapper ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <Sidebar />
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
                  <button type="submit" className="search-btn">Search</button>
                </div>
              </form>

              {/* Results Count */}
              <div className="results-info">
                <p>Found <span className="count">{filteredRooms.length}</span> chat room(s)</p>
                {(searchName || searchId) && (
                  <button 
                    className="clear-search" 
                    onClick={() => {
                      setSearchName('');
                      setSearchId('');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>

              {/* Chat Rooms Grid */}
              <div className="chat-rooms-grid">
                {filteredRooms.length > 0 ? (
                  filteredRooms.map(room => (
                    <div key={room.id} className="room-card-item">
                      <div className="room-image-wrapper">
                        <img src={room.image} alt={room.name} className="room-image" />
                        <span className={`room-badge ${room.type}`}>{room.type.toUpperCase()}</span>
                      </div>
                      <div className="room-info">
                        <h3 className="room-name">{room.name}</h3>
                        <p className="room-slogan">"{room.slogan}"</p>
                        <p className="room-id">ID: <span>{room.id}</span></p>
                        <p className="room-description">{room.description}</p>
                        <div className="room-footer">
                          <span className="members-info">
                            👥 {room.members} member{room.members !== 1 ? 's' : ''} online
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
                  <div className="no-results">
                    <div className="no-results-icon">🔍</div>
                    <h3>No rooms found</h3>
                    <p>Try adjusting your search criteria</p>
                    <button 
                      className="reset-btn"
                      onClick={() => {
                        setSearchName('');
                        setSearchId('');
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
