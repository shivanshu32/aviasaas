import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getReportById(event) {
  const { id } = event.query;
  if (!id) return badRequest('Report ID is required');

  const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { reportId: id };
  const db = await getDb();
  const reports = await db.collection(COLLECTIONS.PATIENT_REPORTS).aggregate([
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
  ]).toArray();

  if (reports.length === 0) return notFound('Patient report');
  return success({ report: reports[0] });
}

export const handler = withErrorHandler(getReportById);
