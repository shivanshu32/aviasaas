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

  /** Total active medicines (from pagination metadata, no full list load). */
  getCatalogTotal: async (params = {}) => {
    const response = await medicineService.getAll({
      ...params,
      page: 1,
      limit: 1,
    });
    return response.pagination?.total ?? response.medicines?.length ?? 0;
  },

  /** Fetch every page and merge (for admin views that need the full catalog). */
  fetchAll: async (params = {}, pageSize = 200) => {
    const all = [];
    let page = 1;
    let total = 0;

    while (true) {
      const response = await medicineService.getAll({
        ...params,
        page,
        limit: pageSize,
      });
      const batch = response.medicines ?? [];
      total = response.pagination?.total ?? total;
      all.push(...batch);
      if (!response.pagination?.hasNextPage || batch.length === 0) break;
      page += 1;
    }

    return {
      medicines: all,
      total: total || all.length,
      pagination: {
        total: total || all.length,
        page: 1,
        limit: all.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
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

  delete: async (id) => {
    return api.delete(`/medicine/deleteMedicine?id=${id}`);
  },

  // Stock
  stock: {
    getCurrent: async (medicineId) => {
      const query = medicineId ? `?medicineId=${medicineId}` : '';
      return api.get(`/medicine/getCurrentStock${query}`);
    },

    getBatches: async (medicineId, params = {}) => {
      const query = new URLSearchParams({ medicineId });
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.append(key, value);
      });
      return api.get(`/medicine/getStockBatches?${query}`);
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

  activity: {
    getForMedicine: async (medicineId, params = {}) => {
      const query = new URLSearchParams({ medicineId });
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.append(key, value);
      });
      return api.get(`/medicine/getMedicineActivity?${query}`);
    },
  },
};

export default medicineService;
