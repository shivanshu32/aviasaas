import api from './api';

export const medicineService = {
  // Medicines
  getAll: async (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.append(key, value);
    });
    return api.get(`/medicine/getMedicines?${query}`);
  },

  getById: async (id, includeStock = false) => {
    return api.get(`/medicine/getMedicineById?id=${id}&includeStock=${includeStock}`);
  },

  create: async (data) => {
    return api.post('/medicine/addMedicine', data);
  },

  update: async (id, data) => {
    return api.put('/medicine/updateMedicine', { id, ...data });
  },

  // Stock
  stock: {
    getCurrent: async (medicineId) => {
      const query = medicineId ? `?medicineId=${medicineId}` : '';
      return api.get(`/medicine/getCurrentStock${query}`);
    },

    getBatches: async (medicineId) => {
      return api.get(`/medicine/getStockBatches?medicineId=${medicineId}`);
    },

    getLowStock: async () => {
      return api.get('/medicine/getLowStock');
    },

    getExpiring: async (days = 90) => {
      return api.get(`/medicine/getExpiringStock?days=${days}`);
    },

    add: async (data) => {
      return api.post('/medicine/addStock', data);
    },

    deduct: async (data) => {
      return api.post('/medicine/deductStock', data);
    },
  },
};

export default medicineService;
