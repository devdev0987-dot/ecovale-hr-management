import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getEmployees, getAttendanceRecords, saveAttendanceRecord, deleteAttendanceRecord } from '../services/storageService';
import { Employee, AttendanceRecord } from '../types';
import { Plus, Edit, Trash2, Search, Calendar, UserCheck } from 'lucide-react';

const AttendanceRegisterPage: React.FC = () => {
  const { showToast } = useAppContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  
  const [formData, setFormData] = useState({
    employeeId: '',
    month: '',
    year: new Date().getFullYear().toString(),
    totalWorkingDays: 26,
    presentDays: 0,
    absentDays: 0,
    paidLeave: 0,
    unpaidLeave: 0,
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
    loadAttendanceRecords();
  }, []);

  const loadEmployees = async () => {
    try {
      const empList = await getEmployees();
      setEmployees(empList.filter(e => e.status === 'active'));
    } catch (error) {
      showToast('Failed to load employees', 'error');
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      const records = await getAttendanceRecords();
      setAttendanceRecords(records);
    } catch (error) {
      showToast('Failed to load attendance records', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      month: '',
      year: new Date().getFullYear().toString(),
      totalWorkingDays: 26,
      presentDays: 0,
      absentDays: 0,
      paidLeave: 0,
      unpaidLeave: 0,
      remarks: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.month) {
      showToast('Please select employee and month', 'error');
      return;
    }

    if (formData.totalWorkingDays <= 0) {
      showToast('Total working days must be greater than 0', 'error');
      return;
    }

    const totalDays = formData.presentDays + formData.absentDays + formData.paidLeave + formData.unpaidLeave;
    if (totalDays > formData.totalWorkingDays) {
      showToast('Total days cannot exceed working days', 'error');
      return;
    }

    const employee = employees.find(emp => emp.id === formData.employeeId);
    if (!employee) {
      showToast('Employee not found', 'error');
      return;
    }

    try {
      await saveAttendanceRecord({
        employeeId: formData.employeeId,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        month: formData.month,
        year: formData.year,
        totalWorkingDays: formData.totalWorkingDays,
        presentDays: formData.presentDays,
        absentDays: formData.absentDays,
        paidLeave: formData.paidLeave,
        unpaidLeave: formData.unpaidLeave,
        remarks: formData.remarks
      });

      showToast(
        editingId ? 'Attendance record updated successfully' : 'Attendance record saved successfully',
        'success'
      );
      await loadAttendanceRecords();
      resetForm();
    } catch (error) {
      showToast('Failed to save attendance record', 'error');
    }
  };

  const handleEdit = (record: AttendanceRecord) => {
    setFormData({
      employeeId: record.employeeId,
      month: record.month,
      year: record.year,
      totalWorkingDays: record.totalWorkingDays,
      presentDays: record.presentDays,
      absentDays: record.absentDays,
      paidLeave: record.paidLeave,
      unpaidLeave: record.unpaidLeave,
      remarks: record.remarks || ''
    });
    setEditingId(record.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this attendance record?')) {
      try {
        await deleteAttendanceRecord(id);
        showToast('Attendance record deleted successfully', 'success');
        await loadAttendanceRecords();
      } catch (error) {
        showToast('Failed to delete attendance record', 'error');
      }
    }
  };

  const filteredRecords = attendanceRecords.filter(record => {
    const matchesSearch = 
      record.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmployee = !filterEmployee || record.employeeId === filterEmployee;
    const matchesMonth = !filterMonth || record.month === filterMonth;
    const matchesYear = !filterYear || record.year === filterYear;
    
    return matchesSearch && matchesEmployee && matchesMonth && matchesYear;
  });

  // Calculate computed values for form display
  const payableDays = formData.presentDays + formData.paidLeave;
  const lossOfPayDays = formData.unpaidLeave + formData.absentDays;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="text-blue-600" size={32} />
            Attendance Register
          </h1>
          <p className="text-gray-600 mt-1">Manage monthly attendance records</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          {showForm ? 'Cancel' : <><Plus size={20} /> Add Attendance</>}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? 'Edit Attendance Record' : 'New Attendance Record'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Month <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.month}
                  onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Month</option>
                  {months.map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Working Days <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.totalWorkingDays}
                  onChange={(e) => setFormData({ ...formData, totalWorkingDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Present Days
                </label>
                <input
                  type="number"
                  value={formData.presentDays}
                  onChange={(e) => setFormData({ ...formData, presentDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Absent Days
                </label>
                <input
                  type="number"
                  value={formData.absentDays}
                  onChange={(e) => setFormData({ ...formData, absentDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paid Leave (PL)
                </label>
                <input
                  type="number"
                  value={formData.paidLeave}
                  onChange={(e) => setFormData({ ...formData, paidLeave: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unpaid Leave (LWP)
                </label>
                <input
                  type="number"
                  value={formData.unpaidLeave}
                  onChange={(e) => setFormData({ ...formData, unpaidLeave: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>

            {/* Computed Values Display */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Calculated Values</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Payable Days:</span>
                  <div className="font-bold text-green-700">{payableDays}</div>
                  <div className="text-xs text-gray-500">(Present + PL)</div>
                </div>
                <div>
                  <span className="text-gray-600">Loss of Pay Days:</span>
                  <div className="font-bold text-red-700">{lossOfPayDays}</div>
                  <div className="text-xs text-gray-500">(Absent + LWP)</div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remarks
              </label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Optional notes..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingId ? 'Update Record' : 'Save Record'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search size={16} className="inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Employee</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Months</option>
              {months.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Working Days
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Present
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Absent
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PL
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LWP
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payable Days
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LOP Days
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    <Calendar size={48} className="mx-auto mb-2 text-gray-300" />
                    No attendance records found
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.employeeName}</div>
                      <div className="text-sm text-gray-500">{record.employeeId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{record.month} {record.year}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {record.totalWorkingDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 font-medium">
                      {record.presentDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-red-600 font-medium">
                      {record.absentDays}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-blue-600">
                      {record.paidLeave}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-orange-600">
                      {record.unpaidLeave}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {record.payableDays}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {record.lossOfPayDays}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <button
                        onClick={() => handleEdit(record)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Edit"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRecords.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-600">
            Showing {filteredRecords.length} attendance record{filteredRecords.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default AttendanceRegisterPage;
