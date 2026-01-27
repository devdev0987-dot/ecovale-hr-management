import { api } from './apiClient';

/**
 * Advance Service
 * Handles all advance-related API calls to Spring Boot backend
 */
const AdvanceService = {
  /**
   * Create a new advance record
   * POST /api/advances
   * @param {object} advanceData - Advance data
   * @returns {Promise} Response with created advance record
   */
  createAdvanceRecord: async (advanceData) => {
    try {
      const response = await api.post('/api/advances', advanceData);
      return response;
    } catch (error) {
      console.error('Error creating advance record:', error);
      throw error;
    }
  },

  /**
   * Get all advance records
   * GET /api/advances
   * @returns {Promise} List of all advance records
   */
  getAllAdvanceRecords: async () => {
    try {
      const response = await api.get('/api/advances');
      return response;
    } catch (error) {
      console.error('Error fetching advance records:', error);
      throw error;
    }
  },

  /**
   * Get advance record by ID
   * GET /api/advances/{id}
   * @param {string} id - Advance record ID
   * @returns {Promise} Advance record details
   */
  getAdvanceById: async (id) => {
    try {
      const response = await api.get(`/api/advances/${id}`);
      return response;
    } catch (error) {
      console.error(`Error fetching advance record ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get advance records by employee ID
   * GET /api/advances/employee/{employeeId}
   * @param {string} employeeId - Employee ID
   * @returns {Promise} List of advance records for employee
   */
  getAdvancesByEmployeeId: async (employeeId) => {
    try {
      const response = await api.get(`/api/advances/employee/${employeeId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching advances for employee ${employeeId}:`, error);
      throw error;
    }
  },

  /**
   * Get advance records by status
   * GET /api/advances/status/{status}
   * @param {string} status - Advance status (PENDING, DEDUCTED, PARTIAL)
   * @returns {Promise} List of advance records with the specified status
   */
  getAdvancesByStatus: async (status) => {
    try {
      const response = await api.get(`/api/advances/status/${status}`);
      return response;
    } catch (error) {
      console.error(`Error fetching advances with status ${status}:`, error);
      throw error;
    }
  },

  /**
   * Update advance record
   * PUT /api/advances/{id}
   * @param {string} id - Advance record ID
   * @param {object} advanceData - Updated advance data
   * @returns {Promise} Updated advance record
   */
  updateAdvanceRecord: async (id, advanceData) => {
    try {
      const response = await api.put(`/api/advances/${id}`, advanceData);
      return response;
    } catch (error) {
      console.error(`Error updating advance record ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete advance record
   * DELETE /api/advances/{id}
   * @param {string} id - Advance record ID
   * @returns {Promise} Deletion confirmation
   */
  deleteAdvanceRecord: async (id) => {
    try {
      const response = await api.delete(`/api/advances/${id}`);
      return response;
    } catch (error) {
      console.error(`Error deleting advance record ${id}:`, error);
      throw error;
    }
  },
};

export default AdvanceService;
