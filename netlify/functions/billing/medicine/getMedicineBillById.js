/**
 * Get Medicine Bill By ID API
 * 
 * Endpoint: GET /.netlify/functions/billing-medicine-getMedicineBillById?id=xxx
 * 
 * Response:
 *   { success: true, bill: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../../utils/db.js';
import { success, badRequest, notFound } from '../../utils/response.js';
import { withErrorHandler } from '../../utils/errorHandler.js';

async function getMedicineBillById(event) {
  const { id } = event.query;

  if (!id) {
    return badRequest('Bill ID is required');
  }

  const db = await getDb();

  const query = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { billNo: id };

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

  const bills = await db.collection(COLLECTIONS.MEDICINE_BILLS)
    .aggregate(pipeline)
    .toArray();

  if (bills.length === 0) {
    return notFound('Bill');
  }

  return success({ bill: bills[0] });
}

export const handler = withErrorHandler(getMedicineBillById);
