/**
 * Shared Enum Constants
 * Used by both frontend and backend for consistency
 */

// Gender options
export const GENDER = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
};

export const GENDER_OPTIONS = Object.values(GENDER);

// Blood groups
export const BLOOD_GROUP = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O-',
};

export const BLOOD_GROUP_OPTIONS = Object.values(BLOOD_GROUP);

// Appointment status
export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CHECKED_IN: 'checked-in',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no-show',
};

export const APPOINTMENT_STATUS_OPTIONS = Object.values(APPOINTMENT_STATUS);

// Appointment type
export const APPOINTMENT_TYPE = {
  NEW: 'new',
  FOLLOW_UP: 'follow-up',
};

export const APPOINTMENT_TYPE_OPTIONS = Object.values(APPOINTMENT_TYPE);

// Payment modes
export const PAYMENT_MODE = {
  CASH: 'cash',
  CARD: 'card',
  UPI: 'upi',
  MIXED: 'mixed',
};

export const PAYMENT_MODE_OPTIONS = Object.values(PAYMENT_MODE);

// Payment status
export const PAYMENT_STATUS = {
  PAID: 'paid',
  PENDING: 'pending',
  PARTIAL: 'partial',
};

export const PAYMENT_STATUS_OPTIONS = Object.values(PAYMENT_STATUS);

// Bill types
export const BILL_TYPE = {
  OPD: 'opd',
  MISC: 'misc',
  MEDICINE: 'medicine',
};

// Misc bill categories
export const MISC_BILL_CATEGORY = {
  LABORATORY: 'laboratory',
  RADIOLOGY: 'radiology',
  PROCEDURE: 'procedure',
  OTHER: 'other',
};

export const MISC_BILL_CATEGORY_OPTIONS = Object.values(MISC_BILL_CATEGORY);

// Medicine categories
export const MEDICINE_CATEGORY = {
  TABLET: 'tablet',
  CAPSULE: 'capsule',
  SYRUP: 'syrup',
  INJECTION: 'injection',
  CREAM: 'cream',
  DROPS: 'drops',
  INHALER: 'inhaler',
  POWDER: 'powder',
  OTHER: 'other',
};

export const MEDICINE_CATEGORY_OPTIONS = Object.values(MEDICINE_CATEGORY);

// Medicine pack units
export const PACK_UNIT = {
  STRIP: 'strip',
  BOTTLE: 'bottle',
  VIAL: 'vial',
  TUBE: 'tube',
  BOX: 'box',
  PIECE: 'piece',
};

export const PACK_UNIT_OPTIONS = Object.values(PACK_UNIT);

// Stock batch status
export const STOCK_STATUS = {
  ACTIVE: 'active',
  LOW: 'low',
  EXPIRED: 'expired',
  EXHAUSTED: 'exhausted',
};

export const STOCK_STATUS_OPTIONS = Object.values(STOCK_STATUS);

// Drug schedule types
export const SCHEDULE_TYPE = {
  H: 'H',
  H1: 'H1',
  X: 'X',
  NONE: 'none',
};

export const SCHEDULE_TYPE_OPTIONS = Object.values(SCHEDULE_TYPE);

// Discount types
export const DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
};

export const DISCOUNT_TYPE_OPTIONS = Object.values(DISCOUNT_TYPE);

// Days of week
export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
