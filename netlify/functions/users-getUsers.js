/**
 * Get Users API
 * 
 * Endpoint: GET /.netlify/functions/users-getUsers
 * 
 * Query Parameters:
 *   - role: Filter by role
 *   - isActive: Filter by active status
 *   - search: Search by username or name
 * 
 * Response:
 *   { success: true, users: [...] }
 */

import { getDb, COLLECTIONS } from './utils/db.js';
import { success } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getUsers(event) {
  const { role, isActive, search } = event.query || {};

  const db = await getDb();
  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await db.collection(COLLECTIONS.USERS)
    .find(filter)
    .project({ password: 0 }) // Never return password
    .sort({ createdAt: -1 })
    .toArray();

  return success({ users });
}

export const handler = withErrorHandler(getUsers);
