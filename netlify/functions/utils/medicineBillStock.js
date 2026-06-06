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
 * Build bill line items and stock deductions from request payload lines.
 * @returns {{ billItems: object[], stockUpdates: object[] }}
 */
export async function buildMedicineBillLineItems(db, dataItems, { skipStockDeduction }) {
  const billItems = [];
  const stockUpdates = [];

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

    if (!skipStockDeduction && batch.currentQty < item.quantity) {
      const err = new Error(`Insufficient stock for ${medicine.name}`);
      err.code = 'INSUFFICIENT_STOCK';
      err.details = {
        medicine: medicine.name,
        batchNo: batch.batchNo,
        available: batch.currentQty,
        requested: item.quantity,
      };
      throw err;
    }

    const sellingPrice =
      item.sellingPrice != null && item.sellingPrice !== ''
        ? Number(item.sellingPrice)
        : batch.sellingPrice || batch.mrp;
    const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
    const lineGross = item.quantity * sellingPrice;
    const lineDiscount = Math.round(lineGross * (discountPercent / 100) * 100) / 100;
    const amount = Math.round((lineGross - lineDiscount) * 100) / 100;

    billItems.push({
      medicineId: medicine._id,
      batchId: batch._id,
      medicineName: medicine.name,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      quantity: item.quantity,
      mrp: batch.mrp,
      sellingPrice,
      discountPercent,
      discount: lineDiscount,
      gstRate: batch.gstRate || 0,
      amount,
    });

    if (!skipStockDeduction) {
      const newQty = batch.currentQty - item.quantity;
      stockUpdates.push({
        batchId: batch._id,
        newQty,
        newStatus: stockStatusForQty(newQty, Number(medicine.reorderLevel) || 0),
      });
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
