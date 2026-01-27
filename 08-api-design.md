# API Design - EcoVale HR System

## Overview
This document outlines the RESTful API design for the EcoVale HR backend, including endpoints, request/response formats, authentication, and error handling.

---

## 1. API Architecture

### 1.1 Technology Stack Options

**Option 1: Node.js + Express + TypeScript**
- Consistent with frontend (TypeScript)
- Fast development
- Good ecosystem

**Option 2: Python + FastAPI**
- Modern async framework
- Auto-generated OpenAPI docs
- Type hints and validation

**Option 3: Java + Spring Boot**
- Enterprise-grade
- Robust and scalable
- Strong typing

**Recommendation**: FastAPI or Express based on team expertise

---

### 1.2 API Style: RESTful

**Base URL**: `https://api.ecovale.com/v1`

**Principles**:
- Resource-based URLs
- Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- JSON request/response bodies
- HTTP status codes for errors
- Stateless authentication (JWT)

---

## 2. Authentication & Authorization

### 2.1 User Registration (Admin only)

```
POST /auth/register
Authorization: Bearer {admin_access_token}

Request:
{
  "email": "john.doe@ecovale.com",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "role": "hr",
  "employee_id": "123"
}

Response: 201 Created
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "email": "john.doe@ecovale.com",
    "full_name": "John Doe",
    "role": "hr",
    "is_active": true
  }
}
```

### 2.2 Login

```
POST /auth/login

Request:
{
  "email": "admin@ecovale.com",
  "password": "password123"
}

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "admin@ecovale.com",
    "full_name": "Admin User",
    "role": "admin",
    "employee_id": null
  }
}

Error Responses:
- 401: Invalid credentials
- 423: Account locked (too many failed attempts)
- 403: Account inactive
```

### 2.3 Token Refresh

```
POST /auth/refresh

Request:
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response: 200 OK
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}

Error Responses:
- 401: Invalid or expired refresh token
- 403: Session revoked
```

### 2.4 Logout

```
POST /auth/logout
Authorization: Bearer {access_token}

Response: 204 No Content

Error Responses:
- 401: Invalid token
```

### 2.5 Logout All Devices

```
POST /auth/logout-all
Authorization: Bearer {access_token}

Response: 200 OK
{
  "message": "Logged out from all devices",
  "sessions_terminated": 3
}
```

### 2.6 Request Password Reset

```
POST /auth/password-reset-request

Request:
{
  "email": "user@ecovale.com"
}

Response: 200 OK
{
  "message": "If the email exists, a password reset link has been sent"
}

Note: Always return success to prevent email enumeration
```

### 2.7 Reset Password

```
POST /auth/password-reset

Request:
{
  "token": "uuid-token-from-email",
  "new_password": "NewSecurePass123!"
}

Response: 200 OK
{
  "message": "Password reset successfully. Please login with your new password."
}

Error Responses:
- 400: Invalid or expired token
- 400: Password does not meet requirements
```

### 2.8 Change Password (Authenticated)

```
POST /auth/change-password
Authorization: Bearer {access_token}

Request:
{
  "current_password": "OldPass123!",
  "new_password": "NewSecurePass123!"
}

Response: 200 OK
{
  "message": "Password changed successfully"
}

Error Responses:
- 401: Current password incorrect
- 400: New password does not meet requirements
- 400: New password same as current password
```

### 2.9 Get Current User

```
GET /auth/me
Authorization: Bearer {access_token}

Response: 200 OK
{
  "id": "uuid",
  "email": "admin@ecovale.com",
  "full_name": "Admin User",
  "role": "admin",
  "employee_id": null,
  "is_active": true,
  "last_login": "2026-01-20T10:30:00Z",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### 2.10 List Active Sessions

```
GET /auth/sessions
Authorization: Bearer {access_token}

