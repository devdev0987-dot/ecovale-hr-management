import { api } from './apiClient';

/**
 * Attendance Service
 * Handles all attendance-related API calls to Spring Boot backend
 */
const AttendanceService = {
  /**
   * Create a new attendance record
   * POST /api/attendance
   * @param {object} attendanceData - Attendance data
   * @returns {Promise} Response with created attendance record
   */
  createAttendanceRecord: async (attendanceData) => {
    try {
      const response = await api.post('/api/attendance', attendanceData);
      return response;
    } catch (error) {
      console.error('Error creating attendance record:', error);
      throw error;
    }
  },

  /**
   * Get all attendance records
   * GET /api/attendance
   * @returns {Promise} List of all attendance records
   */
  getAllAttendanceRecords: async () => {
    try {
      const response = await api.get('/api/attendance');
      return response;
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      throw error;
    }
  },

  /**
   * Get attendance record by ID
   * GET /api/attendance/{id}
   * @param {string} id - Attendance record ID
   * @returns {Promise} Attendance record details
   */
  getAttendanceById: async (id) => {
    try {
      const response = await api.get(`/api/attendance/${id}`);
      return response;
    } catch (error) {
      console.error(`Error fetching attendance record ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get attendance records by employee ID
   * GET /api/attendance/employee/{employeeId}
   * @param {string} employeeId - Employee ID
   * @returns {Promise} List of attendance records for employee
   */
  getAttendanceByEmployeeId: async (employeeId) => {
    try {
      const response = await api.get(`/api/attendance/employee/${employeeId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching attendance for employee ${employeeId}:`, error);
      throw error;
    }
  },

  /**
   * Get attendance records by month and year
   * GET /api/attendance/period?month={month}&year={year}
   * @param {string} month - Month name (e.g., "January")
   * @param {string} year - Year (e.g., "2026")
   * @returns {Promise} List of attendance records for the period
   */
  getAttendanceByPeriod: async (month, year) => {
    try {
      const response = await api.get('/api/attendance/period', {
        params: { month, year },
      });
      return response;
    } catch (error) {
      console.error(`Error fetching attendance for ${month} ${year}:`, error);
      throw error;
    }
  },

  /**
   * Update attendance record
   * PUT /api/attendance/{id}
   * @param {string} id - Attendance record ID
   * @param {object} attendanceData - Updated attendance data
   * @returns {Promise} Updated attendance record
   */
  updateAttendanceRecord: async (id, attendanceData) => {
    try {
      const response = await api.put(`/api/attendance/${id}`, attendanceData);
      return response;
    } catch (error) {
      console.error(`Error updating attendance record ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete attendance record
   * DELETE /api/attendance/{id}
   * @param {string} id - Attendance record ID
   * @returns {Promise} Deletion confirmation
   */
  deleteAttendanceRecord: async (id) => {
    try {
      const response = await api.delete(`/api/attendance/${id}`);
      return response;
    } catch (error) {
      console.error(`Error deleting attendance record ${id}:`, error);
      throw error;
    }
  },
};

export default AttendanceService;
