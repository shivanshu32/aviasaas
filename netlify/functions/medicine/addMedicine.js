/**
 * Add Medicine API
 * Endpoint: POST /.netlify/functions/medicine-addMedicine
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { created, badRequest, conflict } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function addMedicine(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  if (!data.name) return badRequest('Medicine name is required');
  if (!data.category) return badRequest('Category is required');
  if (!data.packSize) return badRequest('Pack size is required');
  if (!data.packUnit) return badRequest('Pack unit is required');
  if (data.reorderLevel === undefined) return badRequest('Reorder level is required');

  let purchasePrice = null;
  if (data.purchasePrice !== undefined && data.purchasePrice !== null && data.purchasePrice !== '') {
    const n = Number(data.purchasePrice);
    if (Number.isNaN(n) || n < 0) return badRequest('Invalid purchase price');
    purchasePrice = n;
  }

  let sellingPrice = null;
  if (data.sellingPrice !== undefined && data.sellingPrice !== null && data.sellingPrice !== '') {
    const n = Number(data.sellingPrice);
    if (Number.isNaN(n) || n < 0) return badRequest('Invalid selling price');
    sellingPrice = n;
  }

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.MEDICINES);

  const existing = await collection.findOne({
    name: { $regex: new RegExp(`^${data.name}$`, 'i') },
    isActive: true,
  });

  if (existing) {
    return conflict('Medicine with this name already exists');
  }

  const lastMedicine = await collection
    .find({})
    .sort({ medicineId: -1 })
    .limit(1)
    .toArray();

  let nextNum = 1;
  if (lastMedicine.length > 0) {
    const lastId = lastMedicine[0].medicineId;
    const match = lastId.match(/MED-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  const medicineId = `MED-${String(nextNum).padStart(4, '0')}`;

  const now = new Date();
  const medicine = {
    _id: new ObjectId(),
    medicineId,
    name: data.name,
    genericName: data.genericName || null,
    manufacturer: data.manufacturer || null,
    category: data.category,
    composition: data.composition || null,
    strength: data.strength || null,
    packSize: Number(data.packSize),
    packUnit: data.packUnit,
    hsnCode: data.hsnCode || null,
    gstRate: Number(data.gstRate) || 0,
    reorderLevel: Number(data.reorderLevel),
    rackLocation: data.rackLocation || null,
    isScheduled: data.isScheduled || false,
    scheduleType: data.scheduleType || 'none',
    purchasePrice,
    sellingPrice,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(medicine);

  return created({ medicine }, 'Medicine added successfully');
}

export const handler = withErrorHandler(addMedicine);
