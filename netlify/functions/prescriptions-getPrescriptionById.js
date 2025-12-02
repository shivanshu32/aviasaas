/**
 * Get Prescription By ID API
 * 
 * Endpoint: GET /.netlify/functions/prescriptions-getPrescriptionById?id=xxx
 * 
 * Response:
 *   { success: true, prescription: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getPrescriptionById(event) {
  const { id } = event.query;

  if (!id) {
    return badRequest('Prescription ID is required');
  }

  const db = await getDb();

  const query = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { prescriptionId: id };

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
    {
      $lookup: {
        from: COLLECTIONS.APPOINTMENTS,
        localField: 'appointmentId',
        foreignField: '_id',
        as: 'appointment',
      },
    },
    { $unwind: { path: '$appointment', preserveNullAndEmptyArrays: true } },
  ];

  const prescriptions = await db.collection(COLLECTIONS.OPD_PRESCRIPTIONS)
    .aggregate(pipeline)
    .toArray();

  if (prescriptions.length === 0) {
    return notFound('Prescription');
  }

  return success({ prescription: prescriptions[0] });
}

export const handler = withErrorHandler(getPrescriptionById);
