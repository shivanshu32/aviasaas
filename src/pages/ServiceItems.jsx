import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Loader2, FlaskConical, Scan, Stethoscope, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { serviceItemService } from '../services';

const CATEGORIES = [
  { value: 'laboratory', label: 'Laboratory', icon: FlaskConical, color: 'blue' },
  { value: 'radiology', label: 'Radiology', icon: Scan, color: 'purple' },
  { value: 'procedure', label: 'Procedure', icon: Stethoscope, color: 'green' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: 'gray' },
];

export default function ServiceItems() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'laboratory',
    rate: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServices();
  }, [selectedCategory]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      const response = await serviceItemService.getAll(params);
      setServices(response.services || []);
    } catch (error) {
      toast.error('Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        category: service.category,
        rate: service.rate.toString(),
        description: service.description || '',
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        category: selectedCategory || 'laboratory',
        rate: '',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingService(null);
    setFormData({ name: '', category: 'laboratory', rate: '', description: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Service name is required');
      return;
    }
    if (!formData.rate || Number(formData.rate) <= 0) {
      toast.error('Valid rate is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        rate: Number(formData.rate),
        description: formData.description.trim(),
      };

      if (editingService) {
        await serviceItemService.update(editingService._id, payload);
        toast.success('Service updated successfully');
      } else {
        await serviceItemService.add(payload);
        toast.success('Service added successfully');
      }
      
      handleCloseModal();
      fetchServices();
    } catch (error) {
      toast.error(error.error || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Are you sure you want to delete "${service.name}"?`)) {
      return;
    }

    try {
      await serviceItemService.delete(service._id);
      toast.success('Service deleted successfully');
      fetchServices();
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  const filteredServices = services.filter((service) =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryInfo = (category) => {
    return CATEGORIES.find((c) => c.value === category) || CATEGORIES[3];
  };

  const groupedServices = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = filteredServices.filter((s) => s.category === cat.value);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Items</h1>
          <p className="text-gray-500">Manage laboratory, radiology, procedure and other service items</p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === ''
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                selectedCategory === cat.value
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <cat.icon className="w-4 h-4" />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'Try a different search term' : 'Add your first service item'}
          </p>
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>
      ) : selectedCategory ? (
        // Single category view
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate (₹)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredServices.map((service) => (
                <tr key={service._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{service.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{service.description || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium">₹{service.rate.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenModal(service)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(service)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Grouped view
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {CATEGORIES.map((cat) => {
            const categoryServices = groupedServices[cat.value];
            if (categoryServices.length === 0) return null;
            
            return (
              <div key={cat.value} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`px-4 py-3 bg-${cat.color}-50 border-b border-${cat.color}-100 flex items-center gap-2`}>
                  <cat.icon className={`w-5 h-5 text-${cat.color}-600`} />
                  <h3 className="font-semibold text-gray-900">{cat.label}</h3>
                  <span className="ml-auto text-sm text-gray-500">{categoryServices.length} items</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {categoryServices.map((service) => (
                    <div key={service._id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-gray-500 truncate">{service.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="font-medium text-gray-900">₹{service.rate}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenModal(service)}
                            className="p-1 text-gray-400 hover:text-primary-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(service)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingService ? 'Edit Service' : 'Add Service'}
              </h2>
              <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Service Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Complete Blood Count"
                />
              </div>
              <div>
                <label className="label">Category <span className="text-red-500">*</span></label>
                <select
                  className="input"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Rate (₹) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  className="input"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  type="text"
                  className="input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingService ? 'Update' : 'Add'} Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
