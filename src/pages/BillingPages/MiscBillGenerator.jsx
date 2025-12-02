import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Receipt, Search, User, CreditCard, FlaskConical } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Button, Input, Select } from '../../components/ui';
import { billingService, patientService, doctorService, serviceItemService } from '../../services';
import BillPrintView from './BillPrintView';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'mixed', label: 'Mixed Payment' },
];

const BILL_CATEGORIES = [
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'other', label: 'Other' },
];

export default function MiscBillGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get('patientId');
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!patientIdParam);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [generatedBill, setGeneratedBill] = useState(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [showTestPicker, setShowTestPicker] = useState(false);

  const [formData, setFormData] = useState({
    patientName: '',
    patientPhone: '',
    patientId: '',
    referredBy: '',
    category: 'laboratory',
    items: [],
    discountType: 'fixed',
    discountValue: 0,
    paymentMode: 'cash',
    paymentDetails: { cash: 0, card: 0, upi: 0, upiRef: '' },
    remarks: '',
  });

  useEffect(() => {
    fetchDoctors();
    fetchServiceItems();
    if (patientIdParam) {
      fetchPatientById(patientIdParam);
    }
  }, [patientIdParam]);

  const fetchServiceItems = async () => {
    try {
      const response = await serviceItemService.getAll();
      setServiceItems(response.services || []);
    } catch (error) {
      console.error('Failed to fetch service items:', error);
    }
  };

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

  const addItem = (item = { description: '', quantity: 1, rate: 0 }) => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...item, quantity: item.quantity || 1 }],
    }));
  };

  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const addTestFromPicker = (test) => {
    addItem({ ...test, quantity: 1 });
    setShowTestPicker(false);
  };

  const subtotal = formData.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
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
      toast.error('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        patientId: selectedPatient?._id || null,
        patientName: formData.patientName,
        patientPhone: formData.patientPhone || null,
        referredBy: formData.referredBy || null,
        category: formData.category,
        items: formData.items.map((item) => ({
          description: item.description,
          category: formData.category,
          quantity: Number(item.quantity) || 1,
          rate: Number(item.rate) || 0,
        })),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue) || 0,
        paymentMode: formData.paymentMode,
        paymentDetails: formData.paymentMode === 'mixed' ? formData.paymentDetails : undefined,
        remarks: formData.remarks || null,
      };

      const response = await billingService.misc.create(payload);
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
    documentTitle: `Misc-Bill-${generatedBill?.billNo}`,
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
            <Button variant="secondary" onClick={() => navigate('/billing/misc')}>
              Done
            </Button>
            <Button onClick={handlePrint} icon={Printer}>
              Print Bill
            </Button>
          </div>
        </div>
        <div ref={printRef}>
          <BillPrintView bill={generatedBill} type="misc" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/billing/misc')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Generate Misc Bill</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/billing/misc')}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} icon={Receipt}>Generate Bill (₹{grandTotal})</Button>
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
                  <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch(''); setFormData(prev => ({ ...prev, patientName: '', patientPhone: '' })); }} className="text-xs text-red-600 mt-1">Change</button>
                )}
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); searchPatients(e.target.value); }} placeholder="Search patient..." className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  {showPatientDropdown && patients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                      {patients.map((patient) => (
                        <button key={patient._id} type="button" onClick={() => handlePatientSelect(patient)} className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm">{patient.name} - {patient.phone}</button>
                      ))}
                    </div>
                  )}
                </div>
                <Input label="Patient Name" name="patientName" value={formData.patientName} onChange={handleChange} required placeholder="Name" />
                <Input label="Phone" name="patientPhone" value={formData.patientPhone} onChange={handleChange} placeholder="Phone" />
              </>
            )}
            <Select label="Referred By" name="referredBy" value={formData.referredBy} onChange={handleChange} options={doctorOptions} placeholder="Select doctor" />
            <Select label="Category" name="category" value={formData.category} onChange={handleChange} options={BILL_CATEGORIES} />
            <Select label="Payment Mode" name="paymentMode" value={formData.paymentMode} onChange={handleChange} options={PAYMENT_MODES} />
          </div>
        </div>

        {/* Column 2: Bill Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Bill Items</h2>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={() => setShowTestPicker(true)} className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 bg-primary-50 rounded">Quick Add</button>
              <button type="button" onClick={() => addItem()} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 px-2 py-1 bg-primary-50 rounded"><Plus className="w-3 h-3" /></button>
            </div>
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {formData.items.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <p>No items added</p>
                <button type="button" onClick={() => setShowTestPicker(true)} className="text-primary-600 mt-1">Add from common tests</button>
              </div>
            ) : (
              formData.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <input type="text" placeholder="Description" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="w-12 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" min="1" />
                  <input type="number" placeholder="Rate" value={item.rate} onChange={(e) => handleItemChange(index, 'rate', e.target.value)} className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" min="0" />
                  <span className="w-14 text-right text-sm font-medium">₹{((Number(item.quantity) || 0) * (Number(item.rate) || 0)).toFixed(0)}</span>
                  <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
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
              <span className="font-medium">₹{subtotal}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Discount</span>
              <select value={formData.discountType} onChange={handleChange} name="discountType" className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500">
                <option value="fixed">₹</option>
                <option value="percentage">%</option>
              </select>
              <input type="number" value={formData.discountValue} onChange={handleChange} name="discountValue" className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" min="0" />
            </div>
            
            <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
              <span>Grand Total</span>
              <span className="text-primary-600">₹{grandTotal}</span>
            </div>

            {formData.paymentMode === 'mixed' && (
              <div className="pt-3 border-t border-gray-200 space-y-2">
                <p className="text-xs font-medium text-gray-700">Split Payment</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Cash" name="paymentDetails.cash" type="number" value={formData.paymentDetails.cash} onChange={handleChange} min="0" />
                  <Input label="Card" name="paymentDetails.card" type="number" value={formData.paymentDetails.card} onChange={handleChange} min="0" />
                  <Input label="UPI" name="paymentDetails.upi" type="number" value={formData.paymentDetails.upi} onChange={handleChange} min="0" />
                </div>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Test Picker Modal */}
      {showTestPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[70vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Quick Add - {BILL_CATEGORIES.find(c => c.value === formData.category)?.label}</h3>
              <button onClick={() => setShowTestPicker(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-80">
              {serviceItems.filter(s => s.category === formData.category).length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <p>No services found for this category</p>
                  <button 
                    type="button" 
                    onClick={() => navigate('/services')} 
                    className="text-primary-600 text-sm mt-2"
                  >
                    Add Service Charges
                  </button>
                </div>
              ) : (
                serviceItems
                  .filter(s => s.category === formData.category)
                  .map((service) => (
                    <button 
                      key={service._id} 
                      type="button" 
                      onClick={() => addTestFromPicker({ description: service.name, rate: service.rate })} 
                      className="w-full flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg text-left"
                    >
                      <span className="text-sm">{service.name}</span>
                      <span className="font-medium text-primary-600 text-sm">₹{service.rate}</span>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
