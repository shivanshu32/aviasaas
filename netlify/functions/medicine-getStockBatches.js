/**
 * Get Stock Batches API
 * List stock batches for a medicine
 * 
 * Endpoint: GET /.netlify/functions/medicine-getStockBatches
 * 
 * Query Parameters:
 *   - medicineId: Filter by medicine (required)
 *   - status: active | low | expired | exhausted
 *   - includeExhausted: true to include exhausted batches
 * 
 * Response:
 *   { success: true, batches: [...], totalStock: number }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getStockBatches(event) {
  const { medicineId, status, includeExhausted = 'false' } = event.query;

  if (!medicineId) {
    return badRequest('Medicine ID is required');
  }

  const db = await getDb();

  // Verify medicine exists
  const medicineQuery = ObjectId.isValid(medicineId)
    ? { _id: new ObjectId(medicineId) }
    : { medicineId: medicineId };

  const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(medicineQuery);
  if (!medicine) {
    return notFound('Medicine');
  }

  // Build filter
  const filter = { medicineId: medicine._id };

  if (status) {
    filter.status = status;
  } else if (includeExhausted !== 'true') {
    filter.status = { $ne: 'exhausted' };
  }

  const batches = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
    .find(filter)
    .sort({ expiryDate: 1 })
    .toArray();

  const totalStock = batches
    .filter(b => b.status !== 'exhausted')
    .reduce((sum, batch) => sum + batch.currentQty, 0);

  return success({
    medicine: {
      _id: medicine._id,
      medicineId: medicine.medicineId,
      name: medicine.name,
      reorderLevel: medicine.reorderLevel,
    },
    batches,
    totalStock,
    batchCount: batches.length,
    isLowStock: totalStock <= medicine.reorderLevel,
  });
}

export const handler = withErrorHandler(getStockBatches);
