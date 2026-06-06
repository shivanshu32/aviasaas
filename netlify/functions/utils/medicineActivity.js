import { ObjectId } from 'mongodb';
import { COLLECTIONS } from './db.js';
import { MOVEMENT_TYPE, MOVEMENT_SOURCE } from '../../../shared/constants/enums.js';

const DEFAULT_PERFORMED_BY = 'Pharmacy';

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  return ObjectId.isValid(String(value)) ? new ObjectId(String(value)) : null;
}

function normalizeMovement(entry, now) {
  const medicineId = toObjectId(entry.medicineId);
  if (!medicineId) {
    throw new Error('medicineId is required for movement log');
  }

  const batchId = entry.batchId ? toObjectId(entry.batchId) : null;
  const referenceId = entry.referenceId
    ? (toObjectId(entry.referenceId) ?? String(entry.referenceId))
    : null;

  return {
    _id: entry._id ?? new ObjectId(),
    medicineId,
    batchId,
    batchNo: entry.batchNo ?? null,
    type: entry.type,
    source: entry.source ?? MOVEMENT_SOURCE.MANUAL,
    quantityDelta: Number(entry.quantityDelta) || 0,
    previousQty: entry.previousQty != null ? Number(entry.previousQty) : null,
    newQty: entry.newQty != null ? Number(entry.newQty) : null,
    reason: entry.reason ?? null,
    remarks: entry.remarks ?? null,
    referenceType: entry.referenceType ?? null,
    referenceId,
    referenceLabel: entry.referenceLabel ?? null,
    metadata: entry.metadata ?? null,
    performedBy: entry.performedBy ?? DEFAULT_PERFORMED_BY,
    createdAt: entry.createdAt ?? now,
    backfilled: Boolean(entry.backfilled),
  };
}

/** Insert a single medicine stock movement record. */
export async function logMedicineMovement(db, entry, { session } = {}) {
  const now = new Date();
  const doc = normalizeMovement(entry, now);
  const opts = session ? { session } : {};
  await db.collection(COLLECTIONS.MEDICINE_STOCK_MOVEMENTS).insertOne(doc, opts);
  return doc;
}

/** Bulk insert movement records (e.g. bill line items). */
export async function logMedicineMovements(db, entries, { session } = {}) {
  if (!entries?.length) return [];
  const now = new Date();
  const docs = entries.map((entry) => normalizeMovement(entry, now));
  const opts = session ? { session } : {};
  await db.collection(COLLECTIONS.MEDICINE_STOCK_MOVEMENTS).insertMany(docs, opts);
  return docs;
}

/** Log stock restored when a bill is edited or cancelled. */
export async function logBillRestoreMovements(txDb, items, billContext, session, now) {
  if (!items?.length || !billContext?.billId) return;

  const entries = [];
  for (const item of items) {
    if (!item?.batchId || !item?.quantity) continue;
    entries.push({
      medicineId: item.medicineId,
      batchId: item.batchId,
      batchNo: item.batchNo,
      type: MOVEMENT_TYPE.BILL_RESTORE,
      source: MOVEMENT_SOURCE.SYSTEM,
      quantityDelta: Number(item.quantity),
      reason: 'bill_edit',
      referenceType: 'bill',
      referenceId: billContext.billId,
      referenceLabel: billContext.billNo ?? null,
      metadata: {
        patientName: billContext.patientName ?? null,
        medicineName: item.medicineName ?? null,
      },
      performedBy: billContext.performedBy ?? DEFAULT_PERFORMED_BY,
      createdAt: now,
      backfilled: false,
    });
  }

  await logMedicineMovements(txDb, entries, { session });
}

/** Log stock deducted for bill line items. */
export async function logBillSaleMovements(txDb, billItems, billContext, session, now) {
  if (!billItems?.length || !billContext?.billId) return;

  const entries = billItems.map((item) => ({
    medicineId: item.medicineId,
    batchId: item.batchId,
    batchNo: item.batchNo,
    type: MOVEMENT_TYPE.BILL_SALE,
    source: MOVEMENT_SOURCE.SYSTEM,
    quantityDelta: -Number(item.quantity),
    reason: 'bill_sale',
    referenceType: 'bill',
    referenceId: billContext.billId,
    referenceLabel: billContext.billNo ?? null,
    metadata: {
      patientName: billContext.patientName ?? null,
      medicineName: item.medicineName ?? null,
    },
    performedBy: billContext.performedBy ?? DEFAULT_PERFORMED_BY,
    createdAt: now,
    backfilled: false,
  }));

  await logMedicineMovements(txDb, entries, { session });
}
