/**
 * Delete Medicine API (soft delete)
 *
 * Endpoint: DELETE /.netlify/functions/medicine-deleteMedicine?id=<_id|medicineId>
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { success, badRequest, notFound } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

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

  return success(
    {
      medicineId: medicine.medicineId,
      batchesRemoved: batchResult.deletedCount,
    },
    'Medicine removed from inventory',
  );
}

export const handler = withErrorHandler(deleteMedicine);
