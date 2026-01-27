# Data Modeling - EcoVale HR

## 1. Database Overview

### Database Type
**MongoDB** - Document-oriented NoSQL database

### Why MongoDB for This Project?
1. **Flexible Schema** - Employee data structure can evolve
2. **Embedded Documents** - Store related data together (personalInfo, salaryInfo)
3. **JSON-like Documents** - Natural fit for JavaScript applications
4. **Scalability** - Horizontal scaling for future growth
5. **Mongoose ODM** - Excellent JavaScript integration

### Database Design Principles
1. **Embed when possible** - Related data accessed together
2. **Reference when necessary** - Many-to-many, large documents
3. **Denormalize for reads** - Cache names in transaction records
4. **Index for queries** - Optimize common query patterns

---

## 2. Collections Overview

| Collection | Description | Relationships |
|------------|-------------|---------------|
| `users` | Authentication and authorization | - |
| `departments` | Organizational units | → employees, designations |
| `designations` | Job titles | → department, employees |
| `employees` | Core employee data | → department, designation |
| `attendances` | Monthly attendance records | → employee |
| `payruns` | Monthly payroll batches | → payrunrecords |
| `payrunrecords` | Individual payroll records | → payrun, employee |
| `advances` | Salary advances | → employee |
| `loans` | Employee loans | → employee, loanemis |
| `loanemis` | Loan EMI schedule | → loan |
| `documents` | Employee documents | → employee |

---

## 3. Collection Schemas

### 3.1 Users Collection

```javascript
// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false  // Don't return password by default
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: 255
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'hr', 'employee'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, {
  timestamps: true  // Adds createdAt, updatedAt
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);
```

### 3.2 Departments Collection

```javascript
// models/Department.js
const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    enum: ['IT', 'HR', 'Finance', 'Sales', 'Marketing'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  headEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
departmentSchema.index({ name: 1 });
departmentSchema.index({ isActive: 1 });

module.exports = mongoose.model('Department', departmentSchema);
```

### 3.3 Designations Collection

```javascript
// models/Designation.js
const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Designation title is required'],
    trim: true,
    maxlength: 255
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  description: {
    type: String,
    trim: true
  },
  reportingTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Designation',
    default: null
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  }
}, {
  timestamps: true
});

// Indexes
designationSchema.index({ department: 1 });
designationSchema.index({ title: 1 });
designationSchema.index({ level: 1 });

module.exports = mongoose.model('Designation', designationSchema);
```

### 3.4 Employees Collection (Main Entity)

