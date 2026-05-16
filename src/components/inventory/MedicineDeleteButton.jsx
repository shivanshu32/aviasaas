import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmModal, Button } from '../ui';
import { medicineService } from '../../services';

/**
 * Delete medicine from inventory (confirmation modal).
 * @param {'link'|'button'} variant - link: text action in Inventory table; button: ghost Button on stock page
 */
export default function MedicineDeleteButton({
  medicine,
  onDeleted,
  variant = 'link',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!medicine?._id) return null;

  const stock = medicine.currentStock ?? 0;
  const message =
    stock > 0
      ? `Remove "${medicine.name}" (${medicine.medicineId}) from inventory? All ${stock} ${medicine.packUnit || 'units'} of stock will be deleted. Past bills that used this medicine are not changed.`
      : `Remove "${medicine.name}" (${medicine.medicineId}) from inventory? This cannot be undone.`;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await medicineService.delete(medicine._id);
      toast.success('Medicine removed from inventory');
      setOpen(false);
      onDeleted?.();
    } catch (error) {
      toast.error(error.error || 'Failed to delete medicine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {variant === 'button' ? (
        <Button
          variant="ghost"
          size="sm"
          icon={Trash2}
          onClick={() => setOpen(true)}
          className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${className}`}
        >
          Delete
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700 ${className}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      )}

      <ConfirmModal
        isOpen={open}
        onClose={() => !loading && setOpen(false)}
        onConfirm={handleConfirm}
        title="Remove medicine?"
        message={message}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        loading={loading}
      />
    </>
  );
}
