# Medicine stock CSV import (MongoDB)

## Prerequisites

- Node 18+
- `MONGODB_URI` (MongoDB Atlas or local) with access to the clinic database
- Either an existing **`medicines`** catalog, **or** use **`--create-missing-medicines`** so the script inserts minimal medicine rows for each distinct CSV `item_name`

## Sparse medicine catalog

If `medicinesFromDatabase` in the dry-run output is very small (e.g. 3) but the CSV lists many products, stock import **cannot** link batches to the catalog until those names exist. Options:

1. **`--create-missing-medicines`** (or `IMPORT_CREATE_MISSING_MEDICINES=1`) — inserts one `medicines` document per distinct unmatched `item_name` (defaults: `category` inferred from text, `packSize` 1, `packUnit` from CSV unit, `reorderLevel` 0). Then imports all batches.
2. Load your full catalog first (API, migration, or Compass), then import stock **without** `--create-missing-medicines`.

## Backup (strongly recommended)

Replacing stock **deletes all documents** in `medicine_stock_batches`. Historical medicine bills may still store old `batchId` values; those references will no longer resolve to a batch document.

**Atlas:** use [Cloud Backup / snapshot](https://www.mongodb.com/docs/atlas/backup/cloud-backup/) for your cluster, or **Export** the `medicine_stock_batches` collection from Compass before running.

**mongodump example:**

```bash
mongodump --uri="$MONGODB_URI" --db=clinic_db --collection=medicine_stock_batches --out=./mongo-backup-stock
```

## CSV gotchas

- **Expiry must not break columns:** Values like `Feb.,2027` contain a comma. If the file is not saved with quotes (`"Feb.,2027"`), Excel and some exports split that into two fields and **shift** `TAB.` into the quantity column (import then reports `invalid opening_qty`). The import script **auto-repairs** common `Month.,Year` patterns; if problems remain, quote those cells in Excel or run **Find & Replace** to wrap them in double quotes.

## CSV format

Header row (required):

`item_name,batch_no,expiry,opening_balance_date,unit,opening_qty`

- **expiry:** values like `Feb.,2027` (month + year). Blank expiry defaults to purchase date + 10 years.
- **opening_balance_date:** `DD-MM-YYYY` (e.g. `05-01-2027` = 5 Jan 2027).
- **opening_qty:** integers; negatives are clamped to `0` and skipped (no batch inserted).
- **batch_no:** if empty, the script uses `UNKNOWN-<rowNumber>`.

## Environment variables

| Variable | Default | Description |
|----------|---------|---------------|
| `MONGODB_URI` | (required) | Connection string |
| `MONGODB_DB_NAME` | **Parsed from URI path** if present (e.g. `.../aviawellness?`), otherwise `clinic_db` | Database that holds `medicines` / `medicine_stock_batches` |
| `IMPORT_DEFAULT_MRP` | `1` | Placeholder MRP on each batch |
| `IMPORT_DEFAULT_PURCHASE` | `1` | Placeholder purchase price |
| `IMPORT_DEFAULT_SELLING` | same as MRP | Selling price |
| `IMPORT_SUPPLIER_LABEL` | `opening-balance-import` | Stored in `supplier` |
| `IMPORT_EXPIRY_ADD_YEARS` | `10` | When CSV `expiry` is blank, set expiry to `purchaseDate` plus this many years |
| `IMPORT_CREATE_MISSING_MEDICINES` | unset | Set `1` or `true` to auto-create `medicines` rows for each CSV `item_name` with no match (same as `--create-missing-medicines`) |
| `IMPORT_OVERRIDES_PATH` | `scripts/stock-import-overrides.json` | Optional path to overrides JSON |
| `IMPORT_VERBOSE` | unset | Set to `1` to print clamp/skip details |

## Overrides

If a CSV `item_name` does not match any `medicines.name` (after normalization), add a mapping in `scripts/stock-import-overrides.json`. Copy from `stock-import-overrides.example.json`.

Supported values per key:

- String: `medicineId` (e.g. `MED-0123`), or 24-hex ObjectId, or exact medicine name
- Object: `{ "medicineId": "..." }`, `{ "objectId": "..." }`, or `{ "name": "..." }`

Keys should match the **exact** `item_name` from the CSV (preferred), or the normalized form used internally.

## Commands

Dry run **does not** change the database. The JSON output includes **`dryRunPlan.wouldDeleteBatches`**, **`dryRunPlan.wouldInsertBatches`**, and with **`--create-missing-medicines`**: **`dryRunPlan.wouldAutoCreateMedicines`** (how many distinct `item_name` values need a new catalog row).

```bash
npm run import:medicine-stock -- path/to/inventory.csv --dry-run
```

Dry run **with** auto-create catalog entries (recommended when `medicines` is nearly empty):

```bash
npm run import:medicine-stock -- path/to/inventory.csv --dry-run --create-missing-medicines
```

Live import (delete all batches, then insert):

```bash
npm run import:medicine-stock -- path/to/inventory.csv
```

Live import **and** create missing `medicines` documents:

```bash
npm run import:medicine-stock -- path/to/inventory.csv --create-missing-medicines
```

Append-only (no delete — use only if you know you need it):

```bash
npm run import:medicine-stock -- path/to/inventory.csv --no-delete
```

## Verification

1. Script exits with code **0** and prints `Inserted batches: N`.
2. **MongoDB Compass:** query `medicine_stock_batches` — spot-check `medicineId`, `batchNo`, `currentQty`, `expiryDate`.
3. **API:** `GET /.netlify/functions/medicine-getCurrentStock` (with your auth if applicable) — totals should reflect positive `currentQty` only.

Example aggregation for batch count per medicine:

```javascript
db.medicine_stock_batches.aggregate([
  { $group: { _id: "$medicineId", batches: { $sum: 1 }, qty: { $sum: "$currentQty" } } },
  { $sort: { qty: -1 } }
])
```
