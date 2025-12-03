import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Receipt, Search, Package, User, CreditCard, Pill } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Button, Input, Select, Badge } from '../../components/ui';
import { billingService, patientService, doctorService, medicineService } from '../../services';
import BillPrintView from './BillPrintView';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'mixed', label: 'Mixed' },
];

export default function MedicineBilling() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get('patientId');
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!patientIdParam);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [medicineSearch, setMedicineSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const [generatedBill, setGeneratedBill] = useState(null);
  const [showPrintView, setShowPrintView] = useState(false);

  const [formData, setFormData] = useState({
    patientName: '',
    patientPhone: '',
    patientId: '',
    doctorId: '',
    items: [],
    discountType: 'percentage',
    discountValue: 0,
    paymentMode: 'cash',
    paymentDetails: { cash: 0, card: 0, upi: 0, upiRef: '' },
    remarks: '',
  });

  useEffect(() => {
    fetchDoctors();
    if (patientIdParam) {
      fetchPatientById(patientIdParam);
    }
  }, [patientIdParam]);

  const fetchPatientById = async (id) => {
    setInitialLoading(true);
    try {
      const response = await patientService.getById(id);
      const patient = response.patient;
      if (patient) {
        setSelectedPatient(patient);
        setPatientSearch(patient.name);
        setFormData((prev) => ({
          ...prev,
          patientId: patient._id,
          patientName: patient.name,
          patientPhone: patient.phone || '',
        }));
      }
    } catch (error) {
      console.error('Failed to fetch patient:', error);
      toast.error('Failed to load patient details');
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await doctorService.getAll({ isActive: true });
      setDoctors(response.doctors || []);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  };

  const searchPatients = async (query) => {
    if (!query || query.length < 2) {
      setPatients([]);
      return;
    }
    try {
      const response = await patientService.getAll({ search: query, limit: 10 });
      setPatients(response.patients || []);
      setShowPatientDropdown(true);
    } catch (error) {
      console.error('Failed to search patients:', error);
    }
  };

  const searchMedicines = async (query) => {
    if (!query || query.length < 2) {
      setMedicines([]);
      return;
    }
    try {
      const response = await medicineService.getAll({ search: query, includeStock: 'true', limit: 15 });
      setMedicines(response.medicines || []);
      setShowMedicineDropdown(true);
    } catch (error) {
      console.error('Failed to search medicines:', error);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.name);
    setFormData((prev) => ({
      ...prev,
      patientId: patient._id,
      patientName: patient.name,
      patientPhone: patient.phone,
    }));
    setShowPatientDropdown(false);
  };

  const handleMedicineSelect = async (medicine) => {
    setMedicineSearch('');
    setShowMedicineDropdown(false);

    // Fetch stock batches for this medicine
    try {
      const response = await medicineService.stock.getBatches(medicine._id);
      const batches = response.batches || [];

      if (batches.length === 0) {
        toast.error('No stock available for this medicine');
        return;
      }

      // Use first available batch (FEFO - First Expiry First Out)
      const batch = batches[0];

      // Check if already added
      const existingIndex = formData.items.findIndex(
        (item) => item.medicineId === medicine._id && item.batchId === batch._id
      );

      if (existingIndex >= 0) {
        // Increment quantity
        handleItemChange(existingIndex, 'quantity', formData.items[existingIndex].quantity + 1);
      } else {
        // Add new item
        setFormData((prev) => ({
          ...prev,
          items: [
            ...prev.items,
            {
              medicineId: medicine._id,
              medicineName: medicine.name,
              batchId: batch._id,
              batchNo: batch.batchNo,
              expiryDate: batch.expiryDate,
              availableQty: batch.currentQty,
              quantity: 1,
              mrp: batch.mrp,
              sellingPrice: batch.sellingPrice || batch.mrp,
              gstRate: batch.gstRate || 0,
            },
          ],
        }));
      }
    } catch (error) {
      toast.error('Failed to fetch stock');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('paymentDetails.')) {
      const field = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        paymentDetails: { ...prev.paymentDetails, [field]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate totals (prices are GST-inclusive, no separate GST calculation)
  const subtotal = formData.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.sellingPrice) || 0),
    0
  );

  const discountAmount =
    formData.discountType === 'percentage'
      ? (subtotal * Number(formData.discountValue || 0)) / 100
      : Number(formData.discountValue || 0);

  const grandTotal = Math.round(subtotal - discountAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.patientName) {
      toast.error('Please enter patient name');
      return;
    }
    if (formData.items.length === 0) {
      toast.error('Please add at least one medicine');
      return;
    }

    // Validate quantities
    for (const item of formData.items) {
      if (item.quantity > item.availableQty) {
        toast.error(`Insufficient stock for ${item.medicineName}. Available: ${item.availableQty}`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        patientId: selectedPatient?._id || null,
        patientName: formData.patientName,
        patientPhone: formData.patientPhone || null,
        doctorId: formData.doctorId || null,
        items: formData.items.map((item) => ({
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: Number(item.quantity),
        })),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue) || 0,
        paymentMode: formData.paymentMode,
        paymentDetails: formData.paymentMode === 'mixed' ? {
          cash: Number(formData.paymentDetails.cash) || 0,
          card: Number(formData.paymentDetails.card) || 0,
          upi: Number(formData.paymentDetails.upi) || 0,
          upiRef: formData.paymentDetails.upiRef || null,
        } : undefined,
        remarks: formData.remarks || null,
      };

      const response = await billingService.medicine.create(payload);
      setGeneratedBill(response.bill);
      setShowPrintView(true);
      toast.success('Bill generated successfully!');
    } catch (error) {
      toast.error(error.error || 'Failed to generate bill');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Medicine-Bill-${generatedBill?.billNo}`,
  });

  const doctorOptions = doctors.map((doc) => ({
    value: doc._id,
    label: doc.name,
  }));

  if (showPrintView && generatedBill) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6 no-print">
          <button 
            onClick={() => setShowPrintView(false)} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Form"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/billing/medicine')}>
              Done
            </Button>
            <Button onClick={handlePrint} icon={Printer}>
              Print Bill
            </Button>
          </div>
        </div>
        <div ref={printRef}>
          <BillPrintView bill={generatedBill} type="medicine" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/billing/medicine')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Medicine Billing</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/billing/medicine')}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={formData.items.length === 0} icon={Receipt}>
            Generate Bill (₹{grandTotal})
          </Button>
        </div>
      </div>

      {/* Form - 3 Column Layout */}
      <form onSubmit={handleSubmit} className="flex-1 grid grid-cols-3 gap-4 items-start">
        {/* Column 1: Patient Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Patient Info</h2>
          </div>
          
          <div className="space-y-3">
            {selectedPatient ? (
              <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                <p className="text-xs text-gray-600">{selectedPatient.patientId} • {selectedPatient.phone}</p>
                {!patientIdParam && (
                  <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch(''); setFormData(prev => ({ ...prev, patientName: '', patientPhone: '', patientId: '' })); }} className="text-xs text-red-600 mt-1">Change</button>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); searchPatients(e.target.value); }} placeholder="Search patient..." className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  {showPatientDropdown && patients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                      {patients.map((p) => (
                        <button key={p._id} type="button" onClick={() => handlePatientSelect(p)} className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm">{p.name} - {p.phone}</button>
                      ))}
                    </div>
                  )}
                </div>
                <Input label="Patient Name" name="patientName" value={formData.patientName} onChange={handleChange} required placeholder="Name" />
                <Input label="Phone" name="patientPhone" value={formData.patientPhone} onChange={handleChange} placeholder="Phone" />
              </>
            )}
            <Select label="Prescribed By" name="doctorId" value={formData.doctorId} onChange={handleChange} options={doctorOptions} placeholder="Select doctor" />
            <Select label="Payment Mode" name="paymentMode" value={formData.paymentMode} onChange={handleChange} options={PAYMENT_MODES} />
            
            {formData.paymentMode === 'mixed' && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <Input label="Cash" name="paymentDetails.cash" type="number" value={formData.paymentDetails.cash} onChange={handleChange} />
                <Input label="Card" name="paymentDetails.card" type="number" value={formData.paymentDetails.card} onChange={handleChange} />
                <Input label="UPI" name="paymentDetails.upi" type="number" value={formData.paymentDetails.upi} onChange={handleChange} />
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Medicine Search & Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Pill className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Medicines ({formData.items.length})</h2>
          </div>
          
          {/* Medicine Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={medicineSearch} onChange={(e) => { setMedicineSearch(e.target.value); searchMedicines(e.target.value); }} placeholder="Search medicine..." className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
            {showMedicineDropdown && medicines.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {medicines.map((med) => (
                  <button key={med._id} type="button" onClick={() => handleMedicineSelect(med)} disabled={med.currentStock === 0} className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    <div className="flex justify-between">
                      <span className="font-medium">{med.name}</span>
                      <span className={`text-xs ${med.currentStock === 0 ? 'text-red-500' : 'text-green-600'}`}>Stock: {med.currentStock || 0}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Items List */}
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {formData.items.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No medicines added</p>
              </div>
            ) : (
              formData.items.map((item, index) => (
                <div key={index} className="p-2 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <p className="font-medium text-sm">{item.medicineName}</p>
                      <p className="text-xs text-gray-500">Batch: {item.batchNo}</p>
                    </div>
                    <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 items-center">
                    <div>
                      <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="1" max={item.availableQty} className="w-full px-2 py-1 text-sm border border-gray-200 rounded" />
                      <p className="text-xs text-gray-400">/{item.availableQty}</p>
                    </div>
                    <div className="text-xs text-gray-500">MRP: ₹{item.mrp}</div>
                    <input type="number" value={item.sellingPrice} onChange={(e) => handleItemChange(index, 'sellingPrice', e.target.value)} min="0" step="0.01" className="w-full px-2 py-1 text-sm border border-gray-200 rounded" />
                    <p className="text-right font-medium text-sm">₹{((Number(item.quantity) || 0) * (Number(item.sellingPrice) || 0)).toFixed(0)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-purple-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Summary</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">₹{subtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Discount</span>
              <select value={formData.discountType} onChange={handleChange} name="discountType" className="px-2 py-1 text-xs border border-gray-200 rounded">
                <option value="fixed">₹</option>
                <option value="percentage">%</option>
              </select>
              <input type="number" value={formData.discountValue} onChange={handleChange} name="discountValue" className="w-16 px-2 py-1 text-sm border border-gray-200 rounded" min="0" />
            </div>
            
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            
            <p className="text-xs text-gray-400 italic">* Prices inclusive of GST</p>
            
            <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
              <span>Grand Total</span>
              <span className="text-primary-600">₹{grandTotal}</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
