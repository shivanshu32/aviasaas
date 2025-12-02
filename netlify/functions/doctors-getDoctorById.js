/**
 * Get Doctor By ID API
 * 
 * Endpoint: GET /.netlify/functions/doctors-getDoctorById?id=xxx
 * 
 * Response:
 *   { success: true, doctor: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getDoctorById(event) {
  const { id } = event.query;

  if (!id) {
    return badRequest('Doctor ID is required');
  }

  const db = await getDb();

  const query = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { doctorId: id };

  const doctor = await db.collection(COLLECTIONS.DOCTORS).findOne(query);

  if (!doctor) {
    return notFound('Doctor');
  }

  return success({ doctor });
}

export const handler = withErrorHandler(getDoctorById);
