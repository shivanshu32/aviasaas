import { forwardRef } from 'react';
import Letterhead from '../print/Letterhead';
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

const PatientReportPrint = forwardRef(({ report, patient, doctor }, ref) => (
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
    </section>

    <section className="patient-report-page prescription-page">
      <Letterhead />

      <div className="blank-rx-title">
        <div>
          <span className="blank-rx-symbol">℞</span>
          <h1>Prescription</h1>
          <p>For handwritten use</p>
        </div>
        <div className="rx-date">Date: <strong>{formatDate(report.date)}</strong></div>
      </div>

      <div className="rx-patient-line">
        <div><span>Patient</span><strong>{patient?.name || '—'}</strong></div>
        <div><span>Age / Gender</span><strong>{patient ? `${patient.age ?? '—'} / ${patient.gender || '—'}` : '—'}</strong></div>
        <div><span>Patient ID</span><strong>{patient?.patientId || '—'}</strong></div>
      </div>

      <div className="handwriting-section medicines-space">
        <div className="handwriting-label">Medicines</div>
        <div className="writing-lines">
          {Array.from({ length: 10 }).map((_, index) => <span key={index} />)}
        </div>
      </div>

      <div className="handwriting-section advice-space">
        <div className="handwriting-label">Advice / Instructions</div>
        <div className="writing-lines">
          {Array.from({ length: 4 }).map((_, index) => <span key={index} />)}
        </div>
      </div>

      <div className="rx-footer">
        <div className="follow-up-line">Follow-up: <span /></div>
        <div className="report-doctor-signature">
          <div className="signature-space" />
          <strong>{doctor?.name || 'Doctor'}</strong>
          <span>Doctor signature & stamp</span>
        </div>
      </div>
    </section>
  </div>
));

PatientReportPrint.displayName = 'PatientReportPrint';

export default PatientReportPrint;
