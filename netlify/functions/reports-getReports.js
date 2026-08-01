import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { paginated } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function getReports(event) {
  const { patientId, page = '1', limit = '50' } = event.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;
  const filter = {};

  if (patientId) {
    filter.patientId = ObjectId.isValid(patientId) ? new ObjectId(patientId) : patientId;
  }

  const db = await getDb();
  const [reports, total] = await Promise.all([
    db.collection(COLLECTIONS.PATIENT_REPORTS)
      .find(filter, {
        projection: {
          reportId: 1,
          patientId: 1,
          doctorName: 1,
          doctor: 1,
          title: 1,
          reportDate: 1,
          createdAt: 1,
        },
      })
      .sort({ reportDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray(),
    db.collection(COLLECTIONS.PATIENT_REPORTS).countDocuments(filter),
  ]);

  return paginated({
    data: reports,
    total,
    page: pageNum,
    limit: limitNum,
    dataKey: 'reports',
  });
}

export const handler = withErrorHandler(getReports);
