import api from './api';

export const billingService = {
  // OPD Bills
  opd: {
    getAll: async (params = {}) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.append(key, value);
      });
      return api.get(`/billing/opd/getOpdBills?${query}`);
    },

    getById: async (id) => {
      return api.get(`/billing/opd/getOpdBillById?id=${id}`);
    },

    create: async (data) => {
      return api.post('/billing/opd/generateOpdBill', data);
    },
  },

  // Misc Bills
  misc: {
    getAll: async (params = {}) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.append(key, value);
      });
      return api.get(`/billing/misc/getMiscBills?${query}`);
    },

    getById: async (id) => {
      return api.get(`/billing/misc/getMiscBillById?id=${id}`);
    },

    create: async (data) => {
      return api.post('/billing/misc/generateMiscBill', data);
    },
  },

  // Medicine Bills
  medicine: {
    getAll: async (params = {}) => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') query.append(key, value);
      });
      return api.get(`/billing/medicine/getMedicineBills?${query}`);
    },

    getById: async (id) => {
      return api.get(`/billing/medicine/getMedicineBillById?id=${id}`);
    },

    create: async (data) => {
      return api.post('/billing/medicine/generateMedicineBill', data);
    },
  },
};

export default billingService;
