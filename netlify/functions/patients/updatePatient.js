/**
 * Update Patient API
 * 
 * Endpoint: PUT /.netlify/functions/patients-updatePatient
 * 
 * Request Body:
 *   {
 *     id: string (required - ObjectId or patientId),
 *     ...fields to update
 *   }
 * 
 * Response:
 *   { success: true, message: string, patient: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { success, badRequest, notFound, conflict } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';
import { validateUpdatePatient } from '../../../shared/validators/patient.validator.js';

async function updatePatient(event) {
  if (event.httpMethod !== 'PUT') {
    return badRequest('Method not allowed');
  }

  const { id, ...updateData } = event.parsedBody || {};

  if (!id) {
    return badRequest('Patient ID is required');
  }

  // Validate update data
  const validation = validateUpdatePatient(updateData);
  if (!validation.success) {
    return badRequest('Validation failed', validation.error);
  }

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.PATIENTS);

  // Build query
  const query = ObjectId.isValid(id) 
    ? { _id: new ObjectId(id) }
    : { patientId: id };

  // Check if patient exists
  const existingPatient = await collection.findOne(query);
  if (!existingPatient) {
    return notFound('Patient');
  }

  // If phone is being updated, check for duplicates
  if (validation.data.phone && validation.data.phone !== existingPatient.phone) {
    const phoneExists = await collection.findOne({
      phone: validation.data.phone,
      _id: { $ne: existingPatient._id },
      isActive: true,
    });

    if (phoneExists) {
      return conflict('Another patient with this phone number already exists');
    }
  }

  // Update patient
  const updateDoc = {
    $set: {
      ...validation.data,
      updatedAt: new Date(),
    },
  };

  const result = await collection.findOneAndUpdate(
    query,
    updateDoc,
    { returnDocument: 'after' }
  );

  return success(
    { patient: result },
    'Patient updated successfully'
  );
}

export const handler = withErrorHandler(updatePatient);
