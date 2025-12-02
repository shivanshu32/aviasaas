import { OpdBillPrint, MiscBillPrint, MedicineBillPrint } from '../../components/print';

/**
 * BillPrintView - Wrapper component that renders the appropriate print template
 * based on bill type. Uses the new professional print components.
 */
export default function BillPrintView({ bill, type = 'opd' }) {
  if (!bill) return null;

  // Use the new professional print components
  switch (type) {
    case 'opd':
      return <OpdBillPrint bill={bill} />;
    case 'misc':
      return <MiscBillPrint bill={bill} />;
    case 'medicine':
      return <MedicineBillPrint bill={bill} />;
    default:
      return <OpdBillPrint bill={bill} />;
  }
}

// Legacy component kept for reference - can be removed
function LegacyBillPrintView({ bill, type = 'opd' }) {
  const { settings } = { settings: {} }; // useClinic();

  if (!bill) return null;

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
    });
  };

  const getBillTitle = () => {
    switch (type) {
      case 'opd': return 'OPD Bill';
      case 'misc': return 'Invoice';
      case 'medicine': return 'Medicine Bill';
      default: return 'Bill';
    }
  };

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto" style={{ minHeight: '297mm' }}>
      {/* Header */}
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {settings.clinicName || 'Clinic Name'}
            </h1>
            {settings.address && (
              <p className="text-sm text-gray-600 mt-1">
                {[settings.address.line1, settings.address.line2, settings.address.city]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {settings.phones?.length > 0 && (
              <p className="text-sm text-gray-600">Phone: {settings.phones.join(', ')}</p>
            )}
            {settings.gstNo && (
              <p className="text-sm text-gray-600">GSTIN: {settings.gstNo}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-800">{getBillTitle()}</h2>
            <p className="text-lg font-semibold text-primary-600">{bill.billNo}</p>
          </div>
        </div>
      </div>

      {/* Bill Info */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">Bill To</h3>
          <p className="font-semibold text-lg">
            {bill.patient?.name || bill.patientName}
          </p>
          {bill.patient?.patientId && (
            <p className="text-sm text-gray-600">ID: {bill.patient.patientId}</p>
          )}
          {(bill.patient?.phone || bill.patientPhone) && (
            <p className="text-sm text-gray-600">
              Phone: {bill.patient?.phone || bill.patientPhone}
            </p>
          )}
          {bill.patient?.address && (
            <p className="text-sm text-gray-600">
              {[bill.patient.address.line1, bill.patient.address.city]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}
        </div>
        <div className="text-right space-y-1">
          <div>
            <span className="text-sm text-gray-500">Date: </span>
            <span className="font-medium">{formatDate(bill.billDate)}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Time: </span>
            <span className="font-medium">{formatTime(bill.billDate)}</span>
          </div>
          {bill.doctor && (
            <div>
              <span className="text-sm text-gray-500">Doctor: </span>
              <span className="font-medium">{bill.doctor.name}</span>
            </div>
          )}
          {bill.referringDoctor && (
            <div>
              <span className="text-sm text-gray-500">Referred By: </span>
              <span className="font-medium">{bill.referringDoctor.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left py-2 px-3 text-sm font-semibold">#</th>
            <th className="text-left py-2 px-3 text-sm font-semibold">Description</th>
            {type === 'medicine' && (
              <>
                <th className="text-left py-2 px-3 text-sm font-semibold">Batch</th>
                <th className="text-left py-2 px-3 text-sm font-semibold">Expiry</th>
              </>
            )}
            <th className="text-right py-2 px-3 text-sm font-semibold">Qty</th>
            <th className="text-right py-2 px-3 text-sm font-semibold">Rate</th>
            <th className="text-right py-2 px-3 text-sm font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, index) => (
            <tr key={index} className="border-b">
              <td className="py-2 px-3 text-sm">{index + 1}</td>
              <td className="py-2 px-3 text-sm">
                {item.description || item.medicineName}
              </td>
              {type === 'medicine' && (
                <>
                  <td className="py-2 px-3 text-sm">{item.batchNo}</td>
                  <td className="py-2 px-3 text-sm">
                    {item.expiryDate ? formatDate(item.expiryDate) : '-'}
                  </td>
                </>
              )}
              <td className="py-2 px-3 text-sm text-right">{item.quantity}</td>
              <td className="py-2 px-3 text-sm text-right">
                ₹{(item.rate || item.sellingPrice || item.mrp || 0).toFixed(2)}
              </td>
              <td className="py-2 px-3 text-sm text-right font-medium">
                ₹{(item.amount || (item.quantity * (item.rate || item.sellingPrice || 0))).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-64 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>₹{bill.subtotal.toFixed(2)}</span>
          </div>
          {bill.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>
                Discount
                {bill.discountType === 'percentage' && ` (${bill.discountValue}%)`}
              </span>
              <span>-₹{bill.discountAmount.toFixed(2)}</span>
            </div>
          )}
          {(bill.cgst > 0 || bill.sgst > 0) && (
            <>
              <div className="flex justify-between text-sm">
                <span>CGST</span>
                <span>₹{bill.cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>SGST</span>
                <span>₹{bill.sgst.toFixed(2)}</span>
              </div>
            </>
          )}
          {bill.roundOff !== 0 && (
            <div className="flex justify-between text-sm">
              <span>Round Off</span>
              <span>₹{bill.roundOff.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300">
            <span>Grand Total</span>
            <span>₹{bill.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Payment Mode: </span>
            <span className="font-medium capitalize">{bill.paymentMode}</span>
          </div>
          <div>
            <span className="text-gray-500">Paid: </span>
            <span className="font-medium text-green-600">₹{bill.paidAmount.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-500">Balance: </span>
            <span className={`font-medium ${bill.dueAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{bill.dueAmount.toFixed(2)}
            </span>
          </div>
        </div>
        {bill.paymentMode === 'mixed' && bill.paymentDetails && (
          <div className="mt-2 pt-2 border-t text-sm text-gray-600">
            {bill.paymentDetails.cash > 0 && <span className="mr-4">Cash: ₹{bill.paymentDetails.cash}</span>}
            {bill.paymentDetails.card > 0 && <span className="mr-4">Card: ₹{bill.paymentDetails.card}</span>}
            {bill.paymentDetails.upi > 0 && <span>UPI: ₹{bill.paymentDetails.upi}</span>}
          </div>
        )}
      </div>

      {/* Remarks */}
      {bill.remarks && (
        <div className="mb-6">
          <p className="text-sm text-gray-500">Remarks:</p>
          <p className="text-sm">{bill.remarks}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-4 border-t">
        <div className="flex justify-between items-end">
          <div className="text-xs text-gray-400">
            <p>Bill generated on: {formatDate(bill.createdAt)} {formatTime(bill.createdAt)}</p>
            <p>Generated by: {bill.createdBy}</p>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 pt-1 px-12">
              <p className="text-sm font-medium">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>

      {/* Terms */}
      {settings.invoiceTerms && (
        <div className="mt-6 pt-4 border-t text-xs text-gray-500">
          <p className="font-medium mb-1">Terms & Conditions:</p>
          <p>{settings.invoiceTerms}</p>
        </div>
      )}
    </div>
  );
}
