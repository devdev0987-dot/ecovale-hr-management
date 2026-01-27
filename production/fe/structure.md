# Frontend Directory Structure

This document provides a detailed breakdown of every file and folder in the frontend (`fe/`) directory.

---

## Complete Structure

```
fe/
├── .env                          # Environment variables (not in git)
├── .env.example                  # Environment template
├── .eslintrc.cjs                 # ESLint configuration
├── .gitignore                    # Git ignore rules
├── Dockerfile                    # Production Docker configuration
├── Dockerfile.dev                # Development Docker configuration
├── nginx.conf                    # Nginx configuration for production
├── index.html                    # HTML entry point
├── package.json                  # Dependencies and scripts
├── package-lock.json             # Dependency lock file
├── README.md                     # Frontend documentation
├── vite.config.js                # Vite configuration
│
├── public/                       # Static assets (copied as-is)
│   ├── favicon.ico               # Browser favicon
│   └── ecovale-logo.png          # Company logo
│
├── src/                          # Source code
│   ├── main.jsx                  # Application entry point
│   ├── App.jsx                   # Root component with routing
│   ├── index.css                 # Global styles
│   │
│   ├── assets/                   # Processed assets
│   │   └── images/               # Image assets
│   │
│   ├── components/               # Reusable components
│   │   ├── layout/               # Layout components
│   │   │   ├── MainLayout.jsx    # Main app layout with sidebar
│   │   │   ├── Navbar.jsx        # Top navigation bar
│   │   │   └── Sidebar.jsx       # Side navigation menu
│   │   │
│   │   ├── ui/                   # UI primitives
│   │   │   ├── Button.jsx        # Button component
│   │   │   ├── Input.jsx         # Input component
│   │   │   ├── Select.jsx        # Select dropdown
│   │   │   ├── Modal.jsx         # Modal dialog
│   │   │   ├── Toast.jsx         # Toast notifications
│   │   │   ├── Table.jsx         # Data table
│   │   │   ├── Card.jsx          # Card container
│   │   │   ├── Spinner.jsx       # Loading spinner
│   │   │   └── ErrorBoundary.jsx # Error boundary
│   │   │
│   │   ├── forms/                # Form components
│   │   │   ├── EmployeeForm.jsx  # Employee add/edit form
│   │   │   ├── AttendanceForm.jsx
│   │   │   ├── AdvanceForm.jsx
│   │   │   ├── LoanForm.jsx
│   │   │   └── FormField.jsx     # Reusable form field wrapper
│   │   │
│   │   └── common/               # Common feature components
│   │       ├── ProtectedRoute.jsx    # Auth route wrapper
│   │       ├── EmployeeCard.jsx
│   │       ├── SalaryBreakdown.jsx
│   │       ├── AttendanceTable.jsx
│   │       └── PayslipPreview.jsx
│   │
│   ├── contexts/                 # React context providers
│   │   ├── AuthContext.jsx       # Authentication state
│   │   └── AppContext.jsx        # Global app state (toasts, etc.)
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.js            # Authentication hook
│   │   ├── useEmployees.js       # Employee data hooks
│   │   ├── useDepartments.js     # Department data hooks
│   │   ├── useDesignations.js    # Designation data hooks
│   │   ├── useAttendance.js      # Attendance data hooks
│   │   ├── usePayroll.js         # Payroll data hooks
│   │   ├── useAdvances.js        # Advance data hooks
│   │   ├── useLoans.js           # Loan data hooks
│   │   ├── useLocalStorage.js    # LocalStorage hook
│   │   └── useDebounce.js        # Debounce hook
│   │
│   ├── pages/                    # Page components
│   │   ├── LoginPage.jsx         # Login page
│   │   ├── DashboardPage.jsx     # Dashboard with stats
│   │   ├── EmployeesPage.jsx     # Employee list
│   │   ├── NewEmployeePage.jsx   # Add/edit employee
│   │   ├── EmployeeDetailPage.jsx # Employee details
│   │   ├── DesignationsPage.jsx  # Designation management
│   │   ├── AttendanceRegisterPage.jsx
│   │   ├── PayrollPage.jsx       # Payroll overview
│   │   ├── PayRunPage.jsx        # Generate pay run
│   │   ├── PayslipPage.jsx       # View/print payslip
│   │   ├── AdvanceRegisterPage.jsx
│   │   ├── LoanRegisterPage.jsx
│   │   ├── CalculatorPage.jsx    # Salary calculator
│   │   ├── LettersPage.jsx       # HR letters
│   │   ├── DocumentsPage.jsx     # Document management
│   │   ├── CareerPage.jsx        # Career/promotions
│   │   ├── SettingsPage.jsx      # App settings
│   │   └── NotFoundPage.jsx      # 404 page
│   │
│   ├── services/                 # API service layer
│   │   ├── api.js                # Axios instance with interceptors
│   │   ├── authService.js        # Authentication API calls
│   │   ├── employeeService.js    # Employee API calls
│   │   ├── departmentService.js
│   │   ├── designationService.js
│   │   ├── attendanceService.js
│   │   ├── payrunService.js
│   │   ├── advanceService.js
│   │   ├── loanService.js
│   │   └── calculatorService.js
│   │
│   └── utils/                    # Utility functions
│       ├── constants.js          # App constants
│       ├── helpers.js            # Helper functions
│       ├── formatters.js         # Data formatting (currency, dates)
│       └── validators.js         # Form validation helpers
│
├── tests/                        # Test files
│   ├── setup.js                  # Test setup
│   ├── mocks/                    # Mock data and handlers
│   │   ├── handlers.js           # MSW handlers
│   │   └── server.js             # MSW server
│   ├── components/               # Component tests
│   │   ├── Button.test.jsx
│   │   └── EmployeeCard.test.jsx
│   └── pages/                    # Page tests
│       ├── LoginPage.test.jsx
│       └── EmployeesPage.test.jsx
│
└── dist/                         # Production build (not in git)
    ├── index.html
    └── assets/
        ├── index-[hash].js
        └── index-[hash].css
```

