import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle, User, Users, FileText } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { getEmployees, getEmployeeById, updateEmployee, saveEmployee } from '../services/storageService';
import { Employee } from '../types';

const EmployeeOnboarding: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [formData, setFormData] = useState<any>({
    employeeId: '',
    fullName: '',
    email: '',
    phone: '',
    emergencyContact: '',
    dateOfBirth: '',
    bloodGroup: '',
    qualification: '',
    previousCompanies: [],
    tenthCertificate: null,
    puCertificate: null,
    degreeCertificate: null,
    mastersCertificate: null,
    fatherName: '',
    fatherDob: '',
    motherName: '',
    motherDob: '',
    permanentAddress: '',
    currentAddress: '',
    maritalStatus: 'unmarried',
    spouseName: '',
    spouseDob: '',
    numberOfKids: 0,
    kids: [],
    esiNumber: '',
    pfNumber: '',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    panCard: null,
    aadharCard: null,
    relievingLetter: null
  });

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const qualifications = [
    'High School (10th)',
    'Intermediate (12th)',
    'Diploma',
    'ITI',
    'BA (Bachelor of Arts)',
    'BSc (Bachelor of Science)',
    'BCom (Bachelor of Commerce)',
    'BBA (Bachelor of Business Administration)',
    'BCA (Bachelor of Computer Applications)',
    'BTech (Bachelor of Technology)',
    'BE (Bachelor of Engineering)',
    'MA (Master of Arts)',
    'MSc (Master of Science)',
    'MCom (Master of Commerce)',
    'MBA (Master of Business Administration)',
    'MCA (Master of Computer Applications)',
    'MTech (Master of Technology)',
    'ME (Master of Engineering)',
    'PhD (Doctor of Philosophy)',
    'Other'
  ];
  const { showToast, bumpEmployeesVersion } = useAppContext();

  // Function to generate next employee ID
  const generateEmployeeId = (existingEmployees: Employee[]): string => {
    const ecoEmployees = existingEmployees.filter(emp => emp.id.startsWith('ECO'));
    
    if (ecoEmployees.length === 0) {
      return 'ECO001';
    }
    
    const maxNumber = Math.max(...ecoEmployees.map(emp => {
      const numStr = emp.id.replace('ECO', '');
      return parseInt(numStr) || 0;
    }));
    
    const nextNumber = maxNumber + 1;
    return `ECO${nextNumber.toString().padStart(3, '0')}`;
  };

  // Load employees list on component mount
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const emps = await getEmployees();
        setEmployees(emps);
      } catch (error) {
        console.error('Failed to load employees:', error);
      }
    };
    loadEmployees();
  }, []);

  // Function to fetch and populate employee data
  const fetchEmployeeData = async (empId: string) => {
    if (!empId) {
      // Reset to new employee without ID
      setFormData((prev: any) => ({
        ...prev,
        employeeId: '',
        fullName: '',
        email: '',
        phone: '',
        emergencyContact: '',
        dateOfBirth: '',
        bloodGroup: '',
        fatherName: '',
        motherName: '',
        permanentAddress: '',
        currentAddress: '',
        esiNumber: '',
        pfNumber: '',
        bankName: '',
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        branchName: '',
      }));
      setSelectedEmployeeId('');
      return;
    }
    
    try {
      const employee = await getEmployeeById(empId);
      if (!employee) {
        showToast('Employee not found', 'error');
        return;
      }

      // Generate ECO-formatted ID based on employee's position in the list
      const empIndex = employees.findIndex(emp => emp.id === empId);
      const generatedId = `ECO${String(empIndex + 1).padStart(3, '0')}`;

      console.log('Loading employee data with ID:', employee.id); // Debug log

      // Populate form with employee data INCLUDING the generated ECO ID
      setFormData({
        employeeId: generatedId, // Use the generated ECO ID based on position in list
        fullName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        email: employee.personalInfo.personalEmail,
        phone: employee.personalInfo.contactNumber,
        emergencyContact: employee.personalInfo.emergencyContact || '',
        dateOfBirth: employee.personalInfo.dob || '',
        bloodGroup: employee.personalInfo.bloodGroup || '',
        qualification: '',
        previousCompanies: [],
        tenthCertificate: null,
        puCertificate: null,
        degreeCertificate: null,
        mastersCertificate: null,
        fatherName: employee.personalInfo.fatherName || '',
        fatherDob: '',
        motherName: employee.personalInfo.motherName || '',
        motherDob: '',
        permanentAddress: employee.personalInfo.permanentAddress || '',
        currentAddress: employee.personalInfo.currentAddress || '',
        maritalStatus: 'unmarried',
        spouseName: '',
        spouseDob: '',
        numberOfKids: 0,
        kids: [],
        esiNumber: employee.personalInfo.esiNumber || '',
        pfNumber: employee.personalInfo.pfNumber || '',
        bankName: employee.salaryInfo?.bankDetails?.bankName || '',
        accountHolderName: employee.salaryInfo?.bankDetails?.accountHolder || '',
        accountNumber: employee.salaryInfo?.bankDetails?.accountNumber || '',
        ifscCode: employee.salaryInfo?.bankDetails?.ifscCode || '',
        branchName: employee.salaryInfo?.bankDetails?.branch || '',
        panCard: null,
        aadharCard: null,
        relievingLetter: null
      });
      
      setSelectedEmployeeId(empId);
      showToast(`Loaded ${employee.id} - Employee data loaded successfully`, 'success');
    } catch (error) {
      console.error('Failed to fetch employee data:', error);
      showToast('Failed to load employee data', 'error');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));

    if (name === 'numberOfKids') {
      const numKids = parseInt(value) || 0;
      const kids = Array(numKids).fill(null).map((_, i) => (formData.kids[i] || { name: '', dob: '' }));
      setFormData((prev: any) => ({ ...prev, kids }));
    }
  };

  const handleKidChange = (index: number, field: string, value: string) => {
    const updatedKids = [...formData.kids];
    updatedKids[index] = { ...updatedKids[index], [field]: value };
    setFormData((prev: any) => ({ ...prev, kids: updatedKids }));
  };

  const handleAddPreviousCompany = () => {
    setFormData((prev: any) => ({
      ...prev,
      previousCompanies: [...prev.previousCompanies, { name: '', fromDate: '', toDate: '' }]
    }));
  };

  const handleRemovePreviousCompany = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      previousCompanies: prev.previousCompanies.filter((_: any, i: number) => i !== index)
    }));
  };

  const handlePreviousCompanyChange = (index: number, field: string, value: string) => {
    const updated = [...formData.previousCompanies];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev: any) => ({ ...prev, previousCompanies: updated }));
  };

  const handleSameAddress = () => {
    setFormData((prev: any) => ({ ...prev, currentAddress: prev.permanentAddress }));
  };

  const handleFileUpload = (fieldName: string, file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) { // 5MB limit
      showToast('File size should not exceed 5MB', 'error');
      return;
    }
    setFormData((prev: any) => ({ ...prev, [fieldName]: file }));
    if (file) {
      showToast(`${file.name} uploaded successfully`, 'success');
    }
  };

  const nextStep = () => { if (currentStep < 3) setCurrentStep(currentStep + 1); };
  const prevStep = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  // Validation function to check if all required fields are filled
  const validateOnboardingData = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Personal Details validation
    if (!formData.fullName?.trim()) errors.push('Full Name is required');
    if (!formData.email?.trim()) errors.push('Email is required');
    if (!formData.phone?.trim()) errors.push('Phone Number is required');
    if (!formData.dateOfBirth) errors.push('Date of Birth is required');
    if (!formData.bloodGroup) errors.push('Blood Group is required');
    if (!formData.currentAddress?.trim()) errors.push('Current Address is required');

    // Family Information validation
    if (!formData.fatherName?.trim()) errors.push('Father Name is required');
    if (!formData.motherName?.trim()) errors.push('Mother Name is required');

    // Statutory Information validation
    if (!formData.pfNumber?.trim()) errors.push('PF Number is required');
    if (!formData.bankName?.trim()) errors.push('Bank Name is required');
    if (!formData.accountHolderName?.trim()) errors.push('Account Holder Name is required');
    if (!formData.accountNumber?.trim()) errors.push('Account Number is required');
    if (!formData.ifscCode?.trim()) errors.push('IFSC Code is required');

    return { valid: errors.length === 0, errors };
  };

  const handleSubmit = async () => {
    try {
      // Validate all required fields before completion
      const validation = validateOnboardingData();
      if (!validation.valid) {
        showToast(`Please complete all required fields: ${validation.errors.join(', ')}`, 'error');
        return;
      }

      // Extract name parts
      const names = formData.fullName.split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';

      // Check if employee already exists
      const existingEmployee = await getEmployeeById(formData.employeeId);
      
      if (existingEmployee) {
        // CASE 1: Update existing employee and complete onboarding
        // This maintains the SAME Employee ID - never creates a new one
        
        const updatedEmployee: Employee = {
          ...existingEmployee,
          personalInfo: {
            ...existingEmployee.personalInfo,
            firstName: firstName,
            lastName: lastName,
            dob: formData.dateOfBirth,
            contactNumber: formData.phone,
            emergencyContact: formData.emergencyContact || existingEmployee.personalInfo.emergencyContact,
            personalEmail: formData.email,
            permanentAddress: formData.permanentAddress || existingEmployee.personalInfo.permanentAddress,
            currentAddress: formData.currentAddress,
            bloodGroup: formData.bloodGroup,
            fatherName: formData.fatherName,
            motherName: formData.motherName,
            pfNumber: formData.pfNumber,
            esiNumber: formData.esiNumber || existingEmployee.personalInfo.esiNumber,
          },
          salaryInfo: {
            ...existingEmployee.salaryInfo,
            bankDetails: {
              bankName: formData.bankName,
              accountHolder: formData.accountHolderName,
              accountNumber: formData.accountNumber,
              ifscCode: formData.ifscCode,
              branch: formData.branchName || existingEmployee.salaryInfo?.bankDetails?.branch || '',
            }
          },
          // Mark onboarding as COMPLETED
          onboardingStatus: 'COMPLETED',
          onboardingCompletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await updateEmployee(updatedEmployee);
        showToast(`✓ Onboarding completed for Employee ${existingEmployee.id}`, 'success');
        
      } else {
        // CASE 2: Create new employee with onboarding data
        // This creates the FIRST and ONLY record for this employee
        
        const newEmployeeData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> = {
          personalInfo: {
            firstName: firstName,
            lastName: lastName,
            dob: formData.dateOfBirth,
            gender: 'Other', // Can be updated later in Employee Management
            contactNumber: formData.phone,
            emergencyContact: formData.emergencyContact || '',
            personalEmail: formData.email,
            permanentAddress: formData.permanentAddress || '',
            currentAddress: formData.currentAddress,
            bloodGroup: formData.bloodGroup,
            fatherName: formData.fatherName,
            motherName: formData.motherName,
            pfNumber: formData.pfNumber,
            esiNumber: formData.esiNumber || '',
          },
          employmentDetails: {
            type: 'full-time',
            department: 'IT', // Default - update in Employee Management
            designation: '', // Will be set in Employee Management
            joinDate: new Date().toISOString().split('T')[0],
            officialEmail: '', // Will be set in Employee Management
            workLocation: 'Bangalore', // Default
            probationPeriod: 3,
          },
          salaryInfo: {
            ctc: 0,
            basic: 0,
            hraPercentage: 40,
            hra: 0,
            conveyance: 0,
            telephone: 0,
            medicalAllowance: 0,
            specialAllowance: 0,
            employeeHealthInsuranceAnnual: 0,
            gross: 0,
            includePF: true,
            includeESI: false,
            pfDeduction: 0,
            employerPF: 0,
            esiDeduction: 0,
            employerESI: 0,
            professionalTax: 0,
            tds: 0,
            tdsMonthly: 0,
            professionalFeesMonthly: 0,
            professionalFeesInclusive: false,
            professionalFeesBaseMonthly: 0,
            professionalFeesTotalMonthly: 0,
            professionalFeesBaseAnnual: 0,
            professionalFeesTotalAnnual: 0,
            net: 0,
            paymentMode: 'Bank',
            bankDetails: {
              bankName: formData.bankName,
              accountHolder: formData.accountHolderName,
              accountNumber: formData.accountNumber,
              ifscCode: formData.ifscCode,
              branch: formData.branchName || '',
            }
          },
          documents: [],
          careerHistory: [],
          status: 'active',
          // Set onboarding tracking fields
          onboardingStatus: 'COMPLETED',
          onboardingStartedAt: new Date().toISOString(),
          onboardingCompletedAt: new Date().toISOString(),
        };

        const savedEmployee = await saveEmployee(newEmployeeData);
        showToast(`✓ Employee ${savedEmployee.id} onboarded successfully!`, 'success');
      }
      
      bumpEmployeesVersion();
      
      // Reload employees list to get updated data
      const updatedEmployees = await getEmployees();
      setEmployees(updatedEmployees);
      
      // Reset form for next employee
      const newId = generateEmployeeId(updatedEmployees);
      setFormData({
        employeeId: newId,
        fullName: '',
        email: '',
        phone: '',
        emergencyContact: '',
        dateOfBirth: '',
        bloodGroup: '',
        qualification: '',
        previousCompanies: [],
        tenthCertificate: null,
        puCertificate: null,
        degreeCertificate: null,
        mastersCertificate: null,
        fatherName: '',
        fatherDob: '',
        motherName: '',
        motherDob: '',
        permanentAddress: '',
        currentAddress: '',
        maritalStatus: 'unmarried',
        spouseName: '',
        spouseDob: '',
        numberOfKids: 0,
        kids: [],
        esiNumber: '',
        pfNumber: '',
        bankName: '',
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        branchName: '',
        panCard: null,
        aadharCard: null,
        relievingLetter: null
      });
      setSelectedEmployeeId('');
      setCurrentStep(1);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      showToast('Failed to complete onboarding. Please try again.', 'error');
    }
  };

  const steps = [
    { number: 1, title: 'Personal Details', icon: User },
    { number: 2, title: 'Family Information', icon: Users },
    { number: 3, title: 'Statutory Information', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Employee Onboarding</h1>
          <p className="text-gray-600">Complete employee profile to finish the onboarding process</p>
        </div>

        {/* Information Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Employee ID Information</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>A unique Employee ID (e.g., {formData.employeeId}) is assigned at the start of onboarding</li>
                  <li>All onboarding data will be saved under this Employee ID</li>
                  <li>Click "Complete Onboarding" to finalize and mark the employee as active</li>
                  <li>You can edit employee details later in Employee Management without changing the ID</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            {steps.map((step, index) => {
              const Icon = step.icon as any;
              return (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${currentStep >= step.number ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {currentStep > step.number ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <p className={`mt-2 text-sm font-medium ${currentStep >= step.number ? 'text-indigo-600' : 'text-gray-500'}`}>{step.title}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 ${currentStep > step.number ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Employee Selector Section */}
          <div className="mb-8 p-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border-2 border-indigo-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-600" />
                  Load Existing Employee Data
                </h3>
                <p className="text-sm text-gray-600 mt-1">Select an employee to pre-fill their information</p>
              </div>
              {selectedEmployeeId && (
                <div className="flex items-center gap-2 bg-green-100 px-4 py-2 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Employee Loaded</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee</label>
                <select 
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    const empId = e.target.value;
                    fetchEmployeeData(empId);
                  }}
                  className="w-full px-4 py-3 border-2 border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-base font-medium"
                >
                  <option value="">-- Select Employee to Load --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.id} - {emp.personalInfo.firstName} {emp.personalInfo.lastName} ({emp.employmentDetails.designation})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">Choose an existing employee to auto-fill all their details</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID (Read-Only)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={formData.employeeId || 'Auto-generating...'}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed font-bold text-indigo-700 text-lg"
                  />
                  {formData.employeeId && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {selectedEmployeeId ? `Loaded: ${formData.employeeId}` : 'New employee ID will be auto-generated (ECO001, ECO002...)'}
                </p>
              </div>
            </div>
          </div>

          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Personal Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email <span className="text-red-500">*</span></label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter email address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number <span className="text-red-500">*</span></label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter phone number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact Number <span className="text-red-500">*</span></label>
                  <input type="tel" name="emergencyContact" value={formData.emergencyContact} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter emergency contact" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth <span className="text-red-500">*</span></label>
                  <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group <span className="text-red-500">*</span></label>
                  <select name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select Blood Group</option>
                    {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>

              {/* Address Section */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Permanent Address <span className="text-red-500">*</span></label>
                  <textarea name="permanentAddress" value={formData.permanentAddress} onChange={handleInputChange} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter permanent address" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Current/Temporary Address <span className="text-red-500">*</span></label>
                    <button type="button" onClick={handleSameAddress} className="text-sm text-indigo-600 hover:text-indigo-700">Same as Permanent</button>
                  </div>
                  <textarea name="currentAddress" value={formData.currentAddress} onChange={handleInputChange} rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Enter current/temporary address" />
                </div>
              </div>

              {/* Education Information Section */}
              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Education Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Highest Qualification <span className="text-red-500">*</span></label>
                    <select name="qualification" value={formData.qualification} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select Qualification</option>
                      {qualifications.map(qual => <option key={qual} value={qual}>{qual}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {/* 10th Certificate - Mandatory */}
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      10th Certificate <span className="text-red-500">*</span>Employee Onboarding
                    </label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png" 
                      onChange={(e) => handleFileUpload('tenthCertificate', e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                    {formData.tenthCertificate && (
                      <p className="mt-2 text-sm text-green-600">✓ {formData.tenthCertificate.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">10th/SSC Certificate (PDF, JPG, PNG - Max 5MB)</p>
                  </div>

                  {/* PU/12th Certificate - Mandatory */}
                  <div className="border rounded-lg p-4 bg-green-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PU/12th Certificate <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png" 
                      onChange={(e) => handleFileUpload('puCertificate', e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
                    />
                    {formData.puCertificate && (
                      <p className="mt-2 text-sm text-green-600">✓ {formData.puCertificate.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">12th/PUC/Intermediate Certificate (PDF, JPG, PNG - Max 5MB)</p>
                  </div>

                  {/* Degree Certificate - Show if Bachelor's or Master's is selected */}
                  {formData.qualification && !['High School (10th)', 'Intermediate (12th)', 'Diploma', 'ITI', ''].includes(formData.qualification) && (
                    <div className="border rounded-lg p-4 bg-purple-50">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Degree Certificate <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png" 
                        onChange={(e) => handleFileUpload('degreeCertificate', e.target.files?.[0] || null)}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                      />
                      {formData.degreeCertificate && (
                        <p className="mt-2 text-sm text-green-600">✓ {formData.degreeCertificate.name}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Bachelor's Degree Certificate (PDF, JPG, PNG - Max 5MB)</p>
                    </div>
                  )}

                  {/* Master's Certificate - Show only if Master's degree is selected */}
                  {formData.qualification && ['MA (Master of Arts)', 'MSc (Master of Science)', 'MCom (Master of Commerce)', 'MBA (Master of Business Administration)', 'MCA (Master of Computer Applications)', 'MTech (Master of Technology)', 'ME (Master of Engineering)', 'PhD (Doctor of Philosophy)'].includes(formData.qualification) && (
                    <div className="border rounded-lg p-4 bg-indigo-50">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Master's Certificate <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="file" 
                        accept=".pdf,.jpg,.jpeg,.png" 
                        onChange={(e) => handleFileUpload('mastersCertificate', e.target.files?.[0] || null)}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                      />
                      {formData.mastersCertificate && (
                        <p className="mt-2 text-sm text-green-600">✓ {formData.mastersCertificate.name}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Master's Degree Certificate (PDF, JPG, PNG - Max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Previous Work Experience Section */}
              <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-gray-700">Previous Work Experience <span className="text-xs text-gray-500">(Optional)</span></label>
                  <button
                    type="button"
                    onClick={handleAddPreviousCompany}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium"
                  >
                    + Add Company
                  </button>
                </div>
                {formData.previousCompanies.length > 0 ? (
                  <div className="space-y-4">
                    {formData.previousCompanies.map((company: any, index: number) => (
                      <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-gray-300">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                          <input
                            type="text"
                            value={company.name || ''}
                            onChange={(e) => handlePreviousCompanyChange(index, 'name', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            placeholder="e.g., ABC Technologies"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                          <input
                            type="date"
                            value={company.fromDate || ''}
                            onChange={(e) => handlePreviousCompanyChange(index, 'fromDate', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                          <input
                            type="date"
                            value={company.toDate || ''}
                            onChange={(e) => handlePreviousCompanyChange(index, 'toDate', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div className="flex items-end md:col-span-3">
                          <button
                            type="button"
                            onClick={() => handleRemovePreviousCompany(index)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No previous companies added. Click "Add Company" to add work experience.</p>
                )}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Family Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Father's Name <span className="text-red-500">*</span></label>
                  <input type="text" name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Father's Date of Birth</label>
                  <input type="date" name="fatherDob" value={formData.fatherDob} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mother's Name <span className="text-red-500">*</span></label>
                  <input type="text" name="motherName" value={formData.motherName} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mother's Date of Birth</label>
                  <input type="date" name="motherDob" value={formData.motherDob} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Marital Status <span className="text-red-500">*</span></label>
                  <select name="maritalStatus" value={formData.maritalStatus} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    <option value="unmarried">Unmarried</option>
                    <option value="married">Married</option>
                    <option value="single">Single</option>
                  </select>
                </div>
              </div>

              {formData.maritalStatus === 'married' && (
                <div className="mt-6 p-6 bg-indigo-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Spouse Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Spouse Name <span className="text-red-500">*</span></label>
                      <input type="text" name="spouseName" value={formData.spouseName} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Spouse Date of Birth <span className="text-red-500">*</span></label>
                      <input type="date" name="spouseDob" value={formData.spouseDob} onChange={handleInputChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Number of Children</label>
                      <input type="number" name="numberOfKids" value={formData.numberOfKids} onChange={handleInputChange} min={0} max={10} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                    </div>
                  </div>

                  {formData.numberOfKids > 0 && (
                    <div className="mt-6 space-y-4">
                      <h4 className="font-medium text-gray-800">Children Details</h4>
                      {formData.kids.map((kid: any, index: number) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Child {index + 1} Name <span className="text-red-500">*</span></label>
                            <input type="text" value={kid.name || ''} onChange={(e) => handleKidChange(index, 'name', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth <span className="text-red-500">*</span></label>
                            <input type="date" value={kid.dob || ''} onChange={(e) => handleKidChange(index, 'dob', e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Statutory Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ESI Number (if existing)</label>
                  <input type="text" name="esiNumber" value={formData.esiNumber} onChange={handleInputChange} placeholder="e.g., 1234567890123456" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                  <p className="text-xs text-gray-500 mt-1">Leave blank if you don't have an existing ESI number</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PF Number (if existing)</label>
                  <input type="text" name="pfNumber" value={formData.pfNumber} onChange={handleInputChange} placeholder="e.g., AB/BNG/12345/67890" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                  <p className="text-xs text-gray-500 mt-1">Leave blank if you don't have an existing PF number</p>
                </div>
              </div>

              {/* Bank Details Section */}
              <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Bank Account Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      name="bankName" 
                      value={formData.bankName} 
                      onChange={handleInputChange} 
                      placeholder="e.g., State Bank of India" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Holder Name <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      name="accountHolderName" 
                      value={formData.accountHolderName} 
                      onChange={handleInputChange} 
                      placeholder="Name as per bank account" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Account Number <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      name="accountNumber" 
                      value={formData.accountNumber} 
                      onChange={handleInputChange} 
                      placeholder="e.g., 1234567890123456" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">IFSC Code <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      name="ifscCode" 
                      value={formData.ifscCode} 
                      onChange={handleInputChange} 
                      placeholder="e.g., SBIN0001234" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch Name <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      name="branchName" 
                      value={formData.branchName} 
                      onChange={handleInputChange} 
                      placeholder="e.g., Bangalore MG Road" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Document Uploads</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PAN Card */}
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PAN Card <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png" 
                      onChange={(e) => handleFileUpload('panCard', e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                    {formData.panCard && (
                      <p className="mt-2 text-sm text-green-600">✓ {formData.panCard.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                  </div>

                  {/* Aadhar Card */}
                  <div className="border rounded-lg p-4 bg-green-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Aadhar Card <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png" 
                      onChange={(e) => handleFileUpload('aadharCard', e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
                    />
                    {formData.aadharCard && (
                      <p className="mt-2 text-sm text-green-600">✓ {formData.aadharCard.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                  </div>

                  {/* Relieving Letter */}
                  <div className="border rounded-lg p-4 bg-purple-50 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Relieving Letter <span className="text-xs text-gray-500">(Optional - if applicable)</span>
                    </label>
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png" 
                      onChange={(e) => handleFileUpload('relievingLetter', e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                    />
                    {formData.relievingLetter && (
                      <p className="mt-2 text-sm text-green-600">✓ {formData.relievingLetter.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Upload if you have previous work experience (PDF, JPG, PNG - Max 5MB)</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-800 mb-2">Review Your Information</h3>
                <p className="text-sm text-green-700">Please review all the information you've entered before submitting. You can go back to previous steps to make any changes.</p>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button type="button" onClick={prevStep} disabled={currentStep === 1} className={`flex items-center px-6 py-2 rounded-lg font-medium ${currentStep === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              <ChevronLeft className="w-5 h-5 mr-2" /> Previous
            </button>

            {currentStep < 3 ? (
              <button type="button" onClick={nextStep} className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Next <ChevronRight className="w-5 h-5 ml-2" /></button>
            ) : (
              <button type="button" onClick={handleSubmit} className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"><CheckCircle className="w-5 h-5 mr-2" /> Complete Onboarding</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeOnboarding;
