# System Architecture - EcoVale HR

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    React SPA (Vite Build)                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  Pages   │  │Components│  │  Hooks   │  │ Context/State    │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │  │
│  │       └─────────────┴─────────────┴─────────────────┘             │  │
│  │                              ↓                                     │  │
│  │                    API Service Layer                               │  │
│  │                    (Axios + React Query)                           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS (REST API)
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                              SERVER TIER                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Express.js Application                          │  │
│  │                                                                    │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                      MIDDLEWARE LAYER                         │ │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │  │
│  │  │  │  CORS   │ │ Helmet  │ │ Morgan  │ │  Auth   │ │Validator│ │ │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │                              ↓                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                       ROUTES LAYER                            │ │  │
│  │  │  /api/auth  /api/employees  /api/payroll  /api/attendance    │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │                              ↓                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                    CONTROLLER LAYER (C)                       │ │  │
│  │  │  AuthController  EmployeeController  PayrollController  ...   │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │                              ↓                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                      SERVICE LAYER                            │ │  │
│  │  │  AuthService  EmployeeService  PayrollService  SalaryCalc    │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │                              ↓                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                       MODEL LAYER (M)                         │ │  │
│  │  │  User  Employee  Department  Designation  Attendance  PayRun │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  │                              ↓                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐ │  │
│  │  │                       VIEW LAYER (V)                          │ │  │
│  │  │           JSON Response Formatters / Transformers             │ │  │
│  │  └──────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Mongoose ODM
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                              DATA TIER                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         MongoDB Database                           │  │
│  │                                                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │  │
│  │  │    users    │  │  employees  │  │ departments │               │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │  │
│  │  │designations │  │ attendance  │  │   payruns   │               │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │  │
│  │  │  advances   │  │    loans    │  │  documents  │               │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MVC Architecture Pattern

### 2.1 Model Layer
**Purpose**: Data structure, business entities, database operations

```javascript
// models/Employee.js
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  personalInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    // ... more fields
  },
  employmentDetails: {
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
    // ... more fields
  },
  salaryInfo: {
    ctc: { type: Number, required: true },
    // ... more fields
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
```

### 2.2 View Layer
**Purpose**: Response formatting and transformation (JSON for REST API)

```javascript
// views/employeeView.js

/**
 * Format employee for list response
 * @param {Object} employee - Mongoose employee document
 * @returns {Object} Formatted employee
 */
function formatEmployeeList(employee) {
  return {
    id: employee._id,
    name: `${employee.personalInfo.firstName} ${employee.personalInfo.lastName}`,
    email: employee.employmentDetails.officialEmail,
    department: employee.employmentDetails.department?.name,
    designation: employee.employmentDetails.designation?.title,
    status: employee.status,
    joinDate: employee.employmentDetails.joinDate
  };
}

/**
 * Format employee for detail response
 * @param {Object} employee - Mongoose employee document
 * @returns {Object} Formatted employee with all details
 */
function formatEmployeeDetail(employee) {
  return {
    id: employee._id,
    personalInfo: { /* formatted personal info */ },
    employmentDetails: { /* formatted employment details */ },
    salaryInfo: { /* formatted salary info */ },
    documents: employee.documents,
    careerHistory: employee.careerHistory,
    status: employee.status,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt
  };
}

module.exports = { formatEmployeeList, formatEmployeeDetail };
```

### 2.3 Controller Layer
**Purpose**: Handle HTTP requests, coordinate between services and views

```javascript
// controllers/employeeController.js
const employeeService = require('../services/employeeService');
const employeeView = require('../views/employeeView');

/**
 * Get all employees
 * @route GET /api/employees
 */
async function getEmployees(req, res, next) {
  try {
    const { status, department, page = 1, limit = 50 } = req.query;
    
    const employees = await employeeService.getEmployees({
      status,
      department,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    const formatted = employees.data.map(employeeView.formatEmployeeList);
    
    res.json({
      success: true,
      data: formatted,
      pagination: employees.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create new employee
 * @route POST /api/employees
 */
async function createEmployee(req, res, next) {
  try {
    const employee = await employeeService.createEmployee(req.body);
    const formatted = employeeView.formatEmployeeDetail(employee);
    
    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: formatted
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getEmployees, createEmployee, /* ... */ };
```

