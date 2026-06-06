#!/usr/bin/env node
/**
 * Backfill medicine_stock_movements from existing batches and medicine bills.
 *
 * Run once after deploying activity logging (safe to re-run — skips duplicates).
 *
 * Usage:
 *   node scripts/backfill-medicine-activity.mjs [--dry-run]
 *
 * Env:
 *   MONGODB_URI (required)
 *   MONGODB_DB_NAME (optional)
 */

import { MongoClient, ObjectId } from 'mongodb';
import { MOVEMENT_TYPE, MOVEMENT_SOURCE } from '../shared/constants/enums.js';

const BATCHES_COLL = 'medicine_stock_batches';
const BILLS_COLL = 'medicine_bills';
const MOVEMENTS_COLL = 'medicine_stock_movements';

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

function resolveDbName(uri, explicit) {
  if (explicit) return explicit;
  try {
    const path = new URL(uri).pathname.replace(/^\//, '');
    if (path) return path.split('/')[0];
  } catch {
    /* ignore */
  }
  return 'clinic_db';
}

async function backfillExists(coll, marker) {
  const filter = {
    backfilled: true,
    type: marker.type,
    quantityDelta: marker.quantityDelta,
  };
  if (marker.referenceId != null) {
    filter.referenceId = marker.referenceId;
  }
  if (marker.batchId != null) {
    filter.batchId = marker.batchId;
  }
  const found = await coll.findOne(filter);
  return Boolean(found);
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }

  const dbName = resolveDbName(uri, process.env.MONGODB_DB_NAME);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const movements = db.collection(MOVEMENTS_COLL);

  let batchAdded = 0;
  let batchSkipped = 0;
  let billAdded = 0;
  let billSkipped = 0;

  const batches = await db.collection(BATCHES_COLL).find({}).toArray();
  for (const batch of batches) {
    const qty = Number(batch.initialQty ?? batch.currentQty ?? 0);
    if (qty <= 0) continue;

    const marker = {
      type: MOVEMENT_TYPE.STOCK_ADD,
      referenceId: batch._id,
      batchId: batch._id,
      quantityDelta: qty,
    };

    if (await backfillExists(movements, marker)) {
      batchSkipped += 1;
      continue;
    }

    const doc = {
      _id: new ObjectId(),
      medicineId: batch.medicineId,
      batchId: batch._id,
      batchNo: batch.batchNo,
      type: MOVEMENT_TYPE.STOCK_ADD,
      source: MOVEMENT_SOURCE.BACKFILL,
      quantityDelta: qty,
      previousQty: 0,
      newQty: qty,
      referenceType: 'batch',
      referenceId: batch._id,
      referenceLabel: batch.batchNo,
      metadata: {
        supplier: batch.supplier ?? null,
        purchaseInvoiceNo: batch.purchaseInvoiceNo ?? null,
        inferredFrom: 'batch.createdAt',
      },
      performedBy: 'Backfill',
      createdAt: batch.createdAt ?? batch.updatedAt ?? new Date(),
      backfilled: true,
    };

    if (!dryRun) {
      await movements.insertOne(doc);
    }
    batchAdded += 1;
  }

  const bills = await db.collection(BILLS_COLL).find({
    isReturn: { $ne: true },
    stockDeducted: true,
  }).toArray();

  for (const bill of bills) {
    for (const item of bill.items || []) {
      if (!item?.medicineId || !item?.batchId || !item?.quantity) continue;

      const qty = Number(item.quantity);
      const marker = {
        type: MOVEMENT_TYPE.BILL_SALE,
        referenceId: bill._id,
        batchId: item.batchId instanceof ObjectId ? item.batchId : new ObjectId(item.batchId),
        quantityDelta: -qty,
      };

      if (await backfillExists(movements, marker)) {
        billSkipped += 1;
        continue;
      }

      const doc = {
        _id: new ObjectId(),
        medicineId: item.medicineId instanceof ObjectId
          ? item.medicineId
          : new ObjectId(item.medicineId),
        batchId: item.batchId instanceof ObjectId ? item.batchId : new ObjectId(item.batchId),
        batchNo: item.batchNo ?? null,
        type: MOVEMENT_TYPE.BILL_SALE,
        source: MOVEMENT_SOURCE.BACKFILL,
        quantityDelta: -qty,
        reason: 'bill_sale',
        referenceType: 'bill',
        referenceId: bill._id,
        referenceLabel: bill.billNo ?? null,
        metadata: {
          patientName: bill.patientName ?? null,
          medicineName: item.medicineName ?? null,
          inferredFrom: 'medicine_bills',
        },
        performedBy: bill.createdBy ?? 'Backfill',
        createdAt: bill.billDate ?? bill.createdAt ?? new Date(),
        backfilled: true,
      };

      if (!dryRun) {
        await movements.insertOne(doc);
      }
      billAdded += 1;
    }
  }

  console.log(JSON.stringify({
    dryRun,
    dbName,
    batchesProcessed: batches.length,
    batchMovementsAdded: batchAdded,
    batchMovementsSkipped: batchSkipped,
    billLineMovementsAdded: billAdded,
    billLineMovementsSkipped: billSkipped,
  }, null, 2));

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
