import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api';
import '../styles/CreateChatRoomPage.css';

function CreateChatRoomPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    roomName: '',
    description: '',
    slogan: '',
    isPrivate: false,
    image: null,
    imagePreview: null,
    maxMembers: '50',
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prevState => ({
          ...prevState,
          image: file,
          imagePreview: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create FormData object to handle image upload
      const data = new FormData();
      data.append('roomName', formData.roomName);
      data.append('description', formData.description);
      if (formData.slogan) data.append('slogan', formData.slogan);
      data.append('isPrivate', formData.isPrivate);
      if (formData.isPrivate) data.append('maxMembers', formData.maxMembers);
      
      // The backend expects the file field to be named 'image'
      if (formData.image) {
        data.append('image', formData.image);
      }

      // Ensure proper headers for multipart/form-data
      const response = await api.post('/rooms', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        // Redirect to the newly created room
        navigate(`/chat-room/${response.data.room.id}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      setError(err.response?.data?.message || 'Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
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
            <div className="create-room-container">
              <div className="create-room-header">
                <h2 className="create-room-title">Create a Chat Room</h2>
                <p className="create-room-subtitle">Set up a new chat room and start connecting with others</p>
              </div>

              {error && <div className="error-message" style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

              <form className="create-room-form" onSubmit={handleSubmit}>
                {/* Room Name */}
                <div className="form-group">
                  <label htmlFor="roomName">Room Name *</label>
                  <input
                    type="text"
                    id="roomName"
                    name="roomName"
                    placeholder="Enter chat room name"
                    value={formData.roomName}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* Slogan */}
                <div className="form-group">
                  <label htmlFor="slogan">Slogan / Tagline</label>
                  <input
                    type="text"
                    id="slogan"
                    name="slogan"
                    placeholder="Add a catchy slogan for your room"
                    value={formData.slogan}
                    onChange={handleChange}
                    maxLength="100"
                  />
                  <span className="char-count">{formData.slogan.length}/100</span>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label htmlFor="description">Description *</label>
                  <textarea
                    id="description"
                    name="description"
                    placeholder="Describe the purpose of this chat room"
                    value={formData.description}
                    onChange={handleChange}
                    rows="5"
                    required
                  />
                </div>

                {/* Room Type */}
                <div className="form-group room-type-group">
                  <label>Room Type *</label>
                  <div className="room-type-options">
                    <div className="radio-option">
                      <label>
                        <input
                          type="radio"
                          name="isPrivate"
                          checked={!formData.isPrivate}
                          onChange={() => setFormData(prev => ({ ...prev, isPrivate: false }))}
                        />
                        <span>Public Room</span>
                      </label>
                      <p className="option-hint">Anyone can join and see the chat</p>
                    </div>
                    <div className="radio-option">
                      <label>
                        <input
                          type="radio"
                          name="isPrivate"
                          checked={formData.isPrivate}
                          onChange={() => setFormData(prev => ({ ...prev, isPrivate: true }))}
                        />
                        <span>Private Room</span>
                      </label>
                      <p className="option-hint">Members can only join with invitation</p>
                    </div>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="form-group">
                  <label htmlFor="image">Room Image *</label>
                  <div className="image-upload-section">
                    <div className="image-preview">
                      {formData.imagePreview ? (
                        <img src={formData.imagePreview} alt="Room preview" className="preview-img" />
                      ) : (
                        <div className="preview-placeholder">
                          <span>📷</span>
                          <p>No image selected</p>
                        </div>
                      )}
                    </div>
                    <div className="image-upload-input">
                      <input
                        type="file"
                        id="image"
                        name="image"
                        accept="image/*"
                        onChange={handleImageChange}
                        required
                      />
                      <label htmlFor="image" className="upload-label">Choose Image</label>
                      <p className="upload-hint">JPG, PNG or GIF (Max 5MB)</p>
                    </div>
                  </div>
                </div>

                {/* Max Members - Only for Private Rooms */}
                {formData.isPrivate && (
                  <div className="form-group">
                    <label htmlFor="maxMembers">Maximum Members *</label>
                    <input
                      type="number"
                      id="maxMembers"
                      name="maxMembers"
                      min="2"
                      max="500"
                      value={formData.maxMembers}
                      onChange={handleChange}
                      required
                    />
                    <span className="field-hint">Set the maximum number of members allowed</span>
                  </div>
                )}

                {/* Form Actions */}
                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={() => navigate('/user-home')} disabled={loading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-create" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Chat Room'}
                  </button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default CreateChatRoomPage;