---

## 3. Backend Folder Structure

```
be/
├── src/
│   ├── config/
│   │   ├── database.js           # MongoDB connection
│   │   ├── constants.js          # App constants (PF rates, etc.)
│   │   └── index.js              # Configuration aggregator
│   │
│   ├── controllers/              # Controller Layer (C)
│   │   ├── authController.js
│   │   ├── employeeController.js
│   │   ├── departmentController.js
│   │   ├── designationController.js
│   │   ├── attendanceController.js
│   │   ├── payrunController.js
│   │   ├── advanceController.js
│   │   ├── loanController.js
│   │   └── documentController.js
│   │
│   ├── models/                   # Model Layer (M)
│   │   ├── User.js
│   │   ├── Employee.js
│   │   ├── Department.js
│   │   ├── Designation.js
│   │   ├── Attendance.js
│   │   ├── PayRun.js
│   │   ├── Advance.js
│   │   ├── Loan.js
│   │   └── Document.js
│   │
│   ├── views/                    # View Layer (V)
│   │   ├── authView.js
│   │   ├── employeeView.js
│   │   ├── payrollView.js
│   │   └── responseView.js       # Generic response formatter
│   │
│   ├── routes/
│   │   ├── index.js              # Route aggregator
│   │   ├── authRoutes.js
│   │   ├── employeeRoutes.js
│   │   ├── departmentRoutes.js
│   │   ├── designationRoutes.js
│   │   ├── attendanceRoutes.js
│   │   ├── payrunRoutes.js
│   │   ├── advanceRoutes.js
│   │   ├── loanRoutes.js
│   │   └── documentRoutes.js
│   │
│   ├── middleware/
│   │   ├── auth.js               # JWT authentication
│   │   ├── validation.js         # Input validation
│   │   ├── errorHandler.js       # Global error handler
│   │   └── upload.js             # File upload (multer)
│   │
│   ├── services/                 # Business Logic Layer
│   │   ├── authService.js
│   │   ├── employeeService.js
│   │   ├── salaryService.js      # Salary calculations
│   │   ├── payrunService.js
│   │   ├── attendanceService.js
│   │   ├── advanceService.js
│   │   └── loanService.js
│   │
│   ├── utils/
│   │   ├── helpers.js            # Utility functions
│   │   ├── validators.js         # Custom validators
│   │   └── logger.js             # Logging utility
│   │
│   └── app.js                    # Express app setup
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── .env.example
├── .eslintrc.js
├── package.json
└── server.js                     # Entry point
```

---

## 4. Frontend Folder Structure

```
fe/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── MainLayout.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── Sidebar.jsx
│   │   │
│   │   └── ui/
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Modal.jsx
│   │       ├── Toast.jsx
│   │       ├── Table.jsx
│   │       ├── Pagination.jsx
│   │       └── ErrorBoundary.jsx
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Employees/
│   │   │   ├── EmployeeList.jsx
│   │   │   ├── EmployeeForm.jsx
│   │   │   └── EmployeeDetail.jsx
│   │   ├── Payroll/
│   │   │   ├── PayRun.jsx
│   │   │   └── Payslip.jsx
│   │   ├── Attendance.jsx
│   │   ├── Advances.jsx
│   │   ├── Loans.jsx
│   │   ├── Designations.jsx
│   │   └── Login.jsx
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useEmployees.js
│   │   ├── usePayroll.js
│   │   └── useToast.js
│   │
│   ├── services/
│   │   ├── api.js                # Axios instance
│   │   ├── authService.js
│   │   ├── employeeService.js
│   │   ├── payrollService.js
│   │   └── attendanceService.js
│   │
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── AppContext.jsx
│   │
│   ├── utils/
│   │   ├── helpers.js
│   │   ├── validators.js
│   │   └── formatters.js
│   │
│   ├── constants/
│   │   └── index.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── public/
├── .env.example
├── vite.config.js
└── package.json
```

---

## 5. Request/Response Flow

### Example: Create Employee

