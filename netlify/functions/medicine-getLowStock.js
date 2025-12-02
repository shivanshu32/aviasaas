/**
 * Get Low Stock API
 * Get medicines below reorder level
 * 
 * Endpoint: GET /.netlify/functions/medicine-getLowStock
 * 
 * Response:
 *   { success: true, lowStockItems: [...], count: number }
 */

import { getDb, COLLECTIONS } from './utils/db.js';
import { success } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getLowStock(event) {
  const db = await getDb();

  const pipeline = [
    // Get all active stock batches
    {
      $match: {
        status: { $in: ['active', 'low'] },
        currentQty: { $gt: 0 },
      },
    },
    // Group by medicine
    {
      $group: {
        _id: '$medicineId',
        totalStock: { $sum: '$currentQty' },
      },
    },
    // Join with medicines
    {
      $lookup: {
        from: COLLECTIONS.MEDICINES,
        localField: '_id',
        foreignField: '_id',
        as: 'medicine',
      },
    },
    { $unwind: '$medicine' },
    // Filter where stock <= reorder level
    {
      $match: {
        $expr: { $lte: ['$totalStock', '$medicine.reorderLevel'] },
        'medicine.isActive': true,
      },
    },
    // Project final shape
    {
      $project: {
        _id: '$medicine._id',
        medicineId: '$medicine.medicineId',
        name: '$medicine.name',
        genericName: '$medicine.genericName',
        category: '$medicine.category',
        packUnit: '$medicine.packUnit',
        currentStock: '$totalStock',
        reorderLevel: '$medicine.reorderLevel',
        deficit: { $subtract: ['$medicine.reorderLevel', '$totalStock'] },
      },
    },
    { $sort: { deficit: -1 } },
  ];

  const lowStockItems = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
    .aggregate(pipeline)
    .toArray();

  // Also get medicines with zero stock
  const medicinesWithStock = lowStockItems.map((item) => item._id);
  
  const zeroStockMedicines = await db.collection(COLLECTIONS.MEDICINES)
    .find({
      _id: { $nin: medicinesWithStock },
      isActive: true,
    })
    .project({
      _id: 1,
      medicineId: 1,
      name: 1,
      genericName: 1,
      category: 1,
      packUnit: 1,
      reorderLevel: 1,
    })
    .toArray();

  const zeroStockItems = zeroStockMedicines.map((med) => ({
    ...med,
    currentStock: 0,
    deficit: med.reorderLevel,
  }));

  // Combine and sort
  const allLowStock = [...lowStockItems, ...zeroStockItems]
    .sort((a, b) => b.deficit - a.deficit);

  return success({
    lowStockItems: allLowStock,
    count: allLowStock.length,
  });
}

export const handler = withErrorHandler(getLowStock);
