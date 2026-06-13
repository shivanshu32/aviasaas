/**
 * Update Stock Batch API
 * Edit batch details including pricing (does NOT change quantity)
 *
 * Endpoint: PUT /.netlify/functions/medicine-updateStockBatch
 *
 * Request Body:
 *   {
 *     batchId: string (required),
 *     batchNo?: string,
 *     expiryDate?: string (YYYY-MM),
 *     mfgDate?: string (YYYY-MM),
 *     purchasePrice?: number,
 *     mrp?: number,
 *     sellingPrice?: number,
 *     supplier?: string,
 *     purchaseInvoiceNo?: string,
 *     gstRate?: number,
 *     remarks?: string
 *   }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound, conflict } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import {
  endOfExpiryMonth,
  startOfMfgMonth,
  isExpiryMonthPast,
} from '../shared/utils/monthYearDate.js';

async function updateStockBatch(event) {
  if (event.httpMethod !== 'PUT') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  if (!data.batchId) {
    return badRequest('Batch ID is required');
  }

  const db = await getDb();

  const batchQuery = ObjectId.isValid(data.batchId)
    ? { _id: new ObjectId(data.batchId) }
    : { batchNo: data.batchId };

  const batch = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOne(batchQuery);
  if (!batch) {
    return notFound('Stock batch');
  }

  const updateFields = {
    updatedAt: new Date(),
  };

  // If changing batchNo, check for conflict with another batch of same medicine
  if (data.batchNo !== undefined && data.batchNo !== batch.batchNo) {
    const existing = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOne({
      medicineId: batch.medicineId,
      batchNo: data.batchNo,
      _id: { $ne: batch._id },
    });
    if (existing) {
      return conflict(`Batch "${data.batchNo}" already exists for this medicine`);
    }
    updateFields.batchNo = data.batchNo.trim();
  }

  if (data.expiryDate !== undefined) {
    const expiryDate = endOfExpiryMonth(data.expiryDate);
    if (!expiryDate) {
      return badRequest('Invalid expiry month (use YYYY-MM)');
    }
    if (isExpiryMonthPast(expiryDate)) {
      return badRequest('Expiry month is in the past');
    }
    updateFields.expiryDate = expiryDate;
  }

  if (data.mfgDate !== undefined) {
    const mfgDate = startOfMfgMonth(data.mfgDate);
    if (!mfgDate) {
      return badRequest('Invalid manufacturing month (use YYYY-MM)');
    }
    updateFields.mfgDate = mfgDate;
  }

  if (data.purchasePrice !== undefined) {
    const n = Number(data.purchasePrice);
    if (Number.isNaN(n) || n < 0) {
      return badRequest('Invalid purchase price');
    }
    updateFields.purchasePrice = n;
  }

  if (data.mrp !== undefined) {
    const n = Number(data.mrp);
    if (Number.isNaN(n) || n < 0) {
      return badRequest('Invalid MRP');
    }
    updateFields.mrp = n;
  }

  if (data.sellingPrice !== undefined) {
    if (data.sellingPrice === null || data.sellingPrice === '') {
      updateFields.sellingPrice = null;
    } else {
      const n = Number(data.sellingPrice);
      if (Number.isNaN(n) || n < 0) {
        return badRequest('Invalid selling price');
      }
      updateFields.sellingPrice = n;
    }
  }

  if (data.gstRate !== undefined) {
    const n = Number(data.gstRate);
    if (Number.isNaN(n) || n < 0) {
      return badRequest('Invalid GST rate');
    }
    updateFields.gstRate = n;
  }

  if (data.supplier !== undefined) {
    updateFields.supplier = data.supplier.trim() || null;
  }

  if (data.purchaseInvoiceNo !== undefined) {
    updateFields.purchaseInvoiceNo = data.purchaseInvoiceNo.trim() || null;
  }

  if (data.remarks !== undefined) {
    updateFields.remarks = data.remarks.trim() || null;
  }

  const result = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOneAndUpdate(
    { _id: batch._id },
    { $set: updateFields },
    { returnDocument: 'after' },
  );

  const updatedBatch = result?.value ?? result;

  return success({ stockBatch: updatedBatch }, 'Stock batch updated successfully');
}

export const handler = withErrorHandler(updateStockBatch);
