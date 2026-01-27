
import React, { useState, useEffect } from 'react';
import { getEmployees, updateEmployee } from '../services/storageService';
import { Employee, CareerHistoryItem } from '../types';
import Button from '../components/ui/Button';
import { useAppContext } from '../contexts/AppContext';

const CareerPage: React.FC = () => {
    const { showToast } = useAppContext();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [activeTab, setActiveTab] = useState<'promotions' | 'increments' | 'demotions'>('promotions');
    const [showAddModal, setShowAddModal] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        previousDesignation: '',
        newDesignation: '',
        previousSalary: '',
        newSalary: '',
        details: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const emps = await getEmployees();
                setEmployees(emps);
            } catch (error) {
                showToast('Failed to load employees', 'error');
            }
        };
        fetchEmployees();
    }, [showToast]);

    const handleAddCareerRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployee) {
            showToast('Please select an employee', 'error');
            return;
        }
        if (!formData.date || !formData.newDesignation) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const newRecord: CareerHistoryItem = {
                type: activeTab,
                date: formData.date,
                details: {
                    previousDesignation: formData.previousDesignation || 'N/A',
                    newDesignation: formData.newDesignation,
                    previousSalary: formData.previousSalary ? Number(formData.previousSalary) : undefined,
                    newSalary: formData.newSalary ? Number(formData.newSalary) : undefined,
                    notes: formData.details,
                    recordedAt: new Date().toISOString(),
                },
            };

            const updatedEmployee: Employee = {
                ...selectedEmployee,
                careerHistory: [...(selectedEmployee.careerHistory || []), newRecord],
                updatedAt: new Date().toISOString(),
            };

            await updateEmployee(updatedEmployee);
            setSelectedEmployee(updatedEmployee);
            
            // Update the employees list
            const updatedEmployees = employees.map(emp => emp.id === selectedEmployee.id ? updatedEmployee : emp);
            setEmployees(updatedEmployees);

            showToast(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} record added successfully`, 'success');
            setShowAddModal(false);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                previousDesignation: '',
                newDesignation: '',
                previousSalary: '',
                newSalary: '',
                details: '',
            });
        } catch (error) {
            showToast('Failed to add career record', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getCareerRecords = () => {
        if (!selectedEmployee || !selectedEmployee.careerHistory) return [];
        return selectedEmployee.careerHistory.filter(record => record.type === activeTab);
    };

    const renderContent = () => {
        if (!selectedEmployee) {
            return (
                <div className="p-8 text-center">
                    <p className="text-gray-600 mb-4">Select an employee to view and manage career records</p>
                </div>
            );
        }

        const records = getCareerRecords();
        const typeLabel = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

        return (
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold">{typeLabel} History</h3>
                    <Button onClick={() => setShowAddModal(true)} size="sm">Add {typeLabel}</Button>
                </div>

                {records.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No {activeTab} records found</p>
                ) : (
                    <div className="space-y-4">
                        {records.map((record, idx) => (
                            <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            {record.details.previousDesignation} → {record.details.newDesignation}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Date: {new Date(record.date).toLocaleDateString()}
                                        </p>
                                        {record.details.previousSalary && record.details.newSalary && (
                                            <p className="text-sm text-gray-600">
                                                Salary: ₹{record.details.previousSalary.toLocaleString()} → ₹{record.details.newSalary.toLocaleString()}
                                            </p>
                                        )}
                                        {record.details.notes && (
                                            <p className="text-sm text-gray-700 mt-2">
                                                <strong>Notes:</strong> {record.details.notes}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {new Date(record.details.recordedAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const TabButton = ({ tabName, label }: { tabName: 'promotions' | 'increments' | 'demotions'; label: string }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === tabName ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        >
            {label}
        </button>
    );

    return (
        <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Career Management</h2>

            {/* Employee Selection */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select
                        value={selectedEmployee?.id || ''}
                        onChange={(e) => {
                            const emp = employees.find(e => e.id === e.target.value);
                            setSelectedEmployee(emp || null);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="">Choose an employee...</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {emp.personalInfo.firstName} {emp.personalInfo.lastName} ({emp.employmentDetails.designation})
                            </option>
                        ))}
                    </select>
                    {selectedEmployee && (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <p className="font-semibold text-gray-800">
                                {selectedEmployee.personalInfo.firstName} {selectedEmployee.personalInfo.lastName}
                            </p>
                            <p className="text-sm text-gray-600">{selectedEmployee.employmentDetails.designation}</p>
                            <p className="text-sm text-gray-600">{selectedEmployee.employmentDetails.department}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Career Records */}
            <div className="bg-white rounded-lg shadow-md">
                <div className="p-4 border-b">
                    <div className="flex space-x-2">
                        <TabButton tabName="promotions" label="Promotions" />
                        <TabButton tabName="increments" label="Increments" />
                        <TabButton tabName="demotions" label="Demotions" />
                    </div>
                </div>
                <div>{renderContent()}</div>
            </div>

            {/* Add Record Modal */}
            {showAddModal && selectedEmployee && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-md w-full max-w-2xl max-h-96 overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">
                            Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Record
                        </h3>
                        <form onSubmit={handleAddCareerRecord} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date*</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Previous Designation</label>
                                    <input
                                        type="text"
                                        value={formData.previousDesignation}
                                        onChange={(e) => setFormData({ ...formData, previousDesignation: e.target.value })}
                                        placeholder={selectedEmployee.employmentDetails.designation}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Designation*</label>
                                    <input
                                        type="text"
                                        value={formData.newDesignation}
                                        onChange={(e) => setFormData({ ...formData, newDesignation: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Previous Salary (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.previousSalary}
                                        onChange={(e) => setFormData({ ...formData, previousSalary: e.target.value })}
                                        placeholder={selectedEmployee.salaryInfo.gross.toString()}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Salary (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.newSalary}
                                        onChange={(e) => setFormData({ ...formData, newSalary: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Details/Notes</label>
                                <textarea
                                    value={formData.details}
                                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                                    placeholder="Additional details about this career action"
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded-md"
                                />
                            </div>
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 border rounded-md text-gray-700"
                                >
                                    Cancel
                                </button>
                                <Button type="submit" isLoading={isSubmitting}>
                                    Add Record
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CareerPage;

