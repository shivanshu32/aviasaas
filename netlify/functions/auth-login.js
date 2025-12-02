/**
 * Login API
 * 
 * Endpoint: POST /.netlify/functions/auth-login
 * 
 * Request Body:
 *   {
 *     username: string (required),
 *     password: string (required)
 *   }
 * 
 * Response:
 *   { success: true, user: Object, token: string }
 */

import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, unauthorized } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import crypto from 'crypto';

// Verify password against stored hash
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Generate a simple token (in production, use JWT)
function generateToken(userId) {
  const payload = {
    userId,
    timestamp: Date.now(),
    random: crypto.randomBytes(16).toString('hex'),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function login(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  if (!data.username) {
    return badRequest('Username is required');
  }

  if (!data.password) {
    return badRequest('Password is required');
  }

  const db = await getDb();
  
  // Find user by username
  const user = await db.collection(COLLECTIONS.USERS).findOne({
    username: data.username.toLowerCase(),
  });

  if (!user) {
    return unauthorized('Invalid username or password');
  }

  // Check if user is active
  if (!user.isActive) {
    return unauthorized('Your account has been deactivated. Please contact admin.');
  }

  // Verify password
  if (!verifyPassword(data.password, user.password)) {
    return unauthorized('Invalid username or password');
  }

  // Generate token
  const token = generateToken(user._id.toString());

  // Update last login
  await db.collection(COLLECTIONS.USERS).updateOne(
    { _id: user._id },
    { $set: { lastLogin: new Date() } }
  );

  // Return user without password
  const { password, ...userWithoutPassword } = user;

  return success({
    user: userWithoutPassword,
    token,
  }, 'Login successful');
}

export const handler = withErrorHandler(login);
