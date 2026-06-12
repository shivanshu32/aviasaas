import { ObjectId } from 'mongodb';
import { COLLECTIONS } from './db.js';
import { STOCK_STATUS } from '../../../shared/constants/enums.js';
import {
  logBillRestoreMovements,
  logBillSaleMovements,
} from './medicineActivity.js';

export function stockStatusForQty(qty, reorderLevel) {
  if (qty <= 0) return STOCK_STATUS.EXHAUSTED;
  if (qty <= reorderLevel) return STOCK_STATUS.LOW;
  return STOCK_STATUS.ACTIVE;
}

/** Restore quantities from a saved bill back into stock batches. */
export async function restoreStockForBillItems(txDb, items, session, now, billContext = null) {
  for (const item of items || []) {
    if (!item?.batchId || !item?.quantity) continue;

    const batchId = item.batchId instanceof ObjectId
      ? item.batchId
      : new ObjectId(item.batchId);

    const batch = await txDb.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOne(
      { _id: batchId },
      { session },
    );
    if (!batch) continue;

    const medicine = await txDb.collection(COLLECTIONS.MEDICINES).findOne(
      { _id: batch.medicineId },
      { session },
    );

    const newQty = batch.currentQty + Number(item.quantity);
    const reorder = Number(medicine?.reorderLevel) || 0;

    await txDb.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).updateOne(
      { _id: batchId },
      {
        $set: {
          currentQty: newQty,
          status: stockStatusForQty(newQty, reorder),
          updatedAt: now,
        },
      },
      { session },
    );
  }

  if (billContext) {
    await logBillRestoreMovements(txDb, items, billContext, session, now);
  }
}

/**
 * Auto-allocate requested quantity across available batches (FEFO).
 * @returns {Promise<Array<{batch: object, qty: number}>>}
 */
async function allocateAcrossBatches(db, medicine, totalQty, deductedMap, restoredMap) {
  const batches = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES)
    .find({
      medicineId: medicine._id,
      status: { $ne: STOCK_STATUS.EXHAUSTED },
    })
    .sort({ expiryDate: 1 })
    .toArray();

  const allocations = [];
  let remaining = totalQty;
  let totalAvailable = 0;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const batchKey = String(batch._id);
    const alreadyDeducted = deductedMap.get(batchKey) || 0;
    const restoredQty = restoredMap.get(batchKey) || 0;
    const effectiveQty = batch.currentQty + restoredQty - alreadyDeducted;

    if (effectiveQty <= 0) continue;

    totalAvailable += effectiveQty;
    const take = Math.min(effectiveQty, remaining);
    allocations.push({ batch, qty: take });
    remaining -= take;
  }

  if (remaining > 0) {
    const err = new Error(`Insufficient stock for ${medicine.name}`);
    err.code = 'INSUFFICIENT_STOCK';
    err.details = {
      medicine: medicine.name,
      available: totalAvailable,
      requested: totalQty,
    };
    throw err;
  }

  return allocations;
}

/**
 * Build bill line items and stock deductions from request payload lines.
 * Supports automatic multi-batch allocation (FEFO) when a single batch is insufficient.
 * @returns {{ billItems: object[], stockUpdates: object[] }}
 */
export async function buildMedicineBillLineItems(db, dataItems, { skipStockDeduction, originalItems }) {
  const billItems = [];
  const stockUpdates = [];
  const deductedMap = new Map(); // running deductions per batch in this bill

  // Pre-compute restored quantities from original bill when editing
  const restoredMap = new Map();
  if (originalItems?.length) {
    for (const o of originalItems) {
      if (!o?.batchId || !o?.quantity) continue;
      const key = String(o.batchId);
      restoredMap.set(key, (restoredMap.get(key) || 0) + Number(o.quantity));
    }
  }

  for (const item of dataItems) {
    const medicineQuery = ObjectId.isValid(item.medicineId)
      ? { _id: new ObjectId(item.medicineId) }
      : { medicineId: item.medicineId };

    const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(medicineQuery);
    if (!medicine) {
      const err = new Error(`Medicine not found (${item.medicineId})`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const batchQuery = ObjectId.isValid(item.batchId)
      ? { _id: new ObjectId(item.batchId) }
      : { batchNo: item.batchId, medicineId: medicine._id };

    const batch = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOne(batchQuery);
    if (!batch) {
      const err = new Error(`Stock batch not found (${item.batchId})`);
      err.code = 'NOT_FOUND';
      throw err;
    }

    const batchKey = String(batch._id);
    const alreadyDeducted = deductedMap.get(batchKey) || 0;
    const restoredQty = restoredMap.get(batchKey) || 0;
    const effectiveQty = batch.currentQty + restoredQty - alreadyDeducted;

    let allocations;
    if (!skipStockDeduction && effectiveQty < item.quantity) {
      // Auto-allocate across multiple batches (FEFO)
      allocations = await allocateAcrossBatches(db, medicine, item.quantity, deductedMap, restoredMap);
    } else {
      allocations = [{ batch, qty: item.quantity }];
    }

    for (const alloc of allocations) {
      const allocBatch = alloc.batch;
      const allocQty = alloc.qty;
      const allocBatchKey = String(allocBatch._id);
      const allocAlreadyDeducted = deductedMap.get(allocBatchKey) || 0;
      const allocRestoredQty = restoredMap.get(allocBatchKey) || 0;

      const sellingPrice =
        item.sellingPrice != null && item.sellingPrice !== ''
          ? Number(item.sellingPrice)
          : allocBatch.sellingPrice || allocBatch.mrp;
      const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
      const lineGross = allocQty * sellingPrice;
      const lineDiscount = Math.round(lineGross * (discountPercent / 100) * 100) / 100;
      const amount = Math.round((lineGross - lineDiscount) * 100) / 100;

      billItems.push({
        medicineId: medicine._id,
        batchId: allocBatch._id,
        medicineName: medicine.name,
        batchNo: allocBatch.batchNo,
        expiryDate: allocBatch.expiryDate,
        quantity: allocQty,
        mrp: allocBatch.mrp,
        sellingPrice,
        discountPercent,
        discount: lineDiscount,
        gstRate: allocBatch.gstRate || 0,
        amount,
      });

      if (!skipStockDeduction) {
        const newTotalDeducted = allocAlreadyDeducted + allocQty;
        deductedMap.set(allocBatchKey, newTotalDeducted);
        const newQty = allocBatch.currentQty + allocRestoredQty - newTotalDeducted;
        const updatePayload = {
          batchId: allocBatch._id,
          newQty,
          newStatus: stockStatusForQty(newQty, Number(medicine.reorderLevel) || 0),
        };
        const existingIndex = stockUpdates.findIndex((u) => String(u.batchId) === allocBatchKey);
        if (existingIndex >= 0) {
          stockUpdates[existingIndex] = updatePayload;
        } else {
          stockUpdates.push(updatePayload);
        }
      }
    }
  }

  return { billItems, stockUpdates };
}

export async function applyStockUpdates(
  txDb,
  stockUpdates,
  session,
  now,
  billContext = null,
  billItems = null,
) {
  for (const update of stockUpdates) {
    await txDb.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).updateOne(
      { _id: update.batchId },
      {
        $set: {
          currentQty: update.newQty,
          status: update.newStatus,
          updatedAt: now,
        },
      },
      { session },
    );
  }

  if (billContext && billItems?.length) {
    await logBillSaleMovements(txDb, billItems, billContext, session, now);
  }
}
