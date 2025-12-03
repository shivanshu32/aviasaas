/**
 * Generate OPD Bill API
 * 
 * Endpoint: POST /.netlify/functions/billing-opd-generateOpdBill
 * 
 * Request Body:
 *   {
 *     patientId: string (required),
 *     doctorId: string (required),
 *     appointmentId?: string,
 *     items: [{ description, quantity, rate }] (required),
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
import { PAYMENT_STATUS } from '../../shared/constants/enums.js';

async function generateOpdBill(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.patientId) return badRequest('Patient ID is required');
  if (!data.doctorId) return badRequest('Doctor ID is required');
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return badRequest('At least one bill item is required');
  }
  if (!data.paymentMode) return badRequest('Payment mode is required');

  const db = await getDb();

  // Verify patient
  const patientQuery = ObjectId.isValid(data.patientId)
    ? { _id: new ObjectId(data.patientId) }
    : { patientId: data.patientId };
  
  const patient = await db.collection(COLLECTIONS.PATIENTS).findOne(patientQuery);
  if (!patient) return notFound('Patient');

  // Verify doctor
  const doctorQuery = ObjectId.isValid(data.doctorId)
    ? { _id: new ObjectId(data.doctorId) }
    : { doctorId: data.doctorId };
  
  const doctor = await db.collection(COLLECTIONS.DOCTORS).findOne(doctorQuery);
  if (!doctor) return notFound('Doctor');

  // Verify appointment if provided
  let appointment = null;
  if (data.appointmentId) {
    const appointmentQuery = ObjectId.isValid(data.appointmentId)
      ? { _id: new ObjectId(data.appointmentId) }
      : { appointmentId: data.appointmentId };
    appointment = await db.collection(COLLECTIONS.APPOINTMENTS).findOne(appointmentQuery);
    
    // Check if bill already exists for this appointment
    if (appointment) {
      const existingBill = await db.collection(COLLECTIONS.OPD_BILLS).findOne({
        appointmentId: appointment._id
      });
      if (existingBill) {
        return badRequest(`Bill already generated for this appointment (Bill No: ${existingBill.billNo})`);
      }
    }
  }

  // Calculate bill amounts
  const items = data.items.map((item) => ({
    description: item.description,
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
  const cgst = 0; // No GST on medical services typically
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
    COLLECTIONS.OPD_BILLS,
    'billNo',
    BILL_PREFIXES.OPD_BILL
  );

  // Create bill document
  const now = new Date();
  const bill = {
    _id: new ObjectId(),
    billNo,
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentId: appointment ? appointment._id : null,
    billDate: now,
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
    createdBy: data.createdBy || 'Reception',
    createdAt: now,
  };

  await db.collection(COLLECTIONS.OPD_BILLS).insertOne(bill);

  // Return with patient and doctor info for printing
  const response = {
    ...bill,
    patient: {
      _id: patient._id,
      patientId: patient.patientId,
      name: patient.name,
      phone: patient.phone,
      age: patient.age,
      gender: patient.gender,
      address: patient.address,
    },
    doctor: {
      _id: doctor._id,
      doctorId: doctor.doctorId,
      name: doctor.name,
      specialization: doctor.specialization,
    },
  };

  return created(
    { bill: response },
    'OPD bill generated successfully'
  );
}

export const handler = withErrorHandler(generateOpdBill);
