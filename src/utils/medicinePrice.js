/** Format rupee amount for tables; returns em dash when missing or zero. */
export function formatMedicinePrice(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `₹${n.toFixed(2)}`;
}

/** Resolve purchase / sale from API-enriched medicine row. Batch prices are authoritative. */
export function getMedicineRowPrices(row) {
  const purchase =
    row?.batchPurchasePrice ??
    row?.displayPurchasePrice ??
    row?.purchasePrice ??
    null;
  const selling =
    row?.batchSellingPrice ??
    row?.batchMrp ??
    row?.displaySellingPrice ??
    row?.mrp ??
    row?.sellingPrice ??
    null;
  return { purchase, selling };
}
