/**
 * Generate Prescription API
 * 
 * Endpoint: POST /.netlify/functions/prescriptions-generatePrescription
 * 
 * Request Body:
 *   {
 *     patientId: string (required),
 *     doctorId: string (required),
 *     appointmentId?: string,
 *     diagnosis?: string,
 *     complaints?: string,
 *     examination?: string,
 *     vitals?: { bp, pulse, temperature, weight },
 *     medicines?: [{ name, dosage, frequency, duration, timing, instructions }],
 *     investigations?: string[],
 *     advice?: string,
 *     followUpDate?: string (ISO date),
 *     isBlank?: boolean
 *   }
 * 
 * Response:
 *   { success: true, message: string, prescription: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { generateUniqueId } from '../../shared/utils/idGenerator.js';
import { BILL_PREFIXES } from '../../shared/constants/billPrefixes.js';

async function generatePrescription(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};
  
  if (!data.patientId) {
    return badRequest('Patient ID is required');
  }
  if (!data.doctorId) {
    return badRequest('Doctor ID is required');
  }

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

  // Verify appointment if provided
  let appointment = null;
  if (data.appointmentId) {
    const appointmentQuery = ObjectId.isValid(data.appointmentId)
      ? { _id: new ObjectId(data.appointmentId) }
      : { appointmentId: data.appointmentId };
    
    appointment = await db.collection(COLLECTIONS.APPOINTMENTS).findOne(appointmentQuery);
  }

  // Generate prescription ID
  const prescriptionId = await generateUniqueId(
    db,
    COLLECTIONS.OPD_PRESCRIPTIONS,
    'prescriptionId',
    BILL_PREFIXES.PRESCRIPTION
  );

  // Validate and format medicines
  const medicines = (data.medicines || []).map((med) => ({
    name: med.name || '',
    dosage: med.dosage || '',
    frequency: med.frequency || '',
    duration: med.duration || '',
    timing: med.timing || '',
    instructions: med.instructions || null,
  }));

  // Create prescription document
  const now = new Date();
  const prescription = {
    _id: new ObjectId(),
    prescriptionId,
    appointmentId: appointment ? appointment._id : null,
    patientId: patient._id,
    doctorId: doctor._id,
    prescriptionDate: now,
    diagnosis: data.diagnosis || null,
    complaints: data.complaints || null,
    examination: data.examination || null,
    vitals: data.vitals || null,
    medicines,
    investigations: data.investigations || [],
    advice: data.advice || null,
    followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
    isBlank: data.isBlank || false,
    createdAt: now,
  };

  await db.collection(COLLECTIONS.OPD_PRESCRIPTIONS).insertOne(prescription);

  // Return with patient and doctor info for printing
  const response = {
    ...prescription,
    patient: {
      _id: patient._id,
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
    },
    doctor: {
      _id: doctor._id,
      doctorId: doctor.doctorId,
      name: doctor.name,
      qualification: doctor.qualification,
      specialization: doctor.specialization,
      registrationNo: doctor.registrationNo,
      signature: doctor.signature,
    },
  };

  return created(
    { prescription: response },
    data.isBlank ? 'Blank prescription generated' : 'Prescription generated successfully'
  );
}

export const handler = withErrorHandler(generatePrescription);
