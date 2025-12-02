/**
 * Get Current Stock API
 * Get current stock levels for all medicines
 * 
 * Endpoint: GET /.netlify/functions/medicine-getCurrentStock
 * 
 * Query Parameters:
 *   - medicineId: Filter by specific medicine (optional)
 * 
 * Response:
 *   { success: true, stock: [...] }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { success } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function getCurrentStock(event) {
  const { medicineId } = event.query;

  const db = await getDb();

  // Build match stage
  const matchStage = {
    status: { $in: ['active', 'low'] },
    currentQty: { $gt: 0 },
  };

  if (medicineId) {
    matchStage.medicineId = ObjectId.isValid(medicineId)
      ? new ObjectId(medicineId)
      : medicineId;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$medicineId',
        totalStock: { $sum: '$currentQty' },
        batches: {
          $push: {
            _id: '$_id',
            batchNo: '$batchNo',
            expiryDate: '$expiryDate',
            currentQty: '$currentQty',
            mrp: '$mrp',
            sellingPrice: '$sellingPrice',
          },
        },
        avgPurchasePrice: { $avg: '$purchasePrice' },
        minExpiry: { $min: '$expiryDate' },
      },
    },
    {
      $lookup: {
        from: COLLECTIONS.MEDICINES,
        localField: '_id',
        foreignField: '_id',
        as: 'medicine',
      },
    },
    { $unwind: '$medicine' },
    {
      $project: {
        _id: 0,
        medicineId: '$medicine._id',
        medicineCode: '$medicine.medicineId',
        name: '$medicine.name',
        genericName: '$medicine.genericName',
        category: '$medicine.category',
        packSize: '$medicine.packSize',
        packUnit: '$medicine.packUnit',
        reorderLevel: '$medicine.reorderLevel',
        totalStock: 1,
        batches: 1,
        avgPurchasePrice: { $round: ['$avgPurchasePrice', 2] },
        nearestExpiry: '$minExpiry',
        isLowStock: { $lte: ['$totalStock', '$medicine.reorderLevel'] },
      },
    },
    { $sort: { name: 1 } },
  ];

  const stock = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
    .aggregate(pipeline)
    .toArray();

  return success({ stock });
}

export const handler = withErrorHandler(getCurrentStock);
