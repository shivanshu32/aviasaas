/**
 * Get Appointments API
 * 
 * Endpoint: GET /.netlify/functions/appointments-getAppointments
 * 
 * Query Parameters:
 *   - date: Filter by date (YYYY-MM-DD)
 *   - doctorId: Filter by doctor
 *   - patientId: Filter by patient
 *   - status: Filter by status
 *   - page, limit: Pagination
 * 
 * Response:
 *   { success: true, appointments: [...], pagination: {...} }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from '../utils/db.js';
import { paginated } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function getAppointments(event) {
  const {
    date,
    doctorId,
    patientId,
    status,
    page = '1',
    limit = '50',
  } = event.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const db = await getDb();
  const filter = {};

  // Date filter
  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    filter.appointmentDate = { $gte: startDate, $lt: endDate };
  }

  // Doctor filter
  if (doctorId) {
    filter.doctorId = ObjectId.isValid(doctorId) 
      ? new ObjectId(doctorId) 
      : doctorId;
  }

  // Patient filter
  if (patientId) {
    filter.patientId = ObjectId.isValid(patientId)
      ? new ObjectId(patientId)
      : patientId;
  }

  // Status filter
  if (status) {
    filter.status = status;
  }

  // Aggregation pipeline to join patient and doctor info
  const pipeline = [
    { $match: filter },
    { $sort: { appointmentDate: 1, tokenNo: 1 } },
    { $skip: skip },
    { $limit: limitNum },
    {
      $lookup: {
        from: COLLECTIONS.PATIENTS,
        localField: 'patientId',
        foreignField: '_id',
        as: 'patientInfo',
      },
    },
    {
      $lookup: {
        from: COLLECTIONS.DOCTORS,
        localField: 'doctorId',
        foreignField: '_id',
        as: 'doctorInfo',
      },
    },
    {
      $addFields: {
        patient: {
          $let: {
            vars: { p: { $arrayElemAt: ['$patientInfo', 0] } },
            in: {
              _id: '$$p._id',
              patientId: '$$p.patientId',
              name: '$$p.name',
              phone: '$$p.phone',
              age: '$$p.age',
              gender: '$$p.gender',
            },
          },
        },
        doctor: {
          $let: {
            vars: { d: { $arrayElemAt: ['$doctorInfo', 0] } },
            in: {
              _id: '$$d._id',
              doctorId: '$$d.doctorId',
              name: '$$d.name',
              specialization: '$$d.specialization',
            },
          },
        },
      },
    },
    {
      $project: {
        patientInfo: 0,
        doctorInfo: 0,
      },
    },
  ];

  const [appointments, totalResult] = await Promise.all([
    db.collection(COLLECTIONS.APPOINTMENTS).aggregate(pipeline).toArray(),
    db.collection(COLLECTIONS.APPOINTMENTS).countDocuments(filter),
  ]);

  return paginated({
    data: appointments,
    total: totalResult,
    page: pageNum,
    limit: limitNum,
    dataKey: 'appointments',
  });
}

export const handler = withErrorHandler(getAppointments);
