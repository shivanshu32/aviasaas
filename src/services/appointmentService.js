import api from './api';

export const appointmentService = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, value);
    });
    return api.get(`/appointments/getAppointments?${query}`);
  },

  getById: async (id) => {
    return api.get(`/appointments/getAppointmentById?id=${id}`);
  },

  create: async (data) => {
    return api.post('/appointments/createAppointment', data);
  },

  update: async (id, data) => {
    return api.put('/appointments/updateAppointment', { id, ...data });
  },
};

export default appointmentService;
