# Development Steps - EcoVale HR

## Overview

This document provides a step-by-step guide to implement the EcoVale HR full-stack application. Follow these phases in order for best results.

---

## Phase 1: Backend Foundation (Week 1)

### Step 1.1: Initialize Backend Project

```bash
# Create backend directory
mkdir -p production/be
cd production/be

# Initialize npm project
npm init -y

# Install dependencies
npm install express mongoose dotenv cors helmet morgan bcryptjs jsonwebtoken express-validator multer

# Install dev dependencies
npm install -D nodemon jest supertest
```

### Step 1.2: Create Folder Structure

```bash
mkdir -p src/{config,controllers,models,views,routes,middleware,services,utils}
mkdir -p tests/{unit,integration,fixtures}
touch src/app.js server.js .env.example
```

Expected structure:
```
be/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── views/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── utils/
│   └── app.js
├── tests/
├── .env.example
├── package.json
└── server.js
```

### Step 1.3: Configure Environment Variables

Create `.env.example`:
```env
# Server
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/ecovale_hr

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# File Upload
MAX_FILE_SIZE=5242880
```

### Step 1.4: Create Database Configuration

Create `src/config/database.js`:
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 8+ doesn't need these options
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### Step 1.5: Create Constants Configuration

Create `src/config/constants.js`:
```javascript
// Salary calculation constants (from frontend utils/constants.ts)
module.exports = {
  // Departments
  DEPARTMENTS: ['IT', 'HR', 'Finance', 'Sales', 'Marketing'],
  
  // Work locations
  WORK_LOCATIONS: [
    'Bangalore', 'Mangaluru', 'Mysore', 'Belagaum',
    'Hubballi', 'Kolar', 'Tumkur', 'Shivamogga', 'Remote'
  ],
  
  // Genders
  GENDERS: ['Male', 'Female', 'Other'],
  
  // Employee types
  EMPLOYEE_TYPES: ['full-time', 'part-time'],
  
  // Payment modes
  PAYMENT_MODES: ['Bank', 'Cash', 'Cheque'],
  
  // Grades
  GRADES: ['A', 'B', 'C', 'D'],
  
  // Statuses
  STATUSES: ['active', 'inactive'],
  
  // Salary configuration
  BASIC_PCT_OF_CTC: 0.50,           // 50% of CTC
  PF_WAGE_CEILING_MONTHLY: 15000,
  PF_EMPLOYEE_RATE: 0.12,           // 12%
  PF_EMPLOYER_RATE: 0.12,           // 12%
  ESI_EMPLOYEE_RATE: 0.0075,        // 0.75%
  ESI_EMPLOYER_RATE: 0.0325,        // 3.25%
  ESI_WAGE_CEILING_MONTHLY: 21000,
  EMPLOYEE_HEALTH_INSURANCE_ANNUAL: 1000,
  GRATUITY_RATE_ANNUAL: 0.0481,     // ~4.81%
  
  // Months
  MONTHS: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
};
```

### Step 1.6: Create Express App

Create `src/app.js`:
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import routes
const routes = require('./routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
```

### Step 1.7: Create Server Entry Point

Create `server.js`:
```javascript
require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');

const PORT = process.env.PORT || 5000;

// Connect to database then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  process.exit(1);
});
```

### Step 1.8: Update package.json Scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

---

## Phase 2: Authentication (Week 1-2)

### Step 2.1: Create User Model

Create `src/models/User.js` (as specified in data-modeling.md)

### Step 2.2: Create Auth Service

Create `src/services/authService.js`:
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class AuthService {
  /**
   * Generate JWT tokens
   */
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
    
    const refreshToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );
    
    return { accessToken, refreshToken };
  }
  
  /**
   * Verify password and return user with tokens
   */
  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }
    
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    const tokens = this.generateTokens(user._id);
    
    return {
      ...tokens,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    };
  }
  
  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }
      
      const accessToken = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
      );
      
      return { accessToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
  
  /**
   * Get user by ID
   */
  async getUserById(userId) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }
}

module.exports = new AuthService();
```