---

## File Descriptions

### Root Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables (VITE_API_URL, etc.) |
| `.env.example` | Template for environment variables |
| `index.html` | HTML template, Vite entry point |
| `vite.config.js` | Vite build configuration |
| `package.json` | NPM dependencies and scripts |
| `nginx.conf` | Nginx config for Docker production |

---

### src/main.jsx

Application entry point that sets up providers.

```javascript
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

---

### src/App.jsx

Root component with routing configuration.

```javascript
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppContextProvider } from './contexts/AppContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
// ... more imports

const App = () => {
  return (
    <AuthProvider>
      <AppContextProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              {/* ... more routes */}
            </Route>
          </Routes>
        </BrowserRouter>
      </AppContextProvider>
    </AuthProvider>
  );
};

export default App;
```

---

### src/components/

Reusable components organized by category.

#### Layout Components

```javascript
// components/layout/MainLayout.jsx
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ErrorBoundary from '../ui/ErrorBoundary';

const MainLayout = () => {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-auto p-6 bg-gray-100">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
```

#### UI Components

```javascript
// components/ui/Button.jsx
import PropTypes from 'prop-types';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
}) => {
  const baseStyles = 'font-medium rounded-lg transition-colors';
  
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading ? <span>Loading...</span> : children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string,
};

export default Button;
```

---

### src/contexts/

React context for global state management.

```javascript
// contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch {
          localStorage.removeItem('accessToken');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

### src/hooks/

Custom React hooks for data fetching with React Query.

