import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Sidebar.css';

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('username');
    navigate('/');
  };

  const handleNav = (path) => {
    navigate(path);
    onClose?.(); // Close sidebar on mobile after navigation
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Close button shown only on mobile */}
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          ✕
        </button>

        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            <li className="menu-item">
              <button
                className={`menu-btn ${location.pathname === '/user-home' ? 'active' : ''}`}
                onClick={() => handleNav('/user-home')}
              >
                <span className="menu-icon-dot"></span>
                <span className="menu-text">Home</span>
              </button>
            </li>
            <li className="menu-item">
              <button
                className={`menu-btn ${location.pathname === '/profile' ? 'active' : ''}`}
                onClick={() => handleNav('/profile')}
              >
                <span className="menu-icon-dot"></span>
                <span className="menu-text">Profile</span>
              </button>
            </li>
            <li className="menu-item">
              <button
                className={`menu-btn ${location.pathname === '/create-room' ? 'active' : ''}`}
                onClick={() => handleNav('/create-room')}
              >
                <span className="menu-icon-dot"></span>
                <span className="menu-text">Create Chat Room</span>
              </button>
            </li>
            <li className="menu-item">
              <button
                className={`menu-btn ${location.pathname === '/find-room' ? 'active' : ''}`}
                onClick={() => handleNav('/find-room')}
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
    </>
  );
}

export default Sidebar;
