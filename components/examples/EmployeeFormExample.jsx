import React, { useState } from 'react';
import EmployeeService from '../services/employeeService';
import { useAppContext } from '../contexts/AppContext';

/**
 * Example Employee Form Component
 * Demonstrates how to integrate with the backend API using EmployeeService
 */
const EmployeeFormExample = () => {
  const { showToast } = useAppContext();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'Male',
    contactNumber: '',
    personalEmail: '',
    currentAddress: '',
    type: 'full-time',
    department: 'IT',
    designation: '',
    officialEmail: '',
    workLocation: 'Bangalore',
    probationPeriod: 6,
    ctc: '',
    basic: '',
    net: '',
    paymentMode: 'Bank',
    status: 'active',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  /**
   * Handle input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else if (!/^\d{10}$/.test(formData.contactNumber)) {
      newErrors.contactNumber = 'Contact number must be 10 digits';
    }
    if (!formData.personalEmail.trim()) {
      newErrors.personalEmail = 'Personal email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.personalEmail)) {
      newErrors.personalEmail = 'Invalid email format';
    }
    if (!formData.officialEmail.trim()) {
      newErrors.officialEmail = 'Official email is required';
    }
    if (!formData.ctc || formData.ctc <= 0) {
      newErrors.ctc = 'CTC must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Please fix the errors in the form', 'error');
      return;
    }

    setLoading(true);

    try {
      // Call the API using EmployeeService
      const response = await EmployeeService.createEmployee({
        ...formData,
        ctc: parseFloat(formData.ctc),
        basic: parseFloat(formData.basic),
        net: parseFloat(formData.net),
        probationPeriod: parseInt(formData.probationPeriod),
      });

      if (response.success) {
        showToast(response.message || 'Employee created successfully!', 'success');
        console.log('Created employee:', response.data);
        
        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          gender: 'Male',
          contactNumber: '',
          personalEmail: '',
          currentAddress: '',
          type: 'full-time',
          department: 'IT',
          designation: '',
          officialEmail: '',
          workLocation: 'Bangalore',
          probationPeriod: 6,
          ctc: '',
          basic: '',
          net: '',
          paymentMode: 'Bank',
          status: 'active',
        });
      } else {
        showToast(response.message || 'Failed to create employee', 'error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      
      // Handle validation errors from backend
      if (error.data && typeof error.data === 'object') {
        setErrors(error.data);
        showToast('Validation failed. Please check the form.', 'error');
      } else {
        showToast(error.message || 'Failed to create employee. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="employee-form-example">
      <h2>Create New Employee (API Integration Example)</h2>
      
      <form onSubmit={handleSubmit} className="form-container">
        {/* Personal Information */}
        <section>
          <h3>Personal Information</h3>
          
          <div className="form-group">
            <label>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className={errors.firstName ? 'error' : ''}
            />
            {errors.firstName && <span className="error-text">{errors.firstName}</span>}
          </div>

          <div className="form-group">
            <label>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className={errors.lastName ? 'error' : ''}
            />
            {errors.lastName && <span className="error-text">{errors.lastName}</span>}
          </div>

          <div className="form-group">
            <label>Gender *</label>
            <select name="gender" value={formData.gender} onChange={handleChange}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Contact Number *</label>
            <input
              type="text"
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleChange}
              placeholder="10-digit number"
              maxLength="10"
              className={errors.contactNumber ? 'error' : ''}
            />
            {errors.contactNumber && <span className="error-text">{errors.contactNumber}</span>}
          </div>

          <div className="form-group">
            <label>Personal Email *</label>
            <input
              type="email"
              name="personalEmail"
              value={formData.personalEmail}
              onChange={handleChange}
              className={errors.personalEmail ? 'error' : ''}
            />
            {errors.personalEmail && <span className="error-text">{errors.personalEmail}</span>}
          </div>

          <div className="form-group">
            <label>Current Address *</label>
            <textarea
              name="currentAddress"
              value={formData.currentAddress}
              onChange={handleChange}
              rows="3"
            />
          </div>
        </section>

        {/* Employment Details */}
        <section>
          <h3>Employment Details</h3>
          
          <div className="form-group">
            <label>Employment Type *</label>
            <select name="type" value={formData.type} onChange={handleChange}>
              <option value="full-time">Full Time</option>
              <option value="part-time">Part Time</option>
            </select>
          </div>

          <div className="form-group">
            <label>Department *</label>
            <select name="department" value={formData.department} onChange={handleChange}>
              <option value="IT">IT</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
            </select>
          </div>

          <div className="form-group">
            <label>Designation *</label>
            <input
              type="text"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Official Email *</label>
            <input
              type="email"
              name="officialEmail"
              value={formData.officialEmail}
              onChange={handleChange}
              className={errors.officialEmail ? 'error' : ''}
            />
            {errors.officialEmail && <span className="error-text">{errors.officialEmail}</span>}
          </div>

          <div className="form-group">
            <label>Work Location *</label>
            <select name="workLocation" value={formData.workLocation} onChange={handleChange}>
              <option value="Bangalore">Bangalore</option>
              <option value="Mangaluru">Mangaluru</option>
              <option value="Mysore">Mysore</option>
              <option value="Remote">Remote</option>
            </select>
          </div>

          <div className="form-group">
            <label>Probation Period (months)</label>
            <input
              type="number"
              name="probationPeriod"
              value={formData.probationPeriod}
              onChange={handleChange}
              min="0"
            />
          </div>
        </section>

        {/* Salary Information */}
        <section>
          <h3>Salary Information</h3>
          
          <div className="form-group">
            <label>CTC (Annual) *</label>
            <input
              type="number"
              name="ctc"
              value={formData.ctc}
              onChange={handleChange}
              min="0"
              step="1000"
              className={errors.ctc ? 'error' : ''}
            />
            {errors.ctc && <span className="error-text">{errors.ctc}</span>}
          </div>

          <div className="form-group">
            <label>Basic Salary (Monthly)</label>
            <input
              type="number"
              name="basic"
              value={formData.basic}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="form-group">
            <label>Net Salary (Monthly)</label>
            <input
              type="number"
              name="net"
              value={formData.net}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="form-group">
            <label>Payment Mode *</label>
            <select name="paymentMode" value={formData.paymentMode} onChange={handleChange}>
              <option value="Bank">Bank</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          <div className="form-group">
            <label>Status *</label>
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </section>

        {/* Submit Button */}
        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Employee'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmployeeFormExample;
