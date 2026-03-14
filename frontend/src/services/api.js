import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  updateProfile: (data) => api.put('/auth/profile', data),
  getStats: () => api.get('/auth/profile/stats'),
};

// Accounts
export const accountsAPI = {
  getAll: () => api.get('/accounts'),
  create: (data) => api.post('/accounts', data),
  update: (id, data) => api.put(`/accounts/${id}`, data),
  delete: (id) => api.delete(`/accounts/${id}`),
};

// Transactions
export const transactionsAPI = {
  getAll: (params) => api.get('/transactions', { params }),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  exportCSV: (params) => api.get('/transactions', { params: { ...params, limit: 9999 } }),
};

// Budgets
export const budgetsAPI = {
  getAll: () => api.get('/budgets'),
  create: (data) => api.post('/budgets', data),
};

// Credit Cards
export const creditCardsAPI = {
  getAll: () => api.get('/credit-cards'),
  create: (data) => api.post('/credit-cards', data),
  getTransactions: (params) => api.get('/credit-cards/transactions', { params }),
  createTransaction: (data) => api.post('/credit-cards/transactions', data),
};

// Investments
export const investmentsAPI = {
  getAll: () => api.get('/investments'),
  create: (data) => api.post('/investments', data),
  sync: () => api.post('/investments/sync'),
};

// Mutual Funds
export const mutualFundsAPI = {
  getAll: () => api.get('/mutual-funds'),
  create: (data) => api.post('/mutual-funds', data),
  getSIPs: () => api.get('/mutual-funds/sip'),
  createSIP: (data) => api.post('/mutual-funds/sip', data),
};

// Goals
export const goalsAPI = {
  getAll: () => api.get('/goals'),
  create: (data) => api.post('/goals', data),
};

// Lending
export const lendingAPI = {
  getAll: () => api.get('/lending'),
  create: (data) => api.post('/lending', data),
  repay: (id, amount) => api.post(`/lending/${id}/repay`, { amount }),
};

// Reports
export const reportsAPI = {
  getMonthly: (params) => api.get('/reports/monthly', { params }),
  getYearly: (params) => api.get('/reports/yearly', { params }),
  getMonthlyPDF: (params) => api.get('/reports/monthly', { params: { ...params, format: 'pdf' }, responseType: 'blob' }),
  getYearlyPDF: (params) => api.get('/reports/yearly', { params: { ...params, format: 'pdf' }, responseType: 'blob' }),
};

// Import
export const importAPI = {
  uploadExcel: (file, preview = false, account_id = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (account_id) formData.append('account_id', account_id);
    return api.post(`/import/excel${preview ? '?preview=true' : ''}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Insights
export const insightsAPI = {
  get: () => api.get('/insights'),
};

// Calculations
export const calculationsAPI = {
  get: (params) => api.get('/calculations', { params }),
  getSnapshots: () => api.get('/calculations/snapshots'),
};

export default api;
