
import React, { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, AlertTriangle, UserPlus, FileText, Banknote, Calculator } from 'lucide-react';
import { getEmployees } from '../services/storageService';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/ui/Button';

const MetricCard = ({ icon, title, value, bgColor }) => (
  <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4">
    <div className={`p-3 rounded-full ${bgColor}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const QuickActionButton = ({ icon, label, page }) => {
  const { setActivePage } = useAppContext();
  return (
    <button onClick={() => setActivePage(page)} className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center justify-center space-y-2 hover:bg-gray-50 transition-colors">
      {icon}
      <span className="text-gray-700 font-medium">{label}</span>
    </button>
  );
};


const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    fullTime: 0,
    partTime: 0,
    pendingActions:0// Mock value
  });

  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [salaryInput, setSalaryInput] = useState({ basic: 0, hra: 0, da: 0, other: 0 });
  const [monthlyCalculations, setMonthlyCalculations] = useState(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const emps = await getEmployees();
        setEmployees(emps);
        setMetrics(prev => ({
          ...prev,
          totalEmployees: emps.length,
          fullTime: emps.filter(e => e.employmentDetails.type === 'full-time').length,
          partTime: emps.filter(e => e.employmentDetails.type === 'part-time').length,
        }));
      } catch (error) {
        console.error("Failed to fetch employees for metrics:", error);
      }
    };
    fetchMetrics();
  }, []);

  const handleEmployeeSelect = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setSelectedEmployeeName(`${emp.personalInfo.firstName} ${emp.personalInfo.lastName}`);
      setSalaryInput({
        basic: emp.salaryInfo.basic,
        hra: emp.salaryInfo.hra,
        da: emp.salaryInfo.da,
        other: emp.salaryInfo.specialAllowance
      });
      setMonthlyCalculations(null);
    }
  };

  const handleToggleInputMode = (manual: boolean) => {
    setUseManualInput(manual);
    if (manual) {
      setSelectedEmployeeId('');
      setSelectedEmployeeName('');
      setSalaryInput({ basic: 0, hra: 0, da: 0, other: 0 });
    } else {
      setSalaryInput({ basic: 0, hra: 0, da: 0, other: 0 });
    }
    setMonthlyCalculations(null);
  };

  const handleMonthlyCalculate = () => {
    const gross = salaryInput.basic + salaryInput.hra + salaryInput.da + salaryInput.other;
    const empPF = salaryInput.basic * 0.12;
    const emplrPF = salaryInput.basic * 0.12;
    let empESI = 0, emplrESI = 0;
    const esiEligible = gross < 21000;
    if (esiEligible) {
      empESI = gross * 0.0075;
      emplrESI = gross * 0.0325;
    }
    const totalEmpDeductions = empPF + empESI;
    const netSalary = gross - totalEmpDeductions;

    setMonthlyCalculations({ gross, empPF, emplrPF, empESI, emplrESI, esiEligible, totalEmpDeductions, netSalary, month: selectedMonth });
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Welcome, Admin!</h2>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard icon={<Users className="text-blue-600"/>} title="Total Employees" value={metrics.totalEmployees} bgColor="bg-blue-100" />
        <MetricCard icon={<UserCheck className="text-green-600"/>} title="Full-Time" value={metrics.fullTime} bgColor="bg-green-100" />
        <MetricCard icon={<UserX className="text-orange-600"/>} title="Part-Time" value={metrics.partTime} bgColor="bg-orange-100" />
        <MetricCard icon={<AlertTriangle className="text-red-600"/>} title="Pending Actions" value={metrics.pendingActions} bgColor="bg-red-100" />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <QuickActionButton icon={<UserPlus size={32} className="text-green-600" />} label="Add Employee" page="new-employee" />
          <QuickActionButton icon={<FileText size={32} className="text-indigo-600" />} label="Generate Letter" page="letters" />
          <QuickActionButton icon={<Banknote size={32} className="text-yellow-600" />} label="Process Payroll" page="payroll" />
          <QuickActionButton icon={<Calculator size={32} className="text-purple-600" />} label="ESI & PF" page="calculator" />
        </div>
      </div>

      {/* Charts & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold text-gray-700 mb-4">Monthly ESI/PF Calculator</h3>
          
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={useManualInput} 
                onChange={(e) => handleToggleInputMode(e.target.checked)} 
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Manual Input (Uncheck to load from database)</span>
            </label>
          </div>

          {useManualInput ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                  <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)} 
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div></div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Basic</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={salaryInput.basic} 
                    onChange={(e) => setSalaryInput({ ...salaryInput, basic: Number(e.target.value) })} 
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HRA</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={salaryInput.hra} 
                    onChange={(e) => setSalaryInput({ ...salaryInput, hra: Number(e.target.value) })} 
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DA</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={salaryInput.da} 
                    onChange={(e) => setSalaryInput({ ...salaryInput, da: Number(e.target.value) })} 
                    className="w-full p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Other</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    value={salaryInput.other} 
                    onChange={(e) => setSalaryInput({ ...salaryInput, other: Number(e.target.value) })} 
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              </div>

              <div className="flex justify-center mb-6">
                <Button onClick={handleMonthlyCalculate}>Calculate ESI/PF</Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee</label>
                  <select 
                    value={selectedEmployeeId} 
                    onChange={(e) => handleEmployeeSelect(e.target.value)} 
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">-- Select an Employee --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.personalInfo.firstName} {emp.personalInfo.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                  <input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)} 
                    className="w-full p-2 border rounded-md"
                  />
                </div>
              </div>

              {selectedEmployeeId && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    <span className="font-semibold">Employee:</span> {selectedEmployeeName}
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Basic</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={salaryInput.basic} 
                        onChange={(e) => setSalaryInput({ ...salaryInput, basic: Number(e.target.value) })} 
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">HRA</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={salaryInput.hra} 
                        onChange={(e) => setSalaryInput({ ...salaryInput, hra: Number(e.target.value) })} 
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">DA</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={salaryInput.da} 
                        onChange={(e) => setSalaryInput({ ...salaryInput, da: Number(e.target.value) })} 
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Other</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        value={salaryInput.other} 
                        onChange={(e) => setSalaryInput({ ...salaryInput, other: Number(e.target.value) })} 
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                  </div>

                  <div className="flex justify-center mb-6">
                    <Button onClick={handleMonthlyCalculate}>Calculate ESI/PF</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {monthlyCalculations && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-bold text-blue-800 mb-2">PF Calculation (on Basic)</h4>
                  <p className="text-sm">Employee (12%): <span className="font-semibold">₹{monthlyCalculations.empPF.toFixed(2)}</span></p>
                  <p className="text-sm">Employer (12%): <span className="font-semibold">₹{monthlyCalculations.emplrPF.toFixed(2)}</span></p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-bold text-green-800 mb-2">ESI Calculation (on Gross)</h4>
                  <p className="text-sm">Eligibility: <span className={monthlyCalculations.esiEligible ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{monthlyCalculations.esiEligible ? "Yes" : "No"}</span></p>
                  <p className="text-sm">Employee (0.75%): <span className="font-semibold">₹{monthlyCalculations.empESI.toFixed(2)}</span></p>
                  <p className="text-sm">Employer (3.25%): <span className="font-semibold">₹{monthlyCalculations.emplrESI.toFixed(2)}</span></p>
                </div>
              </div>
              <div className="p-4 bg-gray-100 rounded-lg">
                <p className="text-lg">Gross Salary: <span className="font-bold">₹{monthlyCalculations.gross.toFixed(2)}</span></p>
                <p className="text-lg text-red-600">Total Deductions: <span className="font-bold">₹{monthlyCalculations.totalEmpDeductions.toFixed(2)}</span></p>
                <p className="text-2xl font-bold text-green-700 mt-2">Net Salary: ₹{monthlyCalculations.netSalary.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>      </div>
    </div>
  );
};

export default DashboardPage;