/**
 * Get Medicine By ID API
 * 
 * Endpoint: GET /.netlify/functions/medicine-getMedicineById?id=xxx
 * 
 * Query Parameters:
 *   - id: Medicine ID or _id
 *   - includeStock: true to include stock batches
 * 
 * Response:
 *   { success: true, medicine: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { enrichMedicineWithPrices } from './utils/medicinePriceFields.js';

async function getMedicineById(event) {
  const { id, includeStock = 'false' } = event.query;

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

  let response = { ...medicine };

  if (includeStock === 'true') {
    const stockBatches = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
      .find({
        medicineId: medicine._id,
        currentQty: { $gt: 0 },
        status: { $ne: 'exhausted' },
      })
      .sort({ expiryDate: 1 })
      .toArray();

    const totalStock = stockBatches.reduce((sum, batch) => sum + batch.currentQty, 0);

    const mrps = stockBatches.map((b) => Number(b.mrp) || 0).filter((v) => v > 0);
    const sellingPrices = stockBatches.map((b) => Number(b.sellingPrice) || 0).filter((v) => v > 0);
    const purchasePrices = stockBatches.map((b) => Number(b.purchasePrice) || 0).filter((v) => v > 0);

    const batchMrp = mrps.length > 0 ? Math.max(...mrps) : null;
    const batchMinMrp = mrps.length > 0 ? Math.min(...mrps) : null;
    const batchSellingPrice = sellingPrices.length > 0 ? Math.max(...sellingPrices) : null;
    const batchMinSellingPrice = sellingPrices.length > 0 ? Math.min(...sellingPrices) : null;
    const batchPurchasePrice = purchasePrices.length > 0 ? Math.max(...purchasePrices) : null;
    const batchMinPurchasePrice = purchasePrices.length > 0 ? Math.min(...purchasePrices) : null;

    const weightedAvgMrp = totalStock > 0
      ? stockBatches.reduce((sum, b) => sum + (Number(b.mrp) || 0) * b.currentQty, 0) / totalStock
      : null;
    const weightedAvgSellingPrice = totalStock > 0
      ? stockBatches.reduce((sum, b) => sum + (Number(b.sellingPrice) || 0) * b.currentQty, 0) / totalStock
      : null;
    const weightedAvgPurchasePrice = totalStock > 0
      ? stockBatches.reduce((sum, b) => sum + (Number(b.purchasePrice) || 0) * b.currentQty, 0) / totalStock
      : null;

    response = enrichMedicineWithPrices({
      ...medicine,
      stockBatches,
      totalStock,
      isLowStock: totalStock <= medicine.reorderLevel,
      batchMrp,
      batchMinMrp,
      batchSellingPrice,
      batchMinSellingPrice,
      batchPurchasePrice,
      batchMinPurchasePrice,
      weightedAvgMrp,
      weightedAvgSellingPrice,
      weightedAvgPurchasePrice,
    });
  } else {
    response = enrichMedicineWithPrices(medicine);
  }

  return success({ medicine: response });
}

export const handler = withErrorHandler(getMedicineById);
