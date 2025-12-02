import api from './api';

export const serviceItemService = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, value);
    });
    return api.get(`/services-getServices?${query}`);
  },

  getByCategory: async (category) => {
    return api.get(`/services-getServices?category=${category}`);
  },

  add: async (data) => {
    return api.post('/services-addService', data);
  },

  update: async (id, data) => {
    return api.put(`/services-updateService?id=${id}`, data);
  },

  delete: async (id) => {
    return api.delete(`/services-deleteService?id=${id}`);
  },
};

export default serviceItemService;
