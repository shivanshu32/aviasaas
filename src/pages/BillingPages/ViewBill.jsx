import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { Button } from '../../components/ui';
import { billingService } from '../../services';
import { OpdBillPrint, MiscBillPrint, MedicineBillPrint } from '../../components/print';

export default function ViewBill() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBill();
  }, [type, id]);

  const fetchBill = async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      switch (type) {
        case 'opd':
          response = await billingService.opd.getById(id);
          setBill(response.bill);
          break;
        case 'medicine':
          response = await billingService.medicine.getById(id);
          setBill(response.bill);
          break;
        case 'misc':
          // Check if misc getById exists, otherwise show error
          if (billingService.misc.getById) {
            response = await billingService.misc.getById(id);
            setBill(response.bill);
          } else {
            setError('View not available for this bill type');
          }
          break;
        default:
          setError('Invalid bill type');
      }
    } catch (err) {
      console.error('Failed to fetch bill:', err);
      setError(err.error || 'Failed to load bill');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Bill-${bill?.billNo}`,
  });

  const getBillTitle = () => {
    switch (type) {
      case 'opd': return 'OPD Bill';
      case 'medicine': return 'Medicine Bill';
      case 'misc': return 'Lab/Misc Bill';
      default: return 'Bill';
    }
  };

  const PrintComponent = () => {
    if (!bill) return null;
    
    switch (type) {
      case 'opd':
        return <OpdBillPrint bill={bill} />;
      case 'medicine':
        return <MedicineBillPrint bill={bill} />;
      case 'misc':
        return <MiscBillPrint bill={bill} />;
      default:
        return <OpdBillPrint bill={bill} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">{error}</p>
          <Button variant="secondary" onClick={() => navigate(`/billing/${type}`)} className="mt-4">
            Back to Bills
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(`/billing/${type}`)} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Bills"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getBillTitle()}</h1>
            <p className="text-gray-500">Bill No: {bill?.billNo}</p>
          </div>
        </div>
        <Button onClick={handlePrint} icon={Printer}>
          Print Bill
        </Button>
      </div>

      {/* Bill Preview */}
      <div className="card p-0 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span>
                <strong>Patient:</strong> {bill?.patient?.name || bill?.patientName || 'N/A'}
              </span>
              <span>
                <strong>Date:</strong> {bill?.billDate ? new Date(bill.billDate).toLocaleDateString('en-IN') : '-'}
              </span>
              <span>
                <strong>Amount:</strong> ₹{bill?.grandTotal?.toFixed(2)}
              </span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              bill?.paymentStatus === 'paid' 
                ? 'bg-green-100 text-green-800' 
                : bill?.paymentStatus === 'partial'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {bill?.paymentStatus?.toUpperCase()}
            </span>
          </div>
        </div>
        
        {/* Print Content */}
        <div className="p-6" ref={printRef}>
          <PrintComponent />
        </div>
      </div>
    </div>
  );
}
