import React, { useState, useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { generatePayRun, getPayRunByMonthYear, getPayRunRecords } from '../services/storageService';
import { PayRunRecord, PayRunEmployeeRecord } from '../types';
import { Play, Download, Calendar, DollarSign, Users, TrendingUp } from 'lucide-react';

const PayRunPage: React.FC = () => {
  const { showToast, setIsLoading } = useAppContext();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [payRun, setPayRun] = useState<PayRunRecord | null>(null);
  const [allPayRuns, setAllPayRuns] = useState<PayRunRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    loadPayRunHistory();
  }, []);

  const loadPayRunHistory = async () => {
    try {
      const records = await getPayRunRecords();
      setAllPayRuns(records.sort((a, b) => {
        const dateA = new Date(a.generatedAt);
        const dateB = new Date(b.generatedAt);
        return dateB.getTime() - dateA.getTime();
      }));
    } catch (error) {
      console.error('Failed to load pay run history', error);
    }
  };

  const handleGeneratePayRun = async () => {
    if (!selectedMonth) {
      showToast('Please select a month', 'error');
      return;
    }

    if (!selectedYear) {
      showToast('Please select a year', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const generatedPayRun = await generatePayRun(selectedMonth, selectedYear);
      setPayRun(generatedPayRun);
      await loadPayRunHistory();
      showToast(
        `Pay run generated successfully for ${selectedMonth} ${selectedYear}`,
        'success'
      );
    } catch (error) {
      showToast('Failed to generate pay run', 'error');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPayRun = async (month: string, year: string) => {
    try {
      const existingPayRun = await getPayRunByMonthYear(month, year);
      if (existingPayRun) {
        setPayRun(existingPayRun);
        setSelectedMonth(month);
        setSelectedYear(year);
        setShowHistory(false);
      }
    } catch (error) {
      showToast('Failed to load pay run', 'error');
    }
  };

  const exportToCSV = () => {
    if (!payRun) return;

    const headers = [
      'Employee ID',
      'Employee Name',
      'Basic Salary',
      'HRA',
      'Conveyance',
      'Telephone',
      'Medical Allowance',
      'Special Allowance',
      'Total Allowances',
      'Gross Salary',
      'Working Days',
      'Payable Days',
      'LOP Days',
      'LOP Amount',
      'Advance Deduction',
      'Loan Deduction',
      'PF Deduction',
      'ESI Deduction',
      'Professional Tax',
      'TDS',
      'Total Deductions',
      'Net Pay'
    ];

    const rows = payRun.employeeRecords.map(record => [
      record.employeeId,
      record.employeeName,
      record.basicSalary.toFixed(2),
      record.hra.toFixed(2),
      record.conveyance.toFixed(2),
      record.telephone.toFixed(2),
      record.medicalAllowance.toFixed(2),
      record.specialAllowance.toFixed(2),
      record.totalAllowances.toFixed(2),
      record.grossSalary.toFixed(2),
      record.totalWorkingDays,
      record.payableDays,
      record.lossOfPayDays,
      record.lossOfPayAmount.toFixed(2),
      record.advanceDeduction.toFixed(2),
      record.loanDeduction.toFixed(2),
      record.pfDeduction.toFixed(2),
      record.esiDeduction.toFixed(2),
      record.professionalTax.toFixed(2),
      record.tds.toFixed(2),
      record.totalDeductions.toFixed(2),
      record.netPay.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PayRun_${payRun.month}_${payRun.year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showToast('Pay run exported to CSV', 'success');
  };

  const calculateSummary = (records: PayRunEmployeeRecord[]) => {
    return records.reduce(
      (acc, record) => ({
        totalGross: acc.totalGross + record.grossSalary,
        totalDeductions: acc.totalDeductions + record.totalDeductions,
        totalNetPay: acc.totalNetPay + record.netPay,
        totalAdvance: acc.totalAdvance + record.advanceDeduction,
        totalLoan: acc.totalLoan + record.loanDeduction
      }),
      { totalGross: 0, totalDeductions: 0, totalNetPay: 0, totalAdvance: 0, totalLoan: 0 }
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const summary = payRun ? calculateSummary(payRun.employeeRecords) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp className="text-green-600" size={32} />
            Pay Run
          </h1>
          <p className="text-gray-600 mt-1">Generate and manage monthly payroll</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <Calendar size={20} />
          {showHistory ? 'Hide History' : 'View History'}
        </button>
      </div>

      {/* Pay Run History */}
      {showHistory && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Pay Run History</h2>
          {allPayRuns.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No pay runs generated yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Generated At
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Employees
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total Net Pay
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allPayRuns.map((pr) => {
                    const prSummary = calculateSummary(pr.employeeRecords);
                    return (
                      <tr key={pr.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {pr.month} {pr.year}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(pr.generatedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {pr.employeeRecords.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                          {formatCurrency(prSummary.totalNetPay)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleViewPayRun(pr.month, pr.year)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Generation Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Generate Pay Run</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Month <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Choose Month</option>
              {months.map(month => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Year <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGeneratePayRun}
              className="flex-1 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold"
            >
              <Play size={20} />
              Generate Pay Run
            </button>
            {payRun && (
              <button
                onClick={exportToCSV}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                title="Export to CSV"
              >
                <Download size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pay Run Results */}
      {payRun && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Employees</p>
                  <p className="text-2xl font-bold text-gray-800">{payRun.employeeRecords.length}</p>
                </div>
                <Users className="text-blue-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Gross</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(summary!.totalGross)}</p>
                </div>
                <DollarSign className="text-green-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Deductions</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(summary!.totalDeductions)}</p>
                </div>
                <DollarSign className="text-red-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div>
                <p className="text-sm text-gray-600">Total Advance</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(summary!.totalAdvance)}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4">
              <div>
                <p className="text-sm text-gray-600">Total Loan</p>
                <p className="text-lg font-bold text-purple-600">{formatCurrency(summary!.totalLoan)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-lg">Total Net Payable for {payRun.month} {payRun.year}</p>
                <p className="text-4xl font-bold mt-2">{formatCurrency(summary!.totalNetPay)}</p>
              </div>
              <TrendingUp size={64} className="text-green-200 opacity-50" />
            </div>
          </div>

          {/* Detailed Pay Run Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">
                Pay Run Details - {payRun.month} {payRun.year}
              </h2>
              <p className="text-sm text-gray-500">Generated on {formatDate(payRun.generatedAt)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Basic
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Allowances
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Gross
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Days
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      LOP Amount
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Advance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Loan
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      PF
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      ESI
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      PT
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      TDS
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total Ded.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-green-50">
                      Net Pay
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payRun.employeeRecords.map((record) => (
                    <tr key={record.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap sticky left-0 bg-white">
                        <div className="text-sm font-medium text-gray-900">{record.employeeName}</div>
                        <div className="text-xs text-gray-500">{record.employeeId}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(record.basicSalary)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(record.totalAllowances)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {formatCurrency(record.grossSalary)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                        <div className="text-green-600 font-medium">{record.payableDays}</div>
                        <div className="text-xs text-gray-500">/{record.totalWorkingDays}</div>
                        {record.lossOfPayDays > 0 && (
                          <div className="text-xs text-red-600">LOP: {record.lossOfPayDays}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-red-600">
                        {record.lossOfPayAmount > 0 ? formatCurrency(record.lossOfPayAmount) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-orange-600">
                        {record.advanceDeduction > 0 ? formatCurrency(record.advanceDeduction) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-purple-600">
                        {record.loanDeduction > 0 ? formatCurrency(record.loanDeduction) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                        {record.pfDeduction > 0 ? formatCurrency(record.pfDeduction) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                        {record.esiDeduction > 0 ? formatCurrency(record.esiDeduction) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                        {record.professionalTax > 0 ? formatCurrency(record.professionalTax) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                        {record.tds > 0 ? formatCurrency(record.tds) : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium text-red-600">
                        {formatCurrency(record.totalDeductions)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-green-700 bg-green-50">
                        {formatCurrency(record.netPay)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-bold">
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-100">TOTAL</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(
                        payRun.employeeRecords.reduce((sum, r) => sum + r.basicSalary, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(
                        payRun.employeeRecords.reduce((sum, r) => sum + r.totalAllowances, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(summary!.totalGross)}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">
                      {formatCurrency(
                        payRun.employeeRecords.reduce((sum, r) => sum + r.lossOfPayAmount, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-orange-600">
                      {formatCurrency(summary!.totalAdvance)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-purple-600">
                      {formatCurrency(summary!.totalLoan)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(
                        payRun.employeeRecords.reduce((sum, r) => sum + r.pfDeduction, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(
                        payRun.employeeRecords.reduce((sum, r) => sum + r.esiDeduction, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(
                        payRun.employeeRecords.reduce((sum, r) => sum + r.professionalTax, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(
                        payRun.employeeRecords.reduce((sum, r) => sum + r.tds, 0)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">
                      {formatCurrency(summary!.totalDeductions)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-700 bg-green-100">
                      {formatCurrency(summary!.totalNetPay)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {!payRun && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Calendar size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Pay Run Generated</h3>
          <p className="text-gray-500">
            Select a month and year above, then click "Generate Pay Run" to create the payroll.
          </p>
        </div>
      )}
    </div>
  );
};

export default PayRunPage;
