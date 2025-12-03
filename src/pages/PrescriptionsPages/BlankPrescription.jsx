import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui';
import { appointmentService } from '../../services';
import { useClinic } from '../../context/ClinicContext';
import '../../components/print/PrintStyles.css';

export default function BlankPrescription() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printRef = useRef();
  const { settings } = useClinic();

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);

  const appointmentId = searchParams.get('appointmentId');

  useEffect(() => {
    if (appointmentId) {
      fetchAppointment();
    } else {
      setLoading(false);
    }
  }, [appointmentId]);

  const fetchAppointment = async () => {
    try {
      const response = await appointmentService.getById(appointmentId);
      setAppointment(response.appointment);
    } catch (error) {
      console.error('Failed to fetch appointment:', error);
      toast.error('Failed to load appointment data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Prescription-${appointment?.patient?.name || 'Blank'}`,
  });

  const formatDate = (date) => {
    return new Date(date || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const patient = appointment?.patient;
  const doctor = appointment?.doctor;

  return (
    <div>
      {/* Controls - Hidden when printing */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Blank Prescription</h1>
            <p className="text-gray-500">Print blank prescription for manual writing</p>
          </div>
        </div>
        <Button onClick={handlePrint} icon={Printer}>
          Print Prescription
        </Button>
      </div>

      {/* Print Preview */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div ref={printRef}>
          <div className="blank-prescription-page">
            {/* Header Image */}
            <header className="blank-prescription-header">
              <img 
                src="/bill-header.png" 
                alt="Clinic Header" 
                className="header-image"
                onError={(e) => {
                  // Fallback to text header if image not found
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              {/* Fallback Text Header (hidden by default) */}
              <div className="fallback-header" style={{ display: 'none' }}>
                <div className="header-left">
                  <h1 className="clinic-name-large">{settings?.clinicName || 'Clinic Name'}</h1>
                  {settings?.tagline && (
                    <p className="clinic-tagline-small">{settings.tagline}</p>
                  )}
                  <div className="clinic-contact">
                    {settings?.address && (
                      <p>
                        {[settings.address.line1, settings.address.line2, settings.address.city]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                    {settings?.phones?.length > 0 && (
                      <p>Phone: {settings.phones.join(', ')}</p>
                    )}
                  </div>
                </div>
                {settings?.logo && (
                  <div className="header-logo">
                    <img src={settings.logo} alt="Logo" />
                  </div>
                )}
              </div>
            </header>

            {/* Patient Info Section */}
            <div className="patient-info-section">
              <div className="patient-info-card">
                <div className="info-row">
                  <div className="info-item">
                    <span className="info-label">Patient ID</span>
                    <span className="info-value">{patient?.patientId || '—'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Patient Name</span>
                    <span className="info-value">{patient?.name || '—'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Age / Gender</span>
                    <span className="info-value">{patient ? `${patient.age} yrs, ${patient.gender}` : '—'}</span>
                  </div>
                </div>
                <div className="info-row">
                  <div className="info-item">
                    <span className="info-label">OPD No.</span>
                    <span className="info-value">{appointment?.appointmentId || '—'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Consultant Doctor</span>
                    <span className="info-value info-value-doctor">{doctor?.name || '—'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Date</span>
                    <span className="info-value">{formatDate(appointment?.appointmentDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Prescription Body */}
            <div className="prescription-body">
              <div className="rx-section">
                <div className="rx-symbol">℞</div>
              </div>
              <div className="prescription-area">
                {/* Clean writing area */}
              </div>
            </div>

            {/* Footer Section */}
            <footer className="prescription-footer">
              <div className="footer-line"></div>
              <div className="footer-content">
                <div className="footer-left">
                  <p className="footer-clinic">{settings?.clinicName}</p>
                  {settings?.address && (
                    <p className="footer-address">
                      {[settings.address.line1, settings.address.line2, settings.address.city, settings.address.state, settings.address.pincode].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="footer-email">Email: aviawellnessclinic@gmail.com</p>
                </div>
                <div className="footer-right">
                  <p className="footer-cta">For Appointments Call</p>
                  <p className="footer-phone">8287012447, 9990270028</p>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>

      {/* Inline Print Styles */}
      <style>{`
        /* ========== PAGE CONTAINER ========== */
        .blank-prescription-page {
          width: 210mm;
          height: 297mm;
          padding: 8mm 0;
          margin: 0 auto;
          background: #ffffff;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          position: relative;
        }

        /* ========== HEADER ========== */
        .blank-prescription-header {
          margin: 0;
          padding: 0;
          width: 100%;
        }

        .blank-prescription-header .header-image {
          width: 100%;
          height: auto;
          display: block;
        }

        .fallback-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px 12mm;
          border-bottom: 3px solid #0f766e;
          background: linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%);
        }

        .header-left { flex: 1; }

        .clinic-name-large {
          font-size: 22pt;
          font-weight: 700;
          color: #0f766e;
          margin: 0 0 4px 0;
        }

        .clinic-tagline-small {
          font-size: 9pt;
          color: #6b7280;
          font-style: italic;
          margin: 0 0 6px 0;
        }

        .clinic-contact {
          font-size: 8pt;
          color: #374151;
          line-height: 1.4;
        }

        .clinic-contact p { margin: 0; }

        .header-logo {
          width: 60px;
          height: 60px;
          margin: 0 16px;
        }

        .header-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        /* ========== PATIENT INFO SECTION ========== */
        .patient-info-section {
          padding: 0 10mm;
          margin-top: 12px;
        }

        .patient-info-card {
          border: 1.5px solid #d1d5db;
          border-radius: 4px;
          overflow: hidden;
          background: #ffffff;
        }

        .info-row {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-item {
          flex: 1;
          padding: 10px 14px;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .info-item:last-child {
          border-right: none;
        }

        .info-label {
          font-size: 7pt;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .info-value {
          font-size: 10pt;
          font-weight: 600;
          color: #1f2937;
        }

        .info-value-doctor {
          color: #0f766e;
        }

        /* ========== PRESCRIPTION BODY ========== */
        .prescription-body {
          flex: 1;
          display: flex;
          padding: 16px 10mm;
          min-height: 195mm;
        }

        .rx-section {
          width: 50px;
          padding-top: 4px;
        }

        .rx-symbol {
          font-size: 36pt;
          font-weight: 700;
          color: #0f766e;
          font-family: 'Times New Roman', serif;
          line-height: 1;
        }

        .prescription-area {
          flex: 1;
          border-left: 2px solid #0f766e;
          margin-left: 12px;
          padding-left: 16px;
        }

        /* ========== FOOTER ========== */
        .prescription-footer {
          margin-top: auto;
          padding: 0 10mm 0;
        }

        .footer-line {
          height: 2px;
          background: linear-gradient(90deg, #0f766e 0%, #14b8a6 50%, #0f766e 100%);
          margin-bottom: 10px;
        }

        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .footer-left {
          font-size: 8pt;
          color: #4b5563;
          line-height: 1.5;
        }

        .footer-left p {
          margin: 0;
        }

        .footer-clinic {
          font-weight: 700;
          color: #0f766e;
          font-size: 10pt;
          margin-bottom: 2px;
        }

        .footer-address {
          max-width: 280px;
        }

        .footer-email {
          color: #374151;
          font-weight: 500;
        }

        .footer-right {
          text-align: right;
          background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
          padding: 8px 14px;
          border-radius: 6px;
          border: 1px solid #99f6e4;
        }

        .footer-cta {
          font-size: 8pt;
          color: #374151;
          font-weight: 500;
          margin: 0 0 2px 0;
        }

        .footer-phone {
          font-size: 11pt;
          color: #0f766e;
          font-weight: 700;
          margin: 0;
          letter-spacing: 0.3px;
        }

        /* ========== PRINT STYLES ========== */
        @media print {
          @page {
            size: A4;
            margin: 8mm 5mm 12mm 5mm;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .blank-prescription-page {
            width: 100%;
            height: 100%;
            min-height: 100vh;
            padding: 0;
            display: flex;
            flex-direction: column;
          }

          .blank-prescription-header {
            margin: 0;
            padding: 0;
          }

          .blank-prescription-header .header-image {
            width: 100%;
          }

          .prescription-body {
            flex: 1;
            min-height: 0;
          }

          .prescription-footer {
            margin-top: auto;
            padding: 0 10mm 2mm;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
