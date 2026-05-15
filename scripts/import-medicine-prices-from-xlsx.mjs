#!/usr/bin/env node
/**
 * Import medicine purchase / selling prices from Excel into MongoDB.
 *
 * Default file: public/medicineprice.xlsx (sheet "Extracted Price List")
 * Expected columns: Medicine Name / Description, Prate (purchase), M.R.P. (sale/MRP)
 *
 * Usage:
 *   node scripts/import-medicine-prices-from-xlsx.mjs [path.xlsx] [--dry-run]
 *   node scripts/import-medicine-prices-from-xlsx.mjs --suggest-only
 *   npm run import:medicine-prices -- [--dry-run] [--suggest]
 *
 * Env:
 *   MONGODB_URI (required)
 *   MONGODB_DB_NAME (optional; else parsed from URI path, else clinic_db)
 *   IMPORT_OVERRIDES_PATH (default scripts/stock-import-overrides.json)
 *   IMPORT_PRICE_SHEET (default: Extracted Price List)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { MongoClient } from 'mongodb';
import {
  normalizeMedicineLabel,
  extractDbNameFromMongoUri,
  resolveMedicineForRow,
  rankMedicineMatches,
  scoreMedicineNameMatch,
} from './lib/medicine-import-match.mjs';
import { buildNewMedicineFromPrice } from './lib/medicine-catalog-create.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MEDICINES_COLL = 'medicines';
const BATCHES_COLL = 'medicine_stock_batches';
const DEFAULT_XLSX = path.join(process.cwd(), 'public', 'medicineprice.xlsx');
const DEFAULT_OVERRIDES_PATH = path.join(__dirname, 'stock-import-overrides.json');
const DEFAULT_ALIASES_PATH = path.join(__dirname, 'price-import-aliases.json');

const CATALOG_CREATE_BLOCKLIST = new Set(['gel', 'gummies', 'xyz', 'tab', 'syp', 'cap', 'inj']);

function shouldCreateCatalogName(name) {
  const n = normalizeMedicineLabel(name);
  return n.length >= 5 && !CATALOG_CREATE_BLOCKLIST.has(n);
}

/** Load .env from project root when MONGODB_URI is not already set (local runs). */
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

const NAME_HEADERS = [
  'medicine name / description',
  'medicine name',
  'item_name',
  'item name',
  'name',
  'description',
  'product',
];

const PURCHASE_HEADERS = ['prate', 'purchase', 'purchase price', 'purchase_price', 'rate_a'];
const SELLING_HEADERS = ['m.r.p.', 'mrp', 'm.r.p', 'selling', 'selling price', 'sale price', 'rate'];

function parseArgs(argv) {
  let dryRun = false;
  let catalogOnly = false;
  let batchesOnly = false;
  let suggest = false;
  let suggestOnly = false;
  let writeOverrides = false;
  let createMissingMedicines = false;
  const positional = [];

  for (const a of argv) {
    if (a === '--dry-run' || a === '-n') dryRun = true;
    else if (a === '--catalog-only') catalogOnly = true;
    else if (a === '--batches-only') batchesOnly = true;
    else if (a === '--suggest') suggest = true;
    else if (a === '--suggest-only') {
      suggest = true;
      suggestOnly = true;
      dryRun = true;
    } else if (a === '--write-overrides') writeOverrides = true;
    else if (a === '--create-missing-medicines') createMissingMedicines = true;
    else if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else positional.push(a);
  }

  const updateCatalog = !batchesOnly && !suggestOnly;
  const updateBatches = !catalogOnly && !suggestOnly;

  return {
    positional,
    dryRun,
    updateCatalog,
    updateBatches,
    suggest,
    suggestOnly,
    writeOverrides,
    createMissingMedicines,
  };
}

function loadJsonFile(filePath, label) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data && typeof data._comment === 'string') delete data._comment;
    return data;
  } catch (e) {
    console.error(`Failed to read ${label}: ${filePath}`, e.message);
    process.exit(1);
  }
}

function normalizeHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildHeaderMap(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const key = normalizeHeader(cell);
    if (key) map[key] = idx;
  });
  return map;
}

function findColumnIndex(headerMap, candidates) {
  for (const c of candidates) {
    if (headerMap[c] !== undefined) return headerMap[c];
  }
  return -1;
}

function cellValue(row, idx) {
  if (idx < 0 || idx >= row.length) return '';
  const v = row[idx];
  if (v == null) return '';
  return v;
}

