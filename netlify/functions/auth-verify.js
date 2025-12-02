/**
 * Verify Token API
 * 
 * Endpoint: GET /.netlify/functions/auth-verify
 * 
 * Headers:
 *   Authorization: Bearer <token>
 * 
 * Response:
 *   { success: true, user: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, unauthorized } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

// Decode and verify token
function decodeToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    
    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - payload.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

async function verify(event) {
  // Get token from Authorization header
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorized('No token provided');
  }

  const token = authHeader.substring(7);
  const payload = decodeToken(token);

  if (!payload) {
    return unauthorized('Invalid or expired token');
  }

  const db = await getDb();
  
  // Find user
  const user = await db.collection(COLLECTIONS.USERS).findOne({
    _id: new ObjectId(payload.userId),
  });

  if (!user) {
    return unauthorized('User not found');
  }

  if (!user.isActive) {
    return unauthorized('Your account has been deactivated');
  }

  // Return user without password
  const { password, ...userWithoutPassword } = user;

  return success({ user: userWithoutPassword });
}

export const handler = withErrorHandler(verify);
