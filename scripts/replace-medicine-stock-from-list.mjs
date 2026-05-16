#!/usr/bin/env node
/**
 * Replace ALL medicine_stock_batches with opening stock from a simple CSV:
 *   Medicine Name, Qty, MRP
 *
 * - Deletes every document in medicine_stock_batches (unless --no-delete)
 * - Does NOT remove medicines from the catalog
 * - Qty "Return" (any case): no batch; logged as return
 * - Qty 0: updates catalog prices only; no batch
 * - Qty > 0: one opening batch per row with MRP / selling price from CSV
 *
 * Usage:
 *   node scripts/replace-medicine-stock-from-list.mjs [--dry-run]
 *   node scripts/replace-medicine-stock-from-list.mjs path/to.csv [--dry-run]
 *   node scripts/replace-medicine-stock-from-list.mjs --create-missing-medicines
 *   npm run import:medicine-stock-list -- [--dry-run] [--create-missing-medicines]
 *
 * Env: MONGODB_URI (required), MONGODB_DB_NAME (optional)
 *      IMPORT_OVERRIDES_PATH, IMPORT_PURCHASE_RATIO (default 0.85 of MRP)
 *      IMPORT_SUPPLIER_LABEL (default stock-list-replace-2026)
 *      IMPORT_EXPIRY_YEARS (default 2)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { MongoClient, ObjectId } from 'mongodb';
import { STOCK_STATUS } from '../shared/constants/enums.js';
import {
  normalizeMedicineLabel,
  extractDbNameFromMongoUri,
  resolveMedicineForRow,
  rankMedicineMatches,
} from './lib/medicine-import-match.mjs';
import { buildNewMedicineFromPrice } from './lib/medicine-catalog-create.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = path.join(__dirname, 'data', 'medicine-stock-replacement.csv');
const MEDICINES_COLL = 'medicines';
const BATCHES_COLL = 'medicine_stock_batches';
const DEFAULT_OVERRIDES_PATH = path.join(__dirname, 'stock-import-overrides.json');

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function parseArgs(argv) {
  const positional = [];
  let dryRun = false;
  let noDelete = false;
  let createMissingMedicines =
    process.env.IMPORT_CREATE_MISSING_MEDICINES === '1' ||
    process.env.IMPORT_CREATE_MISSING_MEDICINES === 'true';

  for (const a of argv) {
    if (a === '--dry-run' || a === '-n') dryRun = true;
    else if (a === '--no-delete') noDelete = true;
    else if (a === '--create-missing-medicines') createMissingMedicines = true;
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else positional.push(a);
  }
  return { positional, dryRun, noDelete, createMissingMedicines };
}

function loadOverrides(overridesPath) {
  if (!fs.existsSync(overridesPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
  } catch (e) {
    console.error(`Failed to read overrides: ${overridesPath}`, e.message);
    process.exit(1);
  }
}

function parseQty(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { kind: 'invalid' };
  if (/^return$/i.test(s)) return { kind: 'return' };
  const n = Number(s);
  if (Number.isNaN(n)) return { kind: 'invalid' };
  if (n < 0) return { kind: 'invalid' };
  if (n === 0) return { kind: 'zero', qty: 0 };
  return { kind: 'stock', qty: Math.floor(n) };
}

function parseMrp(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function pickHeaderIndex(headers, candidates) {
  const norm = headers.map((h) =>
    String(h)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' '),
  );
  for (const c of candidates) {
    const i = norm.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

function readRows(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (!records.length) return [];

  const headers = Object.keys(records[0]);
  const nameIdx = pickHeaderIndex(headers, ['medicine name', 'name', 'medicine', 'item_name']);
  const qtyIdx = pickHeaderIndex(headers, ['qty', 'quantity', 'opening_qty']);
  const mrpIdx = pickHeaderIndex(headers, ['mrp', 'm.r.p.', 'sale', 'selling price']);

  return records.map((row, i) => {
    const getByIdx = (idx, fallbacks) => {
      if (idx >= 0) return row[headers[idx]];
      for (const f of fallbacks) {
        if (row[f] !== undefined) return row[f];
      }
      return undefined;
    };

    const name =
      nameIdx >= 0
        ? row[headers[nameIdx]]
        : row['Medicine Name'] ?? row.name ?? row.item_name;
    const qty =
      qtyIdx >= 0 ? row[headers[qtyIdx]] : row.Qty ?? row.qty ?? row.quantity;
    const mrp =
      mrpIdx >= 0 ? row[headers[mrpIdx]] : row.MRP ?? row.mrp;

    return { rowIndex: i + 2, name: String(name ?? '').trim(), qty, mrp };
  });
}

function defaultExpiry(yearsAhead) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsAhead);
  d.setMonth(d.getMonth() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function batchDoc({
  medicine,
  batchNo,
  qty,
  mrp,
  purchasePrice,
  expiryDate,
  purchaseDate,
  supplierLabel,
  dataRow,
}) {
  const now = new Date();
  const reorder = Number(medicine.reorderLevel) || 0;
  const status = qty <= reorder ? STOCK_STATUS.LOW : STOCK_STATUS.ACTIVE;
  return {
    _id: new ObjectId(),
    medicineId: medicine._id,
    batchNo,
    expiryDate,
    mfgDate: null,
    purchaseDate,
    supplier: supplierLabel,
    purchaseInvoiceNo: null,
    initialQty: qty,
    currentQty: qty,
    purchasePrice,
    mrp,
    sellingPrice: mrp,
    gstRate: Number(medicine.gstRate) || 0,
    status,
    remarks: `stock-list-replace row ${dataRow}`,
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureMedicine({ db, medicines, itemName, mrp, dryRun, createMissingMedicines }) {
  const normCsv = normalizeMedicineLabel(itemName);
  let m = medicines.find((x) => normalizeMedicineLabel(x.name) === normCsv);
  if (m) return { medicine: m, created: false };

  if (!createMissingMedicines) return { medicine: null, created: false };

  if (dryRun) {
    m = {
      _id: new ObjectId(),
      medicineId: 'DRY-RUN',
      name: itemName.trim(),
    };
    medicines.push(m);
    return { medicine: m, created: true };
  }

  const coll = db.collection(MEDICINES_COLL);
  const doc = await buildNewMedicineFromPrice(coll, itemName, {
    sellingPrice: mrp,
    purchasePrice: mrp != null ? Math.round(mrp * 0.85) : null,
  });
  await coll.insertOne(doc);
  medicines.push(doc);
  return { medicine: doc, created: true };
}

async function main() {
  loadDotEnv();
  const { positional, dryRun, noDelete, createMissingMedicines } = parseArgs(
    process.argv.slice(2),
  );
  const csvPath = positional[0]
    ? path.isAbsolute(positional[0])
      ? positional[0]
      : path.join(process.cwd(), positional[0])
    : DEFAULT_CSV;

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }

  const dbName =
    process.env.MONGODB_DB_NAME || extractDbNameFromMongoUri(uri) || 'clinic_db';
  const overridesPath = process.env.IMPORT_OVERRIDES_PATH || DEFAULT_OVERRIDES_PATH;
  const overrides = loadOverrides(overridesPath);
  const purchaseRatio = Number(process.env.IMPORT_PURCHASE_RATIO) || 0.85;
  const supplierLabel = process.env.IMPORT_SUPPLIER_LABEL || 'stock-list-replace-2026';
  const expiryYears = Number(process.env.IMPORT_EXPIRY_YEARS) || 2;

  const rows = readRows(csvPath);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const medicines = await db.collection(MEDICINES_COLL).find({ isActive: { $ne: false } }).toArray();
  const medicinesColl = db.collection(MEDICINES_COLL);
  const batchesColl = db.collection(BATCHES_COLL);

  const stats = {
    rowsTotal: rows.length,
    matched: 0,
    batchesToInsert: 0,
    catalogPriceOnly: 0,
    returnsSkipped: 0,
    zeroQtySkipped: 0,
    invalidRows: 0,
    unmatched: 0,
    medicinesCreated: 0,
  };
  const errors = [];
  const documents = [];
  const catalogUpdates = [];
  const purchaseDate = new Date();
  const expiryDate = defaultExpiry(expiryYears);
  let batchSeq = 0;

  for (const row of rows) {
    const { rowIndex, name, qty: qtyRaw, mrp: mrpRaw } = row;
    if (!name) {
      stats.invalidRows += 1;
      errors.push({ row: rowIndex, reason: 'empty medicine name' });
      continue;
    }

    const qtyParsed = parseQty(qtyRaw);
    const mrp = parseMrp(mrpRaw);

    if (qtyParsed.kind === 'return') {
      stats.returnsSkipped += 1;
      continue;
    }

    if (qtyParsed.kind === 'invalid') {
      stats.invalidRows += 1;
      errors.push({ row: rowIndex, name, reason: `invalid qty: ${qtyRaw}` });
      continue;
    }

    if (mrp == null && qtyParsed.kind === 'stock') {
      stats.invalidRows += 1;
      errors.push({ row: rowIndex, name, reason: `invalid MRP: ${mrpRaw}` });
      continue;
    }

    const normCsv = normalizeMedicineLabel(name);
    const overrideValue = overrides[name] ?? overrides[normCsv];
    let medicine = resolveMedicineForRow(name, normCsv, medicines, overrideValue);

    if (!medicine) {
      const ensured = await ensureMedicine({
        db,
        medicines,
        itemName: name,
        mrp,
        dryRun,
        createMissingMedicines,
      });
      medicine = ensured.medicine;
      if (ensured.created) stats.medicinesCreated += 1;
    }

    if (!medicine) {
      stats.unmatched += 1;
      const suggestions = rankMedicineMatches(name, medicines, 3).map((x) => ({
        name: x.medicine.name,
        medicineId: x.medicine.medicineId,
        score: Number(x.score.toFixed(3)),
      }));
      errors.push({ row: rowIndex, name, reason: 'no matching medicine', suggestions });
      continue;
    }

    stats.matched += 1;

    if (mrp != null) {
      const purchasePrice = Math.round(mrp * purchaseRatio * 100) / 100;
      catalogUpdates.push({
        filter: { _id: medicine._id },
        set: {
          sellingPrice: mrp,
          purchasePrice,
          updatedAt: new Date(),
        },
      });
      medicine.sellingPrice = mrp;
      medicine.purchasePrice = purchasePrice;
    }

    if (qtyParsed.kind === 'zero') {
      stats.zeroQtySkipped += 1;
      stats.catalogPriceOnly += 1;
      continue;
    }

    batchSeq += 1;
    const purchasePrice =
      medicine.purchasePrice != null
        ? Number(medicine.purchasePrice)
        : Math.round(mrp * purchaseRatio * 100) / 100;

    documents.push(
      batchDoc({
        medicine,
        batchNo: `OB-2026-${String(batchSeq).padStart(4, '0')}`,
        qty: qtyParsed.qty,
        mrp,
        purchasePrice,
        expiryDate,
        purchaseDate,
        supplierLabel,
        dataRow: rowIndex,
      }),
    );
    stats.batchesToInsert += 1;
  }

  const existingBatches = await batchesColl.countDocuments({});

  const summary = {
    database: dbName,
    csvPath,
    dryRun,
    noDelete,
    createMissingMedicines,
    medicinesInCatalog: medicines.length,
    existingBatches,
    stats,
    wouldDeleteBatches: noDelete ? 0 : existingBatches,
    wouldInsertBatches: documents.length,
    wouldUpdateCatalogPrices: catalogUpdates.length,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (errors.length) {
    console.error('\nIssues (first 40):');
    console.error(JSON.stringify(errors.slice(0, 40), null, 2));
    if (errors.length > 40) console.error(`... and ${errors.length - 40} more`);
  }

  const fatal = stats.unmatched > 0 || stats.invalidRows > 0;
  if (dryRun) {
    console.log('\n[dry-run] No writes performed.');
    await client.close();
    process.exit(fatal && !createMissingMedicines ? 1 : 0);
  }

  if (fatal) {
    console.error('\nAborting: fix unmatched/invalid rows or use --create-missing-medicines.');
    await client.close();
    process.exit(1);
  }

  if (!noDelete) {
    const del = await batchesColl.deleteMany({});
    console.log(`Deleted existing stock batches: ${del.deletedCount}`);
  }

  for (const u of catalogUpdates) {
    await medicinesColl.updateOne(u.filter, { $set: u.set });
  }
  console.log(`Updated catalog prices: ${catalogUpdates.length}`);

  const chunk = 500;
  for (let i = 0; i < documents.length; i += chunk) {
    const slice = documents.slice(i, i + chunk);
    if (slice.length) await batchesColl.insertMany(slice, { ordered: false });
  }
  console.log(`Inserted batches: ${documents.length}`);

  await client.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
