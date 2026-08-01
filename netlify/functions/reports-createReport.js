import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function createReport(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};
  if (!data.patientId) return badRequest('Patient ID is required');
  if (!data.doctorName?.trim()) return badRequest('Doctor name is required');
  if (!data.reportDate) return badRequest('Report date is required');
  if (!data.content?.trim()) return badRequest('Report content is required');

  const reportDate = new Date(data.reportDate);
  if (Number.isNaN(reportDate.getTime())) {
    return badRequest('Enter a valid report date');
  }

  const db = await getDb();
  const patientQuery = ObjectId.isValid(data.patientId)
    ? { _id: new ObjectId(data.patientId) }
    : { patientId: data.patientId };
  const patient = await db.collection(COLLECTIONS.PATIENTS).findOne(patientQuery);

  if (!patient) return notFound('Patient');

  const dateStamp = data.reportDate.slice(0, 10).replaceAll('-', '');
  const baseReportId = `RPT-${dateStamp}-${patient.patientId}`;
  let reportId = baseReportId;
  let suffix = 2;
  while (await db.collection(COLLECTIONS.PATIENT_REPORTS).findOne({ reportId })) {
    reportId = `${baseReportId}-${suffix}`;
    suffix += 1;
  }

  const now = new Date();
  const report = {
    _id: new ObjectId(),
    reportId,
    patientId: patient._id,
    doctorName: data.doctorName.trim(),
    doctor: {
      name: data.doctor?.name?.trim() || data.doctorName.trim(),
      qualification: data.doctor?.qualification || '',
      specialization: data.doctor?.specialization || '',
      registrationNo: data.doctor?.registrationNo || '',
    },
    title: data.title?.trim() || 'Patient Medical Report',
    content: data.content,
    reportDate,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.PATIENT_REPORTS).insertOne(report);

  return created({
    report: {
      ...report,
      patient: {
        _id: patient._id,
        patientId: patient.patientId,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        bloodGroup: patient.bloodGroup,
      },
    },
  }, 'Patient report saved successfully');
}

export const handler = withErrorHandler(createReport);
