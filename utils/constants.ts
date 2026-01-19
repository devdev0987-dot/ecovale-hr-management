import { Department } from '../types';

export const DEPARTMENTS: Department[] = ['IT', 'HR', 'Finance', 'Sales', 'Marketing'];

export const WORK_LOCATIONS = ['Bangalore', 'Mangaluru', 'Mysore', 'Belagaum', 'Hubballi', 'Kolar', 'Tumkur', 'Shivamogga', 'Remote'];

export const GENDERS = ['Male', 'Female', 'Other'];

export const EMPLOYEE_TYPES = ['full-time', 'part-time'];

export const PAYMENT_MODES = ['Bank', 'Cash', 'Cheque'];

export const GRADES = ['A', 'B', 'C', 'D'];

export const STATUSES = ['active', 'inactive'];

// Salary Configuration
export const BASIC_PCT_OF_CTC = 0.50; // 50% fixed
export const PF_WAGE_CEILING_MONTHLY = 15000;
export const PF_EMPLOYEE_RATE = 0.12; // 12%
export const PF_EMPLOYER_RATE = 0.12; // 12%
export const ESI_EMPLOYEE_RATE = 0.0075; // 0.75%
export const ESI_EMPLOYER_RATE = 0.0325; // 3.25%
export const ESI_WAGE_CEILING_MONTHLY = 21000;
export const EMPLOYEE_HEALTH_INSURANCE_ANNUAL = 1000;
export const GRATUITY_RATE_ANNUAL = 0.0481; // ~4.81% annual provision approximation
// GST removed per request

export const EMPLOYEE_TYPE_LABELS: { [key: string]: string } = {
	'full-time': 'Full Time',
	'part-time': 'Part Time',
	'contract': 'Contract Based',
};
