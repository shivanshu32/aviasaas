import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Save, FileText } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Button, Input, Select, Textarea, Card } from '../../components/ui';
import { prescriptionService, patientService, doctorService } from '../../services';
import PrescriptionPrintView from './PrescriptionPrintView';

const FREQUENCY_OPTIONS = [
  { value: 'OD', label: 'Once Daily (OD)' },
  { value: 'BD', label: 'Twice Daily (BD)' },
  { value: 'TDS', label: 'Three Times Daily (TDS)' },
  { value: 'QID', label: 'Four Times Daily (QID)' },
  { value: 'HS', label: 'At Bedtime (HS)' },
  { value: 'SOS', label: 'As Needed (SOS)' },
  { value: 'STAT', label: 'Immediately (STAT)' },
];

const TIMING_OPTIONS = [
  { value: 'before_food', label: 'Before Food' },
  { value: 'after_food', label: 'After Food' },
  { value: 'with_food', label: 'With Food' },
  { value: 'empty_stomach', label: 'Empty Stomach' },
];

const EMPTY_MEDICINE = {
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  timing: '',
  instructions: '',
};

export default function PrescriptionGenerator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef();

  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [generatedPrescription, setGeneratedPrescription] = useState(null);
  const [showPrintView, setShowPrintView] = useState(false);

  const [formData, setFormData] = useState({
    patientId: searchParams.get('patientId') || '',
    doctorId: '',
    diagnosis: '',
    complaints: '',
    examination: '',
    vitals: {
      bp: '',
      pulse: '',
      temperature: '',
      weight: '',
      spo2: '',
    },
    medicines: [{ ...EMPTY_MEDICINE }],
    investigations: '',
    advice: '',
    followUpDate: '',
  });

  useEffect(() => {
    fetchDoctors();
    if (formData.patientId) {
      fetchPatient(formData.patientId);
    }
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await doctorService.getAll({ isActive: true });
      setDoctors(response.doctors || []);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  };

  const fetchPatient = async (id) => {
    try {
      const response = await patientService.getById(id);
      setSelectedPatient(response.patient);
    } catch (error) {
      console.error('Failed to fetch patient:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('vitals.')) {
      const vitalName = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        vitals: { ...prev.vitals, [vitalName]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleMedicineChange = (index, field, value) => {
    setFormData((prev) => {
      const newMedicines = [...prev.medicines];
      newMedicines[index] = { ...newMedicines[index], [field]: value };
      return { ...prev, medicines: newMedicines };
    });
  };

  const addMedicine = () => {
    setFormData((prev) => ({
      ...prev,
      medicines: [...prev.medicines, { ...EMPTY_MEDICINE }],
    }));
  };

  const removeMedicine = (index) => {
    setFormData((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index),
    }));
  };

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

    setLoading(true);
    try {
      const payload = {
        patientId: selectedPatient._id,
        doctorId: formData.doctorId,
        diagnosis: formData.diagnosis || null,
        complaints: formData.complaints || null,
        examination: formData.examination || null,
        vitals: Object.values(formData.vitals).some(v => v) ? formData.vitals : null,
        medicines: formData.medicines.filter((m) => m.name),
        investigations: formData.investigations
          ? formData.investigations.split('\n').filter(Boolean)
          : [],
        advice: formData.advice || null,
        followUpDate: formData.followUpDate || null,
      };

      const response = await prescriptionService.create(payload);
      setGeneratedPrescription(response.prescription);
      setShowPrintView(true);
      toast.success('Prescription generated successfully!');
    } catch (error) {
      toast.error(error.error || 'Failed to generate prescription');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Prescription-${generatedPrescription?.prescriptionId}`,
  });

  const doctorOptions = doctors.map((doc) => ({
    value: doc._id,
    label: `${doc.name} - ${doc.specialization}`,
  }));

  if (showPrintView && generatedPrescription) {
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
            <Button variant="secondary" onClick={() => navigate('/appointments')}>
              Done
            </Button>
            <Button onClick={handlePrint} icon={Printer}>
              Print Prescription
            </Button>
          </div>
        </div>

        <div ref={printRef}>
          <PrescriptionPrintView prescription={generatedPrescription} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Go Back"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate Prescription</h1>
          <p className="text-gray-500">Create OPD prescription for patient</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Patient & Doctor */}
        <Card title="Patient & Doctor" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient <span className="text-red-500">*</span>
              </label>
              {selectedPatient ? (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{selectedPatient.name}</p>
                  <p className="text-sm text-gray-500">
                    {selectedPatient.age} yrs / {selectedPatient.gender} • {selectedPatient.phone}
                  </p>
                </div>
              ) : (
                <Input
                  placeholder="Enter patient ID"
                  value={formData.patientId}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, patientId: e.target.value }));
                    if (e.target.value.length > 5) {
                      fetchPatient(e.target.value);
                    }
                  }}
                />
              )}
            </div>
            <Select
              label="Doctor"
              name="doctorId"
              value={formData.doctorId}
              onChange={handleChange}
              options={doctorOptions}
              required
              placeholder="Select doctor"
            />
          </div>
        </Card>

        {/* Vitals */}
        <Card title="Vitals" className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Input
              label="BP (mmHg)"
              name="vitals.bp"
              value={formData.vitals.bp}
              onChange={handleChange}
              placeholder="120/80"
            />
            <Input
              label="Pulse (bpm)"
              name="vitals.pulse"
              value={formData.vitals.pulse}
              onChange={handleChange}
              placeholder="72"
            />
            <Input
              label="Temp (°F)"
              name="vitals.temperature"
              value={formData.vitals.temperature}
              onChange={handleChange}
              placeholder="98.6"
            />
            <Input
              label="Weight (kg)"
              name="vitals.weight"
              value={formData.vitals.weight}
              onChange={handleChange}
              placeholder="70"
            />
            <Input
              label="SpO2 (%)"
              name="vitals.spo2"
              value={formData.vitals.spo2}
              onChange={handleChange}
              placeholder="98"
            />
          </div>
        </Card>

        {/* Clinical Notes */}
        <Card title="Clinical Notes" className="mb-6">
          <div className="space-y-4">
            <Textarea
              label="Chief Complaints"
              name="complaints"
              value={formData.complaints}
              onChange={handleChange}
              placeholder="Patient's main complaints..."
              rows={2}
            />
            <Textarea
              label="Examination Findings"
              name="examination"
              value={formData.examination}
              onChange={handleChange}
              placeholder="Physical examination findings..."
              rows={2}
            />
            <Input
              label="Diagnosis"
              name="diagnosis"
              value={formData.diagnosis}
              onChange={handleChange}
              placeholder="Provisional/Final diagnosis"
            />
          </div>
        </Card>

        {/* Medicines */}
        <Card 
          title="Medicines" 
          className="mb-6"
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addMedicine}
              icon={Plus}
            >
              Add Medicine
            </Button>
          }
        >
          <div className="space-y-4">
            {formData.medicines.map((medicine, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">
                    Medicine {index + 1}
                  </span>
                  {formData.medicines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMedicine(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Input
                    placeholder="Medicine name"
                    value={medicine.name}
                    onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                    containerClassName="col-span-2"
                  />
                  <Input
                    placeholder="Dosage"
                    value={medicine.dosage}
                    onChange={(e) => handleMedicineChange(index, 'dosage', e.target.value)}
                  />
                  <Select
                    placeholder="Frequency"
                    value={medicine.frequency}
                    onChange={(e) => handleMedicineChange(index, 'frequency', e.target.value)}
                    options={FREQUENCY_OPTIONS}
                  />
                  <Input
                    placeholder="Duration"
                    value={medicine.duration}
                    onChange={(e) => handleMedicineChange(index, 'duration', e.target.value)}
                  />
                  <Select
                    placeholder="Timing"
                    value={medicine.timing}
                    onChange={(e) => handleMedicineChange(index, 'timing', e.target.value)}
                    options={TIMING_OPTIONS}
                  />
                </div>
                <Input
                  placeholder="Special instructions (optional)"
                  value={medicine.instructions}
                  onChange={(e) => handleMedicineChange(index, 'instructions', e.target.value)}
                  containerClassName="mt-3"
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Investigations & Advice */}
        <Card title="Investigations & Advice" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Textarea
              label="Investigations"
              name="investigations"
              value={formData.investigations}
              onChange={handleChange}
              placeholder="One investigation per line..."
              rows={4}
            />
            <Textarea
              label="Advice"
              name="advice"
              value={formData.advice}
              onChange={handleChange}
              placeholder="Diet, lifestyle advice..."
              rows={4}
            />
          </div>
          <div className="mt-4">
            <Input
              label="Follow-up Date"
              name="followUpDate"
              type="date"
              value={formData.followUpDate}
              onChange={handleChange}
              containerClassName="max-w-xs"
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={loading}
            icon={FileText}
          >
            Generate Prescription
          </Button>
        </div>
      </form>
    </div>
  );
}
