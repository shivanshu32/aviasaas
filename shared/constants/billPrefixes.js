/**
 * Bill Number Prefixes
 * Following legacy naming convention
 */

export const BILL_PREFIXES = {
  PATIENT: '',           // Legacy: 1001, 1002... (no prefix, starts from 1001)
  DOCTOR: 'DOC',
  APPOINTMENT: 'OPDN',   // Legacy: OPDN6, OPDN10...
  PRESCRIPTION: 'RX',
  OPD_BILL: 'OPDN',      // Legacy: OPDN6, OPDN10... (same as appointment)
  MISC_BILL: 'MISC',
  MEDICINE_BILL: 'MED',
  MEDICINE: 'MED',
  STOCK: 'STK',
};

// Starting sequence numbers (to continue from legacy data)
export const STARTING_SEQUENCES = {
  PATIENT: 1001,         // Legacy patients start from 1001
  APPOINTMENT: 1,        // Legacy OPD starts from 1
  OPD_BILL: 1,
};

export default BILL_PREFIXES;
