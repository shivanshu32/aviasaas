/** Per-line medicine bill amount (MRP/selling price × qty, minus line discount %). */
export function calcMedicineLineTotal(quantity, unitPrice, discountPercent = 0) {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const gross = qty * price;
  const discountAmount = Math.round(gross * (pct / 100) * 100) / 100;
  const amount = Math.round((gross - discountAmount) * 100) / 100;
  return { gross, discountPercent: pct, discountAmount, amount };
}
