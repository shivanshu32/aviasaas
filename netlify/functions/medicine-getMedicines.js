/**
 * Get Medicines API
 * List medicines with search and pagination
 * 
 * Endpoint: GET /.netlify/functions/medicine-getMedicines
 * 
 * Query Parameters:
 *   - search: Search by name or generic name
 *   - category: Filter by category
 *   - page, limit: Pagination
 *   - includeStock: Include current stock info (true/false)
 * 
 * Response:
 *   { success: true, medicines: [...], pagination: {...} }
 */

import { getDb, COLLECTIONS } from './utils/db.js';
import { paginated } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getMedicines(event) {
  const {
    search = '',
    category,
    page = '1',
    limit = '50',
    includeStock = 'false',
  } = event.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const db = await getDb();
  const filter = { isActive: true };

  // Search filter
  if (search.trim()) {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { genericName: searchRegex },
      { medicineId: searchRegex },
    ];
  }

  // Category filter
  if (category) {
    filter.category = category;
  }

  let medicines;
  let total;

  if (includeStock === 'true') {
    // Aggregation to include stock info
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
                totalStock: { $sum: '$currentQty' },
                batches: { $push: { batchNo: '$batchNo', qty: '$currentQty', expiry: '$expiryDate' } },
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
        },
      },
      { $project: { stockInfo: 0 } },
    ];

    [medicines, total] = await Promise.all([
      db.collection(COLLECTIONS.MEDICINES).aggregate(pipeline).toArray(),
      db.collection(COLLECTIONS.MEDICINES).countDocuments(filter),
    ]);
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
