
import React, { useState, useEffect } from 'react';
import { getEmployees, updateEmployee } from '../services/storageService';
import { Employee } from '../types';
import Button from '../components/ui/Button';
import { useAppContext } from '../contexts/AppContext';

type ActiveTab = 'enrollment' | 'statements';


const CalculatorPage: React.FC = () => {
    const { showToast } = useAppContext();
    const [activeTab, setActiveTab] = useState<ActiveTab>('enrollment');
    const [employees, setEmployees] = useState<Employee[]>([]);
    
    // Enrollment Section State
    const [enrollmentEmployeeId, setEnrollmentEmployeeId] = useState('');
    const [esiNumber, setEsiNumber] = useState('');
    const [pfNumber, setPfNumber] = useState('');
    
    // Statements Section State
    const [statementsEmployeeId, setStatementsEmployeeId] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [monthlyDeductions, setMonthlyDeductions] = useState<any>(null);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        const emps = await getEmployees();
        setEmployees(emps);
    };

    // Update enrollment form when employee is selected
    useEffect(() => {
        if (enrollmentEmployeeId) {
            const emp = employees.find(e => e.id === enrollmentEmployeeId);
            if (emp) {
                setEsiNumber(emp.personalInfo.esiNumber || '');
                setPfNumber(emp.personalInfo.pfNumber || '');
            }
        } else {
            setEsiNumber('');
            setPfNumber('');
        }
    }, [enrollmentEmployeeId, employees]);

    // Calculate and display deductions when employee and month are selected
    useEffect(() => {
        if (statementsEmployeeId && selectedMonth) {
            const emp = employees.find(e => e.id === statementsEmployeeId);
            if (emp) {
                // Check if employee is enrolled
                if (!emp.personalInfo.esiNumber && !emp.personalInfo.pfNumber) {
                    setMonthlyDeductions({
                        error: 'Employee is not enrolled in ESI/PF.'
                    });
                    return;
                }

                // Calculate deductions based on employee's salary
                const basic = emp.salaryInfo.basic;
                const gross = emp.salaryInfo.gross;
                
                const pfDeduction = emp.salaryInfo.includePF ? (basic * 0.12) : 0;
                const pfEmployer = emp.salaryInfo.includePF ? (basic * 0.12) : 0;
                
                const esiEligible = gross < 21000 && emp.salaryInfo.includeESI;
                const esiDeduction = esiEligible ? (gross * 0.0075) : 0;
                const esiEmployer = esiEligible ? (gross * 0.0325) : 0;

                setMonthlyDeductions({
                    employeeName: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
                    month: selectedMonth,
                    esiNumber: emp.personalInfo.esiNumber || 'Not Enrolled',
                    pfNumber: emp.personalInfo.pfNumber || 'Not Enrolled',
                    basic,
                    gross,
                    pfDeduction,
                    pfEmployer,
                    esiDeduction,
                    esiEmployer,
                    esiEligible,
                    totalDeductions: pfDeduction + esiDeduction
                });
            }
        } else {
            setMonthlyDeductions(null);
        }
    }, [statementsEmployeeId, selectedMonth, employees]);

    const handleEnrollmentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!enrollmentEmployeeId) {
            showToast('Please select an employee', 'error');
            return;
        }

        if (!esiNumber && !pfNumber) {
            showToast('Please enter at least ESI or PF number', 'error');
            return;
        }

        try {
            const emp = employees.find(e => e.id === enrollmentEmployeeId);
            if (!emp) {
                showToast('Employee not found', 'error');
                return;
            }

            // Update employee with ESI/PF numbers
            const updatedEmployee: Employee = {
                ...emp,
                personalInfo: {
                    ...emp.personalInfo,
                    esiNumber: esiNumber || emp.personalInfo.esiNumber,
                    pfNumber: pfNumber || emp.personalInfo.pfNumber
                }
            };

            await updateEmployee(updatedEmployee);
            await loadEmployees();
            
            showToast('ESI/PF enrollment updated successfully', 'success');
            
            // Reset form
            setEnrollmentEmployeeId('');
            setEsiNumber('');
            setPfNumber('');
        } catch (error) {
            showToast('Failed to update enrollment', 'error');
            console.error(error);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">ESI & PF</h2>
            
             /* Tab Navigation */
            <div className="bg-white rounded-lg shadow-md mb-6">
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('enrollment')}
                        className={(activeTab === 'enrollment') ? 'flex-1 py-3 px-6 text-center font-medium transition-colors border-b-2 border-blue-500 text-blue-600' : 'flex-1 py-3 px-6 text-center font-medium transition-colors text-gray-600 hover:text-gray-800'}
                    >
                        Enrollment
                    </button>
                    <button
                        onClick={() => setActiveTab('statements')}
                        className={(activeTab === 'statements') ? 'flex-1 py-3 px-6 text-center font-medium transition-colors border-b-2 border-blue-500 text-blue-600' : 'flex-1 py-3 px-6 text-center font-medium transition-colors text-gray-600 hover:text-gray-800'}
                    >
                        Statements
                    </button>
                </div>
            </div>

            {/* Enrollment Section */}
            {activeTab === 'enrollment' && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Enroll Employee in ESI & PF</h3>
                    <form onSubmit={handleEnrollmentSubmit}>
                        <div className="space-y-4">
                            {/* Employee Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Employee <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={enrollmentEmployeeId}
                                    onChange={(e) => setEnrollmentEmployeeId(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                >
                                    <option value="">-- Select Employee --</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.personalInfo.firstName} {emp.personalInfo.lastName} ({emp.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* ESI Number */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ESI Number
                                </label>
                                <input
                                    type="text"
                                    value={esiNumber}
                                    onChange={(e) => setEsiNumber(e.target.value)}
                                    placeholder="Enter ESI Number"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave blank if not applicable</p>
                            </div>

                            {/* PF Number */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    PF Number
                                </label>
                                <input
                                    type="text"
                                    value={pfNumber}
                                    onChange={(e) => setPfNumber(e.target.value)}
                                    placeholder="Enter PF Number"
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">Leave blank if not applicable</p>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end pt-4">
                                <Button type="submit">
                                    Save Enrollment
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Statements Section */}
            {activeTab === 'statements' && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Monthly ESI & PF Statements</h3>
                    
                    <div className="space-y-4 mb-6">
                        {/* Employee Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Employee <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={statementsEmployeeId}
                                onChange={(e) => {
                                    setStatementsEmployeeId(e.target.value);
                                    setSelectedMonth('');
                                    setMonthlyDeductions(null);
                                }}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">-- Select Employee --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.personalInfo.firstName} {emp.personalInfo.lastName} ({emp.id})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Month Selection (only shown after employee selection) */}
                        {statementsEmployeeId && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Month <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">-- Select Month --</option>
                                    {months.map(month => (
                                        <option key={month} value={month}>
                                            {month} 2026
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Display Monthly Deductions */}
                    {monthlyDeductions && (
                        <div>
                            {monthlyDeductions.error ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                                    <p className="text-red-600 font-medium">{monthlyDeductions.error}</p>
                                    <p className="text-sm text-gray-600 mt-2">
                                        Please enroll the employee in the Enrollment section first.
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                        <h4 className="font-semibold text-gray-800 mb-2">Employee Details</h4>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <p><strong>Name:</strong> {monthlyDeductions.employeeName}</p>
                                            <p><strong>Month:</strong> {monthlyDeductions.month} 2026</p>
                                            <p><strong>ESI Number:</strong> {monthlyDeductions.esiNumber}</p>
                                            <p><strong>PF Number:</strong> {monthlyDeductions.pfNumber}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        {/* PF Details */}
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <h4 className="font-bold text-blue-800 mb-3">PF Deduction Details</h4>
                                            <div className="space-y-2 text-sm">
                                                <p className="flex justify-between">
                                                    <span>Basic Salary:</span>
                                                    <strong>₹{monthlyDeductions.basic.toFixed(2)}</strong>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span>Employee PF (12%):</span>
                                                    <strong>₹{monthlyDeductions.pfDeduction.toFixed(2)}</strong>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span>Employer PF (12%):</span>
                                                    <strong>₹{monthlyDeductions.pfEmployer.toFixed(2)}</strong>
                                                </p>
                                                <hr className="border-blue-300" />
                                                <p className="flex justify-between font-bold">
                                                    <span>Total PF:</span>
                                                    <span>₹{(monthlyDeductions.pfDeduction + monthlyDeductions.pfEmployer).toFixed(2)}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* ESI Details */}
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                            <h4 className="font-bold text-green-800 mb-3">ESI Deduction Details</h4>
                                            <div className="space-y-2 text-sm">
                                                <p className="flex justify-between">
                                                    <span>Gross Salary:</span>
                                                    <strong>₹{monthlyDeductions.gross.toFixed(2)}</strong>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span>ESI Eligibility:</span>
                                                    <strong className={monthlyDeductions.esiEligible ? 'text-green-600' : 'text-red-600'}>
                                                        {monthlyDeductions.esiEligible ? 'Yes' : 'No'}
                                                    </strong>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span>Employee ESI (0.75%):</span>
                                                    <strong>₹{monthlyDeductions.esiDeduction.toFixed(2)}</strong>
                                                </p>
                                                <p className="flex justify-between">
                                                    <span>Employer ESI (3.25%):</span>
                                                    <strong>₹{monthlyDeductions.esiEmployer.toFixed(2)}</strong>
                                                </p>
                                                <hr className="border-green-300" />
                                                <p className="flex justify-between font-bold">
                                                    <span>Total ESI:</span>
                                                    <span>₹{(monthlyDeductions.esiDeduction + monthlyDeductions.esiEmployer).toFixed(2)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border border-gray-200">
                                        <h4 className="font-bold text-gray-800 mb-3 text-center">Monthly Deduction Summary</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                            <div>
                                                <p className="text-sm text-gray-600">Total Employee Deduction</p>
                                                <p className="text-2xl font-bold text-red-600">
                                                    ₹{monthlyDeductions.totalDeductions.toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Total Employer Contribution</p>
                                                <p className="text-2xl font-bold text-blue-600">
                                                    ₹{(monthlyDeductions.pfEmployer + monthlyDeductions.esiEmployer).toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Net Salary</p>
                                                <p className="text-2xl font-bold text-green-600">
                                                    ₹{(monthlyDeductions.gross - monthlyDeductions.totalDeductions).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CalculatorPage;
