/**
 * Add User API
 * 
 * Endpoint: POST /.netlify/functions/users-addUser
 * 
 * Request Body:
 *   {
 *     username: string (required),
 *     password: string (required),
 *     name: string (required),
 *     role: 'admin' | 'receptionist' | 'doctor' | 'pharmacist' (required),
 *     email?: string,
 *     phone?: string
 *   }
 * 
 * Response:
 *   { success: true, message: string, user: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, conflict } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import crypto from 'crypto';

// Simple password hashing (in production, use bcrypt)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

const VALID_ROLES = ['admin', 'receptionist', 'doctor', 'pharmacist', 'accountant'];

async function addUser(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.username) return badRequest('Username is required');
  if (!data.password) return badRequest('Password is required');
  if (!data.name) return badRequest('Name is required');
  if (!data.role) return badRequest('Role is required');
  
  if (!VALID_ROLES.includes(data.role)) {
    return badRequest(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  if (data.password.length < 6) {
    return badRequest('Password must be at least 6 characters');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.USERS);

  // Check for duplicate username
  const existingUser = await collection.findOne({
    username: data.username.toLowerCase(),
  });

  if (existingUser) {
    return conflict('Username already exists');
  }

  // Create user document
  const now = new Date();
  const user = {
    _id: new ObjectId(),
    username: data.username.toLowerCase(),
    password: hashPassword(data.password),
    name: data.name,
    role: data.role,
    email: data.email || null,
    phone: data.phone || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(user);

  // Return user without password
  const { password, ...userWithoutPassword } = user;

  return created(
    { user: userWithoutPassword },
    'User created successfully'
  );
}

export const handler = withErrorHandler(addUser);
