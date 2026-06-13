/**
 * Get Medicines API
 * List medicines with search and pagination
 *
 * Endpoint: GET /.netlify/functions/medicine-getMedicines
 */

import { getDb, COLLECTIONS } from '../utils/db.js';
import { paginated } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';
import {
  enrichMedicinesWithPrices,
  STOCK_PRICE_GROUP_FIELDS,
} from '../utils/medicinePriceFields.js';

async function getMedicines(event) {
  const {
    search = '',
    category,
    page = '1',
    limit = '50',
    includeStock = 'false',
  } = event.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const MAX_PAGE = 2000;
  const limitNum = Math.min(MAX_PAGE, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const db = await getDb();
  const filter = { isActive: true };

  if (search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { genericName: searchRegex },
      { medicineId: searchRegex },
    ];
  }

  if (category) {
    filter.category = category;
  }

  let medicines;
  let total;

  if (includeStock === 'true') {
    const pipeline = [
      { $match: filter },
      { $sort: { name: 1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $lookup: {
          from: COLLECTIONS.MEDICINE_STOCK_BATCHES,
          let: { medicineId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$medicineId', '$$medicineId'] },
                status: { $in: ['active', 'low'] },
                currentQty: { $gt: 0 },
              },
            },
            {
              $group: {
                _id: null,
                ...STOCK_PRICE_GROUP_FIELDS,
              },
            },
          ],
          as: 'stockInfo',
        },
      },
      {
        $addFields: {
          currentStock: {
            $ifNull: [{ $arrayElemAt: ['$stockInfo.totalStock', 0] }, 0],
          },
          stockBatches: {
            $ifNull: [{ $arrayElemAt: ['$stockInfo.batches', 0] }, []],
          },
          batchMrp: { $arrayElemAt: ['$stockInfo.batchMrp', 0] },
          batchMinMrp: { $arrayElemAt: ['$stockInfo.batchMinMrp', 0] },
          batchSellingPrice: { $arrayElemAt: ['$stockInfo.batchSellingPrice', 0] },
          batchMinSellingPrice: { $arrayElemAt: ['$stockInfo.batchMinSellingPrice', 0] },
          batchPurchasePrice: { $arrayElemAt: ['$stockInfo.batchPurchasePrice', 0] },
          batchMinPurchasePrice: { $arrayElemAt: ['$stockInfo.batchMinPurchasePrice', 0] },
          nearestExpiry: { $arrayElemAt: ['$stockInfo.nearestExpiry', 0] },
        },
      },
      { $project: { stockInfo: 0 } },
    ];

    [medicines, total] = await Promise.all([
      db.collection(COLLECTIONS.MEDICINES).aggregate(pipeline).toArray(),
      db.collection(COLLECTIONS.MEDICINES).countDocuments(filter),
    ]);
    medicines = enrichMedicinesWithPrices(medicines);
  } else {
    [medicines, total] = await Promise.all([
      db.collection(COLLECTIONS.MEDICINES)
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      db.collection(COLLECTIONS.MEDICINES).countDocuments(filter),
    ]);
    medicines = enrichMedicinesWithPrices(medicines);
  }

  return paginated({
    data: medicines,
    total,
    page: pageNum,
    limit: limitNum,
    dataKey: 'medicines',
  });
}

export const handler = withErrorHandler(getMedicines);
