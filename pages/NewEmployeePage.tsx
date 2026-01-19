
import React, { useReducer, useEffect, useState } from 'react';
import { saveEmployee, getDesignations, getEmployees, getEmployeeById, updateEmployee, getEmploymentTypes, saveEmploymentType, getDepartments, saveDepartment, saveDesignation } from '../services/storageService';
import { Employee, Designation } from '../types';
import { DEPARTMENTS, WORK_LOCATIONS, GENDERS, PAYMENT_MODES, GRADES, PF_WAGE_CEILING_MONTHLY, PF_EMPLOYER_RATE, ESI_EMPLOYER_RATE, GRATUITY_RATE_ANNUAL, EMPLOYEE_TYPE_LABELS } from '../utils/constants';
import Button from '../components/ui/Button';
import { useAppContext } from '../contexts/AppContext';
import { calculateSalaryFromCTC, calculateSalary, fileToBase64, validateEmail, generateAnnexureBase64 } from '../utils/helpers';
import Input from '../components/ui/Input';
import GstCalculator from '../components/ui/GstCalculator';


const initialFormData: Omit<Employee, 'createdAt' | 'updatedAt'> & { employeeId?: string } = {
    id: '',
    employeeId: '',
    personalInfo: { firstName: '', middleName: '', lastName: '', gender: 'Male', contactNumber: '', alternateContact: '', personalEmail: '', currentAddress: '', photo: '' },
    employmentDetails: { type: 'full-time', department: 'IT', designation: '', officialEmail: '', workLocation: 'Bangalore', probationPeriod: 6, grade: 'A' },
    salaryInfo: { ctc: 300000, basic: 0, hraPercentage: 10, hra: 0, conveyance: 0, telephone: 0, medicalAllowance: 0, specialAllowance: 0, employeeHealthInsuranceAnnual: 1000, gross: 0, includePF: true, includeESI: false, pfDeduction: 0, esiDeduction: 0, employerPF: 0, employerESI: 0, professionalTax: 200, tds: 0, tdsMonthly: 0, gstMonthly: 0, gstAnnual: 0, professionalFeesMonthly: 0, professionalFeesInclusive: false, professionalFeesBaseMonthly: 0, professionalFeesTotalMonthly: 0, professionalFeesBaseAnnual: 0, professionalFeesTotalAnnual: 0, net: 0, paymentMode: 'Bank' },
    documents: [],
    careerHistory: [],
    status: 'active'
};

function formReducer(state, action) {
    switch (action.type) {
        case 'UPDATE_FIELD':
            const { section, field, value } = action.payload;
            
            // Handle employeeId separately since it's not in a section
            if (field === 'employeeId') {
                return { ...state, employeeId: value };
            }
            
            const newState = { ...state };
            newState[section][field] = value;
            
            // Auto-generate official email
            if (section === 'personalInfo' && (field === 'firstName' || field === 'lastName')) {
                const firstName = (field === 'firstName' ? value : state.personalInfo.firstName).toLowerCase();
                const lastName = (field === 'lastName' ? value : state.personalInfo.lastName).toLowerCase();
                if(firstName && lastName) {
                    newState.employmentDetails.officialEmail = `${firstName}.${lastName}@ecovale.com`;
                }
            }
            
            return newState;
        case 'UPDATE_SALARY':
             return { ...state, salaryInfo: { ...state.salaryInfo, ...action.payload } };
        case 'SET_PHOTO':
            return { ...state, personalInfo: { ...state.personalInfo, photo: action.payload } };
        case 'RESET':
            return initialFormData;
        default:
            return state;
    }
}

