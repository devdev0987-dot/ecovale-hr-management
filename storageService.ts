
import { Employee, Designation, Department, AttendanceRecord, PayRunRecord, PayRunEmployeeRecord, AdvanceRecord, LoanRecord } from '../types';
import { generateEmployeeId, generateUniqueId } from '../utils/helpers';
import { DEPARTMENTS } from '../utils/constants';

// Fix: Define the custom storage API on the Window object for TypeScript
interface CustomStorage {
  get: (key: string) => Promise<{ value: string } | null>;
  set: (key: string, value: string) => Promise<void>;
}

declare global {
  interface Window {
    storage: CustomStorage;
  }
}

// --- MOCK window.storage API if not present ---
if (typeof window.storage === 'undefined') {
  console.warn('`window.storage` API not found. Mocking with in-memory storage.');
  const memoryStore: { [key: string]: string } = {};
  (window as any).storage = {
    get: async (key: string) => {
      const value = memoryStore[key];
      return value ? { value } : null;
    },
    set: async (key: string, value: string) => {
      memoryStore[key] = value;
    },
  };
}


// --- Seed Data ---
const seedDesignations: Designation[] = [
  { id: generateUniqueId(), title: 'Software Engineer', department: 'IT', level: 3, description: 'Develops software solutions.' },
  { id: generateUniqueId(), title: 'general maneger', department: 'IT', level: 4, description: 'Leads employee.' },
  { id: generateUniqueId(), title: 'HR Manager', department: 'HR', level: 5, description: 'Manages HR operations.' },
  { id: generateUniqueId(), title: 'Accountant', department: 'Finance', level: 3, description: 'Manages financial records.' },
  { id: generateUniqueId(), title: 'Sales Executive', department: 'Sales', level: 2, description: 'Drives sales and revenue.' }
];

