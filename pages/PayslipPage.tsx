import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { getEmployees, getDesignations } from '../services/storageService';
import { Employee, Designation } from '../types';
import { Download, Printer, Save } from 'lucide-react';

interface PayslipData {
  // Employee Details
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  grade: string;
  dateOfJoining: string;
  
  // Payroll Period
  salaryMonth: string;
  salaryYear: string;
  salaryDate: string;
  periodStartDate: string;
  periodEndDate: string;
  
  // Attendance Details
  totalWorkingDays: number;
  presentDays: number;
  leaves: number;
  absents: number;
  paidLeaves: number;
  unpaidLeaves: number;
  overtimeHours: number;
  
  // Earnings
  basicSalary: number;
  hra: number;
  conveyance: number;
  medical: number;
  specialAllowance: number;
  overtimeAmount: number;
  incentives: number;
  bonus: number;
  
  // Deductions
  pf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  advancePaid: number;
  advanceDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  
  // Calculated Fields
  grossSalary: number;
  lopDeduction: number;
  totalDeductions: number;
  netPay: number;
  
  // Remarks
  remarks: string;
}

const PayslipPage: React.FC = () => {
  const { showToast, setActivePage } = useAppContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // Helper functions
  const getDaysInMonth = (month: string, year: string): number => {
    const monthIndex = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ].indexOf(month);
    return new Date(parseInt(year), monthIndex + 1, 0).getDate();
  };

  const formatPeriodDate = (day: number, month: string, year: string): string => {
    const monthIndex = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ].indexOf(month);
    return `${String(day).padStart(2, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${year}`;
  };
  
  const [payslipData, setPayslipData] = useState<PayslipData>({
    employeeId: '',
    employeeName: '',
    department: '',
    designation: '',
    grade: '',
    dateOfJoining: '',
    salaryMonth: new Date().toLocaleString('default', { month: 'long' }),
    salaryYear: new Date().getFullYear().toString(),
    salaryDate: new Date().toISOString().split('T')[0],
    periodStartDate: '',
    periodEndDate: '',
    totalWorkingDays: 30,
    presentDays: 0,
    leaves: 0,
    absents: 0,
    paidLeaves: 0,
    unpaidLeaves: 0,
    overtimeHours: 0,
    basicSalary: 0,
    hra: 0,
    conveyance: 0,
    medical: 0,
    specialAllowance: 0,
    overtimeAmount: 0,
    incentives: 0,
    bonus: 0,
    pf: 0,
    esi: 0,
    professionalTax: 0,
    tds: 0,
    advancePaid: 0,
    advanceDeduction: 0,
    loanDeduction: 0,
    otherDeduction: 0,
    grossSalary: 0,
    lopDeduction: 0,
    totalDeductions: 0,
    netPay: 0,
    remarks: ''
  });

  // Update period dates when month or year changes
  useEffect(() => {
    if (payslipData.salaryMonth && payslipData.salaryYear) {
      const daysInMonth = getDaysInMonth(payslipData.salaryMonth, payslipData.salaryYear);
      const startDate = formatPeriodDate(1, payslipData.salaryMonth, payslipData.salaryYear);
      const endDate = formatPeriodDate(daysInMonth, payslipData.salaryMonth, payslipData.salaryYear);
      
      setPayslipData(prev => ({
        ...prev,
        periodStartDate: startDate,
        periodEndDate: endDate,
        totalWorkingDays: daysInMonth
      }));
    }
  }, [payslipData.salaryMonth, payslipData.salaryYear]);

  useEffect(() => {
    loadEmployees();
    loadDesignations();
  }, []);

  const loadEmployees = async () => {
    try {
      const empList = await getEmployees();
      setEmployees(empList);
    } catch (error) {
      showToast('Failed to load employees', 'error');
    }
  };

  const loadDesignations = async () => {
    try {
      const desgList = await getDesignations();
      setDesignations(desgList);
    } catch (error) {
      console.error('Failed to load designations', error);
    }
  };

  const handleEmployeeSelect = (empId: string) => {
    const employee = employees.find(emp => emp.id === empId);
    if (!employee) return;

    setSelectedEmployee(employee);
    
    // Get designation details
    const desig = designations.find(d => d.id === employee.personalInfo.designation);
    
    // Auto-populate employee details
    setPayslipData(prev => ({
      ...prev,
      employeeId: employee.id || '',
      employeeName: employee.personalInfo.fullName || '',
      department: employee.personalInfo.department || '',
      designation: desig?.title || employee.personalInfo.designation || '',
      grade: desig?.grade || '',
      dateOfJoining: employee.personalInfo.dateOfJoining || '',
      basicSalary: employee.personalInfo.basicSalary || 0,
      hra: employee.personalInfo.hra || 0,
      conveyance: employee.personalInfo.conveyance || 0,
      medical: employee.personalInfo.medical || 0,
      specialAllowance: employee.personalInfo.specialAllowance || 0
    }));
  };

  // Auto-calculate functions
  const calculateGrossSalary = () => {
    const { basicSalary, hra, conveyance, medical, specialAllowance, overtimeAmount, incentives, bonus } = payslipData;
    return basicSalary + hra + conveyance + medical + specialAllowance + overtimeAmount + incentives + bonus;
  };

  const calculateLOPDeduction = () => {
    const { basicSalary, unpaidLeaves, totalWorkingDays } = payslipData;
    if (totalWorkingDays === 0) return 0;
    const perDaySalary = basicSalary / totalWorkingDays;
    return perDaySalary * unpaidLeaves;
  };

  const calculateTotalDeductions = () => {
    const { pf, esi, professionalTax, tds, advanceDeduction, loanDeduction, otherDeduction } = payslipData;
    return pf + esi + professionalTax + tds + advanceDeduction + loanDeduction + otherDeduction + payslipData.lopDeduction;
  };

  const calculateNetPay = () => {
    return payslipData.grossSalary - payslipData.totalDeductions;
  };

  const calculateOvertimeAmount = () => {
    const { basicSalary, overtimeHours, totalWorkingDays } = payslipData;
    if (totalWorkingDays === 0) return 0;
    const perDaySalary = basicSalary / totalWorkingDays;
    const perHourSalary = perDaySalary / 8; // Assuming 8 hours per day
    return perHourSalary * overtimeHours * 1.5; // 1.5x rate for overtime
  };

  // Update calculations whenever relevant fields change
  useEffect(() => {
    const grossSalary = calculateGrossSalary();
    const lopDeduction = calculateLOPDeduction();
    const overtimeAmount = calculateOvertimeAmount();
    
    setPayslipData(prev => ({
      ...prev,
      overtimeAmount,
      grossSalary,
      lopDeduction
    }));
  }, [
    payslipData.basicSalary,
    payslipData.hra,
    payslipData.conveyance,
    payslipData.medical,
    payslipData.specialAllowance,
    payslipData.incentives,
    payslipData.bonus,
    payslipData.unpaidLeaves,
    payslipData.totalWorkingDays,
    payslipData.overtimeHours
  ]);

  useEffect(() => {
    const totalDeductions = calculateTotalDeductions();
    const netPay = calculateNetPay();
    
    setPayslipData(prev => ({
      ...prev,
      totalDeductions,
      netPay
    }));
  }, [
    payslipData.pf,
    payslipData.esi,
    payslipData.professionalTax,
    payslipData.tds,
    payslipData.advanceDeduction,
    payslipData.loanDeduction,
    payslipData.otherDeduction,
    payslipData.lopDeduction,
    payslipData.grossSalary
  ]);

  const handleInputChange = (field: keyof PayslipData, value: string | number) => {
    setPayslipData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convertLessThanThousand = (n: number): string => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
    };
    
    if (num < 1000) return convertLessThanThousand(num);
    if (num < 100000) {
      const thousands = Math.floor(num / 1000);
      const remainder = num % 1000;
      return convertLessThanThousand(thousands) + ' Thousand' + (remainder !== 0 ? ' ' + convertLessThanThousand(remainder) : '');
    }
    if (num < 10000000) {
      const lakhs = Math.floor(num / 100000);
      const remainder = num % 100000;
      return convertLessThanThousand(lakhs) + ' Lakh' + (remainder !== 0 ? ' ' + numberToWords(remainder) : '');
    }
    
    const crores = Math.floor(num / 10000000);
    const remainder = num % 10000000;
    return convertLessThanThousand(crores) + ' Crore' + (remainder !== 0 ? ' ' + numberToWords(remainder) : '');
  };

  const validateForm = (): boolean => {
    if (!payslipData.employeeId) {
      showToast('Please select an employee', 'error');
      return false;
    }
    if (!payslipData.salaryMonth || !payslipData.salaryYear) {
      showToast('Please provide salary month and year', 'error');
      return false;
    }
    if (payslipData.totalWorkingDays <= 0) {
      showToast('Total working days must be greater than 0', 'error');
      return false;
    }
    if (payslipData.presentDays + payslipData.absents + payslipData.leaves > payslipData.totalWorkingDays) {
      showToast('Total days (Present + Absent + Leaves) cannot exceed total working days', 'error');
      return false;
    }
    return true;
  };

  const handleGeneratePayslip = () => {
    if (!validateForm()) return;
    setShowPreview(true);
  };

  const handleDownloadPayslip = () => {
    const payslipText = generatePayslipText();
    const blob = new Blob([payslipText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payslip_${payslipData.employeeName}_${payslipData.salaryMonth}_${payslipData.salaryYear}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Payslip downloaded successfully', 'success');
  };

  const handlePrintPayslip = () => {
    window.print();
    showToast('Opening print dialog...', 'info');
  };

  const handleSavePayslip = () => {
    // Save to localStorage or backend
    const payslipHistory = JSON.parse(localStorage.getItem('payslipHistory') || '[]');
    payslipHistory.push({
      ...payslipData,
      generatedDate: new Date().toISOString()
    });
    localStorage.setItem('payslipHistory', JSON.stringify(payslipHistory));
    showToast('Payslip saved successfully', 'success');
  };

  const generatePayslipText = (): string => {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                          SALARY SLIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPANY: ECOVALE HR MANAGEMENT SYSTEM
Address: Your Company Address Here
Phone: +91-XXXXXXXXXX | Email: info@ecovale.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EMPLOYEE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Employee ID        : ${payslipData.employeeId}
Employee Name      : ${payslipData.employeeName}
Department         : ${payslipData.department}
Designation        : ${payslipData.designation}
Grade              : ${payslipData.grade}
Date of Joining    : ${payslipData.dateOfJoining || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SALARY PERIOD: ${payslipData.salaryMonth} ${payslipData.salaryYear}
Period: ${payslipData.periodStartDate} to ${payslipData.periodEndDate}
Payment Date: ${payslipData.salaryDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ATTENDANCE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Working Days : ${payslipData.totalWorkingDays}
Present Days       : ${payslipData.presentDays}
Paid Leaves        : ${payslipData.paidLeaves}
Unpaid Leaves (LOP): ${payslipData.unpaidLeaves}
Absents            : ${payslipData.absents}
Overtime Hours     : ${payslipData.overtimeHours}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EARNINGS                                          AMOUNT (₹)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Basic Salary                                 ${payslipData.basicSalary.toFixed(2)}
HRA                                          ${payslipData.hra.toFixed(2)}
Conveyance                                   ${payslipData.conveyance.toFixed(2)}
Medical Allowance                            ${payslipData.medical.toFixed(2)}
Special Allowance                            ${payslipData.specialAllowance.toFixed(2)}
Overtime Amount                              ${payslipData.overtimeAmount.toFixed(2)}
Incentives                                   ${payslipData.incentives.toFixed(2)}
Bonus                                        ${payslipData.bonus.toFixed(2)}
                                            ─────────────────
GROSS SALARY                                 ${payslipData.grossSalary.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEDUCTIONS                                        AMOUNT (₹)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Provident Fund (PF)                          ${payslipData.pf.toFixed(2)}
ESI                                          ${payslipData.esi.toFixed(2)}
Professional Tax                             ${payslipData.professionalTax.toFixed(2)}
TDS                                          ${payslipData.tds.toFixed(2)}
LOP Deduction                                ${payslipData.lopDeduction.toFixed(2)}
Advance Deduction                            ${payslipData.advanceDeduction.toFixed(2)}
Loan Deduction                               ${payslipData.loanDeduction.toFixed(2)}
Other Deduction                              ${payslipData.otherDeduction.toFixed(2)}
                                            ─────────────────
TOTAL DEDUCTIONS                             ${payslipData.totalDeductions.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NET PAY                                      ₹ ${payslipData.netPay.toFixed(2)}

In Words: ${numberToWords(Math.floor(payslipData.netPay))} Rupees Only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REMARKS: ${payslipData.remarks || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is a computer generated payslip and does not require signature.

Generated on: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setActivePage('payroll')}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
          >
            ← Back to Payroll
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Payroll & Payslip Management</h1>
            <p className="text-gray-600 mt-2">Generate and manage employee payslips</p>
          </div>
        </div>

        {!showPreview ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Employee Selection */}
            <div className="mb-8 pb-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Employee Selection</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={payslipData.employeeId}
                    onChange={(e) => handleEmployeeSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Employee --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.id} - {emp.personalInfo.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedEmployee && (
                <div className="mt-6 p-4 bg-indigo-50 rounded-lg grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Employee ID</p>
                    <p className="font-semibold text-gray-800">{payslipData.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-semibold text-gray-800">{payslipData.employeeName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Department</p>
                    <p className="font-semibold text-gray-800">{payslipData.department}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Designation</p>
                    <p className="font-semibold text-gray-800">{payslipData.designation}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Grade</p>
                    <p className="font-semibold text-gray-800">{payslipData.grade || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date of Joining</p>
                    <p className="font-semibold text-gray-800">{payslipData.dateOfJoining || 'N/A'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Payroll Period */}
            <div className="mb-8 pb-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span>📅</span> Payroll Period
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Month <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={payslipData.salaryMonth}
                    onChange={(e) => handleInputChange('salaryMonth', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {months.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={payslipData.salaryYear}
                    onChange={(e) => handleInputChange('salaryYear', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    min="2020"
                    max="2100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period Start Date
                  </label>
                  <input
                    type="text"
                    value={payslipData.periodStartDate}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-blue-50 text-blue-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period End Date
                  </label>
                  <input
                    type="text"
                    value={payslipData.periodEndDate}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-blue-50 text-blue-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={payslipData.salaryDate}
                    onChange={(e) => handleInputChange('salaryDate', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              {/* Period Summary Banner */}
              <div className="mt-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-indigo-700 font-medium">Payroll Period Summary</p>
                    <p className="text-lg font-bold text-indigo-900 mt-1">
                      {payslipData.salaryMonth} {payslipData.salaryYear}
                    </p>
                    <p className="text-sm text-indigo-600 mt-1">
                      {payslipData.periodStartDate} to {payslipData.periodEndDate}
                      <span className="ml-2 text-xs bg-indigo-100 px-2 py-1 rounded-full">
                        {payslipData.totalWorkingDays} days
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Details */}
            <div className="mb-8 pb-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Attendance & Work Details</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Working Days <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={payslipData.totalWorkingDays}
                    onChange={(e) => handleInputChange('totalWorkingDays', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Present Days</label>
                  <input
                    type="number"
                    value={payslipData.presentDays}
                    onChange={(e) => handleInputChange('presentDays', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Leaves</label>
                  <input
                    type="number"
                    value={payslipData.leaves}
                    onChange={(e) => handleInputChange('leaves', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Absents</label>
                  <input
                    type="number"
                    value={payslipData.absents}
                    onChange={(e) => handleInputChange('absents', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Paid Leaves</label>
                  <input
                    type="number"
                    value={payslipData.paidLeaves}
                    onChange={(e) => handleInputChange('paidLeaves', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unpaid Leaves (LOP)</label>
                  <input
                    type="number"
                    value={payslipData.unpaidLeaves}
                    onChange={(e) => handleInputChange('unpaidLeaves', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overtime (Hours)</label>
                  <input
                    type="number"
                    value={payslipData.overtimeHours}
                    onChange={(e) => handleInputChange('overtimeHours', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.5"
                  />
                </div>
              </div>
            </div>

            {/* Earnings */}
            <div className="mb-8 pb-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Earnings</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Basic Salary <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={payslipData.basicSalary}
                    onChange={(e) => handleInputChange('basicSalary', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">HRA</label>
                  <input
                    type="number"
                    value={payslipData.hra}
                    onChange={(e) => handleInputChange('hra', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Conveyance</label>
                  <input
                    type="number"
                    value={payslipData.conveyance}
                    onChange={(e) => handleInputChange('conveyance', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Medical</label>
                  <input
                    type="number"
                    value={payslipData.medical}
                    onChange={(e) => handleInputChange('medical', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Special Allowance</label>
                  <input
                    type="number"
                    value={payslipData.specialAllowance}
                    onChange={(e) => handleInputChange('specialAllowance', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overtime Amount (Auto)</label>
                  <input
                    type="number"
                    value={payslipData.overtimeAmount}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Incentives</label>
                  <input
                    type="number"
                    value={payslipData.incentives}
                    onChange={(e) => handleInputChange('incentives', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bonus</label>
                  <input
                    type="number"
                    value={payslipData.bonus}
                    onChange={(e) => handleInputChange('bonus', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="text-lg font-semibold text-gray-800">
                  Gross Salary: <span className="text-green-600">₹ {payslipData.grossSalary.toFixed(2)}</span>
                </p>
              </div>
            </div>

            {/* Deductions */}
            <div className="mb-8 pb-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Deductions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PF</label>
                  <input
                    type="number"
                    value={payslipData.pf}
                    onChange={(e) => handleInputChange('pf', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ESI</label>
                  <input
                    type="number"
                    value={payslipData.esi}
                    onChange={(e) => handleInputChange('esi', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Professional Tax</label>
                  <input
                    type="number"
                    value={payslipData.professionalTax}
                    onChange={(e) => handleInputChange('professionalTax', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">TDS</label>
                  <input
                    type="number"
                    value={payslipData.tds}
                    onChange={(e) => handleInputChange('tds', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">LOP Deduction (Auto)</label>
                  <input
                    type="number"
                    value={payslipData.lopDeduction}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Advance Deduction</label>
                  <input
                    type="number"
                    value={payslipData.advanceDeduction}
                    onChange={(e) => handleInputChange('advanceDeduction', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Loan Deduction</label>
                  <input
                    type="number"
                    value={payslipData.loanDeduction}
                    onChange={(e) => handleInputChange('loanDeduction', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Other Deduction</label>
                  <input
                    type="number"
                    value={payslipData.otherDeduction}
                    onChange={(e) => handleInputChange('otherDeduction', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="mt-4 p-4 bg-red-50 rounded-lg">
                <p className="text-lg font-semibold text-gray-800">
                  Total Deductions: <span className="text-red-600">₹ {payslipData.totalDeductions.toFixed(2)}</span>
                </p>
              </div>
            </div>

            {/* Net Pay & Remarks */}
            <div className="mb-8">
              <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg text-white mb-6">
                <h2 className="text-2xl font-bold mb-2">Net Pay</h2>
                <p className="text-4xl font-bold">₹ {payslipData.netPay.toFixed(2)}</p>
                <p className="text-sm mt-2 opacity-90">
                  {numberToWords(Math.floor(payslipData.netPay))} Rupees Only
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Remarks (Optional)</label>
                <textarea
                  value={payslipData.remarks}
                  onChange={(e) => handleInputChange('remarks', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Add any additional remarks or notes..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <button
                onClick={handleGeneratePayslip}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
              >
                Generate Payslip
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Payslip Preview */}
            <div className="bg-white rounded-lg shadow-lg p-8 mb-6" id="payslip-preview">
              <div className="border-2 border-gray-300 p-8">
                {/* Header with Logo */}
                <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-800">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">ECOVALE INDIA PRIVATE LIMITED</h1>
                    <div className="text-sm text-gray-700 leading-relaxed">
                      <p>Site No. 04, Sri Vinayaka Estate, 15/2,</p>
                      <p>Hegganahalli Main Road,</p>
                      <p>Srigandha Nagar, Sunkadakatte,</p>
                      <p>Bengaluru – 560091</p>
                      <p className="mt-2">Email: hr@ecovaleindia.com | Phone: +91 63642 41314</p>
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="w-28 h-28 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" className="w-full h-full">
                        {/* ECOVALE Logo */}
                        <g>
                          {/* Leaf shape - green and yellow */}
                          <ellipse cx="150" cy="40" rx="25" ry="35" fill="#FDB913" transform="rotate(-30 150 40)"/>
                          <ellipse cx="145" cy="55" rx="28" ry="38" fill="#00A651" transform="rotate(-25 145 55)"/>
                          
                          {/* Text ECOVALE */}
                          <text x="100" y="90" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="bold" fill="#2C3E93">
                            ECOVALE
                          </text>
                          
                          {/* Text INDIA */}
                          <text x="100" y="120" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="bold" fill="#00A651">
                            INDIA
                          </text>
                          
                          {/* Tagline */}
                          <text x="100" y="145" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10" fill="#666">
                            A Blend By Organic &amp; Natural Aromas
                          </text>
                        </g>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Salary Slip Title */}
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-gray-800">SALARY SLIP – {payslipData.salaryMonth.toUpperCase()} {payslipData.salaryYear}</h2>
                </div>

                {/* Employee Details Table */}
                <div className="mb-6">
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 font-semibold bg-gray-50 w-1/4">Employee ID</td>
                        <td className="py-2 px-3 w-1/4">{payslipData.employeeId}</td>
                        <td className="py-2 px-3 font-semibold bg-gray-50 w-1/4">Department</td>
                        <td className="py-2 px-3 w-1/4">{payslipData.department}</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 font-semibold bg-gray-50">Employee Name</td>
                        <td className="py-2 px-3">{payslipData.employeeName}</td>
                        <td className="py-2 px-3 font-semibold bg-gray-50">Designation</td>
                        <td className="py-2 px-3">{payslipData.designation}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Earnings and Deductions Table */}
                <div className="mb-6">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-2 px-3 text-left border-r border-gray-300 font-bold">EARNINGS</th>
                        <th className="py-2 px-3 text-right border-r border-gray-300 font-bold">Amount</th>
                        <th className="py-2 px-3 text-left border-r border-gray-300 font-bold">DEDUCTIONS</th>
                        <th className="py-2 px-3 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 border-r border-gray-300">Basic Salary</td>
                        <td className="py-2 px-3 text-right border-r border-gray-300">{payslipData.basicSalary.toFixed(2)}</td>
                        <td className="py-2 px-3 border-r border-gray-300">Absent Deduction</td>
                        <td className="py-2 px-3 text-right">{payslipData.lopDeduction.toFixed(2)}</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 border-r border-gray-300">HRA</td>
                        <td className="py-2 px-3 text-right border-r border-gray-300">{payslipData.hra.toFixed(2)}</td>
                        <td className="py-2 px-3 border-r border-gray-300">Leave Deduction</td>
                        <td className="py-2 px-3 text-right">0.00</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 border-r border-gray-300">Special Allowance</td>
                        <td className="py-2 px-3 text-right border-r border-gray-300">{payslipData.specialAllowance.toFixed(2)}</td>
                        <td className="py-2 px-3 border-r border-gray-300">Advance Deduction</td>
                        <td className="py-2 px-3 text-right">{payslipData.advanceDeduction.toFixed(2)}</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 border-r border-gray-300">Gross Salary</td>
                        <td className="py-2 px-3 text-right border-r border-gray-300 font-semibold">{payslipData.grossSalary.toFixed(2)}</td>
                        <td className="py-2 px-3 border-r border-gray-300">Loan Deduction</td>
                        <td className="py-2 px-3 text-right">{payslipData.loanDeduction.toFixed(2)}</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 border-r border-gray-300">OT Hours</td>
                        <td className="py-2 px-3 text-right border-r border-gray-300">{payslipData.overtimeHours}</td>
                        <td className="py-2 px-3 border-r border-gray-300">Other Deductions</td>
                        <td className="py-2 px-3 text-right">{payslipData.otherDeduction.toFixed(2)}</td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 border-r border-gray-300">OT Amount</td>
                        <td className="py-2 px-3 text-right border-r border-gray-300">{payslipData.overtimeAmount.toFixed(2)}</td>
                        <td className="py-2 px-3 border-r border-gray-300"></td>
                        <td className="py-2 px-3 text-right"></td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 border-r border-gray-300">Incentive</td>
                        <td className="py-2 px-3 text-right border-r border-gray-300">{payslipData.incentives.toFixed(2)}</td>
                        <td className="py-2 px-3 border-r border-gray-300"></td>
                        <td className="py-2 px-3 text-right"></td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 border-r border-gray-300">Bonus</td>
                        <td className="py-2 px-3 text-right border-r border-gray-300">{payslipData.bonus.toFixed(2)}</td>
                        <td className="py-2 px-3 border-r border-gray-300"></td>
                        <td className="py-2 px-3 text-right"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Summary Section */}
                <div className="mb-6">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <tbody>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 font-semibold bg-gray-50">Total Additions</td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {(payslipData.grossSalary + payslipData.overtimeAmount + payslipData.incentives + payslipData.bonus).toFixed(2)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 font-semibold bg-gray-50">Total Deductions</td>
                        <td className="py-2 px-3 text-right font-semibold">{payslipData.totalDeductions.toFixed(2)}</td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="py-3 px-3 font-bold text-lg">NET PAYABLE (₹)</td>
                        <td className="py-3 px-3 text-right font-bold text-lg text-blue-600">₹ {payslipData.netPay.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Working Days Summary */}
                <div className="mb-6">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <tbody>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 font-semibold bg-gray-50 w-1/5">Working Days</td>
                        <td className="py-2 px-3 w-1/5">{payslipData.totalWorkingDays}</td>
                        <td className="py-2 px-3 font-semibold bg-gray-50 w-1/5">Absent</td>
                        <td className="py-2 px-3 w-1/5">{payslipData.absents}</td>
                        <td className="py-2 px-3 w-1/5"></td>
                      </tr>
                      <tr className="border-b border-gray-300">
                        <td className="py-2 px-3 font-semibold bg-gray-50">Present</td>
                        <td className="py-2 px-3">{payslipData.presentDays}</td>
                        <td className="py-2 px-3 font-semibold bg-gray-50">Unpaid Leave</td>
                        <td className="py-2 px-3">{payslipData.unpaidLeaves}</td>
                        <td className="py-2 px-3"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold bg-gray-50">Paid Leave</td>
                        <td className="py-2 px-3">{payslipData.paidLeaves}</td>
                        <td className="py-2 px-3"></td>
                        <td className="py-2 px-3"></td>
                        <td className="py-2 px-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-600 italic mt-6">
                  <p>This is a system-generated document and does not require a signature.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-between">
              <button
                onClick={() => setShowPreview(false)}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
              >
                ← Back to Edit
              </button>
              <div className="flex gap-4">
                <button
                  onClick={handleSavePayslip}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center gap-2"
                >
                  <Save size={20} />
                  Save Payslip
                </button>
                <button
                  onClick={handleDownloadPayslip}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center gap-2"
                >
                  <Download size={20} />
                  Download
                </button>
                <button
                  onClick={handlePrintPayslip}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold flex items-center gap-2"
                >
                  <Printer size={20} />
                  Print
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayslipPage;
