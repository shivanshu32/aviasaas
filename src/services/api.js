import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available (future use)
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          // Validation error - don't show toast, let component handle it
          break;
        case 401:
          // Clear auth and redirect to login
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
          if (window.location.pathname !== '/login') {
            toast.error('Session expired. Please login again.');
            window.location.href = '/login';
          }
          break;
        case 403:
          toast.error('You do not have permission to perform this action.');
          break;
        case 404:
          // Let component handle not found
          break;
        case 409:
          toast.error(data.error || 'Resource already exists.');
          break;
        case 422:
          toast.error(data.error || 'Unable to process request.');
          break;
        case 500:
          toast.error('Server error. Please try again later.');
          break;
        default:
          toast.error('An unexpected error occurred.');
      }
      
      return Promise.reject(data);
    } else if (error.request) {
      // Request made but no response
      toast.error('Network error. Please check your connection.');
      return Promise.reject({ error: 'Network error' });
    } else {
      // Error in request setup
      toast.error('Request failed. Please try again.');
      return Promise.reject({ error: error.message });
    }
  }
);

export default api;
