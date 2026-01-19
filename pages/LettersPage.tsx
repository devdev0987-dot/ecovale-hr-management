
import React, { useState, useEffect } from 'react';
import { getEmployees, updateEmployee } from '../services/storageService';
import { useAppContext } from '../contexts/AppContext';
import { Employee } from '../types';
import Button from '../components/ui/Button';
import { formatDate, generateAppointmentLetterBase64 } from '../utils/helpers';

const OfferLetterPreview = ({ employee, joinDate, additionalTerms }) => {
    const fullName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    const monthlyBasic = employee.salaryInfo.basic || 0;
    const monthlyHRA = employee.salaryInfo.hra || 0;
    const monthlySpecialAllowance = employee.salaryInfo.specialAllowance || 0;
    const grossSalary = employee.salaryInfo.gross || 0;
    const professionalTax = 200; // Standard PT
    const netSalary = employee.salaryInfo.net || 0;
    const annualCTC = employee.salaryInfo.ctc || 0;
    
    const yearlyBasic = monthlyBasic * 12;
    const yearlyHRA = monthlyHRA * 12;
    const yearlySpecial = monthlySpecialAllowance * 12;
    const yearlyGross = grossSalary * 12;
    const yearlyNet = netSalary * 12;

    // Helper to convert number to words (simplified)
    const numberToWords = (num: number) => {
        if (num >= 100000) {
            const lakhs = Math.floor(num / 100000);
            const remainder = num % 100000;
            if (remainder === 0) return `${lakhs} Lakh${lakhs > 1 ? 's' : ''} Only`;
            return `${lakhs} Lakh${lakhs > 1 ? 's' : ''} ${numberToWords(remainder)}`;
        }
        return `${num.toLocaleString('en-IN')} Only`;
    };

    return (
        <div className="p-8 border rounded-lg bg-white shadow-inner text-sm leading-relaxed">
            {/* Logo */}
            <div className="text-center mb-6">
                <img src="/logo.png" alt="Ecovale Logo" className="mx-auto h-20 object-contain" />
            </div>

            {/* Company Header */}
            <div className="text-center mb-8 border-b pb-4">
                <h1 className="text-xl font-bold text-gray-900 mb-2">ECOVALE INDIA PRIVATE LIMITED</h1>
                <p className="text-xs text-gray-600">Site No. 04, Sri Vinayaka Estate, 15/2,</p>
                <p className="text-xs text-gray-600">Hegganahalli Main Road,</p>
                <p className="text-xs text-gray-600">Srigandha Nagar, Sunkadakatte,</p>
                <p className="text-xs text-gray-600">Bengaluru - 560091</p>
                <p className="text-xs text-gray-600 mt-1">Email: hr@ecovaleindia.com | Phone: +91 63642 41314</p>
            </div>

            {/* Letter Title */}
            <h2 className="text-center text-lg font-bold mb-4 underline">OFFER LETTER</h2>

            {/* Date and Address */}
            <p className="mb-2"><strong>Date:</strong> {formatDate(joinDate || new Date().toISOString())}</p>
            <div className="mb-4">
                <p className="font-semibold">To,</p>
                <p className="font-semibold">{fullName}</p>
                <p className="text-gray-700">{employee.personalInfo.permanentAddress || 'Address Not Available'}</p>
            </div>

            <p className="mb-4">Dear {employee.personalInfo.firstName},</p>

            <p className="mb-4 text-justify">
                We are pleased to extend to you a formal offer of employment for the position of <strong>{employee.employmentDetails.designation}</strong> in the <strong>{employee.employmentDetails.department}</strong> department at Ecovale India Private Limited. The details of your offer are outlined below.
            </p>

            {/* Section 1: Position & Reporting */}
            <div className="mb-4">
                <p className="font-bold">1. Position & Reporting</p>
                <p className="ml-6 text-justify">
                    You will be appointed as <strong>{employee.employmentDetails.designation}</strong>. You will report to {employee.employmentDetails.reportingManager || 'the Management'} or any other person assigned by the management.
                </p>
            </div>

            {/* Section 2: Work Location */}
            <div className="mb-4">
                <p className="font-bold">2. Work Location</p>
                <p className="ml-6 text-justify">
                    Your primary place of posting will be <strong>{employee.employmentDetails.workLocation || 'Bengaluru'}</strong>. The company may transfer you to any location based on operational requirements.
                </p>
            </div>

            {/* Section 3: Working Hours */}
            <div className="mb-4">
                <p className="font-bold">3. Working Hours</p>
                <p className="ml-6 text-justify">
                    Your working hours shall be from 9:00 AM to 6:00 PM, Monday to Saturday. Sunday will be the weekly off. If required to work on Sunday or a holiday due to business needs, compensation will be provided as per policy.
                </p>
            </div>

            {/* Section 4: Compensation Structure */}
            <div className="mb-4">
                <p className="font-bold mb-2">4. Compensation Structure</p>
                <div className="ml-6">
                    <table className="w-full border-collapse border border-gray-400 text-xs">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-400 p-2 text-left">Component</th>
                                <th className="border border-gray-400 p-2 text-right">Monthly (₹)</th>
                                <th className="border border-gray-400 p-2 text-right">Yearly (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-gray-400 p-2">Basic Salary</td>
                                <td className="border border-gray-400 p-2 text-right">{monthlyBasic.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlyBasic.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 p-2">HRA</td>
                                <td className="border border-gray-400 p-2 text-right">{monthlyHRA.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlyHRA.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 p-2">Special Allowance</td>
                                <td className="border border-gray-400 p-2 text-right">{monthlySpecialAllowance.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlySpecial.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr className="font-semibold">
                                <td className="border border-gray-400 p-2">Gross Salary</td>
                                <td className="border border-gray-400 p-2 text-right">{grossSalary.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlyGross.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 p-2">Professional Tax</td>
                                <td className="border border-gray-400 p-2 text-right">{professionalTax}</td>
                                <td className="border border-gray-400 p-2 text-right">-</td>
                            </tr>
                            <tr className="font-bold bg-gray-50">
                                <td className="border border-gray-400 p-2">Net Salary</td>
                                <td className="border border-gray-400 p-2 text-right">{netSalary.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlyNet.toLocaleString('en-IN')}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="mt-2 font-semibold">
                        Annual CTC: ₹ {annualCTC.toLocaleString('en-IN')} ({numberToWords(annualCTC)})
                    </p>
                </div>
            </div>

            {/* Section 5: Probation Period */}
            <div className="mb-4">
                <p className="font-bold">5. Probation Period</p>
                <p className="ml-6">
                    You will be on a probation period of six (6) months from your date of joining. Confirmation of employment will be based on your performance and conduct.
                </p>
            </div>

            {/* Section 6: Mandatory Documents */}
            <div className="mb-4">
                <p className="font-bold">6. Mandatory Documents Required</p>
                <ul className="ml-6 list-disc list-inside space-y-1">
                    <li>Aadhaar Card</li>
                    <li>PAN Card</li>
                    <li>Educational Certificates (10th/12th/Degree)</li>
                    <li>Previous Experience / Relieving Letter</li>
                    <li>Last Three Salary Slips</li>
                    <li>Bank Account Details</li>
                    <li>Passport-size Photograph</li>
                    <li>Updated Resume</li>
                </ul>
            </div>

            {/* Section 7: Confidentiality */}
            <div className="mb-4">
                <p className="font-bold">7. Confidentiality</p>
                <p className="ml-6 text-justify">
                    You shall maintain the confidentiality of all company data, documents, materials, pricing, formulations and client/vendor information both during and after employment.
                </p>
            </div>

            {/* Section 8: Termination Clause */}
            <div className="mb-4">
                <p className="font-bold">8. Termination Clause</p>
                <p className="ml-6 text-justify">
                    Either party may terminate the employment by serving the notice period as per company policy. The company reserves the right to terminate your services immediately in case of misconduct or policy violation.
                </p>
            </div>

            {/* Section 9: Acceptance of Offer */}
            <div className="mb-6">
                <p className="font-bold">9. Acceptance of Offer</p>
                <p className="ml-6 text-justify">
                    Please sign and return a copy of this letter as confirmation of your acceptance of the offer. Additional joining formalities will be communicated by HR.
                </p>
            </div>

            {/* Signature Section */}
            <div className="mt-8 space-y-8">
                <div>
                    <p className="font-semibold">For Ecovale India Private Limited</p>
                    <p className="text-sm text-gray-600">(Authorized Signatory)</p>
                    <div className="mt-8 border-b border-gray-400 w-64"></div>
                </div>

                <div>
                    <p className="font-semibold">Employee Acceptance:</p>
                    <p className="text-sm">I, <strong>{fullName}</strong>, accept the terms mentioned in this Offer Letter.</p>
                    <div className="mt-8 flex justify-between items-end">
                        <div>
                            <p className="text-sm">Signature: ______________________</p>
                        </div>
                        <div>
                            <p className="text-sm">Date: ______________________</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AppointmentLetterPreview = ({ employee, joinDate, additionalTerms }) => {
    const fullName = `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`;
    
    // Format employee ID to ECO format
    const formatEmployeeId = (id: string) => {
        // If already in ECO format, return as is
        if (id.startsWith('ECO')) return id;
        // Otherwise, convert to ECO format
        const numericId = id.replace(/\D/g, '');
        return numericId ? `ECO${numericId.padStart(3, '0')}` : id;
    };
    
    const employeeId = formatEmployeeId(employee.id);
    const monthlyBasic = employee.salaryInfo.basic || 0;
    const monthlyHRA = employee.salaryInfo.hra || 0;
    const monthlySpecialAllowance = employee.salaryInfo.specialAllowance || 0;
    const grossSalary = employee.salaryInfo.gross || 0;
    const professionalTax = 200;
    const netSalary = employee.salaryInfo.net || 0;
    const annualCTC = employee.salaryInfo.ctc || 0;
    
    const yearlyBasic = monthlyBasic * 12;
    const yearlyHRA = monthlyHRA * 12;
    const yearlySpecial = monthlySpecialAllowance * 12;
    const yearlyGross = grossSalary * 12;
    const yearlyNet = netSalary * 12;

    const numberToWords = (num: number) => {
        if (num >= 100000) {
            const lakhs = Math.floor(num / 100000);
            const remainder = num % 100000;
            if (remainder === 0) return `${lakhs} Lakh${lakhs > 1 ? 's' : ''} Only`;
            return `${lakhs} Lakh${lakhs > 1 ? 's' : ''} ${numberToWords(remainder)}`;
        }
        return `${num.toLocaleString('en-IN')} Only`;
    };

    return (
        <div className="p-8 border rounded-lg bg-white shadow-inner text-sm leading-relaxed">
            {/* Logo */}
            <div className="text-center mb-6">
                <img src="/logo.png" alt="Ecovale Logo" className="mx-auto h-20 object-contain" />
            </div>

            {/* Company Header */}
            <div className="text-center mb-8 border-b pb-4">
                <h1 className="text-xl font-bold text-gray-900 mb-2">ECOVALE INDIA PRIVATE LIMITED</h1>
                <p className="text-xs text-gray-600">Site No. 04, Sri Vinayaka Estate, 15/2,</p>
                <p className="text-xs text-gray-600">Hegganahalli Main Road,</p>
                <p className="text-xs text-gray-600">Srigandha Nagar, Sunkadakatte,</p>
                <p className="text-xs text-gray-600">Bengaluru - 560091</p>
                <p className="text-xs text-gray-600 mt-1">Email: hr@ecovaleindia.com | Phone: +91 63642 41314</p>
            </div>

            {/* Letter Title */}
            <h2 className="text-center text-lg font-bold mb-4 underline">APPOINTMENT LETTER</h2>

            {/* Date and Employee ID */}
            <p className="mb-2"><strong>Date:</strong> {formatDate(joinDate || new Date().toISOString())}</p>
            <p className="mb-4"><strong>Employee ID:</strong> {employeeId}</p>
            
            {/* Address */}
            <div className="mb-4">
                <p className="font-semibold">To,</p>
                <p className="font-semibold">{fullName}</p>
                <p className="text-gray-700">{employee.personalInfo.permanentAddress || 'Address Not Available'}</p>
            </div>

            <p className="mb-4">Dear {employee.personalInfo.firstName},</p>

            <p className="mb-4 text-justify">
                We are pleased to confirm your appointment as <strong>{employee.employmentDetails.designation}</strong> in the <strong>{employee.employmentDetails.department}</strong> department at Ecovale India Private Limited. This letter outlines the full terms of your employment.
            </p>

            {/* Section 1: Position, Duties & Responsibilities */}
            <div className="mb-4">
                <p className="font-bold">1. Position, Duties & Responsibilities</p>
                <ul className="ml-6 list-disc space-y-1">
                    <li>Executing assigned duties with professionalism.</li>
                    <li>Maintaining discipline, punctuality, and team coordination.</li>
                    <li>Following company SOPs, quality standards, and reporting structures.</li>
                </ul>
            </div>

            {/* Section 2: Reporting Structure */}
            <div className="mb-4">
                <p className="font-bold">2. Reporting Structure</p>
                <p className="ml-6">
                    You will report to <strong>{employee.employmentDetails.reportingManager || 'the Management'}</strong> or any person authorized by the management. Your reporting structure may change as per business needs.
                </p>
            </div>

            {/* Section 3: Place of Posting */}
            <div className="mb-4">
                <p className="font-bold">3. Place of Posting</p>
                <p className="ml-6">
                    Your initial posting will be <strong>{employee.employmentDetails.workLocation || 'Bengaluru'}</strong>. The company reserves the right to transfer you to any of its branches or operational locations.
                </p>
            </div>

            {/* Section 4: Working Hours, Attendance & Holidays */}
            <div className="mb-4">
                <p className="font-bold">4. Working Hours, Attendance & Holidays</p>
                <p className="ml-6">
                    Your working hours shall be 9:00 AM to 6:00 PM, Monday to Saturday. Sunday is a weekly off. If you are required to work on Sundays or holidays due to operational requirements, compensation or compensatory off will be provided as per policy.
                </p>
            </div>

            {/* Section 5: Compensation Structure */}
            <div className="mb-4">
                <p className="font-bold mb-2">5. Compensation Structure</p>
                <div className="ml-6">
                    <table className="w-full border-collapse border border-gray-400 text-xs">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-400 p-2 text-left">Component</th>
                                <th className="border border-gray-400 p-2 text-right">Monthly (₹)</th>
                                <th className="border border-gray-400 p-2 text-right">Yearly (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-gray-400 p-2">Basic Salary</td>
                                <td className="border border-gray-400 p-2 text-right">{monthlyBasic.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlyBasic.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 p-2">HRA</td>
                                <td className="border border-gray-400 p-2 text-right">{monthlyHRA.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlyHRA.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 p-2">Special Allowance</td>
                                <td className="border border-gray-400 p-2 text-right">{monthlySpecialAllowance.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlySpecial.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr className="font-semibold">
                                <td className="border border-gray-400 p-2">Gross Salary</td>
                                <td className="border border-gray-400 p-2 text-right">{grossSalary.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlyGross.toLocaleString('en-IN')}</td>
                            </tr>
                            <tr>
                                <td className="border border-gray-400 p-2">Professional Tax</td>
                                <td className="border border-gray-400 p-2 text-right">{professionalTax}</td>
                                <td className="border border-gray-400 p-2 text-right">—</td>
                            </tr>
                            <tr className="font-bold bg-gray-50">
                                <td className="border border-gray-400 p-2">Net Salary</td>
                                <td className="border border-gray-400 p-2 text-right">{netSalary.toLocaleString('en-IN')}</td>
                                <td className="border border-gray-400 p-2 text-right">{yearlyNet.toLocaleString('en-IN')}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="mt-2 font-semibold">
                        Annual CTC: ₹ {annualCTC.toLocaleString('en-IN')} ({numberToWords(annualCTC)})
                    </p>
                </div>
            </div>

            {/* Section 6: Probation Period */}
            <div className="mb-4">
                <p className="font-bold">6. Probation Period</p>
                <p className="ml-6">
                    You will be on probation for six (6) months from your date of joining. Confirmation will depend on performance, discipline, and conduct.
                </p>
            </div>

            {/* Section 7: Leave Policy */}
            <div className="mb-4">
                <p className="font-bold">7. Leave Policy</p>
                <p className="ml-6">
                    You will be eligible for leave as per the company's leave policy. Uninformed or excessive absence may lead to disciplinary action.
                </p>
            </div>

            {/* Section 8: Confidentiality */}
            <div className="mb-4">
                <p className="font-bold">8. Confidentiality</p>
                <p className="ml-6">
                    All company information must be kept confidential. Unauthorized sharing of data, documents, or internal processes is strictly prohibited even after separation from the company.
                </p>
            </div>

            {/* Section 9: Code of Conduct */}
            <div className="mb-4">
                <p className="font-bold">9. Code of Conduct</p>
                <p className="ml-6">
                    You are expected to maintain professional behaviour, integrity, and compliance with company policies. Any misconduct may result in disciplinary action.
                </p>
            </div>

            {/* Section 10: Transferability */}
            <div className="mb-4">
                <p className="font-bold">10. Transferability</p>
                <p className="ml-6">
                    Management reserves the right to transfer you to any department or company location as required.
                </p>
            </div>

            {/* Section 11: Termination and Notice Period */}
            <div className="mb-4">
                <p className="font-bold">11. Termination and Notice Period</p>
                <p className="ml-6 text-justify">
                    Upon confirmation, your employment may be terminated by either party by giving three (3) months' notice in writing. The Company reserves the right, at its sole discretion, to substitute the notice period with a payment of an amount equivalent to your basic salary for the notice period. During the notice period, you shall ensure a complete and satisfactory handover of all responsibilities, documents, and company property.
                </p>
            </div>

            {/* Section 12: Background Verification */}
            <div className="mb-4">
                <p className="font-bold">12. Background Verification</p>
                <p className="ml-6">
                    Your appointment is subject to successful verification of your identity, address, education, and past employment.
                </p>
            </div>

            {/* Section 13: Acceptance */}
            <div className="mb-6">
                <p className="font-bold">13. Acceptance</p>
                <p className="ml-6">
                    By signing below, you acknowledge and accept all the terms and conditions mentioned in this Appointment Letter.
                </p>
            </div>

            {/* Signature Section */}
            <div className="mt-8 space-y-8">
                <div>
                    <p className="font-semibold">For Ecovale India Private Limited</p>
                    <p className="text-sm text-gray-600">(Authorized Signatory)</p>
                    <div className="mt-8 border-b border-gray-400 w-64"></div>
                </div>

                <div>
                    <p className="font-semibold">Employee Declaration:</p>
                    <p className="text-sm">I, <strong>{fullName}</strong>, accept all terms stated in this Appointment Letter.</p>
                    <div className="mt-8 flex justify-between items-end">
                        <div>
                            <p className="text-sm">Signature: ______________________</p>
                        </div>
                        <div>
                            <p className="text-sm">Date: ______________________</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LetterPreview = ({ employee, joinDate, additionalTerms, letterType }) => {
    if (!employee) {
        return (
            <div className="p-8 border rounded-lg bg-gray-50 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-medium">Select an employee to see a preview</p>
                <p className="text-sm mt-2">Choose an employee from the dropdown to generate a letter preview</p>
            </div>
        );
    }

    return letterType === 'offer' 
        ? <OfferLetterPreview employee={employee} joinDate={joinDate} additionalTerms={additionalTerms} />
        : <AppointmentLetterPreview employee={employee} joinDate={joinDate} additionalTerms={additionalTerms} />;
};

const LettersPage: React.FC = () => {
    const { showToast, bumpEmployeesVersion } = useAppContext();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [joinDate, setJoinDate] = useState(new Date().toISOString().split('T')[0]);
    const [additionalTerms, setAdditionalTerms] = useState('');
    const [letterType, setLetterType] = useState<'offer' | 'appointment'>('offer');

    useEffect(() => {
        getEmployees().then(setEmployees);
    }, []);

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    useEffect(() => {
        if (selectedEmployee) {
            setJoinDate(selectedEmployee.employmentDetails.joinDate ? selectedEmployee.employmentDetails.joinDate.split('T')[0] : new Date().toISOString().split('T')[0]);
        }
    }, [selectedEmployee]);

    const handleSave = async () => {
        if (!selectedEmployee) return showToast('Select an employee first', 'error');
        try {
            const updated: Employee = { ...selectedEmployee, employmentDetails: { ...selectedEmployee.employmentDetails, joinDate } };
            await updateEmployee(updated);
            // refresh local list
            setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
            try { bumpEmployeesVersion(); } catch (e) {}
            showToast('Offer date saved to employee record', 'success');
        } catch (err: any) {
            showToast(err?.message || 'Failed to save offer date', 'error');
        }
    };

    const downloadDataUri = (dataUri: string, filename: string) => {
        const a = document.createElement('a');
        a.href = dataUri;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const handleDownload = () => {
        if (!selectedEmployee) return showToast('Select an employee first', 'error');

        const fullName = `${selectedEmployee.personalInfo.firstName} ${selectedEmployee.personalInfo.lastName}`;

        if (letterType === 'appointment') {
            const monthlyBasic = selectedEmployee.salaryInfo.basic || 0;
            const monthlyHRA = selectedEmployee.salaryInfo.hra || 0;
            const monthlySpecialAllowance = selectedEmployee.salaryInfo.specialAllowance || 0;
            const grossSalary = selectedEmployee.salaryInfo.gross || 0;
            const professionalTax = 200;
            const netSalary = selectedEmployee.salaryInfo.net || 0;
            const annualCTC = selectedEmployee.salaryInfo.ctc || 0;

            const lines: string[] = [];
            lines.push('');
            lines.push('                     ECOVALE INDIA PRIVATE LIMITED');
            lines.push('                    Site No. 04, Sri Vinayaka Estate, 15/2,');
            lines.push('                           Hegganahalli Main Road,');
            lines.push('                        Srigandha Nagar, Sunkadakatte,');
            lines.push('                              Bengaluru - 560091');
            lines.push('           Email: hr@ecovaleindia.com | Phone: +91 63642 41314');
            lines.push('');
            lines.push('                              APPOINTMENT LETTER');
            lines.push('');
            lines.push(`Date: ${formatDate(joinDate)}`);
            const employeeId = selectedEmployee.id.startsWith('ECO') ? selectedEmployee.id : `ECO${selectedEmployee.id.replace(/\D/g, '').padStart(3, '0')}`;
            lines.push(`Employee ID: ${employeeId}`);
            lines.push('');
            lines.push('To,');
            lines.push(`${fullName}`);
            lines.push(`${selectedEmployee.personalInfo.permanentAddress || 'Address Not Available'}`);
            lines.push('');
            lines.push(`Dear ${selectedEmployee.personalInfo.firstName},`);
            lines.push('');
            lines.push(`We are pleased to confirm your appointment as ${selectedEmployee.employmentDetails.designation} in the ${selectedEmployee.employmentDetails.department} department at Ecovale India Private Limited. This letter outlines the full terms of your employment.`);
            lines.push('');
            lines.push('1. Position, Duties & Responsibilities');
            lines.push('   • Executing assigned duties with professionalism.');
            lines.push('   • Maintaining discipline, punctuality, and team coordination.');
            lines.push('   • Following company SOPs, quality standards, and reporting structures.');
            lines.push('');
            lines.push('2. Reporting Structure');
            lines.push(`   You will report to ${selectedEmployee.employmentDetails.reportingManager || 'the Management'} or any person authorized by the management. Your reporting structure may change as per business needs.`);
            lines.push('');
            lines.push('3. Place of Posting');
            lines.push(`   Your initial posting will be ${selectedEmployee.employmentDetails.workLocation || 'Bengaluru'}. The company reserves the right to transfer you to any of its branches or operational locations.`);
            lines.push('');
            lines.push('4. Working Hours, Attendance & Holidays');
            lines.push('   Your working hours shall be 9:00 AM to 6:00 PM, Monday to Saturday. Sunday is a weekly off. If you are required to work on Sundays or holidays due to operational requirements, compensation or compensatory off will be provided as per policy.');
            lines.push('');
            lines.push('5. Compensation Structure');
            lines.push('');
            lines.push('Component                    Monthly (₹)         Yearly (₹)');
            lines.push('----------------------------------------------------------------');
            lines.push(`Basic Salary                 ${monthlyBasic.toLocaleString('en-IN').padStart(15)}    ${(monthlyBasic * 12).toLocaleString('en-IN').padStart(15)}`);
            lines.push(`HRA                          ${monthlyHRA.toLocaleString('en-IN').padStart(15)}    ${(monthlyHRA * 12).toLocaleString('en-IN').padStart(15)}`);
            lines.push(`Special Allowance            ${monthlySpecialAllowance.toLocaleString('en-IN').padStart(15)}    ${(monthlySpecialAllowance * 12).toLocaleString('en-IN').padStart(15)}`);
            lines.push(`Gross Salary                 ${grossSalary.toLocaleString('en-IN').padStart(15)}    ${(grossSalary * 12).toLocaleString('en-IN').padStart(15)}`);
            lines.push(`Professional Tax             ${professionalTax.toString().padStart(15)}    —`);
            lines.push(`Net Salary                   ${netSalary.toLocaleString('en-IN').padStart(15)}    ${(netSalary * 12).toLocaleString('en-IN').padStart(15)}`);
            lines.push('');
            lines.push(`Annual CTC: ₹ ${annualCTC.toLocaleString('en-IN')}`);
            lines.push('');
            lines.push('6. Probation Period');
            lines.push('   You will be on probation for six (6) months from your date of joining. Confirmation will depend on performance, discipline, and conduct.');
            lines.push('');
            lines.push('7. Leave Policy');
            lines.push('   You will be eligible for leave as per the company\'s leave policy. Uninformed or excessive absence may lead to disciplinary action.');
            lines.push('');
            lines.push('8. Confidentiality');
            lines.push('   All company information must be kept confidential. Unauthorized sharing of data, documents, or internal processes is strictly prohibited even after separation from the company.');
            lines.push('');
            lines.push('9. Code of Conduct');
            lines.push('   You are expected to maintain professional behaviour, integrity, and compliance with company policies. Any misconduct may result in disciplinary action.');
            lines.push('');
            lines.push('10. Transferability');
            lines.push('   Management reserves the right to transfer you to any department or company location as required.');
            lines.push('');
            lines.push('11. Termination and Notice Period');
            lines.push('   Upon confirmation, your employment may be terminated by either party by giving three (3) months\' notice in writing. The Company reserves the right, at its sole discretion, to substitute the notice period with a payment of an amount equivalent to your basic salary for the notice period. During the notice period, you shall ensure a complete and satisfactory handover of all responsibilities, documents, and company property.');
            lines.push('');
            lines.push('12. Background Verification');
            lines.push('   Your appointment is subject to successful verification of your identity, address, education, and past employment.');
            lines.push('');
            lines.push('13. Acceptance');
            lines.push('   By signing below, you acknowledge and accept all the terms and conditions mentioned in this Appointment Letter.');
            lines.push('');
            lines.push('For Ecovale India Private Limited');
            lines.push('(Authorized Signatory)');
            lines.push('');
            lines.push('______________________________');
            lines.push('');
            lines.push('Employee Declaration:');
            lines.push('');
            lines.push(`I, ${fullName}, accept all terms stated in this Appointment Letter.`);
            lines.push('');
            lines.push('');
            lines.push('');
            lines.push('');
            lines.push('Signature: ______________________                        Date: ______________________');

            const text = lines.join('\n');
            const utf8 = encodeURIComponent(text);
            const base64 = btoa(unescape(utf8));
            const dataUri = `data:text/plain;base64,${base64}`;
            const safeName = `Appointment_Letter_${fullName.replace(/\s+/g, '_')}.txt`;
            downloadDataUri(dataUri, safeName);
            showToast('Appointment letter downloaded', 'success');
            return;
        }

        // Generate formatted offer letter for download
        const monthlyBasic = selectedEmployee.salaryInfo.basic || 0;
        const monthlyHRA = selectedEmployee.salaryInfo.hra || 0;
        const monthlySpecialAllowance = selectedEmployee.salaryInfo.specialAllowance || 0;
        const grossSalary = selectedEmployee.salaryInfo.gross || 0;
        const professionalTax = 200;
        const netSalary = selectedEmployee.salaryInfo.net || 0;
        const annualCTC = selectedEmployee.salaryInfo.ctc || 0;
        
        const lines: string[] = [];
        lines.push('');
        lines.push('                                         [E]');
        lines.push('');
        lines.push('');
        lines.push('                     ECOVALE INDIA PRIVATE LIMITED');
        lines.push('                    Site No. 04, Sri Vinayaka Estate, 15/2,');
        lines.push('                           Hegganahalli Main Road,');
        lines.push('                        Srigandha Nagar, Sunkadakatte,');
        lines.push('                              Bengaluru - 560091');
        lines.push('           Email: hr@ecovaleindia.com | Phone: +91 63642 41314');
        lines.push('');
        lines.push('                                  OFFER LETTER');
        lines.push('');
        lines.push(`Date: ${formatDate(joinDate)}`);
        lines.push('');
        lines.push('To,');
        lines.push(`${fullName}`);
        lines.push(`${selectedEmployee.personalInfo.permanentAddress || 'Address Not Available'}`);
        lines.push('');
        lines.push(`Dear ${selectedEmployee.personalInfo.firstName},`);
        lines.push('');
        lines.push(`       We are pleased to extend to you a formal offer of employment for the position of ${selectedEmployee.employmentDetails.designation} in the ${selectedEmployee.employmentDetails.department} department at Ecovale India Private Limited. The details of your offer are outlined below.`);
        lines.push('');
        lines.push('1. Position & Reporting');
        lines.push(`       You will be appointed as ${selectedEmployee.employmentDetails.designation}. You will report to ${selectedEmployee.employmentDetails.reportingManager || 'the Management'} or any other person assigned by the management.`);
        lines.push('');
        lines.push('2. Work Location');
        lines.push(`       Your primary place of posting will be ${selectedEmployee.employmentDetails.workLocation || 'Bengaluru'}. The company may transfer you to any location based on operational requirements.`);
        lines.push('');
        lines.push('3. Working Hours');
        lines.push('       Your working hours shall be from 9:00 AM to 6:00 PM, Monday to Saturday. Sunday will be the weekly off. If required to work on Sunday or a holiday due to business needs, compensation will be provided as per policy.');
        lines.push('');
        lines.push('4. Compensation Structure');
        lines.push('');
        lines.push('Component                    Monthly (₹)         Yearly (₹)');
        lines.push('----------------------------------------------------------------');
        lines.push(`Basic Salary                 ${monthlyBasic.toLocaleString('en-IN').padStart(15)}    ${(monthlyBasic * 12).toLocaleString('en-IN').padStart(15)}`);
        lines.push(`HRA                          ${monthlyHRA.toLocaleString('en-IN').padStart(15)}    ${(monthlyHRA * 12).toLocaleString('en-IN').padStart(15)}`);
        lines.push(`Special Allowance            ${monthlySpecialAllowance.toLocaleString('en-IN').padStart(15)}    ${(monthlySpecialAllowance * 12).toLocaleString('en-IN').padStart(15)}`);
        lines.push(`Gross Salary                 ${grossSalary.toLocaleString('en-IN').padStart(15)}    ${(grossSalary * 12).toLocaleString('en-IN').padStart(15)}`);
        lines.push(`Professional Tax             ${professionalTax.toString().padStart(15)}    -`);
        lines.push(`Net Salary                   ${netSalary.toLocaleString('en-IN').padStart(15)}    ${(netSalary * 12).toLocaleString('en-IN').padStart(15)}`);
        lines.push('');
        lines.push(`Annual CTC: ₹ ${annualCTC.toLocaleString('en-IN')}`);
        lines.push('');
        lines.push('5. Probation Period');
        lines.push('       You will be on a probation period of six (6) months from your date of joining. Confirmation of employment will be based on your performance and conduct.');
        lines.push('');
        lines.push('6. Mandatory Documents Required');
        lines.push('       • Aadhaar Card');
        lines.push('       • PAN Card');
        lines.push('       • Educational Certificates (10th/12th/Degree)');
        lines.push('       • Previous Experience / Relieving Letter');
        lines.push('       • Last Three Salary Slips');
        lines.push('       • Bank Account Details');
        lines.push('       • Passport-size Photograph');
        lines.push('       • Updated Resume');
        lines.push('');
        lines.push('7. Confidentiality');
        lines.push('       You shall maintain the confidentiality of all company data, documents, materials, pricing, formulations and client/vendor information both during and after employment.');
        lines.push('');
        lines.push('8. Termination Clause');
        lines.push('       Either party may terminate the employment by serving the notice period as per company policy. The company reserves the right to terminate your services immediately in case of misconduct or policy violation.');
        lines.push('');
        lines.push('9. Acceptance of Offer');
        lines.push('       Please sign and return a copy of this letter as confirmation of your acceptance of the offer. Additional joining formalities will be communicated by HR.');
        lines.push('');
        lines.push('For Ecovale India Private Limited');
        lines.push('(Authorized Signatory)');
        lines.push('');
        lines.push('______________________________');
        lines.push('');
        lines.push('Employee Acceptance:');
        lines.push('');
        lines.push(`I, ${fullName}, accept the terms mentioned in this Offer Letter.`);
        lines.push('');
        lines.push('');
        lines.push('');
        lines.push('');
        lines.push('Signature: ______________________    Date: ______________________');

        const text = lines.join('\n');
        const utf8 = encodeURIComponent(text);
        const base64 = btoa(unescape(utf8));
        const dataUri = `data:text/plain;base64,${base64}`;
        const safeName = `Offer_Letter_${fullName.replace(/\s+/g, '_')}.txt`;
        downloadDataUri(dataUri, safeName);
        showToast('Offer letter downloaded', 'success');
    };

    return (
        <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Letters & Documents</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold mb-4">Offer Letter Generator</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Letter Type</label>
                            <select value={letterType} onChange={e => setLetterType(e.target.value as any)} className="w-full p-2 border rounded-md">
                                <option value="offer">Offer Letter</option>
                                <option value="appointment">Appointment Letter</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee*</label>
                            <select
                                value={selectedEmployeeId}
                                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                                className="w-full p-2 border rounded-md"
                            >
                                <option value="">-- Select an Employee --</option>
                                {employees.map(e => (
                                    <option key={e.id} value={e.id}>
                                        {e.personalInfo.firstName} {e.personalInfo.lastName} ({e.id})
                                    </option>
                                ))}
                            </select>
                        </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {letterType === 'appointment' ? 'Appointment Date*' : 'Offer Date*'}
                                    </label>
                                    <input type="date" value={joinDate} onChange={e => setJoinDate(e.target.value)} className="w-full p-2 border rounded-md" />
                                </div>
                         <div>
                           <label className="block text-sm font-medium text-gray-700 mb-1">Additional Terms</label>
                           <textarea value={additionalTerms} onChange={e => setAdditionalTerms(e.target.value)} rows={5} className="w-full p-2 border rounded-md" />
                        </div>
                        <div className="flex space-x-2">
                                <Button onClick={handleDownload}>Download</Button>
                                <Button variant="secondary" onClick={handleSave}>Save</Button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <LetterPreview employee={selectedEmployee} joinDate={joinDate} additionalTerms={additionalTerms} letterType={letterType} />
                </div>
            </div>
        </div>
    );
};

export default LettersPage;
