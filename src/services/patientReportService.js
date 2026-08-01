import api from './api';

export const patientReportService = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, value);
    });
    return api.get(`/reports/getReports?${query}`);
  },

  getById: async (id) => {
    return api.get(`/reports/getReportById?id=${id}`);
  },

  create: async (data) => {
    return api.post('/reports/createReport', data);
  },
};

export default patientReportService;
