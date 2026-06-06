/**
 * Add Stock API
 * Add new stock batch for a medicine
 * 
 * Endpoint: POST /.netlify/functions/medicine-addStock
 * 
 * Request Body:
 *   {
 *     medicineId: string (required),
 *     batchNo: string (required),
 *     expiryDate: string (required, ISO date),
 *     mfgDate?: string (ISO date),
 *     purchaseDate?: string (ISO date),
 *     supplier?: string,
 *     purchaseInvoiceNo?: string,
 *     quantity: number (required),
 *     purchasePrice: number (required),
 *     mrp: number (required),
 *     sellingPrice?: number (defaults to MRP),
 *     gstRate?: number,
 *     remarks?: string
 *   }
 * 
 * Response:
 *   { success: true, message: string, stockBatch: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { created, success, badRequest, notFound, conflict } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';
import { STOCK_STATUS } from '../../../shared/constants/enums.js';
import {
  endOfExpiryMonth,
  startOfMfgMonth,
  isExpiryMonthPast,
} from '../../../shared/utils/monthYearDate.js';

function mrpMatches(existingMrp, incomingMrp) {
  const a = Number(existingMrp);
  const b = Number(incomingMrp);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) < 0.01;
}

function stockStatusForQty(qty, reorderLevel) {
  if (qty <= 0) return STOCK_STATUS.EXHAUSTED;
  if (qty <= reorderLevel) return STOCK_STATUS.LOW;
  return STOCK_STATUS.ACTIVE;
}

function batchWithMedicine(batch, medicine) {
  return {
    ...batch,
    medicine: {
      _id: medicine._id,
      medicineId: medicine.medicineId,
      name: medicine.name,
      packSize: medicine.packSize,
      packUnit: medicine.packUnit,
    },
  };
}

async function addStock(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.medicineId) return badRequest('Medicine ID is required');
  const batchNo = String(data.batchNo ?? '').trim();
  if (!batchNo) return badRequest('Batch number is required');
  if (!data.expiryDate) return badRequest('Expiry month is required');
  if (!data.quantity || data.quantity <= 0) return badRequest('Valid quantity is required');
  if (!data.purchasePrice) return badRequest('Purchase price is required');
  if (!data.mrp) return badRequest('MRP is required');

  const db = await getDb();

  // Verify medicine exists
  const medicineQuery = ObjectId.isValid(data.medicineId)
    ? { _id: new ObjectId(data.medicineId) }
    : { medicineId: data.medicineId };

  const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(medicineQuery);
  if (!medicine) {
    return notFound('Medicine');
  }

  const addQty = Number(data.quantity);
  const mrp = Number(data.mrp);
  const purchasePrice = Number(data.purchasePrice);
  const sellingPrice = Number(data.sellingPrice) || mrp;
  const reorderLevel = Number(medicine.reorderLevel) || 0;
  const now = new Date();

  const existingBatch = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOne({
    medicineId: medicine._id,
    batchNo,
  });

  if (existingBatch) {
    if (!mrpMatches(existingBatch.mrp, mrp)) {
      return conflict(
        `Batch "${batchNo}" already exists with MRP ₹${existingBatch.mrp}. ` +
          `Cannot add stock with a different MRP (₹${mrp}).`,
      );
    }

    const newQty = existingBatch.currentQty + addQty;
    const newInitialQty = (existingBatch.initialQty ?? existingBatch.currentQty) + addQty;
    const newStatus = stockStatusForQty(newQty, reorderLevel);

    const updateResult = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOneAndUpdate(
      { _id: existingBatch._id },
      {
        $set: {
          currentQty: newQty,
          initialQty: newInitialQty,
          status: newStatus,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    const updatedBatch = updateResult?.value ?? updateResult;

    return success(
      {
        stockBatch: batchWithMedicine(updatedBatch, medicine),
        merged: true,
        quantityAdded: addQty,
      },
      'Stock added to existing batch',
    );
  }

  const expiryDate = endOfExpiryMonth(data.expiryDate);
  if (!expiryDate) {
    return badRequest('Invalid expiry month (use YYYY-MM)');
  }
  if (isExpiryMonthPast(data.expiryDate)) {
    return badRequest('Expiry month must be in the future');
  }

  let mfgDate = null;
  if (data.mfgDate) {
    mfgDate = startOfMfgMonth(data.mfgDate);
    if (!mfgDate) {
      return badRequest('Invalid manufacturing month (use YYYY-MM)');
    }
  }

  const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date();

  const status = stockStatusForQty(addQty, reorderLevel);

  const stockBatch = {
    _id: new ObjectId(),
    medicineId: medicine._id,
    batchNo,
    expiryDate,
    mfgDate,
    purchaseDate,
    supplier: data.supplier || null,
    purchaseInvoiceNo: data.purchaseInvoiceNo || null,
    initialQty: addQty,
    currentQty: addQty,
    purchasePrice,
    mrp,
    sellingPrice,
    gstRate: Number(data.gstRate) || medicine.gstRate || 0,
    status,
    remarks: data.remarks || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).insertOne(stockBatch);

  return created(
    { stockBatch: batchWithMedicine(stockBatch, medicine), merged: false },
    'Stock added successfully',
  );
}

export const handler = withErrorHandler(addStock);
