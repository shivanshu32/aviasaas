/**
 * Example Usage of Print Components
 * 
 * This file demonstrates how to use the print components with react-to-print
 */

import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';
import { Button } from '../ui';
import { 
  PrescriptionPrint, 
  OpdBillPrint, 
  MiscBillPrint, 
  MedicineBillPrint,
  PrintWrapper,
  usePrintDocument 
} from './index';

// ============================================
// Example 1: Basic Usage with useReactToPrint
// ============================================
export function BasicPrintExample({ bill }) {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `OPD-Bill-${bill?.billNo}`,
  });

  return (
    <div>
      {/* Print Button */}
      <Button onClick={handlePrint} icon={Printer}>
        Print Bill
      </Button>

      {/* Hidden Print Content */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <OpdBillPrint bill={bill} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Example 2: Using Custom Hook
// ============================================
export function HookPrintExample({ prescription }) {
  const { printRef, handlePrint } = usePrintDocument(`Rx-${prescription?.prescriptionId}`);

  return (
    <div>
      <Button onClick={handlePrint} icon={Printer}>
        Print Prescription
      </Button>

      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <PrescriptionPrint prescription={prescription} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Example 3: Full Page Print Preview
// ============================================
export function PrintPreviewExample({ bill, type = 'opd' }) {
  const [showPreview, setShowPreview] = useState(false);

  const PrintComponent = {
    opd: OpdBillPrint,
    misc: MiscBillPrint,
    medicine: MedicineBillPrint,
  }[type];

  return (
    <div>
      <Button onClick={() => setShowPreview(true)} icon={Printer}>
        Print Preview
      </Button>

      {showPreview && (
        <PrintWrapper
          title={`${type.toUpperCase()} Bill Preview`}
          documentName={`${type}-bill-${bill?.billNo}`}
          onClose={() => setShowPreview(false)}
        >
          <PrintComponent bill={bill} />
        </PrintWrapper>
      )}
    </div>
  );
}

// ============================================
// Example 4: Inline Print Preview (Visible)
// ============================================
export function InlinePrintPreview({ data, type }) {
  const printRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${type}-${data?.billNo || data?.prescriptionId}`,
  });

  const renderPrintContent = () => {
    switch (type) {
      case 'prescription':
        return <PrescriptionPrint ref={printRef} prescription={data} />;
      case 'opd':
        return <OpdBillPrint ref={printRef} bill={data} />;
      case 'misc':
        return <MiscBillPrint ref={printRef} bill={data} />;
      case 'medicine':
        return <MedicineBillPrint ref={printRef} bill={data} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Action Bar */}
      <div className="flex justify-end gap-2 mb-4 no-print">
        <Button onClick={handlePrint} icon={Printer}>
          Print
        </Button>
      </div>

      {/* Visible Print Preview */}
      <div className="bg-gray-100 p-4 rounded-lg overflow-auto">
        {renderPrintContent()}
      </div>
    </div>
  );
}

// ============================================
// Sample Data for Testing
// ============================================
export const samplePrescription = {
  prescriptionId: 'RX-20241202-0001',
  prescriptionDate: new Date().toISOString(),
  patient: {
    name: 'Rajesh Kumar',
    age: 45,
    gender: 'Male',
    phone: '9876543210',
    patientId: 'PAT-20241201-0001',
  },
  doctor: {
    name: 'Dr. Priya Sharma',
    qualification: 'MBBS, MD (Medicine)',
    specialization: 'General Physician',
    registrationNo: 'MCI-12345',
  },
  vitals: {
    bp: '120/80',
    pulse: 72,
    temp: 98.6,
    weight: 70,
    spo2: 98,
  },
  diagnosis: 'Acute Upper Respiratory Tract Infection with Fever',
  medicines: [
    {
      name: 'Paracetamol 500mg',
      dosage: '1 tablet',
      frequency: 'Three times a day',
      timing: 'After meals',
      duration: 5,
      durationUnit: 'days',
      instructions: 'Take with warm water',
    },
    {
      name: 'Azithromycin 500mg',
      dosage: '1 tablet',
      frequency: 'Once daily',
      timing: 'After breakfast',
      duration: 3,
      durationUnit: 'days',
    },
    {
      name: 'Cetirizine 10mg',
      dosage: '1 tablet',
      frequency: 'Once daily',
      timing: 'At bedtime',
      duration: 5,
      durationUnit: 'days',
    },
  ],
  investigations: ['Complete Blood Count', 'Chest X-Ray PA View'],
  advice: 'Rest well. Drink plenty of fluids. Avoid cold drinks and ice cream.',
  followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
};

export const sampleOpdBill = {
  billNo: 'OPD-20241202-0001',
  billDate: new Date().toISOString(),
  patient: {
    name: 'Rajesh Kumar',
    patientId: 'PAT-20241201-0001',
    age: 45,
    gender: 'Male',
    phone: '9876543210',
    address: {
      line1: '123, Main Street',
      city: 'Mumbai',
    },
  },
  doctor: {
    name: 'Dr. Priya Sharma',
    qualification: 'MBBS, MD',
    specialization: 'General Physician',
  },
  items: [
    { description: 'Consultation Fee', quantity: 1, rate: 500, amount: 500 },
    { description: 'ECG', quantity: 1, rate: 200, amount: 200 },
  ],
  subtotal: 700,
  discountType: 'fixed',
  discountValue: 50,
  discountAmount: 50,
  grandTotal: 650,
  paymentMode: 'cash',
  paymentStatus: 'paid',
  paidAmount: 650,
  dueAmount: 0,
  createdAt: new Date().toISOString(),
  createdBy: 'Reception',
};

export const sampleMedicineBill = {
  billNo: 'MED-20241202-0001',
  billDate: new Date().toISOString(),
  patient: {
    name: 'Rajesh Kumar',
    patientId: 'PAT-20241201-0001',
    phone: '9876543210',
  },
  doctor: {
    name: 'Dr. Priya Sharma',
  },
  items: [
    {
      medicineName: 'Paracetamol 500mg',
      manufacturer: 'Cipla Ltd',
      batchNo: 'BAT2024001',
      expiryDate: '2026-06-30',
      quantity: 10,
      mrp: 25,
      sellingPrice: 22,
      amount: 220,
    },
    {
      medicineName: 'Azithromycin 500mg',
      manufacturer: 'Sun Pharma',
      batchNo: 'BAT2024002',
      expiryDate: '2025-12-31',
      quantity: 3,
      mrp: 85,
      sellingPrice: 80,
      amount: 240,
    },
  ],
  subtotal: 460,
  discountAmount: 0,
  cgst: 27.6,
  sgst: 27.6,
  grandTotal: 515,
  paymentMode: 'upi',
  paymentStatus: 'paid',
  paidAmount: 515,
  dueAmount: 0,
  createdAt: new Date().toISOString(),
  createdBy: 'Pharmacy',
};
