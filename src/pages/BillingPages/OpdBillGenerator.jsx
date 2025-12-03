import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Receipt, Search, User, Stethoscope, CreditCard } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Button, Input, Select } from '../../components/ui';
import { billingService, patientService, doctorService, appointmentService } from '../../services';
import BillPrintView from './BillPrintView';

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'mixed', label: 'Mixed Payment' },
];

const DEFAULT_ITEMS = [
  { description: 'Consultation Fee', quantity: 1, rate: 500 },
];

export default function OpdBillGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [generatedBill, setGeneratedBill] = useState(null);
  const [showPrintView, setShowPrintView] = useState(false);

  const appointmentId = searchParams.get('appointmentId');

  const [formData, setFormData] = useState({
    patientId: searchParams.get('patientId') || '',
    doctorId: searchParams.get('doctorId') || '',
    appointmentId: appointmentId || '',
    items: [...DEFAULT_ITEMS],
    discountType: 'percentage',
    discountValue: 0,
    paymentMode: 'cash',
    paymentDetails: {
      cash: 0,
      card: 0,
      upi: 0,
      upiRef: '',
    },
    remarks: '',
  });

  useEffect(() => {
    const init = async () => {
      await fetchDoctors();
      
      // If appointmentId is provided, fetch appointment data
      if (appointmentId) {
        await fetchAppointmentData(appointmentId);
      } else if (formData.patientId) {
        await fetchPatientById(formData.patientId);
      }
      
      setInitialLoading(false);
    };
    
    init();
  }, []);

  const fetchAppointmentData = async (id) => {
    try {
      const response = await appointmentService.getById(id);
      const apt = response.appointment;
      setAppointment(apt);
      
      // Auto-fill patient
      if (apt.patient) {
        setSelectedPatient(apt.patient);
        setPatientSearch(apt.patient.name);
        setFormData((prev) => ({ ...prev, patientId: apt.patient._id }));
      }
      
      // Auto-fill doctor and set consultation fee
      if (apt.doctor) {
        setSelectedDoctor(apt.doctor);
        setFormData((prev) => ({ 
          ...prev, 
          doctorId: apt.doctor._id,
          items: [{
            description: 'Consultation Fee',
            quantity: 1,
            rate: apt.doctor.consultationFee || 500,
          }],
        }));
      }
    } catch (error) {
      console.error('Failed to fetch appointment:', error);
      toast.error('Failed to load appointment data');
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

  const fetchPatientById = async (id) => {
    try {
      const response = await patientService.getById(id);
      setSelectedPatient(response.patient);
      setPatientSearch(response.patient.name);
    } catch (error) {
      console.error('Failed to fetch patient:', error);
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
    setFormData((prev) => ({ ...prev, patientId: patient._id }));
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

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, rate: 0 }],
    }));
  };

  const removeItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate totals
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

    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!formData.doctorId) {
      toast.error('Please select a doctor');
      return;
    }
    if (formData.items.length === 0 || !formData.items.some((i) => i.description)) {
      toast.error('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        patientId: selectedPatient._id,
        doctorId: formData.doctorId,
        appointmentId: appointmentId || null,
        items: formData.items.filter((i) => i.description).map((item) => ({
          description: item.description,
          quantity: Number(item.quantity) || 1,
          rate: Number(item.rate) || 0,
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

      const response = await billingService.opd.create(payload);
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
    documentTitle: `OPD-Bill-${generatedBill?.billNo}`,
  });

  const doctorOptions = doctors.map((doc) => ({
    value: doc._id,
    label: `${doc.name} - ${doc.specialization}`,
  }));

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
            <Button variant="secondary" onClick={() => navigate('/billing/opd')}>
              Done
            </Button>
            <Button onClick={handlePrint} icon={Printer}>
              Print Bill
            </Button>
          </div>
        </div>
        <div ref={printRef}>
          <BillPrintView bill={generatedBill} type="opd" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/billing/opd')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Generate OPD Bill</h1>
          {appointment && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              Apt: {appointment.appointmentId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/billing/opd')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} icon={Receipt}>
            Generate Bill (₹{grandTotal})
          </Button>
        </div>
      </div>

      {/* Form - 3 Column Layout */}
      <form onSubmit={handleSubmit} className="flex-1 grid grid-cols-3 gap-4 items-start">
        {/* Column 1: Patient & Doctor */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Patient & Doctor</h2>
          </div>
          
          <div className="space-y-3">
            {/* Patient */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
              {selectedPatient ? (
                <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                  <p className="text-xs text-gray-600">{selectedPatient.patientId} • {selectedPatient.phone}</p>
                  {!appointment && (
                    <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-xs text-red-600 mt-1">Change</button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => { setPatientSearch(e.target.value); searchPatients(e.target.value); }}
                    onFocus={() => patients.length > 0 && setShowPatientDropdown(true)}
                    placeholder="Search patient..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {showPatientDropdown && patients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                      {patients.map((patient) => (
                        <button key={patient._id} type="button" onClick={() => handlePatientSelect(patient)} className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm">
                          <span className="font-medium">{patient.name}</span>
                          <span className="text-gray-500 ml-2 text-xs">{patient.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Doctor */}
            {selectedDoctor && appointment ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-medium text-gray-900 text-sm">{selectedDoctor.name}</p>
                  <p className="text-xs text-gray-600">{selectedDoctor.specialization}</p>
                </div>
              </div>
            ) : (
              <Select label="Doctor" name="doctorId" value={formData.doctorId} onChange={handleChange} options={doctorOptions} required placeholder="Select doctor" />
            )}

            {/* Payment Mode */}
            <Select label="Payment Mode" name="paymentMode" value={formData.paymentMode} onChange={handleChange} options={PAYMENT_MODES} />
            
            {formData.paymentMode === 'upi' && (
              <Input label="UPI Reference" name="paymentDetails.upiRef" value={formData.paymentDetails.upiRef} onChange={handleChange} placeholder="Transaction ID" />
            )}
          </div>
        </div>

        {/* Column 2: Bill Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Bill Items</h2>
            </div>
            <button type="button" onClick={addItem} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          
          <div className="space-y-2 overflow-x-auto">
            {formData.items.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg min-w-0">
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <input
                  type="number"
                  placeholder="Rate"
                  value={item.rate}
                  onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                  className="w-24 flex-shrink-0 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  min="0"
                />
                {formData.items.length > 1 && (
                  <button type="button" onClick={() => removeItem(index)} className="flex-shrink-0 text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Summary & Payment */}
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
              <select
                value={formData.discountType}
                onChange={handleChange}
                name="discountType"
                className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="fixed">₹</option>
                <option value="percentage">%</option>
              </select>
              <input
                type="number"
                value={formData.discountValue}
                onChange={handleChange}
                name="discountValue"
                className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                min="0"
              />
              <span className="text-sm text-red-600 ml-auto">-₹{discountAmount.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200">
              <span>Grand Total</span>
              <span className="text-primary-600">₹{grandTotal.toFixed(2)}</span>
            </div>

            <Input label="Remarks" name="remarks" value={formData.remarks} onChange={handleChange} placeholder="Notes..." />

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
    </div>
  );
}
