import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { ProtectedRoute } from './components/auth';
import Login from './pages/Login';

// Main Pages
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Appointments from './pages/Appointments';
import Billing from './pages/Billing';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import ServiceItems from './pages/ServiceItems';
import Users from './pages/Users';
import NotFound from './pages/NotFound';

// Sub Pages
import { AddPatient, ViewPatient, EditPatient } from './pages/PatientsPages';
import { AddDoctor, EditDoctor } from './pages/DoctorsPages';
import { BookAppointment, ViewAppointment } from './pages/AppointmentsPages';
import { PrescriptionGenerator, BlankPrescription, Letterhead } from './pages/PrescriptionsPages';
import { OpdBillGenerator, MiscBillGenerator, MedicineBilling, ViewBill } from './pages/BillingPages';
import { MedicineStockManagement } from './pages/InventoryPages';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        {/* Dashboard */}
        <Route index element={<Dashboard />} />
        
        {/* Patients */}
        <Route path="patients" element={<Patients />} />
        <Route path="patients/add" element={<AddPatient />} />
        <Route path="patients/:id" element={<ViewPatient />} />
        <Route path="patients/:id/edit" element={<EditPatient />} />
        
        {/* Doctors */}
        <Route path="doctors" element={<Doctors />} />
        <Route path="doctors/add" element={<AddDoctor />} />
        <Route path="doctors/:id/edit" element={<EditDoctor />} />
        
        {/* Appointments */}
        <Route path="appointments" element={<Appointments />} />
        <Route path="appointments/book" element={<BookAppointment />} />
        <Route path="appointments/:id" element={<ViewAppointment />} />
        
        {/* Prescriptions */}
        <Route path="prescriptions/generate" element={<PrescriptionGenerator />} />
        <Route path="prescriptions/blank" element={<BlankPrescription />} />
        <Route path="letterhead" element={<Letterhead />} />
        
        {/* Billing */}
        <Route path="billing" element={<Billing />} />
        <Route path="billing/:type" element={<Billing />} />
        <Route path="billing/opd/new" element={<OpdBillGenerator />} />
        <Route path="billing/misc/new" element={<MiscBillGenerator />} />
        <Route path="billing/medicine/new" element={<MedicineBilling />} />
        <Route path="billing/:type/:id" element={<ViewBill />} />
        
        {/* Inventory */}
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/stock" element={<MedicineStockManagement />} />
        
        {/* Settings */}
        <Route path="settings" element={<Settings />} />
        
        {/* Service Charges */}
        <Route path="services" element={<ServiceItems />} />
        
        {/* Users */}
        <Route path="users" element={<Users />} />
        
        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
