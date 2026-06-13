import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Button, Input, Select, Modal } from '../ui';
import { medicineService } from '../../services';
import {
  getInitialMedicineForm,
  medicineRowToForm,
  validateMedicineForm,
  buildMedicinePayload,
  MEDICINE_CATEGORIES,
  SCHEDULE_TYPE_SELECT,
} from '../../utils/medicineForm';

export default function MedicineCatalogModal({ isOpen, onClose, medicine, onSaved }) {
  const isEdit = Boolean(medicine);
  const [form, setForm] = useState(() => getInitialMedicineForm());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(medicine ? medicineRowToForm(medicine) : getInitialMedicineForm());
  }, [isOpen, medicine]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateMedicineForm(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const payload = buildMedicinePayload(form, { isEdit });

    setLoading(true);
    try {
      if (isEdit) {
        await medicineService.update(medicine._id, payload);
        toast.success('Medicine updated successfully');
      } else {
        await medicineService.create(payload);
        toast.success('Medicine added successfully');
      }
      onSaved?.();
      onClose?.();
    } catch (error) {
      toast.error(error.error || `Failed to ${isEdit ? 'update' : 'add'} medicine`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Medicine — ${medicine.medicineId}` : 'Add New Medicine'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Medicine Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            placeholder="e.g., Paracetamol 500mg"
          />
          <Input
            label="Generic Name"
            value={form.genericName}
            onChange={(e) => setForm((p) => ({ ...p, genericName: e.target.value }))}
            placeholder="e.g., Paracetamol"
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            options={MEDICINE_CATEGORIES}
            placeholder=""
          />
          <Input
            label="Manufacturer"
            value={form.manufacturer}
            onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))}
            placeholder="Company name"
          />
          <Input
            label="Composition"
            value={form.composition}
            onChange={(e) => setForm((p) => ({ ...p, composition: e.target.value }))}
          />
          <Input
            label="Strength"
            value={form.strength}
            onChange={(e) => setForm((p) => ({ ...p, strength: e.target.value }))}
            placeholder="e.g., 500mg"
          />
          <Input
            label="HSN Code"
            value={form.hsnCode}
            onChange={(e) => setForm((p) => ({ ...p, hsnCode: e.target.value }))}
          />
          <Input
            label="Rack location"
            value={form.rackLocation}
            onChange={(e) => setForm((p) => ({ ...p, rackLocation: e.target.value }))}
          />
          <Input
            label="Pack Size"
            type="number"
            value={form.packSize}
            onChange={(e) => setForm((p) => ({ ...p, packSize: e.target.value }))}
            min="1"
          />
          <Input
            label="Pack Unit"
            value={form.packUnit}
            onChange={(e) => setForm((p) => ({ ...p, packUnit: e.target.value }))}
            placeholder="tablets, ml, etc."
          />
          <Input
            label="Reorder Level"
            type="number"
            value={form.reorderLevel}
            onChange={(e) => setForm((p) => ({ ...p, reorderLevel: e.target.value }))}
            min="0"
          />
          <Input
            label="GST Rate (%)"
            type="number"
            value={form.gstRate}
            onChange={(e) => setForm((p) => ({ ...p, gstRate: e.target.value }))}
            min="0"
            max="28"
          />
          <Select
            label="Drug schedule"
            value={form.scheduleType}
            onChange={(e) => setForm((p) => ({ ...p, scheduleType: e.target.value }))}
            options={SCHEDULE_TYPE_SELECT}
            placeholder=""
          />
          <div className="col-span-2 flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={form.isScheduled}
                onChange={(e) => setForm((p) => ({ ...p, isScheduled: e.target.checked }))}
              />
              <span className="text-sm text-gray-700">Mark as scheduled drug</span>
            </label>
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">
              Prices are set per batch when adding stock. To change prices, update the stock batch on the Stock page.
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save changes' : 'Add Medicine'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
