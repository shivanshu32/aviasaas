import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Edit, Phone, Mail, MapPin, AlertCircle, Loader2,
  Calendar, FileText, Receipt, Pill, Plus, Eye, User,
  Droplets, Heart, AlertTriangle, Printer, FlaskConical
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
  const [billSubTab, setBillSubTab] = useState('opd');
  
  // Related data
  const [appointments, setAppointments] = useState([]);
  const [opdBills, setOpdBills] = useState([]);
  const [miscBills, setMiscBills] = useState([]);
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
          const [opdRes, miscRes, medRes] = await Promise.all([
            billingService.opd.getAll({ patientId: patient._id, limit: 100 }),
            billingService.misc.getAll({ patientId: patient._id, limit: 100 }),
            billingService.medicine.getAll({ patientId: patient._id, limit: 100 }),
          ]);
          setOpdBills(opdRes.bills || []);
          setMiscBills(miscRes.bills || []);
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
                              Token #{apt.tokenNo || '-'}
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
            <Card>
              {/* Bill Sub-tabs */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setBillSubTab('opd')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      billSubTab === 'opd' 
                        ? 'bg-white shadow text-blue-600' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    OPD
                  </button>
                  <button
                    onClick={() => setBillSubTab('misc')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      billSubTab === 'misc' 
                        ? 'bg-white shadow text-purple-600' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FlaskConical className="w-4 h-4" />
                    Lab/Misc
                  </button>
                  <button
                    onClick={() => setBillSubTab('medicine')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      billSubTab === 'medicine' 
                        ? 'bg-white shadow text-green-600' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Pill className="w-4 h-4" />
                    Medicine
                  </button>
                </div>
                <Link to={`/billing/${billSubTab}/new?patientId=${patient._id}`}>
                  <Button size="sm" icon={Plus}>New Bill</Button>
                </Link>
              </div>

              {/* OPD Bills */}
              {billSubTab === 'opd' && (
                <>
                  {dataLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                    </div>
                  ) : opdBills.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium text-gray-400">No OPD bills found</p>
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
                            <th className="text-left py-3 px-3 font-medium text-gray-600">Actions</th>
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
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/billing/opd/${bill._id}`}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                                    title="View & Print"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Lab/Misc Bills */}
              {billSubTab === 'misc' && (
                <>
                  {dataLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                    </div>
                  ) : miscBills.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium text-gray-400">No Lab/Misc bills found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left py-3 px-3 font-medium text-gray-600">Bill No</th>
                            <th className="text-left py-3 px-3 font-medium text-gray-600">Date</th>
                            <th className="text-left py-3 px-3 font-medium text-gray-600">Category</th>
                            <th className="text-right py-3 px-3 font-medium text-gray-600">Amount</th>
                            <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
                            <th className="text-left py-3 px-3 font-medium text-gray-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {miscBills.map((bill) => (
                            <tr key={bill._id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-3 px-3 font-medium text-primary-600">{bill.billNo}</td>
                              <td className="py-3 px-3">{formatDate(bill.billDate)}</td>
                              <td className="py-3 px-3 capitalize">{bill.category || '-'}</td>
                              <td className="py-3 px-3 text-right font-medium">₹{bill.grandTotal?.toFixed(2)}</td>
                              <td className="py-3 px-3">{getStatusBadge(bill.paymentStatus)}</td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/billing/misc/${bill._id}`}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                                    title="View & Print"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Medicine Bills */}
              {billSubTab === 'medicine' && (
                <>
                  {dataLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                    </div>
                  ) : medicineBills.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium text-gray-400">No medicine bills found</p>
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
                            <th className="text-left py-3 px-3 font-medium text-gray-600">Actions</th>
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
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/billing/medicine/${bill._id}`}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                                    title="View & Print"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </Card>
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
