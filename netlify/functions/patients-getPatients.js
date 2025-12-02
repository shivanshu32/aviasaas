/**
 * Get Patients API
 * 
 * Endpoint: GET /.netlify/functions/patients-getPatients
 * 
 * Query Parameters:
 *   - search: Search by name or phone (optional)
 *   - page: Page number, default 1
 *   - limit: Items per page, default 20, max 100
 *   - sortBy: Field to sort by, default 'createdAt'
 *   - sortOrder: 'asc' or 'desc', default 'desc'
 *   - isActive: Filter by active status (optional)
 * 
 * Response:
 *   {
 *     success: true,
 *     patients: [...],
 *     pagination: { total, page, limit, totalPages, hasNextPage, hasPrevPage }
 *   }
 */

import { getDb, COLLECTIONS } from './utils/db.js';
import { paginated, serverError } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

/**
 * Main handler function
 */
async function getPatients(event) {
  // Parse query parameters with defaults
  const {
    search = '',
    page = '1',
    limit = '20',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    isActive,
  } = event.query;

  // Convert and validate pagination params
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  // Build sort object
  const sort = {
    [sortBy]: sortOrder === 'asc' ? 1 : -1,
  };

  // Build filter query
  const filter = {};

  // Search filter (name or phone)
  if (search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { phone: searchRegex },
      { patientId: searchRegex },
    ];
  }

  // Active status filter
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  // Get database connection
  const db = await getDb();
  const collection = db.collection(COLLECTIONS.PATIENTS);

  // Execute queries in parallel
  const [patients, total] = await Promise.all([
    collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  // Return paginated response
  return paginated({
    data: patients,
    total,
    page: pageNum,
    limit: limitNum,
    dataKey: 'patients',
  });
}

// Export wrapped handler
export const handler = withErrorHandler(getPatients);
