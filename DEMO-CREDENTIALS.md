# 👥 Demo Credentials & Test Accounts

This document contains test credentials for the Ecovale HR Management System public demo.

## 🔐 Admin Account

**Full Administrator Access:**
```
Username: demo_admin
Password: Demo@2026!Secure
Email: admin@ecovale-demo.com
Roles: ADMIN, HR, MANAGER
```

**Permissions:**
- ✅ Full employee CRUD operations
- ✅ Leave management (approve/reject all levels)
- ✅ Payroll and salary management
- ✅ Audit log access
- ✅ System configuration
- ✅ User management
- ✅ Designation and department management

---

## 👨‍💼 Manager Account

**Department Manager Access:**
```
Username: john_manager
Password: Manager@2026!
Email: john.manager@ecovale-demo.com
Roles: MANAGER, HR
```

**Permissions:**
- ✅ View all employees in department
- ✅ Level 1 leave approvals
- ✅ View attendance records
- ✅ Generate team reports
- ❌ Cannot approve admin-level items
- ❌ No audit log access

---

## 👔 HR Account

**HR Department Access:**
```
Username: sarah_hr
Password: HR@2026!Demo
Email: sarah.hr@ecovale-demo.com
Roles: HR
```

**Permissions:**
- ✅ Employee onboarding
- ✅ View all employee records
- ✅ Update employee information
- ✅ Generate HR reports
- ✅ Manage designations
- ❌ Cannot approve leaves (manager role required)
- ❌ No system configuration access

---

## 🧑‍💻 Employee Accounts

### Test Employee 1
```
Username: alice_employee
Password: Employee@2026!
Email: alice@ecovale-demo.com
Employee ID: EMP001
Roles: EMPLOYEE
Department: IT
Designation: Senior Software Engineer
```

### Test Employee 2
```
Username: bob_employee
Password: Employee@2026!
Email: bob@ecovale-demo.com
Employee ID: EMP002
Roles: EMPLOYEE
Department: Finance
Designation: Financial Analyst
```

### Test Employee 3
```
Username: carol_employee
Password: Employee@2026!
Email: carol@ecovale-demo.com
Employee ID: EMP003
Roles: EMPLOYEE
Department: Marketing
Designation: Marketing Specialist
```

**Employee Permissions:**
- ✅ View own profile and salary details
- ✅ Submit leave requests
- ✅ View leave balance and history
- ✅ Mark attendance (check-in/check-out)
- ✅ View own payslips
- ❌ Cannot view other employees
- ❌ Cannot approve leaves
- ❌ No administrative access

---

## 🔑 API Access

### Authentication

**Obtain JWT Token:**

```bash
curl -X POST https://YOUR-BACKEND.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo_admin",
    "password": "Demo@2026!Secure"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "type": "Bearer",
    "id": 1,
    "username": "demo_admin",
    "email": "admin@ecovale-demo.com",
    "fullName": "Demo Administrator",
    "roles": ["ROLE_ADMIN", "ROLE_HR", "ROLE_MANAGER"]
  }
}
```

### Using the Token

```bash
# Example: Get all employees
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://YOUR-BACKEND.railway.app/api/v1/employees
```

---

## 📊 Demo Data

### Pre-seeded Employees

The demo includes **15 test employees** across different departments:

**IT Department (5):**
- Alice (Senior Software Engineer)
- David (DevOps Engineer)
- Emma (QA Engineer)
- Frank (Backend Developer)
- Grace (Frontend Developer)

**Finance (3):**
- Bob (Financial Analyst)
- Hannah (Accountant)
- Ian (Budget Manager)

**Marketing (3):**
- Carol (Marketing Specialist)
- Jack (Content Writer)
- Kelly (Social Media Manager)

**HR (2):**
- Sarah (HR Manager) - has HR role
- Linda (HR Executive)

**Sales (2):**
- Mike (Sales Executive)
- Nancy (Business Development Manager)

### Leave Types Available

1. **CASUAL_LEAVE** - 12 days/year
2. **SICK_LEAVE** - 10 days/year
3. **EARNED_LEAVE** - 15 days/year
4. **MATERNITY_LEAVE** - 180 days
5. **PATERNITY_LEAVE** - 15 days
6. **UNPAID_LEAVE** - Unlimited
7. **COMPENSATORY_OFF** - Based on overtime
8. **BEREAVEMENT_LEAVE** - 5 days
9. **MARRIAGE_LEAVE** - 5 days

### Sample Leave Requests

**Pending Approval:**
- Alice requested 3 days casual leave (Feb 15-17, 2026)
- Bob requested 2 days sick leave (Feb 20-21, 2026)

**Manager Approved (awaiting admin):**
- Carol's 5 days earned leave (March 1-5, 2026)

**Fully Approved:**
- David's 1 day compensatory off (Jan 30, 2026)

---

## 🧪 Testing Scenarios

### Scenario 1: Employee Leave Request Flow

1. **Login as Employee:**
   - Username: `alice_employee`
   - Create new leave request for future dates
   - Status should be `PENDING`

2. **Login as Manager:**
   - Username: `john_manager`
   - View pending leaves
   - Approve Alice's leave
   - Status becomes `MANAGER_APPROVED`

3. **Login as Admin:**
   - Username: `demo_admin`
   - View manager-approved leaves
   - Give final approval
   - Status becomes `ADMIN_APPROVED`

### Scenario 2: Employee Onboarding

