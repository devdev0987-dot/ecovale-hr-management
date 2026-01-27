import React, { useState, useEffect } from 'react';
import LoanService from '../services/loanService';
import EmployeeService from '../services/employeeService';
import { useAppContext } from '../contexts/AppContext';

/**
 * Example Loan Form Component
 * Demonstrates how to integrate with the backend API using LoanService
 */
const LoanFormExample = () => {
  const { showToast } = useAppContext();
  
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    employeeName: '',
    loanAmount: '',
    interestRate: 10,
    numberOfEMIs: 12,
    emiAmount: 0,
    totalAmount: 0,
    startMonth: 'February 2026',
    startYear: '2026',
    totalPaidEMIs: 0,
    remainingBalance: 0,
    status: 'active',
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
   * Auto-calculate EMI and total amount when loan details change
   */
  useEffect(() => {
    const principal = parseFloat(formData.loanAmount) || 0;
    const rate = parseFloat(formData.interestRate) || 0;
    const tenure = parseInt(formData.numberOfEMIs) || 1;

    if (principal > 0 && tenure > 0) {
      // Calculate EMI using reducing balance method
      const monthlyRate = rate / 12 / 100;
      let emiAmount;
      
      if (rate === 0) {
        emiAmount = principal / tenure;
      } else {
        emiAmount = principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) / 
                    (Math.pow(1 + monthlyRate, tenure) - 1);
      }

      const totalAmount = emiAmount * tenure;
      const remainingBalance = totalAmount;

      setFormData(prev => ({
        ...prev,
        emiAmount: parseFloat(emiAmount.toFixed(2)),
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        remainingBalance: parseFloat(remainingBalance.toFixed(2)),
      }));
    }
  }, [formData.loanAmount, formData.interestRate, formData.numberOfEMIs]);

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

    if (formData.loanAmount <= 0) {
      showToast('Loan amount must be greater than zero', 'error');
      return;
    }

    setLoading(true);

    try {
      // Prepare loan data
      const loanData = {
        ...formData,
        loanAmount: parseFloat(formData.loanAmount),
        interestRate: parseFloat(formData.interestRate),
        numberOfEMIs: parseInt(formData.numberOfEMIs),
        emiAmount: parseFloat(formData.emiAmount),
        totalAmount: parseFloat(formData.totalAmount),
        totalPaidEMIs: parseInt(formData.totalPaidEMIs),
        remainingBalance: parseFloat(formData.remainingBalance),
      };

      // Call the API using LoanService
      const response = await LoanService.createLoanRecord(loanData);

      if (response.success) {
        showToast(response.message || 'Loan record created successfully!', 'success');
        console.log('Created loan:', response.data);
        
        // Reset form
        setFormData({
          employeeId: '',
          employeeName: '',
          loanAmount: '',
          interestRate: 10,
          numberOfEMIs: 12,
          emiAmount: 0,
          totalAmount: 0,
          startMonth: 'February 2026',
          startYear: '2026',
          totalPaidEMIs: 0,
          remainingBalance: 0,
          status: 'active',
          remarks: '',
        });
      } else {
        showToast(response.message || 'Failed to create loan record', 'error');
      }
    } catch (error) {
      console.error('Error submitting loan:', error);
      showToast(error.message || 'Failed to create loan record', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loan-form-example">
      <h2>Create Loan Record (API Integration Example)</h2>
      
      <form onSubmit={handleSubmit} className="form-container">
        <section>
          <h3>Loan Information</h3>
          
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

          <div className="form-group">
            <label>Loan Amount *</label>
            <input
              type="number"
              name="loanAmount"
              value={formData.loanAmount}
              onChange={handleChange}
              min="1"
              step="1000"
              required
              placeholder="Enter loan amount"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Interest Rate (%) *</label>
              <input
                type="number"
                name="interestRate"
                value={formData.interestRate}
                onChange={handleChange}
                min="0"
                step="0.1"
                required
              />
            </div>

            <div className="form-group">
              <label>Number of EMIs *</label>
              <input
                type="number"
                name="numberOfEMIs"
                value={formData.numberOfEMIs}
                onChange={handleChange}
                min="1"
                required
              />
            </div>
          </div>

          <div className="form-row calculated">
            <div className="form-group">
              <label>EMI Amount (Auto-calculated)</label>
              <input
                type="number"
                name="emiAmount"
                value={formData.emiAmount}
                readOnly
                className="readonly"
              />
            </div>

            <div className="form-group">
              <label>Total Amount (Auto-calculated)</label>
              <input
                type="number"
                name="totalAmount"
                value={formData.totalAmount}
                readOnly
                className="readonly"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Month *</label>
              <input
                type="text"
                name="startMonth"
                value={formData.startMonth}
                onChange={handleChange}
                required
                placeholder="e.g., February 2026"
              />
            </div>

            <div className="form-group">
              <label>Start Year *</label>
              <input
                type="text"
                name="startYear"
                value={formData.startYear}
                onChange={handleChange}
                required
                placeholder="2026"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Status *</label>
            <select name="status" value={formData.status} onChange={handleChange} required>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="form-group">
            <label>Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows="3"
              placeholder="Optional remarks about the loan..."
            />
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Create Loan Record'}
          </button>
        </div>
      </form>

      {/* Display calculated summary */}
      {formData.loanAmount > 0 && (
        <div className="loan-summary">
          <h4>Loan Summary</h4>
          <p><strong>Principal:</strong> ₹{parseFloat(formData.loanAmount).toLocaleString()}</p>
          <p><strong>Interest Rate:</strong> {formData.interestRate}%</p>
          <p><strong>EMI Amount:</strong> ₹{formData.emiAmount.toLocaleString()}</p>
          <p><strong>Total Payable:</strong> ₹{formData.totalAmount.toLocaleString()}</p>
          <p><strong>Total Interest:</strong> ₹{(formData.totalAmount - formData.loanAmount).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
};

export default LoanFormExample;
