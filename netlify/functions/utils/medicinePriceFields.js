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

  const displayPurchasePrice = batchPurchase ?? catalogPurchase ?? null;
  const displaySellingPrice = batchSelling ?? batchMrp ?? catalogSelling ?? null;
  const mrp = batchMrp ?? batchSelling ?? catalogSelling ?? null;

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
  batchMinMrp: { $min: '$mrp' },
  batchSellingPrice: { $max: '$sellingPrice' },
  batchMinSellingPrice: { $min: '$sellingPrice' },
  batchPurchasePrice: { $max: '$purchasePrice' },
  batchMinPurchasePrice: { $min: '$purchasePrice' },
  nearestExpiry: { $min: '$expiryDate' },
  // weighted averages across batches by currentQty (null if no stock)
  weightedAvgMrp: {
    $cond: [
      { $eq: [{ $sum: '$currentQty' }, 0] },
      null,
      { $divide: [{ $sum: { $multiply: ['$mrp', '$currentQty'] } }, { $sum: '$currentQty' }] },
    ],
  },
  weightedAvgSellingPrice: {
    $cond: [
      { $eq: [{ $sum: '$currentQty' }, 0] },
      null,
      { $divide: [{ $sum: { $multiply: ['$sellingPrice', '$currentQty'] } }, { $sum: '$currentQty' }] },
    ],
  },
  weightedAvgPurchasePrice: {
    $cond: [
      { $eq: [{ $sum: '$currentQty' }, 0] },
      null,
      { $divide: [{ $sum: { $multiply: ['$purchasePrice', '$currentQty'] } }, { $sum: '$currentQty' }] },
    ],
  },
};
