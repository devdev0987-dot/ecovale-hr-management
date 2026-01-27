
import React, { useState, useEffect } from 'react';
import { getEmployees } from '../services/storageService';
import { Employee } from '../types';
import Button from '../components/ui/Button';

const CalculatorPage: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [manualInput, setManualInput] = useState(true);
    const [ctc, setCtc] = useState<number>(0);
    const [hraPct, setHraPct] = useState<number>(10);
    const [salary, setSalary] = useState({ basic: 0, hra: 0, da: 0, other: 0 });
    const [calculations, setCalculations] = useState(null);

    useEffect(() => {
        getEmployees().then(setEmployees);
    }, []);

    useEffect(() => {
        if (!manualInput && selectedEmployeeId) {
            const emp = employees.find(e => e.id === selectedEmployeeId);
            if (emp) {
                setSalary({
                    basic: emp.salaryInfo.basic,
                    hra: emp.salaryInfo.hra,
                    da: emp.salaryInfo.da,
                    other: emp.salaryInfo.specialAllowance
                });
            }
        }
    }, [selectedEmployeeId, manualInput, employees]);
    
    const handleCalculate = () => {
        // determine basic from entered salary (manual entry)
        const basic = Number(salary.basic);
        // HRA is percentage of basic
        const hra = (basic * (hraPct || 0)) / 100;
        const da = Number(salary.da) || 0;
        const other = Number(salary.other) || 0;
        const gross = basic + hra + da + other;
        // compute special allowance to balance CTC if CTC provided
        const ctcMonthly = ctc / 12;
        const special = ctc > 0 ? Math.max(0, ctcMonthly - (basic + hra + da + other)) : 0;

        const empPF = basic * 0.12;
        const emplrPF = basic * 0.12;
        let empESI = 0, emplrESI = 0;
        const esiEligible = gross < 21000;
        if (esiEligible) {
            empESI = gross * 0.0075;
            emplrESI = gross * 0.0325;
        }
        const totalEmpDeductions = empPF + empESI;
        const netSalary = gross - totalEmpDeductions;

        setCalculations({ gross, basic, hra, special, empPF, emplrPF, empESI, emplrESI, esiEligible, totalEmpDeductions, netSalary, ctcMonthly, ctcAnnual: ctc });
    };

    const handleInputChange = (e) => {
        setSalary({ ...salary, [e.target.name]: Number(e.target.value) });
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">ESI/PF Calculator</h2>
            <div className="bg-white p-6 rounded-lg shadow-md mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                     <label className="flex items-center"><input type="checkbox" checked={manualInput} onChange={(e) => setManualInput(e.target.checked)} className="h-4 w-4 rounded" /> <span className="ml-2">Manual Input</span></label>
                     {!manualInput && (
                         <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full mt-2 p-2 border rounded-md">
                             <option value="">Select Employee</option>
                             {employees.map(e => <option key={e.id} value={e.id}>{e.personalInfo.firstName} {e.personalInfo.lastName}</option>)}
                         </select>
                     )}
                </div>
                 <div className="grid grid-cols-2 gap-4">
                     <input type="number" name="ctc" placeholder="Annual CTC" value={ctc} onChange={(e) => setCtc(Number(e.target.value))} className="p-2 border rounded-md" />
                     <input type="number" name="hraPct" placeholder="HRA % of Basic" value={hraPct} onChange={(e) => setHraPct(Number(e.target.value))} className="p-2 border rounded-md" />
                            <input type="number" name="basic" placeholder="Basic (monthly)" value={salary.basic} onChange={handleInputChange} className="p-2 border rounded-md" />
                     <input type="number" name="da" placeholder="DA" value={salary.da} onChange={handleInputChange} disabled={!manualInput} className="p-2 border rounded-md" />
                     <input type="number" name="other" placeholder="Other (Conveyance/Telephone/Medical)" value={salary.other} onChange={handleInputChange} disabled={!manualInput} className="p-2 border rounded-md col-span-2" />
                 </div>
            </div>
            <div className="flex justify-center mb-6">
                <Button onClick={handleCalculate}>Calculate</Button>
            </div>

            {calculations && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm">Monthly Basic: <strong>₹{calculations.basic.toFixed(2)}</strong></p>
                            <p className="text-sm">HRA: <strong>₹{calculations.hra.toFixed(2)}</strong></p>
                            <p className="text-sm">Special Allowance: <strong>₹{calculations.special.toFixed(2)}</strong></p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm">CTC (monthly): <strong>₹{(calculations.ctcMonthly || 0).toFixed(2)}</strong></p>
                            <p className="text-sm">CTC (annual): <strong>₹{(calculations.ctcAnnual || 0).toFixed(2)}</strong></p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm">Gross (monthly): <strong>₹{calculations.gross.toFixed(2)}</strong></p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="p-4 bg-blue-50 rounded-lg">
                           <h4 className="font-bold text-blue-800">PF Calculation (on Basic)</h4>
                           <p>Employee (12%): ₹{calculations.empPF.toFixed(2)}</p>
                           <p>Employer (12%): ₹{calculations.emplrPF.toFixed(2)}</p>
                        </div>
                         <div className="p-4 bg-green-50 rounded-lg">
                           <h4 className="font-bold text-green-800">ESI Calculation (on Gross)</h4>
                           <p>Eligibility: {calculations.esiEligible ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-red-600 font-bold">No</span>}</p>
                           <p>Employee (0.75%): ₹{calculations.empESI.toFixed(2)}</p>
                           <p>Employer (3.25%): ₹{calculations.emplrESI.toFixed(2)}</p>
                        </div>
                    </div>
                     <div className="text-center p-4 bg-gray-100 rounded-lg">
                        <p className="text-lg">Gross Salary: <span className="font-bold">₹{calculations.gross.toFixed(2)}</span></p>
                        <p className="text-lg text-red-600">Total Deductions: <span className="font-bold">₹{calculations.totalEmpDeductions.toFixed(2)}</span></p>
                        <p className="text-2xl font-bold text-green-700 mt-2">Net Salary: ₹{calculations.netSalary.toFixed(2)}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalculatorPage;
