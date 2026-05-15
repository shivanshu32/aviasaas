#!/usr/bin/env node
/**
 * Replace medicine_stock_batches from an inventory CSV (MongoDB).
 *
 * Usage:
 *   node scripts/import-medicine-stock-from-csv.mjs <path-to.csv> [--dry-run] [--no-delete] [--create-missing-medicines]
 *
 * Env:
 *   MONGODB_URI          (required)
 *   MONGODB_DB_NAME      (optional: default = name from URI path, e.g. /aviawellness, else clinic_db)
 *   IMPORT_DEFAULT_MRP   (default: 1)
 *   IMPORT_DEFAULT_PURCHASE (default: 1)
 *   IMPORT_DEFAULT_SELLING    (defaults to IMPORT_DEFAULT_MRP)
 *   IMPORT_SUPPLIER_LABEL (default: opening-balance-import)
 *   IMPORT_CREATE_MISSING_MEDICINES (set to 1 or true) — auto-create catalog rows for unmatched item_name (same as --create-missing-medicines)
 *
 * Overrides JSON path: scripts/stock-import-overrides.json (optional)
 * Copy from scripts/stock-import-overrides.example.json
 *
 * See scripts/README-medicine-stock-import.md for backup and verification.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { MongoClient, ObjectId } from 'mongodb';
import { STOCK_STATUS } from '../shared/constants/enums.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MEDICINES_COLL = 'medicines';
const BATCHES_COLL = 'medicine_stock_batches';

const DEFAULT_OVERRIDES_PATH = path.join(__dirname, 'stock-import-overrides.json');

function parseArgs(argv) {
  const positional = [];
  let dryRun = false;
  let noDelete = false;
  let createMissingMedicines =
    process.env.IMPORT_CREATE_MISSING_MEDICINES === '1' ||
    process.env.IMPORT_CREATE_MISSING_MEDICINES === 'true';
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
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

function normName(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '');
}

/** Shorter strings derived from CSV item_name for fuzzy match against catalog names. */
function csvMatchCandidates(normCsv) {
  const out = [];
  const add = (s) => {
    const t = String(s || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (t && !out.includes(t)) out.push(t);
  };
  if (!normCsv) return out;
  add(normCsv);
  add(normCsv.replace(/-/g, ' '));
  let s = normCsv;
  for (let pass = 0; pass < 12; pass += 1) {
    const prev = s;
    s = s.replace(/\s+\d+\*\d+$/i, '').trim();
    s = s.replace(/\s+\d+\s*ml$/i, '').trim();
    s = s.replace(/\s+\d+\s*gm$/i, '').trim();
    s = s.replace(/\s+\d+\s*mg$/i, '').trim();
    s = s
      .replace(
        /\s+(tab|cap|caps?|inj|syp|syr|gel|powder|sachet|oil|drops?|cream|lotions?|gummies|belt|brace|sling|shoe|splint|serum|unguent|oint)\.?$/i,
        '',
      )
      .trim();
    s = s.replace(/\s+\d+$/i, '').trim();
    if (s === prev) break;
    add(s);
    add(s.replace(/-/g, ' '));
  }
  const words = normCsv.split(/\s+/).filter(Boolean);
  if (words.length >= 4) add(words.slice(0, 4).join(' '));
  if (words.length >= 3) add(words.slice(0, 3).join(' '));
  if (words.length >= 2) add(words.slice(0, 2).join(' '));
  return out;
}

function alnumCore(normOrRaw) {
  return normName(normOrRaw).replace(/[^a-z0-9]/g, '');
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapCsvUnitToPackUnit(unitRaw) {
  const u = String(unitRaw || '')
    .replace(/\./g, '')
    .trim()
    .toLowerCase();
  if (u === 'tab' || u === 'tabs') return 'strip';
  if (u === 'box') return 'box';
  if (u === 'qty' || u === 'qt') return 'piece';
  return 'piece';
}

function inferMedicineCategory(itemName, unitRaw) {
  const t = `${itemName} ${unitRaw}`.toLowerCase();
  if (/\binj\b|injection/.test(t)) return 'injection';
  if (/syp|syrup/.test(t)) return 'syrup';
  if (/\bcap\b|capsule/.test(t)) return 'capsule';
  if (/\btab\b|tablet/.test(t)) return 'tablet';
  if (/powder|sachet/.test(t)) return 'powder';
  if (/gel|cream|oint|lotion/.test(t)) return 'cream';
  if (/drop|eye|e\/d|e\.d/.test(t)) return 'drops';
  if (/oil\b/.test(t)) return 'other';
  return 'other';
}

async function nextMedicineId(coll) {
  const docs = await coll
    .find({ medicineId: { $regex: /^MED-\d+$/ } })
    .project({ medicineId: 1 })
    .toArray();
  let maxNum = 0;
  for (const d of docs) {
    const m = d.medicineId.match(/MED-(\d+)/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `MED-${String(maxNum + 1).padStart(4, '0')}`;
}

async function buildNewMedicineDocument(coll, itemName, unitRaw) {
  const now = new Date();
  const medicineId = await nextMedicineId(coll);
  return {
    _id: new ObjectId(),
    medicineId,
    name: itemName.trim(),
    genericName: null,
    manufacturer: null,
    category: inferMedicineCategory(itemName, unitRaw),
    composition: null,
    strength: null,
    packSize: 1,
    packUnit: mapCsvUnitToPackUnit(unitRaw),
    hsnCode: null,
    gstRate: 0,
    reorderLevel: 0,
    rackLocation: null,
    isScheduled: false,
    scheduleType: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdFromStockImport: true,
  };
}

/**
 * When CSV item_name has no catalog match, optionally insert a minimal medicines row (live) or a stub (dry-run).
 */
async function ensureMedicineForCsvRow({
  db,
  medicines,
  itemName,
  unitRaw,
  normCsv,
  dryRun,
}) {
  const nameTrim = itemName.trim();
  let m = medicines.find((x) => normName(x.name) === normCsv);
  if (m) return { medicine: m, created: false };

  if (!dryRun) {
    const coll = db.collection(MEDICINES_COLL);
    const existing = await coll.findOne({
      name: { $regex: `^${escapeRegex(nameTrim)}$`, $options: 'i' },
    });
    if (existing) {
      medicines.push(existing);
      return { medicine: existing, created: false };
    }
    const doc = await buildNewMedicineDocument(coll, nameTrim, unitRaw);
    await coll.insertOne(doc);
    medicines.push(doc);
    return { medicine: doc, created: true };
  }

  const now = new Date();
  m = {
    _id: new ObjectId(),
    medicineId: 'DRY-RUN',
    name: nameTrim,
    genericName: null,
    manufacturer: null,
    category: inferMedicineCategory(nameTrim, unitRaw),
    composition: null,
    strength: null,
    packSize: 1,
    packUnit: mapCsvUnitToPackUnit(unitRaw),
    hsnCode: null,
    gstRate: 0,
    reorderLevel: 0,
    rackLocation: null,
    isScheduled: false,
    scheduleType: 'none',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  medicines.push(m);
  return { medicine: m, created: true };
}

function parseDdMmYyyy(s) {
  if (!s || !String(s).trim()) return null;
  const parts = String(s).trim().split(/[-/]/);
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;
  return new Date(year, month, day);
}

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Last day of month (local), for expiry end-of-month */
function parseExpiryMonthYear(raw) {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw)
    .trim()
    .replace(/\./g, '')
    .toLowerCase();
  const m = s.match(/^([a-z]+)\s*,?\s*(\d{4})$/);
  if (!m) return null;
  const monKey = m[1].slice(0, 3);
  const year = parseInt(m[2], 10);
  const monthIdx = MONTHS[monKey];
  if (monthIdx === undefined || Number.isNaN(year)) return null;
  return new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
}

function defaultExpiryFromPurchase(purchaseDate, addYears) {
  const years = Number.isFinite(addYears) && addYears > 0 ? Math.floor(addYears) : 10;
  const d = new Date(purchaseDate);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function loadOverrides(overridesPath) {
  if (!fs.existsSync(overridesPath)) return {};
  try {
    const raw = fs.readFileSync(overridesPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read overrides: ${overridesPath}`, e.message);
    process.exit(1);
  }
}

/**
 * Use the database from the connection string path when MONGODB_DB_NAME is unset,
 * e.g. mongodb+srv://host/aviawellness?… → aviawellness (not clinic_db).
 */
function extractDbNameFromMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const noQuery = uri.split('?')[0];
  const pos = noQuery.indexOf('//');
  if (pos === -1) return null;
  const after = noQuery.slice(pos + 2);
  const slash = after.indexOf('/');
  if (slash === -1 || slash >= after.length - 1) return null;
  const name = after.slice(slash + 1).trim();
  return name || null;
}

/**
 * Many spreadsheets export month+year as `Feb.,2027` without quoting the field.
 * The comma splits RFC-4180 CSV into an extra column and shifts `unit` into
 * `opening_qty` (shows as invalid / "TAB.").
 */
function repairCsvUnquotedMonthYearExpiry(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    if (i > 0 && line.trim()) {
      line = line.replace(/,([A-Za-z]{3,12}\.,\d{4}),/g, ',"$1",');
      line = line.replace(/,([A-Za-z]{3,12},\d{4}),/g, ',"$1",');
    }
    out.push(line);
  }
  return out.join('\n');
}

function resolveMedicineForRow(rowItemName, normCsv, medicines, overrideValue) {
  if (overrideValue) {
    if (typeof overrideValue === 'string') {
      if (ObjectId.isValid(overrideValue)) {
        const id = new ObjectId(overrideValue);
        const m = medicines.find((x) => x._id.equals(id));
        if (m) return m;
      }
      const byCode = medicines.find((x) => x.medicineId === overrideValue);
      if (byCode) return byCode;
      const byName = medicines.find((x) => normName(x.name) === normName(overrideValue));
      if (byName) return byName;
      return null;
    }
    if (overrideValue.objectId && ObjectId.isValid(overrideValue.objectId)) {
      const id = new ObjectId(overrideValue.objectId);
      const m = medicines.find((x) => x._id.equals(id));
      if (m) return m;
    }
    if (overrideValue.medicineId) {
      const m = medicines.find((x) => x.medicineId === overrideValue.medicineId);
      if (m) return m;
    }
    if (overrideValue.name) {
      const m = medicines.find((x) => normName(x.name) === normName(overrideValue.name));
      if (m) return m;
    }
    return null;
  }

  const exact = medicines.find((x) => normName(x.name) === normCsv);
  if (exact) return exact;

  const candidates = csvMatchCandidates(normCsv);
  let best = null;
  let bestLen = -1;
  for (const m of medicines) {
    const mn = normName(m.name);
    if (!mn) continue;
    for (const c of candidates) {
      if (!c) continue;
      if (c.includes(mn) || mn.includes(c)) {
        if (mn.length > bestLen) {
          bestLen = mn.length;
          best = m;
        }
        break;
      }
    }
  }
  if (best) return best;

  const csvCore = alnumCore(normCsv);
  if (csvCore.length < 4) return null;
  best = null;
  bestLen = -1;
  for (const m of medicines) {
    const mc = alnumCore(m.name);
    if (!mc || mc.length < 3) continue;
    if (csvCore.includes(mc) || mc.includes(csvCore)) {
      if (mc.length > bestLen) {
        bestLen = mc.length;
        best = m;
      }
    }
  }
  return best;
}

function batchDocShape({
  medicine,
  batchNo,
  qty,
  expiryDate,
  purchaseDate,
  defaultMrp,
  defaultPurchase,
  defaultSelling,
  supplierLabel,
  csvUnit,
  dataRow,
}) {
  const now = new Date();
  const reorder = Number(medicine.reorderLevel) || 0;
  const status = qty <= reorder ? STOCK_STATUS.LOW : STOCK_STATUS.ACTIVE;
  const remarksParts = [`opening-csv row ${dataRow}`];
  if (csvUnit) remarksParts.push(`unit=${csvUnit}`);
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
    purchasePrice: defaultPurchase,
    mrp: defaultMrp,
    sellingPrice: defaultSelling,
    gstRate: Number(medicine.gstRate) || 0,
    status,
    remarks: remarksParts.join('; '),
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const { positional, dryRun, noDelete, createMissingMedicines } = parseArgs(process.argv.slice(2));
  const csvPath = positional[0];

  if (!csvPath) {
    console.error(
      'Usage: node scripts/import-medicine-stock-from-csv.mjs <file.csv> [--dry-run] [--no-delete] [--create-missing-medicines]',
    );
    process.exit(1);
  }

  const absoluteCsv = path.isAbsolute(csvPath) ? csvPath : path.join(process.cwd(), csvPath);
  if (!fs.existsSync(absoluteCsv)) {
    console.error(`CSV not found: ${absoluteCsv}`);
    process.exit(1);
  }

  const overridesPath = process.env.IMPORT_OVERRIDES_PATH || DEFAULT_OVERRIDES_PATH;
  const overrides = loadOverrides(overridesPath);

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required (for dry-run and live import).');
    process.exit(1);
  }

  const dbName =
    process.env.MONGODB_DB_NAME || extractDbNameFromMongoUri(uri) || 'clinic_db';

  const defaultMrp = Number(process.env.IMPORT_DEFAULT_MRP) || 1;
  const defaultPurchase = Number(process.env.IMPORT_DEFAULT_PURCHASE) || 1;
  const defaultSelling = Number(process.env.IMPORT_DEFAULT_SELLING) || defaultMrp;
  const supplierLabel = process.env.IMPORT_SUPPLIER_LABEL || 'opening-balance-import';
  const expiryAddYearsRaw = Number(process.env.IMPORT_EXPIRY_ADD_YEARS);
  const expiryAddYears =
    Number.isFinite(expiryAddYearsRaw) && expiryAddYearsRaw > 0
      ? Math.floor(expiryAddYearsRaw)
      : 10;

  let csvText = fs.readFileSync(absoluteCsv, 'utf8');
  csvText = repairCsvUnquotedMonthYearExpiry(csvText);

  const records = parse(csvText, {
    columns: (header) =>
      header.map((h) =>
        String(h ?? '')
          .replace(/^\ufeff/, '')
          .trim(),
      ),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  let client = null;
  let medicines = [];

  client = new MongoClient(uri);
  await client.connect();
  {
    const db = client.db(dbName);
    medicines = await db
      .collection(MEDICINES_COLL)
      .find({ isActive: { $ne: false } })
      .toArray();
  }

  if (medicines.length === 0) {
    console.error(
      `Warning: 0 medicines in "${dbName}.medicines". ` +
        `If your data is in another database, set MONGODB_DB_NAME. ` +
        `(When unset, the name is taken from your URI path before ?; default fallback is clinic_db.)`,
    );
  }

  const medicinesFromDbCount = medicines.length;
  const dryRunAutoNorms = new Set();
  let medicinesCreatedInRun = 0;

  const db = client.db(dbName);

  if (medicinesFromDbCount > 0 && medicinesFromDbCount < 15 && !createMissingMedicines) {
    console.error(
      `\nHint: Only ${medicinesFromDbCount} medicine(s) in "${dbName}.medicines". ` +
        `To match all CSV rows, import with --create-missing-medicines (or IMPORT_CREATE_MISSING_MEDICINES=1) ` +
        `so each item_name gets a minimal catalog row, or load your full catalog first.\n`,
    );
  }

  const stats = {
    rows: records.length,
    matched: 0,
    unmatched: 0,
    skippedZero: 0,
    clampedLogged: 0,
    toInsert: 0,
  };

  const errors = [];
  const skipLog = [];
  const documents = [];

  let rowIndex = 0;
  for (const rec of records) {
    rowIndex += 1;
    const itemName = rec.item_name ?? rec.itemName ?? '';
    const batchRaw = rec.batch_no ?? rec.batchNo ?? '';
    const expiryRaw = rec.expiry ?? '';
    const openingRaw = rec.opening_balance_date ?? rec.openingBalanceDate ?? '';
    const unitRaw = rec.unit ?? '';

    const openQty = Number(String(rec.opening_qty ?? rec.openingQty ?? '').replace(/,/g, ''));
    const clamped = Number.isFinite(openQty) ? Math.max(0, Math.floor(openQty)) : 0;
    if (!Number.isFinite(openQty)) {
      const raw = rec.opening_qty ?? rec.openingQty ?? '';
      errors.push({
        row: rowIndex,
        itemName,
        reason: 'invalid opening_qty',
        raw: String(raw).slice(0, 40),
        hint:
          /tab\.?/i.test(String(raw)) || /box|qty/i.test(String(raw))
            ? 'Columns likely shifted: expiry values like Feb.,2027 must be quoted in CSV, or use this script (auto-repairs Month.,Year commas).'
            : undefined,
      });
      continue;
    }
    if (openQty < 0) {
      stats.clampedLogged += 1;
      skipLog.push({ row: rowIndex, itemName, batch: batchRaw, note: `clamped negative ${openQty} -> ${clamped}` });
    }
    if (clamped === 0) {
      stats.skippedZero += 1;
      continue;
    }

    const normCsv = normName(itemName);
    if (!normCsv) {
      errors.push({ row: rowIndex, reason: 'empty item_name' });
      continue;
    }

    const overrideKey = itemName.trim();
    const overrideVal =
      overrides[overrideKey] ?? overrides[itemName] ?? overrides[normCsv];

    let medicine = resolveMedicineForRow(itemName, normCsv, medicines, overrideVal);

    if (!medicine && createMissingMedicines) {
      const ensured = await ensureMedicineForCsvRow({
        db,
        medicines,
        itemName,
        unitRaw,
        normCsv,
        dryRun,
      });
      medicine = ensured.medicine;
      if (ensured.created) {
        if (dryRun) dryRunAutoNorms.add(normCsv);
        else medicinesCreatedInRun += 1;
      }
    }

    if (!medicine) {
      stats.unmatched += 1;
      errors.push({
        row: rowIndex,
        itemName,
        reason: createMissingMedicines
          ? 'no matching medicine after auto-create (unexpected)'
          : 'no matching medicine (add override, fix name, or use --create-missing-medicines)',
      });
      continue;
    }

    stats.matched += 1;

    const purchaseDate = parseDdMmYyyy(openingRaw) || new Date();
    let expiryDate = parseExpiryMonthYear(expiryRaw);
    if (!expiryDate) {
      expiryDate = defaultExpiryFromPurchase(purchaseDate, expiryAddYears);
    }

    const batchNo = String(batchRaw).trim() || `UNKNOWN-${rowIndex}`;

    documents.push(
      batchDocShape({
        medicine,
        batchNo,
        qty: clamped,
        expiryDate,
        purchaseDate,
        defaultMrp,
        defaultPurchase,
        defaultSelling,
        supplierLabel,
        csvUnit: String(unitRaw).trim(),
        dataRow: rowIndex,
      })
    );
    stats.toInsert += 1;
  }

  const existingBatches = await client
    .db(dbName)
    .collection(BATCHES_COLL)
    .countDocuments({});

  const summary = {
    database: dbName,
    createMissingMedicines,
    medicinesFromDatabase: medicinesFromDbCount,
    stats,
    overrideFile: overridesPath,
    ...(dryRun && {
      dryRunPlan: {
        wouldDeleteBatches: noDelete ? 0 : existingBatches,
        wouldInsertBatches: documents.length,
        noDeleteFlag: noDelete,
        ...(createMissingMedicines && { wouldAutoCreateMedicines: dryRunAutoNorms.size }),
      },
    }),
    ...(!dryRun && createMissingMedicines && { medicinesCreatedInRun: medicinesCreatedInRun }),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (errors.length) {
    console.error('\nIssues (first 50):');
    console.error(JSON.stringify(errors.slice(0, 50), null, 2));
    if (errors.length > 50) console.error(`... and ${errors.length - 50} more`);
  }

  if (skipLog.length && process.env.IMPORT_VERBOSE === '1') {
    console.error('\nClamp/skip log (verbose):');
    console.error(JSON.stringify(skipLog, null, 2));
  }

  const fatal = errors.length > 0;
  if (fatal && !dryRun) {
    console.error('\nAborting: fix issues above (unmatched medicines, invalid rows, etc.), then re-run.');
    await client.close();
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n[dry-run] No writes performed.');
    await client.close();
    process.exit(fatal ? 1 : 0);
  }

  const coll = db.collection(BATCHES_COLL);

  if (!noDelete) {
    const del = await coll.deleteMany({});
    console.log(`Deleted existing stock batches: ${del.deletedCount}`);
  }

  const chunk = 500;
  for (let i = 0; i < documents.length; i += chunk) {
    const slice = documents.slice(i, i + chunk);
    if (slice.length) await coll.insertMany(slice, { ordered: false });
  }

  console.log(`Inserted batches: ${documents.length}`);
  if (createMissingMedicines) {
    console.log(`New medicines inserted (catalog): ${medicinesCreatedInRun}`);
  }
  await client.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
