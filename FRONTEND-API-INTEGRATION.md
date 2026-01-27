# Frontend API Integration Guide

## Overview
Complete React frontend integration with the Spring Boot backend using **Axios** for API calls. This guide provides production-ready code with proper error handling, async/await patterns, and environment variable configuration.

---

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

This is a **Vite** project, so all environment variables must be prefixed with `VITE_`.

#### For Local Development
Copy the example file and customize:
```bash
cp .env.example .env
```

Or create `.env` manually:
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEBUG=true
```

#### For Production Deployment
Use `.env.production`:
```env
VITE_API_BASE_URL=https://api.ecovale.com
VITE_API_TIMEOUT=45000
VITE_ENABLE_DEBUG=false
```

**Important Notes:**
- ✅ Variables **MUST** start with `VITE_` to be accessible in code
- ✅ Restart dev server after changing `.env` files
- ✅ Never commit `.env` with sensitive data (already in `.gitignore`)
- ✅ Use `.env.example` as a template for team members

### 3. Import Services in Your Components
```javascript
import EmployeeService from '../services/employeeService';
import AttendanceService from '../services/attendanceService';
import LoanService from '../services/loanService';
```

---

## 📁 File Structure

```
ecovale-hr-web-app/
├── .env                                    # Environment variables
├── services/
│   ├── apiClient.js                        # Axios base configuration
│   ├── employeeService.js                  # Employee API calls
│   ├── attendanceService.js                # Attendance API calls
│   ├── loanService.js                      # Loan API calls
│   ├── advanceService.js                   # Advance API calls
│   └── designationService.js               # Designation API calls
└── components/
    └── examples/
        ├── EmployeeFormExample.jsx         # Example employee form
        ├── AttendanceFormExample.jsx       # Example attendance form
        └── LoanFormExample.jsx             # Example loan form
```

---

## 🔧 API Client Configuration

The `apiClient.js` provides:
- ✅ Centralized Axios instance
- ✅ Request/Response interceptors
- ✅ Automatic error handling
- ✅ Standard response format extraction
- ✅ Authentication token management (future-ready)

### Standard Response Format
All APIs return:
```javascript
{
  success: true,          // boolean
  message: "...",         // string
  data: {...}            // object or array
}
```

---

## 📝 Usage Examples

### 1. Employee Service

#### Create Employee
```javascript
import EmployeeService from '../services/employeeService';

