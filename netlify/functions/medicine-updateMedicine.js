/**
 * Update Medicine API
 *
 * Endpoint: PUT /.netlify/functions/medicine-updateMedicine
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { MOVEMENT_TYPE, MOVEMENT_SOURCE } from '../../shared/constants/enums.js';
import { logMedicineMovement } from './utils/medicineActivity.js';

function catalogFieldChanges(before, updateFields) {
  const skip = new Set(['updatedAt']);
  const changes = [];
  for (const [key, value] of Object.entries(updateFields)) {
    if (skip.has(key)) continue;
    const prev = before[key];
    const prevStr = prev == null ? null : String(prev);
    const nextStr = value == null ? null : String(value);
    if (prevStr !== nextStr) {
      changes.push({ field: key, from: prev, to: value });
    }
  }
  return changes;
}

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

  const catalogChanges = catalogFieldChanges(medicine, updateFields);
  const now = updateFields.updatedAt;

  if (catalogChanges.length > 0) {
    await logMedicineMovement(db, {
      medicineId: medicine._id,
      type: MOVEMENT_TYPE.CATALOG_UPDATE,
      source: MOVEMENT_SOURCE.MANUAL,
      quantityDelta: 0,
      referenceType: 'medicine',
      referenceId: medicine._id,
      referenceLabel: medicine.medicineId,
      metadata: { changes: catalogChanges },
      createdAt: now,
    });
  }

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
      const batches = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
        .find({ medicineId: medicine._id })
        .toArray();

      await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).updateMany(
        { medicineId: medicine._id },
        { $set: batchSet },
      );

      if (batches.length > 0) {
        await logMedicineMovement(db, {
          medicineId: medicine._id,
          type: MOVEMENT_TYPE.BATCH_PRICE_SYNC,
          source: MOVEMENT_SOURCE.MANUAL,
          quantityDelta: 0,
          referenceType: 'medicine',
          referenceId: medicine._id,
          referenceLabel: medicine.medicineId,
          metadata: {
            batchesAffected: batches.length,
            purchasePrice: batchSet.purchasePrice ?? null,
            sellingPrice: batchSet.sellingPrice ?? null,
          },
          createdAt: batchSet.updatedAt,
        });
      }
    }
  }

  const updatedMedicine = result?.value ?? result;

  return success({ medicine: updatedMedicine }, 'Medicine updated successfully');
}

export const handler = withErrorHandler(updateMedicine);