const NewEmployeePage: React.FC = () => {
    const { showToast, setActivePage, selectedEmployeeId, setSelectedEmployeeId, bumpEmployeesVersion } = useAppContext();
    const [state, dispatch] = useReducer(formReducer, initialFormData);
    // form state
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [employmentTypes, setEmploymentTypes] = useState<string[]>([]);
    const [departmentsList, setDepartmentsList] = useState<any[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [deptForm, setDeptForm] = useState({ name: '', code: '', grade: 'A', head: '', description: '', status: 'active' });
    const [showDesignationModal, setShowDesignationModal] = useState(false);
    const [designationForm, setDesignationForm] = useState({ title: '', department: '', grade: 'A', level: 1, reportingTo: '', description: '' });
    const [errors, setErrors] = useState<any>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAnnexureModal, setShowAnnexureModal] = useState(false);
    const [annexureEditData, setAnnexureEditData] = useState({ basic: 0, hra: 0, da: 0, specialAllowance: 0, gross: 0, net: 0, ctc: 0 });
    const [showCtcCalculator, setShowCtcCalculator] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [desigs, emps, types, depts] = await Promise.all([getDesignations(), getEmployees(), getEmploymentTypes(), getDepartments()]);
                setDesignations(desigs);
                setEmployees(emps);
                setEmploymentTypes(types || []);
                setDepartmentsList(Array.isArray(depts) ? depts : []);
            } catch (error) {
                showToast('Failed to load initial form data', 'error');
            }
        };
        fetchData();
    }, [showToast]);

    useEffect(() => {
        const { ctc, hraPercentage, conveyance, telephone, medicalAllowance, specialAllowance, includePF, includeESI, tds } = state.salaryInfo;
        let basicFromCalc = 0, hraCalc = 0, c = 0, t = 0, m = 0, sa = 0, gross = 0, pfDeduction = 0, employerPF = 0, esiDeduction = 0, employerESI = 0, gratuityAnnual = 0, tdsMonthly = 0, calculatedPT = 0, net = 0;

        // Standard employee calculation from CTC
        const calc = calculateSalaryFromCTC(
            Number(ctc) || 0,
            Number(hraPercentage) || 0,
            Number(conveyance) || 0,
            Number(telephone) || 0,
            Number(medicalAllowance) || 0,
            Number(specialAllowance) || 0,
            includePF,
            includeESI,
            0,
            Number(tds) || 0
        );
        basicFromCalc = calc.basic;
        hraCalc = calc.hra;
        c = calc.conveyance;
        t = calc.telephone;
        m = calc.medicalAllowance;
        sa = calc.specialAllowance;
        gross = calc.gross;
        pfDeduction = calc.pfDeduction;
        employerPF = calc.employerPF;
        esiDeduction = calc.esiDeduction;
        employerESI = calc.employerESI;
        gratuityAnnual = calc.gratuityAnnual;
        tdsMonthly = calc.tdsMonthly || 0;
        calculatedPT = calc.professionalTax || 0;
        net = calc.net;

        const safeFirst = (state.personalInfo.firstName || '').trim();
        const safeLast = (state.personalInfo.lastName || '').trim();
        const fullName = `${safeFirst} ${safeLast}`.trim() || 'Employee';

        // Professional fees
        const profMonthly = Number(state.salaryInfo.professionalFeesMonthly || 0);
        const profInclusive = Boolean(state.salaryInfo.professionalFeesInclusive);
        let profBaseMonthly = profMonthly;
        let profTotalMonthly = profMonthly;
        if (profMonthly > 0 && profInclusive) {
            // If user marked inclusive, we keep the entered number as total payable
            profBaseMonthly = profMonthly;
            profTotalMonthly = profMonthly;
        }
        const profBaseAnnual = profBaseMonthly * 12;
        const profTotalAnnual = profTotalMonthly * 12;

        // Auto-calc GST as 18% of Annual CTC (only for contract-based employees)
        const annualCtc = Number(ctc) || 0;
        const isContractBased = state.employmentDetails.type === 'contract';
        const gstAnnual = isContractBased ? parseFloat((annualCtc * 0.18).toFixed(2)) : 0;
        const gstMonthly = isContractBased ? parseFloat((gstAnnual / 12).toFixed(2)) : 0;

        const annexureBase64 = generateAnnexureBase64(fullName, { ctc, basic: basicFromCalc, hra: hraCalc, conveyance: c, telephone: t, medicalAllowance: m, specialAllowance: sa, gross, pfDeduction, esiDeduction, employerPF, employerESI, gratuityAnnual, tds: Number(state.salaryInfo.tds || 0), tdsMonthly, gstMonthly, gstAnnual, professionalTax: calculatedPT, net, professionalFeesMonthly: profMonthly, professionalFeesInclusive: profInclusive, professionalFeesBaseMonthly: profBaseMonthly, professionalFeesTotalMonthly: profTotalMonthly, professionalFeesBaseAnnual: profBaseAnnual, professionalFeesTotalAnnual: profTotalAnnual });
        const safeFileName = `Annexure_${fullName.replace(/\s+/g, '_')}.txt`;
        dispatch({ type: 'UPDATE_SALARY', payload: { basic: basicFromCalc, hra: hraCalc, conveyance: c, telephone: t, medicalAllowance: m, specialAllowance: sa, gross, pfDeduction, employerPF, esiDeduction, employerESI, gratuityAnnual, tdsMonthly, gstMonthly, gstAnnual, professionalTax: calculatedPT, net, professionalFeesMonthly: profMonthly, professionalFeesInclusive: profInclusive, professionalFeesBaseMonthly: profBaseMonthly, professionalFeesTotalMonthly: profTotalMonthly, professionalFeesBaseAnnual: profBaseAnnual, professionalFeesTotalAnnual: profTotalAnnual, annexure: { fileName: safeFileName, data: annexureBase64, generatedAt: new Date().toISOString() } } });
    }, [
        state.salaryInfo.ctc,
        state.salaryInfo.hraPercentage,
        state.salaryInfo.conveyance,
        state.salaryInfo.telephone,
        state.salaryInfo.medicalAllowance,
        state.employmentDetails.type,
        state.salaryInfo.specialAllowance,
        state.salaryInfo.includePF,
        state.salaryInfo.includeESI,
        state.salaryInfo.tds,
        state.salaryInfo.basic,
        state.salaryInfo.professionalFeesMonthly,
        state.salaryInfo.professionalFeesInclusive,
        state.personalInfo.firstName,
        state.personalInfo.lastName
    ]);

    // employment type changes handled elsewhere


    const handleChange = (section: string, field: string, value: any) => {
        dispatch({ type: 'UPDATE_FIELD', payload: { section, field, value } });
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const base64 = await fileToBase64(e.target.files[0]);
                dispatch({ type: 'SET_PHOTO', payload: base64 });
            } catch (error) {
                showToast('Failed to upload photo', 'error');
            }
        }
    };



    const handleLoadById = async (id: string) => {
        if (!id) return showToast('Enter Employee ID to load', 'error');
        try {
            const emp = await getEmployeeById(id);
            if (!emp) return showToast('Employee not found', 'error');
            // populate form state from employee
            dispatch({ type: 'RESET' });
            setEditingId(emp.id);
            dispatch({ type: 'UPDATE_FIELD', payload: { section: '', field: 'employeeId', value: emp.id } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'personalInfo', field: 'firstName', value: emp.personalInfo.firstName } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'personalInfo', field: 'middleName', value: emp.personalInfo.middleName } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'personalInfo', field: 'lastName', value: emp.personalInfo.lastName } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'personalInfo', field: 'gender', value: emp.personalInfo.gender } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'personalInfo', field: 'contactNumber', value: emp.personalInfo.contactNumber } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'personalInfo', field: 'personalEmail', value: emp.personalInfo.personalEmail } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'personalInfo', field: 'currentAddress', value: emp.personalInfo.currentAddress } });
            if (emp.personalInfo.photo) dispatch({ type: 'SET_PHOTO', payload: emp.personalInfo.photo });
            // employment
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'employmentDetails', field: 'type', value: emp.employmentDetails.type } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'employmentDetails', field: 'department', value: emp.employmentDetails.department } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'employmentDetails', field: 'designation', value: emp.employmentDetails.designation } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'employmentDetails', field: 'officialEmail', value: emp.employmentDetails.officialEmail } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'employmentDetails', field: 'workLocation', value: emp.employmentDetails.workLocation } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'employmentDetails', field: 'probationPeriod', value: emp.employmentDetails.probationPeriod } });
            dispatch({ type: 'UPDATE_FIELD', payload: { section: 'employmentDetails', field: 'grade', value: emp.employmentDetails.grade || 'A' } });
            // salary
            dispatch({ type: 'UPDATE_SALARY', payload: emp.salaryInfo });
            // documents field retained in employee record but not edited here
            showToast('Employee loaded for edit', 'success');
        } catch (err) {
            showToast('Failed to load employee', 'error');
        }
    };

    // If another page requested an employee to be edited, load it once
    useEffect(() => {
        if (selectedEmployeeId) {
            handleLoadById(selectedEmployeeId);
            setSelectedEmployeeId(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEmployeeId]);

    const validateForm = () => {
        const newErrors: any = {};
        // Add more validations as per spec
        if (!state.personalInfo.firstName) newErrors.firstName = 'First name is required.';
        if (!state.personalInfo.lastName) newErrors.lastName = 'Last name is required.';
        if (!validateEmail(state.personalInfo.personalEmail)) newErrors.personalEmail = 'Invalid email format.';
        if (!/^[0-9]{10}$/.test(String(state.personalInfo.contactNumber || ''))) newErrors.contactNumber = 'Contact number must be 10 digits.';

        if (!state.employmentDetails.designation) newErrors.designation = 'Designation is required.';
        if (state.salaryInfo.basic <= 0) newErrors.basic = 'Basic salary must be greater than 0.';
        
        // professional fees validation
        const profMonthly = Number(state.salaryInfo.professionalFeesMonthly || 0);
        const profAnnual = profMonthly * 12;
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Quick-add handlers
    const handleSaveType = async () => {
        const name = newTypeName.trim();
        if (!name) return showToast('Type name cannot be empty', 'error');
        try {
            await saveEmploymentType(name);
            const types = await getEmploymentTypes();
            setEmploymentTypes(types);
            setNewTypeName('');
            setShowTypeModal(false);
            showToast('Employment type added', 'success');
        } catch (err) {
            showToast('Failed to add employment type', 'error');
        }
    };

    const handleSaveDepartment = async () => {
        const name = (deptForm.name || '').trim();
        if (!name) return showToast('Department name required', 'error');
        try {
            // Department is a string type from DEPARTMENTS constant
            // Check if it already exists in DEPARTMENTS
            const depts = await getDepartments();
            if (depts.includes(name as any)) {
                return showToast('Department already exists', 'error');
            }
            // For now, departments cannot be added dynamically - they are predefined
            showToast('New departments can only be added through system configuration', 'info');
            setShowDeptModal(false);
        } catch (err) {
            showToast('Failed to add department', 'error');
        }
    };

    const handleSaveDesignationQuick = async () => {
        const title = (designationForm.title || '').trim();
        if (!title) return showToast('Designation title required', 'error');
        if (!designationForm.department) return showToast('Select department first', 'error');
        try {
            const newDes = await saveDesignation({ title, department: designationForm.department, description: designationForm.description || '', level: Number(designationForm.level) || 1, reportingTo: designationForm.reportingTo || '' });
            const des = await getDesignations();
            setDesignations(des);
            setShowDesignationModal(false);
            setDesignationForm({ title: '', department: '', grade: 'A', level: 1, reportingTo: '', description: '' });
            showToast('Designation added', 'success');
        } catch (err) {
            showToast('Failed to add designation', 'error');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) {
            // Collect validation messages and show concise feedback
            const msgs = Object.values(errors).slice(0, 5).map((m: any) => String(m)).join('; ');
            showToast(msgs || 'Please fix the errors before submitting.', 'error');
            return;
        }
        setIsSubmitting(true);
            try {
                if (editingId) {
                // build full employee object
                const existing = employees.find(emp => emp.id === editingId);
                if (!existing) throw new Error('Existing employee not found');
                const updatedEmployee: Employee = {
                    ...existing,
                    personalInfo: state.personalInfo,
                    employmentDetails: state.employmentDetails,
                    salaryInfo: state.salaryInfo,
                    documents: [],
                    careerHistory: state.careerHistory,
                    status: state.status,
                    updatedAt: new Date().toISOString(),
                };
                await updateEmployee(updatedEmployee);
                showToast('Employee updated successfully!', 'success');
                } else {
                    // Auto-generate Employee ID in ECO format
                    const nextNumber = employees.length + 1;
                    const generatedId = `ECO${String(nextNumber).padStart(3, '0')}`;
                    const newEmp = await saveEmployee({ ...state, id: generatedId, documents: [] });
                    showToast('Employee added successfully!', 'success');
                }
                // notify employees list to refresh
                try { bumpEmployeesVersion(); } catch (e) { /* no-op if context missing */ }
            dispatch({ type: 'RESET' });
            setEditingId(null);
            setActivePage('employees');
        } catch (error: any) {
            console.error('Save employee error:', error);
            const msg = error?.message || String(error) || 'Failed to save employee.';
            showToast(msg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderSection = (title: string, children: React.ReactNode) => (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h3 className="text-xl font-semibold text-gray-800 border-b pb-3 mb-4">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {children}
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create New Employee</h2>
            <div className="mb-4 flex items-center space-x-3">
                <input id="loadId" placeholder="Enter Employee ID to load" className="border rounded px-3 py-2" />
                <button type="button" onClick={() => {
                    const el = document.getElementById('loadId') as HTMLInputElement | null;
                    if (el) handleLoadById(el.value.trim());
                }} className="px-4 py-2 bg-green-600 text-white rounded">Load</button>
                {editingId && <span className="ml-4 text-sm text-gray-600">Editing: {editingId}</span>}
            </div>
            
            {renderSection('Personal Information', <>
                <Input label="First Name*" id="firstName" value={state.personalInfo.firstName} onChange={e => handleChange('personalInfo', 'firstName', e.target.value)} error={errors.firstName} />
                <Input label="Middle Name" id="middleName" value={state.personalInfo.middleName} onChange={e => handleChange('personalInfo', 'middleName', e.target.value)} />
                <Input label="Last Name*" id="lastName" value={state.personalInfo.lastName} onChange={e => handleChange('personalInfo', 'lastName', e.target.value)} error={errors.lastName} />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender*</label>
                    <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500" value={state.personalInfo.gender} onChange={e => handleChange('personalInfo', 'gender', e.target.value)}>
                        <option key="select-empty" value="">Select Gender</option>
                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                
                 <Input label="Contact Number*" id="contactNumber" type="tel" value={state.personalInfo.contactNumber} onChange={e => handleChange('personalInfo', 'contactNumber', e.target.value)} error={errors.contactNumber} />
                 <Input label="Personal Email*" id="personalEmail" type="email" value={state.personalInfo.personalEmail} onChange={e => handleChange('personalInfo', 'personalEmail', e.target.value)} error={errors.personalEmail} />
                 <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address*</label>
                    <textarea className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500" value={state.personalInfo.currentAddress} onChange={e => handleChange('personalInfo', 'currentAddress', e.target.value)} />
                </div>
                <div className="flex items-center">
                    <img src={state.personalInfo.photo || 'https://picsum.photos/100'} alt="Profile" className="w-16 h-16 rounded-full mr-4" />
                    <Input label="Profile Photo" id="photo" type="file" onChange={handlePhotoChange} />
                </div>
            </>)}

            {/* Quick-add Modals */}
            {showTypeModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Add Employment Type</h3>
                        <Input label="Type Name" id="typeName" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} />
                        <div className="mt-4 flex justify-end space-x-2">
                            <button type="button" className="px-3 py-2" onClick={() => setShowTypeModal(false)}>Cancel</button>
                            <button type="button" className="px-3 py-2 bg-green-600 text-white rounded" onClick={handleSaveType}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeptModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-md w-full max-w-xl">
                        <h3 className="text-lg font-semibold mb-4">Add Department</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Name" id="deptName" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} />
                            <Input label="Code" id="deptCode" value={deptForm.code} onChange={e => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })} />
                            <Input label="Default Grade" id="deptGrade" value={deptForm.grade} onChange={e => setDeptForm({ ...deptForm, grade: e.target.value })} />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Department Head</label>
                                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={deptForm.head} onChange={e => setDeptForm({ ...deptForm, head: e.target.value })}>
                                    <option key="select-empty" value="">Select</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.personalInfo.firstName} {emp.personalInfo.lastName}</option>)}
                                </select>
                            </div>
                            <Input label="Status" id="deptStatus" value={deptForm.status} onChange={e => setDeptForm({ ...deptForm, status: e.target.value })} />
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end space-x-2">
                            <button type="button" className="px-3 py-2" onClick={() => setShowDeptModal(false)}>Cancel</button>
                            <button type="button" className="px-3 py-2 bg-green-600 text-white rounded" onClick={handleSaveDepartment}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {showDesignationModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-md w-full max-w-xl">
                        <h3 className="text-lg font-semibold mb-4">Add Designation</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Title" id="desTitle" value={designationForm.title} onChange={e => setDesignationForm({ ...designationForm, title: e.target.value })} />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={designationForm.department} onChange={e => setDesignationForm({ ...designationForm, department: e.target.value })}>
                                    <option key="select-empty" value="">Select</option>
                                    {departmentsList.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <Input label="Level" id="desLevel" type="number" value={designationForm.level} onChange={e => setDesignationForm({ ...designationForm, level: Number(e.target.value) })} />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reporting To</label>
                                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={designationForm.reportingTo} onChange={e => setDesignationForm({ ...designationForm, reportingTo: e.target.value })}>
                                    <option key="select-empty" value="">Select</option>
                                    {designations.map(d => <option key={d.id} value={d.title}>{d.title}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={designationForm.description} onChange={e => setDesignationForm({ ...designationForm, description: e.target.value })} />
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end space-x-2">
                            <button type="button" className="px-3 py-2" onClick={() => setShowDesignationModal(false)}>Cancel</button>
                            <button type="button" className="px-3 py-2 bg-green-600 text-white rounded" onClick={handleSaveDesignationQuick}>Save</button>
                        </div>
                    </div>
                </div>
            )}
            {renderSection('Employment Details', <>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee Type*</label>
                     <div className="flex items-center space-x-2">
                        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={state.employmentDetails.type} onChange={e => handleChange('employmentDetails', 'type', e.target.value)}>
                            <option key="select-empty" value="">Select Employee Type</option>
                            {employmentTypes.map(t => <option key={t} value={t}>{EMPLOYEE_TYPE_LABELS[t] || t}</option>)}
                        </select>
                        <button type="button" className="text-sm text-green-600" onClick={() => setShowTypeModal(true)}>+ Add</button>
                     </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department*</label>
                     <div className="flex items-center space-x-2">
                        <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" value={state.employmentDetails.department} onChange={e => handleChange('employmentDetails', 'department', e.target.value)}>
                            <option key="select-empty" value="">Select Department</option>
                            {departmentsList.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <button type="button" className="text-sm text-green-600" onClick={() => setShowDeptModal(true)}>+ Add</button>
                     </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Designation*</label>
                    {/* Fix: Replaced invalid 'error' prop on select with conditional styling and a separate error message element. */}
                     <select 
                        className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 ${errors.designation ? 'border-red-500' : ''}`}
                        value={state.employmentDetails.designation} 
                        onChange={e => handleChange('employmentDetails', 'designation', e.target.value)}
                     >
                        <option key="select-empty" value="">Select Designation</option>
                        {designations.filter(d => d.department === state.employmentDetails.department).map(d => <option key={d.id} value={d.title}>{d.title}</option>)}
                     </select>
                     {errors.designation && <p className="mt-1 text-xs text-red-600">{errors.designation}</p>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quick Add Designation</label>
                    <div className="flex items-center">
                        <button type="button" className="px-3 py-2 bg-green-600 text-white rounded" onClick={() => setShowDesignationModal(true)}>+ Add Designation</button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Work Location*</label>
                    <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500" value={state.employmentDetails.workLocation} onChange={e => handleChange('employmentDetails', 'workLocation', e.target.value)}>
                        <option key="select-empty" value="">Select Location</option>
                        {WORK_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>
                </div>
                <Input label="Probation (months)" id="probation" type="number" value={state.employmentDetails.probationPeriod} onChange={e => handleChange('employmentDetails', 'probationPeriod', e.target.value)} />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grade*</label>
                    <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500" value={state.employmentDetails.grade || 'A'} onChange={e => handleChange('employmentDetails', 'grade', e.target.value)}>
                        <option key="select-empty" value="">Select Grade</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
            </>)}

            {renderSection('Salary & Compensation', <>
                <div className="lg:col-span-3 md:col-span-2 p-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg hover:shadow-xl transition-shadow mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-blue-100 mb-2">Annual Cost to Company (CTC)</p>
                            <p className="text-4xl font-bold text-white">₹ {state.salaryInfo.ctc ?? 0}</p>
                            <p className="text-xs text-blue-100 mt-2">Monthly Basic = ₹ {Number(state.salaryInfo.basic || 0).toFixed(0)}/month</p>
                        </div>
                        <button type="button" onClick={() => setShowCtcCalculator(true)} className="px-4 py-2 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors">
                            View Breakdown
                        </button>
                    </div>
                </div>
                <Input label="Annual CTC*" id="ctc" type="number" value={state.salaryInfo.ctc} onChange={e => handleChange('salaryInfo', 'ctc', e.target.value)} error={errors.basic} />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary (monthly - Auto)</label>
                    <div className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 text-gray-800 font-semibold">
                        ₹ { Number(state.salaryInfo.basic || 0).toFixed(0) } /month
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">HRA (% of Basic)</label>
                    <input type="number" min="0" max="100" step="0.1" value={state.salaryInfo.hraPercentage || 0} onChange={e => handleChange('salaryInfo', 'hraPercentage', Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 px-3 py-2 border" />
                    <p className="text-xs text-gray-500 mt-1">Amount: ₹ {state.salaryInfo.hra.toFixed(2)}</p>
                </div>
                <Input label="Conveyance" id="conveyance" type="number" value={state.salaryInfo.conveyance} onChange={e => handleChange('salaryInfo', 'conveyance', e.target.value)} />
                <Input label="Telephone" id="telephone" type="number" value={state.salaryInfo.telephone} onChange={e => handleChange('salaryInfo', 'telephone', e.target.value)} />
                <Input label="Medical Allowance" id="medicalAllowance" type="number" value={state.salaryInfo.medicalAllowance} onChange={e => handleChange('salaryInfo', 'medicalAllowance', e.target.value)} />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Special Allowance</label>
                    <p className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-800 font-semibold">₹ {Number(state.salaryInfo.specialAllowance || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-2">Special Allowance is the remaining part of your salary after allocating fixed components (Basic, HRA, Conveyance, Telephone, Medical, etc.). It balances your CTC and has no fixed percentage.</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Gross Salary</p>
                    <p className="text-xl font-bold text-gray-800">₹ {state.salaryInfo.gross.toFixed(2)}</p>
                </div>
                <div className="mt-3 p-4 bg-white rounded border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Gratuity (annual provision)</p>
                    <p className="text-sm text-gray-500 mb-2">Calculated as: Basic × 12 × GRATUITY_RATE_ANNUAL</p>
                    <p className="text-lg font-semibold">₹ {Number(state.salaryInfo.gratuityAnnual || 0).toFixed(2)} / year</p>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Net Salary</p>
                    <p className="text-xl font-bold text-green-600">₹ {state.salaryInfo.net.toFixed(2)}</p>
                </div>
                 <div className="flex items-center space-x-4">
                    <label className="flex items-center"><input type="checkbox" checked={state.salaryInfo.includePF} onChange={e => handleChange('salaryInfo', 'includePF', e.target.checked)} className="h-4 w-4 rounded" /> <span className="ml-2">Include PF</span></label>
                    <label className="flex items-center"><input type="checkbox" checked={state.salaryInfo.includeESI} onChange={e => handleChange('salaryInfo', 'includeESI', e.target.checked)} className="h-4 w-4 rounded" /> <span className="ml-2">Include ESI</span></label>
                </div>
                 <Input label="Professional Tax" id="pt" type="number" value={state.salaryInfo.professionalTax} onChange={e => handleChange('salaryInfo', 'professionalTax', e.target.value)} />
                                 <div className="flex items-end space-x-3">
                                    <div className="flex-1">
                                        <Input label="TDS" id="tds" type="number" value={state.salaryInfo.tds} onChange={e => handleChange('salaryInfo', 'tds', e.target.value)} />
                                    </div>
                                </div>

                                {state.employmentDetails.type === 'contract' && (
                                    <GstCalculator useCtc={true} ctc={Number(state.salaryInfo.ctc || 0)} onCalculate={(gst, total) => {
                                        // GstCalculator now returns gst computed on provided CTC (annual)
                                        const gstAnnual = gst || 0;
                                        const gstMonthly = parseFloat((gstAnnual / 12).toFixed(2));
                                        dispatch({ type: 'UPDATE_SALARY', payload: { gstMonthly, gstAnnual } });
                                        showToast('GST calculated from CTC', 'success');
                                    }} />
                                )}

                {state.salaryInfo.annexure && (
                    <div className="md:col-span-2 p-4 bg-white rounded border border-gray-200 mt-4">
                        <p className="font-semibold mb-3">Annexure Preview</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="text-gray-600">
                                        <th className="py-2 px-3 border-b">Component</th>
                                        <th className="py-2 px-3 border-b">Monthly (₹)</th>
                                        <th className="py-2 px-3 border-b">Annual (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const s = state.salaryInfo;
                                        const rows = [
                                            ['Basic', s.basic || 0],
                                            ['HRA', s.hra || 0],
                                            ['Conveyance', s.conveyance || 0],
                                            ['Telephone', s.telephone || 0],
                                            ['Medical Allowance', s.medicalAllowance || 0],
                                            ['Special Allowance', s.specialAllowance || 0],
                                            ['Gross', s.gross || 0],
                                            ['Employee PF', s.pfDeduction || 0],
                                            ['Employer PF', s.employerPF || 0],
                                            ['Employee ESI', s.esiDeduction || 0],
                                            ['Employer ESI', s.employerESI || 0],
                                            ...(state.employmentDetails.type === 'contract' ? [['GST (monthly)', s.gstMonthly || 0]] : []),
                                            ['TDS (monthly)', s.tdsMonthly || 0],
                                            ['Net (monthly)', s.net || 0],
                                        ];
                                        return rows.map(([label, monthly]) => (
                                            <tr key={String(label)} className="odd:bg-white even:bg-gray-50">
                                                <td className="py-2 px-3 border-t text-gray-700">{label}</td>
                                                <td className="py-2 px-3 border-t">{Number(monthly).toFixed(2)}</td>
                                                <td className="py-2 px-3 border-t">{(Number(monthly) * 12).toFixed(2)}</td>
                                            </tr>
                                        ));
                                    })()}
                                    <tr className="bg-gray-100">
                                        <td className="py-2 px-3 font-semibold">Gratuity (provision)</td>
                                        <td className="py-2 px-3">—</td>
                                        <td className="py-2 px-3 font-semibold">{Number(state.salaryInfo.gratuityAnnual || 0).toFixed(2)}</td>
                                    </tr>
                                    {state.employmentDetails.type === 'contract' && (
                                        <tr className="bg-gray-50">
                                            <td className="py-2 px-3 font-semibold">Total (CTC + GST)</td>
                                            <td className="py-2 px-3 font-semibold">{((Number(state.salaryInfo.ctc || 0) + Number(state.salaryInfo.gstAnnual || 0)) / 12).toFixed(2)}</td>
                                            <td className="py-2 px-3 font-semibold">{(Number(state.salaryInfo.ctc || 0) + Number(state.salaryInfo.gstAnnual || 0)).toFixed(2)}</td>
                                        </tr>
                                    )}
                                    <tr className="border-t">
                                        <td className="py-2 px-3 font-semibold">CTC (annual)</td>
                                        <td className="py-2 px-3">—</td>
                                        <td className="py-2 px-3 font-semibold">{Number(state.salaryInfo.ctc || 0).toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 text-xs text-gray-600">
                            <p>Note: Monthly values are shown as computed; Annual values are Monthly × 12 unless otherwise stated.</p>
                        </div>
                        <div className="mt-3 p-2 bg-white">
                            <p className="font-semibold mb-1">Raw Annexure</p>
                            <pre className="whitespace-pre-wrap text-xs max-h-28 overflow-y-auto border p-2 bg-gray-50">{state.salaryInfo.annexure.data.startsWith('data:') ? decodeURIComponent(escape(atob(state.salaryInfo.annexure.data.split(',')[1]))) : state.salaryInfo.annexure.data}</pre>
                        </div>
                        <a href={state.salaryInfo.annexure.data} download={state.salaryInfo.annexure.fileName} className="inline-block mt-3 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">Download Annexure</a>
                    </div>
                )}
                
            </>)}

            {showAnnexureModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-md w-full max-w-lg max-h-96 overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">Edit Annexure Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Basic Salary</label>
                                <input type="number" value={annexureEditData.basic} onChange={e => setAnnexureEditData({ ...annexureEditData, basic: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">HRA</label>
                                <input type="number" value={annexureEditData.hra} onChange={e => setAnnexureEditData({ ...annexureEditData, hra: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">DA</label>
                                <input type="number" value={annexureEditData.da} onChange={e => setAnnexureEditData({ ...annexureEditData, da: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Special Allowance</label>
                                <input type="number" value={annexureEditData.specialAllowance} onChange={e => setAnnexureEditData({ ...annexureEditData, specialAllowance: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gross Salary</label>
                                <input type="number" value={annexureEditData.gross} readOnly className="w-full px-3 py-2 border rounded-md bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Net Salary</label>
                                <input type="number" value={annexureEditData.net} readOnly className="w-full px-3 py-2 border rounded-md bg-gray-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GST (monthly)</label>
                                <input type="number" value={state.salaryInfo.gstMonthly || 0} readOnly className="w-full px-3 py-2 border rounded-md bg-gray-50" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">CTC (Annual)</label>
                                <input type="number" value={annexureEditData.ctc} readOnly className="w-full px-3 py-2 border rounded-md bg-gray-50" />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-2">
                            <button type="button" className="px-4 py-2 border rounded-md text-gray-700" onClick={() => setShowAnnexureModal(false)}>Cancel</button>
                            <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded-md" onClick={() => {
                                const fullName = `${state.personalInfo.firstName} ${state.personalInfo.lastName}`.trim() || 'Employee';
                                const newAnnexureBase64 = generateAnnexureBase64(fullName, annexureEditData);
                                const safeFileName = `Annexure_${fullName.replace(/\s+/g, '_')}.txt`;
                                dispatch({ type: 'UPDATE_SALARY', payload: { annexure: { fileName: safeFileName, data: newAnnexureBase64, generatedAt: new Date().toISOString() } } });
                                setShowAnnexureModal(false);
                                showToast('Annexure updated successfully', 'success');
                            }}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {showCtcCalculator && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded shadow-lg w-full max-w-lg max-h-96 overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">CTC Calculator & Breakdown</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-600 mb-1">Annual CTC</p>
                                <p className="text-2xl font-bold text-blue-800">₹ {state.salaryInfo.ctc ?? 0}</p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-gray-700">Basic Salary (Monthly)</p>
                                        <p className="font-semibold text-gray-800">₹ {state.salaryInfo.basic.toFixed(0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-gray-700">HRA ({state.salaryInfo.hraPercentage || 0}% of Basic)</p>
                                        <p className="font-semibold text-gray-800">₹ {state.salaryInfo.hra.toFixed(0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-gray-700">Conveyance</p>
                                        <p className="font-semibold text-gray-800">₹ {state.salaryInfo.conveyance.toFixed(0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-gray-700">Telephone</p>
                                        <p className="font-semibold text-gray-800">₹ {state.salaryInfo.telephone.toFixed(0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-gray-700">Medical Allowance</p>
                                        <p className="font-semibold text-gray-800">₹ {state.salaryInfo.medicalAllowance.toFixed(0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-gray-700">Special Allowance</p>
                                        <p className="font-semibold text-gray-800">₹ {state.salaryInfo.specialAllowance.toFixed(0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-green-700">Gross Salary (Monthly)</p>
                                        <p className="font-bold text-green-800">₹ {state.salaryInfo.gross.toFixed(0)}</p>
                                    </div>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-medium text-purple-700">PF Deduction {state.salaryInfo.includePF ? '(12% of Basic)' : '(None)'}</p>
                                        <p className="font-semibold text-purple-800">₹ {state.salaryInfo.pfDeduction.toFixed(0)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-2">
                            <button type="button" className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50" onClick={() => setShowCtcCalculator(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            
            <div className="sticky bottom-0 bg-white p-4 border-t shadow-inner flex justify-end space-x-4">
                <Button type="button" variant="secondary" onClick={() => setActivePage('employees')}>Cancel</Button>
                <Button type="submit" isLoading={isSubmitting}>Submit</Button>
            </div>
        </form>
    );
};

export default NewEmployeePage;
