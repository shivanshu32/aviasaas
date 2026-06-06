import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Package, AlertTriangle, Clock, Search, X, Check, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card, Table, Modal, Badge } from '../../components/ui';
import { medicineService } from '../../services';
import { formatMedicinePrice, getMedicineRowPrices } from '../../utils/medicinePrice';
import MedicineCatalogModal from '../../components/inventory/MedicineCatalogModal';
import MedicineDeleteButton from '../../components/inventory/MedicineDeleteButton';

// Medicine Search Component for Add Stock modal
function MedicineSearch({ value, onChange, onSelect, selectedMedicine }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchMedicines = async () => {
      if (!query || query.length < 1) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      try {
        const response = await medicineService.getAll({ search: query, limit: 10, includeStock: 'true' });
        setResults(response.medicines || []);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchMedicines, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (medicine) => {
    onSelect(medicine);
    setQuery('');
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelect(null);
    onChange('');
    setQuery('');
  };

  if (selectedMedicine) {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Medicine</label>
        <div className="flex items-center gap-2 p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <Check className="w-5 h-5 text-primary-600" />
          <div className="flex-1">
            <p className="font-medium text-primary-900">{selectedMedicine.name}</p>
            <p className="text-xs text-primary-600">{selectedMedicine.medicineId} • {selectedMedicine.category}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-primary-600 hover:bg-primary-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Search Medicine <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Type medicine name to search..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {showDropdown && query.length >= 1 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No medicines found for "{query}"
            </div>
          ) : (
            results.map((medicine) => (
              <button
                key={medicine._id}
                type="button"
                onClick={() => handleSelect(medicine)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{medicine.name}</p>
                  <p className="text-xs text-gray-500">
                    {medicine.medicineId} • {medicine.category} • {medicine.manufacturer || 'N/A'}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className={((medicine.currentStock || 0) <= medicine.reorderLevel ? 'text-orange-600' : 'text-gray-600')}>
                    Stock: {medicine.currentStock || 0}
                  </p>
                  <p className="text-gray-500">
                    {formatMedicinePrice(getMedicineRowPrices(medicine).selling)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function MedicineStockManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const handledMedicineParam = useRef(null);

  const [activeTab, setActiveTab] = useState('all');
  const [medicines, setMedicines] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [expiringStock, setExpiringStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [catalogMedicine, setCatalogMedicine] = useState(null);
  const [showAddStock, setShowAddStock] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);

  const [stockForm, setStockForm] = useState({
    medicineId: '',
    batchNo: '',
    expiryDate: '',
    mfgDate: '',
    quantity: '',
    purchasePrice: '',
    mrp: '',
    sellingPrice: '',
    supplier: '',
  });

  const [formLoading, setFormLoading] = useState(false);
  const [catalogTotal, setCatalogTotal] = useState(0);

  useEffect(() => {
    medicineService.getCatalogTotal().then(setCatalogTotal).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab, searchQuery]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'all') {
        const { medicines: merged, total } = await medicineService.fetchAll({
          search: searchQuery.trim() || undefined,
          includeStock: 'true',
        });
        setMedicines(merged);
        setCatalogTotal(total);
      } else if (activeTab === 'low') {
        const response = await medicineService.stock.getLowStock();
        setLowStock(response.lowStockItems || []);
      } else if (activeTab === 'expiring') {
        const response = await medicineService.stock.getExpiring(90);
        setExpiringStock(response.expiringItems || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStock = async (e) => {
    e.preventDefault();
    
    if (!stockForm.medicineId) {
      toast.error('Please select a medicine first');
      return;
    }
    
    setFormLoading(true);
    try {
      const res = await medicineService.stock.add({
        ...stockForm,
        batchNo: stockForm.batchNo.trim(),
        quantity: Number(stockForm.quantity),
        purchasePrice: Number(stockForm.purchasePrice),
        mrp: Number(stockForm.mrp),
        sellingPrice: Number(stockForm.sellingPrice) || Number(stockForm.mrp),
      });
      toast.success(res.message || 'Stock added successfully!');
      setShowAddStock(false);
      setStockForm({
        medicineId: '',
        batchNo: '',
        expiryDate: '',
        mfgDate: '',
        quantity: '',
        purchasePrice: '',
        mrp: '',
        sellingPrice: '',
        supplier: '',
      });
      setSelectedMedicine(null);
      fetchData();
    } catch (error) {
      toast.error(error.error || 'Failed to add stock');
    } finally {
      setFormLoading(false);
    }
  };

  const openAddStock = (medicine = null) => {
    if (medicine) {
      setSelectedMedicine(medicine);
      const { purchase, selling } = getMedicineRowPrices(medicine);
      const sellingStr = selling != null && selling !== '' ? String(selling) : '';
      const purchaseStr = purchase != null && purchase !== '' ? String(purchase) : '';
      setStockForm((prev) => ({
        ...prev,
        medicineId: medicine._id,
        purchasePrice: purchaseStr,
        sellingPrice: sellingStr,
        mrp: sellingStr,
      }));
    }
    setShowAddStock(true);
  };

  useEffect(() => {
    const medicineId = searchParams.get('medicine');
    if (!medicineId || handledMedicineParam.current === medicineId) return;

    handledMedicineParam.current = medicineId;

    (async () => {
      try {
        const response = await medicineService.getById(medicineId, true);
        const medicine = response.medicine;
        if (medicine) {
          openAddStock(medicine);
        } else {
          toast.error('Medicine not found');
        }
      } catch (error) {
        console.error('Failed to load medicine for add stock:', error);
        toast.error(error.error || 'Could not load medicine');
      } finally {
        setSearchParams({}, { replace: true });
        handledMedicineParam.current = null;
      }
    })();
  }, [searchParams, setSearchParams]);

  const openCatalogModal = (row = null) => {
    setCatalogMedicine(row);
    setCatalogModalOpen(true);
  };

  const medicineColumns = [
    {
      key: 'name',
      title: 'Medicine',
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-gray-500">{row.medicineId}</p>
        </div>
      ),
    },
    { key: 'category', title: 'Category', render: (val) => <span className="capitalize">{val}</span> },
    { key: 'manufacturer', title: 'Manufacturer' },
    {
      key: 'purchasePrice',
      title: 'Purchase',
      render: (_, row) => formatMedicinePrice(getMedicineRowPrices(row).purchase),
    },
    {
      key: 'sellingPrice',
      title: 'Sale / MRP',
      render: (_, row) => formatMedicinePrice(getMedicineRowPrices(row).selling),
    },
    {
      key: 'currentStock',
      title: 'Stock',
      render: (val, row) => (
        <span className={val <= row.reorderLevel ? 'text-orange-600 font-medium' : ''}>
          {val || 0} {row.packUnit}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (_, row) => {
        const stock = row.currentStock || 0;
        if (stock === 0) return <Badge variant="danger">Out of Stock</Badge>;
        if (stock <= row.reorderLevel) return <Badge variant="warning">Low Stock</Badge>;
        return <Badge variant="success">In Stock</Badge>;
      },
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => openCatalogModal(row)} icon={Pencil}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openAddStock(row)}>
            Add Stock
          </Button>
          <MedicineDeleteButton
            medicine={row}
            variant="button"
            onDeleted={fetchData}
          />
        </div>
      ),
    },
  ];

  const lowStockColumns = [
    {
      key: 'name',
      title: 'Medicine',
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-gray-500">{row.medicineId}</p>
        </div>
      ),
    },
    { key: 'category', title: 'Category' },
    {
      key: 'currentStock',
      title: 'Current Stock',
      render: (val) => <span className="text-orange-600 font-medium">{val}</span>,
    },
    { key: 'reorderLevel', title: 'Reorder Level' },
    {
      key: 'deficit',
      title: 'Deficit',
      render: (val) => <span className="text-red-600 font-medium">-{val}</span>,
    },
    {
      key: 'actions',
      title: '',
      render: (_, row) => (
        <Button variant="primary" size="sm" onClick={() => openAddStock(row)}>
          Order Stock
        </Button>
      ),
    },
  ];

  const expiringColumns = [
    {
      key: 'medicine',
      title: 'Medicine',
      render: (val) => (
        <div>
          <p className="font-medium">{val?.name}</p>
          <p className="text-xs text-gray-500">{val?.medicineId}</p>
        </div>
      ),
    },
    { key: 'batchNo', title: 'Batch No' },
    { key: 'currentQty', title: 'Quantity' },
    {
      key: 'expiryDate',
      title: 'Expiry Date',
      render: (val) => new Date(val).toLocaleDateString(),
    },
    {
      key: 'daysToExpiry',
      title: 'Days Left',
      render: (val, row) => (
        <span className={row.isExpired ? 'text-red-600 font-medium' : val <= 30 ? 'text-orange-600' : ''}>
          {row.isExpired ? 'EXPIRED' : `${val} days`}
        </span>
      ),
    },
    {
      key: 'stockValue',
      title: 'Value at Risk',
      render: (val) => <span className="font-medium">₹{val?.toFixed(2)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicine Stock</h1>
          <p className="text-gray-500">Manage medicines and inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openCatalogModal()} icon={Plus}>
            Add Medicine
          </Button>
          <Button onClick={() => openAddStock()} icon={Plus}>
            Add Stock
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('all')}>
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{searchQuery.trim() ? medicines.length : catalogTotal}</p>
            <p className="text-sm text-gray-500">
              {searchQuery.trim() ? 'Matching medicines' : 'Total Medicines'}
            </p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('low')}>
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">{lowStock.length}</p>
            <p className="text-sm text-gray-500">Low Stock Items</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('expiring')}>
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{expiringStock.length}</p>
            <p className="text-sm text-gray-500">Expiring Soon</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {[
          { id: 'all', label: 'All Medicines' },
          { id: 'low', label: 'Low Stock' },
          { id: 'expiring', label: 'Expiring Soon' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab === 'all' && (
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search medicines..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <Table
        columns={
          activeTab === 'all' ? medicineColumns :
          activeTab === 'low' ? lowStockColumns :
          expiringColumns
        }
        data={
          activeTab === 'all' ? medicines :
          activeTab === 'low' ? lowStock :
          expiringStock
        }
        loading={loading}
        emptyMessage={
          activeTab === 'all' ? 'No medicines found' :
          activeTab === 'low' ? 'No low stock items' :
          'No expiring items'
        }
      />

      <MedicineCatalogModal
        isOpen={catalogModalOpen}
        onClose={() => {
          setCatalogModalOpen(false);
          setCatalogMedicine(null);
        }}
        medicine={catalogMedicine}
        onSaved={fetchData}
      />

      {/* Add Stock Modal */}
      <Modal
        isOpen={showAddStock}
        onClose={() => {
          setShowAddStock(false);
          setSelectedMedicine(null);
          setStockForm((p) => ({ ...p, medicineId: '' }));
        }}
        title={selectedMedicine ? `Add Stock - ${selectedMedicine.name}` : 'Add Stock'}
        size="lg"
      >
        <form onSubmit={handleAddStock} className="space-y-4">
          <MedicineSearch
            value={stockForm.medicineId}
            onChange={(val) => setStockForm((p) => ({ ...p, medicineId: val }))}
            onSelect={(medicine) => {
              if (medicine) {
                setSelectedMedicine(medicine);
                const { purchase, selling } = getMedicineRowPrices(medicine);
                const sellingStr = selling != null && selling !== '' ? String(selling) : '';
                const purchaseStr = purchase != null && purchase !== '' ? String(purchase) : '';
                setStockForm((p) => ({
                  ...p,
                  medicineId: medicine._id,
                  purchasePrice: purchaseStr,
                  sellingPrice: sellingStr,
                  mrp: sellingStr,
                }));
              } else {
                setSelectedMedicine(null);
                setStockForm((p) => ({ ...p, medicineId: '' }));
              }
            }}
            selectedMedicine={selectedMedicine}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Batch Number"
              value={stockForm.batchNo}
              onChange={(e) => setStockForm((p) => ({ ...p, batchNo: e.target.value }))}
              required
              placeholder="e.g., BAT2024001"
            />
            <Input
              label="Quantity"
              type="number"
              value={stockForm.quantity}
              onChange={(e) => setStockForm((p) => ({ ...p, quantity: e.target.value }))}
              required
              min="1"
            />
            <Input
              label="Expiry Date"
              type="date"
              value={stockForm.expiryDate}
              onChange={(e) => setStockForm((p) => ({ ...p, expiryDate: e.target.value }))}
              required
            />
            <Input
              label="Mfg Date"
              type="date"
              value={stockForm.mfgDate}
              onChange={(e) => setStockForm((p) => ({ ...p, mfgDate: e.target.value }))}
            />
            <Input
              label="Purchase Price (₹)"
              type="number"
              value={stockForm.purchasePrice}
              onChange={(e) => setStockForm((p) => ({ ...p, purchasePrice: e.target.value }))}
              required
              min="0"
              step="0.01"
            />
            <Input
              label="MRP (₹)"
              type="number"
              value={stockForm.mrp}
              onChange={(e) => setStockForm((p) => ({ ...p, mrp: e.target.value }))}
              required
              min="0"
              step="0.01"
            />
            <Input
              label="Selling Price (₹)"
              type="number"
              value={stockForm.sellingPrice}
              onChange={(e) => setStockForm((p) => ({ ...p, sellingPrice: e.target.value }))}
              placeholder="Leave empty for MRP"
              min="0"
              step="0.01"
            />
            <Input
              label="Supplier"
              value={stockForm.supplier}
              onChange={(e) => setStockForm((p) => ({ ...p, supplier: e.target.value }))}
              placeholder="Supplier name"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAddStock(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Add Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
