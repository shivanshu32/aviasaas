import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Calendar, List, ChevronLeft, ChevronRight, Eye, UserCheck, History } from 'lucide-react';
import { appointmentService, doctorService } from '../services';
import toast from 'react-hot-toast';

export default function Appointments() {
  const [view, setView] = useState('list');
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchDoctors();
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [selectedDoctor, currentDate, showAllHistory, page]);

  const fetchDoctors = async () => {
    try {
      const response = await doctorService.getAll({ isActive: true });
      setDoctors(response.doctors || []);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      
      if (!showAllHistory) {
        const dateStr = currentDate.toISOString().split('T')[0];
        params.date = dateStr;
      } else {
        params.page = page;
      }
      
      if (selectedDoctor) {
        params.doctorId = selectedDoctor;
      }
      
      const response = await appointmentService.getAll(params);
      setAppointments(response.appointments || []);
      
      if (response.pagination) {
        setTotalPages(Math.ceil(response.pagination.total / 50));
      }
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (days) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in-progress': return 'primary';
      case 'checked-in': return 'warning';
      case 'cancelled': return 'danger';
      case 'no-show': return 'danger';
      default: return 'gray';
    }
  };

  const handleCheckIn = async (appointmentId) => {
    try {
      await appointmentService.update(appointmentId, { status: 'checked-in' });
      toast.success('Patient checked in successfully');
      // Update local state
      setAppointments((prev) =>
        prev.map((apt) =>
          apt._id === appointmentId ? { ...apt, status: 'checked-in' } : apt
        )
      );
    } catch (error) {
      console.error('Failed to check-in:', error);
      toast.error('Failed to check-in patient');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500">Schedule and manage appointments</p>
        </div>
        <Link to="/appointments/book" className="btn-primary w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" />
          Book Appointment
        </Link>
      </div>

      {/* View toggle and date navigation */}
      <div className="card p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => { setShowAllHistory(false); setView('list'); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  !showAllHistory && view === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                }`}
                title="Daily View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowAllHistory(false); setView('calendar'); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  !showAllHistory && view === 'calendar' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                }`}
                title="Calendar View"
              >
                <Calendar className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowAllHistory(true); setPage(1); }}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  showAllHistory ? 'bg-white shadow text-gray-900' : 'text-gray-600'
                }`}
                title="All History"
              >
                <History className="w-4 h-4" />
              </button>
            </div>
            <select 
              className="input w-full sm:w-48"
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
            >
              <option value="">All Doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Date navigation - only show when not in history mode */}
          {!showAllHistory ? (
            <div className="flex items-center gap-2">
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => handleDateChange(-1)}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="font-medium min-w-[180px] text-center">{formatDate(currentDate)}</span>
                {currentDate.toDateString() !== new Date().toDateString() && (
                  <button 
                    className="px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg"
                    onClick={() => setCurrentDate(new Date())}
                  >
                    Today
                  </button>
                )}
              </div>
              <button 
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => handleDateChange(1)}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Showing all appointment history</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button 
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm">{page} / {totalPages}</span>
                  <button 
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Appointments list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No appointments found for this date</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
        <table className="table min-w-[700px]">
            <thead>
              <tr>
                {showAllHistory && <th>Date</th>}
                <th>Time</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((apt) => (
                <tr key={apt._id}>
                  {showAllHistory && (
                    <td className="text-sm text-gray-600">
                      {apt.appointmentDate ? new Date(apt.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                  )}
                  <td className="font-medium">{apt.timeSlot?.start ? formatTime(apt.timeSlot.start) : '-'}</td>
                  <td>
                    <div>
                      <p className="font-medium">{apt.patient?.name || 'N/A'}</p>
                      <p className="text-sm text-gray-500">
                        {apt.patient?.age}/{apt.patient?.gender?.charAt(0)} • {apt.patient?.phone}
                      </p>
                    </div>
                  </td>
                  <td>{apt.doctor?.name || 'N/A'}</td>
                  <td>
                    <span className="badge-gray capitalize">{apt.type}</span>
                  </td>
                  <td>
                    <span className={`badge-${getStatusColor(apt.status)} capitalize`}>
                      {apt.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link 
                        to={`/appointments/${apt._id}`}
                        className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Link>
                      {apt.status === 'scheduled' && (
                        <button 
                          className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                          onClick={() => handleCheckIn(apt._id)}
                        >
                          <UserCheck className="w-4 h-4" />
                          Check-in
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
