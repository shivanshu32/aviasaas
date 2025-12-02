import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Loader2 } from 'lucide-react';
import { doctorService } from '../services';

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const response = await doctorService.getAll({ search: searchQuery });
      setDoctors(response.doctors || []);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDoctors();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-500">Manage doctor profiles</p>
        </div>
        <Link to="/doctors/add" className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Doctor
        </Link>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, specialization, or registration..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : doctors.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No doctors found</p>
          <Link to="/doctors/add" className="text-primary-600 hover:underline mt-2 inline-block">
            Add your first doctor
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <div key={doctor._id} className="card p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-xl font-bold text-primary-600">
                    {getInitials(doctor.name)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
                  <p className="text-sm text-gray-500">{doctor.specialization}</p>
                  <p className="text-xs text-gray-400 mt-1">{doctor.qualification}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Registration</span>
                  <span className="font-medium">{doctor.registrationNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Consultation Fee</span>
                  <span className="font-medium">₹{doctor.consultationFee}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className={doctor.isActive ? 'badge-success' : 'badge-error'}>
                    {doctor.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link to={`/doctors/${doctor._id}/edit`} className="btn-secondary flex-1 text-sm text-center">
                  Edit
                </Link>
                <button className="btn-primary flex-1 text-sm">View Schedule</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
