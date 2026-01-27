# API Design - EcoVale HR

## 1. API Overview

### Base Configuration
- **Base URL**: `http://localhost:5000/api/v1` (development)
- **Production URL**: `https://api.ecovale.com/v1`
- **Content Type**: `application/json`
- **Authentication**: Bearer Token (JWT)

### Response Format (Standard)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

---

## 2. Authentication APIs

### 2.1 Login
**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "admin@ecovale.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": "64a7f8e2c3b1d2e3f4a5b6c7",
      "email": "admin@ecovale.com",
      "fullName": "Admin User",
      "role": "admin"
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### 2.2 Refresh Token
**POST** `/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

---

### 2.3 Logout
**POST** `/auth/logout`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 2.4 Get Current User
**GET** `/auth/me`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "64a7f8e2c3b1d2e3f4a5b6c7",
    "email": "admin@ecovale.com",
    "fullName": "Admin User",
    "role": "admin",
    "lastLogin": "2026-01-19T10:30:00Z"
  }
}
```

---

## 3. Employee APIs

### 3.1 List Employees
**GET** `/employees`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| status | string | - | Filter: active, inactive |
| department | string | - | Filter by department ID |
| designation | string | - | Filter by designation ID |
| type | string | - | Filter: full-time, part-time |
| search | string | - | Search by name or ID |
| sortBy | string | employeeId | Sort field |
| sortOrder | string | asc | Sort order: asc, desc |

**Example Request:**
```
GET /employees?status=active&department=64a7f8e2...&page=1&limit=20
```

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "64a7f8e2c3b1d2e3f4a5b6c7",
      "employeeId": "1",
      "name": "Alice Johnson",
      "officialEmail": "alice.johnson@ecovale.com",
      "department": {
        "id": "64a7f8e2c3b1d2e3f4a5b6c8",
        "name": "IT"
      },
      "designation": {
        "id": "64a7f8e2c3b1d2e3f4a5b6c9",
        "title": "Senior Software Engineer"
      },
      "employmentType": "full-time",
      "status": "active",
      "joinDate": "2020-03-15",
      "photo": "https://..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

### 3.2 Get Employee by ID
**GET** `/employees/:id`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "64a7f8e2c3b1d2e3f4a5b6c7",
    "employeeId": "1",
    "personalInfo": {
      "firstName": "Alice",
      "middleName": null,
      "lastName": "Johnson",
      "dob": "1992-05-20",
      "gender": "Female",
      "photo": "data:image/jpeg;base64,...",
      "contactNumber": "9876543210",
      "alternateContact": null,
      "emergencyContact": null,
      "personalEmail": "alice.j@email.com",
      "permanentAddress": "123 Maple St, Indiranagar, Bangalore - 560038",
      "currentAddress": "123 Maple St, Indiranagar, Bangalore - 560038",
      "pfNumber": "KA/BLR/12345",
      "esiNumber": null,
      "bloodGroup": "O+",
      "fatherName": "Robert Johnson",
      "motherName": "Mary Johnson"
    },
    "employmentDetails": {
      "type": "full-time",
      "department": {
        "id": "64a7f8e2c3b1d2e3f4a5b6c8",
        "name": "IT"
      },
      "designation": {
        "id": "64a7f8e2c3b1d2e3f4a5b6c9",
        "title": "Senior Software Engineer"
      },
      "reportingManager": {
        "id": "64a7f8e2c3b1d2e3f4a5b6d0",
        "name": "John Doe"
      },
      "joinDate": "2020-03-15",
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
      "esiDeduction": 0,
      "employerPF": 9600,
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
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Employee not found"
}
```

---

### 3.3 Create Employee
**POST** `/employees`

**Request Body:**
```json
{
  "personalInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "gender": "Male",
    "contactNumber": "9876543210",
    "personalEmail": "john.doe@email.com",
    "currentAddress": "456 Oak Street, Bangalore",
    "dob": "1990-01-15",
    "bloodGroup": "A+"
  },
  "employmentDetails": {
    "type": "full-time",
    "department": "64a7f8e2c3b1d2e3f4a5b6c8",
    "designation": "64a7f8e2c3b1d2e3f4a5b6c9",
    "workLocation": "Bangalore",
    "joinDate": "2026-01-20",
    "probationPeriod": 6
  },
  "salaryInfo": {
    "ctc": 1200000,
    "hraPercentage": 10,
    "conveyance": 1600,
    "telephone": 500,
    "medicalAllowance": 1250,
    "includePF": true,
    "includeESI": false,
    "tds": 5,
    "paymentMode": "Bank",
    "bankDetails": {
      "bankName": "HDFC Bank",
      "accountHolder": "John Doe",
      "accountNumber": "50100987654321",
      "ifscCode": "HDFC0001234",
      "branch": "Koramangala"
    }
  }
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Employee created successfully",
  "data": {
    "id": "64a7f8e2c3b1d2e3f4a5b6d1",
    "employeeId": "7",
    "personalInfo": { ... },
    "employmentDetails": { ... },
    "salaryInfo": { ... },
    "status": "active",
    "createdAt": "2026-01-19T10:30:00Z"
  }
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "personalInfo.firstName", "message": "First name is required" },
    { "field": "salaryInfo.ctc", "message": "CTC must be a positive number" }
  ]
}
```

---

### 3.4 Update Employee
**PUT** `/employees/:id`

**Request Body:** (Same structure as create, partial updates allowed)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Employee updated successfully",
  "data": { ... }
}
```

