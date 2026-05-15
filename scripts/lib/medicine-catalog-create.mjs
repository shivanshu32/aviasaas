import { ObjectId } from 'mongodb';

export async function nextMedicineId(coll) {
  const docs = await coll
    .find({ medicineId: { $regex: /^MED-\d+$/ } })
    .project({ medicineId: 1 })
    .toArray();
  let maxNum = 0;
  for (const d of docs) {
    const m = d.medicineId.match(/MED-(\d+)/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `MED-${String(maxNum + 1).padStart(4, '0')}`;
}

export function inferMedicineCategory(itemName) {
  const t = String(itemName).toLowerCase();
  if (/\binj\b|injection/.test(t)) return 'injection';
  if (/syp|syrup/.test(t)) return 'syrup';
  if (/\bcap\b|capsule/.test(t)) return 'capsule';
  if (/\btab\b|tablet/.test(t)) return 'tablet';
  if (/powder|sachet/.test(t)) return 'powder';
  if (/gel|cream|oint|lotion/.test(t)) return 'cream';
  if (/drop|eye|e\/d|e\.d/.test(t)) return 'drops';
  if (/sling|brace|belt|shoe|collar|wrap|splint|mobilizer|elbow|ankle|lumbar|cervical/.test(t)) {
    return 'other';
  }
  return 'other';
}

export async function buildNewMedicineFromPrice(coll, itemName, prices = {}) {
  const now = new Date();
  const medicineId = await nextMedicineId(coll);
  const name = itemName.trim();
  return {
    _id: new ObjectId(),
    medicineId,
    name,
    genericName: null,
    manufacturer: null,
    category: inferMedicineCategory(name),
    composition: null,
    strength: null,
    packSize: 1,
    packUnit: 'piece',
    hsnCode: null,
    gstRate: 0,
    reorderLevel: 0,
    rackLocation: null,
    isScheduled: false,
    scheduleType: 'none',
    purchasePrice: prices.purchasePrice ?? null,
    sellingPrice: prices.sellingPrice ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    createdFromPriceImport: true,
  };
}
