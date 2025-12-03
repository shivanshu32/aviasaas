/**
 * Generate Miscellaneous Bill API
 * For lab tests, radiology, procedures, etc.
 * 
 * Endpoint: POST /.netlify/functions/billing-misc-generateMiscBill
 * 
 * Request Body:
 *   {
 *     patientId?: string (optional for walk-in),
 *     patientName: string (required),
 *     patientPhone?: string,
 *     referredBy?: string (doctor ID),
 *     category: 'laboratory' | 'radiology' | 'procedure' | 'other',
 *     items: [{ code?, description, category, quantity, rate }] (required),
 *     discountType?: 'percentage' | 'fixed',
 *     discountValue?: number,
 *     paymentMode: 'cash' | 'card' | 'upi' | 'mixed' (required),
 *     paymentDetails?: { cash, card, upi, upiRef },
 *     remarks?: string
 *   }
 * 
 * Response:
 *   { success: true, message: string, bill: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS } from './utils/db.js';
import { created, badRequest, notFound } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { generateUniqueId } from '../../shared/utils/idGenerator.js';
import { BILL_PREFIXES } from '../../shared/constants/billPrefixes.js';
import { PAYMENT_STATUS, MISC_BILL_CATEGORY } from '../../shared/constants/enums.js';

async function generateMiscBill(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.patientName) return badRequest('Patient name is required');
  if (!data.category) return badRequest('Bill category is required');
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return badRequest('At least one bill item is required');
  }
  if (!data.paymentMode) return badRequest('Payment mode is required');

  const db = await getDb();

  // Get patient if ID provided
  let patient = null;
  if (data.patientId) {
    const patientQuery = ObjectId.isValid(data.patientId)
      ? { _id: new ObjectId(data.patientId) }
      : { patientId: data.patientId };
    patient = await db.collection(COLLECTIONS.PATIENTS).findOne(patientQuery);
  }

  // Get referring doctor if provided
  let referringDoctor = null;
  if (data.referredBy) {
    const doctorQuery = ObjectId.isValid(data.referredBy)
      ? { _id: new ObjectId(data.referredBy) }
      : { doctorId: data.referredBy };
    referringDoctor = await db.collection(COLLECTIONS.DOCTORS).findOne(doctorQuery);
  }

  // Calculate bill amounts
  const items = data.items.map((item) => ({
    code: item.code || null,
    description: item.description,
    category: item.category || data.category,
    quantity: Number(item.quantity) || 1,
    rate: Number(item.rate) || 0,
    amount: (Number(item.quantity) || 1) * (Number(item.rate) || 0),
  }));

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  // Calculate discount
  let discountAmount = 0;
  if (data.discountValue && data.discountValue > 0) {
    if (data.discountType === 'percentage') {
      discountAmount = (subtotal * data.discountValue) / 100;
    } else {
      discountAmount = data.discountValue;
    }
  }

  const taxableAmount = subtotal - discountAmount;
  const cgst = 0;
  const sgst = 0;
  const grandTotal = Math.round(taxableAmount + cgst + sgst);
  const roundOff = grandTotal - (taxableAmount + cgst + sgst);

  // Calculate payment
  const paymentDetails = data.paymentDetails || {};
  const paidAmount = data.paymentMode === 'mixed'
    ? (Number(paymentDetails.cash) || 0) +
      (Number(paymentDetails.card) || 0) +
      (Number(paymentDetails.upi) || 0)
    : grandTotal;

  const dueAmount = grandTotal - paidAmount;
  const paymentStatus = dueAmount <= 0
    ? PAYMENT_STATUS.PAID
    : dueAmount < grandTotal
      ? PAYMENT_STATUS.PARTIAL
      : PAYMENT_STATUS.PENDING;

  // Generate bill number
  const billNo = await generateUniqueId(
    db,
    COLLECTIONS.MISC_BILLS,
    'billNo',
    BILL_PREFIXES.MISC_BILL
  );

  // Create bill document
  const now = new Date();
  const bill = {
    _id: new ObjectId(),
    billNo,
    patientId: patient ? patient._id : null,
    patientName: data.patientName,
    patientPhone: data.patientPhone || null,
    referredBy: referringDoctor ? referringDoctor._id : null,
    billDate: now,
    category: data.category,
    items,
    subtotal,
    discountType: data.discountType || null,
    discountValue: data.discountValue || 0,
    discountAmount,
    taxableAmount,
    cgst,
    sgst,
    grandTotal,
    roundOff,
    paymentMode: data.paymentMode,
    paymentDetails: {
      cash: Number(paymentDetails.cash) || 0,
      card: Number(paymentDetails.card) || 0,
      upi: Number(paymentDetails.upi) || 0,
      upiRef: paymentDetails.upiRef || null,
    },
    paymentStatus,
    paidAmount,
    dueAmount,
    remarks: data.remarks || null,
    createdBy: data.createdBy || 'Lab',
    createdAt: now,
  };

  await db.collection(COLLECTIONS.MISC_BILLS).insertOne(bill);

  // Return with related info
  const response = {
    ...bill,
    patient: patient ? {
      _id: patient._id,
      patientId: patient.patientId,
      name: patient.name,
      phone: patient.phone,
      age: patient.age,
      gender: patient.gender,
    } : null,
    referringDoctor: referringDoctor ? {
      _id: referringDoctor._id,
      name: referringDoctor.name,
    } : null,
  };

  return created(
    { bill: response },
    'Miscellaneous bill generated successfully'
  );
}

export const handler = withErrorHandler(generateMiscBill);
