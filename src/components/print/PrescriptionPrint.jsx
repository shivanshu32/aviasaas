import { forwardRef } from 'react';
import Letterhead from './Letterhead';
import './PrintStyles.css';

const PrescriptionPrint = forwardRef(({ prescription, patient, doctor }, ref) => {
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

  if (!prescription) return null;

  const patientData = patient || prescription.patient;
  const doctorData = doctor || prescription.doctor;
  const vitals = prescription.vitals || {};

  return (
    <div ref={ref} className="print-document">
      {/* Letterhead */}
      <Letterhead doctor={doctorData} showDoctor={true} />

      {/* Document Title */}
      <div className="document-title">Prescription</div>

      {/* Patient Info */}
      <div className="patient-section">
        <div className="patient-row">
          <span className="patient-label">Patient:</span>
          <span className="patient-value">{patientData?.name || 'N/A'}</span>
        </div>
        <div className="patient-row">
          <span className="patient-label">Date:</span>
          <span className="patient-value">
            {formatDate(prescription.prescriptionDate || prescription.createdAt)}
          </span>
        </div>
        <div className="patient-row">
          <span className="patient-label">Age/Gender:</span>
          <span className="patient-value">
            {patientData?.age || '-'} yrs / {patientData?.gender || '-'}
          </span>
        </div>
        <div className="patient-row">
          <span className="patient-label">Rx ID:</span>
          <span className="patient-value">{prescription.prescriptionId}</span>
        </div>
        <div className="patient-row">
          <span className="patient-label">Phone:</span>
          <span className="patient-value">{patientData?.phone || '-'}</span>
        </div>
        <div className="patient-row">
          <span className="patient-label">Time:</span>
          <span className="patient-value">
            {formatTime(prescription.prescriptionDate || prescription.createdAt)}
          </span>
        </div>
      </div>

      {/* Vitals */}
      {(vitals.bp || vitals.pulse || vitals.temp || vitals.weight || vitals.spo2) && (
        <div className="vitals-grid">
          {vitals.bp && (
            <div className="vital-item">
              <div className="vital-label">Blood Pressure</div>
              <div className="vital-value">{vitals.bp} mmHg</div>
            </div>
          )}
          {vitals.pulse && (
            <div className="vital-item">
              <div className="vital-label">Pulse</div>
              <div className="vital-value">{vitals.pulse} /min</div>
            </div>
          )}
          {vitals.temp && (
            <div className="vital-item">
              <div className="vital-label">Temperature</div>
              <div className="vital-value">{vitals.temp} °F</div>
            </div>
          )}
          {vitals.weight && (
            <div className="vital-item">
              <div className="vital-label">Weight</div>
              <div className="vital-value">{vitals.weight} kg</div>
            </div>
          )}
          {vitals.spo2 && (
            <div className="vital-item">
              <div className="vital-label">SpO2</div>
              <div className="vital-value">{vitals.spo2}%</div>
            </div>
          )}
        </div>
      )}

      {/* Diagnosis */}
      {prescription.diagnosis && (
        <div className="diagnosis-section">
          <div className="diagnosis-label">Diagnosis / Chief Complaints</div>
          <div className="diagnosis-value">{prescription.diagnosis}</div>
        </div>
      )}

      {/* Medicines */}
      <div className="medicine-list">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <span className="rx-symbol">℞</span>
          <span style={{ fontSize: '11pt', fontWeight: '600', color: '#374151' }}>Medications</span>
        </div>

        {prescription.medicines?.map((med, index) => (
          <div key={index} className="medicine-item">
            <div className="medicine-number">{index + 1}</div>
            <div className="medicine-details">
              <div className="medicine-name">
                {med.name} {med.strength && `(${med.strength})`}
              </div>
              <div className="medicine-dosage">
                {med.dosage} — {med.frequency} — {med.timing}
              </div>
              <div className="medicine-duration">
                Duration: {med.duration} {med.durationUnit || 'days'}
                {med.quantity && ` | Qty: ${med.quantity}`}
              </div>
              {med.instructions && (
                <div className="medicine-instructions">Note: {med.instructions}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Investigations */}
      {prescription.investigations?.length > 0 && (
        <div className="notes-section">
          <div className="notes-title">Investigations Advised</div>
          <div className="notes-content">
            {prescription.investigations.join(', ')}
          </div>
        </div>
      )}

      {/* Advice */}
      {prescription.advice && (
        <div className="notes-section">
          <div className="notes-title">Advice / Instructions</div>
          <div className="notes-content">{prescription.advice}</div>
        </div>
      )}

      {/* Follow Up */}
      {prescription.followUpDate && (
        <div style={{ marginTop: '16px' }}>
          <span className="follow-up">
            Follow Up: {formatDate(prescription.followUpDate)}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="print-footer">
        <div className="signature-section">
          <div></div>
          <div className="signature-box">
            <div style={{ height: '50px' }}></div>
            <div className="signature-line">
              {doctorData?.name || 'Doctor Signature'}
            </div>
          </div>
        </div>

        <div className="footer-notes">
          <p>• This prescription is valid for 7 days from the date of issue.</p>
          <p>• Please consult the doctor if symptoms persist or worsen.</p>
          <p>• Keep medicines out of reach of children.</p>
        </div>
      </div>
    </div>
  );
});

PrescriptionPrint.displayName = 'PrescriptionPrint';

export default PrescriptionPrint;
