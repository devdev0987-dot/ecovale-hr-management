
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getEmployees } from '../services/storageService';
import Button from '../components/ui/Button';
import { FileText, Calendar } from 'lucide-react';

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const years = [new Date().getFullYear(), new Date().getFullYear() - 1];

// Helper function to get days in a month
const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month + 1, 0).getDate();
};

// Helper function to format date
const formatDate = (day: number, month: number, year: number): string => {
    return `${String(day).padStart(2, '0')}-${String(month + 1).padStart(2, '0')}-${year}`;
};

const PayrollPage: React.FC = () => {
    const { setActivePage } = useAppContext();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [payrollData, setPayrollData] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Payroll period state
    const [periodStartDate, setPeriodStartDate] = useState('');
    const [periodEndDate, setPeriodEndDate] = useState('');
    
    // Summary states
    const [totalGross, setTotalGross] = useState(0);
    const [totalDeductions, setTotalDeductions] = useState(0);
    const [totalNet, setTotalNet] = useState(0);
    const [totalEmployees, setTotalEmployees] = useState(0);

    // Update period dates when month or year changes
    useEffect(() => {
        const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
        const startDate = formatDate(1, selectedMonth, selectedYear);
        const endDate = formatDate(daysInMonth, selectedMonth, selectedYear);
        setPeriodStartDate(startDate);
        setPeriodEndDate(endDate);
    }, [selectedMonth, selectedYear]);

    const processPayroll = async () => {
        setIsProcessing(true);
        try {
            const employees = await getEmployees();
            const payroll = employees.map(emp => {
                const deductions = emp.salaryInfo.pfDeduction + emp.salaryInfo.esiDeduction + emp.salaryInfo.professionalTax + emp.salaryInfo.tds;
                return {
                    employeeId: emp.id,
                    name: `${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`,
                    designation: emp.employmentDetails.designation,
                    gross: emp.salaryInfo.gross,
                    deductions,
                    net: emp.salaryInfo.net,
                    status: 'Processed'
                };
            });
            setPayrollData(payroll);
            // Calculate summaries
            setTotalEmployees(payroll.length);
            setTotalGross(payroll.reduce((acc, p) => acc + p.gross, 0));
            setTotalDeductions(payroll.reduce((acc, p) => acc + p.deductions, 0));
            setTotalNet(payroll.reduce((acc, p) => acc + p.net, 0));
        } catch (error) {
            console.error("Payroll processing failed:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-800">Payroll Management</h2>
                    <p className="text-gray-600 text-sm mt-1">Process payroll and generate payslips</p>
                </div>
                <button
                    onClick={() => setActivePage('Payslip')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold flex items-center gap-2"
                >
                    <FileText size={20} />
                    Generate Payslip
                </button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-blue-600" />
                    Payroll Period Selection
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                        <select 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(Number(e.target.value))} 
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                        <select 
                            value={selectedYear} 
                            onChange={e => setSelectedYear(Number(e.target.value))} 
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period Start Date</label>
                        <input 
                            type="text" 
                            value={periodStartDate} 
                            readOnly 
                            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period End Date</label>
                        <input 
                            type="text" 
                            value={periodEndDate} 
                            readOnly 
                            className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-medium"
                        />
                    </div>
                </div>
                
                {/* Period Summary Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-blue-700 font-medium">Selected Payroll Period</p>
                            <p className="text-lg font-bold text-blue-900 mt-1">
                                {months[selectedMonth]} {selectedYear}
                            </p>
                            <p className="text-sm text-blue-600 mt-1">
                                {periodStartDate} to {periodEndDate}
                            </p>
                        </div>
                        <Button onClick={processPayroll} isLoading={isProcessing}>
                            Process Payroll
                        </Button>
                    </div>
                </div>
            </div>

            {payrollData.length > 0 && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg shadow-md"><p className="text-sm text-gray-500">Total Employees</p><p className="text-2xl font-bold">{totalEmployees}</p></div>
                    <div className="bg-white p-4 rounded-lg shadow-md"><p className="text-sm text-gray-500">Total Gross</p><p className="text-2xl font-bold">₹{totalGross.toLocaleString()}</p></div>
                    <div className="bg-white p-4 rounded-lg shadow-md"><p className="text-sm text-gray-500">Total Deductions</p><p className="text-2xl font-bold">₹{totalDeductions.toLocaleString()}</p></div>
                    <div className="bg-white p-4 rounded-lg shadow-md"><p className="text-sm text-gray-500">Total Net Pay</p><p className="text-2xl font-bold">₹{totalNet.toLocaleString()}</p></div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th className="px-6 py-3">ID</th>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Gross</th>
                                <th className="px-6 py-3">Deductions</th>
                                <th className="px-6 py-3">Net Pay</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payrollData.map(p => (
                                <tr key={p.employeeId} className="border-b hover:bg-gray-50">
                                    <td className="px-6 py-4">{p.employeeId}</td>
                                    <td className="px-6 py-4 font-semibold">{p.name}</td>
                                    <td className="px-6 py-4">₹{p.gross.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-red-600">₹{p.deductions.toLocaleString()}</td>
                                    <td className="px-6 py-4 font-bold text-green-600">₹{p.net.toLocaleString()}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">{p.status}</span></td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => setActivePage('Payslip')}
                                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            View Slip
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </>
            )}
        </div>
    );
};

export default PayrollPage;
