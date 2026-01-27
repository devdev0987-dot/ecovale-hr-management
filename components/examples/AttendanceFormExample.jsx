import React, { useState, useEffect } from 'react';
import AttendanceService from '../services/attendanceService';
import EmployeeService from '../services/employeeService';
import { useAppContext } from '../contexts/AppContext';

/**
 * Example Attendance Form Component
 * Demonstrates how to integrate with the backend API using AttendanceService
 */
const AttendanceFormExample = () => {
  const { showToast } = useAppContext();
  
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    month: 'January',
    year: '2026',
    totalWorkingDays: 26,
    presentDays: 0,
    absentDays: 0,
    paidLeave: 0,
    unpaidLeave: 0,
    payableDays: 0,
    lossOfPayDays: 0,
    remarks: '',
  });

  const [loading, setLoading] = useState(false);

  /**
   * Fetch active employees on component mount
   */
  useEffect(() => {
    fetchEmployees();
  }, []);

  /**
   * Auto-calculate payable days and loss of pay days
   */
  useEffect(() => {
    const payableDays = parseInt(formData.presentDays || 0) + parseInt(formData.paidLeave || 0);
    const lossOfPayDays = parseInt(formData.unpaidLeave || 0) + parseInt(formData.absentDays || 0);
    
    setFormData(prev => ({
      ...prev,
      payableDays,
      lossOfPayDays,
    }));
  }, [formData.presentDays, formData.paidLeave, formData.unpaidLeave, formData.absentDays]);

  /**
   * Fetch active employees from backend
   */
  const fetchEmployees = async () => {
    try {
      const response = await EmployeeService.getActiveEmployees();
      if (response.success && response.data) {
        setEmployees(response.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      showToast('Failed to load employees', 'error');
    }
  };

  /**
   * Handle employee selection
   */
  const handleEmployeeChange = (e) => {
    const employeeId = e.target.value;
    const selectedEmployee = employees.find(emp => emp.id === employeeId);
    
    setFormData(prev => ({
      ...prev,
      employeeId,
      employeeName: selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : '',
    }));
  };

  /**
   * Handle input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.employeeId) {
      showToast('Please select an employee', 'error');
      return;
    }

    setLoading(true);

    try {
      // Convert string values to integers
      const attendanceData = {
        ...formData,
        totalWorkingDays: parseInt(formData.totalWorkingDays),
        presentDays: parseInt(formData.presentDays),
        absentDays: parseInt(formData.absentDays),
        paidLeave: parseInt(formData.paidLeave),
        unpaidLeave: parseInt(formData.unpaidLeave),
        payableDays: parseInt(formData.payableDays),
        lossOfPayDays: parseInt(formData.lossOfPayDays),
      };

      // Call the API using AttendanceService
      const response = await AttendanceService.createAttendanceRecord(attendanceData);

      if (response.success) {
        showToast(response.message || 'Attendance record created successfully!', 'success');
        console.log('Created attendance:', response.data);
        
        // Reset form (keep month and year)
        setFormData({
          employeeId: '',
          employeeName: '',
          month: formData.month,
          year: formData.year,
          totalWorkingDays: 26,
          presentDays: 0,
          absentDays: 0,
          paidLeave: 0,
          unpaidLeave: 0,
          payableDays: 0,
          lossOfPayDays: 0,
          remarks: '',
        });
      } else {
        showToast(response.message || 'Failed to create attendance record', 'error');
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      showToast(error.message || 'Failed to create attendance record', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="attendance-form-example">
      <h2>Create Attendance Record (API Integration Example)</h2>
      
      <form onSubmit={handleSubmit} className="form-container">
        <section>
          <h3>Attendance Information</h3>
          
          <div className="form-group">
            <label>Employee *</label>
            <select
              name="employeeId"
              value={formData.employeeId}
              onChange={handleEmployeeChange}
              required
            >
              <option value="">-- Select Employee --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.department})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Month *</label>
              <select name="month" value={formData.month} onChange={handleChange} required>
                <option value="January">January</option>
                <option value="February">February</option>
                <option value="March">March</option>
                <option value="April">April</option>
                <option value="May">May</option>
                <option value="June">June</option>
                <option value="July">July</option>
                <option value="August">August</option>
                <option value="September">September</option>
                <option value="October">October</option>
                <option value="November">November</option>
                <option value="December">December</option>
              </select>
            </div>

            <div className="form-group">
              <label>Year *</label>
              <input
                type="text"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Total Working Days *</label>
            <input
              type="number"
              name="totalWorkingDays"
              value={formData.totalWorkingDays}
              onChange={handleChange}
              min="1"
              max="31"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Present Days *</label>
              <input
                type="number"
                name="presentDays"
                value={formData.presentDays}
                onChange={handleChange}
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>Absent Days *</label>
              <input
                type="number"
                name="absentDays"
                value={formData.absentDays}
                onChange={handleChange}
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Paid Leave *</label>
              <input
                type="number"
                name="paidLeave"
                value={formData.paidLeave}
                onChange={handleChange}
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>Unpaid Leave *</label>
              <input
                type="number"
                name="unpaidLeave"
                value={formData.unpaidLeave}
                onChange={handleChange}
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-row calculated">
            <div className="form-group">
              <label>Payable Days (Auto-calculated)</label>
              <input
                type="number"
                name="payableDays"
                value={formData.payableDays}
                readOnly
                className="readonly"
              />
            </div>

            <div className="form-group">
              <label>Loss of Pay Days (Auto-calculated)</label>
              <input
                type="number"
                name="lossOfPayDays"
                value={formData.lossOfPayDays}
                readOnly
                className="readonly"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows="3"
              placeholder="Optional remarks..."
            />
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save Attendance Record'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AttendanceFormExample;
