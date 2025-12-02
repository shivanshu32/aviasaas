import api from './api';

export const prescriptionService = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, value);
    });
    return api.get(`/prescriptions/getPrescriptions?${query}`);
  },

  getById: async (id) => {
    return api.get(`/prescriptions/getPrescriptionById?id=${id}`);
  },

  create: async (data) => {
    return api.post('/prescriptions/generatePrescription', data);
  },
};

export default prescriptionService;
