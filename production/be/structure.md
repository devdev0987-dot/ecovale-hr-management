# Backend Directory Structure

This document provides a detailed breakdown of every file and folder in the backend (`be/`) directory.

---

## Complete Structure

```
be/
├── .env                          # Environment variables (not in git)
├── .env.example                  # Environment template
├── .eslintrc.js                  # ESLint configuration
├── .gitignore                    # Git ignore rules
├── Dockerfile                    # Docker configuration
├── package.json                  # Dependencies and scripts
├── package-lock.json             # Dependency lock file
├── README.md                     # Backend documentation
│
├── src/                          # Source code
│   ├── app.js                    # Express app configuration
│   ├── server.js                 # Server entry point
│   │
│   ├── config/                   # Configuration files
│   │   ├── index.js              # Main config loader
│   │   └── database.js           # MongoDB connection
│   │
│   ├── controllers/              # Request handlers (MVC Controllers)
│   │   ├── authController.js     # Authentication logic
│   │   ├── employeeController.js # Employee CRUD operations
│   │   ├── departmentController.js
│   │   ├── designationController.js
│   │   ├── attendanceController.js
│   │   ├── payrunController.js   # Payroll processing
│   │   ├── advanceController.js
│   │   ├── loanController.js
│   │   └── calculatorController.js
│   │
│   ├── middleware/               # Express middleware
│   │   ├── auth.js               # JWT authentication
│   │   ├── authorize.js          # Role-based authorization
│   │   ├── validate.js           # Request validation
│   │   ├── errorHandler.js       # Global error handler
│   │   ├── rateLimiter.js        # Rate limiting
│   │   └── requestLogger.js      # HTTP request logging
│   │
│   ├── models/                   # Mongoose schemas (MVC Models)
│   │   ├── User.js               # User schema
│   │   ├── Employee.js           # Employee schema
│   │   ├── Department.js         # Department schema
│   │   ├── Designation.js        # Designation schema
│   │   ├── Attendance.js         # Attendance schema
│   │   ├── PayRun.js             # PayRun schema
│   │   ├── PayRunRecord.js       # Individual payrun record
│   │   ├── Advance.js            # Advance schema
│   │   ├── Loan.js               # Loan schema
│   │   └── LoanEMI.js            # Loan EMI schema
│   │
│   ├── routes/                   # API route definitions
│   │   ├── index.js              # Route aggregator
│   │   ├── authRoutes.js         # /api/auth/*
│   │   ├── employeeRoutes.js     # /api/employees/*
│   │   ├── departmentRoutes.js   # /api/departments/*
│   │   ├── designationRoutes.js  # /api/designations/*
│   │   ├── attendanceRoutes.js   # /api/attendances/*
│   │   ├── payrunRoutes.js       # /api/payruns/*
│   │   ├── advanceRoutes.js      # /api/advances/*
│   │   ├── loanRoutes.js         # /api/loans/*
│   │   ├── calculatorRoutes.js   # /api/calculator/*
│   │   └── healthRoutes.js       # /api/health
│   │
│   ├── services/                 # Business logic layer
│   │   ├── authService.js        # Authentication operations
│   │   ├── employeeService.js    # Employee business logic
│   │   ├── salaryService.js      # Salary calculations
│   │   ├── payrunService.js      # Payroll processing
│   │   └── emailService.js       # Email notifications (future)
│   │
│   ├── utils/                    # Utility functions
│   │   ├── constants.js          # App constants
│   │   ├── helpers.js            # Helper functions
│   │   ├── logger.js             # Winston logger
│   │   └── AppError.js           # Custom error class
│   │
│   ├── validators/               # Request validation schemas
│   │   ├── authValidators.js     # Auth route validation
│   │   ├── employeeValidators.js
│   │   ├── attendanceValidators.js
│   │   ├── payrunValidators.js
│   │   ├── advanceValidators.js
│   │   └── loanValidators.js
│   │
│   └── scripts/                  # Utility scripts
│       ├── seed.js               # Database seeding
│       └── migrate.js            # Data migration
│
├── tests/                        # Test files
│   ├── setup.js                  # Jest setup
│   ├── fixtures/                 # Test data
│   │   ├── users.js
│   │   └── employees.js
│   ├── unit/                     # Unit tests
│   │   ├── services/
│   │   │   └── salaryService.test.js
│   │   └── utils/
│   │       └── helpers.test.js
│   └── integration/              # Integration tests
│       ├── auth.test.js
│       └── employees.test.js
│
└── logs/                         # Log files (not in git)
    ├── error.log
    └── combined.log
```

---

## File Descriptions

### Root Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables (DATABASE_URI, JWT_SECRET, etc.) |
| `.env.example` | Template for environment variables |
| `.eslintrc.js` | ESLint rules for code quality |
| `.gitignore` | Files/folders to exclude from git |
| `Dockerfile` | Docker image configuration |
| `package.json` | NPM dependencies and scripts |

---

### src/config/

Configuration files for the application.

```javascript
// config/index.js
// Loads and exports environment-specific configuration
module.exports = {
  port: process.env.PORT || 5000,
  mongodb: { uri: process.env.MONGODB_URI },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  },
  cors: { origin: process.env.CORS_ORIGIN },
};
```

```javascript
// config/database.js
// MongoDB connection with Mongoose
const mongoose = require('mongoose');
const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
};
module.exports = connectDB;
```

---

### src/controllers/

Handle HTTP requests and send responses. Each controller corresponds to a resource.

