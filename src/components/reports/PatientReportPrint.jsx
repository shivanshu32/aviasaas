import { forwardRef } from 'react';
import Letterhead from '../print/Letterhead';
import { useClinic } from '../../context/ClinicContext';
import './PatientReportPrint.css';

const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const Detail = ({ label, children }) => (
  <div className="report-detail">
    <span>{label}</span>
    <strong>{children || '—'}</strong>
  </div>
);

const PatientReportPrint = forwardRef(({ report, patient, doctor }, ref) => {
  const { settings } = useClinic();
  const address = [
    settings?.address?.line1,
    settings?.address?.line2,
    settings?.address?.city,
    settings?.address?.state,
    settings?.address?.pincode,
  ].filter(Boolean).join(', ') || '254 - A, DG II Block, Delhi, Delhi, New Delhi';
  const phones = settings?.phones?.filter(Boolean)?.length
    ? settings.phones.filter(Boolean)
    : ['8287012447', '9990270028'];

  return (
    <div ref={ref} className="patient-report-document">
      <section className="patient-report-page report-page">
        <Letterhead />

        <div className="report-document-heading">
          <div>
            <p>Medical document</p>
            <h1>{report.title || 'Patient Medical Report'}</h1>
          </div>
          <div className="report-reference">
            <span>Report ID</span>
            <strong>{report.reportId}</strong>
            <small>{formatDate(report.date)}</small>
          </div>
        </div>

        <div className="report-patient-grid">
          <Detail label="Patient name">{patient?.name}</Detail>
          <Detail label="Age / Gender">{patient ? `${patient.age ?? '—'} years / ${patient.gender || '—'}` : ''}</Detail>
          <Detail label="Patient ID">{patient?.patientId}</Detail>
          <Detail label="Phone">{patient?.phone}</Detail>
          <Detail label="Blood group">{patient?.bloodGroup}</Detail>
          <Detail label="Report date">{formatDate(report.date)}</Detail>
        </div>

        <article
          className="report-rich-content"
          dangerouslySetInnerHTML={{ __html: report.content }}
        />

        <div className="report-certification">
          <p>This report has been prepared based on the clinical evaluation and records available at the time of consultation.</p>
          <div className="report-doctor-signature">
            <div className="signature-space" />
            <strong>{doctor?.name || 'Consulting Doctor'}</strong>
            <span>{[doctor?.qualification, doctor?.specialization].filter(Boolean).join(' • ')}</span>
            {doctor?.registrationNo && <small>Reg. No. {doctor.registrationNo}</small>}
          </div>
        </div>

        <footer className="report-clinic-footer">
          <div className="report-clinic-contact">
            <strong>{settings?.clinicName || 'Avia Wellness Clinic'}</strong>
            <span>{address}</span>
            <span><b>Email:</b> {settings?.email || 'aviawellnessclinic@gmail.com'}</span>
          </div>
          <div className="report-appointment-box">
            <span>For Appointments Call</span>
            <strong>{phones.join(', ')}</strong>
          </div>
        </footer>
      </section>
    </div>
  );
});

PatientReportPrint.displayName = 'PatientReportPrint';

export default PatientReportPrint;