Response: 200 OK
{
  "sessions": [
    {
      "id": "uuid",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "last_activity": "2026-01-20T10:30:00Z",
      "created_at": "2026-01-20T09:00:00Z",
      "is_current": true
    },
    {
      "id": "uuid",
      "ip_address": "10.0.0.50",
      "user_agent": "Chrome Mobile...",
      "last_activity": "2026-01-19T15:22:00Z",
      "created_at": "2026-01-19T15:00:00Z",
      "is_current": false
    }
  ]
}
```

### 2.11 Revoke Session

```
DELETE /auth/sessions/{session_id}
Authorization: Bearer {access_token}

Response: 200 OK
{
  "message": "Session revoked successfully"
}

Error Responses:
- 403: Cannot revoke another user's session
- 404: Session not found
```

---

## 3. Employee Management APIs

### 3.1 List Employees

```
GET /employees?status=active&department=IT&designation_id=uuid&type=full-time&location=Bangalore&search=alice&page=1&limit=50&sort_by=id&order=asc

Query Parameters:
- status: 'active' | 'inactive' (default: active)
- department: Department name or ID
- designation_id: UUID of designation
- type: 'full-time' | 'part-time'
- location: Work location
- search: Search by name, email, or ID
- page: Page number (default: 1)
- limit: Items per page (default: 50, max: 500)
- sort_by: 'id' | 'name' | 'join_date' | 'ctc' (default: id)
- order: 'asc' | 'desc' (default: asc)