function parsePrice(raw) {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function resolvePricesFromRow(row, nameIdx, purchaseIdx, sellingIdx, rateAIdx) {
  const prate = parsePrice(cellValue(row, purchaseIdx));
  const rateA = rateAIdx >= 0 ? parsePrice(cellValue(row, rateAIdx)) : null;
  const mrp = parsePrice(cellValue(row, sellingIdx));

  let purchasePrice = null;
  if (prate != null && prate > 0) purchasePrice = prate;
  else if (rateA != null && rateA > 0) purchasePrice = rateA;

  const sellingPrice = mrp != null && mrp > 0 ? mrp : null;

  return { purchasePrice, sellingPrice, mrp: sellingPrice };
}

function readPriceRows(absoluteXlsx, sheetNameEnv) {
  const wb = XLSX.readFile(absoluteXlsx, { cellDates: false });
  const preferred = sheetNameEnv || 'Extracted Price List';
  const sheetName = wb.SheetNames.includes(preferred)
    ? preferred
    : wb.SheetNames[0];

  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!matrix.length) {
    return { sheetName, rows: [] };
  }

  const headerMap = buildHeaderMap(matrix[0]);
  const nameIdx = findColumnIndex(headerMap, NAME_HEADERS);
  const purchaseIdx = findColumnIndex(headerMap, PURCHASE_HEADERS);
  const sellingIdx = findColumnIndex(headerMap, SELLING_HEADERS);
  const rateAIdx = findColumnIndex(headerMap, ['rate_a', 'rate a']);

  if (nameIdx < 0) {
    console.error('Could not find medicine name column. Headers:', Object.keys(headerMap).join(', '));
    process.exit(1);
  }
  if (purchaseIdx < 0 && sellingIdx < 0) {
    console.error('Could not find Prate or M.R.P. / MRP column in sheet.');
    process.exit(1);
  }

  const rows = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    const name = String(cellValue(row, nameIdx)).trim();
    if (!name) continue;

    const prices = resolvePricesFromRow(row, nameIdx, purchaseIdx, sellingIdx, rateAIdx);
    if (prices.purchasePrice == null && prices.sellingPrice == null) {
      rows.push({ excelRow: i + 1, name, prices, skipNoPrices: true });
      continue;
    }

    rows.push({ excelRow: i + 1, name, prices, skipNoPrices: false });
  }

  return { sheetName, rows, columns: { nameIdx, purchaseIdx, sellingIdx, rateAIdx } };
}

