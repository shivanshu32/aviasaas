/**
 * ID Generator Utility
 * Generates unique, readable IDs for various entities
 * Following legacy naming convention:
 *   - Patients: 1001, 1002, 1003... (numeric, starting from 1001)
 *   - OPD/Appointments: OPDN1, OPDN2... (prefix + number)
 */

import { STARTING_SEQUENCES } from '../constants/billPrefixes.js';

/**
 * Generate a date string in YYYYMMDD format
 * @param {Date} [date] - Date to format, defaults to now
 * @returns {string} Formatted date string
 */
export function getDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Generate ID following legacy convention
 * 
 * @param {string} prefix - ID prefix (empty for patients)
 * @param {number} sequence - Sequential number
 * @returns {string} Generated ID
 * 
 * @example
 * generateId('', 1001); // '1001' (patient)
 * generateId('OPDN', 6); // 'OPDN6' (appointment/OPD)
 */
export function generateId(prefix, sequence) {
  if (!prefix) {
    // No prefix (patients) - just return the number
    return String(sequence);
  }
  // With prefix - return PREFIX + number (no padding)
  return `${prefix}${sequence}`;
}

/**
 * Get the next sequence number globally for a collection
 * Queries the database to find the highest existing sequence
 * 
 * @param {import('mongodb').Db} db - MongoDB database instance
 * @param {string} collectionName - Collection to query
 * @param {string} idField - Field name containing the ID
 * @param {string} prefix - ID prefix (used to extract numeric part)
 * @returns {Promise<number>} Next sequence number
 * 
 * @example
 * const nextSeq = await getNextSequence(db, 'patients', 'patientId', '');
 * // Returns: 1001 (or next available number for patients)
 */
export async function getNextSequence(db, collectionName, idField, prefix) {
  // Determine the starting sequence based on collection type
  let startingSeq = 1;
  if (collectionName === 'patients') {
    startingSeq = STARTING_SEQUENCES.PATIENT || 1001;
  } else if (collectionName === 'appointments') {
    startingSeq = STARTING_SEQUENCES.APPOINTMENT || 1;
  } else if (collectionName === 'opd_bills') {
    startingSeq = STARTING_SEQUENCES.OPD_BILL || 1;
  }

  // Find the highest numeric ID in the collection
  const allDocs = await db
    .collection(collectionName)
    .find({ [idField]: { $exists: true } })
    .project({ [idField]: 1 })
    .toArray();

  if (allDocs.length === 0) {
    return startingSeq;
  }

  // Extract numeric values from all IDs and find the max
  let maxSeq = 0;
  for (const doc of allDocs) {
    const idValue = doc[idField];
    if (!idValue) continue;
    
    let numericPart;
    const idStr = String(idValue);
    
    // Handle different formats:
    // 1. Pure numeric: "1001", "1002"
    // 2. Prefix + number: "OPDN6", "OPDN10"
    // 3. Old format with dashes: "PAT-20231201-0001"
    
    if (prefix && idStr.startsWith(prefix)) {
      // Extract number after prefix (e.g., "OPDN6" -> 6)
      numericPart = parseInt(idStr.substring(prefix.length), 10);
    } else if (idStr.includes('-')) {
      // Old format: extract last part
      const parts = idStr.split('-');
      numericPart = parseInt(parts[parts.length - 1], 10);
    } else {
      // Pure numeric
      numericPart = parseInt(idStr, 10);
    }
    
    if (!isNaN(numericPart) && numericPart > maxSeq) {
      maxSeq = numericPart;
    }
  }
  
  // Return max + 1, but ensure it's at least the starting sequence
  return Math.max(maxSeq + 1, startingSeq);
}

/**
 * Generate a unique ID following legacy convention
 * 
 * @param {import('mongodb').Db} db - MongoDB database instance
 * @param {string} collectionName - Collection to query
 * @param {string} idField - Field name containing the ID
 * @param {string} prefix - ID prefix (empty for patients, 'OPDN' for appointments)
 * @returns {Promise<string>} Generated unique ID
 * 
 * @example
 * const patientId = await generateUniqueId(db, 'patients', 'patientId', '');
 * // Returns: '4001' (continues from legacy 1001-3008)
 * 
 * const appointmentId = await generateUniqueId(db, 'appointments', 'appointmentId', 'OPDN');
 * // Returns: 'OPDN5641' (continues from legacy)
 */
export async function generateUniqueId(db, collectionName, idField, prefix) {
  const sequence = await getNextSequence(db, collectionName, idField, prefix);
  return generateId(prefix, sequence);
}

/**
 * Generate a simple 4-character alphanumeric code
 * Useful for short codes like medicine IDs
 * 
 * @returns {string} 4-character code
 */
export function generateShortCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default {
  getDateString,
  generateId,
  getNextSequence,
  generateUniqueId,
  generateShortCode,
};
