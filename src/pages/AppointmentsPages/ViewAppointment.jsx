import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, User, Stethoscope, 
  UserCheck, XCircle, FileText, Play, CheckCircle, Receipt, Printer 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card } from '../../components/ui';
import { appointmentService } from '../../services';

export default function ViewAppointment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchAppointment();
  }, [id]);

  const fetchAppointment = async () => {
    try {
      const response = await appointmentService.getById(id);
      setAppointment(response.appointment);
    } catch (error) {
      console.error('Failed to fetch appointment:', error);
      toast.error('Failed to load appointment');
      navigate('/appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    // Check if trying to complete without bill
    if (newStatus === 'completed' && !appointment.billing?.hasBill) {
      toast.error('Please generate bill before marking appointment as completed');
      return;
    }

    setUpdating(true);
    try {
      await appointmentService.update(id, { status: newStatus });
      setAppointment((prev) => ({ ...prev, status: newStatus }));
      toast.success(`Appointment ${newStatus === 'checked-in' ? 'checked in' : 'updated'} successfully`);
    } catch (error) {
      console.error('Failed to update appointment:', error);
      toast.error('Failed to update appointment');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'checked-in': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no-show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Appointment not found</p>
        <Button onClick={() => navigate('/appointments')} className="mt-4">
          Back to Appointments
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/appointments')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Appointments"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Appointment Details
            </h1>
            <p className="text-gray-500">
              {appointment.appointmentId} • Token #{appointment.tokenNo}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(appointment.status)}`}>
          {appointment.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appointment Info */}
        <Card title="Appointment Information">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">{formatDate(appointment.appointmentDate)}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium capitalize">{appointment.type}</p>
            </div>
            {appointment.symptoms && (
              <div>
                <p className="text-sm text-gray-500">Symptoms</p>
                <p className="font-medium">{appointment.symptoms}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Patient Info */}
        <Card title="Patient Information">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold text-lg">{appointment.patient?.name || 'N/A'}</p>
                <p className="text-sm text-gray-500">{appointment.patient?.patientId}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Age / Gender</p>
                <p className="font-medium">
                  {appointment.patient?.age} years / {appointment.patient?.gender}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{appointment.patient?.phone}</p>
              </div>
            </div>
            <Link
              to={`/patients/${appointment.patient?._id}`}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View Patient Profile →
            </Link>
          </div>
        </Card>

        {/* Doctor Info */}
        <Card title="Doctor Information">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-lg">{appointment.doctor?.name || 'N/A'}</p>
                <p className="text-sm text-gray-500">{appointment.doctor?.specialization}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Doctor ID</p>
              <p className="font-medium">{appointment.doctor?.doctorId}</p>
            </div>
          </div>
        </Card>

        {/* Vitals (if checked-in or beyond) */}
        {appointment.vitals && (
          <Card title="Vitals">
            <div className="grid grid-cols-2 gap-4">
              {appointment.vitals.bp && (
                <div>
                  <p className="text-sm text-gray-500">Blood Pressure</p>
                  <p className="font-medium">{appointment.vitals.bp}</p>
                </div>
              )}
              {appointment.vitals.pulse && (
                <div>
                  <p className="text-sm text-gray-500">Pulse</p>
                  <p className="font-medium">{appointment.vitals.pulse} bpm</p>
                </div>
              )}
              {appointment.vitals.temperature && (
                <div>
                  <p className="text-sm text-gray-500">Temperature</p>
                  <p className="font-medium">{appointment.vitals.temperature}°F</p>
                </div>
              )}
              {appointment.vitals.weight && (
                <div>
                  <p className="text-sm text-gray-500">Weight</p>
                  <p className="font-medium">{appointment.vitals.weight} kg</p>
                </div>
              )}
              {appointment.vitals.spo2 && (
                <div>
                  <p className="text-sm text-gray-500">SpO2</p>
                  <p className="font-medium">{appointment.vitals.spo2}%</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-3">
        {appointment.status === 'scheduled' && (
          <>
            <Button
              variant="danger"
              icon={XCircle}
              onClick={() => handleStatusUpdate('cancelled')}
              loading={updating}
            >
              Cancel Appointment
            </Button>
            <Button
              variant="primary"
              icon={UserCheck}
              onClick={() => handleStatusUpdate('checked-in')}
              loading={updating}
            >
              Check-in Patient
            </Button>
          </>
        )}
        {appointment.status === 'checked-in' && (
          <>
            <Button
              variant="secondary"
              icon={Play}
              onClick={() => handleStatusUpdate('in-progress')}
              loading={updating}
            >
              Start Consultation
            </Button>
            <Link to={`/prescriptions/blank?appointmentId=${appointment._id}`}>
              <Button variant="outline" icon={Printer}>
                Print Blank Prescription
              </Button>
            </Link>
            <Link to={`/billing/opd/new?appointmentId=${appointment._id}`}>
              <Button icon={Receipt}>
                Generate OPD Bill
              </Button>
            </Link>
          </>
        )}
        {appointment.status === 'in-progress' && (
          <>
            <Link to={`/prescriptions/blank?appointmentId=${appointment._id}`}>
              <Button variant="outline" icon={Printer}>
                Print Blank Prescription
              </Button>
            </Link>
            <Link to={`/billing/opd/new?appointmentId=${appointment._id}`}>
              <Button variant="secondary" icon={Receipt}>
                Generate OPD Bill
              </Button>
            </Link>
            <Button
              variant="success"
              icon={CheckCircle}
              onClick={() => handleStatusUpdate('completed')}
              loading={updating}
            >
              Mark as Completed
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
