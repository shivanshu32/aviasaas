import { calcMedicineLineTotal } from './medicineBillLine.js';
import {
  computeMedicineBillTotals,
  getMedicineBillDisplayTotals,
} from '@shared/utils/medicineBillTotals.js';

export { computeMedicineBillTotals, getMedicineBillDisplayTotals };

/** Totals while composing a bill in the UI (form line items). */
export function computeMedicineBillTotalsFromFormItems(items) {
  const normalized = (items || []).map((item) => {
    const line = calcMedicineLineTotal(
      item.quantity,
      item.sellingPrice ?? item.mrp,
      item.discountPercent,
    );
    return {
      quantity: item.quantity,
      sellingPrice: item.sellingPrice ?? item.mrp,
      discount: line.discountAmount,
      amount: line.amount,
    };
  });
  return computeMedicineBillTotals(normalized);
}
