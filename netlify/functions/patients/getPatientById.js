/**
 * Get Patient By ID API
 * 
 * Endpoint: GET /.netlify/functions/patients-getPatientById?id={id}
 * 
 * Query Parameters:
 *   - id: Patient ObjectId or patientId (required)
 * 
 * Response:
 *   { success: true, patient: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { success, badRequest, notFound } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function getPatientById(event) {
  const { id } = event.query;

  if (!id) {
    return badRequest('Patient ID is required');
  }

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.PATIENTS);

  // Try to find by ObjectId first, then by patientId
  let patient = null;
  
  if (ObjectId.isValid(id)) {
    patient = await collection.findOne({ _id: new ObjectId(id) });
  }
  
  if (!patient) {
    patient = await collection.findOne({ patientId: id });
  }

  if (!patient) {
    return notFound('Patient');
  }

  return success({ patient });
}

export const handler = withErrorHandler(getPatientById);
