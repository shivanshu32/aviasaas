/**
 * Deduct Stock API
 * Manual stock deduction/adjustment
 * 
 * Endpoint: POST /.netlify/functions/medicine-deductStock
 * 
 * Request Body:
 *   {
 *     medicineId: string (required),
 *     batchId: string (required),
 *     quantity: number (required, positive),
 *     reason: 'sale' | 'expired' | 'damaged' | 'adjustment' (required),
 *     remarks?: string
 *   }
 * 
 * Response:
 *   { success: true, message: string, stockBatch: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound, unprocessable } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { STOCK_STATUS, MOVEMENT_TYPE, MOVEMENT_SOURCE } from '../../shared/constants/enums.js';
import { logMedicineMovement } from './utils/medicineActivity.js';

async function deductStock(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.medicineId) return badRequest('Medicine ID is required');
  if (!data.batchId) return badRequest('Batch ID is required');
  if (!data.quantity || data.quantity <= 0) return badRequest('Valid quantity is required');
  if (!data.reason) return badRequest('Reason is required');

  const validReasons = ['sale', 'expired', 'damaged', 'adjustment'];
  if (!validReasons.includes(data.reason)) {
    return badRequest(`Reason must be one of: ${validReasons.join(', ')}`);
  }

  const db = await getDb();

  // Verify medicine exists
  const medicineQuery = ObjectId.isValid(data.medicineId)
    ? { _id: new ObjectId(data.medicineId) }
    : { medicineId: data.medicineId };

  const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(medicineQuery);
  if (!medicine) {
    return notFound('Medicine');
  }

  // Get stock batch
  const batchQuery = ObjectId.isValid(data.batchId)
    ? { _id: new ObjectId(data.batchId) }
    : { batchNo: data.batchId, medicineId: medicine._id };

  const stockBatch = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOne(batchQuery);
  if (!stockBatch) {
    return notFound('Stock batch');
  }

  // Check if sufficient stock
  if (stockBatch.currentQty < data.quantity) {
    return unprocessable('Insufficient stock', {
      available: stockBatch.currentQty,
      requested: data.quantity,
    });
  }

  // Calculate new quantity and status
  const newQty = stockBatch.currentQty - data.quantity;
  let newStatus = stockBatch.status;

  if (newQty === 0) {
    newStatus = STOCK_STATUS.EXHAUSTED;
  } else if (newQty <= medicine.reorderLevel) {
    newStatus = STOCK_STATUS.LOW;
  }

  // Update stock batch
  const now = new Date();
  const deductQty = Number(data.quantity);
  const updateResult = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOneAndUpdate(
    { _id: stockBatch._id },
    {
      $set: {
        currentQty: newQty,
        status: newStatus,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  await logMedicineMovement(db, {
    medicineId: medicine._id,
    batchId: stockBatch._id,
    batchNo: stockBatch.batchNo,
    type: MOVEMENT_TYPE.STOCK_DEDUCT,
    source: MOVEMENT_SOURCE.MANUAL,
    quantityDelta: -deductQty,
    previousQty: stockBatch.currentQty,
    newQty,
    reason: data.reason,
    remarks: data.remarks || null,
    referenceType: 'batch',
    referenceId: stockBatch._id,
    referenceLabel: stockBatch.batchNo,
    createdAt: now,
  });

  return success(
    { 
      stockBatch: updateResult,
      deducted: deductQty,
      previousQty: stockBatch.currentQty,
      newQty,
    },
    'Stock deducted successfully'
  );
}

export const handler = withErrorHandler(deductStock);