---

### 3.5 Delete Employee
**DELETE** `/employees/:id`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Employee deleted successfully"
}
```

**Note:** Soft delete - sets status to 'inactive'

---

### 3.6 Upload Employee Photo
**POST** `/employees/:id/photo`

**Content-Type:** `multipart/form-data`

**Form Data:**
```
photo: [File]
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Photo uploaded successfully",
  "data": {
    "photoUrl": "data:image/jpeg;base64,..."
  }
}
```

---

### 3.7 Upload Employee Document
**POST** `/employees/:id/documents`

**Content-Type:** `multipart/form-data`

**Form Data:**
```
document: [File]
type: "Aadhar"
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "id": "64a7f8e2c3b1d2e3f4a5b6d2",
    "type": "Aadhar",
    "fileName": "aadhar.pdf",
    "uploadDate": "2026-01-19T10:30:00Z"
  }
}
```

---

## 4. Department APIs

### 4.1 List Departments
**GET** `/departments`

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": "64a7f8e2c3b1d2e3f4a5b6c8", "name": "IT", "description": "Information Technology" },
    { "id": "64a7f8e2c3b1d2e3f4a5b6c9", "name": "HR", "description": "Human Resources" },
    { "id": "64a7f8e2c3b1d2e3f4a5b6d0", "name": "Finance", "description": "Finance and Accounting" },
    { "id": "64a7f8e2c3b1d2e3f4a5b6d1", "name": "Sales", "description": "Sales and Business Development" },
    { "id": "64a7f8e2c3b1d2e3f4a5b6d2", "name": "Marketing", "description": "Marketing and Communications" }
  ]
}
```

---

## 5. Designation APIs

### 5.1 List Designations
**GET** `/designations`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| department | string | Filter by department ID |

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "64a7f8e2c3b1d2e3f4a5b6c9",
      "title": "Software Engineer",
      "department": {
        "id": "64a7f8e2c3b1d2e3f4a5b6c8",
        "name": "IT"
      },
      "level": 3,
      "description": "Develops software solutions"
    }
  ]
}
```

---

### 5.2 Create Designation
**POST** `/designations`

**Request Body:**
```json
{
  "title": "Senior Software Engineer",
  "department": "64a7f8e2c3b1d2e3f4a5b6c8",
  "level": 4,
  "description": "Leads software development projects",
  "reportingTo": "64a7f8e2c3b1d2e3f4a5b6d3"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Designation created successfully",
  "data": { ... }
}
```

---

### 5.3 Update Designation
**PUT** `/designations/:id`

### 5.4 Delete Designation
**DELETE** `/designations/:id`

---

## 6. Attendance APIs

### 6.1 List Attendance Records
**GET** `/attendance`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| employee | string | Filter by employee ID |
| month | string | Filter by month (January, February, etc.) |
| year | string | Filter by year |

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "64a7f8e2c3b1d2e3f4a5b6d4",
      "employee": {
        "id": "64a7f8e2c3b1d2e3f4a5b6c7",
        "name": "Alice Johnson"
      },
      "month": "January",
      "year": "2026",
      "totalWorkingDays": 26,
      "presentDays": 24,
      "absentDays": 0,
      "paidLeave": 2,
      "unpaidLeave": 0,
      "payableDays": 26,
      "lossOfPayDays": 0,
      "remarks": ""
    }
  ]
}
```

