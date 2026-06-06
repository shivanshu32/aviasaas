/**
 * Normalize medicine documents for UI: expose mrp + display prices from catalog and/or batches.
 */
export function enrichMedicineWithPrices(doc) {
  if (!doc) return doc;

  const catalogPurchase =
    doc.purchasePrice != null && doc.purchasePrice > 0 ? doc.purchasePrice : null;
  const catalogSelling =
    doc.sellingPrice != null && doc.sellingPrice > 0 ? doc.sellingPrice : null;

  const batchPurchase =
    doc.batchPurchasePrice != null && doc.batchPurchasePrice > 0
      ? doc.batchPurchasePrice
      : null;
  const batchSelling =
    doc.batchSellingPrice != null && doc.batchSellingPrice > 0
      ? doc.batchSellingPrice
      : null;
  const batchMrp = doc.batchMrp != null && doc.batchMrp > 0 ? doc.batchMrp : null;

  const displayPurchasePrice = catalogPurchase ?? batchPurchase ?? null;
  const displaySellingPrice = catalogSelling ?? batchSelling ?? batchMrp ?? null;
  const mrp = batchMrp ?? catalogSelling ?? batchSelling ?? null;

  return {
    ...doc,
    displayPurchasePrice,
    displaySellingPrice,
    mrp,
  };
}

export function enrichMedicinesWithPrices(list) {
  return (list || []).map(enrichMedicineWithPrices);
}

/** $group stage fields when joining stock batches in getMedicines. */
export const STOCK_PRICE_GROUP_FIELDS = {
  totalStock: { $sum: '$currentQty' },
  batches: {
    $push: {
      batchNo: '$batchNo',
      qty: '$currentQty',
      expiry: '$expiryDate',
      mrp: '$mrp',
      sellingPrice: '$sellingPrice',
      purchasePrice: '$purchasePrice',
    },
  },
  batchMrp: { $max: '$mrp' },
  batchSellingPrice: { $max: '$sellingPrice' },
  batchPurchasePrice: { $max: '$purchasePrice' },
  nearestExpiry: { $min: '$expiryDate' },
};
