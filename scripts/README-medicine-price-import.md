# Medicine price import (Excel → MongoDB)

Updates **purchase** and **sale** prices from `public/medicineprice.xlsx` (or any path you pass). Quantities are **not** changed — use the stock CSV import for that.

## What gets updated

| Target | Fields |
|--------|--------|
| `medicines` | `purchasePrice` (from **Prate**, else **Rate_A** if &gt; 0), `sellingPrice` (from **M.R.P.**) |
| `medicine_stock_batches` | `purchasePrice`, `mrp`, `sellingPrice` for **all** batches linked to each matched medicine |

Billing uses batch prices, so updating batches is required for correct sale amounts.

## Prerequisites

- Node 18+
- `MONGODB_URI` pointing at your **live** database
- `npm install` (includes `xlsx`)
- Medicines and stock batches already in the database (names should match the Excel **Medicine Name / Description** column)

## Commands

Dry run (no writes; shows match counts):

```bash
npm run import:medicine-prices -- --dry-run
```

Live import (default file `public/medicineprice.xlsx`):

```bash
set MONGODB_URI=your_connection_string
npm run import:medicine-prices
```

Custom file:

```bash
npm run import:medicine-prices -- path/to/prices.xlsx
```

Only catalog or only batches:

```bash
npm run import:medicine-prices -- --catalog-only
npm run import:medicine-prices -- --batches-only
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | (required) | MongoDB connection string |
| `MONGODB_DB_NAME` | URI path or `clinic_db` | Database name |
| `IMPORT_OVERRIDES_PATH` | `scripts/stock-import-overrides.json` | Name → catalog mapping (same as stock import) |
| `IMPORT_PRICE_SHEET` | `Extracted Price List` | Worksheet name |

## Unmatched names

Matching uses scored name comparison (not loose substring). Size suffixes (`L`, `M`, `S`, …) must align when both sides have a size.

List close catalog candidates for rows that did not match:

```bash
npm run import:medicine-prices:suggest
```

If a row still cannot be matched, add an entry to `scripts/stock-import-overrides.json` (copy from `stock-import-overrides.example.json`), then re-run.

Optional: lower the auto-match threshold (default `0.72`):

```bash
set IMPORT_PRICE_MIN_SCORE=0.65
npm run import:medicine-prices -- --dry-run
```

Review `weakMatches` in the dry-run JSON for uncertain pairings before a live import.

Auto-add override entries for close name suggestions (score ≥ 0.88):

```bash
npm run import:medicine-prices:suggest -- --write-overrides
npm run import:medicine-prices -- --dry-run
```

Many Excel rows may not exist in your catalog (e.g. 199 prices vs 85 medicines). Options:

1. **Aliases** for OCR/short names — copy [`price-import-aliases.example.json`](price-import-aliases.example.json) to `scripts/price-import-aliases.json` and map Excel text → exact `medicines.name`.
2. **Overrides** in `stock-import-overrides.json` (by `medicineId`).
3. **Create missing catalog rows** from Excel (prices only; does not add stock batches):

```bash
npm run import:medicine-prices:missing -- --dry-run
npm run import:medicine-prices:missing
```

After a live import, re-run without `--create-missing-medicines` to refresh batch prices for newly matched names.

## Backup

Price import only updates price fields, but a backup is still wise before touching production:

```bash
mongodump --uri="%MONGODB_URI%" --collection=medicines --collection=medicine_stock_batches --out=./mongo-backup-prices
```
