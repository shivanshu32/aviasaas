/**
 * Get Doctors API
 * 
 * Endpoint: GET /.netlify/functions/doctors-getDoctors
 * 
 * Query Parameters:
 *   - search: Search by name
 *   - specialization: Filter by specialization
 *   - isActive: Filter by active status
 * 
 * Response:
 *   { success: true, doctors: [...] }
 */

import { getDb, COLLECTIONS } from './utils/db.js';
import { success } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getDoctors(event) {
  const { search, specialization, isActive } = event.query;

  const db = await getDb();
  const filter = {};

  // Search filter
  if (search) {
    filter.name = { $regex: new RegExp(search, 'i') };
  }

  // Specialization filter
  if (specialization) {
    filter.specialization = specialization;
  }

  // Active status filter
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  } else {
    filter.isActive = true; // Default to active only
  }

  const doctors = await db.collection(COLLECTIONS.DOCTORS)
    .find(filter)
    .sort({ name: 1 })
    .toArray();

  return success({ doctors });
}

export const handler = withErrorHandler(getDoctors);
