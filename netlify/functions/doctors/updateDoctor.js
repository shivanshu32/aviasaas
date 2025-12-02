/**
 * Update Doctor API
 * 
 * Endpoint: PUT /.netlify/functions/doctors-updateDoctor
 * 
 * Request Body:
 *   {
 *     id: string (required),
 *     name?: string,
 *     qualification?: string,
 *     specialization?: string,
 *     phone?: string,
 *     email?: string,
 *     consultationFee?: number,
 *     workingDays?: string[],
 *     workingHours?: { start, end },
 *     slotDuration?: number,
 *     signature?: string,
 *     isActive?: boolean
 *   }
 * 
 * Response:
 *   { success: true, message: string, doctor: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { success, badRequest, notFound } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function updateDoctor(event) {
  if (event.httpMethod !== 'PUT') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  if (!data.id) {
    return badRequest('Doctor ID is required');
  }

  const db = await getDb();

  // Find doctor
  const query = ObjectId.isValid(data.id)
    ? { _id: new ObjectId(data.id) }
    : { doctorId: data.id };

  const doctor = await db.collection(COLLECTIONS.DOCTORS).findOne(query);
  if (!doctor) {
    return notFound('Doctor');
  }

  // Build update object
  const updateFields = {
    updatedAt: new Date(),
  };

  const allowedFields = [
    'name', 'qualification', 'specialization', 'phone', 'email',
    'consultationFee', 'workingDays', 'workingHours', 'slotDuration',
    'signature', 'isActive'
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateFields[field] = data[field];
    }
  }

  // Update doctor
  const result = await db.collection(COLLECTIONS.DOCTORS).findOneAndUpdate(
    { _id: doctor._id },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  return success(
    { doctor: result },
    'Doctor updated successfully'
  );
}

export const handler = withErrorHandler(updateDoctor);
