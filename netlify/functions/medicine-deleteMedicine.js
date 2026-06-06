/**
 * Delete Medicine API (soft delete)
 *
 * Endpoint: DELETE /.netlify/functions/medicine-deleteMedicine?id=<_id|medicineId>
 *
 * - Sets medicines.isActive = false
 * - Removes all stock batches for this medicine
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { MOVEMENT_TYPE, MOVEMENT_SOURCE } from '../../shared/constants/enums.js';
import { logMedicineMovements } from './utils/medicineActivity.js';

async function deleteMedicine(event) {
  if (event.httpMethod !== 'DELETE') {
    return badRequest('Method not allowed');
  }

  const params = event.queryStringParameters || {};
  const body = event.parsedBody || {};
  const id = params.id || body.id;

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

  if (medicine.isActive === false) {
    return badRequest('Medicine is already removed from inventory');
  }

  const now = new Date();

  const batches = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
    .find({ medicineId: medicine._id })
    .toArray();

  await db.collection(COLLECTIONS.MEDICINES).updateOne(
    { _id: medicine._id },
    {
      $set: {
        isActive: false,
        deletedAt: now,
        updatedAt: now,
      },
    },
  );

  const batchResult = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).deleteMany({
    medicineId: medicine._id,
  });

  const deleteMovements = batches.map((batch) => ({
    medicineId: medicine._id,
    batchId: batch._id,
    batchNo: batch.batchNo,
    type: MOVEMENT_TYPE.MEDICINE_DELETE,
    source: MOVEMENT_SOURCE.MANUAL,
    quantityDelta: -(batch.currentQty || 0),
    previousQty: batch.currentQty || 0,
    newQty: 0,
    referenceType: 'medicine',
    referenceId: medicine._id,
    referenceLabel: medicine.medicineId,
    metadata: { medicineName: medicine.name },
    createdAt: now,
  }));

  if (deleteMovements.length > 0) {
    await logMedicineMovements(db, deleteMovements);
  }

  return success(
    {
      medicineId: medicine.medicineId,
      batchesRemoved: batchResult.deletedCount,
    },
    'Medicine removed from inventory',
  );
}

export const handler = withErrorHandler(deleteMedicine);
