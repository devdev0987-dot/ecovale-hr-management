# Frontend Migration Guide

This document provides a comprehensive guide for migrating the existing TypeScript React frontend to pure JavaScript and integrating it with the new Express.js backend.

---

## Table of Contents

1. [Overview](#1-overview)
2. [TypeScript to JavaScript Conversion](#2-typescript-to-javascript-conversion)
3. [Replacing storageService with API Calls](#3-replacing-storageservice-with-api-calls)
4. [React Query Integration](#4-react-query-integration)
5. [Authentication Integration](#5-authentication-integration)
6. [File-by-File Migration](#6-file-by-file-migration)
7. [Testing the Migration](#7-testing-the-migration)

---

## 1. Overview

### Current Architecture

```
┌─────────────────────────────────────────────────┐
│                   React App                      │
│  ┌───────────────────────────────────────────┐  │
│  │            Page Components                 │  │
│  │  (NewEmployeePage, EmployeesPage, etc.)   │  │
│  └───────────────────────────────────────────┘  │
│                      │                           │
│                      ▼                           │
│  ┌───────────────────────────────────────────┐  │
│  │           storageService.ts               │  │
│  │    (Simulates backend with localStorage)  │  │
│  └───────────────────────────────────────────┘  │
│                      │                           │
│                      ▼                           │
│  ┌───────────────────────────────────────────┐  │
│  │     window.storage / localStorage         │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Target Architecture

```
┌──────────────────────────────────────────────────┐
│                   React App                       │
│  ┌────────────────────────────────────────────┐  │
│  │            Page Components                  │  │
│  └────────────────────────────────────────────┘  │
│                      │                            │
│                      ▼                            │
│  ┌────────────────────────────────────────────┐  │
│  │   React Query Hooks (useEmployees, etc.)   │  │
│  └────────────────────────────────────────────┘  │
│                      │                            │
│                      ▼                            │
│  ┌────────────────────────────────────────────┐  │
│  │          apiService.js (Axios)             │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
                       │
                       │ HTTP/HTTPS
                       ▼
┌──────────────────────────────────────────────────┐
│              Express.js Backend                   │
│  ┌────────────────────────────────────────────┐  │
│  │     Routes → Controllers → Models          │  │
│  └────────────────────────────────────────────┘  │
│                      │                            │
│                      ▼                            │
│  ┌────────────────────────────────────────────┐  │
│  │              MongoDB                        │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

---

## 2. TypeScript to JavaScript Conversion

### 2.1 File Extension Changes

| TypeScript | JavaScript |
|------------|------------|
| `.tsx`     | `.jsx`     |
| `.ts`      | `.js`      |

### 2.2 Remove TypeScript Configuration

**Delete these files:**
```bash
rm tsconfig.json
```

**Update vite.config.js:**
```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

### 2.3 Type Annotation Removal

**Before (TypeScript):**
```typescript
interface Employee {
  id: string;
  personalInfo: {
    firstName: string;
    lastName: string;
  };
  salaryInfo: {
    ctc: number;
    basic: number;
  };
}

const saveEmployee = async (employee: Employee): Promise<void> => {
  // implementation
};

const EmployeeName: React.FC<{ employee: Employee }> = ({ employee }) => {
  return <span>{employee.personalInfo.firstName}</span>;
};
```

**After (JavaScript with JSDoc):**
```javascript
/**
 * @typedef {Object} PersonalInfo
 * @property {string} firstName
 * @property {string} lastName
 */

/**
 * @typedef {Object} SalaryInfo
 * @property {number} ctc
 * @property {number} basic
 */

/**
 * @typedef {Object} Employee
 * @property {string} id
 * @property {PersonalInfo} personalInfo
 * @property {SalaryInfo} salaryInfo
 */

/**
 * Save an employee to the database
 * @param {Employee} employee - The employee to save
 * @returns {Promise<void>}
 */
const saveEmployee = async (employee) => {
  // implementation
};

/**
 * @param {Object} props
 * @param {Employee} props.employee
 */
const EmployeeName = ({ employee }) => {
  return <span>{employee.personalInfo.firstName}</span>;
};
```

### 2.4 PropTypes for Runtime Validation

Install PropTypes:
```bash
npm install prop-types
```

**Convert TypeScript interfaces to PropTypes:**
```javascript
// components/EmployeeCard.jsx
import PropTypes from 'prop-types';

const EmployeeCard = ({ employee, onEdit, onDelete }) => {
  return (
    <div className="employee-card">
      <h3>{employee.personalInfo.firstName} {employee.personalInfo.lastName}</h3>
      <p>CTC: ₹{employee.salaryInfo.ctc.toLocaleString()}</p>
      <button onClick={() => onEdit(employee)}>Edit</button>
      <button onClick={() => onDelete(employee.id)}>Delete</button>
    </div>
  );
};

EmployeeCard.propTypes = {
  employee: PropTypes.shape({
    id: PropTypes.string.isRequired,
    personalInfo: PropTypes.shape({
      firstName: PropTypes.string.isRequired,
      lastName: PropTypes.string.isRequired,
    }).isRequired,
    salaryInfo: PropTypes.shape({
      ctc: PropTypes.number.isRequired,
      basic: PropTypes.number.isRequired,
    }).isRequired,
  }).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default EmployeeCard;
```

### 2.5 Conversion Checklist

For each `.tsx`/`.ts` file:

- [ ] Rename to `.jsx`/`.js`
- [ ] Remove type annotations from function parameters
- [ ] Remove type annotations from return types
- [ ] Remove interface/type definitions
- [ ] Add JSDoc comments for documentation
- [ ] Add PropTypes for component props
- [ ] Remove generic type parameters (e.g., `useState<string>` → `useState`)
- [ ] Remove type assertions (e.g., `as string`)
- [ ] Update imports to use `.js` extensions if needed

---

## 3. Replacing storageService with API Calls

### 3.1 Create API Service

```javascript
// src/services/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;
        localStorage.setItem('accessToken', accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

### 3.2 Service Function Mapping

| storageService Function | API Service Function |
|------------------------|---------------------|
| `getEmployees()` | `api.get('/employees')` |
| `getEmployeeById(id)` | `api.get(`/employees/${id}`)` |
| `saveEmployee(employee)` | `api.post('/employees', employee)` or `api.put(`/employees/${id}`, employee)` |
| `deleteEmployee(id)` | `api.delete(`/employees/${id}`)` |
| `getDesignations()` | `api.get('/designations')` |
| `saveDesignation(designation)` | `api.post('/designations', designation)` |
| `getAttendanceRecords(month, year)` | `api.get('/attendances', { params: { month, year } })` |
| `saveAttendanceRecord(record)` | `api.post('/attendances', record)` |
| `generatePayRun(month, year)` | `api.post('/payruns/generate', { month, year })` |
| `getAdvanceRecords()` | `api.get('/advances')` |
| `saveAdvanceRecord(advance)` | `api.post('/advances', advance)` |
| `getLoanRecords()` | `api.get('/loans')` |
| `saveLoanRecord(loan)` | `api.post('/loans', loan)` |

### 3.3 Create Resource-Specific Services

```javascript
// src/services/employeeService.js
import api from './api';

export const employeeService = {
  /**
   * Get all employees with optional filters
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>}
   */
  getAll: async (params = {}) => {
    const response = await api.get('/employees', { params });
    return response.data;
  },

  /**
   * Get employee by ID
   * @param {string} id - Employee ID
   * @returns {Promise<Object>}
   */
  getById: async (id) => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },

  /**
   * Create a new employee
   * @param {Object} employeeData - Employee data
   * @returns {Promise<Object>}
   */
  create: async (employeeData) => {
    const response = await api.post('/employees', employeeData);
    return response.data;
  },

  /**
   * Update an employee
   * @param {string} id - Employee ID
   * @param {Object} employeeData - Updated employee data
   * @returns {Promise<Object>}
   */
  update: async (id, employeeData) => {
    const response = await api.put(`/employees/${id}`, employeeData);
    return response.data;
  },

  /**
   * Delete an employee
   * @param {string} id - Employee ID
   * @returns {Promise<void>}
   */
  delete: async (id) => {
    await api.delete(`/employees/${id}`);
  },

  /**
   * Get employee dashboard stats
   * @returns {Promise<Object>}
   */
  getStats: async () => {
    const response = await api.get('/employees/stats');
    return response.data;
  },
};

export default employeeService;
```

---

## 4. React Query Integration

### 4.1 Setup React Query

```bash
npm install @tanstack/react-query
```

```javascript
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

### 4.2 Create Custom Hooks

```javascript
// src/hooks/useEmployees.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeService } from '../services/employeeService';

// Query keys
export const employeeKeys = {
  all: ['employees'],
  lists: () => [...employeeKeys.all, 'list'],
  list: (filters) => [...employeeKeys.lists(), filters],
  details: () => [...employeeKeys.all, 'detail'],
  detail: (id) => [...employeeKeys.details(), id],
  stats: () => [...employeeKeys.all, 'stats'],
};

/**
 * Hook to fetch all employees
 * @param {Object} filters - Optional filters
 * @returns {Object} Query result
 */
export const useEmployees = (filters = {}) => {
  return useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () => employeeService.getAll(filters),
  });
};

/**
 * Hook to fetch a single employee
 * @param {string} id - Employee ID
 * @returns {Object} Query result
 */
export const useEmployee = (id) => {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => employeeService.getById(id),
    enabled: !!id,
  });
};

/**
 * Hook to fetch employee stats
 * @returns {Object} Query result
 */
export const useEmployeeStats = () => {
  return useQuery({
    queryKey: employeeKeys.stats(),
    queryFn: employeeService.getStats,
  });
};

/**
 * Hook to create an employee
 * @returns {Object} Mutation result
 */
export const useCreateEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: employeeService.create,
    onSuccess: () => {
      // Invalidate and refetch employees list
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.stats() });
    },
  });
};

