/**
 * Delete User API
 * 
 * Endpoint: DELETE /.netlify/functions/users-deleteUser
 * 
 * Query Parameters:
 *   - id: User ID (required)
 * 
 * Response:
 *   { success: true, message: string }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function deleteUser(event) {
  if (event.httpMethod !== 'DELETE') {
    return badRequest('Method not allowed');
  }

  const { id } = event.query || {};

  if (!id) {
    return badRequest('User ID is required');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.USERS);

  // Find user
  const query = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { username: id };

  const user = await collection.findOne(query);
  if (!user) {
    return notFound('User');
  }

  // Soft delete - set isActive to false
  await collection.updateOne(
    { _id: user._id },
    { $set: { isActive: false, updatedAt: new Date() } }
  );

  return success(null, 'User deleted successfully');
}

export const handler = withErrorHandler(deleteUser);
