/**
 * Update Medicine API
 * 
 * Endpoint: PUT /.netlify/functions/medicine-updateMedicine
 * 
 * Request Body:
 *   {
 *     id: string (required),
 *     name?: string,
 *     genericName?: string,
 *     category?: string,
 *     manufacturer?: string,
 *     packSize?: number,
 *     packUnit?: string,
 *     reorderLevel?: number,
 *     gstRate?: number,
 *     hsnCode?: string,
 *     isActive?: boolean
 *   }
 * 
 * Response:
 *   { success: true, message: string, medicine: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function updateMedicine(event) {
  if (event.httpMethod !== 'PUT') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  if (!data.id) {
    return badRequest('Medicine ID is required');
  }

  const db = await getDb();

  // Find medicine
  const query = ObjectId.isValid(data.id)
    ? { _id: new ObjectId(data.id) }
    : { medicineId: data.id };

  const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(query);
  if (!medicine) {
    return notFound('Medicine');
  }

  // Build update object
  const updateFields = {
    updatedAt: new Date(),
  };

  const allowedFields = [
    'name', 'genericName', 'category', 'manufacturer',
    'packSize', 'packUnit', 'reorderLevel', 'gstRate',
    'hsnCode', 'isActive'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateFields[field] = data[field];
    }
  }

  // Update medicine
  const result = await db.collection(COLLECTIONS.MEDICINES).findOneAndUpdate(
    { _id: medicine._id },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  return success(
    { medicine: result },
    'Medicine updated successfully'
  );
}

export const handler = withErrorHandler(updateMedicine);
