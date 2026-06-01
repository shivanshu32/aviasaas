/**
 * Update Medicine Bill API
 * Endpoint: PUT /.netlify/functions/billing-medicine-updateMedicineBill
 *
 * Reverses prior stock deductions (if any), then applies the updated line items.
 */

import { ObjectId } from 'mongodb';
import { getDb, COLLECTIONS, withTransaction } from './utils/db.js';
import { success, badRequest, notFound, unprocessable } from './utils/response.js';
import { withErrorHandler } from './utils/errorHandler.js';
import { PAYMENT_STATUS } from '../../shared/constants/enums.js';
import {
  parseBillDateInput,
  isFutureBillDate,
  isBackdatedBill,
} from '../../shared/utils/billDate.js';
import {
  buildMedicineBillLineItems,
  restoreStockForBillItems,
  applyStockUpdates,
} from './utils/medicineBillStock.js';

function validatePayload(data) {
  if (!data.patientName) return 'Patient name is required';
  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    return 'At least one medicine item is required';
  }
  if (!data.paymentMode) return 'Payment mode is required';

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item.medicineId) return `Item ${i + 1}: Medicine ID is required`;
    if (!item.batchId) return `Item ${i + 1}: Batch ID is required`;
    if (!item.quantity || item.quantity <= 0) {
      return `Item ${i + 1}: Valid quantity is required`;
    }
    const pct = Number(item.discountPercent);
    if (
      item.discountPercent != null &&
      item.discountPercent !== '' &&
      (Number.isNaN(pct) || pct < 0 || pct > 100)
    ) {
      return `Item ${i + 1}: Discount must be between 0 and 100`;
    }
  }
  return null;
}

async function updateMedicineBill(event) {
  if (event.httpMethod !== 'PUT') {
    return badRequest('Method not allowed');
  }

  const data = event.parsedBody || {};
  const billId = data.id || event.queryStringParameters?.id;

  if (!billId) {
    return badRequest('Bill ID is required');
  }

  const validationError = validatePayload(data);
  if (validationError) {
    return badRequest(validationError);
  }

  const db = await getDb();
  const now = new Date();

  const query = ObjectId.isValid(billId)
    ? { _id: new ObjectId(billId) }
    : { billNo: billId };

  const existing = await db.collection(COLLECTIONS.MEDICINE_BILLS).findOne(query);
  if (!existing) {
    return notFound('Bill');
  }
  if (existing.isReturn) {
    return badRequest('Return bills cannot be edited');
  }

  const billDate = parseBillDateInput(data.billDate) || existing.billDate || now;
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

  let patient = null;
  if (data.patientId) {
    const patientQuery = ObjectId.isValid(data.patientId)
      ? { _id: new ObjectId(data.patientId) }
      : { patientId: data.patientId };
    patient = await db.collection(COLLECTIONS.PATIENTS).findOne(patientQuery);
  }

  let doctor = null;
  if (data.doctorId) {
    const doctorQuery = ObjectId.isValid(data.doctorId)
      ? { _id: new ObjectId(data.doctorId) }
      : { doctorId: data.doctorId };
    doctor = await db.collection(COLLECTIONS.DOCTORS).findOne(doctorQuery);
  }

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

  const subtotal = billItems.reduce((sum, item) => sum + item.amount, 0);
  const grandTotal = Math.round(subtotal);
  const roundOff = grandTotal - subtotal;

  const paymentDetails = data.paymentDetails || {};
  const paidAmount =
    data.paymentMode === 'mixed'
      ? (Number(paymentDetails.cash) || 0) +
        (Number(paymentDetails.card) || 0) +
        (Number(paymentDetails.upi) || 0)
      : grandTotal;

  const dueAmount = grandTotal - paidAmount;
  const paymentStatus =
    dueAmount <= 0
      ? PAYMENT_STATUS.PAID
      : dueAmount < grandTotal
        ? PAYMENT_STATUS.PARTIAL
        : PAYMENT_STATUS.PENDING;

  try {
    await withTransaction(async (session, txDb) => {
      if (existing.stockDeducted) {
        await restoreStockForBillItems(txDb, existing.items, session, now);
      }

      if (!skipStockDeduction) {
        await applyStockUpdates(txDb, stockUpdates, session, now);
      }

      await txDb.collection(COLLECTIONS.MEDICINE_BILLS).updateOne(
        { _id: existing._id },
        {
          $set: {
            patientId: patient ? patient._id : null,
            patientName: data.patientName,
            patientPhone: data.patientPhone || null,
            doctorId: doctor ? doctor._id : null,
            billDate,
            items: billItems,
            subtotal,
            discountType: null,
            discountValue: 0,
            discountAmount: 0,
            taxableAmount: subtotal,
            cgst: 0,
            sgst: 0,
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
            remarks: data.remarks ?? existing.remarks ?? null,
            backdated,
            stockDeducted: !skipStockDeduction,
            updatedAt: now,
          },
        },
        { session },
      );
    });
  } catch (error) {
    console.error('Update medicine bill transaction failed:', error);
    return unprocessable('Failed to update bill. Please try again.');
  }

  const updated = await db.collection(COLLECTIONS.MEDICINE_BILLS).findOne({ _id: existing._id });

  const response = {
    ...updated,
    patient: patient
      ? {
          _id: patient._id,
          patientId: patient.patientId,
          name: patient.name,
          phone: patient.phone,
          age: patient.age,
          gender: patient.gender,
        }
      : null,
    doctor: doctor
      ? {
          _id: doctor._id,
          name: doctor.name,
        }
      : null,
  };

  return success({ bill: response }, 'Medicine bill updated successfully');
}

export const handler = withErrorHandler(updateMedicineBill);