```javascript
// hooks/useEmployees.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import employeeService from '../services/employeeService';

export const employeeKeys = {
  all: ['employees'],
  lists: () => [...employeeKeys.all, 'list'],
  list: (filters) => [...employeeKeys.lists(), filters],
  details: () => [...employeeKeys.all, 'detail'],
  detail: (id) => [...employeeKeys.details(), id],
};

export const useEmployees = (filters = {}) => {
  return useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () => employeeService.getAll(filters),
  });
};

export const useEmployee = (id) => {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => employeeService.getById(id),
    enabled: !!id,
  });
};

export const useCreateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeeService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => employeeService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};

export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeeService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};
```

---

### src/pages/

Full page components for each route.

```javascript
// pages/EmployeesPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployees, useDeleteEmployee } from '../hooks/useEmployees';
import { useAppContext } from '../contexts/AppContext';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import Spinner from '../components/ui/Spinner';

const EmployeesPage = () => {
  const navigate = useNavigate();
  const { showToast } = useAppContext();
  const [search, setSearch] = useState('');
  
  const { data, isLoading, isError, error } = useEmployees({ search });
  const deleteEmployee = useDeleteEmployee();

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await deleteEmployee.mutateAsync(id);
        showToast('Employee deleted', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  if (isLoading) return <Spinner />;
  if (isError) return <div>Error: {error.message}</div>;

  const employees = data?.data || [];

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Button onClick={() => navigate('/employees/new')}>
          Add Employee
        </Button>
      </div>
      
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 px-4 py-2 border rounded"
      />
      
      <Table
        columns={[
          { header: 'ID', accessor: 'employeeId' },
          { header: 'Name', accessor: (row) => `${row.personalInfo.firstName} ${row.personalInfo.lastName}` },
          { header: 'Department', accessor: 'employmentDetails.department.name' },
          { header: 'Actions', cell: (row) => (
            <>
              <Button size="sm" onClick={() => navigate(`/employees/${row._id}/edit`)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => handleDelete(row._id)}>Delete</Button>
            </>
          )},
        ]}
        data={employees}
      />
    </div>
  );
};

export default EmployeesPage;
```

---

### src/services/

API service layer using Axios.

```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token refresh logic
    }
    return Promise.reject(error);
  }
);

export default api;
```

```javascript
// services/employeeService.js
import api from './api';

const employeeService = {
  getAll: async (params = {}) => {
    const response = await api.get('/employees', { params });
    return response.data;
  },
  
  getById: async (id) => {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },
  
  create: async (data) => {
    const response = await api.post('/employees', data);
    return response.data;
  },
  
  update: async (id, data) => {
    const response = await api.put(`/employees/${id}`, data);
    return response.data;
  },
  
  delete: async (id) => {
    await api.delete(`/employees/${id}`);
  },
};

export default employeeService;
```

---

### src/utils/

Utility functions and constants.

```javascript
// utils/constants.js
export const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Sales', 'Marketing'];
export const WORK_LOCATIONS = ['Bangalore', 'Mangaluru', 'Mysore', 'Belagaum', 'Remote'];
export const EMPLOYMENT_TYPES = ['full-time', 'part-time'];
export const PAYMENT_MODES = ['Bank', 'Cash', 'Cheque'];
```

```javascript
// utils/formatters.js
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};
```

---

## Component Architecture

```
App
├── AuthProvider
│   └── AppContextProvider
│       └── BrowserRouter
│           └── Routes
│               ├── LoginPage
│               └── ProtectedRoute
│                   └── MainLayout
│                       ├── Navbar
│                       ├── Sidebar
│                       └── Outlet (Page Components)
│                           ├── DashboardPage
│                           ├── EmployeesPage
│                           ├── NewEmployeePage
│                           └── ...
```

---

## Data Flow

```
User Interaction
      │
      ▼
Page Component
      │
      ├─── useXxx Hook (React Query)
      │         │
      │         ▼
      │    xxxService (Axios)
      │         │
      │         ▼
      │    Backend API
      │
      └─── UI Update (React State)
```