const seedEmployees: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
        personalInfo: { firstName: "Alice", lastName: "Johnson", dob: "1992-05-20", gender: "Female", contactNumber: "9876543210", personalEmail: "alice.j@email.com", permanentAddress: "123 Maple St, Indiranagar, Bangalore - 560038", currentAddress: "123 Maple St, Indiranagar, Bangalore - 560038", pfNumber: "KA/BLR/12345", bloodGroup: "O+", fatherName: "Robert Johnson", motherName: "Mary Johnson" },
        employmentDetails: { type: "full-time", department: "IT", designation: "Senior Software Engineer", joinDate: "2020-03-15", officialEmail: "alice.johnson@ecovale.com", workLocation: "Bangalore", probationPeriod: 6 },
        salaryInfo: { ctc: 1560000, basic: 80000, hraPercentage: 40, hra: 32000, conveyance: 1600, telephone: 500, medicalAllowance: 1250, specialAllowance: 14650, employeeHealthInsuranceAnnual: 1000, gross: 130000, includePF: true, includeESI: false, pfDeduction: 9600, employerPF: 9600, esiDeduction: 0, employerESI: 0, professionalTax: 200, tds: 8000, tdsMonthly: 666.67, professionalFeesMonthly: 0, professionalFeesInclusive: false, professionalFeesBaseMonthly: 0, professionalFeesTotalMonthly: 0, professionalFeesBaseAnnual: 0, professionalFeesTotalAnnual: 0, net: 112533, paymentMode: "Bank", bankDetails: { bankName: "HDFC Bank", accountHolder: "Alice Johnson", accountNumber: "50100123456789", ifscCode: "HDFC0001234", branch: "Indiranagar" } },
        documents: [], careerHistory: [], status: "active",
    },
    {
        personalInfo: { firstName: "Bob", lastName: "Smith", dob: "1995-11-30", gender: "Male", contactNumber: "8765432109", personalEmail: "bob.s@email.com", permanentAddress: "456 Oak Ave, Whitefield, Bangalore - 560066", currentAddress: "456 Oak Ave, Whitefield, Bangalore - 560066", pfNumber: "KA/BLR/67890", bloodGroup: "A+", fatherName: "John Smith", motherName: "Sarah Smith" },
        employmentDetails: { type: "full-time", department: "Finance", designation: "Accountant", joinDate: "2022-07-01", officialEmail: "bob.smith@ecovale.com", workLocation: "Bangalore", probationPeriod: 3 },
        salaryInfo: { ctc: 720000, basic: 30000, hraPercentage: 40, hra: 12000, conveyance: 1600, telephone: 500, medicalAllowance: 1250, specialAllowance: 14650, employeeHealthInsuranceAnnual: 1000, gross: 60000, includePF: true, includeESI: false, pfDeduction: 3600, employerPF: 3600, esiDeduction: 0, employerESI: 0, professionalTax: 200, tds: 2000, tdsMonthly: 166.67, professionalFeesMonthly: 0, professionalFeesInclusive: false, professionalFeesBaseMonthly: 0, professionalFeesTotalMonthly: 0, professionalFeesBaseAnnual: 0, professionalFeesTotalAnnual: 0, net: 54033, paymentMode: "Bank", bankDetails: { bankName: "ICICI Bank", accountHolder: "Bob Smith", accountNumber: "002401234567", ifscCode: "ICIC0000024", branch: "Whitefield" } },
        documents: [], careerHistory: [], status: "active",
    },
    {
        personalInfo: { firstName: "Priya", lastName: "Sharma", dob: "1990-08-15", gender: "Female", contactNumber: "9988776655", personalEmail: "priya.sharma@gmail.com", permanentAddress: "78 MG Road, Koramangala, Bangalore - 560095", currentAddress: "78 MG Road, Koramangala, Bangalore - 560095", pfNumber: "KA/BLR/11223", esiNumber: "1234567890", bloodGroup: "B+", fatherName: "Rajesh Sharma", motherName: "Sunita Sharma" },
        employmentDetails: { type: "full-time", department: "HR", designation: "HR Manager", joinDate: "2019-01-10", officialEmail: "priya.sharma@ecovale.com", workLocation: "Bangalore", probationPeriod: 6 },
        salaryInfo: { ctc: 1200000, basic: 50000, hraPercentage: 40, hra: 20000, conveyance: 1600, telephone: 500, medicalAllowance: 1250, specialAllowance: 26650, employeeHealthInsuranceAnnual: 1000, gross: 100000, includePF: true, includeESI: false, pfDeduction: 6000, employerPF: 6000, esiDeduction: 0, employerESI: 0, professionalTax: 200, tds: 5000, tdsMonthly: 416.67, professionalFeesMonthly: 0, professionalFeesInclusive: false, professionalFeesBaseMonthly: 0, professionalFeesTotalMonthly: 0, professionalFeesBaseAnnual: 0, professionalFeesTotalAnnual: 0, net: 88383, paymentMode: "Bank", bankDetails: { bankName: "State Bank of India", accountHolder: "Priya Sharma", accountNumber: "12345678901", ifscCode: "SBIN0001234", branch: "Koramangala" } },
        documents: [], careerHistory: [], status: "active",
    },
    {
        personalInfo: { firstName: "Rahul", lastName: "Mehta", dob: "1993-03-22", gender: "Male", contactNumber: "9123456789", personalEmail: "rahul.mehta@yahoo.com", permanentAddress: "45 Brigade Road, Jayanagar, Bangalore - 560011", currentAddress: "45 Brigade Road, Jayanagar, Bangalore - 560011", pfNumber: "KA/BLR/55667", bloodGroup: "AB+", fatherName: "Vijay Mehta", motherName: "Anjali Mehta" },
        employmentDetails: { type: "full-time", department: "Sales", designation: "Sales Executive", joinDate: "2023-05-20", officialEmail: "rahul.mehta@ecovale.com", workLocation: "Bangalore", probationPeriod: 3 },
        salaryInfo: { ctc: 540000, basic: 22500, hraPercentage: 40, hra: 9000, conveyance: 1600, telephone: 500, medicalAllowance: 1250, specialAllowance: 10150, employeeHealthInsuranceAnnual: 1000, gross: 45000, includePF: true, includeESI: false, pfDeduction: 2700, employerPF: 2700, esiDeduction: 0, employerESI: 0, professionalTax: 200, tds: 1000, tdsMonthly: 83.33, professionalFeesMonthly: 0, professionalFeesInclusive: false, professionalFeesBaseMonthly: 0, professionalFeesTotalMonthly: 0, professionalFeesBaseAnnual: 0, professionalFeesTotalAnnual: 0, net: 41017, paymentMode: "Bank", bankDetails: { bankName: "Axis Bank", accountHolder: "Rahul Mehta", accountNumber: "920010012345678", ifscCode: "UTIB0001234", branch: "Jayanagar" } },
        documents: [], careerHistory: [], status: "active",
    },
    {
        personalInfo: { firstName: "Sneha", lastName: "Patel", dob: "1994-12-05", gender: "Female", contactNumber: "8899001122", personalEmail: "sneha.patel@outlook.com", permanentAddress: "12 Residency Road, HSR Layout, Bangalore - 560102", currentAddress: "12 Residency Road, HSR Layout, Bangalore - 560102", pfNumber: "KA/BLR/99887", bloodGroup: "O-", fatherName: "Kiran Patel", motherName: "Meena Patel" },
        employmentDetails: { type: "full-time", department: "Marketing", designation: "Marketing Manager", joinDate: "2021-09-15", officialEmail: "sneha.patel@ecovale.com", workLocation: "Bangalore", probationPeriod: 6 },
        salaryInfo: { ctc: 960000, basic: 40000, hraPercentage: 40, hra: 16000, conveyance: 1600, telephone: 500, medicalAllowance: 1250, specialAllowance: 20650, employeeHealthInsuranceAnnual: 1000, gross: 80000, includePF: true, includeESI: false, pfDeduction: 4800, employerPF: 4800, esiDeduction: 0, employerESI: 0, professionalTax: 200, tds: 3500, tdsMonthly: 291.67, professionalFeesMonthly: 0, professionalFeesInclusive: false, professionalFeesBaseMonthly: 0, professionalFeesTotalMonthly: 0, professionalFeesBaseAnnual: 0, professionalFeesTotalAnnual: 0, net: 71508, paymentMode: "Bank", bankDetails: { bankName: "Kotak Mahindra Bank", accountHolder: "Sneha Patel", accountNumber: "712345678901", ifscCode: "KKBK0001234", branch: "HSR Layout" } },
        documents: [], careerHistory: [], status: "active",
    },
    {
        personalInfo: { firstName: "Amit", lastName: "Kumar", dob: "1988-06-18", gender: "Male", contactNumber: "9876501234", personalEmail: "amit.kumar@gmail.com", permanentAddress: "90 Richmond Road, BTM Layout, Bangalore - 560076", currentAddress: "90 Richmond Road, BTM Layout, Bangalore - 560076", pfNumber: "KA/BLR/44556", bloodGroup: "A-", fatherName: "Suresh Kumar", motherName: "Lakshmi Kumar" },
        employmentDetails: { type: "full-time", department: "IT", designation: "Software Engineer", joinDate: "2024-02-01", officialEmail: "amit.kumar@ecovale.com", workLocation: "Bangalore", probationPeriod: 6 },
        salaryInfo: { ctc: 840000, basic: 35000, hraPercentage: 40, hra: 14000, conveyance: 1600, telephone: 500, medicalAllowance: 1250, specialAllowance: 17650, employeeHealthInsuranceAnnual: 1000, gross: 70000, includePF: true, includeESI: false, pfDeduction: 4200, employerPF: 4200, esiDeduction: 0, employerESI: 0, professionalTax: 200, tds: 2800, tdsMonthly: 233.33, professionalFeesMonthly: 0, professionalFeesInclusive: false, professionalFeesBaseMonthly: 0, professionalFeesTotalMonthly: 0, professionalFeesBaseAnnual: 0, professionalFeesTotalAnnual: 0, net: 62767, paymentMode: "Bank", bankDetails: { bankName: "Yes Bank", accountHolder: "Amit Kumar", accountNumber: "045678901234", ifscCode: "YESB0001234", branch: "BTM Layout" } },
        documents: [], careerHistory: [], status: "active",
    }
];

