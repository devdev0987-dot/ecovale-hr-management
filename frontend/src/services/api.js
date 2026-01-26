import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const employeeService = {
  // Get all employees
  getAll: async () => {
    const response = await api.get('/employees');
    return response.data;
  },

  // Get single employee
  getById: async (id) => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },

  // Create new employee
  create: async (employeeData) => {
    const response = await api.post('/employees', employeeData);
    return response.data;
  },

  // Update employee
  update: async (id, employeeData) => {
    const response = await api.put(`/employees/${id}`, employeeData);
    return response.data;
  },

  // Delete employee
  delete: async (id) => {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },
};

export default api;
