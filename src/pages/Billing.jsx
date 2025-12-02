import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, FileText, FlaskConical, Pill, Search, Eye, Printer, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingService } from '../services';

const billTypes = [
  { id: 'opd', label: 'OPD Bills', icon: FileText, color: 'text-blue-600 bg-blue-100' },
  { id: 'misc', label: 'Lab/Misc Bills', icon: FlaskConical, color: 'text-purple-600 bg-purple-100' },
  { id: 'medicine', label: 'Medicine Bills', icon: Pill, color: 'text-green-600 bg-green-100' },
];

export default function Billing() {
  const { type = 'opd' } = useParams();
  const navigate = useNavigate();
  
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchBills();
  }, [type, dateFilter]);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateFilter) {
        // Use dateFrom and dateTo for the same day
        params.dateFrom = dateFilter;
        params.dateTo = dateFilter;
      }
      
      let response;
      switch (type) {
        case 'opd':
          response = await billingService.opd.getAll(params);
          setBills(response.bills || []);
          break;
        case 'misc':
          response = await billingService.misc.getAll(params);
          setBills(response.bills || []);
          break;
        case 'medicine':
          response = await billingService.medicine.getAll(params);
          setBills(response.bills || []);
          break;
        default:
          setBills([]);
      }
    } catch (error) {
      console.error('Failed to fetch bills:', error);
      toast.error('Failed to load bills');
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const getNewBillPath = () => {
    switch (type) {
      case 'opd': return '/billing/opd/new';
      case 'misc': return '/billing/misc/new';
      case 'medicine': return '/billing/medicine/new';
      default: return '/billing/opd/new';
    }
  };

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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="badge-success">Paid</span>;
      case 'partial':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Partial</span>;
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Pending</span>;
      default:
        return <span className="badge-secondary">{status}</span>;
    }
  };

  const getItemsSummary = (bill) => {
    // For medicine bills, items is returned as a count (number) from the API
    if (type === 'medicine') {
      const itemCount = typeof bill.items === 'number' ? bill.items : (bill.items?.length || 0);
      if (itemCount === 0) return '-';
      return `${itemCount} item${itemCount > 1 ? 's' : ''}`;
    }
    
    // For OPD and misc bills, items is an array
    if (!bill.items || !Array.isArray(bill.items) || bill.items.length === 0) return '-';
    
    if (bill.items.length === 1) {
      return bill.items[0].description || bill.items[0].medicineName || '-';
    }
    
    return `${bill.items[0].description || bill.items[0].medicineName}, +${bill.items.length - 1} more`;
  };

  // Filter bills by search query
  const filteredBills = bills.filter((bill) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    // Handle both patient object and direct patientName (for medicine bills)
    const patientName = bill.patient?.name || bill.patientName || '';
    const patientId = bill.patient?.patientId || '';
    const patientPhone = bill.patient?.phone || bill.patientPhone || '';
    return (
      bill.billNo?.toLowerCase().includes(query) ||
      patientName.toLowerCase().includes(query) ||
      patientId.toLowerCase().includes(query) ||
      patientPhone.includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-gray-500">Create and manage bills</p>
        </div>
        <Link to={getNewBillPath()} className="btn-primary w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" />
          New Bill
        </Link>
      </div>

      {/* Bill type tabs */}
      <div className="card p-1">
        <div className="flex gap-1 overflow-x-auto">
          {billTypes.map((bt) => (
            <button
              key={bt.id}
              onClick={() => navigate(`/billing/${bt.id}`)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
                type === bt.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <bt.icon className="w-5 h-5" />
              <span className="hidden sm:inline">{bt.label}</span>
              <span className="sm:hidden text-xs">{bt.id.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by bill no, patient name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 hidden sm:block" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="input w-full sm:w-auto"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Bills table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchQuery || dateFilter ? 'No bills found matching your search' : 'No bills yet'}
            </p>
            <Link to={getNewBillPath()} className="btn-primary mt-4 inline-flex">
              <Plus className="w-4 h-4" />
              Create First Bill
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="table min-w-[700px]">
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Date & Time</th>
                <th>Patient</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => (
                <tr key={bill._id}>
                  <td className="font-medium text-primary-600">
                    {bill.billNo}
                  </td>
                  <td>
                    <div>
                      <p>{formatDate(bill.billDate)}</p>
                      <p className="text-sm text-gray-500">{formatTime(bill.billDate)}</p>
                    </div>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium">{bill.patient?.name || bill.patientName || 'Walk-in'}</p>
                      <p className="text-sm text-gray-500">{bill.patient?.patientId || bill.patientPhone || '-'}</p>
                    </div>
                  </td>
                  <td className="text-sm">{getItemsSummary(bill)}</td>
                  <td>
                    <div>
                      <p className="font-semibold">₹{bill.grandTotal?.toFixed(2)}</p>
                      {bill.dueAmount > 0 && (
                        <p className="text-xs text-red-600">Due: ₹{bill.dueAmount?.toFixed(2)}</p>
                      )}
                    </div>
                  </td>
                  <td>{getStatusBadge(bill.paymentStatus)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/billing/${type}/${bill._id}`}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link
                        to={`/billing/${type}/${bill._id}`}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title="Print"
                      >
                        <Printer className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && filteredBills.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-gray-500">
          <p>Showing {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}</p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <p>
              Total: <span className="font-semibold text-gray-900">
                ₹{filteredBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0).toFixed(2)}
              </span>
            </p>
            <p>
              Collected: <span className="font-semibold text-green-600">
                ₹{filteredBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0).toFixed(2)}
              </span>
            </p>
            <p>
              Pending: <span className="font-semibold text-red-600">
                ₹{filteredBills.reduce((sum, b) => sum + (b.dueAmount || 0), 0).toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
