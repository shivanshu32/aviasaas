import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Stethoscope, Clock, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Select } from '../../components/ui';
import { doctorService } from '../../services';

const SPECIALIZATION_OPTIONS = [
  { value: 'General Physician', label: 'General Physician' },
  { value: 'Cardiologist', label: 'Cardiologist' },
  { value: 'Dermatologist', label: 'Dermatologist' },
  { value: 'ENT Specialist', label: 'ENT Specialist' },
  { value: 'Gastroenterologist', label: 'Gastroenterologist' },
  { value: 'Gynecologist', label: 'Gynecologist' },
  { value: 'Neurologist', label: 'Neurologist' },
  { value: 'Ophthalmologist', label: 'Ophthalmologist' },
  { value: 'Orthopedic', label: 'Orthopedic' },
  { value: 'Pediatrician', label: 'Pediatrician' },
  { value: 'Psychiatrist', label: 'Psychiatrist' },
  { value: 'Pulmonologist', label: 'Pulmonologist' },
  { value: 'Urologist', label: 'Urologist' },
  { value: 'Other', label: 'Other' },
];

const WORKING_DAYS_OPTIONS = [
  { value: 'Monday', label: 'Mon' },
  { value: 'Tuesday', label: 'Tue' },
  { value: 'Wednesday', label: 'Wed' },
  { value: 'Thursday', label: 'Thu' },
  { value: 'Friday', label: 'Fri' },
  { value: 'Saturday', label: 'Sat' },
  { value: 'Sunday', label: 'Sun' },
];

const SLOT_DURATION_OPTIONS = [
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '20', label: '20 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '60 min' },
];

export default function AddDoctor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    qualification: '',
    specialization: '',
    registrationNo: '',
    phone: '',
    email: '',
    consultationFee: '',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    workingHours: {
      start: '09:00',
      end: '18:00',
    },
    slotDuration: '15',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleWorkingDaysChange = (day) => {
    setFormData((prev) => {
      const days = prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays: days };
    });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.qualification.trim()) newErrors.qualification = 'Qualification is required';
    if (!formData.specialization) newErrors.specialization = 'Specialization is required';
    if (!formData.registrationNo.trim()) newErrors.registrationNo = 'Registration number is required';
    if (!formData.phone) newErrors.phone = 'Phone is required';
    else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'Phone must be 10 digits';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email';
    }
    if (!formData.consultationFee) newErrors.consultationFee = 'Consultation fee is required';
    else if (isNaN(formData.consultationFee) || Number(formData.consultationFee) < 0) {
      newErrors.consultationFee = 'Enter a valid fee';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        consultationFee: Number(formData.consultationFee),
        slotDuration: Number(formData.slotDuration),
      };

      await doctorService.create(payload);
      toast.success('Doctor added successfully!');
      navigate('/doctors');
    } catch (error) {
      if (error.error) {
        toast.error(error.error);
      }
      if (error.details) {
        setErrors(error.details);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/doctors')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Add New Doctor</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/doctors')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} icon={Save}>
            Add Doctor
          </Button>
        </div>
      </div>

      {/* Form - Full Width Grid */}
      <form onSubmit={handleSubmit} className="flex-1 grid grid-cols-3 gap-4 items-start">
        {/* Column 1: Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Basic Information</h2>
          </div>
          <div className="space-y-3">
            <Input
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required
              placeholder="Dr. Full Name"
            />
            <Input
              label="Qualification"
              name="qualification"
              value={formData.qualification}
              onChange={handleChange}
              error={errors.qualification}
              required
              placeholder="e.g., MBBS, MD"
            />
            <Select
              label="Specialization"
              name="specialization"
              value={formData.specialization}
              onChange={handleChange}
              options={SPECIALIZATION_OPTIONS}
              error={errors.specialization}
              required
            />
            <Input
              label="Registration No."
              name="registrationNo"
              value={formData.registrationNo}
              onChange={handleChange}
              error={errors.registrationNo}
              required
              placeholder="Medical council reg."
            />
          </div>
        </div>

        {/* Column 2: Contact & Fee */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-green-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Contact Details</h2>
            </div>
            <div className="space-y-3">
              <Input
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={errors.phone}
                required
                placeholder="10 digit number"
                maxLength={10}
              />
              <Input
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="email@example.com"
              />
            </div>
          </div>

          {/* Consultation */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-4 h-4 text-purple-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Consultation</h2>
            </div>
            <div className="space-y-3">
              <Input
                label="Consultation Fee (₹)"
                name="consultationFee"
                type="number"
                value={formData.consultationFee}
                onChange={handleChange}
                error={errors.consultationFee}
                required
                placeholder="e.g., 500"
                min="0"
              />
              <Select
                label="Slot Duration"
                name="slotDuration"
                value={formData.slotDuration}
                onChange={handleChange}
                options={SLOT_DURATION_OPTIONS}
              />
            </div>
          </div>
        </div>

        {/* Column 3: Schedule */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Working Schedule</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Working Days
              </label>
              <div className="grid grid-cols-4 gap-2">
                {WORKING_DAYS_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleWorkingDaysChange(day.value)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      formData.workingDays.includes(day.value)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Time"
                name="workingHours.start"
                type="time"
                value={formData.workingHours.start}
                onChange={handleChange}
              />
              <Input
                label="End Time"
                name="workingHours.end"
                type="time"
                value={formData.workingHours.end}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