---

### 6.2 Create/Update Attendance Record
**POST** `/attendance`

**Request Body:**
```json
{
  "employee": "64a7f8e2c3b1d2e3f4a5b6c7",
  "month": "January",
  "year": "2026",
  "totalWorkingDays": 26,
  "presentDays": 24,
  "absentDays": 0,
  "paidLeave": 2,
  "unpaidLeave": 0,
  "remarks": "All leaves approved"
}
```

**Note:** If record exists for employee/month/year, it updates. Otherwise, creates new.

**Success Response (200/201):**
```json
{
  "success": true,
  "message": "Attendance record saved successfully",
  "data": {
    "id": "64a7f8e2c3b1d2e3f4a5b6d4",
    "payableDays": 26,
    "lossOfPayDays": 0,
    ...
  }
}
```

---

### 6.3 Delete Attendance Record
**DELETE** `/attendance/:id`

---

## 7. Pay Run APIs

### 7.1 List Pay Runs
**GET** `/payruns`

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "64a7f8e2c3b1d2e3f4a5b6d5",
      "month": "January",
      "year": "2026",
      "employeeCount": 6,
      "totalGross": 523200,
      "totalDeductions": 42600,
      "totalNetPay": 480600,
      "generatedAt": "2026-01-19T10:30:00Z",
      "generatedBy": {
        "id": "64a7f8e2c3b1d2e3f4a5b6c7",
        "fullName": "Admin User"
      }
    }
  ]
}
```

---

### 7.2 Get Pay Run Details
**GET** `/payruns/:id`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "64a7f8e2c3b1d2e3f4a5b6d5",
    "month": "January",
    "year": "2026",
    "employeeCount": 6,
    "totalGross": 523200,
    "totalDeductions": 42600,
    "totalNetPay": 480600,
    "generatedAt": "2026-01-19T10:30:00Z",
    "records": [
      {
        "id": "64a7f8e2c3b1d2e3f4a5b6d6",
        "employeeId": "1",
        "employeeName": "Alice Johnson",
        "basicSalary": 80000,
        "hra": 32000,
        "conveyance": 1600,
        "telephone": 500,
        "medicalAllowance": 1250,
        "specialAllowance": 14650,
        "totalAllowances": 50000,
        "grossSalary": 130000,
        "totalWorkingDays": 26,
        "payableDays": 26,
        "lossOfPayDays": 0,
        "lossOfPayAmount": 0,
        "advanceDeduction": 0,
        "loanDeduction": 0,
        "pfDeduction": 9600,
        "esiDeduction": 0,
        "professionalTax": 200,
        "tds": 666.67,
        "totalDeductions": 10466.67,
        "netPay": 119533.33
      }
    ]
  }
}
```

---

### 7.3 Generate Pay Run
**POST** `/payruns/generate`

**Request Body:**
```json
{
  "month": "January",
  "year": "2026"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Pay run generated successfully for January 2026",
  "data": {
    "id": "64a7f8e2c3b1d2e3f4a5b6d5",
    "month": "January",
    "year": "2026",
    "employeeCount": 6,
    "totalGross": 523200,
    "totalDeductions": 42600,
    "totalNetPay": 480600
  }
}
```

