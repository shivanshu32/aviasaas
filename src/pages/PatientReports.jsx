import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  FileCheck2,
  FileStack,
  FileText,
  Loader2,
  Phone,
  Printer,
  Search,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Input } from '../components/ui';
import RichTextEditor from '../components/reports/RichTextEditor';
import PatientReportPrint from '../components/reports/PatientReportPrint';
import { doctorService, patientReportService, patientService } from '../services';

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

const REPORT_TEMPLATES = [
  {
    id: 'general',
    name: 'General Medical Report',
    description: 'Clinical history, findings, impression and recommendations',
    title: 'Patient Medical Report',
    content: STARTER_CONTENT,
  },
  {
    id: 'diagnostic',
    name: 'Diagnostic / Investigation Report',
    description: 'For laboratory, imaging, and diagnostic findings',
    title: 'Diagnostic Investigation Report',
    content: `
      <h2>Clinical Indication</h2>
      <p>Enter the reason for the investigation and relevant clinical history.</p>
      <h2>Investigation Performed</h2>
      <p>Enter the test, imaging study, or procedure performed.</p>
      <h2>Findings</h2>
      <p>Document the investigation findings in detail.</p>
      <h2>Conclusion / Impression</h2>
      <p>Enter the diagnostic conclusion.</p>
      <h2>Recommendations</h2>
      <ul><li>Add suggested follow-up tests or clinical correlation.</li></ul>
    `,
  },
  {
    id: 'follow-up',
    name: 'Follow-up Consultation',
    description: 'Progress review and updated treatment plan',
    title: 'Follow-up Consultation Report',
    content: `
      <h2>Reason for Follow-up</h2>
      <p>Enter the condition or treatment being reviewed.</p>
      <h2>Clinical Progress</h2>
      <p>Document symptom changes, treatment response, and relevant events since the last visit.</p>
      <h2>Current Findings</h2>
      <p>Enter examination findings and updated investigation results.</p>
      <h2>Assessment</h2>
      <p>Enter the current clinical assessment.</p>
      <h2>Updated Plan</h2>
      <ul><li>Add treatment changes, advice, and the next follow-up interval.</li></ul>
    `,
  },
  {
    id: 'fitness',
    name: 'Fitness Certificate',
    description: 'Medical fitness assessment for work, school, or travel',
    title: 'Medical Fitness Certificate',
    content: `
      <h2>Medical Assessment</h2>
      <p>The above-named patient was clinically examined on the date stated in this report.</p>
      <h2>Relevant Findings</h2>
      <p>Enter relevant history, examination findings, and investigations reviewed.</p>
      <h2>Fitness Opinion</h2>
      <p>Based on the clinical assessment, the patient is found medically fit / unfit for:</p>
      <p><br></p>
      <h2>Restrictions / Recommendations</h2>
      <p>Enter any restrictions, precautions, duration, or follow-up advice.</p>
    `,
  },
  {
    id: 'discharge',
    name: 'Discharge Summary',
    description: 'Admission course, treatment and discharge advice',
    title: 'Discharge Summary',
    content: `
      <h2>Reason for Admission</h2>
      <p>Enter presenting complaints and reason for admission.</p>
      <h2>Diagnosis</h2>
      <p>Enter the final diagnosis.</p>
      <h2>Hospital Course</h2>
      <p>Summarize important clinical events, procedures, and response to treatment.</p>
      <h2>Investigations</h2>
      <p>Enter significant investigation results.</p>
      <h2>Condition at Discharge</h2>
      <p>Describe the patient's condition at discharge.</p>
      <h2>Discharge Advice</h2>
      <ul><li>Add medicines, diet, activity, warning signs, and follow-up instructions.</li></ul>
    `,
  },
];

