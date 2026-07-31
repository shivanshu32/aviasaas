import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileCheck2, FileText, Printer, Search, Stethoscope, UserRound } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import { Button, Input, Select } from '../components/ui';
import RichTextEditor from '../components/reports/RichTextEditor';
import PatientReportPrint from '../components/reports/PatientReportPrint';
import { doctorService, patientService } from '../services';

const getLocalDateValue = () => {
  const date = new Date();
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

const STARTER_CONTENT = `
  <h2>Clinical Summary</h2>
  <p>Enter a concise summary of the patient's presentation and relevant history.</p>
  <h2>Examination & Findings</h2>
  <p>Document examination findings, observations, and investigation results.</p>
  <h2>Impression</h2>
  <p>Enter the clinical impression or diagnosis.</p>
  <h2>Recommendations</h2>
  <ul><li>Add treatment recommendations or next steps.</li></ul>
`;

export default function PatientReports() {
  const printRef = useRef(null);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    date: getLocalDateValue(),
    title: 'Patient Medical Report',
    content: STARTER_CONTENT,
  });

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const [patientResponse, doctorResponse] = await Promise.all([
          patientService.getAll({ limit: 100, isActive: true, sortBy: 'name', sortOrder: 'asc' }),
          doctorService.getAll({ isActive: true }),
        ]);
        setPatients(patientResponse.patients || []);
        setDoctors(doctorResponse.doctors || []);
      } catch (error) {
        console.error('Failed to load report form data:', error);
        toast.error('Could not load patients and doctors');
      } finally {
        setIsLoading(false);
      }
    };

    loadFormData();
  }, []);

  const selectedPatient = patients.find((patient) => patient._id === formData.patientId);
  const selectedDoctor = doctors.find((doctor) => doctor._id === formData.doctorId);

  const filteredPatients = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((patient) =>
      [patient.name, patient.patientId, patient.phone].some((value) =>
        String(value || '').toLowerCase().includes(query)
      )
    );
  }, [patientSearch, patients]);

  const report = useMemo(() => {
    const dateStamp = formData.date.replaceAll('-', '');
    const patientStamp = selectedPatient?.patientId || 'DRAFT';
    return {
      ...formData,
      reportId: `RPT-${dateStamp}-${patientStamp}`,
    };
  }, [formData, selectedPatient]);

  const handleGenerate = () => {
    const contentText = new DOMParser().parseFromString(formData.content, 'text/html').body.textContent.trim();
    if (!selectedPatient) {
      toast.error('Select a patient to generate the report');
      return;
    }
    if (!selectedDoctor) {
      toast.error('Select the consulting doctor');
      return;
    }
    if (!formData.date || !contentText) {
      toast.error('Add a report date and report content');
      return;
    }

    setShowPreview(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `${report.reportId}-${selectedPatient?.name || 'Patient'}`,
  });

  if (showPreview) {
    return (
      <div className="-m-4 sm:-m-6">
        <div className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100"
              aria-label="Back to report editor"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-semibold text-gray-900">Print preview</h1>
              <p className="text-xs text-gray-500">2 pages • Report and blank prescription</p>
            </div>
          </div>
          <Button icon={Printer} onClick={handlePrint}>Print Report</Button>
        </div>

        <PatientReportPrint
          ref={printRef}
          report={report}
          patient={selectedPatient}
          doctor={selectedDoctor}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary-700">
            <FileCheck2 className="h-4 w-4" />
            Clinical documentation
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Patient Report</h1>
          <p className="mt-1 text-sm text-gray-500">Write a formatted medical report and prepare it for print.</p>
        </div>
        <Button icon={FileText} size="lg" onClick={handleGenerate} disabled={isLoading}>
          Generate Report
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary-700">
                <UserRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Patient details</h2>
                <p className="text-xs text-gray-500">Select from patient records</p>
              </div>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
                placeholder="Search name, ID or phone"
                className="input pl-9"
              />
            </div>

            <Select
              label="Patient"
              value={formData.patientId}
              onChange={(event) => setFormData((current) => ({ ...current, patientId: event.target.value }))}
              options={filteredPatients.map((patient) => ({
                value: patient._id,
                label: `${patient.name} · ${patient.patientId || patient.phone}`,
              }))}
              placeholder={isLoading ? 'Loading patients...' : 'Select patient'}
              disabled={isLoading}
              required
            />

            {selectedPatient && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs">
                <p className="font-semibold text-gray-900">{selectedPatient.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-y-2 text-gray-600">
                  <span>{selectedPatient.age} years</span>
                  <span>{selectedPatient.gender}</span>
                  <span>{selectedPatient.bloodGroup || 'Blood group —'}</span>
                  <span>{selectedPatient.phone}</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Report information</h2>
                <p className="text-xs text-gray-500">Author and issue date</p>
              </div>
            </div>

            <div className="space-y-4">
              <Select
                label="Consulting doctor"
                value={formData.doctorId}
                onChange={(event) => setFormData((current) => ({ ...current, doctorId: event.target.value }))}
                options={doctors.map((doctor) => ({
                  value: doctor._id,
                  label: `${doctor.name} · ${doctor.specialization}`,
                }))}
                placeholder={isLoading ? 'Loading doctors...' : 'Select doctor'}
                disabled={isLoading}
                required
              />
              <Input
                label="Report date (select manually)"
                type="date"
                value={formData.date}
                onChange={(event) => setFormData((current) => ({ ...current, date: event.target.value }))}
                helperText="Choose the date that should appear on the report and prescription."
                required
              />
            </div>
          </section>
        </aside>

        <main className="min-w-0">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-5">
              <label className="label" htmlFor="report-title">Report title</label>
              <input
                id="report-title"
                value={formData.title}
                onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                className="w-full border-0 border-b border-gray-200 px-0 pb-3 text-xl font-semibold text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-primary-500 focus:ring-0"
                placeholder="Patient Medical Report"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label mb-0">Report content <span className="text-red-500">*</span></label>
                <span className="text-xs text-gray-400">WYSIWYG editor</span>
              </div>
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData((current) => ({ ...current, content }))}
              />
            </div>
          </section>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Ready to review?</p>
              <p className="text-xs text-gray-500">Generates an A4 report plus a blank handwritten prescription.</p>
            </div>
            <Button icon={FileText} onClick={handleGenerate} disabled={isLoading}>Generate Report</Button>
          </div>
        </main>
      </div>
    </div>
  );
}
