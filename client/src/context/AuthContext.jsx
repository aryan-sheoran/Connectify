import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser,      setCurrentUser]      = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [isAuthenticated,  setIsAuthenticated]  = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setCurrentUser(response.data.user);
        setIsAuthenticated(true);
        setProfileCompleted(response.data.user.profileCompleted ?? true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setProfileCompleted(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error.response?.data || error.message);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setProfileCompleted(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setCurrentUser(null);
      setIsAuthenticated(false);
      setProfileCompleted(false);
    } catch (error) {
      console.error('Logout failed:', error.response?.data || error.message);
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    profileCompleted,
    loading,
    checkAuth,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
