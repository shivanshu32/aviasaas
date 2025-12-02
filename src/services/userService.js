/**
 * User Service
 * Handles all user-related API calls
 */

import api from './api';

export const userService = {
  /**
   * Get all users
   * @param {Object} params - Query parameters
   * @returns {Promise<{users: Array}>}
   */
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `/users/getUsers?${queryString}` : '/users/getUsers';
    return api.get(url);
  },

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<{user: Object}>}
   */
  create: async (userData) => {
    return api.post('/users/addUser', userData);
  },

  /**
   * Update a user
   * @param {string} id - User ID
   * @param {Object} userData - Updated user data
   * @returns {Promise<{user: Object}>}
   */
  update: async (id, userData) => {
    return api.put('/users/updateUser', { id, ...userData });
  },

  /**
   * Delete a user (soft delete)
   * @param {string} id - User ID
   * @returns {Promise<void>}
   */
  delete: async (id) => {
    return api.delete(`/users/deleteUser?id=${id}`);
  },
};

export default userService;
