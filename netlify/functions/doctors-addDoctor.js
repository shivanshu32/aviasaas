/**
 * Add Doctor API
 * 
 * Endpoint: POST /.netlify/functions/doctors-addDoctor
 * 
 * Request Body:
 *   {
 *     name: string (required),
 *     qualification: string (required),
 *     specialization: string (required),
 *     registrationNo: string (required),
 *     phone: string (required),
 *     email?: string,
 *     consultationFee: number (required),
 *     signature?: string (base64),
 *     workingDays?: string[],
 *     workingHours?: { start, end },
 *     slotDuration?: number
 *   }
 * 
 * Response:
 *   { success: true, message: string, doctor: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, conflict } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';

async function addDoctor(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.name) return badRequest('Doctor name is required');
  if (!data.qualification) return badRequest('Qualification is required');
  if (!data.specialization) return badRequest('Specialization is required');
  if (!data.registrationNo) return badRequest('Registration number is required');
  if (!data.phone) return badRequest('Phone is required');
  if (!data.consultationFee) return badRequest('Consultation fee is required');

  const db = await getDb();
  const collection = db.collection(COLLECTIONS.DOCTORS);

  // Check for duplicate registration number
  const existingReg = await collection.findOne({
    registrationNo: data.registrationNo,
  });

  if (existingReg) {
    return conflict('Doctor with this registration number already exists');
  }

  // Generate doctor ID
  const lastDoctor = await collection
    .find({})
    .sort({ doctorId: -1 })
    .limit(1)
    .toArray();

  let nextNum = 1;
  if (lastDoctor.length > 0) {
    const lastId = lastDoctor[0].doctorId;
    const match = lastId.match(/DOC-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  const doctorId = `DOC-${String(nextNum).padStart(3, '0')}`;

  // Create doctor document
  const now = new Date();
  const doctor = {
    _id: new ObjectId(),
    doctorId,
    name: data.name,
    qualification: data.qualification,
    specialization: data.specialization,
    registrationNo: data.registrationNo,
    phone: data.phone,
    email: data.email || null,
    consultationFee: Number(data.consultationFee),
    signature: data.signature || null,
    workingDays: data.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    workingHours: data.workingHours || { start: '09:00', end: '18:00' },
    slotDuration: data.slotDuration || 15,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(doctor);

  return created(
    { doctor },
    'Doctor added successfully'
  );
}

export const handler = withErrorHandler(addDoctor);
