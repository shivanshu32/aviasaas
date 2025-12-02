import api from './api';

export const clinicService = {
  // Get clinic settings
  getSettings: async () => {
    return api.get('/clinic/getClinicSettings');
  },

  // Update clinic settings
  updateSettings: async (data) => {
    return api.put('/clinic/updateClinicSettings', data);
  },
};

export default clinicService;
