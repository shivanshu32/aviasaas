import { useState, useEffect } from 'react';
import { Save, Upload, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { clinicService } from '../services';
import { useClinic } from '../context/ClinicContext';
import { useQueryClient } from '@tanstack/react-query';

export default function Settings() {
  const { settings: currentSettings, isLoading: contextLoading } = useClinic();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    clinicName: '',
    tagline: '',
    logo: null,
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
    },
    phones: [''],
    email: '',
    website: '',
    gstNo: '',
    drugLicenseNo: '',
    timings: '',
    invoiceTerms: '',
    prescriptionFooter: '',
  });

  // Load current settings into form
  useEffect(() => {
    if (currentSettings) {
      setFormData({
        clinicName: currentSettings.clinicName || '',
        tagline: currentSettings.tagline || '',
        logo: currentSettings.logo || null,
        address: {
          line1: currentSettings.address?.line1 || '',
          line2: currentSettings.address?.line2 || '',
          city: currentSettings.address?.city || '',
          state: currentSettings.address?.state || '',
          pincode: currentSettings.address?.pincode || '',
        },
        phones: currentSettings.phones?.length > 0 ? currentSettings.phones : [''],
        email: currentSettings.email || '',
        website: currentSettings.website || '',
        gstNo: currentSettings.gstNo || '',
        drugLicenseNo: currentSettings.drugLicenseNo || '',
        timings: currentSettings.timings || '',
        invoiceTerms: currentSettings.invoiceTerms || '',
        prescriptionFooter: currentSettings.prescriptionFooter || '',
      });
    }
  }, [currentSettings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.startsWith('address.')) {
      const field = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [field]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handlePhoneChange = (index, value) => {
    setFormData((prev) => {
      const newPhones = [...prev.phones];
      newPhones[index] = value;
      return { ...prev, phones: newPhones };
    });
  };

  const addPhone = () => {
    setFormData((prev) => ({
      ...prev,
      phones: [...prev.phones, ''],
    }));
  };

  const removePhone = (index) => {
    setFormData((prev) => ({
      ...prev,
      phones: prev.phones.filter((_, i) => i !== index),
    }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, logo: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setFormData((prev) => ({ ...prev, logo: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.clinicName.trim()) {
      toast.error('Clinic name is required');
      return;
    }

    setLoading(true);
    try {
      // Filter out empty phones
      const payload = {
        ...formData,
        phones: formData.phones.filter((p) => p.trim()),
      };

      await clinicService.updateSettings(payload);
      
      // Invalidate the clinic settings cache to refresh data
      queryClient.invalidateQueries(['clinicSettings']);
      
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(error.error || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  if (contextLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage clinic settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinic Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Clinic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Clinic Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="clinicName"
                  className="input" 
                  value={formData.clinicName}
                  onChange={handleChange}
                  placeholder="Enter clinic name"
                />
              </div>
              <div>
                <label className="label">Tagline</label>
                <input 
                  type="text" 
                  name="tagline"
                  className="input" 
                  value={formData.tagline}
                  onChange={handleChange}
                  placeholder="Your clinic tagline"
                />
              </div>
              <div>
                <label className="label">Address Line 1</label>
                <input 
                  type="text" 
                  name="address.line1"
                  className="input" 
                  value={formData.address.line1}
                  onChange={handleChange}
                  placeholder="Street address"
                />
              </div>
              <div>
                <label className="label">Address Line 2</label>
                <input 
                  type="text" 
                  name="address.line2"
                  className="input" 
                  value={formData.address.line2}
                  onChange={handleChange}
                  placeholder="Building, floor, etc."
                />
              </div>
              <div>
                <label className="label">City</label>
                <input 
                  type="text" 
                  name="address.city"
                  className="input" 
                  value={formData.address.city}
                  onChange={handleChange}
                  placeholder="City"
                />
              </div>
              <div>
                <label className="label">State</label>
                <input 
                  type="text" 
                  name="address.state"
                  className="input" 
                  value={formData.address.state}
                  onChange={handleChange}
                  placeholder="State"
                />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input 
                  type="text" 
                  name="address.pincode"
                  className="input" 
                  value={formData.address.pincode}
                  onChange={handleChange}
                  placeholder="Pincode"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input 
                  type="email" 
                  name="email"
                  className="input" 
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="clinic@example.com"
                />
              </div>
              <div>
                <label className="label">Website</label>
                <input 
                  type="text" 
                  name="website"
                  className="input" 
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="www.example.com"
                />
              </div>
              <div>
                <label className="label">GST Number</label>
                <input 
                  type="text" 
                  name="gstNo"
                  className="input" 
                  value={formData.gstNo}
                  onChange={handleChange}
                  placeholder="Enter GST number"
                />
              </div>
              <div>
                <label className="label">Drug License No</label>
                <input 
                  type="text" 
                  name="drugLicenseNo"
                  className="input" 
                  value={formData.drugLicenseNo}
                  onChange={handleChange}
                  placeholder="Enter license number"
                />
              </div>
              <div>
                <label className="label">Working Hours</label>
                <input 
                  type="text" 
                  name="timings"
                  className="input" 
                  value={formData.timings}
                  onChange={handleChange}
                  placeholder="Mon-Sat: 9 AM - 8 PM"
                />
              </div>
            </div>

            {/* Phone Numbers */}
            <div className="mt-4">
              <label className="label">Phone Numbers</label>
              <div className="space-y-2">
                {formData.phones.map((phone, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      value={phone}
                      onChange={(e) => handlePhoneChange(index, e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                    />
                    {formData.phones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePhone(index)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPhone}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  + Add another phone
                </button>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Billing & Prescription Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Invoice Terms & Conditions</label>
                <textarea 
                  name="invoiceTerms"
                  className="input" 
                  rows={3} 
                  value={formData.invoiceTerms}
                  onChange={handleChange}
                  placeholder="Payment terms, refund policy, etc."
                />
              </div>
              <div>
                <label className="label">Prescription Footer</label>
                <textarea 
                  name="prescriptionFooter"
                  className="input" 
                  rows={2} 
                  value={formData.prescriptionFooter}
                  onChange={handleChange}
                  placeholder="Message to display at bottom of prescriptions"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Clinic Logo</h2>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              {formData.logo ? (
                <div className="relative inline-block">
                  <img 
                    src={formData.logo} 
                    alt="Clinic Logo" 
                    className="w-24 h-24 object-contain mx-auto rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-400">LOGO</span>
                </div>
              )}
              <label className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-2 mt-4">
                <Upload className="w-4 h-4" />
                {formData.logo ? 'Change Logo' : 'Upload Logo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 2MB</p>
            </div>
          </div>

          {/* Quick Info */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>
            <div className="text-sm space-y-2">
              <p className="font-semibold text-primary-600">{formData.clinicName || 'Clinic Name'}</p>
              {formData.tagline && <p className="text-gray-500 italic">{formData.tagline}</p>}
              {(formData.address.line1 || formData.address.city) && (
                <p className="text-gray-600">
                  {[formData.address.line1, formData.address.city, formData.address.state]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              {formData.phones.filter(Boolean).length > 0 && (
                <p className="text-gray-600">📞 {formData.phones.filter(Boolean).join(', ')}</p>
              )}
              {formData.email && <p className="text-gray-600">✉️ {formData.email}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <button 
          type="submit" 
          className="btn-primary"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