```javascript
// models/Employee.js
const mongoose = require('mongoose');

// Sub-schemas for embedded documents
const bankDetailsSchema = new mongoose.Schema({
  bankName: { type: String, required: true, trim: true },
  accountHolder: { type: String, required: true, trim: true },
  accountNumber: { type: String, required: true, trim: true },
  ifscCode: { 
    type: String, 
    required: true, 
    trim: true,
    match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code']
  },
  branch: { type: String, required: true, trim: true }
}, { _id: false });

const documentSchema = new mongoose.Schema({
  type: { type: String, required: true },  // Aadhar, PAN, etc.
  fileName: { type: String, required: true },
  data: { type: String, required: true },  // Base64 or URL
  uploadDate: { type: Date, default: Date.now }
}, { _id: true });

const careerHistorySchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['promotion', 'increment', 'demotion'],
    required: true 
  },
  date: { type: Date, required: true },
  details: { type: mongoose.Schema.Types.Mixed }
}, { _id: true });

const annexureSchema = new mongoose.Schema({
  fileName: { type: String },
  data: { type: String },  // Base64
  generatedAt: { type: Date }
}, { _id: false });

// Main employee schema
const employeeSchema = new mongoose.Schema({
  // Sequential ID (1, 2, 3, ...)
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  
  // Personal Information (embedded)
  personalInfo: {
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    middleName: { type: String, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    dob: { type: Date },
    gender: { 
      type: String, 
      required: true, 
      enum: ['Male', 'Female', 'Other'] 
    },
    photo: { type: String },  // Base64 or URL
    contactNumber: { 
      type: String, 
      required: true,
      match: [/^[0-9]{10}$/, 'Invalid phone number']
    },
    alternateContact: { type: String },
    emergencyContact: { type: String },
    personalEmail: { 
      type: String, 
      required: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
    },
    permanentAddress: { type: String },
    currentAddress: { type: String, required: true },
    pfNumber: { type: String },
    esiNumber: { type: String },
    bloodGroup: { type: String },
    fatherName: { type: String },
    motherName: { type: String }
  },
  
  // Employment Details (embedded)
  employmentDetails: {
    type: { 
      type: String, 
      required: true,
      enum: ['full-time', 'part-time'] 
    },
    department: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Department',
      required: true 
    },
    designation: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Designation',
      required: true 
    },
    reportingManager: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Employee',
      default: null
    },
    joinDate: { type: Date },
    officialEmail: { 
      type: String, 
      required: true,
      unique: true,
      lowercase: true
    },
    workLocation: { 
      type: String, 
      required: true,
      enum: ['Bangalore', 'Mangaluru', 'Mysore', 'Belagaum', 
             'Hubballi', 'Kolar', 'Tumkur', 'Shivamogga', 'Remote']
    },
    probationPeriod: { type: Number, default: 6 },  // months
    grade: { type: String, enum: ['A', 'B', 'C', 'D'] }
  },
  
  // Salary Information (embedded)
  salaryInfo: {
    ctc: { type: Number, required: true, min: 0 },
    basic: { type: Number, required: true, min: 0 },
    hraPercentage: { type: Number, required: true, min: 0, max: 100 },
    hra: { type: Number, required: true, min: 0 },
    conveyance: { type: Number, default: 0 },
    telephone: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    employeeHealthInsuranceAnnual: { type: Number, default: 1000 },
    gross: { type: Number, required: true, min: 0 },
    includePF: { type: Boolean, default: true },
    includeESI: { type: Boolean, default: false },
    pfDeduction: { type: Number, default: 0 },
    esiDeduction: { type: Number, default: 0 },
    employerPF: { type: Number, default: 0 },
    employerESI: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    tdsMonthly: { type: Number, default: 0 },
    net: { type: Number, required: true, min: 0 },
    paymentMode: { 
      type: String, 
      required: true,
      enum: ['Bank', 'Cash', 'Cheque']
    },
    bankDetails: bankDetailsSchema,
    annexure: annexureSchema
  },
  
  // Arrays
  documents: [documentSchema],
  careerHistory: [careerHistorySchema],
  
  // Status
  status: { 
    type: String, 
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Virtual for full name
employeeSchema.virtual('fullName').get(function() {
  return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

// Indexes
employeeSchema.index({ employeeId: 1 }, { unique: true });
employeeSchema.index({ 'employmentDetails.officialEmail': 1 }, { unique: true });
employeeSchema.index({ status: 1 });
employeeSchema.index({ 'employmentDetails.department': 1 });
employeeSchema.index({ 'employmentDetails.designation': 1 });
employeeSchema.index({ 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 });

// Enable virtuals in JSON
employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);
```

### 3.5 Attendance Collection

```javascript
// models/Attendance.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  employeeName: {
    type: String,
    required: true  // Denormalized for reporting
  },
  month: {
    type: String,
    required: true,
    enum: ['January', 'February', 'March', 'April', 'May', 'June',
           'July', 'August', 'September', 'October', 'November', 'December']
  },
  year: {
    type: String,
    required: true
  },
  totalWorkingDays: {
    type: Number,
    required: true,
    min: 1,
    max: 31
  },
  presentDays: {
    type: Number,
    required: true,
    min: 0
  },
  absentDays: {
    type: Number,
    required: true,
    min: 0
  },
  paidLeave: {
    type: Number,
    default: 0,
    min: 0
  },
  unpaidLeave: {
    type: Number,
    default: 0,
    min: 0
  },
  // Auto-calculated
  payableDays: {
    type: Number,
    required: true
  },
  lossOfPayDays: {
    type: Number,
    required: true
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Pre-save: Calculate payable and LOP days
attendanceSchema.pre('save', function(next) {
  this.payableDays = this.presentDays + this.paidLeave;
  this.lossOfPayDays = this.unpaidLeave + this.absentDays;
  next();
});

// Unique constraint: One record per employee per month/year
attendanceSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });
attendanceSchema.index({ month: 1, year: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
```

### 3.6 PayRun Collection

```javascript
// models/PayRun.js
const mongoose = require('mongoose');

const payrunSchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
    enum: ['January', 'February', 'March', 'April', 'May', 'June',
           'July', 'August', 'September', 'October', 'November', 'December']
  },
  year: {
    type: String,
    required: true
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  employeeCount: {
    type: Number,
    required: true
  },
  totalGross: {
    type: Number,
    required: true
  },
  totalDeductions: {
    type: Number,
    required: true
  },
  totalNetPay: {
    type: Number,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Unique constraint: One pay run per month/year
payrunSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('PayRun', payrunSchema);
```

### 3.7 PayRunRecord Collection