const createEmployee = async () => {
  try {
    const employeeData = {
      firstName: "John",
      lastName: "Doe",
      gender: "Male",
      contactNumber: "9876543210",
      personalEmail: "john@example.com",
      currentAddress: "123 Main St",
      type: "FULL_TIME",
      department: "IT",
      designation: "Software Engineer",
      officialEmail: "john@ecovale.com",
      workLocation: "Bangalore",
      ctc: 1200000,
      basic: 50000,
      net: 88800,
      paymentMode: "Bank",
      status: "ACTIVE"
    };

    const response = await EmployeeService.createEmployee(employeeData);
    
    if (response.success) {
      console.log('Employee created:', response.data);
      // Handle success (show toast, redirect, etc.)
    }
  } catch (error) {
    console.error('Error:', error);
    // Handle error (show error message)
  }
};
```

#### Get All Employees
```javascript
const fetchEmployees = async () => {
  try {
    const response = await EmployeeService.getAllEmployees();
    
    if (response.success) {
      const employees = response.data; // Array of employees
      console.log('Employees:', employees);
    }
  } catch (error) {
    console.error('Error fetching employees:', error);
  }
};
```

#### Get Active Employees
```javascript
const fetchActiveEmployees = async () => {
  try {
    const response = await EmployeeService.getActiveEmployees();
    return response.data; // Array of active employees
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};
```

#### Search Employees
```javascript
const searchEmployees = async (searchTerm) => {
  try {
    const response = await EmployeeService.searchEmployees(searchTerm);
    return response.data;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};
```

#### Update Employee
```javascript
const updateEmployee = async (employeeId, updatedData) => {
  try {
    const response = await EmployeeService.updateEmployee(employeeId, updatedData);
    
    if (response.success) {
      console.log('Employee updated:', response.data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

#### Delete Employee
```javascript
const deleteEmployee = async (employeeId) => {
  try {
    const response = await EmployeeService.deleteEmployee(employeeId);
    
    if (response.success) {
      console.log('Employee deleted successfully');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

### 2. Attendance Service

#### Create Attendance Record
```javascript
import AttendanceService from '../services/attendanceService';

const createAttendance = async () => {
  try {
    const attendanceData = {
      employeeId: "EMP12345",
      employeeName: "John Doe",
      month: "January",
      year: "2026",
      totalWorkingDays: 26,
      presentDays: 24,
      absentDays: 2,
      paidLeave: 1,
      unpaidLeave: 1,
      payableDays: 25,
      lossOfPayDays: 1,
      remarks: "Good attendance"
    };

    const response = await AttendanceService.createAttendanceRecord(attendanceData);
    
    if (response.success) {
      console.log('Attendance created:', response.data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

#### Get Attendance by Employee
```javascript
const getEmployeeAttendance = async (employeeId) => {
  try {
    const response = await AttendanceService.getAttendanceByEmployeeId(employeeId);
    return response.data; // Array of attendance records
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};
```

#### Get Attendance by Period
```javascript
const getAttendanceForPeriod = async (month, year) => {
  try {
    const response = await AttendanceService.getAttendanceByPeriod(month, year);
    return response.data;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};
```

---

### 3. Loan Service

#### Create Loan Record
```javascript
import LoanService from '../services/loanService';

const createLoan = async () => {
  try {
    const loanData = {
      employeeId: "EMP12345",
      employeeName: "John Doe",
      loanAmount: 100000,
      interestRate: 10,
      numberOfEMIs: 12,
      emiAmount: 8792,
      totalAmount: 105500,
      startMonth: "February 2026",
      startYear: "2026",
      totalPaidEMIs: 0,
      remainingBalance: 105500,
      status: "ACTIVE",
      remarks: "Home improvement loan"
    };

    const response = await LoanService.createLoanRecord(loanData);
    
    if (response.success) {
      console.log('Loan created:', response.data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

#### Get Loans by Employee
```javascript
const getEmployeeLoans = async (employeeId) => {
  try {
    const response = await LoanService.getLoansByEmployeeId(employeeId);
    return response.data; // Array of loan records
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};
```

#### Get Active Loans
```javascript
const getActiveLoans = async () => {
  try {
    const response = await LoanService.getLoansByStatus('ACTIVE');
    return response.data;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
};
```

---

## 🎯 React Component Integration

### Complete Form Component Example

```javascript
import React, { useState } from 'react';
import EmployeeService from '../services/employeeService';
import { useAppContext } from '../contexts/AppContext';

const CreateEmployeeForm = () => {
  const { showToast } = useAppContext();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    // ... other fields
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await EmployeeService.createEmployee(formData);
      
      if (response.success) {
        showToast('Employee created successfully!', 'success');
        // Reset form or redirect
      } else {
        showToast(response.message, 'error');
      }
    } catch (error) {
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Employee'}
      </button>
    </form>
  );
};
```

### Data Fetching in useEffect

```javascript
import React, { useState, useEffect } from 'react';
import EmployeeService from '../services/employeeService';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await EmployeeService.getAllEmployees();
      
      if (response.success) {
        setEmployees(response.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {employees.map(emp => (
        <div key={emp.id}>{emp.firstName} {emp.lastName}</div>
      ))}
    </div>
  );
};
```

---

## 🛡️ Error Handling

### Backend Validation Errors
When the backend returns validation errors (status 400), they're automatically formatted:

```javascript
try {
  await EmployeeService.createEmployee(data);
} catch (error) {
  // error.data contains field-level errors
  if (error.status === 400 && error.data) {
    // error.data = { firstName: "First name is required", ... }
    setFormErrors(error.data);
  }
}
```

### Network Errors
```javascript
try {
  await EmployeeService.getAllEmployees();
} catch (error) {
  if (error.message === 'Network error - Unable to reach server') {
    // Backend is down or unreachable
    showToast('Cannot connect to server. Please try again later.', 'error');
  }
}
```

### Resource Not Found (404)
```javascript
try {
  await EmployeeService.getEmployeeById('INVALID_ID');
} catch (error) {
  if (error.status === 404) {
    showToast('Employee not found', 'error');
  }
}
```

### Duplicate Resource (409)
```javascript
try {
  await EmployeeService.createEmployee(data);
} catch (error) {
  if (error.status === 409) {
    showToast('An employee with this email already exists', 'error');
  }
}
```

---

## 🔐 Authentication (Future Enhancement)

The API client is ready for authentication. When you add login functionality:

```javascript
// After successful login, store token
localStorage.setItem('authToken', 'your-jwt-token');

// The apiClient will automatically include it in all requests:
// Authorization: Bearer your-jwt-token

// To logout
localStorage.removeItem('authToken');
```

---

## 🌐 Environment Configuration

### Available Environment Files

| File | Purpose | Git Tracked | Usage |
|------|---------|-------------|-------|
| `.env.example` | Template with all variables | ✅ Yes | Copy to create your `.env` |
| `.env` | Local development config | ❌ No | Active during `npm run dev` |
| `.env.local` | Local overrides | ❌ No | Overrides `.env` values |
| `.env.production` | Production build config | ✅ Yes | Active during `npm run build` |

### Environment Variables Reference

```env
# Backend API Base URL
# Local: http://localhost:8080
# Production: https://api.yourdomain.com
VITE_API_BASE_URL=http://localhost:8080

# API Request Timeout (milliseconds)
# Default: 30000 (30 seconds)
# Production: Consider 45000+ for slower networks
VITE_API_TIMEOUT=30000

# Debug Mode (optional)
# Shows API configuration in browser console
VITE_ENABLE_DEBUG=true
```

### Setup Instructions

#### First Time Setup
```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env  # or use any text editor

# Install dependencies
npm install

# Start development server
npm run dev
```

#### Production Deployment
```bash
# Ensure .env.production has correct values
# Build will automatically use .env.production
npm run build

# Preview production build
npm run preview
```

### Accessing Environment Variables in Code

Vite exposes environment variables via `import.meta.env`:

```javascript
// ✅ Correct - Vite syntax
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const timeout = import.meta.env.VITE_API_TIMEOUT;
const isDebug = import.meta.env.VITE_ENABLE_DEBUG;

// ✅ Check environment mode
const isDev = import.meta.env.DEV;        // true in development
const isProd = import.meta.env.PROD;      // true in production
const mode = import.meta.env.MODE;        // 'development' or 'production'

// ❌ Wrong - This is Create React App syntax (won't work)
const apiUrl = process.env.REACT_APP_API_BASE_URL;  // undefined
```

### Example: Conditional Configuration

```javascript
// services/apiClient.js already handles this
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;

// Log in development only
if (import.meta.env.DEV) {
  console.log('🔧 API Client Configuration:');
  console.log('  Base URL:', API_BASE_URL);
  console.log('  Timeout:', API_TIMEOUT, 'ms');
}
```

### Environment File Priority

Vite loads environment files in this order (later overrides earlier):

1. `.env` - Loaded in all cases
2. `.env.local` - Loaded in all cases, ignored by git
3. `.env.[mode]` - Loaded only in specified mode (e.g., `.env.production`)
4. `.env.[mode].local` - Loaded only in specified mode, ignored by git

### Security Best Practices

✅ **DO:**
- Commit `.env.example` with placeholder values
- Use different URLs for dev/staging/production
- Store secrets in server-side `.env` (backend)
- Document all required variables in `.env.example`

❌ **DON'T:**
- Commit `.env` or `.env.local` files
- Store API keys or secrets in client-side env vars (visible in browser!)
- Use `VITE_` prefix for sensitive data
- Hardcode URLs in source code

### Troubleshooting

#### Variables not loading?
```bash
# 1. Check variable name has VITE_ prefix
# 2. Restart dev server (Ctrl+C, then npm run dev)
# 3. Check .env file exists in project root
# 4. Verify no syntax errors in .env
```

#### Wrong API URL in production?
```bash
# 1. Ensure .env.production exists
# 2. Check VITE_API_BASE_URL value
# 3. Rebuild: npm run build
# 4. Clear browser cache
```

#### Environment variables undefined?
```javascript
// Add fallback values
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Or throw error if critical
if (!import.meta.env.VITE_API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL is required');
}
```

---

## 🌐 Multiple Environment Support

### Development
```bash
npm run dev
# Uses .env and .env.local
# API: http://localhost:8080
```

### Staging (custom)
```bash
# Create .env.staging
VITE_API_BASE_URL=https://staging-api.ecovale.com

# Build with staging env
npm run build -- --mode staging
```

### Production

---

## 📦 Available Services

All services follow the same pattern with async/await:

| Service | Methods |
|---------|---------|
| **EmployeeService** | `createEmployee`, `getAllEmployees`, `getEmployeeById`, `getActiveEmployees`, `getEmployeesByDepartment`, `searchEmployees`, `updateEmployee`, `deleteEmployee` |
| **AttendanceService** | `createAttendanceRecord`, `getAllAttendanceRecords`, `getAttendanceById`, `getAttendanceByEmployeeId`, `getAttendanceByPeriod`, `updateAttendanceRecord`, `deleteAttendanceRecord` |
| **LoanService** | `createLoanRecord`, `getAllLoanRecords`, `getLoanById`, `getLoansByEmployeeId`, `getLoansByStatus`, `updateLoanRecord`, `deleteLoanRecord` |
| **AdvanceService** | `createAdvanceRecord`, `getAllAdvanceRecords`, `getAdvanceById`, `getAdvancesByEmployeeId`, `getAdvancesByStatus`, `updateAdvanceRecord`, `deleteAdvanceRecord` |
| **DesignationService** | `createDesignation`, `getAllDesignations`, `getDesignationById`, `getDesignationsByDepartment`, `updateDesignation`, `deleteDesignation` |

---

## 🧪 Testing API Calls

### Test in Browser Console
```javascript
// Import service (after app is loaded)
const EmployeeService = window.EmployeeService; // If exposed

// Or use fetch directly
fetch('http://localhost:8080/api/employees')
  .then(res => res.json())
  .then(data => console.log(data));
```

### Test with React DevTools
1. Install React DevTools
2. Inspect component state
3. Check network requests in browser DevTools

---

## 🚨 Common Issues

### Issue: CORS Error
**Solution:** Ensure backend CORS is configured for `http://localhost:5173` (Vite default port)

### Issue: Network Error
**Solution:** 
- Check if backend is running: `http://localhost:8080/actuator/health`
- Verify `.env` has correct `VITE_API_BASE_URL`

### Issue: 404 on API calls
**Solution:** Ensure backend endpoints match service URLs

### Issue: Environment variables not loading
**Solution:** 
- Restart Vite dev server after changing `.env`
- Use `import.meta.env.VITE_*` (not `process.env`)

---

## 📚 Example Components Reference

Three complete example components are provided:

1. **[EmployeeFormExample.jsx](../components/examples/EmployeeFormExample.jsx)** - Complete employee creation form with validation
2. **[AttendanceFormExample.jsx](../components/examples/AttendanceFormExample.jsx)** - Attendance form with auto-calculations
3. **[LoanFormExample.jsx](../components/examples/LoanFormExample.jsx)** - Loan form with EMI calculator

Use these as templates for your actual implementation.

---

## ✅ Best Practices

1. **Always use async/await** - Cleaner than `.then()` chains
2. **Handle errors gracefully** - Show user-friendly messages
3. **Show loading states** - Better UX during API calls
4. **Validate before submit** - Client-side validation first
5. **Log errors** - Use `console.error` for debugging
6. **Use try-catch** - Never let errors crash the app
7. **Environment variables** - Never hardcode API URLs
8. **Reuse services** - Don't write duplicate API calls

---

## 🔄 Migration from storageService.ts

If you're currently using `storageService.ts` with mock data:

### Before (Mock):
```javascript
import { saveEmployee } from '../services/storageService';

const employee = await saveEmployee(employeeData);
```

### After (Real API):
```javascript
import EmployeeService from '../services/employeeService';

const response = await EmployeeService.createEmployee(employeeData);
if (response.success) {
  const employee = response.data;
}
```

---

## 📞 Support

For issues or questions:
- Check backend logs: Backend console output
- Check browser console: F12 → Console tab
- Check network tab: F12 → Network tab
- Review backend [README.md](../backend/README.md)

---

## 🎉 You're Ready!

Your frontend is now fully integrated with the Spring Boot backend. Start building your forms and data displays using the provided services.

**Happy coding! 🚀**
