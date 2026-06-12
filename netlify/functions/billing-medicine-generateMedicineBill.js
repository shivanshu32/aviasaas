/**
 * Generate Medicine Bill API
 * Creates medicine bill and deducts stock atomically
 * 
 * Endpoint: POST /.netlify/functions/billing-medicine-generateMedicineBill
 * 
 * Request Body:
 *   {
 *     patientId?: string,
 *     patientName: string (required),
 *     patientPhone?: string,
 *     doctorId?: string,
 *     prescriptionId?: string,
 *     items: [{
 *       medicineId: string (required),
 *       batchId: string (required),
 *       quantity: number (required)
 *     }] (required),
 *     discountType?: 'percentage' | 'fixed',
 *     discountValue?: number,
 *     paymentMode: 'cash' | 'card' | 'upi' | 'mixed' (required),
 *     paymentDetails?: { cash, card, upi, upiRef },
 *     remarks?: string,
 *     billDate?: string (YYYY-MM-DD, may be in the past for backdated bills),
 *     deductStock?: boolean (default true; set false with a past billDate to record sale without changing inventory)
 *   }
 * 
 * Response:
 *   { success: true, message: string, bill: Object }
 */

import { ObjectId } from 'mongodb';
import { getDb, getClient, COLLECTIONS, withTransaction } from './utils/db.js';
import { created, badRequest, notFound, unprocessable } from './utils/response.js';
import { withErrorHandler, InsufficientStockError } from './utils/errorHandler.js';
import { generateUniqueId } from '../../shared/utils/idGenerator.js';
import { BILL_PREFIXES } from '../../shared/constants/billPrefixes.js';
import { PAYMENT_STATUS } from '../../shared/constants/enums.js';
import {
  parseBillDateInput,
  isFutureBillDate,
  isBackdatedBill,
} from '../../shared/utils/billDate.js';
import { computeMedicineBillTotals } from '../../shared/utils/medicineBillTotals.js';
import {
  buildMedicineBillLineItems,
  applyStockUpdates,
} from './utils/medicineBillStock.js';

async function generateMedicineBill(event) {
  if (event.httpMethod !== 'POST') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};

  // Validate required fields
  if (!data.patientName) return badRequest('Patient name is required');
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return badRequest('At least one medicine item is required');
  }
  if (!data.paymentMode) return badRequest('Payment mode is required');

  // Validate each item has required fields
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item.medicineId) return badRequest(`Item ${i + 1}: Medicine ID is required`);
    if (!item.batchId) return badRequest(`Item ${i + 1}: Batch ID is required`);
    if (!item.quantity || item.quantity <= 0) {
      return badRequest(`Item ${i + 1}: Valid quantity is required`);
    }
    const pct = Number(item.discountPercent);
    if (item.discountPercent != null && item.discountPercent !== '' && (Number.isNaN(pct) || pct < 0 || pct > 100)) {
      return badRequest(`Item ${i + 1}: Discount must be between 0 and 100`);
    }
  }

  const db = await getDb();
  const now = new Date();
  const billDate = parseBillDateInput(data.billDate) || now;

  if (Number.isNaN(billDate.getTime())) {
    return badRequest('Invalid bill date');
  }
  if (isFutureBillDate(billDate)) {
    return badRequest('Bill date cannot be in the future');
  }

  const backdated = isBackdatedBill(billDate);
  const skipStockDeduction = backdated && data.deductStock === false;

  if (!backdated && data.deductStock === false) {
    return badRequest('Skipping stock deduction is only allowed for backdated bills');
  }

  // Get patient if ID provided
  let patient = null;
  if (data.patientId) {
    const patientQuery = ObjectId.isValid(data.patientId)
      ? { _id: new ObjectId(data.patientId) }
      : { patientId: data.patientId };
    patient = await db.collection(COLLECTIONS.PATIENTS).findOne(patientQuery);
  }

  // Get doctor if provided
  let doctor = null;
  if (data.doctorId) {
    const doctorQuery = ObjectId.isValid(data.doctorId)
      ? { _id: new ObjectId(data.doctorId) }
      : { doctorId: data.doctorId };
    doctor = await db.collection(COLLECTIONS.DOCTORS).findOne(doctorQuery);
  }

  // Get prescription if provided
  let prescription = null;
  if (data.prescriptionId) {
    const prescriptionQuery = ObjectId.isValid(data.prescriptionId)
      ? { _id: new ObjectId(data.prescriptionId) }
      : { prescriptionId: data.prescriptionId };
    prescription = await db.collection(COLLECTIONS.OPD_PRESCRIPTIONS).findOne(prescriptionQuery);
  }

  // Build bill items with multi-batch auto-allocation support
  let billItems;
  let stockUpdates;
  try {
    ({ billItems, stockUpdates } = await buildMedicineBillLineItems(db, data.items, {
      skipStockDeduction,
    }));
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return notFound(err.message);
    }
    if (err.code === 'INSUFFICIENT_STOCK') {
      return unprocessable(err.message, err.details);
    }
    throw err;
  }

  const {
    subtotal,
    discountAmount,
    taxableAmount,
    cgst,
    sgst,
    grandTotal,
    roundOff,
  } = computeMedicineBillTotals(billItems);

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
    COLLECTIONS.MEDICINE_BILLS,
    'billNo',
    BILL_PREFIXES.MEDICINE_BILL
  );

  const bill = {
    _id: new ObjectId(),
    billNo,
    patientId: patient ? patient._id : null,
    patientName: data.patientName,
    patientPhone: data.patientPhone || null,
    doctorId: doctor ? doctor._id : null,
    prescriptionId: prescription ? prescription._id : null,
    billDate,
    items: billItems,
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
    returnBillRef: null,
    isReturn: false,
    remarks: data.remarks || null,
    backdated,
    stockDeducted: !skipStockDeduction,
    createdBy: data.createdBy || 'Pharmacy',
    createdAt: now,
  };

  // Use transaction to ensure atomicity
  try {
    await withTransaction(async (session, txDb) => {
      await txDb.collection(COLLECTIONS.MEDICINE_BILLS).insertOne(bill, { session });

      if (stockUpdates.length > 0) {
        const billContext = {
          billId: bill._id,
          billNo: bill.billNo,
          patientName: data.patientName,
          performedBy: bill.createdBy,
        };
        await applyStockUpdates(txDb, stockUpdates, session, now, billContext, billItems);
      }
    });
  } catch (error) {
    console.error('Transaction failed:', error);
    return unprocessable('Failed to generate bill. Please try again.');
  }

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
    doctor: doctor ? {
      _id: doctor._id,
      name: doctor.name,
    } : null,
  };

  return created(
    { bill: response },
    'Medicine bill generated successfully'
  );
}

export const handler = withErrorHandler(generateMedicineBill);
