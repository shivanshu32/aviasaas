import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { patientService } from '../services';
import { format } from 'date-fns';

export default function Patients() {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const fetchPatients = async (page = 1) => {
    setLoading(true);
    try {
      const response = await patientService.getAll({
        search: searchQuery,
        page,
        limit: pagination.limit,
      });
      setPatients(response.patients || []);
      setPagination(response.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Failed to fetch patients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(1);
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500">Manage patient records</p>
        </div>
        <Link to="/patients/add" className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Patient
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <button className="btn-secondary">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Patients table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : patients.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No patients found</p>
            <Link to="/patients/add" className="text-primary-600 hover:underline mt-2 inline-block">
              Add your first patient
            </Link>
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Name</th>
                  <th>Age/Gender</th>
                  <th>Phone</th>
                  <th>Registered On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient._id}>
                    <td className="font-medium text-primary-600">{patient.patientId}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {getInitials(patient.name)}
                          </span>
                        </div>
                        <span className="font-medium">{patient.name}</span>
                      </div>
                    </td>
                    <td>{patient.age} / {patient.gender}</td>
                    <td>{patient.phone}</td>
                    <td className="text-gray-500">
                      {patient.createdAt ? format(new Date(patient.createdAt), 'dd MMM yyyy') : '-'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link 
                          to={`/patients/${patient._id}`} 
                          className="text-sm text-primary-600 hover:text-primary-700"
                        >
                          View
                        </Link>
                        <Link 
                          to={`/patients/${patient._id}/edit`} 
                          className="text-sm text-gray-600 hover:text-gray-700"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} patients
              </p>
              <div className="flex items-center gap-2">
                <button 
                  className="btn-secondary text-sm py-1.5"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchPatients(pagination.page - 1)}
                >
                  Previous
                </button>
                <button 
                  className="btn-primary text-sm py-1.5"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchPatients(pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
