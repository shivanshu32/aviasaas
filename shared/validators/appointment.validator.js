/**
 * Appointment Validation Schema
 */

import { z } from 'zod';
import { APPOINTMENT_STATUS_OPTIONS, APPOINTMENT_TYPE_OPTIONS } from '../constants/enums.js';

// Vitals schema
const vitalsSchema = z.object({
  bp: z.string().max(20).optional(),
  pulse: z.number().int().min(0).max(300).optional(),
  temperature: z.number().min(90).max(110).optional(),
  weight: z.number().min(0).max(500).optional(),
  height: z.number().min(0).max(300).optional(),
  spo2: z.number().int().min(0).max(100).optional(),
}).optional();

/**
 * Schema for creating an appointment
 */
export const createAppointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  appointmentDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  type: z.enum(APPOINTMENT_TYPE_OPTIONS).default('new'),
  symptoms: z.string().max(1000).nullable().optional(),
});

/**
 * Schema for updating an appointment
 */
export const updateAppointmentSchema = z.object({
  status: z.enum(APPOINTMENT_STATUS_OPTIONS).optional(),
  symptoms: z.string().max(1000).nullable().optional(),
  vitals: vitalsSchema,
  notes: z.string().max(2000).nullable().optional(),
  cancelReason: z.string().max(500).nullable().optional(),
});

/**
 * Validate appointment creation
 */
export function validateCreateAppointment(data) {
  const result = createAppointmentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: formatZodError(result.error) };
}

/**
 * Validate appointment update
 */
export function validateUpdateAppointment(data) {
  const result = updateAppointmentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: formatZodError(result.error) };
}

function formatZodError(zodError) {
  const errors = {};
  zodError.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return errors;
}

export default {
  createAppointmentSchema,
  updateAppointmentSchema,
  validateCreateAppointment,
  validateUpdateAppointment,
};
