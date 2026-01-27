import { api } from './apiClient';

/**
 * Designation Service
 * Handles all designation-related API calls to Spring Boot backend
 */
const DesignationService = {
  /**
   * Create a new designation
   * POST /api/designations
   * @param {object} designationData - Designation data
   * @returns {Promise} Response with created designation
   */
  createDesignation: async (designationData) => {
    try {
      const response = await api.post('/api/designations', designationData);
      return response;
    } catch (error) {
      console.error('Error creating designation:', error);
      throw error;
    }
  },

  /**
   * Get all designations
   * GET /api/designations
   * @returns {Promise} List of all designations
   */
  getAllDesignations: async () => {
    try {
      const response = await api.get('/api/designations');
      return response;
    } catch (error) {
      console.error('Error fetching designations:', error);
      throw error;
    }
  },

  /**
   * Get designation by ID
   * GET /api/designations/{id}
   * @param {string} id - Designation ID
   * @returns {Promise} Designation details
   */
  getDesignationById: async (id) => {
    try {
      const response = await api.get(`/api/designations/${id}`);
      return response;
    } catch (error) {
      console.error(`Error fetching designation ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get designations by department
   * GET /api/designations/department/{department}
   * @param {string} department - Department name
   * @returns {Promise} List of designations in department
   */
  getDesignationsByDepartment: async (department) => {
    try {
      const response = await api.get(`/api/designations/department/${department}`);
      return response;
    } catch (error) {
      console.error(`Error fetching designations for department ${department}:`, error);
      throw error;
    }
  },

  /**
   * Update designation
   * PUT /api/designations/{id}
   * @param {string} id - Designation ID
   * @param {object} designationData - Updated designation data
   * @returns {Promise} Updated designation
   */
  updateDesignation: async (id, designationData) => {
    try {
      const response = await api.put(`/api/designations/${id}`, designationData);
      return response;
    } catch (error) {
      console.error(`Error updating designation ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete designation
   * DELETE /api/designations/{id}
   * @param {string} id - Designation ID
   * @returns {Promise} Deletion confirmation
   */
  deleteDesignation: async (id) => {
    try {
      const response = await api.delete(`/api/designations/${id}`);
      return response;
    } catch (error) {
      console.error(`Error deleting designation ${id}:`, error);
      throw error;
    }
  },
};

export default DesignationService;
