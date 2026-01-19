import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getEmployees } from '../services/storageService';
import { Employee, LoanRecord, LoanEMI } from '../types';
import { Plus, Edit, Trash2, Search, TrendingUp, Calendar } from 'lucide-react';

const LoanRegisterPage: React.FC = () => {
  const { showToast } = useAppContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [showEMISchedule, setShowEMISchedule] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    loanAmount: 0,
    interestRate: 0,
    numberOfEMIs: 12,
    startMonth: '',
    startYear: new Date().getFullYear().toString(),
    emiAmount: 0,
    remarks: ''
  });

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    loadEmployees();
    loadLoans();
  }, []);

  useEffect(() => {
    calculateEMI();
  }, [formData.loanAmount, formData.interestRate, formData.numberOfEMIs]);

  const loadEmployees = async () => {
    try {
      const empList = await getEmployees();
      setEmployees(empList);
    } catch (error) {
      showToast('Failed to load employees', 'error');
    }
  };

  const loadLoans = () => {
    try {
      const stored = localStorage.getItem('loanRecords');
      if (stored) {
        setLoans(JSON.parse(stored));
      }
    } catch (error) {
      showToast('Failed to load loan records', 'error');
    }
  };

  const saveLoans = (records: LoanRecord[]) => {
    localStorage.setItem('loanRecords', JSON.stringify(records));
    setLoans(records);
  };

  const calculateEMI = () => {
    if (formData.loanAmount > 0 && formData.numberOfEMIs > 0) {
      const totalAmount = formData.loanAmount + (formData.loanAmount * formData.interestRate / 100);
      const emi = totalAmount / formData.numberOfEMIs;
      setFormData(prev => ({ ...prev, emiAmount: parseFloat(emi.toFixed(2)) }));
    }
  };

  const generateEMISchedule = (startMonth: string, startYear: string, numberOfEMIs: number, emiAmount: number): LoanEMI[] => {
    const schedule: LoanEMI[] = [];
    let monthIndex = months.indexOf(startMonth);
    let year = parseInt(startYear);

    for (let i = 0; i < numberOfEMIs; i++) {
      schedule.push({
        month: months[monthIndex],
        year: year.toString(),
        emiAmount: emiAmount,
        status: 'pending'
      });

      monthIndex++;
      if (monthIndex >= 12) {
        monthIndex = 0;
        year++;
      }
    }

    return schedule;
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      loanAmount: 0,
      interestRate: 0,
      numberOfEMIs: 12,
      startMonth: '',
      startYear: new Date().getFullYear().toString(),
      emiAmount: 0,
      remarks: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.startMonth) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    if (formData.loanAmount <= 0) {
      showToast('Loan amount must be greater than 0', 'error');
      return;
    }

    if (formData.numberOfEMIs <= 0) {
      showToast('Number of EMIs must be greater than 0', 'error');
      return;
    }

    const employee = employees.find(emp => emp.id === formData.employeeId);
    if (!employee) {
      showToast('Employee not found', 'error');
      return;
    }

    const totalAmount = formData.loanAmount + (formData.loanAmount * formData.interestRate / 100);
    const emiSchedule = generateEMISchedule(formData.startMonth, formData.startYear, formData.numberOfEMIs, formData.emiAmount);

    if (editingId) {
      // Update existing record
      const updated = loans.map(loan => 
        loan.id === editingId 
          ? {
              ...loan,
              loanAmount: formData.loanAmount,
              interestRate: formData.interestRate,
              numberOfEMIs: formData.numberOfEMIs,
              emiAmount: formData.emiAmount,
              totalAmount: totalAmount,
              startMonth: formData.startMonth,
              startYear: formData.startYear,
              emiSchedule: emiSchedule,
              remainingBalance: totalAmount,
              remarks: formData.remarks,
              updatedAt: new Date().toISOString()
            }
          : loan
      );
      saveLoans(updated);
      showToast('Loan record updated successfully', 'success');
    } else {
      // Create new record
      const newLoan: LoanRecord = {
        id: `LOAN${Date.now()}`,
        employeeId: formData.employeeId,
        employeeName: employee.personalInfo.firstName + ' ' + employee.personalInfo.lastName,
        loanAmount: formData.loanAmount,
        interestRate: formData.interestRate,
        numberOfEMIs: formData.numberOfEMIs,
        emiAmount: formData.emiAmount,
        totalAmount: totalAmount,
        startMonth: formData.startMonth,
        startYear: formData.startYear,
        emiSchedule: emiSchedule,
        totalPaidEMIs: 0,
        remainingBalance: totalAmount,
        status: 'active',
        remarks: formData.remarks,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveLoans([...loans, newLoan]);
      showToast('Loan record added successfully', 'success');
    }

    resetForm();
  };

  const handleEdit = (loan: LoanRecord) => {
    setFormData({
      employeeId: loan.employeeId,
      loanAmount: loan.loanAmount,
      interestRate: loan.interestRate,
      numberOfEMIs: loan.numberOfEMIs,
      startMonth: loan.startMonth,
      startYear: loan.startYear,
      emiAmount: loan.emiAmount,
      remarks: loan.remarks
    });
    setEditingId(loan.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this loan record?')) {
      const updated = loans.filter(loan => loan.id !== id);
      saveLoans(updated);
      showToast('Loan record deleted successfully', 'success');
    }
  };

  const handleMarkEMIPaid = (loanId: string, emiIndex: number) => {
    const updated = loans.map(loan => {
      if (loan.id === loanId) {
        const updatedSchedule = [...loan.emiSchedule];
        updatedSchedule[emiIndex] = {
          ...updatedSchedule[emiIndex],
          status: 'paid',
          paidDate: new Date().toISOString()
        };

        const paidEMIs = updatedSchedule.filter(emi => emi.status === 'paid').length;
        const remainingBalance = loan.totalAmount - (paidEMIs * loan.emiAmount);
        const status = paidEMIs === loan.numberOfEMIs ? 'completed' : 'active';

        return {
          ...loan,
          emiSchedule: updatedSchedule,
          totalPaidEMIs: paidEMIs,
          remainingBalance: Math.max(0, remainingBalance),
          status: status as 'active' | 'completed',
          updatedAt: new Date().toISOString()
        };
      }
      return loan;
    });
    saveLoans(updated);
    showToast('EMI marked as paid', 'success');
  };

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = loan.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         loan.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = !filterEmployee || loan.employeeId === filterEmployee;
    return matchesSearch && matchesEmployee;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Active</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Cancelled</span>;
      default:
        return null;
    }
  };

  const calculateTotalLoans = () => {
    return filteredLoans.reduce((sum, loan) => sum + loan.loanAmount, 0);
  };

  const calculateTotalOutstanding = () => {
    return filteredLoans
      .filter(loan => loan.status === 'active')
      .reduce((sum, loan) => sum + loan.remainingBalance, 0);
  };

  const calculateActiveLoans = () => {
    return filteredLoans.filter(loan => loan.status === 'active').length;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Loan Register</h1>
              <p className="text-gray-600 mt-2">Manage employee loans and EMI schedules</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold flex items-center gap-2"
            >
              <Plus size={20} />
              {showForm ? 'Cancel' : 'Add Loan'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Loans</p>
                <p className="text-2xl font-bold text-gray-800">₹ {calculateTotalLoans().toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingUp className="text-red-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Outstanding</p>
                <p className="text-2xl font-bold text-gray-800">₹ {calculateTotalOutstanding().toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Loans</p>
                <p className="text-2xl font-bold text-gray-800">{calculateActiveLoans()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Calendar className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-800">{filteredLoans.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {editingId ? 'Edit Loan Record' : 'Add New Loan'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">-- Select Employee --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.id} - {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loan Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.loanAmount}
                    onChange={(e) => setFormData({ ...formData, loanAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interest Rate (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.interestRate}
                    onChange={(e) => setFormData({ ...formData, interestRate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    min="0"
                    step="0.1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of EMIs <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.numberOfEMIs}
                    onChange={(e) => setFormData({ ...formData, numberOfEMIs: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Month <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formData.startMonth}
                      onChange={(e) => setFormData({ ...formData, startMonth: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Month</option>
                      {months.map(month => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                    <select
                      value={formData.startYear}
                      onChange={(e) => setFormData({ ...formData, startYear: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EMI Amount (Auto-Calculated)
                  </label>
                  <input
                    type="number"
                    value={formData.emiAmount}
                    onChange={(e) => setFormData({ ...formData, emiAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">You can manually override if needed</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks (Optional)</label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    placeholder="Add any additional notes..."
                  />
                </div>

                {/* Calculation Summary */}
                <div className="md:col-span-2 p-4 bg-indigo-50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-2">Calculation Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Loan Amount</p>
                      <p className="font-semibold">₹ {formData.loanAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Interest</p>
                      <p className="font-semibold">₹ {((formData.loanAmount * formData.interestRate) / 100).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Amount</p>
                      <p className="font-semibold">₹ {(formData.loanAmount + (formData.loanAmount * formData.interestRate / 100)).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Monthly EMI</p>
                      <p className="font-semibold text-indigo-600">₹ {formData.emiAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-end mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
                >
                  {editingId ? 'Update' : 'Add'} Loan
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by employee name or ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Employee</label>
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loan Records Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EMI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EMIs (Paid/Total)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      No loan records found. Click "Add Loan" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => (
                    <React.Fragment key={loan.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{loan.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{loan.employeeName}</div>
                          <div className="text-sm text-gray-500">{loan.employeeId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          ₹ {loan.loanAmount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600">
                          ₹ {loan.emiAmount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {loan.totalPaidEMIs} / {loan.numberOfEMIs}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">
                          ₹ {loan.remainingBalance.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(loan.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowEMISchedule(showEMISchedule === loan.id ? null : loan.id)}
                              className="text-blue-600 hover:text-blue-800"
                              title="View EMI Schedule"
                            >
                              📅
                            </button>
                            <button
                              onClick={() => handleEdit(loan)}
                              className="text-indigo-600 hover:text-indigo-800"
                              title="Edit"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(loan.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {showEMISchedule === loan.id && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50">
                            <div className="max-h-96 overflow-y-auto">
                              <h3 className="font-semibold text-gray-800 mb-3">EMI Schedule</h3>
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 text-left">EMI #</th>
                                    <th className="px-4 py-2 text-left">Month</th>
                                    <th className="px-4 py-2 text-left">Amount</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                    <th className="px-4 py-2 text-left">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {loan.emiSchedule.map((emi, index) => (
                                    <tr key={index} className="border-b">
                                      <td className="px-4 py-2">{index + 1}</td>
                                      <td className="px-4 py-2">{emi.month} {emi.year}</td>
                                      <td className="px-4 py-2 font-semibold">₹ {emi.emiAmount.toLocaleString()}</td>
                                      <td className="px-4 py-2">
                                        {emi.status === 'paid' ? (
                                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Paid</span>
                                        ) : (
                                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-2">
                                        {emi.status === 'pending' && (
                                          <button
                                            onClick={() => handleMarkEMIPaid(loan.id, index)}
                                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                                          >
                                            Mark Paid
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanRegisterPage;
