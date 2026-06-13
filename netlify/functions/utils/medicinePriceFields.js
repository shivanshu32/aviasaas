/**
 * Normalize medicine documents for UI: expose mrp + display prices from catalog and/or batches.
 */
function computeWeightedAverages(stockBatches) {
  if (!stockBatches || stockBatches.length === 0) return {};
  const totalQty = stockBatches.reduce((s, b) => s + (b.qty || 0), 0);
  if (totalQty === 0) return {};
  const weightedAvgMrp =
    stockBatches.reduce((s, b) => s + (Number(b.mrp) || 0) * (b.qty || 0), 0) / totalQty;
  const weightedAvgSellingPrice =
    stockBatches.reduce((s, b) => s + (Number(b.sellingPrice) || 0) * (b.qty || 0), 0) / totalQty;
  const weightedAvgPurchasePrice =
    stockBatches.reduce((s, b) => s + (Number(b.purchasePrice) || 0) * (b.qty || 0), 0) / totalQty;
  return { weightedAvgMrp, weightedAvgSellingPrice, weightedAvgPurchasePrice };
}

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

  const weighted = computeWeightedAverages(doc.stockBatches);

  return {
    ...doc,
    displayPurchasePrice,
    displaySellingPrice,
    mrp,
    ...weighted,
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
};
