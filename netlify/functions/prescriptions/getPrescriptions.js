/**
 * Get Prescriptions API
 * List prescriptions with filters and pagination
 * 
 * Endpoint: GET /.netlify/functions/prescriptions-getPrescriptions
 * 
 * Query Parameters:
 *   - patientId: Filter by patient
 *   - doctorId: Filter by doctor
 *   - dateFrom, dateTo: Date range
 *   - page, limit: Pagination
 * 
 * Response:
 *   { success: true, prescriptions: [...], pagination: {...} }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { paginated } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function getPrescriptions(event) {
  const {
    patientId,
    doctorId,
    dateFrom,
    dateTo,
    page = '1',
    limit = '20',
  } = event.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const db = await getDb();
  const filter = {};

  // Patient filter
  if (patientId) {
    filter.patientId = ObjectId.isValid(patientId)
      ? new ObjectId(patientId)
      : patientId;
  }

  // Doctor filter
  if (doctorId) {
    filter.doctorId = ObjectId.isValid(doctorId)
      ? new ObjectId(doctorId)
      : doctorId;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    filter.prescriptionDate = {};
    if (dateFrom) filter.prescriptionDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      filter.prescriptionDate.$lte = endDate;
    }
  }

  const pipeline = [
    { $match: filter },
    { $sort: { prescriptionDate: -1 } },
    { $skip: skip },
    { $limit: limitNum },
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
      $project: {
        _id: 1,
        prescriptionId: 1,
        prescriptionDate: 1,
        diagnosis: 1,
        medicines: { $size: '$medicines' },
        followUpDate: 1,
        isBlank: 1,
        'patient._id': 1,
        'patient.patientId': 1,
        'patient.name': 1,
        'patient.age': 1,
        'patient.gender': 1,
        'doctor._id': 1,
        'doctor.name': 1,
        'doctor.specialization': 1,
      },
    },
  ];

  const [prescriptions, total] = await Promise.all([
    db.collection(COLLECTIONS.OPD_PRESCRIPTIONS).aggregate(pipeline).toArray(),
    db.collection(COLLECTIONS.OPD_PRESCRIPTIONS).countDocuments(filter),
  ]);

  return paginated({
    data: prescriptions,
    total,
    page: pageNum,
    limit: limitNum,
    dataKey: 'prescriptions',
  });
}

export const handler = withErrorHandler(getPrescriptions);
