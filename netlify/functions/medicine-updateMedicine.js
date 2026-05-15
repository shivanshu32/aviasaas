/**
 * Update Medicine API
 *
 * Endpoint: PUT /.netlify/functions/medicine-updateMedicine
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

  const query = ObjectId.isValid(data.id)
    ? { _id: new ObjectId(data.id) }
    : { medicineId: data.id };

  const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(query);
  if (!medicine) {
    return notFound('Medicine');
  }

  const syncBatchPrices = Boolean(data.syncBatchPrices);

  const updateFields = {
    updatedAt: new Date(),
  };

  const allowedFields = [
    'name', 'genericName', 'category', 'manufacturer',
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
  }

  const result = await db.collection(COLLECTIONS.MEDICINES).findOneAndUpdate(
    { _id: medicine._id },
    { $set: updateFields },
    { returnDocument: 'after' },
  );

  if (syncBatchPrices) {
    const batchSet = { updatedAt: new Date() };
    if (updateFields.purchasePrice !== undefined) {
      batchSet.purchasePrice = updateFields.purchasePrice;
    }
    if (updateFields.sellingPrice !== undefined) {
      batchSet.sellingPrice = updateFields.sellingPrice;
      batchSet.mrp = updateFields.sellingPrice;
    }
    if (Object.keys(batchSet).length > 1) {
      await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).updateMany(
        { medicineId: medicine._id },
        { $set: batchSet },
      );
    }
  }

  const updatedMedicine = result?.value ?? result;

  return success({ medicine: updatedMedicine }, 'Medicine updated successfully');
}

export const handler = withErrorHandler(updateMedicine);
