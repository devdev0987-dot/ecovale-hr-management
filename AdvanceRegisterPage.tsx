import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getEmployees } from '../services/storageService';
import { Employee, AdvanceRecord } from '../types';
import { Plus, Edit, Trash2, Search, DollarSign } from 'lucide-react';

const AdvanceRegisterPage: React.FC = () => {
  const { showToast } = useAppContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  
  const [formData, setFormData] = useState({
    employeeId: '',
    advanceMonth: '',
    advanceYear: new Date().getFullYear().toString(),
    advancePaidAmount: 0,
    advanceDeductionMonth: '',
    advanceDeductionYear: new Date().getFullYear().toString(),
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
    loadAdvances();
  }, []);

  const loadEmployees = async () => {
    try {
      const empList = await getEmployees();
      setEmployees(empList);
    } catch (error) {
      showToast('Failed to load employees', 'error');
    }
  };

  const loadAdvances = () => {
    try {
      const stored = localStorage.getItem('advanceRecords');
      if (stored) {
        setAdvances(JSON.parse(stored));
      }
    } catch (error) {
      showToast('Failed to load advance records', 'error');
    }
  };

  const saveAdvances = (records: AdvanceRecord[]) => {
    localStorage.setItem('advanceRecords', JSON.stringify(records));
    setAdvances(records);
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      advanceMonth: '',
      advanceYear: new Date().getFullYear().toString(),
      advancePaidAmount: 0,
      advanceDeductionMonth: '',
      advanceDeductionYear: new Date().getFullYear().toString(),
      remarks: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.advanceMonth || !formData.advanceDeductionMonth) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    if (formData.advancePaidAmount <= 0) {
      showToast('Advance amount must be greater than 0', 'error');
      return;
    }

    const employee = employees.find(emp => emp.id === formData.employeeId);
    if (!employee) {
      showToast('Employee not found', 'error');
      return;
    }

    if (editingId) {
      // Update existing record
      const updated = advances.map(adv => 
        adv.id === editingId 
          ? {
              ...adv,
              advanceMonth: formData.advanceMonth,
              advanceYear: formData.advanceYear,
              advancePaidAmount: formData.advancePaidAmount,
              advanceDeductionMonth: formData.advanceDeductionMonth,
              advanceDeductionYear: formData.advanceDeductionYear,
              remarks: formData.remarks,
              status: 'pending' as const,
              remainingAmount: formData.advancePaidAmount,
              updatedAt: new Date().toISOString()
            }
          : adv
      );
      saveAdvances(updated);
      showToast('Advance record updated successfully', 'success');
    } else {
      // Create new record
      const newAdvance: AdvanceRecord = {
        id: `ADV${Date.now()}`,
        employeeId: formData.employeeId,
        employeeName: employee.personalInfo.firstName + ' ' + employee.personalInfo.lastName,
        advanceMonth: formData.advanceMonth,
        advanceYear: formData.advanceYear,
        advancePaidAmount: formData.advancePaidAmount,
        advanceDeductionMonth: formData.advanceDeductionMonth,
        advanceDeductionYear: formData.advanceDeductionYear,
        remarks: formData.remarks,
        status: 'pending',
        remainingAmount: formData.advancePaidAmount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveAdvances([...advances, newAdvance]);
      showToast('Advance record added successfully', 'success');
    }

    resetForm();
  };

  const handleEdit = (advance: AdvanceRecord) => {
    setFormData({
      employeeId: advance.employeeId,
      advanceMonth: advance.advanceMonth,
      advanceYear: advance.advanceYear,
      advancePaidAmount: advance.advancePaidAmount,
      advanceDeductionMonth: advance.advanceDeductionMonth,
      advanceDeductionYear: advance.advanceDeductionYear,
      remarks: advance.remarks
    });
    setEditingId(advance.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this advance record?')) {
      const updated = advances.filter(adv => adv.id !== id);
      saveAdvances(updated);
      showToast('Advance record deleted successfully', 'success');
    }
  };

  const handleMarkDeducted = (id: string) => {
    const updated = advances.map(adv => 
      adv.id === id 
        ? { ...adv, status: 'deducted' as const, remainingAmount: 0, updatedAt: new Date().toISOString() }
        : adv
    );
    saveAdvances(updated);
    showToast('Marked as deducted', 'success');
  };

  const filteredAdvances = advances.filter(adv => {
    const matchesSearch = adv.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         adv.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = !filterEmployee || adv.employeeId === filterEmployee;
    return matchesSearch && matchesEmployee;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">Pending</span>;
      case 'deducted':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Deducted</span>;
      case 'partial':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Partial</span>;
      default:
        return null;
    }
  };

  const calculateTotalAdvances = () => {
    return filteredAdvances.reduce((sum, adv) => sum + adv.advancePaidAmount, 0);
  };

  const calculatePendingAmount = () => {
    return filteredAdvances
      .filter(adv => adv.status === 'pending')
      .reduce((sum, adv) => sum + adv.remainingAmount, 0);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Advance Register</h1>
              <p className="text-gray-600 mt-2">Manage employee advances and deductions</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold flex items-center gap-2"
            >
              <Plus size={20} />
              {showForm ? 'Cancel' : 'Add Advance'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Advances</p>
                <p className="text-2xl font-bold text-gray-800">₹ {calculateTotalAdvances().toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <DollarSign className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Deductions</p>
                <p className="text-2xl font-bold text-gray-800">₹ {calculatePendingAmount().toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-800">{filteredAdvances.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {editingId ? 'Edit Advance Record' : 'Add New Advance'}
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
                    Advance Paid Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.advancePaidAmount}
                    onChange={(e) => setFormData({ ...formData, advancePaidAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Advance Given Month <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formData.advanceMonth}
                      onChange={(e) => setFormData({ ...formData, advanceMonth: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Month</option>
                      {months.map(month => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                    <select
                      value={formData.advanceYear}
                      onChange={(e) => setFormData({ ...formData, advanceYear: e.target.value })}
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
                    Deduction in Month <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={formData.advanceDeductionMonth}
                      onChange={(e) => setFormData({ ...formData, advanceDeductionMonth: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Month</option>
                      {months.map(month => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                    <select
                      value={formData.advanceDeductionYear}
                      onChange={(e) => setFormData({ ...formData, advanceDeductionYear: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
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
                  {editingId ? 'Update' : 'Add'} Advance
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

        {/* Advance Records Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Given Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deduction Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No advance records found. Click "Add Advance" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredAdvances.map((advance) => (
                    <tr key={advance.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{advance.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{advance.employeeName}</div>
                        <div className="text-sm text-gray-500">{advance.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {advance.advanceMonth} {advance.advanceYear}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        ₹ {advance.advancePaidAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {advance.advanceDeductionMonth} {advance.advanceDeductionYear}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(advance.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          {advance.status === 'pending' && (
                            <button
                              onClick={() => handleMarkDeducted(advance.id)}
                              className="text-green-600 hover:text-green-800"
                              title="Mark as Deducted"
                            >
                              ✓
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(advance)}
                            className="text-indigo-600 hover:text-indigo-800"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(advance.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
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

export default AdvanceRegisterPage;