**Pattern:**
```javascript
// controllers/employeeController.js
const employeeService = require('../services/employeeService');

exports.getAll = async (req, res, next) => {
  try {
    const employees = await employeeService.findAll(req.query);
    res.json({ success: true, data: employees });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => { /* ... */ };
exports.create = async (req, res, next) => { /* ... */ };
exports.update = async (req, res, next) => { /* ... */ };
exports.delete = async (req, res, next) => { /* ... */ };
```

---

### src/middleware/

Express middleware for cross-cutting concerns.

| Middleware | Purpose |
|------------|---------|
| `auth.js` | Verify JWT token, attach user to request |
| `authorize.js` | Check user roles for route access |
| `validate.js` | Run express-validator and return errors |
| `errorHandler.js` | Global error handler, format error responses |
| `rateLimiter.js` | Rate limiting for API and auth routes |
| `requestLogger.js` | Log HTTP requests with morgan/winston |

---

### src/models/

Mongoose schemas defining MongoDB collections.

**Example:**
```javascript
// models/Employee.js
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
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
    basic: { type: Number, required: true },
    // ... more fields
  },
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
```

---

### src/routes/

Define API endpoints and connect to controllers.

```javascript
// routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createEmployeeValidator } = require('../validators/employeeValidators');

router.use(auth); // Protect all routes

router.get('/', employeeController.getAll);
router.get('/:id', employeeController.getById);
router.post('/', validate(createEmployeeValidator), employeeController.create);
router.put('/:id', employeeController.update);
router.delete('/:id', employeeController.delete);

module.exports = router;
```

```javascript
// routes/index.js
const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/employees', require('./employeeRoutes'));
router.use('/departments', require('./departmentRoutes'));
router.use('/designations', require('./designationRoutes'));
router.use('/attendances', require('./attendanceRoutes'));
router.use('/payruns', require('./payrunRoutes'));
router.use('/advances', require('./advanceRoutes'));
router.use('/loans', require('./loanRoutes'));
router.use('/calculator', require('./calculatorRoutes'));
router.use('/', require('./healthRoutes'));

module.exports = router;
```

---

### src/services/

Business logic layer, keeping controllers thin.

```javascript
// services/salaryService.js
const { BASIC_PCT_OF_CTC, PF_WAGE_CEILING, PF_RATE, ESI_RATE } = require('../utils/constants');

/**
 * Calculate salary components from CTC
 * @param {number} ctc - Annual CTC
 * @param {number} hraPercentage - HRA percentage of basic
 * @returns {Object} Salary breakdown
 */
exports.calculateFromCTC = (ctc, hraPercentage = 40) => {
  const monthlyCtc = ctc / 12;
  const basic = (ctc * BASIC_PCT_OF_CTC) / 12;
  const hra = basic * (hraPercentage / 100);
  
  // PF calculation
  const pfWage = Math.min(basic, PF_WAGE_CEILING);
  const pfDeduction = pfWage * PF_RATE;
  const employerPF = pfWage * PF_RATE;
  
  // Calculate gross and other components
  // ... (full calculation logic)
  
  return {
    basic,
    hra,
    pfDeduction,
    employerPF,
    gross,
    net,
    // ... all components
  };
};
```

---

### src/utils/

Utility functions and classes.

```javascript
// utils/constants.js
module.exports = {
  BASIC_PCT_OF_CTC: 0.50,
  PF_WAGE_CEILING: 15000,
  PF_RATE: 0.12,
  ESI_EMPLOYEE_RATE: 0.0075,
  ESI_EMPLOYER_RATE: 0.0325,
  ESI_WAGE_CEILING: 21000,
  PT_THRESHOLD: 25000,
  PT_AMOUNT: 200,
  DEPARTMENTS: ['IT', 'HR', 'Finance', 'Sales', 'Marketing'],
  WORK_LOCATIONS: ['Bangalore', 'Mangaluru', 'Mysore', 'Belagaum', 'Remote'],
};
```

```javascript
// utils/AppError.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}
module.exports = AppError;
```

---

### src/validators/

Request validation using express-validator.

```javascript
// validators/employeeValidators.js
const { body } = require('express-validator');

exports.createEmployeeValidator = [
  body('personalInfo.firstName')
    .trim()
    .notEmpty().withMessage('First name is required')
    .isLength({ max: 100 }).withMessage('First name too long'),
  
  body('personalInfo.lastName')
    .trim()
    .notEmpty().withMessage('Last name is required'),
  
  body('personalInfo.contactNumber')
    .matches(/^[0-9]{10}$/).withMessage('Invalid phone number'),
  
  body('salaryInfo.ctc')
    .isNumeric().withMessage('CTC must be a number')
    .custom(value => value > 0).withMessage('CTC must be positive'),
  
  // ... more validations
];
```

---

### tests/

Test files organized by type.

```javascript
// tests/integration/employees.test.js
const request = require('supertest');
const app = require('../../src/app');
const mongoose = require('mongoose');

describe('Employees API', () => {
  let authToken;

  beforeAll(async () => {
    // Login and get token
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/employees', () => {
    it('should return list of employees', async () => {
      const res = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
```

---

## MVC Pattern Flow

```
Request → Route → Middleware → Controller → Service → Model → Database
                                    ↓
                             Response (JSON)
```

1. **Request** arrives at Express server
2. **Route** matches URL pattern
3. **Middleware** handles auth, validation, logging
4. **Controller** processes request, calls service
5. **Service** implements business logic
6. **Model** interacts with MongoDB via Mongoose
7. **Response** sent back as JSON