export default function PatientReports() {
  const printRef = useRef(null);
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [savedReport, setSavedReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('general');
  const [formData, setFormData] = useState({
    patientId: '',
    doctorName: '',
    date: getLocalDateValue(),
    title: 'Patient Medical Report',
    content: STARTER_CONTENT,
  });

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const doctorResponse = await doctorService.getAll({ isActive: true });
        setDoctors(doctorResponse.doctors || []);
      } catch (error) {
        console.error('Failed to load doctor suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDoctors();
  }, []);

  useEffect(() => {
    const requestedReportId = searchParams.get('reportId');
    const requestedPatientId = searchParams.get('patientId');
    if (!requestedReportId && !requestedPatientId) return;

    const loadRequestedRecord = async () => {
      try {
        if (requestedReportId) {
          const response = await patientReportService.getById(requestedReportId);
          const storedReport = response.report;
          if (!storedReport?.patient) throw new Error('Patient data is missing from this report');

          setSavedReport(storedReport);
          setSelectedPatient(storedReport.patient);
          setPatientSearch(storedReport.patient.name || '');
          setFormData({
            patientId: storedReport.patientId,
            doctorName: storedReport.doctorName || storedReport.doctor?.name || '',
            date: storedReport.reportDate?.slice(0, 10) || getLocalDateValue(),
            title: storedReport.title || 'Patient Medical Report',
            content: storedReport.content || STARTER_CONTENT,
          });
          setShowPreview(true);
          return;
        }

        const response = await patientService.getById(requestedPatientId);
        if (response.patient) {
          setSelectedPatient(response.patient);
          setPatientSearch(response.patient.name || '');
          setFormData((current) => ({ ...current, patientId: response.patient._id }));
        }
      } catch (error) {
        console.error('Failed to load requested patient report data:', error);
        toast.error(error.error || error.message || 'Could not load patient report');
      }
    };

    loadRequestedRecord();
  }, [searchParams]);

  useEffect(() => {
    let isCurrent = true;
    const searchTimer = window.setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        const response = await patientService.getAll({
          search: patientSearch.trim(),
          limit: 20,
          sortBy: 'name',
          sortOrder: 'asc',
        });
        if (isCurrent) {
          setPatients((response.patients || []).filter((patient) => patient.isActive !== false));
        }
      } catch (error) {
        console.error('Failed to search patients:', error);
        if (isCurrent) setPatients([]);
      } finally {
        if (isCurrent) setIsSearchingPatients(false);
      }
    }, patientSearch.trim() ? 250 : 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(searchTimer);
    };
  }, [patientSearch]);

  const matchedDoctor = doctors.find(
    (doctor) => doctor.name?.trim().toLowerCase() === formData.doctorName.trim().toLowerCase()
  );
  const savedDoctorMatches = savedReport?.doctor?.name?.trim().toLowerCase()
    === formData.doctorName.trim().toLowerCase();
  const selectedDoctor = matchedDoctor
    || (savedDoctorMatches ? savedReport.doctor : null)
    || { name: formData.doctorName.trim() };

  const report = useMemo(() => {
    const dateStamp = formData.date.replaceAll('-', '');
    const patientStamp = selectedPatient?.patientId || 'DRAFT';
    return {
      ...formData,
      reportId: savedReport?.reportId || `RPT-${dateStamp}-${patientStamp}`,
    };
  }, [formData, savedReport, selectedPatient]);

  const handleGenerate = async () => {
    const contentText = new DOMParser().parseFromString(formData.content, 'text/html').body.textContent.trim();
    if (!selectedPatient) {
      toast.error('Select a patient to generate the report');
      return;
    }
    if (!formData.doctorName.trim()) {
      toast.error('Enter the consulting doctor name');
      return;
    }
    if (!formData.date || !contentText) {
      toast.error('Add a report date and report content');
      return;
    }

    setIsSaving(true);
    try {
      const response = await patientReportService.create({
        patientId: selectedPatient._id,
        doctorName: formData.doctorName,
        doctor: selectedDoctor,
        reportDate: formData.date,
        title: formData.title,
        content: formData.content,
      });
      setSavedReport(response.report);
      setShowPreview(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success('Patient report saved successfully');
    } catch (error) {
      console.error('Failed to save patient report:', error);
      toast.error(error.error || 'Could not save patient report');
    } finally {
      setIsSaving(false);
    }
  };

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setSavedReport(null);
    setPatientSearch(patient.name);
    setFormData((current) => ({ ...current, patientId: patient._id }));
    setShowPatientSuggestions(false);
  };

  const applyTemplate = () => {
    const template = REPORT_TEMPLATES.find((item) => item.id === selectedTemplateId);
    if (!template) return;

    setFormData((current) => ({
      ...current,
      title: template.title,
      content: template.content,
    }));
    toast.success(`${template.name} template applied`);
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
              <p className="text-xs text-gray-500">A4 patient report</p>
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
        <Button icon={FileText} size="lg" onClick={handleGenerate} loading={isSaving} disabled={isLoading}>
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={patientSearch}
                onFocus={() => setShowPatientSuggestions(true)}
                onChange={(event) => {
                  setPatientSearch(event.target.value);
                  setSelectedPatient(null);
                  setSavedReport(null);
                  setFormData((current) => ({ ...current, patientId: '' }));
                  setShowPatientSuggestions(true);
                }}
                onBlur={() => window.setTimeout(() => setShowPatientSuggestions(false), 150)}
                placeholder="Type patient name or mobile number"
                className="input pl-9 pr-9"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showPatientSuggestions}
                aria-controls="patient-suggestions"
              />
              {isSearchingPatients && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-500" />
              )}

              {showPatientSuggestions && (
                <div
                  id="patient-suggestions"
                  role="listbox"
                  className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                >
                  {patients.length > 0 ? patients.map((patient) => (
                    <button
                      key={patient._id}
                      type="button"
                      role="option"
                      aria-selected={selectedPatient?._id === patient._id}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectPatient(patient);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-blue-50"
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-primary-700">
                        {patient.name?.charAt(0)?.toUpperCase() || 'P'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900">{patient.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          {patient.phone || 'No mobile number'}
                          {patient.patientId && <span>• {patient.patientId}</span>}
                        </span>
                      </span>
                      {selectedPatient?._id === patient._id && <Check className="h-4 w-4 text-primary-600" />}
                    </button>
                  )) : (
                    <div className="px-3 py-5 text-center">
                      {isSearchingPatients ? (
                        <p className="text-sm text-gray-500">Searching patients…</p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-700">No patient found</p>
                          <p className="mt-1 text-xs text-gray-500">Try a name, mobile number, or patient ID.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="mt-2 text-xs text-gray-500">Suggestions search all patient records by name, phone, or ID.</p>

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
              <Input
                label="Consulting doctor name"
                value={formData.doctorName}
                onChange={(event) => setFormData((current) => ({ ...current, doctorName: event.target.value }))}
                placeholder="Type any doctor name"
                list="doctor-name-suggestions"
                helperText="Enter any name manually; existing doctors appear as optional suggestions."
                required
              />
              <datalist id="doctor-name-suggestions">
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor.name}>
                    {[doctor.qualification, doctor.specialization].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </datalist>
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
            <div className="mb-6 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <FileStack className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Report templates</h2>
                  <p className="text-xs text-gray-500">Start with a structured format, then edit every section below.</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  className="input flex-1"
                  aria-label="Choose report template"
                >
                  {REPORT_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} — {template.description}
                    </option>
                  ))}
                </select>
                <Button variant="outline" icon={FileStack} onClick={applyTemplate}>
                  Use Template
                </Button>
              </div>
            </div>

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
              <p className="text-xs text-gray-500">Generates a clean, print-ready A4 patient report.</p>
            </div>
            <Button icon={FileText} onClick={handleGenerate} loading={isSaving} disabled={isLoading}>Generate Report</Button>
          </div>
        </main>
      </div>
    </div>
  );
}
