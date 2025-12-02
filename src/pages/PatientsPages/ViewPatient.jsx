import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Phone, Mail, MapPin, AlertCircle, Loader2,
  Calendar, FileText, Receipt, Pill, Plus, Eye, User,
  Stethoscope, ClipboardList, Droplets, Heart, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { Button, Card, Badge } from '../../components/ui';
import { patientService, appointmentService, billingService, prescriptionService } from '../../services';

export default function ViewPatient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('appointments');
  
  // Related data
  const [appointments, setAppointments] = useState([]);
  const [opdBills, setOpdBills] = useState([]);
  const [medicineBills, setMedicineBills] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    const fetchPatient = async () => {
      try {
        const response = await patientService.getById(id);
        setPatient(response.patient);
      } catch (err) {
        setError(err.error || 'Failed to load patient');
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id]);

  // Fetch appointments on initial load
  useEffect(() => {
    if (!patient) return;
    
    const fetchAppointments = async () => {
      try {
        const res = await appointmentService.getAll({ patientId: patient._id, limit: 100 });
        // Sort by date descending (most recent first)
        const sorted = (res.appointments || []).sort((a, b) => 
          new Date(b.appointmentDate) - new Date(a.appointmentDate)
        );
        setAppointments(sorted);
      } catch (err) {
        console.error('Failed to fetch appointments:', err);
      }
    };

    fetchAppointments();
  }, [patient]);

  // Get last visit date
  const lastVisit = appointments.length > 0 
    ? appointments.find(apt => apt.status === 'completed')
    : null;

  // Fetch related data when tab changes
  useEffect(() => {
    if (!patient) return;
    
    const fetchRelatedData = async () => {
      setDataLoading(true);
      try {
        if (activeTab === 'bills' && opdBills.length === 0) {
          const [opdRes, medRes] = await Promise.all([
            billingService.opd.getAll({ patientId: patient._id }),
            billingService.medicine.getAll({ patientId: patient._id }),
          ]);
          setOpdBills(opdRes.bills || []);
          setMedicineBills(medRes.bills || []);
        } else if (activeTab === 'prescriptions' && prescriptions.length === 0) {
          const res = await prescriptionService.getAll({ patientId: patient._id });
          setPrescriptions(res.prescriptions || []);
        }
      } catch (err) {
        console.error('Failed to fetch related data:', err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchRelatedData();
  }, [activeTab, patient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 font-medium">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/patients')} className="mt-4">
            Back to Patients
          </Button>
        </div>
      </div>
    );
  }

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      scheduled: { variant: 'secondary', label: 'Scheduled' },
      confirmed: { variant: 'primary', label: 'Confirmed' },
      'checked-in': { variant: 'warning', label: 'Checked In' },
      'in-progress': { variant: 'primary', label: 'In Progress' },
      completed: { variant: 'success', label: 'Completed' },
      cancelled: { variant: 'danger', label: 'Cancelled' },
      'no-show': { variant: 'danger', label: 'No Show' },
      paid: { variant: 'success', label: 'Paid' },
      partial: { variant: 'warning', label: 'Partial' },
      pending: { variant: 'danger', label: 'Pending' },
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const tabs = [
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'bills', label: 'Bills', icon: Receipt },
    { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/patients')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Patients"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patient Details</h1>
            <p className="text-gray-500">View patient information and history</p>
          </div>
        </div>
        <Link to={`/patients/${id}/edit`}>
          <Button icon={Edit}>Edit Patient</Button>
        </Link>
      </div>

      {/* Two Column Layout */}
      <div className="flex gap-6">
        {/* Left Column - Patient Details (1/3) */}
        <div className="w-1/3 space-y-4">
          {/* Patient Info Card */}
          <Card>
            {/* Avatar and Basic Info */}
            <div className="text-center pb-4 border-b border-gray-100">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <span className="text-2xl font-bold text-white">
                  {getInitials(patient.name)}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{patient.name}</h2>
              <span className="inline-block mt-1 px-3 py-1 bg-primary-100 text-primary-700 text-sm font-medium rounded-full">
                ID: {patient.patientId}
              </span>
            </div>

            {/* Patient Details */}
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Age & Gender</p>
                  <p className="font-medium text-gray-900">{patient.age} years, {patient.gender}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Phone</p>
                  <p className="font-medium text-gray-900">{patient.phone}</p>
                </div>
              </div>

              {patient.email && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Email</p>
                    <p className="font-medium text-gray-900 truncate">{patient.email}</p>
                  </div>
                </div>
              )}

              {patient.bloodGroup && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Blood Group</p>
                    <p className="font-medium text-gray-900">{patient.bloodGroup}</p>
                  </div>
                </div>
              )}

              {patient.address && (patient.address.line1 || patient.address.city) && (
                <div className="flex items-start gap-3 text-sm">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Address</p>
                    <p className="font-medium text-gray-900">
                      {[patient.address.line1, patient.address.city, patient.address.state]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Allergies */}
            {patient.allergies && patient.allergies.length > 0 && (
              <div className="py-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-gray-700">Allergies</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {patient.allergies.map((allergy, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Emergency Contact */}
            {patient.emergencyContact && patient.emergencyContact.name && (
              <div className="py-4 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-pink-500" />
                  <span className="text-sm font-medium text-gray-700">Emergency Contact</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{patient.emergencyContact.name}</p>
                {patient.emergencyContact.relation && (
                  <p className="text-xs text-gray-500">{patient.emergencyContact.relation}</p>
                )}
                {patient.emergencyContact.phone && (
                  <p className="text-sm text-gray-600 mt-1">{patient.emergencyContact.phone}</p>
                )}
              </div>
            )}

            {/* Visit Stats */}
            <div className="py-4 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-600">{appointments.length}</p>
                  <p className="text-xs text-blue-600">Total Visits</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-green-600">
                    {lastVisit ? format(new Date(lastVisit.appointmentDate), 'dd MMM yyyy') : 'No visits'}
                  </p>
                  <p className="text-xs text-green-600">Last Visit</p>
                </div>
              </div>
            </div>

            {/* Registered Date */}
            <div className="pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                Registered on {patient.createdAt ? format(new Date(patient.createdAt), 'dd MMM yyyy') : '-'}
              </p>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2">
              <Link to={`/appointments/book?patientId=${patient._id}`} className="block">
                <button className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors text-left">
                  <Calendar className="w-5 h-5" />
                  <span className="font-medium text-sm">Book Appointment</span>
                </button>
              </Link>
              <Link to={`/billing/opd/new?patientId=${patient._id}`} className="block">
                <button className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors text-left">
                  <Stethoscope className="w-5 h-5" />
                  <span className="font-medium text-sm">OPD Bill</span>
                </button>
              </Link>
              <Link to={`/billing/medicine/new?patientId=${patient._id}`} className="block">
                <button className="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors text-left">
                  <Pill className="w-5 h-5" />
                  <span className="font-medium text-sm">Medicine Bill</span>
                </button>
              </Link>
              <Link to={`/billing/misc/new?patientId=${patient._id}`} className="block">
                <button className="w-full flex items-center gap-3 p-3 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition-colors text-left">
                  <ClipboardList className="w-5 h-5" />
                  <span className="font-medium text-sm">Lab/Misc Bill</span>
                </button>
              </Link>
              <Link to={`/prescriptions/generate?patientId=${patient._id}`} className="block">
                <button className="w-full flex items-center gap-3 p-3 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg transition-colors text-left">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium text-sm">Generate Prescription</span>
                </button>
              </Link>
            </div>
          </Card>
        </div>

        {/* Right Column - Tabs Content (2/3) */}
        <div className="w-2/3">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-white shadow text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'appointments' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Appointments</h3>
                <Link to={`/appointments/book?patientId=${patient._id}`}>
                  <Button size="sm" icon={Plus}>Book Appointment</Button>
                </Link>
              </div>
              {appointments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                  <p className="text-lg font-medium text-gray-400">No appointments found</p>
                  <p className="text-sm text-gray-400 mt-1">Book an appointment to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Date & Time</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Doctor</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Type</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((apt) => (
                        <tr key={apt._id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <p className="font-medium">{formatDate(apt.appointmentDate)}</p>
                            <p className="text-gray-500 text-xs">
                              {typeof apt.timeSlot === 'object' 
                                ? `${apt.timeSlot?.start || ''} - ${apt.timeSlot?.end || ''}` 
                                : apt.timeSlot || '-'}
                            </p>
                          </td>
                          <td className="py-3 px-3">{apt.doctor?.name || '-'}</td>
                          <td className="py-3 px-3 capitalize">{apt.appointmentType}</td>
                          <td className="py-3 px-3">{getStatusBadge(apt.status)}</td>
                          <td className="py-3 px-3">
                            <Link 
                              to={`/appointments/${apt._id}`}
                              className="text-primary-600 hover:text-primary-700"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'bills' && (
            <div className="space-y-4">
              {/* OPD Bills */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">OPD Bills</h3>
                  <Link to={`/billing/opd/new?patientId=${patient._id}`}>
                    <Button size="sm" icon={Plus}>New OPD Bill</Button>
                  </Link>
                </div>
                {dataLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                  </div>
                ) : opdBills.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>No OPD bills found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-3 font-medium text-gray-600">Bill No</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-600">Date</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-600">Doctor</th>
                          <th className="text-right py-3 px-3 font-medium text-gray-600">Amount</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opdBills.map((bill) => (
                          <tr key={bill._id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-3 px-3 font-medium text-primary-600">{bill.billNo}</td>
                            <td className="py-3 px-3">{formatDate(bill.billDate)}</td>
                            <td className="py-3 px-3">{bill.doctor?.name || '-'}</td>
                            <td className="py-3 px-3 text-right font-medium">₹{bill.grandTotal?.toFixed(2)}</td>
                            <td className="py-3 px-3">{getStatusBadge(bill.paymentStatus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Medicine Bills */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Medicine Bills</h3>
                  <Link to={`/billing/medicine/new?patientId=${patient._id}`}>
                    <Button size="sm" icon={Plus}>New Medicine Bill</Button>
                  </Link>
                </div>
                {dataLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                  </div>
                ) : medicineBills.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Pill className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p>No medicine bills found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-3 font-medium text-gray-600">Bill No</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-600">Date</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-600">Items</th>
                          <th className="text-right py-3 px-3 font-medium text-gray-600">Amount</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {medicineBills.map((bill) => (
                          <tr key={bill._id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-3 px-3 font-medium text-primary-600">{bill.billNo}</td>
                            <td className="py-3 px-3">{formatDate(bill.billDate)}</td>
                            <td className="py-3 px-3">
                              {typeof bill.items === 'number' ? `${bill.items} items` : `${bill.items?.length || 0} items`}
                            </td>
                            <td className="py-3 px-3 text-right font-medium">₹{bill.grandTotal?.toFixed(2)}</td>
                            <td className="py-3 px-3">{getStatusBadge(bill.paymentStatus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Prescriptions</h3>
                <Link to={`/prescriptions/generate?patientId=${patient._id}`}>
                  <Button size="sm" icon={Plus}>New Prescription</Button>
                </Link>
              </div>
              {dataLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                  <p className="text-lg font-medium text-gray-400">No prescriptions found</p>
                  <p className="text-sm text-gray-400 mt-1">Generate a prescription to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Prescription ID</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Date</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Doctor</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Diagnosis</th>
                        <th className="text-left py-3 px-3 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescriptions.map((rx) => (
                        <tr key={rx._id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-primary-600">{rx.prescriptionId}</td>
                          <td className="py-3 px-3">{formatDate(rx.prescriptionDate || rx.createdAt)}</td>
                          <td className="py-3 px-3">{rx.doctor?.name || '-'}</td>
                          <td className="py-3 px-3 max-w-xs truncate">{rx.diagnosis || '-'}</td>
                          <td className="py-3 px-3">
                            <button className="text-primary-600 hover:text-primary-700">
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