```javascript
// models/PayRunRecord.js
const mongoose = require('mongoose');

const payrunRecordSchema = new mongoose.Schema({
  payrun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayRun',
    required: true
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  employeeName: {
    type: String,
    required: true  // Denormalized
  },
  
  // Earnings
  basicSalary: { type: Number, required: true },
  hra: { type: Number, required: true },
  conveyance: { type: Number, default: 0 },
  telephone: { type: Number, default: 0 },
  medicalAllowance: { type: Number, default: 0 },
  specialAllowance: { type: Number, default: 0 },
  totalAllowances: { type: Number, required: true },
  grossSalary: { type: Number, required: true },
  
  // Attendance
  totalWorkingDays: { type: Number, required: true },
  payableDays: { type: Number, required: true },
  lossOfPayDays: { type: Number, required: true },
  lossOfPayAmount: { type: Number, required: true },
  
  // Deductions
  advanceDeduction: { type: Number, default: 0 },
  loanDeduction: { type: Number, default: 0 },
  pfDeduction: { type: Number, default: 0 },
  esiDeduction: { type: Number, default: 0 },
  professionalTax: { type: Number, default: 0 },
  tds: { type: Number, default: 0 },
  totalDeductions: { type: Number, required: true },
  
  // Net
  netPay: { type: Number, required: true }
}, {
  timestamps: true
});

payrunRecordSchema.index({ payrun: 1 });
payrunRecordSchema.index({ employee: 1 });

module.exports = mongoose.model('PayRunRecord', payrunRecordSchema);
```

### 3.8 Advance Collection

```javascript
// models/Advance.js
const mongoose = require('mongoose');

const advanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  employeeName: {
    type: String,
    required: true  // Denormalized
  },
  advanceMonth: {
    type: String,
    required: true  // Month when advance was paid
  },
  advanceYear: {
    type: String,
    required: true
  },
  advancePaidAmount: {
    type: Number,
    required: true,
    min: 0
  },
  advanceDeductionMonth: {
    type: String,
    required: true  // Month when advance will be deducted
  },
  advanceDeductionYear: {
    type: String,
    required: true
  },
  remarks: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'deducted', 'partial'],
    default: 'pending'
  },
  remainingAmount: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

advanceSchema.index({ employee: 1 });
advanceSchema.index({ advanceDeductionMonth: 1, advanceDeductionYear: 1 });
advanceSchema.index({ status: 1 });

module.exports = mongoose.model('Advance', advanceSchema);
```

### 3.9 Loan Collection

```javascript
// models/Loan.js
const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  employeeName: {
    type: String,
    required: true  // Denormalized
  },
  loanAmount: {
    type: Number,
    required: true,
    min: 0
  },
  interestRate: {
    type: Number,
    default: 0,
    min: 0
  },
  numberOfEMIs: {
    type: Number,
    required: true,
    min: 1
  },
  emiAmount: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true  // Loan + Interest
  },
  startMonth: {
    type: String,
    required: true
  },
  startYear: {
    type: String,
    required: true
  },
  totalPaidEMIs: {
    type: Number,
    default: 0
  },
  remainingBalance: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

loanSchema.index({ employee: 1 });
loanSchema.index({ status: 1 });

module.exports = mongoose.model('Loan', loanSchema);
```

### 3.10 LoanEMI Collection

```javascript
// models/LoanEMI.js
const mongoose = require('mongoose');

const loanEMISchema = new mongoose.Schema({
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: true
  },
  month: {
    type: String,
    required: true
  },
  year: {
    type: String,
    required: true
  },
  emiAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
  },
  paidDate: {
    type: Date
  }
}, {
  timestamps: true
});

loanEMISchema.index({ loan: 1 });
loanEMISchema.index({ month: 1, year: 1 });
loanEMISchema.index({ status: 1 });

module.exports = mongoose.model('LoanEMI', loanEMISchema);
```

---

## 4. Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ENTITY RELATIONSHIPS                               │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│    Users     │ (Authentication)
└──────────────┘
       │
       │ generates
       ↓
┌──────────────┐     1:M     ┌──────────────┐
│   PayRuns    │────────────→│PayRunRecords │
└──────────────┘             └──────────────┘
                                    │
                                    │ M:1
                                    ↓
┌──────────────┐     1:M     ┌──────────────┐     M:1     ┌──────────────┐
│ Departments  │←────────────│  Employees   │────────────→│ Designations │
└──────────────┘             └──────────────┘             └──────────────┘
                                    │                            │
                                    │                            │ M:1
                                    │                            ↓
                                    │                     ┌──────────────┐
                                    │                     │ Departments  │
                                    │                     └──────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ↓                     ↓                     ↓
       ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
       │ Attendances  │     │  Advances    │     │    Loans     │
       └──────────────┘     └──────────────┘     └──────────────┘
                                                        │
                                                        │ 1:M
                                                        ↓
                                                 ┌──────────────┐
                                                 │   LoanEMIs   │
                                                 └──────────────┘

