import { SCHEDULE_TYPE } from '@shared/constants/enums.js';
import { getMedicineRowPrices } from './medicinePrice';

export const MEDICINE_CATEGORIES = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'injection', label: 'Injection' },
  { value: 'cream', label: 'Cream/Ointment' },
  { value: 'drops', label: 'Drops' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'other', label: 'Other' },
];

export const SCHEDULE_TYPE_SELECT = [
  { value: SCHEDULE_TYPE.NONE, label: 'None' },
  { value: SCHEDULE_TYPE.H, label: 'H' },
  { value: SCHEDULE_TYPE.H1, label: 'H1' },
  { value: SCHEDULE_TYPE.X, label: 'X' },
];

export function getInitialMedicineForm() {
  return {
    name: '',
    genericName: '',
    category: 'tablet',
    manufacturer: '',
    composition: '',
    strength: '',
    packSize: 10,
    packUnit: 'tablets',
    reorderLevel: 20,
    gstRate: 12,
    hsnCode: '',
    rackLocation: '',
    isScheduled: false,
    scheduleType: SCHEDULE_TYPE.NONE,
    purchasePrice: '',
    sellingPrice: '',
    syncBatchPrices: true,
  };
}

export function medicineRowToForm(row) {
  const { purchase, selling } = getMedicineRowPrices(row);
  return {
    name: row.name || '',
    genericName: row.genericName || '',
    category: row.category || 'tablet',
    manufacturer: row.manufacturer || '',
    composition: row.composition || '',
    strength: row.strength || '',
    packSize: row.packSize ?? 10,
    packUnit: row.packUnit || 'tablets',
    reorderLevel: row.reorderLevel ?? 20,
    gstRate: row.gstRate ?? 12,
    hsnCode: row.hsnCode || '',
    rackLocation: row.rackLocation || '',
    isScheduled: Boolean(row.isScheduled),
    scheduleType: row.scheduleType || SCHEDULE_TYPE.NONE,
    purchasePrice: purchase != null && purchase !== '' ? String(purchase) : '',
    sellingPrice: selling != null && selling !== '' ? String(selling) : '',
    syncBatchPrices: true,
  };
}

export function validateMedicineForm(form) {
  const purchaseRaw = form.purchasePrice;
  const sellingRaw = form.sellingPrice;

  if (purchaseRaw !== '') {
    const n = Number(purchaseRaw);
    if (Number.isNaN(n) || n < 0) return 'Invalid purchase price';
  }
  if (sellingRaw !== '') {
    const n = Number(sellingRaw);
    if (Number.isNaN(n) || n < 0) return 'Invalid selling price';
  }
  if (!form.name?.trim()) return 'Medicine name is required';
  return null;
}

export function buildMedicinePayload(form, { isEdit }) {
  const purchaseRaw = form.purchasePrice;
  const sellingRaw = form.sellingPrice;

  const payload = {
    name: form.name.trim(),
    genericName: form.genericName.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    category: form.category,
    composition: form.composition.trim() || null,
    strength: form.strength.trim() || null,
    packSize: Number(form.packSize),
    packUnit: form.packUnit.trim(),
    reorderLevel: Number(form.reorderLevel),
    gstRate: Number(form.gstRate) || 0,
    hsnCode: form.hsnCode.trim() || null,
    rackLocation: form.rackLocation.trim() || null,
    isScheduled: Boolean(form.isScheduled),
    scheduleType: form.scheduleType || SCHEDULE_TYPE.NONE,
  };

  if (purchaseRaw === '') {
    if (isEdit) payload.purchasePrice = null;
  } else {
    payload.purchasePrice = Number(purchaseRaw);
  }

  if (sellingRaw === '') {
    if (isEdit) payload.sellingPrice = null;
  } else {
    payload.sellingPrice = Number(sellingRaw);
  }

  if (isEdit && form.syncBatchPrices) {
    payload.syncBatchPrices = true;
  }

  return payload;
}
