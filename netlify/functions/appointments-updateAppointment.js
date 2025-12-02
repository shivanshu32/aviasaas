/**
 * Update Appointment API
 * Update appointment status, vitals, notes
 * 
 * Endpoint: PUT /.netlify/functions/appointments-updateAppointment
 * 
 * Request Body:
 *   {
 *     id: string (required),
 *     status?: 'scheduled' | 'checked-in' | 'in-progress' | 'completed' | 'cancelled' | 'no-show',
 *     vitals?: { bp, pulse, temperature, weight, height, spo2 },
 *     notes?: string,
 *     cancelReason?: string
 *   }
 * 
 * Response:
 *   { success: true, message: string, appointment: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { success, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { APPOINTMENT_STATUS } from '../../shared/constants/enums.js';

async function updateAppointment(event) {
  if (event.httpMethod !== 'PUT') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  if (!data.id) {
    return badRequest('Appointment ID is required');
  }

  const db = await getDb();

  // Find appointment
  const query = ObjectId.isValid(data.id)
    ? { _id: new ObjectId(data.id) }
    : { appointmentId: data.id };

  const appointment = await db.collection(COLLECTIONS.APPOINTMENTS).findOne(query);
  if (!appointment) {
    return notFound('Appointment');
  }

  // Build update object
  const updateFields = {
    updatedAt: new Date(),
  };

  // Status update
  if (data.status) {
    const validStatuses = Object.values(APPOINTMENT_STATUS);
    if (!validStatuses.includes(data.status)) {
      return badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    updateFields.status = data.status;

    // Set check-in time
    if (data.status === APPOINTMENT_STATUS.CHECKED_IN && !appointment.checkInTime) {
      updateFields.checkInTime = new Date();
    }

    // Set completion time
    if (data.status === APPOINTMENT_STATUS.COMPLETED && !appointment.completedTime) {
      updateFields.completedTime = new Date();
    }
  }

  // Vitals update
  if (data.vitals) {
    updateFields.vitals = {
      bp: data.vitals.bp || null,
      pulse: data.vitals.pulse || null,
      temperature: data.vitals.temperature || null,
      weight: data.vitals.weight || null,
      height: data.vitals.height || null,
      spo2: data.vitals.spo2 || null,
    };
  }

  // Notes update
  if (data.notes !== undefined) {
    updateFields.notes = data.notes;
  }

  // Cancel reason
  if (data.cancelReason) {
    updateFields.cancelReason = data.cancelReason;
  }

  // Update appointment
  const result = await db.collection(COLLECTIONS.APPOINTMENTS).findOneAndUpdate(
    { _id: appointment._id },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  return success(
    { appointment: result },
    'Appointment updated successfully'
  );
}

export const handler = withErrorHandler(updateAppointment);