// --- Helper Functions ---
const getData = async <T,>(key: string, defaultValue: T): Promise<T> => {
  try {
    const result = await window.storage.get(key);
    if (result && result.value) {
      return JSON.parse(result.value) as T;
    }
    // If no data, seed it
    await window.storage.set(key, JSON.stringify(defaultValue));
    return defaultValue;
  } catch (error) {
    console.error(`Error getting data for key "${key}":`, error);
    return defaultValue;
  }
};

const setData = async <T,>(key: string, data: T): Promise<void> => {
  try {
    await window.storage.set(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error setting data for key "${key}":`, error);
    throw new Error('Failed to save data.');
  }
};


// --- Departments API ---
export const getDepartments = async (): Promise<Department[]> => {
  return DEPARTMENTS;
};

export const saveDepartment = async (department: Department): Promise<Department> => {
  // Department is a string union type, so just return it if valid
  if (DEPARTMENTS.includes(department)) {
    return department;
  }
  throw new Error('Invalid department');
};

export const updateDepartment = async (id: Department, updates: Partial<{ name: Department }>): Promise<Department> => {
  // Department is a string type, cannot be updated
  throw new Error('Departments cannot be updated');
};

export const deleteDepartment = async (id: Department): Promise<void> => {
  // Department is a string type, cannot be deleted
  throw new Error('Departments cannot be deleted');
};

// --- Designations API ---
export const getDesignations = async (): Promise<Designation[]> => {
  return getData<Designation[]>('designations', seedDesignations);
};

export const saveDesignation = async (designation: Omit<Designation, 'id'>): Promise<Designation> => {
  const designations = await getDesignations();
  const newDesignation: Designation = { ...designation, id: generateUniqueId() };
  const updatedDesignations = [...designations, newDesignation];
  await setData('designations', updatedDesignations);
  return newDesignation;
};

// --- Employment Types API ---
export const getEmploymentTypes = async (): Promise<string[]> => {
  try {
    const result = await window.storage.get('employment-types');
    if (result && result.value) return JSON.parse(result.value) as string[];
    // seed default types
    const defaults = ['full-time', 'part-time', 'contract'];
    await window.storage.set('employment-types', JSON.stringify(defaults));
    return defaults;
  } catch (error) {
    return ['full-time', 'part-time', 'contract'];
  }
};

export const saveEmploymentType = async (typeName: string): Promise<string> => {
  try {
    const types = await getEmploymentTypes();
    if (types.includes(typeName)) return typeName;
    const updated = [...types, typeName];
    await setData('employment-types', updated);
    return typeName;
  } catch (error) {
    throw new Error('Failed to save employment type');
  }
};

export const updateDesignation = async (updatedDesignation: Designation): Promise<Designation> => {
  const designations = await getDesignations();
  const index = designations.findIndex(d => d.id === updatedDesignation.id);
  if (index === -1) throw new Error('Designation not found');
  designations[index] = updatedDesignation;
  await setData('designations', designations);
  return updatedDesignation;
};

export const deleteDesignation = async (id: string): Promise<void> => {
  const designations = await getDesignations();
  const updatedDesignations = designations.filter(d => d.id !== id);
  await setData('designations', updatedDesignations);
};

// --- Employees API ---
const getInitialEmployees = (): Employee[] => {
    return seedEmployees.map((emp, index) => {
        const newEmp = {
            ...emp,
            id: generateEmployeeId(index),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        // Auto-generate official email
        newEmp.employmentDetails.officialEmail = `${emp.personalInfo.firstName.toLowerCase()}.${emp.personalInfo.lastName.toLowerCase()}@ecovale.com`;
        return newEmp;
    });
};

export const getEmployees = async (): Promise<Employee[]> => {
  // Read stored employees. Normalize IDs to a continuous numeric sequence (1..n)
  const stored = await getData<Employee[]>('employees', []);
  if (!stored || stored.length === 0) return stored;
  const needsNormalize = stored.some(e => typeof e.id !== 'string' || /^EMP/i.test(e.id) || !/^[0-9]+$/.test(e.id));
  if (!needsNormalize) return stored;
  const normalized = stored.map((e, idx) => ({ ...e, id: generateEmployeeId(idx) }));
  await setData('employees', normalized);
  return normalized;
};

export const getEmployeeById = async (id: string): Promise<Employee | undefined> => {
    const employees = await getEmployees();
    return employees.find(e => e.id === id);
};

export const saveEmployee = async (employeeData: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> => {
  const employees = await getEmployees();
  const newEmployee: Employee = {
    ...employeeData,
    id: generateEmployeeId(employees.length),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updatedEmployees = [...employees, newEmployee];
  await setData('employees', updatedEmployees);
  return newEmployee;
};

export const updateEmployee = async (updatedEmployee: Employee): Promise<Employee> => {
  const employees = await getEmployees();
  const index = employees.findIndex(e => e.id === updatedEmployee.id);
  if (index === -1) throw new Error('Employee not found');
  employees[index] = { ...updatedEmployee, updatedAt: new Date().toISOString() };
  await setData('employees', employees);
  return employees[index];
};

export const deleteEmployee = async (id: string): Promise<void> => {
  const employees = await getEmployees();
  const updatedEmployees = employees.filter(e => e.id !== id);
  await setData('employees', updatedEmployees);
};

// --- Attendance API ---
export const getAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  return getData<AttendanceRecord[]>('attendanceRecords', []);
};

export const getAttendanceByEmployeeAndMonth = async (
  employeeId: string, 
  month: string, 
  year: string
): Promise<AttendanceRecord | undefined> => {
  const records = await getAttendanceRecords();
  return records.find(
    r => r.employeeId === employeeId && r.month === month && r.year === year
  );
};

export const saveAttendanceRecord = async (
  attendanceData: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'payableDays' | 'lossOfPayDays'>
): Promise<AttendanceRecord> => {
  const records = await getAttendanceRecords();
  
  // Check if record exists for this employee, month, and year
  const existingIndex = records.findIndex(
    r => r.employeeId === attendanceData.employeeId && 
         r.month === attendanceData.month && 
         r.year === attendanceData.year
  );

  // Auto-calculate payable and loss of pay days
  const payableDays = attendanceData.presentDays + attendanceData.paidLeave;
  const lossOfPayDays = attendanceData.unpaidLeave + attendanceData.absentDays;

  if (existingIndex !== -1) {
    // Update existing record
    const updatedRecord: AttendanceRecord = {
      ...records[existingIndex],
      ...attendanceData,
      payableDays,
      lossOfPayDays,
      updatedAt: new Date().toISOString()
    };
    records[existingIndex] = updatedRecord;
    await setData('attendanceRecords', records);
    return updatedRecord;
  } else {
    // Create new record
    const newRecord: AttendanceRecord = {
      ...attendanceData,
      id: `ATT${Date.now()}`,
      payableDays,
      lossOfPayDays,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updatedRecords = [...records, newRecord];
    await setData('attendanceRecords', updatedRecords);
    return newRecord;
  }
};

export const deleteAttendanceRecord = async (id: string): Promise<void> => {
  const records = await getAttendanceRecords();
  const updatedRecords = records.filter(r => r.id !== id);
  await setData('attendanceRecords', updatedRecords);
};

// --- Pay Run API ---
export const getPayRunRecords = async (): Promise<PayRunRecord[]> => {
  return getData<PayRunRecord[]>('payRunRecords', []);
};

export const getPayRunByMonthYear = async (
  month: string, 
  year: string
): Promise<PayRunRecord | undefined> => {
  const records = await getPayRunRecords();
  return records.find(r => r.month === month && r.year === year);
};

export const generatePayRun = async (month: string, year: string): Promise<PayRunRecord> => {
  const employees = await getEmployees();
  const activeEmployees = employees.filter(e => e.status === 'active');

  // Get advance records from localStorage (not using window.storage for advances/loans)
  const advanceRecords: AdvanceRecord[] = JSON.parse(
    localStorage.getItem('advanceRecords') || '[]'
  );
  
  // Get loan records from localStorage
  const loanRecords: LoanRecord[] = JSON.parse(
    localStorage.getItem('loanRecords') || '[]'
  );

  const employeeRecords: PayRunEmployeeRecord[] = await Promise.all(
    activeEmployees.map(async (employee) => {
      const salaryInfo = employee.salaryInfo;
      
      // Get attendance for this employee and month
      const attendance = await getAttendanceByEmployeeAndMonth(
        employee.id,
        month,
        year
      );

      // Default to full month if no attendance record
      const totalWorkingDays = attendance?.totalWorkingDays || 26;
      const payableDays = attendance?.payableDays || totalWorkingDays;
      const lossOfPayDays = attendance?.lossOfPayDays || 0;

      // Calculate pro-rated salary based on attendance
      const salaryPerDay = salaryInfo.basic / totalWorkingDays;
      const lossOfPayAmount = lossOfPayDays * salaryPerDay;
      const adjustedBasic = salaryInfo.basic - lossOfPayAmount;

      // Calculate allowances (pro-rated)
      const allowanceRatio = payableDays / totalWorkingDays;
      const hra = salaryInfo.hra * allowanceRatio;
      const conveyance = salaryInfo.conveyance * allowanceRatio;
      const telephone = salaryInfo.telephone * allowanceRatio;
      const medicalAllowance = salaryInfo.medicalAllowance * allowanceRatio;
      const specialAllowance = salaryInfo.specialAllowance * allowanceRatio;

      const totalAllowances = hra + conveyance + telephone + medicalAllowance + specialAllowance;
      const grossSalary = adjustedBasic + totalAllowances;

      // Get advance deduction for this month
      const advanceDeduction = advanceRecords
        .filter(
          adv =>
            adv.employeeId === employee.id &&
            adv.advanceDeductionMonth === month &&
            adv.advanceDeductionYear === year &&
            adv.status !== 'deducted'
        )
        .reduce((sum, adv) => sum + adv.advancePaidAmount, 0);

      // Get loan deduction (EMI) for this month
      const loanDeduction = loanRecords
        .filter(
          loan =>
            loan.employeeId === employee.id &&
            loan.status === 'active'
        )
        .reduce((sum, loan) => {
          const emi = loan.emiSchedule.find(
            e => e.month === month && e.year === year && e.status === 'pending'
          );
          return sum + (emi?.emiAmount || 0);
        }, 0);

      // Calculate statutory deductions (pro-rated)
      const pfDeduction = salaryInfo.includePF 
        ? (salaryInfo.pfDeduction * allowanceRatio) 
        : 0;
      const esiDeduction = salaryInfo.includeESI 
        ? (salaryInfo.esiDeduction * allowanceRatio) 
        : 0;
      const professionalTax = salaryInfo.professionalTax * allowanceRatio;
      const tds = (salaryInfo.tdsMonthly || 0) * allowanceRatio;

      const totalDeductions =
        advanceDeduction +
        loanDeduction +
        pfDeduction +
        esiDeduction +
        professionalTax +
        tds;

      const netPay = grossSalary - totalDeductions;

      return {
        employeeId: employee.id,
        employeeName: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
        basicSalary: adjustedBasic,
        hra,
        conveyance,
        telephone,
        medicalAllowance,
        specialAllowance,
        totalAllowances,
        grossSalary,
        totalWorkingDays,
        payableDays,
        lossOfPayDays,
        lossOfPayAmount,
        advanceDeduction,
        loanDeduction,
        pfDeduction,
        esiDeduction,
        professionalTax,
        tds,
        totalDeductions,
        netPay
      };
    })
  );

  const payRun: PayRunRecord = {
    id: `PR${Date.now()}`,
    month,
    year,
    employeeRecords,
    generatedAt: new Date().toISOString()
  };

  const payRuns = await getPayRunRecords();
  
  // Replace if exists for same month/year, otherwise add
  const existingIndex = payRuns.findIndex(pr => pr.month === month && pr.year === year);
  if (existingIndex !== -1) {
    payRuns[existingIndex] = payRun;
  } else {
    payRuns.push(payRun);
  }
  
  await setData('payRunRecords', payRuns);
  return payRun;
};

export const deletePayRun = async (id: string): Promise<void> => {
  const records = await getPayRunRecords();
  const updatedRecords = records.filter(r => r.id !== id);
  await setData('payRunRecords', updatedRecords);
};