Self-Referential:
┌──────────────┐
│  Employees   │──┐
└──────────────┘  │ reportingManager
       ↑          │
       └──────────┘

┌──────────────┐
│ Designations │──┐
└──────────────┘  │ reportingTo
       ↑          │
       └──────────┘
```

---

## 5. Index Summary

| Collection | Index | Type | Purpose |
|------------|-------|------|---------|
| users | email | Unique | Login lookup |
| users | role | Standard | Role filtering |
| departments | name | Unique | Name lookup |
| designations | department | Standard | Department filtering |
| designations | title | Standard | Title search |
| employees | employeeId | Unique | ID lookup |
| employees | officialEmail | Unique | Email lookup |
| employees | status | Standard | Status filtering |
| employees | department | Standard | Department filtering |
| employees | firstName + lastName | Compound | Name search |
| attendances | employee + month + year | Unique | Unique record |
| payruns | month + year | Unique | Unique pay run |
| payrunrecords | payrun | Standard | Pay run lookup |
| payrunrecords | employee | Standard | Employee lookup |
| advances | employee | Standard | Employee lookup |
| advances | status | Standard | Status filtering |
| loans | employee | Standard | Employee lookup |
| loans | status | Standard | Status filtering |
| loanemis | loan | Standard | Loan lookup |
| loanemis | month + year | Standard | Period lookup |

---

## 6. Data Validation Rules

### Employee Validation
```javascript
// Example validation in service layer
function validateEmployee(data) {
  const errors = [];
  
  // Required fields
  if (!data.personalInfo?.firstName) 
    errors.push('First name is required');
  if (!data.personalInfo?.lastName) 
    errors.push('Last name is required');
  if (!data.personalInfo?.gender) 
    errors.push('Gender is required');
  if (!data.personalInfo?.contactNumber) 
    errors.push('Contact number is required');
  
  // Format validation
  if (data.personalInfo?.contactNumber && 
      !/^[0-9]{10}$/.test(data.personalInfo.contactNumber)) {
    errors.push('Invalid phone number format');
  }
  
  if (data.personalInfo?.personalEmail && 
      !/^\S+@\S+\.\S+$/.test(data.personalInfo.personalEmail)) {
    errors.push('Invalid email format');
  }
  
  // Business rules
  if (data.salaryInfo?.ctc < 0) 
    errors.push('CTC cannot be negative');
  
  if (data.salaryInfo?.hraPercentage < 0 || 
      data.salaryInfo?.hraPercentage > 100) {
    errors.push('HRA percentage must be between 0 and 100');
  }
  
  return errors;
}
```

---

## 7. Sample Data

### Sample Employee Document

```javascript
{
  "_id": ObjectId("..."),
  "employeeId": "1",
  "personalInfo": {
    "firstName": "Alice",
    "lastName": "Johnson",
    "dob": ISODate("1992-05-20"),
    "gender": "Female",
    "contactNumber": "9876543210",
    "personalEmail": "alice.j@email.com",
    "currentAddress": "123 Maple St, Indiranagar, Bangalore - 560038",
    "pfNumber": "KA/BLR/12345",
    "bloodGroup": "O+",
    "fatherName": "Robert Johnson",
    "motherName": "Mary Johnson"
  },
  "employmentDetails": {
    "type": "full-time",
    "department": ObjectId("..."),  // Reference to Department
    "designation": ObjectId("..."), // Reference to Designation
    "joinDate": ISODate("2020-03-15"),
    "officialEmail": "alice.johnson@ecovale.com",
    "workLocation": "Bangalore",
    "probationPeriod": 6,
    "grade": "A"
  },
  "salaryInfo": {
    "ctc": 1560000,
    "basic": 80000,
    "hraPercentage": 40,
    "hra": 32000,
    "conveyance": 1600,
    "telephone": 500,
    "medicalAllowance": 1250,
    "specialAllowance": 14650,
    "employeeHealthInsuranceAnnual": 1000,
    "gross": 130000,
    "includePF": true,
    "includeESI": false,
    "pfDeduction": 9600,
    "employerPF": 9600,
    "esiDeduction": 0,
    "employerESI": 0,
    "professionalTax": 200,
    "tds": 8000,
    "tdsMonthly": 666.67,
    "net": 112533,
    "paymentMode": "Bank",
    "bankDetails": {
      "bankName": "HDFC Bank",
      "accountHolder": "Alice Johnson",
      "accountNumber": "50100123456789",
      "ifscCode": "HDFC0001234",
      "branch": "Indiranagar"
    }
  },
  "documents": [],
  "careerHistory": [],
  "status": "active",
  "createdAt": ISODate("2024-01-01T10:00:00Z"),
  "updatedAt": ISODate("2024-01-01T10:00:00Z")
}
```
