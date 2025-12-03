import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Search, Stethoscope, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Select, Textarea } from '../../components/ui';
import { appointmentService, patientService, doctorService } from '../../services';

const APPOINTMENT_TYPES = [
  { value: 'new', label: 'New Consultation' },
  { value: 'follow-up', label: 'Follow-up' },
];

export default function BookAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [formData, setFormData] = useState({
    patientId: searchParams.get('patientId') || '',
    doctorId: '',
    appointmentDate: new Date().toISOString().split('T')[0],
    type: 'new',
    symptoms: '',
  });

  const [errors, setErrors] = useState({});

  // Fetch doctors on mount
  useEffect(() => {
    fetchDoctors();
  }, []);

  // Fetch patient if ID in URL
  useEffect(() => {
    if (formData.patientId) {
      fetchPatientById(formData.patientId);
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

    setSearchingPatient(true);
    try {
      const response = await patientService.getAll({ search: query, limit: 10 });
      setPatients(response.patients || []);
      setShowPatientDropdown(true);
    } catch (error) {
      console.error('Failed to search patients:', error);
    } finally {
      setSearchingPatient(false);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setPatientSearch(patient.name);
    setFormData((prev) => ({ ...prev, patientId: patient._id }));
    setShowPatientDropdown(false);
    setErrors((prev) => ({ ...prev, patientId: null }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!selectedPatient) newErrors.patientId = 'Please select a patient';
    if (!formData.doctorId) newErrors.doctorId = 'Please select a doctor';
    if (!formData.appointmentDate) newErrors.appointmentDate = 'Date is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        patientId: selectedPatient._id,
        doctorId: formData.doctorId,
        appointmentDate: formData.appointmentDate,
        type: formData.type,
        symptoms: formData.symptoms || null,
      };

      const response = await appointmentService.create(payload);
      toast.success(`Appointment booked! Token: ${response.appointment.tokenNo}`);
      navigate('/appointments');
    } catch (error) {
      if (error.error) {
        toast.error(error.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const doctorOptions = doctors.map((doc) => ({
    value: doc._id,
    label: `${doc.name} - ${doc.specialization}`,
  }));

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/appointments')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Book Appointment</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/appointments')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} icon={Calendar}>
            Book Appointment
          </Button>
        </div>
      </div>

      {/* Form - Full Width Grid */}
      <form onSubmit={handleSubmit} className="flex-1 grid grid-cols-3 gap-4 items-start">
        {/* Column 1: Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Select Patient</h2>
          </div>
          
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  searchPatients(e.target.value);
                  if (selectedPatient) {
                    setSelectedPatient(null);
                    setFormData((prev) => ({ ...prev, patientId: '' }));
                  }
                }}
                onFocus={() => patients.length > 0 && setShowPatientDropdown(true)}
                placeholder="Search patient..."
                className={`w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.patientId
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-primary-500'
                }`}
              />
              {searchingPatient && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Patient Dropdown */}
            {showPatientDropdown && patients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient._id}
                    type="button"
                    onClick={() => handlePatientSelect(patient)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b last:border-0"
                  >
                    <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                    <p className="text-xs text-gray-500">
                      {patient.patientId} • {patient.phone}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {errors.patientId && (
              <p className="mt-1 text-xs text-red-500">{errors.patientId}</p>
            )}
          </div>

          {/* Selected Patient Info */}
          {selectedPatient && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{selectedPatient.name}</p>
                  <p className="text-xs text-gray-600">
                    {selectedPatient.age}y • {selectedPatient.gender} • {selectedPatient.phone}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Column 2: Doctor & Schedule */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-green-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Doctor & Schedule</h2>
          </div>
          <div className="space-y-3">
            <Select
              label="Doctor"
              name="doctorId"
              value={formData.doctorId}
              onChange={handleChange}
              options={doctorOptions}
              error={errors.doctorId}
              required
              placeholder="Select doctor"
            />
            <Select
              label="Type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              options={APPOINTMENT_TYPES}
            />
            <Input
              label="Date"
              name="appointmentDate"
              type="date"
              value={formData.appointmentDate}
              onChange={handleChange}
              error={errors.appointmentDate}
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        {/* Column 3: Symptoms */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-orange-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Symptoms</h2>
          </div>
          <Textarea
            label="Reason for Visit"
            name="symptoms"
            value={formData.symptoms}
            onChange={handleChange}
            placeholder="Describe symptoms or reason for visit..."
            rows={10}
          />
        </div>
      </form>
    </div>
  );
}
