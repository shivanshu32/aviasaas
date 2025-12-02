import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, AlertTriangle, Package, Clock, Loader2, PackageX } from 'lucide-react';
import { medicineService } from '../services';

export default function Inventory() {
  const [tab, setTab] = useState('medicines');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data states
  const [medicines, setMedicines] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [expiringItems, setExpiringItems] = useState([]);
  const [stats, setStats] = useState({
    totalMedicines: 0,
    lowStockCount: 0,
    expiringCount: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Refetch when tab changes
    if (tab === 'medicines') {
      fetchMedicines();
    } else if (tab === 'low-stock') {
      fetchLowStock();
    } else if (tab === 'expiring') {
      fetchExpiring();
    }
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [medicinesRes, lowStockRes, expiringRes] = await Promise.all([
        medicineService.getAll({ includeStock: true, limit: 100 }),
        medicineService.stock.getLowStock(),
        medicineService.stock.getExpiring(90),
      ]);

      setMedicines(medicinesRes.medicines || []);
      setLowStockItems(lowStockRes.medicines || []);
      setExpiringItems(expiringRes.medicines || []);
      
      setStats({
        totalMedicines: medicinesRes.total || medicinesRes.medicines?.length || 0,
        lowStockCount: lowStockRes.medicines?.length || 0,
        expiringCount: expiringRes.medicines?.length || 0,
      });
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicines = async () => {
    try {
      const response = await medicineService.getAll({ 
        includeStock: true, 
        limit: 100,
        search: searchQuery || undefined 
      });
      setMedicines(response.medicines || []);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
    }
  };

  const fetchLowStock = async () => {
    try {
      const response = await medicineService.stock.getLowStock();
      setLowStockItems(response.medicines || []);
    } catch (error) {
      console.error('Failed to fetch low stock:', error);
    }
  };

  const fetchExpiring = async () => {
    try {
      const response = await medicineService.stock.getExpiring(90);
      setExpiringItems(response.medicines || []);
    } catch (error) {
      console.error('Failed to fetch expiring stock:', error);
    }
  };

  // Handle search
  useEffect(() => {
    if (tab === 'medicines') {
      const timer = setTimeout(() => {
        fetchMedicines();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  // Get current data based on tab
  const getCurrentData = () => {
    switch (tab) {
      case 'low-stock':
        return lowStockItems;
      case 'expiring':
        return expiringItems;
      default:
        return medicines;
    }
  };

  const currentData = getCurrentData();

  // Filter data based on search (for low-stock and expiring tabs)
  const filteredData = searchQuery && tab !== 'medicines'
    ? currentData.filter(med => 
        med.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        med.medicineId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentData;

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      month: 'short',
      year: 'numeric',
    });
  };

  const getStockStatus = (medicine) => {
    const stock = medicine.currentStock || 0;
    const minStock = medicine.minStockLevel || 10;
    
    if (stock === 0) return { label: 'Out of Stock', class: 'badge-danger' };
    if (stock <= minStock) return { label: 'Low Stock', class: 'badge-warning' };
    return { label: 'In Stock', class: 'badge-success' };
  };

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (days <= 0) return { label: 'Expired', class: 'text-red-600' };
    if (days <= 30) return { label: `${days}d left`, class: 'text-red-600' };
    if (days <= 90) return { label: `${days}d left`, class: 'text-orange-600' };
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500">Manage medicine stock</p>
        </div>
        <div className="flex gap-2">
          <Link to="/inventory/stock" className="btn-primary w-full sm:w-auto justify-center">
            <Package className="w-4 h-4" />
            Manage Stock
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{loading ? '-' : stats.totalMedicines}</p>
            <p className="text-sm text-gray-500">Total Medicines</p>
          </div>
        </div>
        <button 
          onClick={() => setTab('low-stock')}
          className="card p-4 flex items-center gap-4 hover:ring-2 hover:ring-orange-200 transition-all text-left"
        >
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">{loading ? '-' : stats.lowStockCount}</p>
            <p className="text-sm text-gray-500">Low Stock Items</p>
          </div>
        </button>
        <button 
          onClick={() => setTab('expiring')}
          className="card p-4 flex items-center gap-4 hover:ring-2 hover:ring-red-200 transition-all text-left"
        >
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <Clock className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{loading ? '-' : stats.expiringCount}</p>
            <p className="text-sm text-gray-500">Expiring Soon (90 days)</p>
          </div>
        </button>
      </div>

      {/* Tabs */}
      <div className="card p-1">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'medicines', label: 'All Medicines', shortLabel: 'All' },
            { id: 'low-stock', label: `Low Stock (${stats.lowStockCount})`, shortLabel: `Low (${stats.lowStockCount})` },
            { id: 'expiring', label: `Expiring Soon (${stats.expiringCount})`, shortLabel: `Exp (${stats.expiringCount})` },
          ].map((t) => (
            <button
              key={t.id}
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

      {/* Search */}
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

      {/* Medicines table */}
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
          <div className="overflow-x-auto">
          <table className="table min-w-[700px]">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Category</th>
                <th>Stock</th>
                <th>MRP</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((med) => {
                const status = getStockStatus(med);
                const expiryStatus = getExpiryStatus(med.nearestExpiry || med.expiryDate);
                
                return (
                  <tr key={med._id}>
                    <td>
                      <div>
                        <p className="font-medium">{med.name}</p>
                        <p className="text-sm text-gray-500">{med.medicineId}</p>
                      </div>
                    </td>
                    <td className="capitalize">{med.category || '-'}</td>
                    <td className={status.class.includes('warning') || status.class.includes('danger') ? 'text-orange-600 font-medium' : ''}>
                      {med.currentStock || 0} {med.unit || 'units'}
                    </td>
                    <td>₹{med.mrp?.toFixed(2) || '-'}</td>
                    <td>
                      <div>
                        <span className={expiryStatus?.class || 'text-gray-500'}>
                          {formatDate(med.nearestExpiry || med.expiryDate)}
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
                      <div className="flex items-center gap-2">
                        <Link 
                          to={`/inventory/stock?medicine=${med._id}`}
                          className="text-sm text-green-600 hover:text-green-700"
                        >
                          Add Stock
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
