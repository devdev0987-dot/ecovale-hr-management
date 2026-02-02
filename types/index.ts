
export type Department = 'IT' | 'HR' | 'Finance' | 'Sales' | 'Marketing';

export type Designation = {
  id: string;
  title: string;
  department: Department;
  description: string;
  reportingTo?: string;
  level: number;
};

export interface BankDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
}

export interface SalaryInfo {
  ctc: number;
  basic: number;
  hraPercentage: number;
  hra: number;
  conveyance: number;
  telephone: number;
  medicalAllowance: number;
  specialAllowance: number;
  employeeHealthInsuranceAnnual: number;
  gross: number;
  includePF: boolean;
  includeESI: boolean;
  pfDeduction: number;
  esiDeduction: number;
  employerESI?: number;
  employerPF: number;
  professionalTax: number;
  tds: number;
  tdsMonthly?: number;
  gstMonthly?: number;
  gstAnnual?: number;
  professionalFeesMonthly?: number;
  professionalFeesInclusive?: boolean;
  professionalFeesBaseMonthly?: number;
  professionalFeesTotalMonthly?: number;
  professionalFeesBaseAnnual?: number;
  professionalFeesTotalAnnual?: number;
  net: number;
  paymentMode: 'Bank' | 'Cash' | 'Cheque';
  bankDetails?: BankDetails;
  annexure?: {
    fileName: string;
    data: string; // base64
    generatedAt: string;
  } | null;
}

export interface Document {
  type: string;
  fileName: string;
  data: string; // base64
  uploadDate: string;
}

export interface CareerHistoryItem {
  type: 'promotion' | 'increment' | 'demotion';
  date: string;
  details: any;
}

export interface Employee {
  id: string;
  personalInfo: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dob?: string;
    gender: 'Male' | 'Female' | 'Other';
    photo?: string; // base64
    contactNumber: string;
    alternateContact?: string;
    emergencyContact?: string;
    personalEmail: string;
    permanentAddress?: string;
    currentAddress: string;
    pfNumber?: string;
    esiNumber?: string;
    bloodGroup?: string;
    fatherName?: string;
    motherName?: string;
  };
  employmentDetails: {
  type: 'full-time' | 'part-time';
    department: Department;
    designation: string;
    reportingManager?: string;
    joinDate?: string;
    officialEmail: string;
    workLocation: 'Bangalore' | 'Mangaluru' | 'Mysore' | 'Belagaum' | 'Hubballi' | 'Kolar' | 'Tumkur' | 'Shivamogga' | 'Remote';
    probationPeriod: number;
    grade?: 'A' | 'B' | 'C' | 'D';
  };
  salaryInfo: SalaryInfo;
  documents: Document[];
  careerHistory: CareerHistoryItem[];
  status: 'active' | 'inactive';
  onboardingStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  onboardingStartedAt?: string;
  onboardingCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type Page = 
  | 'dashboard' 
  | 'employees' 
  | 'new-employee' 
  | 'designations' 
  | 'letters' 
  | 'payroll' 
  | 'calculator' 
  | 'career' 
  | 'settings'
  | 'onboarding'
  | 'documents'
  | 'advance-register'
  | 'loan-register'
  | 'Payslip'
  | 'attendance-register'
  | 'pay-run';

export interface AdvanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  advanceMonth: string; // Format: "January 2026"
  advanceYear: string;
  advancePaidAmount: number;
  advanceDeductionMonth: string; // Format: "February 2026"
  advanceDeductionYear: string;
  remarks: string;
  status: 'pending' | 'deducted' | 'partial';
  remainingAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoanEMI {
  month: string; // Format: "January 2026"
  year: string;
  emiAmount: number;
  status: 'pending' | 'paid';
  paidDate?: string;
}

export interface LoanRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  loanAmount: number;
  interestRate: number; // percentage
  numberOfEMIs: number;
  emiAmount: number;
  totalAmount: number; // Loan + Interest
  startMonth: string; // Format: "January 2026"
  startYear: string;
  emiSchedule: LoanEMI[];
  totalPaidEMIs: number;
  remainingBalance: number;
  status: 'active' | 'completed' | 'cancelled';
  remarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // Format: "January"
  year: string; // Format: "2026"
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  paidLeave: number;
  unpaidLeave: number;
  payableDays: number; // Auto-calculated: Present Days + Paid Leave
  lossOfPayDays: number; // Auto-calculated: Unpaid Leave + Absent Days
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayRunRecord {
  id: string;
  month: string; // Format: "January"
  year: string; // Format: "2026"
  employeeRecords: PayRunEmployeeRecord[];
  generatedAt: string;
  generatedBy?: string;
}

export interface PayRunEmployeeRecord {
  employeeId: string;
  employeeName: string;
  basicSalary: number;
  hra: number;
  conveyance: number;
  telephone: number;
  medicalAllowance: number;
  specialAllowance: number;
  totalAllowances: number;
  grossSalary: number;
  
  // Attendance-based adjustments
  totalWorkingDays: number;
  payableDays: number;
  lossOfPayDays: number;
  lossOfPayAmount: number;
  
  // Deductions
  advanceDeduction: number;
  loanDeduction: number;
  pfDeduction: number;
  esiDeduction: number;
  professionalTax: number;
  tds: number;
  totalDeductions: number;
  
  netPay: number;
}
