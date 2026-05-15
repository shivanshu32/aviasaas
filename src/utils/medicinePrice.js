/** Format rupee amount for tables; returns em dash when missing or zero. */
export function formatMedicinePrice(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `₹${n.toFixed(2)}`;
}

/** Resolve purchase / sale from API-enriched medicine row. */
export function getMedicineRowPrices(row) {
  const purchase =
    row?.displayPurchasePrice ??
    row?.purchasePrice ??
    row?.batchPurchasePrice ??
    null;
  const selling =
    row?.displaySellingPrice ??
    row?.sellingPrice ??
    row?.mrp ??
    row?.batchSellingPrice ??
    row?.batchMrp ??
    null;
  return { purchase, selling };
}
