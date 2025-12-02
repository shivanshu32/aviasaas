import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Select, Card } from '../../components/ui';
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
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
  { value: 'Sunday', label: 'Sunday' },
];

const SLOT_DURATION_OPTIONS = [
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '20', label: '20 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
];

export default function EditDoctor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [fetchError, setFetchError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    qualification: '',
    specialization: '',
    registrationNo: '',
    phone: '',
    email: '',
    consultationFee: '',
    workingDays: [],
    workingHours: {
      start: '09:00',
      end: '18:00',
    },
    slotDuration: '15',
    isActive: true,
  });

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const response = await doctorService.getById(id);
        const doctor = response.doctor;
        setFormData({
          name: doctor.name || '',
          qualification: doctor.qualification || '',
          specialization: doctor.specialization || '',
          registrationNo: doctor.registrationNo || '',
          phone: doctor.phone || '',
          email: doctor.email || '',
          consultationFee: doctor.consultationFee?.toString() || '',
          workingDays: doctor.workingDays || [],
          workingHours: doctor.workingHours || { start: '09:00', end: '18:00' },
          slotDuration: doctor.slotDuration?.toString() || '15',
          isActive: doctor.isActive !== false,
        });
      } catch (err) {
        setFetchError(err.error || 'Failed to load doctor');
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [id]);

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

    setSaving(true);
    try {
      const payload = {
        ...formData,
        consultationFee: Number(formData.consultationFee),
        slotDuration: Number(formData.slotDuration),
      };

      await doctorService.update(id, payload);
      toast.success('Doctor updated successfully!');
      navigate('/doctors');
    } catch (error) {
      if (error.error) {
        toast.error(error.error);
      }
      if (error.details) {
        setErrors(error.details);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">{fetchError}</p>
          <Button variant="secondary" onClick={() => navigate('/doctors')} className="mt-4">
            Back to Doctors
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/doctors')} 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to Doctors"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Doctor</h1>
          <p className="text-gray-500">Update doctor information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <Card title="Basic Information" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              label="Registration Number"
              name="registrationNo"
              value={formData.registrationNo}
              onChange={handleChange}
              error={errors.registrationNo}
              required
              placeholder="Medical council registration"
            />
            <Input
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              error={errors.phone}
              required
              placeholder="10 digit mobile number"
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
        </Card>

        {/* Consultation Details */}
        <Card title="Consultation Details" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isActive"
                    checked={formData.isActive === true}
                    onChange={() => setFormData((prev) => ({ ...prev, isActive: true }))}
                    className="text-primary-600"
                  />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isActive"
                    checked={formData.isActive === false}
                    onChange={() => setFormData((prev) => ({ ...prev, isActive: false }))}
                    className="text-primary-600"
                  />
                  <span className="text-sm">Inactive</span>
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Working Schedule */}
        <Card title="Working Schedule" className="mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Working Days
              </label>
              <div className="flex flex-wrap gap-2">
                {WORKING_DAYS_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleWorkingDaysChange(day.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/doctors')}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} icon={Save}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
