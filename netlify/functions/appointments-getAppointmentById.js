/**
 * Get Appointment By ID API
 * 
 * Endpoint: GET /.netlify/functions/appointments-getAppointmentById?id=xxx
 * 
 * Response:
 *   { success: true, appointment: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getAppointmentById(event) {
  const { id } = event.query;

  if (!id) {
    return badRequest('Appointment ID is required');
  }

  const db = await getDb();

  const query = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { appointmentId: id };

  const pipeline = [
    { $match: query },
    {
      $lookup: {
        from: COLLECTIONS.PATIENTS,
        localField: 'patientId',
        foreignField: '_id',
        as: 'patient',
      },
    },
    { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: COLLECTIONS.DOCTORS,
        localField: 'doctorId',
        foreignField: '_id',
        as: 'doctor',
      },
    },
    { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
  ];

  const appointments = await db.collection(COLLECTIONS.APPOINTMENTS)
    .aggregate(pipeline)
    .toArray();

  if (appointments.length === 0) {
    return notFound('Appointment');
  }

  return success({ appointment: appointments[0] });
}

export const handler = withErrorHandler(getAppointmentById);