/**
 * Hook to update an employee
 * @returns {Object} Mutation result
 */
export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => employeeService.update(id, data),
    onSuccess: (data, variables) => {
      // Update the specific employee in cache
      queryClient.setQueryData(employeeKeys.detail(variables.id), data);
      // Invalidate the list
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};

/**
 * Hook to delete an employee
 * @returns {Object} Mutation result
 */
export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: employeeService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: employeeKeys.stats() });
    },
  });
};
```

### 4.3 Using Hooks in Components

**Before (with storageService):**
```javascript
// Old approach
import { useEffect, useState } from 'react';
import { getEmployees } from '../services/storageService';

const EmployeesPage = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const data = await getEmployees();
        setEmployees(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {employees.map(emp => (
        <div key={emp.id}>{emp.personalInfo.firstName}</div>
      ))}
    </div>
  );
};
```

**After (with React Query):**
```javascript
// New approach
import { useEmployees, useDeleteEmployee } from '../hooks/useEmployees';
import { useAppContext } from '../contexts/AppContext';

const EmployeesPage = () => {
  const { showToast } = useAppContext();
  const { data, isLoading, isError, error } = useEmployees();
  const deleteEmployee = useDeleteEmployee();

  const handleDelete = async (id) => {
    try {
      await deleteEmployee.mutateAsync(id);
      showToast('Employee deleted successfully', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  const employees = data?.data || [];

  return (
    <div>
      {employees.map(emp => (
        <div key={emp._id}>
          {emp.personalInfo.firstName}
          <button 
            onClick={() => handleDelete(emp._id)}
            disabled={deleteEmployee.isPending}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

export default EmployeesPage;
```

---

## 5. Authentication Integration

### 5.1 Auth Context

```javascript
// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.data);
        } catch (error) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: userData } = response.data.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore errors on logout
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  }, []);

  const register = useCallback(async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    register,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

### 5.2 Protected Route Component

```javascript
// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredRoles: PropTypes.arrayOf(PropTypes.string),
};

export default ProtectedRoute;
```

### 5.3 Updated App with Routing

```javascript
// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { AppContextProvider } from './contexts/AppContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import NewEmployeePage from './pages/NewEmployeePage';
import PayrollPage from './pages/PayrollPage';
import AttendanceRegisterPage from './pages/AttendanceRegisterPage';
import AdvanceRegisterPage from './pages/AdvanceRegisterPage';
import LoanRegisterPage from './pages/LoanRegisterPage';
import SettingsPage from './pages/SettingsPage';

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContextProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="employees/new" element={<NewEmployeePage />} />
                <Route path="employees/:id/edit" element={<NewEmployeePage />} />
                <Route path="payroll" element={<PayrollPage />} />
                <Route path="attendance" element={<AttendanceRegisterPage />} />
                <Route path="advances" element={<AdvanceRegisterPage />} />
                <Route path="loans" element={<LoanRegisterPage />} />
                <Route 
                  path="settings" 
                  element={
                    <ProtectedRoute requiredRoles={['admin']}>
                      <SettingsPage />
                    </ProtectedRoute>
                  } 
                />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AppContextProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
```

---

## 6. File-by-File Migration

### 6.1 Migration Order

Follow this order to minimize breaking changes:

1. **Core services and utilities** (no dependencies on other files)
   - `utils/constants.js`
   - `utils/helpers.js`
   - `services/api.js`

2. **Context providers**
   - `contexts/AuthContext.jsx`
   - `contexts/AppContext.jsx`

3. **Custom hooks**
   - `hooks/useEmployees.js`
   - `hooks/useDesignations.js`
   - `hooks/usePayroll.js`
   - etc.

4. **UI components** (leaf components first)
   - `components/ui/Button.jsx`
   - `components/ui/Input.jsx`
   - `components/ui/Toast.jsx`
   - etc.

5. **Layout components**
   - `components/layout/Navbar.jsx`
   - `components/layout/Sidebar.jsx`
   - `components/layout/MainLayout.jsx`

6. **Page components** (most complex, last)
   - `pages/LoginPage.jsx`
   - `pages/DashboardPage.jsx`
   - `pages/EmployeesPage.jsx`
   - etc.

7. **Entry points**
   - `App.jsx`
   - `main.jsx`

### 6.2 Example Migration: EmployeesPage

**Before (TypeScript):**
```typescript
// pages/EmployeesPage.tsx
import React, { useState, useEffect } from 'react';
import { getEmployees, deleteEmployee } from '../services/storageService';
import { Employee } from '../types';
import { useAppContext } from '../contexts/AppContext';

const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast, setActivePage } = useAppContext();

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async (): Promise<void> => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (error) {
      showToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (confirm('Are you sure?')) {
      await deleteEmployee(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
      showToast('Employee deleted', 'success');
    }
  };

  // ... rest of component
};

export default EmployeesPage;
```

**After (JavaScript):**
```javascript
// pages/EmployeesPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployees, useDeleteEmployee } from '../hooks/useEmployees';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/ui/Button';

/**
 * Employees listing page with CRUD operations
 */
const EmployeesPage = () => {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  
  // React Query hooks
  const { 
    data, 
    isLoading, 
    isError, 
    error 
  } = useEmployees({ search: searchTerm });
  
  const deleteEmployee = useDeleteEmployee();

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      try {
        await deleteEmployee.mutateAsync(id);
        showToast('Employee deleted successfully', 'success');
      } catch (err) {
        showToast(err.response?.data?.message || 'Failed to delete', 'error');
      }
    }
  };

  const handleEdit = (id) => {
    navigate(`/employees/${id}/edit`);
  };

  const handleAddNew = () => {
    navigate('/employees/new');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-red-500 py-8">
        Error: {error.message}
      </div>
    );
  }

  const employees = data?.data || [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Button onClick={handleAddNew}>Add Employee</Button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-lg"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Employee ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Designation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {employee.employeeId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {employee.personalInfo.firstName} {employee.personalInfo.lastName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {employee.employmentDetails.department?.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {employee.employmentDetails.designation?.title || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  <button
                    onClick={() => handleEdit(employee._id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(employee._id)}
                    disabled={deleteEmployee.isPending}
                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {employees.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No employees found
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;
```

---

## 7. Testing the Migration

### 7.1 Manual Testing Checklist

- [ ] Login/Logout works correctly
- [ ] Token refresh works (wait 15+ minutes or force expire)
- [ ] Employee CRUD operations work
- [ ] Designation CRUD operations work
- [ ] Attendance recording works
- [ ] Pay run generation works
- [ ] Advance recording works
- [ ] Loan management works
- [ ] Error messages display correctly
- [ ] Loading states show correctly
- [ ] Navigation works properly
- [ ] Protected routes redirect correctly

### 7.2 API Integration Tests

```javascript
// src/__tests__/integration/employeeApi.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import api from '../../services/api';

describe('Employee API Integration', () => {
  let authToken;
  let createdEmployeeId;

  beforeAll(async () => {
    // Login to get token
    const response = await api.post('/auth/login', {
      email: 'admin@ecovale.com',
      password: 'admin123',
    });
    authToken = response.data.data.accessToken;
  });

  it('should fetch employees list', async () => {
    const response = await api.get('/employees');
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('data');
    expect(Array.isArray(response.data.data)).toBe(true);
  });

  it('should create a new employee', async () => {
    const newEmployee = {
      personalInfo: {
        firstName: 'Test',
        lastName: 'User',
        gender: 'Male',
        contactNumber: '9876543210',
        personalEmail: 'test@example.com',
        currentAddress: '123 Test Street',
      },
      employmentDetails: {
        type: 'full-time',
        department: 'IT',
        designation: 'Developer',
        workLocation: 'Bangalore',
      },
      salaryInfo: {
        ctc: 600000,
        hraPercentage: 40,
        paymentMode: 'Bank',
      },
    };

    const response = await api.post('/employees', newEmployee);
    expect(response.status).toBe(201);
    expect(response.data.data).toHaveProperty('_id');
    createdEmployeeId = response.data.data._id;
  });

  it('should update the employee', async () => {
    const response = await api.put(`/employees/${createdEmployeeId}`, {
      personalInfo: {
        firstName: 'Updated',
        lastName: 'User',
      },
    });
    expect(response.status).toBe(200);
    expect(response.data.data.personalInfo.firstName).toBe('Updated');
  });

  it('should delete the employee', async () => {
    const response = await api.delete(`/employees/${createdEmployeeId}`);
    expect(response.status).toBe(200);
  });

  afterAll(async () => {
    // Cleanup if needed
  });
});
```

### 7.3 Component Tests with React Testing Library

```javascript
// src/__tests__/components/EmployeesPage.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import EmployeesPage from '../../pages/EmployeesPage';
import { AppContextProvider } from '../../contexts/AppContext';

// Mock the API
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        data: [
          {
            _id: '1',
            employeeId: '1',
            personalInfo: { firstName: 'John', lastName: 'Doe' },
            employmentDetails: { 
              department: { name: 'IT' },
              designation: { title: 'Developer' }
            },
          },
        ],
      },
    }),
  },
}));

const renderWithProviders = (component) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContextProvider>
          {component}
        </AppContextProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('EmployeesPage', () => {
  it('renders loading state initially', () => {
    renderWithProviders(<EmployeesPage />);
    // Check for loading indicator
  });

  it('renders employees list after loading', async () => {
    renderWithProviders(<EmployeesPage />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('filters employees by search term', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmployeesPage />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'John');

    // Verify search functionality
  });
});
```

---

## Summary

The migration involves:

1. **Converting TypeScript to JavaScript** - Remove type annotations, add JSDoc and PropTypes
2. **Replacing storageService** - Create API service with Axios and proper interceptors
3. **Adding React Query** - Replace useState/useEffect patterns with React Query hooks
4. **Integrating authentication** - Add AuthContext and protected routes
5. **Updating routing** - Replace page-based navigation with React Router
6. **Testing** - Verify all functionality works with the new backend

Follow the file-by-file migration order to minimize breaking changes during the transition.
