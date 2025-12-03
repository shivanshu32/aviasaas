/**
 * Create Appointment API
 * 
 * Endpoint: POST /.netlify/functions/appointments-createAppointment
 * 
 * Request Body:
 *   {
 *     patientId: string (required),
 *     doctorId: string (required),
 *     appointmentDate: string (required, ISO date),
 *     type: 'new' | 'follow-up',
 *     symptoms?: string
 *   }
 * 
 * Response:
 *   { success: true, message: string, appointment: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { validateCreateAppointment } from '../../shared/validators/appointment.validator.js';
import { generateUniqueId } from '../../shared/utils/idGenerator.js';
import { BILL_PREFIXES } from '../../shared/constants/billPrefixes.js';
import { APPOINTMENT_STATUS } from '../../shared/constants/enums.js';

async function createAppointment(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  // Validate request body
  const validation = validateCreateAppointment(event.parsedBody);
  if (!validation.success) {
    return badRequest('Validation failed', validation.error);
  }

  const data = validation.data;
  const db = await getDb();

  // Verify patient exists
  const patientQuery = ObjectId.isValid(data.patientId)
    ? { _id: new ObjectId(data.patientId) }
    : { patientId: data.patientId };
  
  const patient = await db.collection(COLLECTIONS.PATIENTS).findOne(patientQuery);
  if (!patient) {
    return notFound('Patient');
  }

  // Verify doctor exists
  const doctorQuery = ObjectId.isValid(data.doctorId)
    ? { _id: new ObjectId(data.doctorId) }
    : { doctorId: data.doctorId };
  
  const doctor = await db.collection(COLLECTIONS.DOCTORS).findOne(doctorQuery);
  if (!doctor) {
    return notFound('Doctor');
  }

  // Parse appointment date
  const appointmentDate = new Date(data.appointmentDate);
  appointmentDate.setHours(0, 0, 0, 0);

  // Get today's token number
  const todayStart = new Date(appointmentDate);
  const todayEnd = new Date(appointmentDate);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const lastAppointment = await db.collection(COLLECTIONS.APPOINTMENTS)
    .find({
      doctorId: doctor._id,
      appointmentDate: { $gte: todayStart, $lt: todayEnd },
    })
    .sort({ tokenNo: -1 })
    .limit(1)
    .toArray();

  const tokenNo = lastAppointment.length > 0 ? lastAppointment[0].tokenNo + 1 : 1;

  // Generate appointment ID
  const appointmentId = await generateUniqueId(
    db,
    COLLECTIONS.APPOINTMENTS,
    'appointmentId',
    BILL_PREFIXES.APPOINTMENT
  );

  // Create appointment document
  const now = new Date();
  const appointment = {
    _id: new ObjectId(),
    appointmentId,
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentDate,
    tokenNo,
    type: data.type || 'new',
    status: APPOINTMENT_STATUS.SCHEDULED,
    symptoms: data.symptoms || null,
    vitals: null,
    notes: null,
    cancelReason: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.APPOINTMENTS).insertOne(appointment);

  // Return with patient and doctor info
  const response = {
    ...appointment,
    patient: {
      _id: patient._id,
      patientId: patient.patientId,
      name: patient.name,
      phone: patient.phone,
      age: patient.age,
      gender: patient.gender,
    },
    doctor: {
      _id: doctor._id,
      doctorId: doctor.doctorId,
      name: doctor.name,
      specialization: doctor.specialization,
    },
  };

  return created(
    { appointment: response },
    'Appointment booked successfully'
  );
}

export const handler = withErrorHandler(createAppointment);
