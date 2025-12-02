/**
 * Update Clinic Settings API
 * 
 * Endpoint: PUT /.netlify/functions/clinic-updateClinicSettings
 * 
 * Request Body:
 *   {
 *     clinicName?: string,
 *     tagline?: string,
 *     logo?: string (base64),
 *     address?: { line1, line2, city, state, pincode },
 *     phones?: string[],
 *     email?: string,
 *     website?: string,
 *     gstNo?: string,
 *     drugLicenseNo?: string,
 *     timings?: string,
 *     letterheadHeader?: string,
 *     letterheadFooter?: string,
 *     invoiceTerms?: string,
 *     prescriptionFooter?: string
 *   }
 * 
 * Response:
 *   { success: true, message: string, settings: Object }
 */

import { getDb, COLLECTIONS } from '../utils/db.js';
import { success, badRequest } from '../utils/response.js';
import { withErrorHandler } from '../utils/errorHandler.js';

async function updateClinicSettings(event) {
  if (event.httpMethod !== 'PUT') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};
  const db = await getDb();
  const collection = db.collection(COLLECTIONS.CLINIC_SETTINGS);

  // Get existing settings
  const existing = await collection.findOne({});

  const now = new Date();
  const updateData = {
    ...data,
    updatedAt: now,
  };

  let settings;

  if (existing) {
    // Update existing
    settings = await collection.findOneAndUpdate(
      { _id: existing._id },
      { $set: updateData },
      { returnDocument: 'after' }
    );
  } else {
    // Create new
    const newSettings = {
      clinicName: data.clinicName || 'Clinic Name',
      tagline: data.tagline || '',
      logo: data.logo || null,
      address: data.address || {},
      phones: data.phones || [],
      email: data.email || '',
      website: data.website || '',
      gstNo: data.gstNo || '',
      drugLicenseNo: data.drugLicenseNo || '',
      timings: data.timings || '',
      letterheadHeader: data.letterheadHeader || null,
      letterheadFooter: data.letterheadFooter || '',
      invoiceTerms: data.invoiceTerms || '',
      prescriptionFooter: data.prescriptionFooter || '',
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(newSettings);
    settings = newSettings;
  }

  return success(
    { settings },
    'Clinic settings updated successfully'
  );
}

export const handler = withErrorHandler(updateClinicSettings);
