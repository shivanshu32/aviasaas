import api from './api';

export const patientService = {
  // Get all patients with pagination and search
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive);
    
    const query = queryParams.toString();
    return api.get(`/patients/getPatients${query ? `?${query}` : ''}`);
  },

  // Get single patient by ID
  getById: async (id) => {
    return api.get(`/patients/getPatientById?id=${id}`);
  },

  // Create new patient
  create: async (data) => {
    return api.post('/patients/addPatient', data);
  },

  // Update patient
  update: async (id, data) => {
    return api.put('/patients/updatePatient', { id, ...data });
  },

  // Delete patient (soft delete)
  delete: async (id) => {
    return api.delete(`/patients/deletePatient?id=${id}`);
  },
};

export default patientService;
