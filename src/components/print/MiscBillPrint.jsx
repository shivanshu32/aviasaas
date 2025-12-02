import { forwardRef } from 'react';
import Letterhead from './Letterhead';
import './PrintStyles.css';

const MiscBillPrint = forwardRef(({ bill }, ref) => {
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

  const getCategoryLabel = (category) => {
    const labels = {
      laboratory: 'Laboratory',
      radiology: 'Radiology / Imaging',
      procedure: 'Procedure',
      other: 'Miscellaneous',
    };
    return labels[category] || category;
  };

  if (!bill) return null;

  const patient = bill.patient || {};
  const referringDoctor = bill.referringDoctor || {};

  return (
    <div ref={ref} className="print-document">
      {/* Letterhead */}
      <Letterhead showDoctor={false} />

      {/* Document Title */}
      <div className="document-title">
        {getCategoryLabel(bill.category)} Invoice
      </div>

      {/* Bill Header */}
      <div className="bill-header">
        <div className="bill-info-left">
          <div className="bill-number">Invoice No: {bill.billNo}</div>
          <div>Date: {formatDate(bill.billDate)} | Time: {formatTime(bill.billDate)}</div>
          <div>Category: <strong>{getCategoryLabel(bill.category)}</strong></div>
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
          <span className="patient-label">Age/Gender:</span>
          <span className="patient-value">
            {patient.age ? `${patient.age} yrs` : '-'} / {patient.gender || '-'}
          </span>
        </div>
        {referringDoctor.name && (
          <div className="patient-row">
            <span className="patient-label">Referred By:</span>
            <span className="patient-value">{referringDoctor.name}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="print-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}>#</th>
            <th>Test / Service Description</th>
            <th style={{ width: '80px' }} className="text-center">Qty</th>
            <th style={{ width: '100px' }} className="text-right">Rate (₹)</th>
            <th style={{ width: '100px' }} className="text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {bill.items?.map((item, index) => (
            <tr key={index}>
              <td className="text-center">{index + 1}</td>
              <td>
                {item.description}
                {item.category && item.category !== bill.category && (
                  <span style={{ fontSize: '8pt', color: '#6b7280', marginLeft: '8px' }}>
                    ({item.category})
                  </span>
                )}
              </td>
              <td className="text-center">{item.quantity}</td>
              <td className="text-right">{item.rate?.toFixed(2)}</td>
              <td className="text-right">{item.amount?.toFixed(2)}</td>
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
        <div className="total-row grand-total">
          <span>Grand Total</span>
          <span>₹{bill.grandTotal?.toFixed(2)}</span>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="amount-words">
        Amount in words: <strong>Rupees {numberToWords(Math.round(bill.grandTotal || 0))} Only</strong>
      </div>

      {/* Remarks */}
      {bill.remarks && (
        <div className="notes-section">
          <div className="notes-title">Remarks</div>
          <div className="notes-content">{bill.remarks}</div>
        </div>
      )}
    </div>
  );
});

MiscBillPrint.displayName = 'MiscBillPrint';

export default MiscBillPrint;
