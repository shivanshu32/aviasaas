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
 *     remarks?: string
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
import { PAYMENT_STATUS, STOCK_STATUS } from '../../shared/constants/enums.js';

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
  }

  const db = await getDb();

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

  // Fetch all medicines and batches, validate stock
  const billItems = [];
  const stockUpdates = [];

  for (const item of data.items) {
    // Get medicine
    const medicineQuery = ObjectId.isValid(item.medicineId)
      ? { _id: new ObjectId(item.medicineId) }
      : { medicineId: item.medicineId };
    
    const medicine = await db.collection(COLLECTIONS.MEDICINES).findOne(medicineQuery);
    if (!medicine) {
      return notFound(`Medicine (${item.medicineId})`);
    }

    // Get batch
    const batchQuery = ObjectId.isValid(item.batchId)
      ? { _id: new ObjectId(item.batchId) }
      : { batchNo: item.batchId, medicineId: medicine._id };
    
    const batch = await db.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).findOne(batchQuery);
    if (!batch) {
      return notFound(`Stock batch (${item.batchId})`);
    }

    // Check stock availability
    if (batch.currentQty < item.quantity) {
      return unprocessable(`Insufficient stock for ${medicine.name}`, {
        medicine: medicine.name,
        batchNo: batch.batchNo,
        available: batch.currentQty,
        requested: item.quantity,
      });
    }

    // Calculate item amount
    const sellingPrice = batch.sellingPrice || batch.mrp;
    const amount = item.quantity * sellingPrice;

    billItems.push({
      medicineId: medicine._id,
      batchId: batch._id,
      medicineName: medicine.name,
      batchNo: batch.batchNo,
      expiryDate: batch.expiryDate,
      quantity: item.quantity,
      mrp: batch.mrp,
      sellingPrice,
      discount: 0,
      gstRate: batch.gstRate || 0,
      amount,
    });

    // Prepare stock update
    const newQty = batch.currentQty - item.quantity;
    let newStatus = batch.status;
    if (newQty === 0) {
      newStatus = STOCK_STATUS.EXHAUSTED;
    } else if (newQty <= medicine.reorderLevel) {
      newStatus = STOCK_STATUS.LOW;
    }

    stockUpdates.push({
      batchId: batch._id,
      newQty,
      newStatus,
    });
  }

  // Calculate bill totals (prices are GST-inclusive, no separate GST)
  const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0);

  let discountAmount = 0;
  if (data.discountValue && data.discountValue > 0) {
    if (data.discountType === 'percentage') {
      discountAmount = (subtotal * data.discountValue) / 100;
    } else {
      discountAmount = data.discountValue;
    }
  }

  const taxableAmount = subtotal - discountAmount;
  
  // GST is inclusive in medicine prices, so no separate GST calculation
  const cgst = 0;
  const sgst = 0;
  
  const grandTotal = Math.round(taxableAmount);
  const roundOff = grandTotal - taxableAmount;

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

  // Create bill and update stock using transaction
  const now = new Date();
  
  const bill = {
    _id: new ObjectId(),
    billNo,
    patientId: patient ? patient._id : null,
    patientName: data.patientName,
    patientPhone: data.patientPhone || null,
    doctorId: doctor ? doctor._id : null,
    prescriptionId: prescription ? prescription._id : null,
    billDate: now,
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
    createdBy: data.createdBy || 'Pharmacy',
    createdAt: now,
  };

  // Use transaction to ensure atomicity
  try {
    await withTransaction(async (session, txDb) => {
      // Insert bill
      await txDb.collection(COLLECTIONS.MEDICINE_BILLS).insertOne(bill, { session });

      // Update stock for each item
      for (const update of stockUpdates) {
        await txDb.collection(COLLECTIONS.MEDICINE_STOCK_BATCHES).updateOne(
          { _id: update.batchId },
          {
            $set: {
              currentQty: update.newQty,
              status: update.newStatus,
              updatedAt: now,
            },
          },
          { session }
        );
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
