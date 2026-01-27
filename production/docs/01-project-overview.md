# Project Overview - EcoVale HR Management System

## 1. Application Purpose

EcoVale HR is a comprehensive Human Resources Management System designed for small to medium-sized enterprises (SMEs) in India. The application handles:

- **Employee Management**: Complete employee lifecycle from onboarding to exit
- **Payroll Processing**: Salary calculations with Indian statutory compliance (PF, ESI, PT, TDS)
- **Attendance Tracking**: Monthly attendance records with LOP calculations
- **Advance & Loan Management**: Employee advances and loan EMI scheduling
- **Document Management**: Employee documents storage and retrieval
- **Letter Generation**: Appointment letters and salary annexures

---

## 2. Business Domain

### Industry Context
- **Target**: Indian SMEs with 10-500 employees
- **Compliance**: Indian labor laws, PF Act, ESI Act, Income Tax Act
- **Currency**: Indian Rupees (INR)

### Core Business Entities
1. **Employees** - Central entity with personal, employment, and salary information
2. **Departments** - Organizational units (IT, HR, Finance, Sales, Marketing)
3. **Designations** - Job titles with hierarchy levels
4. **Attendance** - Monthly attendance records per employee
5. **Pay Runs** - Monthly payroll processing batches
6. **Advances** - Salary advances with deduction scheduling
7. **Loans** - Employee loans with EMI schedules

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization
| Feature | Description |
|---------|-------------|
| User Login | Email/password authentication |
| Session Management | JWT-based token authentication |
| Role-Based Access | Admin, HR, Manager, Employee roles |
| Password Security | bcrypt hashing, minimum 6 characters |

### 3.2 Employee Management
| Feature | Description |
|---------|-------------|
| Employee Registration | Create new employee with all details |
| Employee Listing | View, search, filter, sort employees |
| Employee Profile | View/edit complete employee information |
| Status Management | Active/inactive employee status |
| Document Upload | Store employee documents (Aadhar, PAN, etc.) |
| Photo Upload | Employee profile photo |

### 3.3 Organizational Structure
| Feature | Description |
|---------|-------------|
| Departments | Pre-defined departments with CRUD |
| Designations | Job titles with department mapping |
| Reporting Hierarchy | Manager-reportee relationships |
| Work Locations | Multiple office locations support |

### 3.4 Salary Management
| Feature | Description |
|---------|-------------|
| CTC-Based Calculation | Annual CTC → monthly components |
| Statutory Deductions | PF (12%), ESI (0.75%), PT, TDS |
| Allowances | HRA, Conveyance, Telephone, Medical, Special |
| Bank Details | Multiple bank accounts per employee |
| Salary Annexure | Downloadable salary breakdown |

### 3.5 Attendance Management
| Feature | Description |
|---------|-------------|
| Monthly Attendance | Present days, absent days, leaves |
| Leave Types | Paid leave, unpaid leave |
| LOP Calculation | Loss of Pay based on attendance |
| Working Days | Configurable working days per month |

### 3.6 Payroll Processing
| Feature | Description |
|---------|-------------|
| Pay Run Generation | Monthly payroll batch processing |
| Pro-rata Calculation | Salary adjusted for attendance |
| Deduction Integration | Advances, loans, LOP deducted |
| Export to CSV | Downloadable payroll reports |
| Payslip Generation | Individual employee payslips |

### 3.7 Financial Management
| Feature | Description |
|---------|-------------|
| Advance Register | Record salary advances |
| Advance Deduction | Schedule deduction in future month |
| Loan Register | Record employee loans |
| EMI Schedule | Auto-generate EMI schedule |
| EMI Tracking | Track paid/pending EMIs |

---

## 4. Non-Functional Requirements

### 4.1 Performance
- Page load time < 2 seconds
- API response time < 500ms
- Support 100 concurrent users
- Handle 10,000+ employee records

### 4.2 Security
- HTTPS encryption
- JWT token expiry (1 hour access, 7 days refresh)
- Password hashing (bcrypt, 10 rounds)
- Input validation and sanitization
- SQL/NoSQL injection prevention
- XSS protection
- CORS configuration