**Error (409 - Already Exists):**
```json
{
  "success": false,
  "message": "Pay run already exists for January 2026"
}
```

---

### 7.4 Export Pay Run to CSV
**GET** `/payruns/:id/export`

**Response:** CSV file download

---

## 8. Advance APIs

### 8.1 List Advances
**GET** `/advances`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| employee | string | Filter by employee ID |
| status | string | Filter: pending, deducted, partial |
| deductionMonth | string | Filter by deduction month |
| deductionYear | string | Filter by deduction year |

---

### 8.2 Create Advance
**POST** `/advances`

**Request Body:**
```json
{
  "employee": "64a7f8e2c3b1d2e3f4a5b6c7",
  "advanceMonth": "January",
  "advanceYear": "2026",
  "advancePaidAmount": 5000,
  "advanceDeductionMonth": "February",
  "advanceDeductionYear": "2026",
  "remarks": "Emergency advance"
}
```

---

### 8.3 Update Advance
**PUT** `/advances/:id`

### 8.4 Delete Advance
**DELETE** `/advances/:id`

---

## 9. Loan APIs

### 9.1 List Loans
**GET** `/loans`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| employee | string | Filter by employee ID |
| status | string | Filter: active, completed, cancelled |

---

### 9.2 Get Loan with EMI Schedule
**GET** `/loans/:id`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "64a7f8e2c3b1d2e3f4a5b6d7",
    "employee": {
      "id": "64a7f8e2c3b1d2e3f4a5b6c7",
      "name": "Alice Johnson"
    },
    "loanAmount": 60000,
    "interestRate": 0,
    "numberOfEMIs": 12,
    "emiAmount": 5000,
    "totalAmount": 60000,
    "startMonth": "January",
    "startYear": "2026",
    "totalPaidEMIs": 0,
    "remainingBalance": 60000,
    "status": "active",
    "emiSchedule": [
      { "month": "January", "year": "2026", "emiAmount": 5000, "status": "pending" },
      { "month": "February", "year": "2026", "emiAmount": 5000, "status": "pending" },
      ...
    ]
  }
}
```

---

### 9.3 Create Loan
**POST** `/loans`

**Request Body:**
```json
{
  "employee": "64a7f8e2c3b1d2e3f4a5b6c7",
  "loanAmount": 60000,
  "interestRate": 0,
  "numberOfEMIs": 12,
  "startMonth": "January",
  "startYear": "2026",
  "remarks": "Personal loan"
}
```

---

## 10. Salary Calculator API

### 10.1 Calculate Salary from CTC
**POST** `/calculator/salary`

**Request Body:**
```json
{
  "ctc": 1200000,
  "hraPercentage": 10,
  "conveyance": 1600,
  "telephone": 500,
  "medicalAllowance": 1250,
  "includePF": true,
  "includeESI": false,
  "tds": 5
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "monthly": {
      "ctcMonthly": 100000,
      "basic": 50000,
      "hra": 5000,
      "conveyance": 1600,
      "telephone": 500,
      "medicalAllowance": 1250,
      "specialAllowance": 39850,
      "gross": 98200,
      "pfEmployee": 1800,
      "pfEmployer": 1800,
      "esiEmployee": 0,
      "esiEmployer": 0,
      "professionalTax": 200,
      "tds": 4910,
      "net": 91290
    },
    "annual": {
      "ctcAnnual": 1200000,
      "grossAnnual": 1178400,
      "pfEmployeeAnnual": 21600,
      "pfEmployerAnnual": 21600,
      "netAnnual": 1095480
    }
  }
}
```

---

## 11. Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate entry |
| 422 | Unprocessable Entity - Business logic error |
| 500 | Internal Server Error |

---

## 12. API Security

### Headers
```
Authorization: Bearer {accessToken}
Content-Type: application/json
X-Request-ID: {uuid}  // For request tracking
```

### Rate Limiting
- 100 requests per minute per user
- 1000 requests per hour per user

### CORS Configuration
```javascript
{
  origin: ['http://localhost:5173', 'https://hr.ecovale.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}
```
