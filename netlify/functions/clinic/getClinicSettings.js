/**
 * Get Clinic Settings API
 * 
 * Endpoint: GET /.netlify/functions/clinic-getClinicSettings
 * 
 * Response:
 *   { success: true, settings: Object }
 */

import { getDb, COLLECTIONS } from '../utils/db.js';
import { success } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function getClinicSettings(event) {
  const db = await getDb();

  let settings = await db.collection(COLLECTIONS.CLINIC_SETTINGS).findOne({});

  // Return default settings if none exist
  if (!settings) {
    settings = {
      clinicName: 'Avia Health Clinic',
      tagline: 'Your Health, Our Priority',
      logo: null,
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        pincode: '',
      },
      phones: [],
      email: '',
      website: '',
      gstNo: '',
      drugLicenseNo: '',
      timings: 'Mon-Sat: 9:00 AM - 8:00 PM',
      letterheadHeader: null,
      letterheadFooter: '',
      invoiceTerms: '',
      prescriptionFooter: '',
    };
  }

  return success({ settings });
}

export const handler = withErrorHandler(getClinicSettings);
