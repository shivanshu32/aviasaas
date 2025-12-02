/**
 * Add Patient API
 * 
 * Endpoint: POST /.netlify/functions/patients-addPatient
 * 
 * Request Body:
 *   {
 *     name: string (required),
 *     age: number (required),
 *     gender: 'Male' | 'Female' | 'Other' (required),
 *     phone: string (required, 10 digits),
 *     email?: string,
 *     address?: { line1, line2, city, state, pincode },
 *     bloodGroup?: string,
 *     allergies?: string[],
 *     medicalHistory?: string,
 *     emergencyContact?: { name, phone, relation }
 *   }
 * 
 * Response:
 *   { success: true, message: string, patient: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, conflict } from './utils/response.js';
import { withErrorHandler, ValidationError } from './utils/errorHandler.js';
import { validateCreatePatient } from '../../shared/validators/patient.validator.js';
import { generateUniqueId } from '../../shared/utils/idGenerator.js';
import { BILL_PREFIXES } from '../../shared/constants/billPrefixes.js';

/**
 * Main handler function
 */
async function addPatient(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  // Debug: Log received data
  console.log('Received body:', JSON.stringify(event.parsedBody, null, 2));

  // Validate request body
  const validation = validateCreatePatient(event.parsedBody);
  console.log('Validation result:', JSON.stringify(validation, null, 2));
  
  if (!validation.success) {
    return badRequest('Validation failed', validation.error);
  }

  const patientData = validation.data;
  const db = await getDb();
  const collection = db.collection(COLLECTIONS.PATIENTS);

  // Check for duplicate phone number
  const existingPatient = await collection.findOne({ 
    phone: patientData.phone,
    isActive: true 
  });

  if (existingPatient) {
    return conflict('Patient with this phone number already exists', {
      existingPatientId: existingPatient.patientId,
      existingPatientName: existingPatient.name,
    });
  }

  // Generate unique patient ID
  const patientId = await generateUniqueId(
    db, 
    COLLECTIONS.PATIENTS, 
    'patientId', 
    BILL_PREFIXES.PATIENT
  );

  // Prepare patient document
  const now = new Date();
  const patient = {
    _id: new ObjectId(),
    patientId,
    name: patientData.name,
    age: patientData.age,
    gender: patientData.gender,
    phone: patientData.phone,
    email: patientData.email || null,
    address: patientData.address || null,
    bloodGroup: patientData.bloodGroup || null,
    allergies: patientData.allergies || [],
    medicalHistory: patientData.medicalHistory || null,
    emergencyContact: patientData.emergencyContact || null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  // Insert patient
  await collection.insertOne(patient);

  return created(
    { patient },
    'Patient registered successfully'
  );
}

// Export wrapped handler
export const handler = withErrorHandler(addPatient);
