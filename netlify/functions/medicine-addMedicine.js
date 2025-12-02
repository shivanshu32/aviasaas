/**
 * Add Medicine API
 * Add a new medicine to the catalog
 * 
 * Endpoint: POST /.netlify/functions/medicine-addMedicine
 * 
 * Request Body:
 *   {
 *     name: string (required),
 *     genericName?: string,
 *     manufacturer?: string,
 *     category: string (required),
 *     composition?: string,
 *     strength?: string,
 *     packSize: number (required),
 *     packUnit: string (required),
 *     hsnCode?: string,
 *     gstRate?: number,
 *     reorderLevel: number (required),
 *     rackLocation?: string,
 *     isScheduled?: boolean,
 *     scheduleType?: string
 *   }
 * 
 * Response:
 *   { success: true, message: string, medicine: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, conflict } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function addMedicine(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.name) return badRequest('Medicine name is required');
  if (!data.category) return badRequest('Category is required');
  if (!data.packSize) return badRequest('Pack size is required');
  if (!data.packUnit) return badRequest('Pack unit is required');
  if (data.reorderLevel === undefined) return badRequest('Reorder level is required');

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.MEDICINES);

  // Check for duplicate medicine name
  const existing = await collection.findOne({
    name: { $regex: new RegExp(`^${data.name}$`, 'i') },
    isActive: true,
  });

  if (existing) {
    return conflict('Medicine with this name already exists');
  }

  // Generate medicine ID
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

  // Create medicine document
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
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(medicine);

  return created(
    { medicine },
    'Medicine added successfully'
  );
}

export const handler = withErrorHandler(addMedicine);
