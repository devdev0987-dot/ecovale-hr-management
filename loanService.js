import { api } from './apiClient';

/**
 * Loan Service
 * Handles all loan-related API calls to Spring Boot backend
 */
const LoanService = {
  /**
   * Create a new loan record
   * POST /api/loans
   * @param {object} loanData - Loan data
   * @returns {Promise} Response with created loan record
   */
  createLoanRecord: async (loanData) => {
    try {
      const response = await api.post('/api/loans', loanData);
      return response;
    } catch (error) {
      console.error('Error creating loan record:', error);
      throw error;
    }
  },

  /**
   * Get all loan records
   * GET /api/loans
   * @returns {Promise} List of all loan records
   */
  getAllLoanRecords: async () => {
    try {
      const response = await api.get('/api/loans');
      return response;
    } catch (error) {
      console.error('Error fetching loan records:', error);
      throw error;
    }
  },

  /**
   * Get loan record by ID
   * GET /api/loans/{id}
   * @param {string} id - Loan record ID
   * @returns {Promise} Loan record details
   */
  getLoanById: async (id) => {
    try {
      const response = await api.get(`/api/loans/${id}`);
      return response;
    } catch (error) {
      console.error(`Error fetching loan record ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get loan records by employee ID
   * GET /api/loans/employee/{employeeId}
   * @param {string} employeeId - Employee ID
   * @returns {Promise} List of loan records for employee
   */
  getLoansByEmployeeId: async (employeeId) => {
    try {
      const response = await api.get(`/api/loans/employee/${employeeId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching loans for employee ${employeeId}:`, error);
      throw error;
    }
  },

  /**
   * Get loan records by status
   * GET /api/loans/status/{status}
   * @param {string} status - Loan status (ACTIVE, COMPLETED, CANCELLED)
   * @returns {Promise} List of loan records with the specified status
   */
  getLoansByStatus: async (status) => {
    try {
      const response = await api.get(`/api/loans/status/${status}`);
      return response;
    } catch (error) {
      console.error(`Error fetching loans with status ${status}:`, error);
      throw error;
    }
  },

  /**
   * Update loan record
   * PUT /api/loans/{id}
   * @param {string} id - Loan record ID
   * @param {object} loanData - Updated loan data
   * @returns {Promise} Updated loan record
   */
  updateLoanRecord: async (id, loanData) => {
    try {
      const response = await api.put(`/api/loans/${id}`, loanData);
      return response;
    } catch (error) {
      console.error(`Error updating loan record ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete loan record
   * DELETE /api/loans/{id}
   * @param {string} id - Loan record ID
   * @returns {Promise} Deletion confirmation
   */
  deleteLoanRecord: async (id) => {
    try {
      const response = await api.delete(`/api/loans/${id}`);
      return response;
    } catch (error) {
      console.error(`Error deleting loan record ${id}:`, error);
      throw error;
    }
  },
};

export default LoanService;
