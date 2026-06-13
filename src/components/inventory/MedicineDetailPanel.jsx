import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  Package,
  History,
  Info,
  Pencil,
  Plus,
  ExternalLink,
  X,
} from 'lucide-react';
import { Input } from '../ui';
import { medicineService } from '../../services';
import { formatMedicinePrice } from '../../utils/medicinePrice';
import { formatMonthYear } from '../../utils/monthYearDate';

const MOVEMENT_LABELS = {
  stock_add: 'Stock added',
  stock_deduct: 'Manual deduction',
  bill_sale: 'Bill sale',
  bill_restore: 'Bill restore',
  catalog_update: 'Catalog updated',
  batch_price_sync: 'Batch prices synced',
  medicine_delete: 'Medicine removed',
};

const SOURCE_STYLES = {
  manual: 'bg-blue-100 text-blue-700',
  system: 'bg-purple-100 text-purple-700',
  backfill: 'bg-gray-100 text-gray-600',
};

function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DetailField = ({ label, value }) => (
  <div>
    <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
    <dd className="text-sm text-gray-900 mt-0.5">{value ?? '—'}</dd>
  </div>
);

export default function MedicineDetailPanel({
  medicineId,
  onEdit,
  refreshKey = 0,
}) {
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(true);
  const [medicine, setMedicine] = useState(null);
  const [batches, setBatches] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPagination, setActivityPagination] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  // Batch edit modal state
  const [editingBatch, setEditingBatch] = useState(null);
  const [batchForm, setBatchForm] = useState({});
  const [savingBatch, setSavingBatch] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [medRes, batchRes, activityRes] = await Promise.all([
        medicineService.getById(medicineId, true),
        medicineService.stock.getBatches(medicineId, { includeExhausted: 'true' }),
        medicineService.activity.getForMedicine(medicineId, { page: 1, limit: 50 }),
      ]);
      setMedicine(medRes.medicine);
      setBatches(batchRes.batches || []);
      setMovements(activityRes.movements || []);
      setActivityPagination(activityRes.pagination || null);
      setActivityPage(1);
    } catch (err) {
      console.error('Failed to load medicine details:', err);
      setError(err.error || 'Failed to load medicine details');
    } finally {
      setLoading(false);
    }
  }, [medicineId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const openBatchEdit = (batch) => {
    setEditingBatch(batch);
    setBatchForm({
      batchNo: batch.batchNo || '',
      expiryDate: batch.expiryDate ? batch.expiryDate.substring(0, 7) : '',
      mfgDate: batch.mfgDate ? batch.mfgDate.substring(0, 7) : '',
      purchasePrice: batch.purchasePrice != null ? String(batch.purchasePrice) : '',
      mrp: batch.mrp != null ? String(batch.mrp) : '',
      sellingPrice: batch.sellingPrice != null ? String(batch.sellingPrice) : '',
      supplier: batch.supplier || '',
      purchaseInvoiceNo: batch.purchaseInvoiceNo || '',
      gstRate: batch.gstRate != null ? String(batch.gstRate) : '',
      remarks: batch.remarks || '',
    });
  };

  const closeBatchEdit = () => {
    setEditingBatch(null);
    setBatchForm({});
  };

  const saveBatchEdit = async (e) => {
    e.preventDefault();
    if (!editingBatch) return;
    setSavingBatch(true);
    try {
      const payload = {
        batchId: editingBatch._id,
        batchNo: batchForm.batchNo.trim(),
        expiryDate: batchForm.expiryDate,
        mfgDate: batchForm.mfgDate || undefined,
        purchasePrice: Number(batchForm.purchasePrice),
        mrp: Number(batchForm.mrp),
        sellingPrice: batchForm.sellingPrice ? Number(batchForm.sellingPrice) : null,
        supplier: batchForm.supplier.trim() || null,
        purchaseInvoiceNo: batchForm.purchaseInvoiceNo.trim() || null,
        gstRate: batchForm.gstRate ? Number(batchForm.gstRate) : undefined,
        remarks: batchForm.remarks.trim() || null,
      };
      await medicineService.stock.updateBatch(payload);
      await loadData();
      closeBatchEdit();
    } catch (err) {
      console.error('Failed to update batch:', err);
      alert(err.error || 'Failed to update batch');
    } finally {
      setSavingBatch(false);
    }
  };

  const loadMoreActivity = async () => {
    if (!activityPagination?.hasNextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = activityPage + 1;
      const res = await medicineService.activity.getForMedicine(medicineId, {
        page: nextPage,
        limit: 50,
      });
      setMovements((prev) => [...prev, ...(res.movements || [])]);
      setActivityPagination(res.pagination || null);
      setActivityPage(nextPage);
    } catch (err) {
      console.error('Failed to load more activity:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 px-4 bg-gray-50 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: Info },
    { id: 'batches', label: `Batches (${batches.length})`, icon: Package },
    { id: 'activity', label: 'Activity', icon: History },
  ];

  return (
    <div className="bg-gray-50 border-t border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(medicine)}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          <Link
            to={`/inventory/stock?medicine=${medicineId}`}
            className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Stock
          </Link>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'details' && medicine && (
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <DetailField label="Generic name" value={medicine.genericName} />
            <DetailField label="Manufacturer" value={medicine.manufacturer} />
            <DetailField label="Composition" value={medicine.composition} />
            <DetailField label="Strength" value={medicine.strength} />
            <DetailField label="HSN code" value={medicine.hsnCode} />
            <DetailField label="Rack location" value={medicine.rackLocation} />
            <DetailField
              label="Pack"
              value={
                medicine.packSize != null
                  ? `${medicine.packSize} ${medicine.packUnit || ''}`.trim()
                  : null
              }
            />
            <DetailField label="Reorder level" value={medicine.reorderLevel} />
            <DetailField
              label="GST"
              value={medicine.gstRate != null ? `${medicine.gstRate}%` : null}
            />
            <DetailField
              label="Schedule"
              value={
                medicine.isScheduled
                  ? medicine.scheduleType || 'Scheduled'
                  : 'Not scheduled'
              }
            />
            <DetailField
              label="Purchase range"
              value={
                medicine.batchMinPurchasePrice != null && medicine.batchPurchasePrice != null && medicine.batchMinPurchasePrice !== medicine.batchPurchasePrice
                  ? `${formatMedicinePrice(medicine.batchMinPurchasePrice)} – ${formatMedicinePrice(medicine.batchPurchasePrice)}`
                  : formatMedicinePrice(medicine.weightedAvgPurchasePrice ?? medicine.displayPurchasePrice)
              }
            />
            <DetailField
              label="Sale / MRP range"
              value={
                (medicine.batchMinSellingPrice ?? medicine.batchMinMrp) != null &&
                (medicine.batchSellingPrice ?? medicine.batchMrp) != null &&
                (medicine.batchMinSellingPrice ?? medicine.batchMinMrp) !== (medicine.batchSellingPrice ?? medicine.batchMrp)
                  ? `${formatMedicinePrice(medicine.batchMinSellingPrice ?? medicine.batchMinMrp)} – ${formatMedicinePrice(medicine.batchSellingPrice ?? medicine.batchMrp)}`
                  : formatMedicinePrice(medicine.weightedAvgSellingPrice ?? medicine.weightedAvgMrp ?? medicine.displaySellingPrice)
              }
            />
            <DetailField
              label="Total stock"
              value={`${medicine.totalStock ?? medicine.currentStock ?? 0} ${medicine.packUnit || 'units'}`}
            />
            <DetailField label="Added" value={formatDateTime(medicine.createdAt)} />
            <DetailField label="Last updated" value={formatDateTime(medicine.updatedAt)} />
          </dl>
        )}

        {activeTab === 'batches' && (
          <div className="overflow-x-auto">
            {batches.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No stock batches</p>
            ) : (
              <table className="table min-w-[800px] text-sm">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Expiry</th>
                    <th>Mfg</th>
                    <th>Initial / Current</th>
                    <th>Purchase</th>
                    <th>MRP / Sale</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch._id}>
                      <td className="font-medium">{batch.batchNo}</td>
                      <td>{formatMonthYear(batch.expiryDate)}</td>
                      <td>{formatMonthYear(batch.mfgDate)}</td>
                      <td>
                        {batch.initialQty ?? batch.currentQty} / {batch.currentQty}
                      </td>
                      <td>{formatMedicinePrice(batch.purchasePrice)}</td>
                      <td>
                        {formatMedicinePrice(batch.mrp)} / {formatMedicinePrice(batch.sellingPrice)}
                      </td>
                      <td>
                        <div>
                          <span>{batch.supplier || '—'}</span>
                          {batch.purchaseInvoiceNo && (
                            <p className="text-xs text-gray-500">{batch.purchaseInvoiceNo}</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="capitalize">{batch.status || '—'}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs">{formatDateTime(batch.createdAt)}</span>
                          <button
                            type="button"
                            onClick={() => openBatchEdit(batch)}
                            className="text-primary-600 hover:text-primary-700"
                            title="Edit batch"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            {movements.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No activity recorded yet. Run backfill for historical data.
              </p>
            ) : (
              <ul className="space-y-2">
                {movements.map((m) => {
                  const label = MOVEMENT_LABELS[m.type] || m.type;
                  const qty = m.quantityDelta;
                  const qtyLabel =
                    qty > 0 ? `+${qty}` : qty < 0 ? String(qty) : '—';
                  const billId =
                    m.referenceType === 'bill' && m.referenceId
                      ? String(m.referenceId)
                      : null;

                  return (
                    <li
                      key={m._id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-white rounded-lg border border-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">{label}</span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                              SOURCE_STYLES[m.source] || SOURCE_STYLES.manual
                            }`}
                          >
                            {m.source || 'manual'}
                          </span>
                          {m.backfilled && (
                            <span className="text-xs text-gray-400">historical</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {m.batchNo && <span>Batch {m.batchNo} · </span>}
                          {m.reason && <span>{m.reason} · </span>}
                          {m.metadata?.patientName && (
                            <span>{m.metadata.patientName} · </span>
                          )}
                          {formatDateTime(m.createdAt)}
                        </p>
                        {m.metadata?.changes?.length > 0 && (
                          <p className="text-xs text-gray-600 mt-1">
                            {m.metadata.changes
                              .map((c) => `${c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`)
                              .join('; ')}
                          </p>
                        )}
                        {m.remarks && (
                          <p className="text-xs text-gray-500 mt-0.5">{m.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {qty !== 0 && (
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              qty > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {qtyLabel}
                          </span>
                        )}
                        {billId && (
                          <Link
                            to={`/billing/medicine/${billId}`}
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                          >
                            {m.referenceLabel || 'View bill'}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {activityPagination?.hasNextPage && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={loadMoreActivity}
                  disabled={loadingMore}
                  className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more activity'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batch Edit Modal */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-900">Edit Batch — {editingBatch.batchNo}</h3>
              <button type="button" onClick={closeBatchEdit} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveBatchEdit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Batch No"
                  value={batchForm.batchNo}
                  onChange={(e) => setBatchForm((p) => ({ ...p, batchNo: e.target.value }))}
                  required
                />
                <Input
                  label="Expiry (YYYY-MM)"
                  value={batchForm.expiryDate}
                  onChange={(e) => setBatchForm((p) => ({ ...p, expiryDate: e.target.value }))}
                  required
                  placeholder="2026-08"
                />
                <Input
                  label="Mfg Date (YYYY-MM)"
                  value={batchForm.mfgDate}
                  onChange={(e) => setBatchForm((p) => ({ ...p, mfgDate: e.target.value }))}
                  placeholder="2026-01"
                />
                <Input
                  label="Purchase Price (₹)"
                  type="number"
                  value={batchForm.purchasePrice}
                  onChange={(e) => setBatchForm((p) => ({ ...p, purchasePrice: e.target.value }))}
                  required
                  min="0"
                  step="0.01"
                />
                <Input
                  label="MRP (₹)"
                  type="number"
                  value={batchForm.mrp}
                  onChange={(e) => setBatchForm((p) => ({ ...p, mrp: e.target.value }))}
                  required
                  min="0"
                  step="0.01"
                />
                <Input
                  label="Selling Price (₹)"
                  type="number"
                  value={batchForm.sellingPrice}
                  onChange={(e) => setBatchForm((p) => ({ ...p, sellingPrice: e.target.value }))}
                  placeholder="Leave empty for MRP"
                  min="0"
                  step="0.01"
                />
                <Input
                  label="GST Rate (%)"
                  type="number"
                  value={batchForm.gstRate}
                  onChange={(e) => setBatchForm((p) => ({ ...p, gstRate: e.target.value }))}
                  min="0"
                  max="28"
                />
                <Input
                  label="Supplier"
                  value={batchForm.supplier}
                  onChange={(e) => setBatchForm((p) => ({ ...p, supplier: e.target.value }))}
                />
                <Input
                  label="Invoice No"
                  value={batchForm.purchaseInvoiceNo}
                  onChange={(e) => setBatchForm((p) => ({ ...p, purchaseInvoiceNo: e.target.value }))}
                />
              </div>
              <Input
                label="Remarks"
                value={batchForm.remarks}
                onChange={(e) => setBatchForm((p) => ({ ...p, remarks: e.target.value }))}
              />
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={closeBatchEdit}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBatch}
                  className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingBatch ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
