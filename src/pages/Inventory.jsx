import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  AlertTriangle,
  Package,
  Clock,
  Loader2,
  PackageX,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pencil,
  Plus,
} from 'lucide-react';
import { medicineService } from '../services';
import { formatMedicinePrice, getMedicineRowPrices } from '../utils/medicinePrice';
import { formatMonthYear, daysUntilExpiryEnd } from '../utils/monthYearDate';
import MedicineCatalogModal from '../components/inventory/MedicineCatalogModal';
import MedicineDeleteButton from '../components/inventory/MedicineDeleteButton';
import MedicineDetailPanel from '../components/inventory/MedicineDetailPanel';

const PAGE_SIZE = 50;

export default function Inventory() {
  const [tab, setTab] = useState('medicines');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const [medicines, setMedicines] = useState([]);
  const [medicinesPagination, setMedicinesPagination] = useState({
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [lowStockItems, setLowStockItems] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [stats, setStats] = useState({
    totalMedicines: 0,
    lowStockCount: 0,
    expiringCount: 0,
  });

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [catalogMedicine, setCatalogMedicine] = useState(null);
  const [expandedMedicineId, setExpandedMedicineId] = useState(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const [totalMedicines, lowStockRes, expiringRes] = await Promise.all([
        medicineService.getCatalogTotal(),
        medicineService.stock.getLowStock(),
        medicineService.stock.getExpiring(90),
      ]);

      setStats({
        totalMedicines,
        lowStockCount: lowStockRes.lowStockItems?.length ?? lowStockRes.count ?? 0,
        expiringCount: expiringRes.expiringItems?.length ?? expiringRes.count ?? 0,
      });
    } catch (error) {
      console.error('Failed to fetch inventory stats:', error);
    }
  }, []);

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await medicineService.getAll({
        includeStock: true,
        limit: PAGE_SIZE,
        page,
        search: searchQuery.trim() || undefined,
      });

      const list = response.medicines || [];
      const pag = response.pagination || {};

      setMedicines(list);
      setMedicinesPagination({
        total: pag.total ?? list.length,
        totalPages: pag.totalPages ?? 1,
        hasNextPage: Boolean(pag.hasNextPage),
        hasPrevPage: Boolean(pag.hasPrevPage),
      });

      if (!searchQuery.trim()) {
        setStats((prev) => ({
          ...prev,
          totalMedicines: pag.total ?? prev.totalMedicines,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery]);

  const fetchLowStock = useCallback(async () => {
    setLoading(true);
    try {
      const response = await medicineService.stock.getLowStock();
      setLowStockItems(response.lowStockItems || []);
    } catch (error) {
      console.error('Failed to fetch low stock:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExpiring = useCallback(async () => {
    setLoading(true);
    try {
      const response = await medicineService.stock.getExpiring(90);
      setExpiringItems(response.expiringItems || []);
    } catch (error) {
      console.error('Failed to fetch expiring stock:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (tab === 'medicines') {
      const delay = searchQuery.trim() ? 300 : 0;
      const timer = setTimeout(() => fetchMedicines(), delay);
      return () => clearTimeout(timer);
    }
    if (tab === 'low-stock') {
      fetchLowStock();
    } else if (tab === 'expiring') {
      fetchExpiring();
    }
    return undefined;
  }, [tab, page, searchQuery, fetchMedicines, fetchLowStock, fetchExpiring]);

  const currentData =
    tab === 'low-stock' ? lowStockItems : tab === 'expiring' ? expiringItems : medicines;

  const filteredData =
    searchQuery && tab !== 'medicines'
      ? currentData.filter(
          (med) =>
            med.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            med.medicineId?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : currentData;

  const formatExpiry = (date) => {
    if (!date) return '-';
    return formatMonthYear(date);
  };

  const getStockStatus = (medicine) => {
    const stock = medicine.currentStock || 0;
    const reorder = medicine.reorderLevel ?? medicine.minStockLevel ?? 10;

    if (stock === 0) return { label: 'Out of Stock', class: 'badge-danger' };
    if (stock <= reorder) return { label: 'Low Stock', class: 'badge-warning' };
    return { label: 'In Stock', class: 'badge-success' };
  };

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const days = daysUntilExpiryEnd(expiryDate);
    if (days == null) return null;

    if (days < 0) return { label: 'Expired', class: 'text-red-600' };
    if (days <= 30) return { label: `${days}d left`, class: 'text-red-600' };
    if (days <= 90) return { label: `${days}d left`, class: 'text-orange-600' };
    return null;
  };

  const toggleExpand = (medicineId) => {
    setExpandedMedicineId((prev) => (prev === medicineId ? null : medicineId));
  };

  const rangeStart =
    tab === 'medicines' && medicinesPagination.total > 0
      ? (page - 1) * PAGE_SIZE + 1
      : 0;
  const rangeEnd =
    tab === 'medicines'
      ? Math.min(page * PAGE_SIZE, medicinesPagination.total)
      : filteredData.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500">Manage medicine stock</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCatalogMedicine(null);
              setCatalogModalOpen(true);
            }}
            className="btn-secondary w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            Add Medicine
          </button>
          <Link to="/inventory/stock" className="btn-primary w-full sm:w-auto justify-center">
            <Package className="w-4 h-4" />
            Manage Stock
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.totalMedicines}</p>
            <p className="text-sm text-gray-500">Total Medicines</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTab('low-stock')}
          className="card p-4 flex items-center gap-4 hover:ring-2 hover:ring-orange-200 transition-all text-left"
        >
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">{stats.lowStockCount}</p>
            <p className="text-sm text-gray-500">Low Stock Items</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setTab('expiring')}
          className="card p-4 flex items-center gap-4 hover:ring-2 hover:ring-red-200 transition-all text-left"
        >
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{stats.expiringCount}</p>
            <p className="text-sm text-gray-500">Expiring Soon (90 days)</p>
          </div>
        </button>
      </div>

      <div className="card p-1">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'medicines', label: 'All Medicines', shortLabel: 'All' },
            {
              id: 'low-stock',
              label: `Low Stock (${stats.lowStockCount})`,
              shortLabel: `Low (${stats.lowStockCount})`,
            },
            {
              id: 'expiring',
              label: `Expiring Soon (${stats.expiringCount})`,
              shortLabel: `Exp (${stats.expiringCount})`,
            },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden text-sm">{t.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search medicines..."
          className="input pl-10"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12">
            <PackageX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {tab === 'low-stock'
                ? 'No low stock items'
                : tab === 'expiring'
                  ? 'No items expiring soon'
                  : 'No medicines found'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table min-w-[700px]">
                <thead>
                  <tr>
                    <th className="w-10" />
                    <th>Medicine</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Purchase</th>
                    <th>Sale / MRP</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((med) => {
                    const status = getStockStatus(med);
                    const expiryStatus = getExpiryStatus(med.nearestExpiry || med.expiryDate);
                    const isExpanded = tab === 'medicines' && expandedMedicineId === med._id;

                    return (
                      <Fragment key={med._id}>
                        <tr className={isExpanded ? 'bg-primary-50/30' : undefined}>
                          <td className="w-10">
                            {tab === 'medicines' && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(med._id)}
                                className="p-1 rounded hover:bg-gray-100 text-gray-500"
                                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                              >
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    isExpanded ? 'rotate-0' : '-rotate-90'
                                  }`}
                                />
                              </button>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => tab === 'medicines' && toggleExpand(med._id)}
                              className={`text-left ${tab === 'medicines' ? 'hover:text-primary-700' : ''}`}
                            >
                              <p className="font-medium">{med.name}</p>
                              <p className="text-sm text-gray-500">{med.medicineId}</p>
                              {med.manufacturer && (
                                <p className="text-xs text-gray-400">{med.manufacturer}</p>
                              )}
                            </button>
                          </td>
                        <td className="capitalize">{med.category || '-'}</td>
                        <td
                          className={
                            status.class.includes('warning') || status.class.includes('danger')
                              ? 'text-orange-600 font-medium'
                              : ''
                          }
                        >
                          {med.currentStock || 0} {med.packUnit || med.unit || 'units'}
                        </td>
                        <td>{formatMedicinePrice(getMedicineRowPrices(med).purchase)}</td>
                        <td>{formatMedicinePrice(getMedicineRowPrices(med).selling)}</td>
                        <td>
                          <div>
                            <span className={expiryStatus?.class || 'text-gray-500'}>
                              {formatExpiry(med.nearestExpiry || med.expiryDate)}
                            </span>
                            {expiryStatus && (
                              <p className={`text-xs ${expiryStatus.class}`}>{expiryStatus.label}</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={status.class}>{status.label}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-3 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setCatalogMedicine(med);
                                setCatalogModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <Link
                              to={`/inventory/stock?medicine=${med._id}`}
                              className="text-sm text-green-600 hover:text-green-700"
                            >
                              Add Stock
                            </Link>
                            <MedicineDeleteButton
                              medicine={med}
                              onDeleted={() => {
                                fetchMedicines();
                                fetchStats();
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="p-0">
                              <MedicineDetailPanel
                                medicineId={med._id}
                                refreshKey={detailRefreshKey}
                                onEdit={(m) => {
                                  setCatalogMedicine(m);
                                  setCatalogModalOpen(true);
                                }}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {tab === 'medicines' && medicinesPagination.total > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-600">
                  Showing {rangeStart}–{rangeEnd} of {medicinesPagination.total}
                  {searchQuery.trim() ? ' matching search' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!medicinesPagination.hasPrevPage || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 px-2">
                    Page {page} of {medicinesPagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!medicinesPagination.hasNextPage || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <MedicineCatalogModal
        isOpen={catalogModalOpen}
        onClose={() => {
          setCatalogModalOpen(false);
          setCatalogMedicine(null);
        }}
        medicine={catalogMedicine}
        onSaved={() => {
          fetchMedicines();
          fetchStats();
          setDetailRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
