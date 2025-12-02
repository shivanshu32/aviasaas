import api from './api';

export const doctorService = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, value);
    });
    return api.get(`/doctors/getDoctors?${query}`);
  },

  getById: async (id) => {
    return api.get(`/doctors/getDoctorById?id=${id}`);
  },

  create: async (data) => {
    return api.post('/doctors/addDoctor', data);
  },

  update: async (id, data) => {
    return api.put('/doctors/updateDoctor', { id, ...data });
  },
};

export default doctorService;
