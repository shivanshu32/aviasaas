/**
 * Medicine bill header totals from line items.
 * - subtotal: gross (qty × selling price) before line discounts
 * - discountAmount: sum of line discounts
 * - grandTotal: rounded net (subtotal − discountAmount, per-line rounding)
 */

export function computeMedicineBillTotals(items) {
  const list = items || [];
  const subtotal = list.reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0) * Number(item.sellingPrice ?? item.mrp ?? 0),
    0,
  );
  const discountAmount = list.reduce(
    (sum, item) => sum + Number(item.discount || 0),
    0,
  );
  const taxableAmount = list.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const grandTotal = Math.round(taxableAmount);
  const roundOff = grandTotal - taxableAmount;

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    cgst: 0,
    sgst: 0,
    grandTotal,
    roundOff,
  };
}

/** Prefer line-item math so older saved bills still print correctly. */
export function getMedicineBillDisplayTotals(bill) {
  if (bill?.items?.length) {
    return computeMedicineBillTotals(bill.items);
  }
  return {
    subtotal: Number(bill?.subtotal) || 0,
    discountAmount: Number(bill?.discountAmount) || 0,
    taxableAmount: Number(bill?.taxableAmount) || 0,
    grandTotal: Number(bill?.grandTotal) || 0,
    roundOff: Number(bill?.roundOff) || 0,
  };
}
