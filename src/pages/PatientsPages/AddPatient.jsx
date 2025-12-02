import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, User, Phone, Mail, MapPin, Heart, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Select, Textarea } from '../../components/ui';
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

export default function AddPatient() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    phone: '',
    email: '',
    bloodGroup: '',
    address: {
      line1: '',
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

    setLoading(true);
    try {
      const payload = {
        ...formData,
        age: parseInt(formData.age, 10),
        allergies: formData.allergies
          ? formData.allergies.split(',').map((a) => a.trim()).filter(Boolean)
          : [],
      };

      const response = await patientService.create(payload);
      toast.success('Patient registered successfully!');
      navigate('/patients', { 
        state: { newPatient: response.patient } 
      });
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
            onClick={() => navigate('/patients')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Add New Patient</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/patients')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} icon={Save}>
            Register Patient
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
              placeholder="Patient name"
            />
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <Input
              label="Phone Number *"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              error={errors.phone}
              required
              placeholder="10 digit mobile number"
              maxLength={10}
              icon={Phone}
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
        </div>

        {/* Column 2: Address & Emergency */}
        <div className="space-y-4">
          {/* Address */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-orange-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Address</h2>
            </div>
            <div className="space-y-3">
              <Input
                label="Address"
                name="address.line1"
                value={formData.address.line1}
                onChange={handleChange}
                placeholder="House/Flat, Street, Area"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleChange}
                  placeholder="City"
                />
                <Input
                  label="Pincode"
                  name="address.pincode"
                  value={formData.address.pincode}
                  onChange={handleChange}
                  placeholder="Pincode"
                  maxLength={6}
                />
              </div>
              <Input
                label="State"
                name="address.state"
                value={formData.address.state}
                onChange={handleChange}
                placeholder="State"
              />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-pink-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Emergency Contact</h2>
            </div>
            <div className="space-y-3">
              <Input
                label="Contact Name"
                name="emergencyContact.name"
                value={formData.emergencyContact.name}
                onChange={handleChange}
                placeholder="Name"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone"
                  name="emergencyContact.phone"
                  value={formData.emergencyContact.phone}
                  onChange={handleChange}
                  placeholder="Phone"
                  maxLength={10}
                />
                <Input
                  label="Relation"
                  name="emergencyContact.relation"
                  value={formData.emergencyContact.relation}
                  onChange={handleChange}
                  placeholder="Relation"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Medical Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <h2 className="font-semibold text-gray-900">Medical Information</h2>
          </div>
          <div className="space-y-3">
            <Input
              label="Allergies"
              name="allergies"
              value={formData.allergies}
              onChange={handleChange}
              placeholder="Comma separated"
            />
            <Textarea
              label="Medical History"
              name="medicalHistory"
              value={formData.medicalHistory}
              onChange={handleChange}
              placeholder="Previous conditions, surgeries, medications..."
              rows={8}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
