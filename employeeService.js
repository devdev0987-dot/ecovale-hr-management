import { api } from './apiClient';

/**
 * Employee Service
 * Handles all employee-related API calls to Spring Boot backend
 */
const EmployeeService = {
  /**
   * Create a new employee
   * POST /api/employees
   * @param {object} employeeData - Employee data
   * @returns {Promise} Response with created employee
   */
  createEmployee: async (employeeData) => {
    try {
      const response = await api.post('/api/employees', employeeData);
      return response; // { success: true, message: '...', data: {...} }
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  },

  /**
   * Get all employees
   * GET /api/employees
   * @returns {Promise} List of all employees
   */
  getAllEmployees: async () => {
    try {
      const response = await api.get('/api/employees');
      return response;
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  },

  /**
   * Get employee by ID
   * GET /api/employees/{id}
   * @param {string} id - Employee ID
   * @returns {Promise} Employee details
   */
  getEmployeeById: async (id) => {
    try {
      const response = await api.get(`/api/employees/${id}`);
      return response;
    } catch (error) {
      console.error(`Error fetching employee ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get all active employees
   * GET /api/employees/active
   * @returns {Promise} List of active employees
   */
  getActiveEmployees: async () => {
    try {
      const response = await api.get('/api/employees/active');
      return response;
    } catch (error) {
      console.error('Error fetching active employees:', error);
      throw error;
    }
  },

  /**
   * Get employees by department
   * GET /api/employees/department/{department}
   * @param {string} department - Department name (IT, HR, Finance, Sales, Marketing)
   * @returns {Promise} List of employees in department
   */
  getEmployeesByDepartment: async (department) => {
    try {
      const response = await api.get(`/api/employees/department/${department}`);
      return response;
    } catch (error) {
      console.error(`Error fetching employees for department ${department}:`, error);
      throw error;
    }
  },

  /**
   * Search employees by name
   * GET /api/employees/search?name={name}
   * @param {string} name - Search term
   * @returns {Promise} List of matching employees
   */
  searchEmployees: async (name) => {
    try {
      const response = await api.get('/api/employees/search', {
        params: { name },
      });
      return response;
    } catch (error) {
      console.error(`Error searching employees with name ${name}:`, error);
      throw error;
    }
  },

  /**
   * Update employee
   * PUT /api/employees/{id}
   * @param {string} id - Employee ID
   * @param {object} employeeData - Updated employee data
   * @returns {Promise} Updated employee
   */
  updateEmployee: async (id, employeeData) => {
    try {
      const response = await api.put(`/api/employees/${id}`, employeeData);
      return response;
    } catch (error) {
      console.error(`Error updating employee ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete employee
   * DELETE /api/employees/{id}
   * @param {string} id - Employee ID
   * @returns {Promise} Deletion confirmation
   */
  deleteEmployee: async (id) => {
    try {
      const response = await api.delete(`/api/employees/${id}`);
      return response;
    } catch (error) {
      console.error(`Error deleting employee ${id}:`, error);
      throw error;
    }
  },
};

export default EmployeeService;
