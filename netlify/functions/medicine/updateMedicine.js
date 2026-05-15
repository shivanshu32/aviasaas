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
<<<<<<< HEAD
=======
 *     composition?: string,
 *     strength?: string,
 *     rackLocation?: string,
 *     isScheduled?: boolean,
 *     scheduleType?: string,
 *     purchasePrice?: number | null,
 *     sellingPrice?: number | null,
>>>>>>> ddeaf7c (sve)
 *     isActive?: boolean
 *   }
 * 
 * Response:
 *   { success: true, message: string, medicine: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { success, badRequest, notFound } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

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
<<<<<<< HEAD
    'packSize', 'packUnit', 'reorderLevel', 'gstRate',
    'hsnCode', 'isActive'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateFields[field] = data[field];
    }
=======
    'composition', 'strength', 'rackLocation',
    'packSize', 'packUnit', 'reorderLevel', 'gstRate',
    'hsnCode', 'isScheduled', 'scheduleType',
    'purchasePrice', 'sellingPrice',
    'isActive',
  ];

  const optionalNullableStrings = new Set([
    'genericName', 'composition', 'strength', 'hsnCode', 'rackLocation', 'scheduleType',
  ]);

  for (const field of allowedFields) {
    if (data[field] === undefined) continue;

    if (field === 'isActive' || field === 'isScheduled') {
      updateFields[field] = Boolean(data[field]);
      continue;
    }

    if (field === 'purchasePrice' || field === 'sellingPrice') {
      if (data[field] === null || data[field] === '') {
        updateFields[field] = null;
      } else {
        const n = Number(data[field]);
        if (Number.isNaN(n) || n < 0) {
          return badRequest(`Invalid ${field}`);
        }
        updateFields[field] = n;
      }
      continue;
    }

    if (field === 'packSize' || field === 'reorderLevel' || field === 'gstRate') {
      const n = Number(data[field]);
      if (Number.isNaN(n)) {
        return badRequest(`Invalid ${field}`);
      }
      updateFields[field] = n;
      continue;
    }

    if (optionalNullableStrings.has(field) && (data[field] === '' || data[field] === null)) {
      updateFields[field] = null;
      continue;
    }

    updateFields[field] = data[field];
>>>>>>> ddeaf7c (sve)
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
