/**
 * Get Medicine Bills API
 * List medicine bills with filters and pagination
 * 
 * Endpoint: GET /.netlify/functions/billing-medicine-getMedicineBills
 * 
 * Query Parameters:
 *   - patientId: Filter by patient
 *   - dateFrom, dateTo: Date range
 *   - paymentStatus: paid | pending | partial
 *   - page, limit: Pagination
 * 
 * Response:
 *   { success: true, bills: [...], pagination: {...} }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../../utils/db.js';
import { paginated } from '../../utils/response.js';
import { withErrorHandler } from '../../utils/errorHandler.js';

async function getMedicineBills(event) {
  const {
    patientId,
    dateFrom,
    dateTo,
    paymentStatus,
    page = '1',
    limit = '20',
  } = event.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const db = await getDb();
  const filter = { isReturn: false };

  // Patient filter
  if (patientId) {
    filter.patientId = ObjectId.isValid(patientId)
      ? new ObjectId(patientId)
      : patientId;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    filter.billDate = {};
    if (dateFrom) filter.billDate.$gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      filter.billDate.$lte = endDate;
    }
  }

  // Payment status filter
  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }

  const pipeline = [
    { $match: filter },
    { $sort: { billDate: -1 } },
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
        billNo: 1,
        billDate: 1,
        patientName: 1,
        patientPhone: 1,
        items: { $size: '$items' },
        grandTotal: 1,
        paymentMode: 1,
        paymentStatus: 1,
        paidAmount: 1,
        dueAmount: 1,
        'patient._id': 1,
        'patient.patientId': 1,
        'patient.name': 1,
        'doctor.name': 1,
      },
    },
  ];

  const [bills, total] = await Promise.all([
    db.collection(COLLECTIONS.MEDICINE_BILLS).aggregate(pipeline).toArray(),
    db.collection(COLLECTIONS.MEDICINE_BILLS).countDocuments(filter),
  ]);

  return paginated({
    data: bills,
    total,
    page: pageNum,
    limit: limitNum,
    dataKey: 'bills',
  });
}

export const handler = withErrorHandler(getMedicineBills);