### 4.3 Scalability
- Horizontal scaling support
- Stateless API design
- Database indexing strategy
- Caching layer (optional Redis)

### 4.4 Reliability
- 99.9% uptime target
- Automated backups
- Error logging and monitoring
- Graceful error handling

### 4.5 Maintainability
- Clean MVC architecture
- Modular code structure
- Comprehensive documentation
- Code comments and JSDoc

---

## 5. User Roles & Permissions

### 5.1 Admin
- Full access to all modules
- User management
- System configuration

### 5.2 HR Manager
- Employee CRUD operations
- Payroll processing
- Attendance management
- Advance/loan management

### 5.3 Manager
- View team members
- Approve attendance
- View team reports

### 5.4 Employee (Future)
- View own profile
- View own payslips
- View own attendance

---

## 6. Current Frontend Features (To Migrate)

Based on analysis of existing codebase:

| Page | File | Features |
|------|------|----------|
| Dashboard | DashboardPage.tsx | Overview stats, quick actions |
| Employees | EmployeesPage.tsx | List, search, filter, CRUD |
| New Employee | NewEmployeePage.tsx | Form with salary calculator |
| Designations | DesignationsPage.tsx | Designation management |
| Attendance | AttendanceRegisterPage.tsx | Monthly attendance CRUD |
| Pay Run | PayRunPage.tsx | Generate monthly payroll |
| Payslip | PayslipPage.tsx | View/download payslips |
| Advance Register | AdvanceRegisterPage.tsx | Advance management |
| Loan Register | LoanRegisterPage.tsx | Loan with EMI schedule |
| Letters | LettersPage.tsx | Letter templates |
| Documents | DocumentsPage.tsx | Employee documents |
| Onboarding | EmployeeOnboarding.tsx | Onboarding workflow |
| Calculator | CalculatorPage.tsx | PF/ESI calculator |
| Career | CareerPage.tsx | Career history |
| Settings | SettingsPage.tsx | System settings |

---

## 7. Technology Decisions

### Why MERN Stack?
1. **JavaScript Everywhere** - Single language for frontend and backend
2. **MongoDB** - Flexible schema for evolving requirements
3. **Express.js** - Lightweight, fast, well-documented
4. **React** - Already used in frontend prototype
5. **Node.js** - Event-driven, non-blocking I/O

### Why Pure JavaScript (No TypeScript)?
1. **Faster Development** - No compilation step
2. **Lower Learning Curve** - Team familiarity
3. **Direct Debugging** - No source maps needed
4. **JSDoc Support** - Type hints without TypeScript

### Why MVC Architecture?
1. **Separation of Concerns** - Clear code organization
2. **Testability** - Easy to unit test each layer
3. **Maintainability** - Easier to understand and modify
4. **Scalability** - Add features without major refactoring

---

## 8. Project Constraints

### Technical Constraints
- Must use JavaScript only (no TypeScript)
- Must follow MVC pattern
- Must support existing frontend components
- Must handle Indian statutory calculations

### Business Constraints
- Must comply with Indian labor laws
- Must support INR currency
- Must work in Indian timezones
- Must handle Indian date formats

### Time Constraints
- Phase 1-5 implementation in 10 weeks
- MVP ready in 6 weeks

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| API Response Time | < 500ms |
| Page Load Time | < 2 seconds |
| Test Coverage | > 70% |
| Uptime | 99.9% |
| Bug Fix Time | < 24 hours |
| Feature Delivery | On schedule |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| CTC | Cost to Company - Annual total compensation |
| PF | Provident Fund - Employee retirement savings |
| ESI | Employee State Insurance - Health insurance |
| PT | Professional Tax - State-level income tax |
| TDS | Tax Deducted at Source - Income tax |
| HRA | House Rent Allowance |
| LOP | Loss of Pay - Salary deducted for absence |
| EMI | Equated Monthly Installment |
| IFSC | Indian Financial System Code |
