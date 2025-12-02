/**
 * Delete Patient API (Soft Delete)
 * 
 * Endpoint: DELETE /.netlify/functions/patients-deletePatient?id={id}
 * 
 * Query Parameters:
 *   - id: Patient ObjectId or patientId (required)
 * 
 * Response:
 *   { success: true, message: string }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function deletePatient(event) {
  if (event.httpMethod !== 'DELETE') {
    return badRequest('Method not allowed');
  }

  const { id } = event.query;

  if (!id) {
    return badRequest('Patient ID is required');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.PATIENTS);

  // Build query
  const query = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { patientId: id };

  // Soft delete - set isActive to false
  const result = await collection.findOneAndUpdate(
    query,
    {
      $set: {
        isActive: false,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return notFound('Patient');
  }

  return success({}, 'Patient deleted successfully');
}

export const handler = withErrorHandler(deletePatient);
