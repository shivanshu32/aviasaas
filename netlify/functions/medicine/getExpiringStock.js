/**
 * Get Expiring Stock API
 * Get medicines expiring within specified days
 * 
 * Endpoint: GET /.netlify/functions/medicine-getExpiringStock
 * 
 * Query Parameters:
 *   - days: Number of days to look ahead (default: 90)
 * 
 * Response:
 *   { success: true, expiringItems: [...], count: number }
 */

import { getDb, COLLECTIONS } from '../utils/db.js';
import { success } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function getExpiringStock(event) {
  const { days = '90' } = event.query;
  const daysNum = parseInt(days, 10) || 90;

  const db = await getDb();

  // Calculate date range
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysNum);

  const pipeline = [
    {
      $match: {
        expiryDate: { $lte: futureDate },
        currentQty: { $gt: 0 },
        status: { $ne: 'exhausted' },
      },
    },
    {
      $lookup: {
        from: COLLECTIONS.MEDICINES,
        localField: 'medicineId',
        foreignField: '_id',
        as: 'medicine',
      },
    },
    { $unwind: '$medicine' },
    {
      $addFields: {
        daysToExpiry: {
          $ceil: {
            $divide: [
              { $subtract: ['$expiryDate', now] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
        isExpired: { $lte: ['$expiryDate', now] },
      },
    },
    {
      $project: {
        _id: 1,
        batchNo: 1,
        expiryDate: 1,
        currentQty: 1,
        mrp: 1,
        purchasePrice: 1,
        daysToExpiry: 1,
        isExpired: 1,
        stockValue: { $multiply: ['$currentQty', '$purchasePrice'] },
        medicine: {
          _id: '$medicine._id',
          medicineId: '$medicine.medicineId',
          name: '$medicine.name',
          packUnit: '$medicine.packUnit',
        },
      },
    },
    { $sort: { expiryDate: 1 } },
  ];

  const expiringItems = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
    .aggregate(pipeline)
    .toArray();

  // Separate expired and expiring soon
  const expired = expiringItems.filter((item) => item.isExpired);
  const expiringSoon = expiringItems.filter((item) => !item.isExpired);

  // Calculate total value at risk
  const totalValueAtRisk = expiringItems.reduce(
    (sum, item) => sum + (item.stockValue || 0),
    0
  );

  return success({
    expiringItems,
    expired: {
      items: expired,
      count: expired.length,
    },
    expiringSoon: {
      items: expiringSoon,
      count: expiringSoon.length,
    },
    count: expiringItems.length,
    totalValueAtRisk: Math.round(totalValueAtRisk * 100) / 100,
    daysLookahead: daysNum,
  });
}

export const handler = withErrorHandler(getExpiringStock);