### Step 2.3: Create Auth Controller

Create `src/controllers/authController.js`:
```javascript
const authService = require('../services/authService');

/**
 * Login user
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    const result = await authService.login(email, password);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: result.user
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Refresh token
 * POST /api/v1/auth/refresh
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }
    
    const result = await authService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: 3600
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Get current user
 * GET /api/v1/auth/me
 */
async function getMe(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.id);
    
    res.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
async function logout(req, res, next) {
  // With JWT, logout is handled client-side by removing tokens
  // Optionally, implement token blacklisting here
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}

module.exports = {
  login,
  refresh,
  getMe,
  logout
};
```

### Step 2.4: Create Auth Middleware

Create `src/middleware/auth.js`:
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authenticate JWT token
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }
    
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    next(error);
  }
}

/**
 * Authorize specific roles
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource'
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
```

### Step 2.5: Create Auth Routes

Create `src/routes/authRoutes.js`:
```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
```

### Step 2.6: Create Error Handler

Create `src/middleware/errorHandler.js`:
```javascript
/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  // Custom application error with statusCode
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }
  
  // Default server error
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error'
  });
}

module.exports = errorHandler;
```

### Step 2.7: Create Routes Index

Create `src/routes/index.js`:
```javascript
const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
// Add more routes as they're created
// const employeeRoutes = require('./employeeRoutes');

router.use('/auth', authRoutes);
// router.use('/employees', employeeRoutes);

module.exports = router;
```

### Step 2.8: Seed Initial Admin User

Create `src/utils/seedAdmin.js`:
```javascript
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const existingAdmin = await User.findOne({ email: 'admin@ecovale.com' });
    
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }
    
    const admin = await User.create({
      email: 'admin@ecovale.com',
      password: 'admin123',  // Will be hashed by pre-save hook
      fullName: 'Admin User',
      role: 'admin',
      isActive: true
    });
    
    console.log('Admin user created:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();
```

Add script to package.json:
```json
{
  "scripts": {
    "seed:admin": "node src/utils/seedAdmin.js"
  }
}
```

---

## Phase 3: Core Entities (Week 2-3)

### Step 3.1: Create Department Model and API
- Create `src/models/Department.js`
- Create `src/services/departmentService.js`
- Create `src/controllers/departmentController.js`
- Create `src/views/departmentView.js`
- Create `src/routes/departmentRoutes.js`
- Seed departments

### Step 3.2: Create Designation Model and API
- Create `src/models/Designation.js`
- Create `src/services/designationService.js`
- Create `src/controllers/designationController.js`
- Create `src/routes/designationRoutes.js`

### Step 3.3: Create Employee Model and API
- Create `src/models/Employee.js` (with all embedded schemas)
- Create `src/services/employeeService.js`
- Create `src/services/salaryService.js` (port from helpers.ts)
- Create `src/controllers/employeeController.js`
- Create `src/views/employeeView.js`
- Create `src/routes/employeeRoutes.js`
- Create file upload middleware

---

## Phase 4: Payroll Features (Week 3-4)

### Step 4.1: Create Attendance Model and API
- Create `src/models/Attendance.js`
- Create `src/services/attendanceService.js`
- Create `src/controllers/attendanceController.js`
- Create `src/routes/attendanceRoutes.js`

### Step 4.2: Create Advance Model and API
- Create `src/models/Advance.js`
- Create `src/services/advanceService.js`
- Create `src/controllers/advanceController.js`
- Create `src/routes/advanceRoutes.js`

### Step 4.3: Create Loan Model and API
- Create `src/models/Loan.js`
- Create `src/models/LoanEMI.js`
- Create `src/services/loanService.js`
- Create `src/controllers/loanController.js`
- Create `src/routes/loanRoutes.js`

### Step 4.4: Create PayRun Model and API
- Create `src/models/PayRun.js`
- Create `src/models/PayRunRecord.js`
- Create `src/services/payrunService.js` (port logic from storageService.ts)
- Create `src/controllers/payrunController.js`
- Create `src/routes/payrunRoutes.js`

---

## Phase 5: Frontend Setup (Week 5)

### Step 5.1: Initialize Frontend Project

```bash
mkdir -p production/fe
cd production/fe

# Create Vite React project (JavaScript)
npm create vite@latest . -- --template react

# Install dependencies
npm install axios @tanstack/react-query react-router-dom lucide-react

# Install dev dependencies
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init -p
```

### Step 5.2: Configure Tailwind

Update `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Update `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 5.3: Create API Service

Create `src/services/api.js`:
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
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

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (refreshToken) {
          const response = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );
          
          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### Step 5.4: Create Auth Context

Create `src/context/AuthContext.jsx`:
```javascript
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  async function checkAuth() {
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
  }
  
  async function login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: userData } = response.data.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(userData);
    
    return userData;
  }
  
  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  }
  
  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Step 5.5: Set Up React Router

Create `src/App.jsx`:
```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmployeeList from './pages/Employees/EmployeeList';
import EmployeeForm from './pages/Employees/EmployeeForm';
// ... more imports

const queryClient = new QueryClient();

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="employees" element={<EmployeeList />} />
              <Route path="employees/new" element={<EmployeeForm />} />
              <Route path="employees/:id/edit" element={<EmployeeForm />} />
              {/* ... more routes */}
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
```

---

## Phase 6: Frontend Migration (Week 5-6)

### Step 6.1: Convert Components
- Convert `.tsx` files to `.jsx`
- Remove TypeScript type annotations
- Add PropTypes for component props
- Replace `React.FC` with regular function components

### Step 6.2: Replace Storage Service
- Replace `storageService` calls with API service calls
- Use React Query for data fetching
- Implement optimistic updates

### Step 6.3: Update State Management
- Replace `activePage` context with React Router
- Keep toast notifications in AppContext
- Use React Query for server state

---

## Phase 7: Testing (Week 7)

### Step 7.1: Backend Unit Tests
- Test services (salaryService, authService)
- Test models (validation, hooks)
- Test utilities

### Step 7.2: Backend Integration Tests
- Test API endpoints
- Test authentication flow
- Test payroll calculation

### Step 7.3: Frontend Tests
- Component rendering tests
- User interaction tests
- Integration with API

---

## Phase 8: Deployment (Week 8)

### Step 8.1: Docker Setup
- Create Dockerfile for backend
- Create Dockerfile for frontend
- Create docker-compose.yml

### Step 8.2: Cloud Deployment
- Set up MongoDB Atlas
- Deploy backend to Railway/Render/AWS
- Deploy frontend to Vercel/Netlify

### Step 8.3: CI/CD
- GitHub Actions for testing
- Automated deployment on merge

---

## Verification Checklist

After each phase, verify:

### Phase 1-2 (Backend Foundation)
- [ ] Server starts without errors
- [ ] MongoDB connection successful
- [ ] Login API returns JWT tokens
- [ ] Protected routes require authentication
- [ ] Admin user can be seeded

### Phase 3 (Core Entities)
- [ ] Departments API working
- [ ] Designations API working
- [ ] Employee CRUD operations working
- [ ] Salary calculations correct
- [ ] File uploads working

### Phase 4 (Payroll)
- [ ] Attendance records saved correctly
- [ ] Advances deducted in pay run
- [ ] Loans with EMI schedule working
- [ ] Pay run generation correct
- [ ] CSV export working

### Phase 5-6 (Frontend)
- [ ] Login/logout flow working
- [ ] All pages rendering
- [ ] Data fetching with React Query
- [ ] Forms submitting correctly
- [ ] Error handling in place

### Phase 7-8 (Testing & Deployment)
- [ ] All tests passing
- [ ] Docker containers building
- [ ] Production deployment successful
- [ ] Health checks passing
