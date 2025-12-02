/**
 * Patient Validation Schema
 * Uses Zod for runtime validation
 */

import { z } from 'zod';
import { GENDER_OPTIONS, BLOOD_GROUP_OPTIONS } from '../constants/enums.js';

// Address schema (nested)
const addressSchema = z.object({
  line1: z.string().max(200).optional().or(z.literal('')),
  line2: z.string().max(200).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().or(z.literal('')),
}).optional();

// Emergency contact schema (nested)
const emergencyContactSchema = z.object({
  name: z.string().max(100).optional().or(z.literal('')),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits').optional().or(z.literal('')),
  relation: z.string().max(50).optional().or(z.literal('')),
}).optional();

/**
 * Schema for creating a new patient
 */
export const createPatientSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .trim(),
  
  age: z
    .number()
    .int('Age must be a whole number')
    .min(0, 'Age cannot be negative')
    .max(150, 'Age must be less than 150'),
  
  gender: z
    .enum(GENDER_OPTIONS, { 
      errorMap: () => ({ message: 'Invalid gender' }) 
    }),
  
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  
  email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  
  address: addressSchema,
  
  bloodGroup: z
    .enum(BLOOD_GROUP_OPTIONS)
    .optional()
    .or(z.literal('')),
  
  allergies: z
    .array(z.string().max(100))
    .max(20, 'Maximum 20 allergies allowed')
    .optional()
    .default([]),
  
  medicalHistory: z
    .string()
    .max(2000, 'Medical history must be less than 2000 characters')
    .optional(),
  
  emergencyContact: emergencyContactSchema,
});

/**
 * Schema for updating a patient (all fields optional)
 */
export const updatePatientSchema = createPatientSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * Schema for patient search/filter query
 */
export const patientQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'patientId', 'phone']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  isActive: z.coerce.boolean().optional(),
});

/**
 * Validate patient creation data
 * @param {Object} data - Patient data to validate
 * @returns {{ success: boolean, data?: Object, error?: Object }}
 */
export function validateCreatePatient(data) {
  const result = createPatientSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    error: formatZodError(result.error) 
  };
}

/**
 * Validate patient update data
 * @param {Object} data - Patient data to validate
 * @returns {{ success: boolean, data?: Object, error?: Object }}
 */
export function validateUpdatePatient(data) {
  const result = updatePatientSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    error: formatZodError(result.error) 
  };
}

/**
 * Format Zod error into a simple object
 * @param {z.ZodError} zodError - Zod error object
 * @returns {Object} Formatted errors { field: message }
 */
function formatZodError(zodError) {
  const errors = {};
  zodError.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  return errors;
}

export default {
  createPatientSchema,
  updatePatientSchema,
  patientQuerySchema,
  validateCreatePatient,
  validateUpdatePatient,
};
