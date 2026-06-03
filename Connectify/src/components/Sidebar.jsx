import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('username');
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          <li className="menu-item">
            <button 
              className={`menu-btn ${location.pathname === '/user-home' ? 'active' : ''}`} 
              onClick={() => navigate('/user-home')}
            >
              <span className="menu-icon-dot"></span>
              <span className="menu-text">Home</span>
            </button>
          </li>
          <li className="menu-item">
            <button 
              className={`menu-btn ${location.pathname === '/profile' ? 'active' : ''}`}
              onClick={() => navigate('/profile')}
            >
              <span className="menu-icon-dot"></span>
              <span className="menu-text">Profile</span>
            </button>
          </li>
          <li className="menu-item">
            <button 
              className={`menu-btn ${location.pathname === '/create-room' ? 'active' : ''}`}
              onClick={() => navigate('/create-room')}
            >
              <span className="menu-icon-dot"></span>
              <span className="menu-text">Create Chat Room</span>
            </button>
          </li>
          <li className="menu-item">
            <button 
              className={`menu-btn ${location.pathname === '/find-room' ? 'active' : ''}`}
              onClick={() => navigate('/find-room')}
            >
              <span className="menu-icon-dot"></span>
              <span className="menu-text">Find Chat Room</span>
            </button>
          </li>
          <li className="menu-item logout-item">
            <button className="menu-btn logout-menu-btn" onClick={handleLogout}>
              <span className="menu-icon-dot"></span>
              <span className="menu-text">Logout</span>
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
