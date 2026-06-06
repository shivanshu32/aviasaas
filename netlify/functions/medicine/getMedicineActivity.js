/**
 * Get Medicine Activity API
 * Paginated stock movement / activity log for a medicine
 *
 * Endpoint: GET /.netlify/functions/medicine-getMedicineActivity
 *
 * Query Parameters:
 *   - medicineId: required
 *   - type: optional movement type filter
 *   - batchId: optional batch filter
 *   - page, limit: pagination
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { paginated, badRequest, notFound } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function getMedicineActivity(event) {
  const {
    medicineId,
    type,
    batchId,
    page = '1',
    limit = '50',
  } = event.query;

  if (!medicineId) {
    return badRequest('Medicine ID is required');
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const db = await getDb();

  const medicineQuery = ObjectId.isValid(medicineId)
    ? { _id: new ObjectId(medicineId) }
    : { medicineId };

  const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(medicineQuery);
  if (!medicine) {
    return notFound('Medicine');
  }

  const filter = { medicineId: medicine._id };

  if (type) {
    filter.type = type;
  }

  if (batchId) {
    filter.batchId = ObjectId.isValid(batchId)
      ? new ObjectId(batchId)
      : batchId;
  }

  const [movements, total] = await Promise.all([
    db.collection(COLLECTIONS.MEDICINE_STOCK_MOVEMENTS)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray(),
    db.collection(COLLECTIONS.MEDICINE_STOCK_MOVEMENTS).countDocuments(filter),
  ]);

  return paginated({
    data: movements,
    total,
    page: pageNum,
    limit: limitNum,
    dataKey: 'movements',
  });
}

export const handler = withErrorHandler(getMedicineActivity);
