import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // Important for sending/receiving httpOnly cookies
});

// Response interceptor to handle 401 Token Expired errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401, code is TOKEN_EXPIRED, and we haven't already retried
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true; // Mark as retried to prevent infinite loops

      try {
        // Attempt to refresh the token using the refresh_token cookie
        await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        
        // If successful, retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token failed or expired, user needs to log in again
        // Could dispatch an event here or let the AuthContext catch the error
        // when the retried request (or subsequent requests) fail.
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