```
1. User fills form → React Component
           ↓
2. Submit handler → employeeService.createEmployee(data)
           ↓
3. Axios POST → /api/employees
           ↓
4. Express Router → employeeRoutes.js
           ↓
5. Auth Middleware → Verify JWT token
           ↓
6. Validation Middleware → Validate request body
           ↓
7. Controller → employeeController.createEmployee()
           ↓
8. Service Layer → employeeService.createEmployee()
           │
           ├─→ salaryService.calculateSalary()
           ├─→ Employee.create() (Mongoose)
           └─→ Return employee document
           ↓
9. View Layer → employeeView.formatEmployeeDetail()
           ↓
10. JSON Response → { success: true, data: {...} }
           ↓
11. React Query → Cache update
           ↓
12. UI Update → Show success toast, redirect
```

---

## 6. Authentication Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                        LOGIN FLOW                                  │
└───────────────────────────────────────────────────────────────────┘

1. Client                     2. Server                    3. Database
   │                             │                             │
   │ POST /auth/login            │                             │
   │ {email, password}           │                             │
   │────────────────────────────>│                             │
   │                             │ Find user by email          │
   │                             │────────────────────────────>│
   │                             │<────────────────────────────│
   │                             │                             │
   │                             │ Compare password (bcrypt)   │
   │                             │                             │
   │                             │ Generate JWT tokens         │
   │                             │ (access + refresh)          │
   │                             │                             │
   │ {access_token, refresh_token, user}                       │
   │<────────────────────────────│                             │
   │                             │                             │
   │ Store tokens (localStorage) │                             │
   │                             │                             │

┌───────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATED REQUEST                          │
└───────────────────────────────────────────────────────────────────┘

1. Client                     2. Server                    3. Database
   │                             │                             │
   │ GET /api/employees          │                             │
   │ Authorization: Bearer {token}                             │
   │────────────────────────────>│                             │
   │                             │                             │
   │                             │ Verify JWT signature        │
   │                             │ Check token expiry          │
   │                             │ Extract user from payload   │
   │                             │                             │
   │                             │ Query employees             │
   │                             │────────────────────────────>│
   │                             │<────────────────────────────│
   │                             │                             │
   │ {success: true, data: [...]}│                             │
   │<────────────────────────────│                             │
```

---

## 7. Security Architecture

### 7.1 Authentication Security
```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'No token provided' 
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
}
```

### 7.2 Input Validation
```javascript
// middleware/validation.js
const { body, validationResult } = require('express-validator');

const validateEmployee = [
  body('personalInfo.firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ max: 100 }).withMessage('First name too long'),
  
  body('personalInfo.email')
    .isEmail().withMessage('Invalid email format'),
  
  body('salaryInfo.ctc')
    .isNumeric().withMessage('CTC must be a number')
    .custom(value => value > 0).withMessage('CTC must be positive'),
  
  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];
```

### 7.3 Security Headers
```javascript
// app.js
const helmet = require('helmet');
const cors = require('cors');

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
```

---

## 8. Error Handling

```javascript
// middleware/errorHandler.js

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry',
      field: Object.keys(err.keyPattern)[0]
    });
  }
  
  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  // Custom application error
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }
  
  // Default server error
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
}

module.exports = errorHandler;
```

---

## 9. Database Indexing Strategy

### Primary Indexes
```javascript
// Created automatically by MongoDB
employees._id
users._id
departments._id
```

### Secondary Indexes
```javascript
// models/Employee.js
employeeSchema.index({ 'employmentDetails.officialEmail': 1 }, { unique: true });
employeeSchema.index({ status: 1 });
employeeSchema.index({ 'employmentDetails.department': 1 });
employeeSchema.index({ 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 });

// models/Attendance.js
attendanceSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

// models/PayRun.js
payrunSchema.index({ month: 1, year: 1 }, { unique: true });
```

---

## 10. Caching Strategy (Optional)

```javascript
// Using node-cache for simple in-memory caching
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

async function getDepartments() {
  const cacheKey = 'departments';
  let departments = cache.get(cacheKey);
  
  if (!departments) {
    departments = await Department.find({ isActive: true });
    cache.set(cacheKey, departments);
  }
  
  return departments;
}
```
