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
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, notFound, conflict } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { STOCK_STATUS } from '../../shared/constants/enums.js';

async function addStock(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.medicineId) return badRequest('Medicine ID is required');
  if (!data.batchNo) return badRequest('Batch number is required');
  if (!data.expiryDate) return badRequest('Expiry date is required');
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

  // Check for duplicate batch
  const existingBatch = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOne({
    medicineId: medicine._id,
    batchNo: data.batchNo,
  });

  if (existingBatch) {
    return conflict('Stock batch with this batch number already exists for this medicine');
  }

  // Parse dates
  const expiryDate = new Date(data.expiryDate);
  const mfgDate = data.mfgDate ? new Date(data.mfgDate) : null;
  const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date();

  // Validate expiry date is in future
  if (expiryDate <= new Date()) {
    return badRequest('Expiry date must be in the future');
  }

  // Determine initial status
  let status = STOCK_STATUS.ACTIVE;
  if (data.quantity <= medicine.reorderLevel) {
    status = STOCK_STATUS.LOW;
  }

  // Create stock batch document
  const now = new Date();
  const stockBatch = {
    _id: new ObjectId(),
    medicineId: medicine._id,
    batchNo: data.batchNo,
    expiryDate,
    mfgDate,
    purchaseDate,
    supplier: data.supplier || null,
    purchaseInvoiceNo: data.purchaseInvoiceNo || null,
    initialQty: Number(data.quantity),
    currentQty: Number(data.quantity),
    purchasePrice: Number(data.purchasePrice),
    mrp: Number(data.mrp),
    sellingPrice: Number(data.sellingPrice) || Number(data.mrp),
    gstRate: Number(data.gstRate) || medicine.gstRate || 0,
    status,
    remarks: data.remarks || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).insertOne(stockBatch);

  // Return with medicine info
  const response = {
    ...stockBatch,
    medicine: {
      _id: medicine._id,
      medicineId: medicine.medicineId,
      name: medicine.name,
      packSize: medicine.packSize,
      packUnit: medicine.packUnit,
    },
  };

  return created(
    { stockBatch: response },
    'Stock added successfully'
  );
}

export const handler = withErrorHandler(addStock);