Response: 200 OK
{
  "data": [
    {
      "id": "1",
      "first_name": "Alice",
      "middle_name": null,
      "last_name": "Johnson",
      "official_email": "alice.johnson@ecovale.com",
      "personal_email": "alice.j@gmail.com",
      "contact_number": "9876543210",
      "department": {
        "id": 1,
        "name": "IT"
      },
      "designation": {
        "id": "uuid",
        "title": "Senior Software Engineer"
      },
      "employment_type": "full-time",
      "work_location": "Bangalore",
      "join_date": "2020-03-15",
      "status": "active",
      "reporting_manager": {
        "id": "5",
        "name": "Bob Manager"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 125,
    "pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

### 3.2 Get Employee by ID

```
GET /employees/{id}

Response: 200 OK
{
  "id": "1",
  "status": "active",
  
  "personal_info": {
    "first_name": "Alice",
    "middle_name": null,
    "last_name": "Johnson",
    "date_of_birth": "1992-05-20",
    "age": 33,
    "gender": "Female",
    "blood_group": "O+",
    "contact_number": "9876543210",
    "alternate_contact": "9876543211",
    "emergency_contact": "9876543212",
    "personal_email": "alice.j@gmail.com",
    "current_address": "123 Main St, Bangalore",
    "permanent_address": "456 Home St, Mumbai",
    "father_name": "John Johnson",
    "mother_name": "Mary Johnson",
    "photo": "data:image/jpeg;base64,...",
    "pf_number": "KN/BLR/12345/000001",
    "esi_number": "12-34-567890-000-0001"
  },
  
  "employment_details": {
    "employment_type": "full-time",
    "department": {
      "id": 1,
      "name": "IT",
      "description": "Information Technology"
    },
    "designation": {
      "id": "uuid",
      "title": "Senior Software Engineer",
      "level": 3
    },
    "reporting_manager": {
      "id": "5",
      "name": "Bob Manager",
      "designation": "Engineering Manager",
      "email": "bob.manager@ecovale.com"
    },
    "join_date": "2020-03-15",
    "tenure_years": 5,
    "tenure_months": 10,
    "official_email": "alice.johnson@ecovale.com",
    "work_location": "Bangalore",
    "probation_period": 6,
    "grade": "A"
  },
  
  "salary_info": {
    "ctc": 1560000,
    "basic": 65000,
    "hra_percentage": 40,
    "hra": 26000,
    "conveyance": 1600,
    "telephone": 1000,
    "medical_allowance": 1250,
    "special_allowance": 35150,
    "employee_health_insurance_annual": 1000,
    "gross": 130000,
    "include_pf": true,
    "include_esi": false,
    "pf_deduction": 1800,
    "esi_deduction": 0,
    "employer_pf": 1800,
    "employer_esi": 0,
    "professional_tax": 200,
    "tds": 24000,
    "tds_monthly": 2000,
    "net": 126000,
    "payment_mode": "Bank"
  },
  
  "bank_details": {
    "id": "uuid",
    "bank_name": "HDFC Bank",
    "account_holder_name": "Alice Johnson",
    "account_number": "50100123456789",
    "ifsc_code": "HDFC0001234",
    "branch": "Koramangala, Bangalore",
    "is_primary": true
  },
  
  "documents": [
    {
      "id": "uuid",
      "document_type": "Aadhar",
      "file_name": "aadhar.pdf",
      "upload_date": "2020-03-10T10:00:00Z"
    },
    {
      "id": "uuid",
      "document_type": "PAN",
      "file_name": "pan_card.pdf",
      "upload_date": "2020-03-10T10:05:00Z"
    }
  ],
  
  "career_history": [
    {
      "id": "uuid",
      "event_type": "promotion",
      "event_date": "2023-04-01",
      "details": {
        "from_designation": "Software Engineer",
        "to_designation": "Senior Software Engineer",
        "salary_change": 300000
      }
    }
  ],
  
  "created_at": "2020-03-15T09:00:00Z",
  "updated_at": "2025-12-01T15:30:00Z"
}

Error Responses:
- 404: Employee not found
- 403: Not authorized to view this employee
```

### 3.3 Create Employee

```
POST /employees
Authorization: Bearer {access_token}
Roles: admin, hr

Request:
{
  "personal_info": {
    "first_name": "John",
    "middle_name": "Robert",
    "last_name": "Doe",
    "date_of_birth": "1995-08-15",
    "gender": "Male",
    "blood_group": "A+",
    "contact_number": "9988776655",
    "alternate_contact": "9988776656",
    "emergency_contact": "9988776657",
    "personal_email": "john.doe@gmail.com",
    "current_address": "789 New St, Bangalore",
    "permanent_address": "321 Old St, Delhi",
    "father_name": "Robert Doe",
    "mother_name": "Jane Doe",
    "photo": "data:image/jpeg;base64,...",
    "pf_number": "KN/BLR/12345/000099",
    "esi_number": null
  },
  "employment_details": {
    "employment_type": "full-time",
    "department_id": 1,
    "designation_id": "uuid",
    "reporting_manager_id": "5",
    "join_date": "2026-02-01",
    "work_location": "Bangalore",
    "probation_period": 6,
    "grade": "B"
  },
  "salary_info": {
    "ctc": 1200000,
    "hra_percentage": 40,
    "conveyance": 1600,
    "telephone": 1000,
    "medical_allowance": 1250,
    "employee_health_insurance_annual": 1000,
    "include_pf": true,
    "include_esi": false,
    "tds": 12000,
    "payment_mode": "Bank"
  },
  "bank_details": {
    "bank_name": "State Bank of India",
    "account_holder_name": "John Robert Doe",
    "account_number": "12345678901234",
    "ifsc_code": "SBIN0001234",
    "branch": "MG Road, Bangalore"
  }
}

Response: 201 Created
{
  "message": "Employee created successfully",
  "data": {
    "id": "126",
    "official_email": "john.doe@ecovale.com",
    "status": "active",
    ...full employee object...
  }
}

Error Responses:
- 400: Validation error (missing required fields, invalid data)
- 409: Duplicate email, PF number, or ESI number
- 403: Not authorized to create employees
```

### 3.4 Update Employee

```
PUT /employees/{id}
Authorization: Bearer {access_token}
Roles: admin, hr

Request: (Same structure as Create, all fields optional)
{
  "personal_info": {
    "contact_number": "9999888877"
  },
  "salary_info": {
    "ctc": 1500000,
    "hra_percentage": 50
  }
}

Response: 200 OK
{
  "message": "Employee updated successfully",
  "data": {
    ...updated employee object...
  },
  "changes": {
    "contact_number": {
      "old": "9988776655",
      "new": "9999888877"
    },
    "ctc": {
      "old": 1200000,
      "new": 1500000
    }
  }
}

Error Responses:
- 404: Employee not found
- 400: Validation error
- 409: Duplicate unique field (email, PF, ESI)
- 403: Not authorized to update employees
```

### 3.5 Delete Employee (Soft Delete)

```
DELETE /employees/{id}
Authorization: Bearer {access_token}
Roles: admin

Response: 200 OK
{
  "message": "Employee marked as inactive",
  "id": "126"
}

Error Responses:
- 404: Employee not found
- 403: Not authorized
- 409: Cannot delete employee with active payroll records (use soft delete)
```

### 3.6 Reactivate Employee

```
POST /employees/{id}/reactivate
Authorization: Bearer {access_token}
Roles: admin

Response: 200 OK
{
  "message": "Employee reactivated successfully",
  "data": {
    ...employee object with status: active...
  }
}
```

### 3.7 Get Employee Hierarchy (Subordinates)

```
GET /employees/{id}/subordinates
Authorization: Bearer {access_token}

Response: 200 OK
{
  "manager": {
    "id": "5",
    "name": "Bob Manager",
    "designation": "Engineering Manager"
  },
  "direct_reports": [
    {
      "id": "1",
      "name": "Alice Johnson",
      "designation": "Senior Software Engineer",
      "level": 1
    },
    {
      "id": "7",
      "name": "Charlie Dev",
      "designation": "Software Engineer",
      "level": 1
    }
  ],
  "all_subordinates": [
    {
      "id": "1",
      "name": "Alice Johnson",
      "designation": "Senior Software Engineer",
      "level": 1
    },
    {
      "id": "7",
      "name": "Charlie Dev",
      "designation": "Software Engineer",
      "level": 1
    },
    {
      "id": "23",
      "name": "David Junior",
      "designation": "Junior Developer",
      "level": 2,
      "reports_to": "1"
    }
  ],
  "total_subordinates": 3
}
```

### 3.8 Get Employee Reporting Chain

```
GET /employees/{id}/reporting-chain
Authorization: Bearer {access_token}

Response: 200 OK
{
  "employee": {
    "id": "1",
    "name": "Alice Johnson",
    "designation": "Senior Software Engineer"
  },
  "reporting_chain": [
    {
      "id": "5",
      "name": "Bob Manager",
      "designation": "Engineering Manager",
      "level": 1
    },
    {
      "id": "2",
      "name": "Carol Director",
      "designation": "Director of Engineering",
      "level": 2
    },
    {
      "id": "3",
      "name": "Dave CEO",
      "designation": "Chief Executive Officer",
      "level": 3
    }
  ]
}
```

### 3.9 Bulk Import Employees

```
POST /employees/bulk-import
Authorization: Bearer {access_token}
Roles: admin, hr
Content-Type: multipart/form-data

Request:
file: employees.csv (or .xlsx)

CSV Format:
first_name,last_name,gender,contact_number,personal_email,employment_type,department_id,designation_id,ctc,join_date,...

Response: 200 OK
{
  "message": "Bulk import completed",
  "success_count": 45,
  "error_count": 5,
  "errors": [
    {
      "row": 3,
      "error": "Duplicate official email: john.doe@ecovale.com"
    },
    {
      "row": 12,
      "error": "Invalid department_id: 999"
    }
  ],
  "imported_ids": ["127", "128", "129", ...]
}

Error Responses:
- 400: Invalid file format
- 413: File too large
- 403: Not authorized
```

### 3.10 Export Employees

```
GET /employees/export?format=csv&status=active&department=IT
Authorization: Bearer {access_token}

Query Parameters:
- format: 'csv' | 'xlsx' | 'json' (default: csv)
- All filters from List Employees apply

Response: 200 OK
Content-Type: text/csv (or application/vnd.ms-excel, or application/json)
Content-Disposition: attachment; filename="employees_2026-01-20.csv"

[File download with employee data]
```

### 3.11 Search Employees (Advanced)

```
POST /employees/search
Authorization: Bearer {access_token}

Request:
{
  "query": "alice",
  "filters": {
    "status": ["active"],
    "departments": [1, 2],
    "designations": ["uuid1", "uuid2"],
    "locations": ["Bangalore", "Mangaluru"],
    "employment_types": ["full-time"],
    "join_date_from": "2020-01-01",
    "join_date_to": "2025-12-31",
    "ctc_min": 500000,
    "ctc_max": 2000000,
    "age_min": 25,
    "age_max": 40
  },
  "sort": {
    "field": "ctc",
    "order": "desc"
  },
  "page": 1,
  "limit": 50
}

Response: 200 OK
{
  "data": [...employees matching criteria...],
  "pagination": {...},
  "facets": {
    "departments": {
      "IT": 45,
      "HR": 12
    },
    "locations": {
      "Bangalore": 38,
      "Mangaluru": 19
    }
  }
}
```

---
      "join_date": "2020-03-15"
    },
    ...
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

### 3.2 Get Employee by ID

```
GET /employees/{id}

Response:
{
  "id": "1",
  "personal_info": {
    "first_name": "Alice",
    "last_name": "Johnson",
    "gender": "Female",
    "date_of_birth": "1992-05-20",
    "contact_number": "9876543210",
    ...
  },
  "employment_details": {
    "type": "full-time",
    "department": "IT",
    "designation": "Senior Software Engineer",
    "join_date": "2020-03-15",
    ...
  },
  "salary_info": {
    "ctc": 1560000,
    "basic": 80000,
    "hra": 32000,
    "gross": 130000,
    "net": 112533,
    ...
  },
  "bank_details": {
    "bank_name": "HDFC Bank",
    "account_number": "50100123456789",
    ...
  },
  "documents": [...],
  "career_history": [...]
}
```

### 3.3 Create Employee

```
POST /employees
{
  "personal_info": {...},
  "employment_details": {...},
  "salary_info": {...}
}

Response: 201 Created
{
  "id": "7",
  "message": "Employee created successfully",
  "data": {...}
}
```

### 3.4 Update Employee

```
PUT /employees/{id}
{
  "personal_info": {...},
  "employment_details": {...},
  "salary_info": {...}
}

Response: 200 OK
{
  "message": "Employee updated successfully",
  "data": {...}
}
```

### 3.5 Delete Employee (Soft Delete)

```
DELETE /employees/{id}

Response: 200 OK
{
  "message": "Employee deactivated successfully"
}
```

---

## 4. Department & Designation APIs

### 4.1 List Departments

```
GET /departments

Response:
{
  "data": [
    {"id": 1, "name": "IT", "description": "Information Technology"},
    {"id": 2, "name": "HR", "description": "Human Resources"},
    ...
  ]
}
```

### 4.2 List Designations

```
GET /designations?department_id=1

Response:
{
  "data": [
    {
      "id": "uuid",
      "title": "Software Engineer",
      "department": "IT",
      "level": 3,
      "description": "..."
    },
    ...
  ]
}
```

### 4.3 Create Designation

```
POST /designations
{
  "title": "DevOps Engineer",
  "department_id": 1,
  "description": "Manages infrastructure",
  "level": 3
}

Response: 201 Created
```

---

## 5. Attendance APIs

### 5.1 Get Attendance Records

```
GET /attendance?employee_id=1&month=January&year=2026

Response:
{
  "data": [
    {
      "id": "ATT1234567890",
      "employee_id": "1",
      "employee_name": "Alice Johnson",
      "month": "January",
      "year": "2026",
      "total_working_days": 26,
      "present_days": 24,
      "absent_days": 0,
      "paid_leave": 2,
      "unpaid_leave": 0,
      "payable_days": 26,
      "loss_of_pay_days": 0
    }
  ]
}
```

### 5.2 Create/Update Attendance

```
POST /attendance
{
  "employee_id": "1",
  "month": "January",
  "year": "2026",
  "total_working_days": 26,
  "present_days": 24,
  "absent_days": 0,
  "paid_leave": 2,
  "unpaid_leave": 0,
  "remarks": ""
}

Response: 201 Created (or 200 OK if update)
```

---

## 6. Payroll APIs

### 6.1 Generate Pay Run

```
POST /payroll/pay-runs
{
  "month": "January",
  "year": "2026"
}

Response: 201 Created
{
  "id": "PR1234567890",
  "month": "January",
  "year": "2026",
  "total_employees": 100,
  "total_gross": 10000000,
  "total_deductions": 1500000,
  "total_net_pay": 8500000,
  "status": "draft",
  "employee_records": [...]
}
```

### 6.2 Get Pay Run

```
GET /payroll/pay-runs/{id}

Response:
{
  "id": "PR1234567890",
  "month": "January",
  "year": "2026",
  "employee_records": [
    {
      "employee_id": "1",
      "employee_name": "Alice Johnson",
      "gross_salary": 130000,
      "total_deductions": 17467,
      "net_pay": 112533,
      ...
    },
    ...
  ],
  "status": "draft"
}
```

### 6.3 Approve Pay Run

```
PATCH /payroll/pay-runs/{id}/approve

Response: 200 OK
{
  "message": "Pay run approved",
  "status": "approved"
}
```

### 6.4 Process Pay Run

```
POST /payroll/pay-runs/{id}/process

Response: 200 OK
{
  "message": "Pay run processed successfully",
  "status": "processed"
}
```

---

## 7. Advance & Loan APIs

### 7.1 List Advances

```
GET /advances?employee_id=1&status=pending

Response:
{
  "data": [
    {
      "id": "uuid",
      "employee_id": "1",
      "employee_name": "Alice Johnson",
      "advance_paid_amount": 10000,
      "advance_month": "January",
      "advance_year": "2026",
      "advance_deduction_month": "February",
      "advance_deduction_year": "2026",
      "status": "pending"
    },
    ...
  ]
}
```

### 7.2 Create Advance

```
POST /advances
{
  "employee_id": "1",
  "advance_paid_amount": 10000,
  "advance_month": "January",
  "advance_year": "2026",
  "advance_deduction_month": "February",
  "advance_deduction_year": "2026",
  "remarks": "Medical emergency"
}

Response: 201 Created
```

### 7.3 List Loans

```
GET /loans?employee_id=1&status=active

Response:
{
  "data": [
    {
      "id": "uuid",
      "employee_id": "1",
      "loan_amount": 50000,
      "interest_rate": 10,
      "number_of_emis": 12,
      "emi_amount": 4583.33,
      "remaining_balance": 45000,
      "status": "active",
      "emi_schedule": [...]
    }
  ]
}
```

### 7.4 Create Loan

```
POST /loans
{
  "employee_id": "1",
  "loan_amount": 50000,
  "interest_rate": 10,
  "number_of_emis": 12,
  "start_month": "February",
  "start_year": "2026",
  "remarks": "Home renovation"
}

Response: 201 Created
```

---

## 8. Document APIs

### 8.1 Upload Document

```
POST /employees/{id}/documents
Content-Type: multipart/form-data

FormData:
- document_type: "Aadhar"
- file: [binary]

Response: 201 Created
{
  "id": "uuid",
  "document_type": "Aadhar",
  "file_name": "aadhar_scan.pdf",
  "upload_date": "2026-01-19T12:00:00Z"
}
```

### 8.2 Download Document

```
GET /employees/{id}/documents/{doc_id}

Response: Binary file with appropriate Content-Type header
```

### 8.3 Delete Document

```
DELETE /employees/{id}/documents/{doc_id}

Response: 204 No Content
```

---

## 9. Letter Generation APIs

### 9.1 Generate Offer Letter

```
POST /letters/offer
{
  "employee_id": "1",
  "join_date": "2026-03-01",
  "additional_terms": "..."
}

Response: 200 OK
{
  "letter_id": "uuid",
  "letter_type": "offer_letter",
  "content": "...",
  "download_url": "/letters/download/{uuid}"
}
```

### 9.2 Generate Payslip

```
POST /payroll/payslips
{
  "employee_id": "1",
  "month": "January",
  "year": "2026"
}

Response: 200 OK
{
  "payslip_id": "uuid",
  "download_url": "/payroll/payslips/download/{uuid}"
}
```

---

## 10. Analytics & Reports APIs

### 10.1 Employee Statistics

```
GET /analytics/employees/stats

Response:
{
  "total_employees": 100,
  "active_employees": 95,
  "inactive_employees": 5,
  "by_department": {
    "IT": 40,
    "HR": 10,
    "Finance": 20,
    "Sales": 20,
    "Marketing": 10
  },
  "by_type": {
    "full_time": 90,
    "part_time": 10
  }
}
```

### 10.2 Payroll Summary

```
GET /analytics/payroll/summary?year=2026

Response:
{
  "year": "2026",
  "monthly_summary": [
    {
      "month": "January",
      "total_gross": 10000000,
      "total_deductions": 1500000,
      "total_net": 8500000,
      "employee_count": 100
    },
    ...
  ]
}
```

---

## 11. Error Handling

### 11.1 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid employee data",
    "details": [
      {"field": "email", "message": "Invalid email format"},
      {"field": "ctc", "message": "CTC must be positive"}
    ]
  }
}
```

### 11.2 HTTP Status Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error, malformed JSON |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate email, unique constraint |
| 422 | Unprocessable Entity | Business logic error |
| 500 | Internal Server Error | Server error |

---

## 12. Request/Response Standards

### 12.1 Request Headers

```
Content-Type: application/json
Authorization: Bearer {access_token}
Accept: application/json
```

### 12.2 Response Headers

```
Content-Type: application/json
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642608000
```

### 12.3 Pagination

```
GET /employees?page=2&limit=50

Response:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 150,
    "pages": 3,
    "has_next": true,
    "has_prev": true
  }
}
```

### 12.4 Filtering

```
GET /employees?status=active&department=IT&employment_type=full-time
```

### 12.5 Sorting

```
GET /employees?sort=join_date&order=desc
```

### 12.6 Field Selection

```
GET /employees?fields=id,first_name,last_name,email
```

---

## 13. Versioning

### 13.1 URL Versioning (Recommended)

```
/v1/employees
/v2/employees
```

### 13.2 Header Versioning (Alternative)

```
Accept: application/vnd.ecovale.v1+json
```

---

## 14. Rate Limiting

```
Rate Limit: 1000 requests per hour per user

Response Headers:
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642608000

429 Too Many Requests:
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 3600 seconds."
  }
}
```

---

## 15. OpenAPI/Swagger Documentation

**Auto-generate API docs** using:
- **FastAPI**: Built-in OpenAPI support at `/docs`
- **Express**: Use `swagger-jsdoc` + `swagger-ui-express`
- **Spring Boot**: Use Springdoc OpenAPI

**Access**: `https://api.ecovale.com/docs`

---

## Summary

This API design provides:
- **50+ RESTful endpoints** covering all HR operations
- **JWT-based authentication** with refresh tokens
- **Standard HTTP methods and status codes**
- **Pagination, filtering, sorting, field selection**
- **Comprehensive error handling**
- **Rate limiting and security**
- **OpenAPI documentation**

**Implementation Priority**:
1. Phase 1: Auth, Employees, Departments, Designations
2. Phase 2: Attendance, Payroll
3. Phase 3: Advances, Loans
4. Phase 4: Documents, Letters, Analytics

This API contract serves as the interface between the frontend and the new database-backed backend, replacing the current `storageService.ts` simulated backend.
