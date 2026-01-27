
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, MoreVertical, Eye, Edit, Trash2, FileText } from 'lucide-react';
import { getEmployees, deleteEmployee } from '../services/storageService';
import { Employee } from '../types';
import { formatDate } from '../utils/helpers';
import { EMPLOYEE_TYPE_LABELS } from '../utils/constants';
import Button from '../components/ui/Button';
import { useAppContext } from '../contexts/AppContext';

const EmployeesPage: React.FC = () => {
  const { setActivePage, showToast, setSelectedEmployeeId, employeesVersion } = useAppContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // TODO: Add more filters from the spec
  const [filters, setFilters] = useState({ type: 'all', status: 'all' });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Employee | 'name', direction: 'asc' | 'desc' }>({ key: 'id', direction: 'asc' });

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setLoading(true);
        const data = await getEmployees();
        setEmployees(data);
      } catch (error) {
        showToast('Failed to load employees', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadEmployees();
  }, [showToast, employeesVersion]);

  const filteredAndSortedEmployees = useMemo(() => {
    let filtered = [...employees];
    if (searchTerm) {
      filtered = filtered.filter(emp =>
        `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    filtered.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'name') {
            aValue = `${a.personalInfo.firstName} ${a.personalInfo.lastName}`;
            bValue = `${b.personalInfo.firstName} ${b.personalInfo.lastName}`;
        } else if (sortConfig.key === 'id') {
            aValue = a.id;
            bValue = b.id;
        } else {
             aValue = a.employmentDetails[sortConfig.key] || '';
             bValue = b.employmentDetails[sortConfig.key] || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    return filtered;
  }, [employees, searchTerm, sortConfig]);

  const requestSort = (key) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
        try {
            await deleteEmployee(id);
            setEmployees(prev => prev.filter(emp => emp.id !== id));
            showToast('Employee deleted successfully', 'success');
        } catch (error) {
            showToast('Failed to delete employee', 'error');
        }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Employees</h2>
        <Button onClick={() => setActivePage('new-employee')}>
          <Plus size={18} className="mr-2" />
          Add Employee
        </Button>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              className="w-full md:w-96 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="p-4"><input type="checkbox" /></th>
                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('id')}>ID</th>
                <th scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort('name')}>Name</th>
                <th scope="col" className="px-6 py-3">Type</th>
                <th scope="col" className="px-6 py-3">Designation</th>
                <th scope="col" className="px-6 py-3">Join Date</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedEmployees.map(emp => (
                <tr key={emp.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="p-4"><input type="checkbox" /></td>
                  <td className="px-6 py-4 font-medium text-gray-900">{emp.id}</td>
                  <td className="px-6 py-4 flex items-center space-x-3">
                    <img className="w-10 h-10 rounded-full" src={emp.personalInfo.photo || `https://i.pravatar.cc/150?u=${emp.id}`} alt="avatar" />
                    <div>
                      <div className="font-semibold text-gray-800">{`${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`}</div>
                      <div className="text-xs text-gray-500">{emp.employmentDetails.officialEmail}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${emp.employmentDetails.type === 'full-time' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {EMPLOYEE_TYPE_LABELS[emp.employmentDetails.type] || emp.employmentDetails.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">{emp.employmentDetails.designation}</td>
                  <td className="px-6 py-4">{formatDate(emp.employmentDetails.joinDate)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                        <button className="text-gray-500 hover:text-blue-600" title="View"><Eye size={18} /></button>
                        <button className="text-gray-500 hover:text-indigo-600" title="Onboarding" onClick={() => { setSelectedEmployeeId(emp.id); setActivePage('onboarding'); }}><FileText size={18} /></button>
                        <button className="text-gray-500 hover:text-green-600" title="Edit" onClick={() => { setSelectedEmployeeId(emp.id); setActivePage('new-employee'); }}><Edit size={18} /></button>
                        <button onClick={() => handleDelete(emp.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAndSortedEmployees.length === 0 && (
            <div className="text-center py-8 text-gray-500">No employees found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeesPage;
