/**
 * Update User API
 * 
 * Endpoint: PUT /.netlify/functions/users-updateUser
 * 
 * Request Body:
 *   {
 *     id: string (required),
 *     username?: string,
 *     password?: string (new password),
 *     name?: string,
 *     role?: string,
 *     email?: string,
 *     phone?: string,
 *     isActive?: boolean
 *   }
 * 
 * Response:
 *   { success: true, message: string, user: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound, conflict } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import crypto from 'crypto';

// Simple password hashing
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const VALID_ROLES = ['admin', 'receptionist', 'doctor', 'pharmacist', 'accountant'];

async function updateUser(event) {
  if (event.httpMethod !== 'PUT') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  if (!data.id) {
    return badRequest('User ID is required');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.USERS);

  // Find user
  const query = ObjectId.isValid(data.id)
    ? { _id: new ObjectId(data.id) }
    : { username: data.id };

  const user = await collection.findOne(query);
  if (!user) {
    return notFound('User');
  }

  // Build update object
  const updateFields = {
    updatedAt: new Date(),
  };

  // Update username if provided
  if (data.username && data.username !== user.username) {
    const existingUser = await collection.findOne({
      username: data.username.toLowerCase(),
      _id: { $ne: user._id },
    });
    if (existingUser) {
      return conflict('Username already exists');
    }
    updateFields.username = data.username.toLowerCase();
  }

  // Update password if provided
  if (data.password) {
    if (data.password.length < 6) {
      return badRequest('Password must be at least 6 characters');
    }
    updateFields.password = hashPassword(data.password);
  }

  // Update role if provided
  if (data.role) {
    if (!VALID_ROLES.includes(data.role)) {
      return badRequest(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }
    updateFields.role = data.role;
  }

  // Update other fields
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.email !== undefined) updateFields.email = data.email || null;
  if (data.phone !== undefined) updateFields.phone = data.phone || null;
  if (data.isActive !== undefined) updateFields.isActive = data.isActive;

  // Update user
  const result = await collection.findOneAndUpdate(
    { _id: user._id },
    { $set: updateFields },
    { returnDocument: 'after', projection: { password: 0 } }
  );

  return success(
    { user: result },
    'User updated successfully'
  );
}

export const handler = withErrorHandler(updateUser);