async function main() {
  loadDotEnv();

  let {
    positional,
    dryRun,
    updateCatalog,
    updateBatches,
    suggest,
    suggestOnly,
    writeOverrides,
    createMissingMedicines,
  } = parseArgs(process.argv.slice(2));
  if (writeOverrides) suggest = true;
  const xlsxPath = positional[0] || DEFAULT_XLSX;
  const absoluteXlsx = path.isAbsolute(xlsxPath) ? xlsxPath : path.join(process.cwd(), xlsxPath);

  if (!fs.existsSync(absoluteXlsx)) {
    console.error(`Excel file not found: ${absoluteXlsx}`);
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
  const aliasesPath = process.env.IMPORT_PRICE_ALIASES_PATH || DEFAULT_ALIASES_PATH;
  const overrides = loadJsonFile(overridesPath, 'overrides');
  const aliasMap = loadJsonFile(aliasesPath, 'aliases');

  const { sheetName, rows, columns } = readPriceRows(
    absoluteXlsx,
    process.env.IMPORT_PRICE_SHEET,
  );

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const medicines = await db
    .collection(MEDICINES_COLL)
    .find({ isActive: { $ne: false } })
    .toArray();

  const summary = {
    dryRun,
    database: dbName,
    file: absoluteXlsx,
    sheet: sheetName,
    columns,
    medicinesInDb: medicines.length,
    excelRows: rows.length,
    matched: 0,
    unmatched: [],
    skippedNoPrices: 0,
    catalogUpdates: 0,
    batchDocumentsUpdated: 0,
    duplicateExcelNames: [],
    createdMedicines: 0,
    wouldCreateMedicines: 0,
    weakMatches: [],
    minMatchScore: Number(process.env.IMPORT_PRICE_MIN_SCORE) || 0.72,
    samples: [],
  };

  const seenNorm = new Map();

  try {
    for (const entry of rows) {
      if (entry.skipNoPrices) {
        summary.skippedNoPrices += 1;
        continue;
      }

      const normCsv = normalizeMedicineLabel(entry.name);
      const overrideValue =
        overrides[entry.name] ?? overrides[normCsv] ?? overrides[normalizeMedicineLabel(entry.name)];
      let medicine = resolveMedicineForRow(
        entry.name,
        normCsv,
        medicines,
        overrideValue,
        aliasMap,
      );

      if (
        !medicine &&
        createMissingMedicines &&
        shouldCreateCatalogName(entry.name)
      ) {
        if (dryRun || suggestOnly) {
          summary.wouldCreateMedicines += 1;
        } else {
          const coll = db.collection(MEDICINES_COLL);
          const doc = await buildNewMedicineFromPrice(coll, entry.name, entry.prices);
          await coll.insertOne(doc);
          medicines.push(doc);
          medicine = doc;
          summary.createdMedicines += 1;
        }
      }

      if (!medicine) {
        const item = {
          excelRow: entry.excelRow,
          name: entry.name,
        };
        if (suggest || suggestOnly) {
          item.suggestions = rankMedicineMatches(entry.name, medicines, 5).map((r) => ({
            score: Number(r.score.toFixed(3)),
            medicineId: r.medicine.medicineId,
            dbName: r.medicine.name,
          }));
        }
        summary.unmatched.push(item);
        continue;
      }

      const matchScore = overrideValue
        ? 1
        : scoreMedicineNameMatch(entry.name, medicine.name);
      if (matchScore < 0.82 && summary.weakMatches.length < 30) {
        summary.weakMatches.push({
          excelRow: entry.excelRow,
          excelName: entry.name,
          medicineId: medicine.medicineId,
          dbName: medicine.name,
          score: Number(matchScore.toFixed(3)),
        });
      }

      if (seenNorm.has(normCsv)) {
        summary.duplicateExcelNames.push({
          name: entry.name,
          previousRow: seenNorm.get(normCsv),
          excelRow: entry.excelRow,
          medicineId: medicine.medicineId,
        });
      }
      seenNorm.set(normCsv, entry.excelRow);

      summary.matched += 1;

      const catalogSet = { updatedAt: new Date() };
      if (entry.prices.purchasePrice != null) catalogSet.purchasePrice = entry.prices.purchasePrice;
      if (entry.prices.sellingPrice != null) catalogSet.sellingPrice = entry.prices.sellingPrice;

      const batchSet = { updatedAt: new Date() };
      if (entry.prices.purchasePrice != null) batchSet.purchasePrice = entry.prices.purchasePrice;
      if (entry.prices.sellingPrice != null) {
        batchSet.mrp = entry.prices.sellingPrice;
        batchSet.sellingPrice = entry.prices.sellingPrice;
      }

      if (summary.samples.length < 5) {
        summary.samples.push({
          excelRow: entry.excelRow,
          excelName: entry.name,
          medicineId: medicine.medicineId,
          dbName: medicine.name,
          matchScore: Number(matchScore.toFixed(3)),
          prices: entry.prices,
        });
      }

      if (suggestOnly) {
        summary.matched += 1;
        continue;
      }

      if (dryRun) {
        if (updateCatalog && Object.keys(catalogSet).length > 1) summary.catalogUpdates += 1;
        if (updateBatches && Object.keys(batchSet).length > 1) {
          const count = await db.collection(BATCHES_COLL).countDocuments({
            medicineId: medicine._id,
          });
          summary.batchDocumentsUpdated += count;
        }
        continue;
      }

      if (updateCatalog && Object.keys(catalogSet).length > 1) {
        await db.collection(MEDICINES_COLL).updateOne(
          { _id: medicine._id },
          { $set: catalogSet },
        );
        summary.catalogUpdates += 1;
      }

      if (updateBatches && Object.keys(batchSet).length > 1) {
        const batchResult = await db.collection(BATCHES_COLL).updateMany(
          { medicineId: medicine._id },
          { $set: batchSet },
        );
        summary.batchDocumentsUpdated += batchResult.modifiedCount;
      }
    }
  } finally {
    await client.close();
  }

  if (writeOverrides && summary.unmatched.length > 0) {
    const minOverrideScore = Number(process.env.IMPORT_OVERRIDE_MIN_SCORE) || 0.88;
    const merged = { ...overrides };
    let added = 0;
    for (const row of summary.unmatched) {
      const top = row.suggestions?.[0];
      if (!top || top.score < minOverrideScore) continue;
      if (merged[row.name]) continue;
      merged[row.name] = { medicineId: top.medicineId };
      added += 1;
    }
    if (added > 0) {
      fs.writeFileSync(overridesPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
      console.error(
        `Wrote ${added} high-confidence mapping(s) to ${overridesPath} (score >= ${minOverrideScore}). Re-run --dry-run.`,
      );
    }
  }

  console.log(JSON.stringify(summary, null, 2));

  if (summary.unmatched.length > 0) {
    console.error(
      `\n${summary.unmatched.length} row(s) could not be matched. ` +
        'Run with --suggest-only to see close catalog names, or add mappings to scripts/stock-import-overrides.json.',
    );
    if (!suggest && !suggestOnly) {
      console.error('Tip: npm run import:medicine-prices -- --suggest-only');
    }
    process.exit(suggestOnly ? 0 : summary.matched > 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
