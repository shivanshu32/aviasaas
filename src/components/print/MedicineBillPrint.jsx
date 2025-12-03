import { forwardRef } from 'react';
import Letterhead from './Letterhead';
import './PrintStyles.css';

const MedicineBillPrint = forwardRef(({ bill }, ref) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatExpiry = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
  };

  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
    if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
    return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  };

  if (!bill) return null;

  const patient = bill.patient || {};
  const doctor = bill.doctor || {};

  return (
    <div ref={ref} className="print-document">
      {/* Letterhead */}
      <Letterhead showDoctor={false} />

      {/* Document Title */}
      <div className="document-title">Bill Receipt</div>

      {/* Bill Header */}
      <div className="bill-header">
        <div className="bill-info-left">
          <div className="bill-number">Bill No: {bill.billNo}</div>
          <div>Date: {formatDate(bill.billDate)} | Time: {formatTime(bill.billDate)}</div>
        </div>
        <div className="bill-info-right" style={{ textAlign: 'right' }}>
          <div>Payment: <strong style={{ textTransform: 'capitalize' }}>{bill.paymentMode}</strong></div>
          <div>Status: <strong style={{ color: bill.paymentStatus === 'paid' ? '#059669' : '#dc2626' }}>
            {bill.paymentStatus?.toUpperCase()}
          </strong></div>
        </div>
      </div>

      {/* Patient Info */}
      <div className="patient-section">
        <div className="patient-row">
          <span className="patient-label">Patient:</span>
          <span className="patient-value">{patient.name || bill.patientName || 'Walk-in'}</span>
        </div>
        <div className="patient-row">
          <span className="patient-label">Patient ID:</span>
          <span className="patient-value">{patient.patientId || '-'}</span>
        </div>
        <div className="patient-row">
          <span className="patient-label">Phone:</span>
          <span className="patient-value">{patient.phone || bill.patientPhone || '-'}</span>
        </div>
        {doctor.name && (
          <div className="patient-row">
            <span className="patient-label">Consultant:</span>
            <span className="patient-value">{doctor.name}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: '30px' }}>#</th>
            <th>Medicine Name</th>
            <th style={{ width: '70px' }}>Batch</th>
            <th style={{ width: '60px' }}>Expiry</th>
            <th style={{ width: '40px' }} className="text-center">Qty</th>
            <th style={{ width: '60px' }} className="text-right">MRP</th>
            <th style={{ width: '60px' }} className="text-right">Rate</th>
            <th style={{ width: '70px' }} className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items?.map((item, index) => (
            <tr key={index}>
              <td className="text-center">{index + 1}</td>
              <td>
                <div style={{ fontWeight: '500' }}>{item.medicineName || item.description}</div>
                {item.manufacturer && (
                  <div style={{ fontSize: '8pt', color: '#6b7280' }}>{item.manufacturer}</div>
                )}
              </td>
              <td style={{ fontSize: '9pt' }}>{item.batchNo}</td>
              <td style={{ fontSize: '9pt' }}>{item.expiryDate ? formatExpiry(item.expiryDate) : '-'}</td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">{item.mrp?.toFixed(2)}</td>
              <td className="text-right">{(item.sellingPrice || item.rate)?.toFixed(2)}</td>
              <td className="text-right" style={{ fontWeight: '500' }}>{item.amount?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="bill-totals">
        <div className="total-row subtotal">
          <span className="total-label">Subtotal</span>
          <span className="total-value">₹{bill.subtotal?.toFixed(2)}</span>
        </div>
        {bill.discountAmount > 0 && (
          <div className="total-row discount">
            <span className="total-label">
              Discount {bill.discountType === 'percentage' && `(${bill.discountValue}%)`}
            </span>
            <span className="total-value">-₹{bill.discountAmount?.toFixed(2)}</span>
          </div>
        )}
        {(bill.cgst > 0 || bill.sgst > 0) && (
          <>
            <div className="total-row">
              <span className="total-label">CGST</span>
              <span className="total-value">₹{bill.cgst?.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span className="total-label">SGST</span>
              <span className="total-value">₹{bill.sgst?.toFixed(2)}</span>
            </div>
          </>
        )}
        {bill.roundOff !== 0 && bill.roundOff !== undefined && (
          <div className="total-row">
            <span className="total-label">Round Off</span>
            <span className="total-value">₹{bill.roundOff?.toFixed(2)}</span>
          </div>
        )}
        <div className="total-row grand-total">
          <span>Grand Total</span>
          <span>₹{bill.grandTotal?.toFixed(2)}</span>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="amount-words">
        Amount in words: <strong>Rupees {numberToWords(Math.round(bill.grandTotal || 0))} Only</strong>
      </div>

      {/* Payment Info */}
      <div className="payment-info">
        <div className="payment-item">
          <div className="payment-label">Total Amount</div>
          <div className="payment-value">₹{bill.grandTotal?.toFixed(2)}</div>
        </div>
        <div className="payment-item">
          <div className="payment-label">Paid Amount</div>
          <div className="payment-value">₹{bill.paidAmount?.toFixed(2)}</div>
        </div>
        <div className="payment-item">
          <div className="payment-label">Balance Due</div>
          <div className={`payment-value ${bill.dueAmount > 0 ? 'due' : ''}`}>
            ₹{bill.dueAmount?.toFixed(2)}
          </div>
        </div>
      </div>

      {/* GST Note */}
      <div style={{ 
        fontSize: '8pt', 
        color: '#6b7280', 
        padding: '8px', 
        background: '#f9fafb', 
        borderRadius: '4px',
        marginTop: '12px',
        textAlign: 'center'
      }}>
        * All prices are inclusive of GST
      </div>

      {/* Remarks */}
      {bill.remarks && (
        <div className="notes-section">
          <div className="notes-title">Remarks</div>
          <div className="notes-content">{bill.remarks}</div>
        </div>
      )}

      {/* Footer */}
      <div className="print-footer">
        <div className="signature-section">
          <div className="signature-box">
            <div style={{ height: '40px' }}></div>
            <div className="signature-line">Patient/Attendant</div>
          </div>
          <div className="signature-box">
            <div style={{ height: '40px' }}></div>
            <div className="signature-line">Pharmacist</div>
          </div>
        </div>

        <div className="footer-notes">
          <p>• Please check the medicines before leaving the counter.</p>
          <p>• Medicines once sold will not be taken back or exchanged.</p>
          <p>• Store medicines as per instructions on the pack.</p>
          <p>• Keep medicines out of reach of children.</p>
          <p style={{ marginTop: '8px', fontSize: '7pt' }}>
            Generated on: {formatDate(bill.createdAt)} {formatTime(bill.createdAt)} | By: {bill.createdBy || 'System'}
          </p>
        </div>
      </div>
    </div>
  );
});

MedicineBillPrint.displayName = 'MedicineBillPrint';

export default MedicineBillPrint;
