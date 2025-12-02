/**
 * Get Medicine By ID API
 * 
 * Endpoint: GET /.netlify/functions/medicine-getMedicineById?id=xxx
 * 
 * Query Parameters:
 *   - id: Medicine ID or _id
 *   - includeStock: true to include stock batches
 * 
 * Response:
 *   { success: true, medicine: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { success, badRequest, notFound } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function getMedicineById(event) {
  const { id, includeStock = 'false' } = event.query;

  if (!id) {
    return badRequest('Medicine ID is required');
  }

  const db = await getDb();

  const query = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { medicineId: id };

  const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(query);

  if (!medicine) {
    return notFound('Medicine');
  }

  let response = { ...medicine };

  // Include stock batches if requested
  if (includeStock === 'true') {
    const stockBatches = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
      .find({
        medicineId: medicine._id,
        currentQty: { $gt: 0 },
        status: { $ne: 'exhausted' },
      })
      .sort({ expiryDate: 1 })
      .toArray();

    const totalStock = stockBatches.reduce((sum, batch) => sum + batch.currentQty, 0);

    response = {
      ...medicine,
      stockBatches,
      totalStock,
      isLowStock: totalStock <= medicine.reorderLevel,
    };
  }

  return success({ medicine: response });
}

export const handler = withErrorHandler(getMedicineById);
