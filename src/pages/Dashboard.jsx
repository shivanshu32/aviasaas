import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  Receipt, 
  Package,
  Clock,
  Loader2,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Play,
  CheckCircle,
  XCircle,
  UserCheck,
  Eye,
  Printer,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { patientService, appointmentService, billingService, medicineService } from '../services';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    todayRevenue: 0,
    lowStockItems: 0,
  });
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch all data in parallel
      const [patientsRes, appointmentsRes, opdBillsRes, medicineBillsRes, lowStockRes] = await Promise.all([
        patientService.getAll({ limit: 1 }),
        appointmentService.getAll({ date: today, limit: 50 }),
        billingService.opd.getAll({ startDate: today, endDate: today }),
        billingService.medicine.getAll({ startDate: today, endDate: today }),
        medicineService.stock.getLowStock(),
      ]);

      const opdRevenue = (opdBillsRes.bills || []).reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      const medicineRevenue = (medicineBillsRes.bills || []).reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      const todayRevenue = opdRevenue + medicineRevenue;

      setStats({
        totalPatients: patientsRes.pagination?.total || 0,
        todayAppointments: appointmentsRes.pagination?.total || appointmentsRes.appointments?.length || 0,
        todayRevenue: todayRevenue,
        lowStockItems: lowStockRes.medicines?.length || 0,
      });

      setAppointments(appointmentsRes.appointments || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await appointmentService.getAll({ date: selectedDate, limit: 50 });
      setAppointments(res.appointments || []);
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
    }
  };

  const handleStatusUpdate = async (appointmentId, newStatus, hasBill = false) => {
    // Check if trying to complete without bill
    if (newStatus === 'completed' && !hasBill) {
      toast.error('Please generate bill before marking appointment as completed');
      return;
    }

    setUpdatingId(appointmentId);
    try {
      await appointmentService.update(appointmentId, { status: newStatus });
      setAppointments(prev => prev.map(apt => 
        apt._id === appointmentId ? { ...apt, status: newStatus } : apt
      ));
      toast.success(`Appointment ${newStatus === 'cancelled' ? 'cancelled' : 'updated'} successfully`);
    } catch (error) {
      console.error('Failed to update appointment:', error);
      toast.error('Failed to update appointment');
    } finally {
      setUpdatingId(null);
    }
  };

  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in-progress': return 'bg-blue-100 text-blue-700';
      case 'checked-in': return 'bg-yellow-100 text-yellow-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'scheduled': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDisplayDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return 'Today';
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const STATUS_TABS = [
    { key: 'all', label: 'All' },
    { key: 'scheduled', label: 'Upcoming' },
    { key: 'checked-in', label: 'Checked-in' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ];

  const filteredAppointments = activeTab === 'all' 
    ? appointments 
    : appointments.filter(apt => apt.status === activeTab);

  const getNextAction = (status) => {
    switch (status) {
      case 'scheduled': return { action: 'checked-in', label: 'Check-in', icon: UserCheck, color: 'text-yellow-600 hover:bg-yellow-50' };
      case 'checked-in': return { action: 'in-progress', label: 'Start', icon: Play, color: 'text-blue-600 hover:bg-blue-50' };
      case 'in-progress': return { action: 'completed', label: 'Complete', icon: CheckCircle, color: 'text-green-600 hover:bg-green-50' };
      default: return null;
    }
  };

  const statsConfig = [
    { label: 'Total Patients', value: stats.totalPatients.toLocaleString(), icon: Users, color: 'bg-blue-500' },
    { label: "Today's Appointments", value: stats.todayAppointments, icon: Calendar, color: 'bg-green-500' },
    { label: "Today's Revenue", value: formatCurrency(stats.todayRevenue), icon: Receipt, color: 'bg-purple-500' },
    { label: 'Low Stock Items', value: stats.lowStockItems, icon: Package, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions - Moved to top */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link 
          to="/patients/add" 
          className="p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors text-left group"
        >
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Users className="w-5 h-5 text-white" />
          </div>
          <p className="font-semibold text-gray-900">New Patient</p>
          <p className="text-sm text-gray-500">Register patient</p>
        </Link>
        <Link 
          to="/appointments/book" 
          className="p-4 bg-green-50 border border-green-100 rounded-xl hover:bg-green-100 transition-colors text-left group"
        >
          <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <p className="font-semibold text-gray-900">Book Appointment</p>
          <p className="text-sm text-gray-500">Schedule visit</p>
        </Link>
        <Link 
          to="/billing/opd/new" 
          className="p-4 bg-purple-50 border border-purple-100 rounded-xl hover:bg-purple-100 transition-colors text-left group"
        >
          <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <p className="font-semibold text-gray-900">New Bill</p>
          <p className="text-sm text-gray-500">Create invoice</p>
        </Link>
        <Link 
          to="/inventory/stock" 
          className="p-4 bg-orange-50 border border-orange-100 rounded-xl hover:bg-orange-100 transition-colors text-left group"
        >
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Package className="w-5 h-5 text-white" />
          </div>
          <p className="font-semibold text-gray-900">Add Stock</p>
          <p className="text-sm text-gray-500">Update inventory</p>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsConfig.map((stat) => (
          <div key={stat.label} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {loading ? <span className="text-gray-300">-</span> : stat.value}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Appointments Section - Full Width */}
      <div className="card">
        {/* Header with Date Navigation */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-500" />
              Appointments
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2 sm:px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-[130px] sm:w-auto"
                />
                <span className="hidden sm:inline text-sm font-medium text-gray-700 min-w-[80px]">
                  {formatDisplayDate(selectedDate)}
                </span>
              </div>
              <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="ml-1 sm:ml-2 px-2 sm:px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
              >
                Today
              </button>
            </div>
          </div>

          {/* Status Tabs - Scrollable on mobile */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
            {STATUS_TABS.map((tab) => {
              const count = tab.key === 'all' ? appointments.length : appointments.filter(a => a.status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.key
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Appointments List */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-8">
              <CalendarX className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No {activeTab !== 'all' ? activeTab : ''} appointments</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAppointments.map((apt) => {
                const nextAction = getNextAction(apt.status);
                const isUpdating = updatingId === apt._id;
                return (
                  <div key={apt._id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors gap-3">
                    {/* Patient Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-primary-600">
                          {getInitials(apt.patient?.name)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{apt.patient?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {apt.doctor?.name || 'No doctor'} • Token #{apt.tokenNo || '-'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Status & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 pl-13 sm:pl-0">
                      {/* Status Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {apt.billing?.hasBill ? (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            apt.billing.paymentStatus === 'paid' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {apt.billing.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                            No Bill
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(apt.status)}`}>
                          {apt.status?.replace('-', ' ')}
                        </span>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        {nextAction && apt.status !== 'completed' && apt.status !== 'cancelled' && (
                          <button
                            onClick={() => handleStatusUpdate(apt._id, nextAction.action, apt.billing?.hasBill)}
                            disabled={isUpdating}
                            className={`p-1.5 rounded-lg transition-colors ${nextAction.color} ${isUpdating ? 'opacity-50' : ''}`}
                            title={nextAction.label}
                          >
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <nextAction.icon className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                          <button
                            onClick={() => handleStatusUpdate(apt._id, 'cancelled')}
                            disabled={isUpdating}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            title="Cancel"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          to={`/prescriptions/blank?appointmentId=${apt._id}`}
                          className="p-1.5 rounded-lg text-orange-500 hover:bg-orange-50 transition-colors"
                          title="Print Blank Prescription"
                        >
                          <Printer className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/prescriptions/generate?appointmentId=${apt._id}`}
                          className="p-1.5 rounded-lg text-purple-500 hover:bg-purple-50 transition-colors"
                          title="Digital Prescription"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/appointments/${apt._id}`}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link 
            to="/appointments" 
            className="block w-full mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium text-center"
          >
            View all appointments →
          </Link>
        </div>
      </div>

    </div>
  );
}