1. **Login as Admin/HR:**
   - Navigate to "New Employee" page
   - Fill out employee form:
     ```
     Employee ID: EMP016
     Full Name: Test User
     Email: test@ecovale-demo.com
     Department: IT
     Designation: Software Engineer
     Salary: 75000
     Join Date: 2026-02-01
     ```
   - Submit and verify employee created

2. **Login with New Employee:**
   - Default password: Same as employee ID or set during creation
   - Verify access to employee portal

### Scenario 3: Attendance Marking

1. **Login as Employee:**
   - Navigate to Attendance page
   - Mark check-in (current time)
   - Wait 8 hours (or manually set)
   - Mark check-out
   - Verify attendance recorded

### Scenario 4: Salary & Payroll

1. **Login as Admin:**
   - Navigate to Payroll page
   - Generate payslip for employee
   - Download salary annexure
   - Verify calculations

---

## 🔗 API Endpoints Reference

### Authentication
- `POST /api/v1/auth/login` - Login and get JWT token
- `POST /api/v1/auth/register` - Register new user (admin only)

### Employees
- `GET /api/v1/employees` - List all employees (admin/HR)
- `POST /api/v1/employees` - Create employee (admin/HR)
- `GET /api/v1/employees/{id}` - Get employee by ID
- `PUT /api/v1/employees/{id}` - Update employee (admin/HR)
- `DELETE /api/v1/employees/{id}` - Delete employee (admin)

### Leaves
- `POST /api/v1/leaves` - Create leave request (any employee)
- `GET /api/v1/leaves` - Get all leaves (admin) or own leaves (employee)
- `GET /api/v1/leaves/{id}` - Get leave by ID
- `PUT /api/v1/leaves/{id}/manager-approve` - Manager approval
- `PUT /api/v1/leaves/{id}/admin-approve` - Admin approval
- `PUT /api/v1/leaves/{id}/reject` - Reject leave
- `GET /api/v1/leaves/statistics` - Leave statistics

### Attendance
- `POST /api/v1/attendance` - Mark attendance
- `GET /api/v1/attendance` - Get attendance records

### Designations
- `GET /api/v1/designations` - List designations
- `POST /api/v1/designations` - Create designation (admin)

### Audit Logs
- `GET /api/v1/admin/audit-logs` - View audit logs (admin only)

**Full API Documentation:** See [API-DOCUMENTATION.md](backend/API-DOCUMENTATION.md)

---

## 🎯 Quick Test Links

**Frontend Demo:**
- URL: `https://YOUR-FRONTEND.netlify.app`
- Login page: `/` (auto-redirects if not logged in)
- Dashboard: `/dashboard`
- Employees: `/employees`
- New Employee: `/new-employee`
- Leaves: `/leaves`

**Backend API:**
- Base URL: `https://YOUR-BACKEND.railway.app/api/v1`
- Health: `/api/v1/health`
- Swagger UI: `/swagger-ui.html` (if enabled)
- Actuator: `/actuator/health`

---

## 🛡️ Security Notes for Demo

**Public Demo Considerations:**

1. **Password Policy:**
   - All demo passwords follow pattern: `Role@2026!`
   - Change these for production use
   - Consider implementing password expiry

2. **Rate Limiting:**
   - 100 requests/minute per IP (already configured)
   - Prevents API abuse

3. **Data Reset:**
   - Consider daily/weekly database resets for public demo
   - Prevent data accumulation from test users

4. **Monitoring:**
   - Set up UptimeRobot or similar
   - Monitor for unusual activity
   - Alert on repeated failed logins

5. **Sensitive Operations:**
   - Employee deletion requires ADMIN role
   - Audit logs track all operations
   - Cannot disable audit logging

---

## 📝 Usage Guidelines for Demo Users

**DO:**
- ✅ Test all features and workflows
- ✅ Create sample employees and leave requests
- ✅ Generate reports and export data
- ✅ Test different user roles
- ✅ Explore API endpoints

**DON'T:**
- ❌ Use real personal information
- ❌ Upload sensitive documents
- ❌ Attempt to break authentication
- ❌ Perform load testing without permission
- ❌ Delete existing demo accounts

---

## 🔄 Resetting Demo Data

**Manual Reset (Admin Only):**

1. **Login as Admin:**
   ```
   Username: demo_admin
   Password: Demo@2026!Secure
   ```

2. **Delete Test Data:**
   - Navigate to each module
   - Delete user-created test entries
   - Keep pre-seeded demo accounts

**Automated Reset (Backend):**

```bash
# Run Flyway clean and migrate (WARNING: Deletes all data!)
mvn flyway:clean flyway:migrate

# Or restart Railway/Render with database reset
```

---

## 📞 Support

**For Demo Issues:**
- Check [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) troubleshooting section
- Review [API-DOCUMENTATION.md](backend/API-DOCUMENTATION.md)
- Open GitHub issue with "Demo" label

**For Production Setup:**
- See [ARCHITECTURE.md](ARCHITECTURE.md)
- Contact: devops@ecovale.com

---

## 📊 Demo Statistics

**Last Reset:** January 26, 2026  
**Total Employees:** 15  
**Active Leave Requests:** 4  
**Attendance Records:** 150+  
**Audit Log Entries:** 500+

---

**Enjoy exploring the Ecovale HR Management System! 🚀**

**Demo Version:** 1.0.0  
**Last Updated:** January 26, 2026
