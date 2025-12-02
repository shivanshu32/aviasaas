import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Select, Textarea, Card } from '../../components/ui';
import { patientService } from '../../services';

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

const BLOOD_GROUP_OPTIONS = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

export default function EditPatient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [fetchError, setFetchError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    phone: '',
    email: '',
    bloodGroup: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
    },
    allergies: '',
    medicalHistory: '',
    emergencyContact: {
      name: '',
      phone: '',
      relation: '',
    },
  });

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const response = await patientService.getById(id);
        const patient = response.patient;
        setFormData({
          name: patient.name || '',
          age: patient.age?.toString() || '',
          gender: patient.gender || '',
          phone: patient.phone || '',
          email: patient.email || '',
          bloodGroup: patient.bloodGroup || '',
          address: {
            line1: patient.address?.line1 || '',
            line2: patient.address?.line2 || '',
            city: patient.address?.city || '',
            state: patient.address?.state || '',
            pincode: patient.address?.pincode || '',
          },
          allergies: Array.isArray(patient.allergies) ? patient.allergies.join(', ') : '',
          medicalHistory: patient.medicalHistory || '',
          emergencyContact: {
            name: patient.emergencyContact?.name || '',
            phone: patient.emergencyContact?.phone || '',
            relation: patient.emergencyContact?.relation || '',
          },
        });
      } catch (err) {
        setFetchError(err.error || 'Failed to load patient');
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
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

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.age) newErrors.age = 'Age is required';
    else if (isNaN(formData.age) || formData.age < 0 || formData.age > 150) {
      newErrors.age = 'Enter a valid age';
    }
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.phone) newErrors.phone = 'Phone is required';
    else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'Phone must be 10 digits';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Enter a valid email';
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
        age: parseInt(formData.age, 10),
        allergies: formData.allergies
          ? formData.allergies.split(',').map((a) => a.trim()).filter(Boolean)
          : [],
      };

      await patientService.update(id, payload);
      toast.success('Patient updated successfully!');
      navigate(`/patients/${id}`);
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
          <Button variant="secondary" onClick={() => navigate('/patients')} className="mt-4">
            Back to Patients
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
          onClick={() => navigate(`/patients/${id}`)} 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to Patient"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Patient</h1>
          <p className="text-gray-500">Update patient information</p>
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
              placeholder="Enter patient name"
            />
            <Input
              label="Age"
              name="age"
              type="number"
              value={formData.age}
              onChange={handleChange}
              error={errors.age}
              required
              placeholder="Years"
              min="0"
              max="150"
            />
            <Select
              label="Gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              options={GENDER_OPTIONS}
              error={errors.gender}
              required
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
            <Select
              label="Blood Group"
              name="bloodGroup"
              value={formData.bloodGroup}
              onChange={handleChange}
              options={BLOOD_GROUP_OPTIONS}
            />
          </div>
        </Card>

        {/* Address */}
        <Card title="Address" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Address Line 1"
              name="address.line1"
              value={formData.address.line1}
              onChange={handleChange}
              placeholder="House/Flat No., Street"
            />
            <Input
              label="Address Line 2"
              name="address.line2"
              value={formData.address.line2}
              onChange={handleChange}
              placeholder="Landmark, Area"
            />
            <Input
              label="City"
              name="address.city"
              value={formData.address.city}
              onChange={handleChange}
              placeholder="City"
            />
            <Input
              label="State"
              name="address.state"
              value={formData.address.state}
              onChange={handleChange}
              placeholder="State"
            />
            <Input
              label="Pincode"
              name="address.pincode"
              value={formData.address.pincode}
              onChange={handleChange}
              placeholder="6 digit pincode"
              maxLength={6}
            />
          </div>
        </Card>

        {/* Medical Information */}
        <Card title="Medical Information" className="mb-6">
          <div className="space-y-4">
            <Input
              label="Allergies"
              name="allergies"
              value={formData.allergies}
              onChange={handleChange}
              placeholder="Comma separated (e.g., Penicillin, Dust, Peanuts)"
              helperText="Enter allergies separated by commas"
            />
            <Textarea
              label="Medical History"
              name="medicalHistory"
              value={formData.medicalHistory}
              onChange={handleChange}
              placeholder="Previous surgeries, chronic conditions, ongoing medications..."
              rows={4}
            />
          </div>
        </Card>

        {/* Emergency Contact */}
        <Card title="Emergency Contact" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Contact Name"
              name="emergencyContact.name"
              value={formData.emergencyContact.name}
              onChange={handleChange}
              placeholder="Emergency contact name"
            />
            <Input
              label="Contact Phone"
              name="emergencyContact.phone"
              value={formData.emergencyContact.phone}
              onChange={handleChange}
              placeholder="10 digit number"
              maxLength={10}
            />
            <Input
              label="Relation"
              name="emergencyContact.relation"
              value={formData.emergencyContact.relation}
              onChange={handleChange}
              placeholder="e.g., Spouse, Parent"
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate(`/patients/${id}`)}>
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
