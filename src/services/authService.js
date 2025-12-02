/**
 * Auth Service
 * Handles authentication API calls
 */

import api from './api';

const TOKEN_KEY = 'authToken';
const USER_KEY = 'authUser';

export const authService = {
  /**
   * Login user
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<{user: Object, token: string}>}
   */
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    
    if (response.token) {
      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    }
    
    return response;
  },

  /**
   * Logout user
   */
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Verify current token
   * @returns {Promise<{user: Object}>}
   */
  verify: async () => {
    return api.get('/auth/verify');
  },

  /**
   * Get stored token
   * @returns {string|null}
   */
  getToken: () => {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Get stored user
   * @returns {Object|null}
   */
  getUser: () => {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  /**
   * Check if user is logged in
   * @returns {boolean}
   */
  isAuthenticated: () => {
    return !!localStorage.getItem(TOKEN_KEY);
  },
};

export default authService;
