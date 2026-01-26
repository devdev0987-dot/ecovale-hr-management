# Leave Management Module Documentation

## Overview

The Leave Management module provides a complete workflow for employees to request leave, managers to approve at the first level, and admins to provide final approval. The system includes role-based access control, status tracking, audit logging, and validation.

---

## Approval Workflow

```
PENDING → MANAGER_APPROVED → ADMIN_APPROVED (Final)
         ↓                  ↓
      REJECTED          REJECTED
```

**Workflow Steps:**
1. **Employee** submits leave request → Status: `PENDING`
2. **Manager** reviews and approves → Status: `MANAGER_APPROVED`
3. **Admin** provides final approval → Status: `ADMIN_APPROVED` (leave is granted)

**Rejection:** Manager or Admin can reject at any stage → Status: `REJECTED`  
**Cancellation:** Employee can cancel before final approval → Status: `CANCELLED`

---

## Entities & Database Schema

### LeaveRequest Entity

**Table:** `leave_requests`

| Field | Type | Description |
|-------|------|-------------|
| `id` | BIGINT (PK) | Auto-generated ID |
| `employee_id` | VARCHAR(50) | Employee identifier |
| `employee_name` | VARCHAR(100) | Full name |
| `employee_email` | VARCHAR(150) | Email address |
| `leave_type` | ENUM | Type of leave (see below) |
| `start_date` | DATE | Leave start date |
| `end_date` | DATE | Leave end date |
| `number_of_days` | INT | Auto-calculated days |
| `reason` | TEXT | Leave reason |
| `status` | ENUM | Current status |
| `manager_approved_by` | VARCHAR(100) | Manager username |
| `manager_approved_at` | TIMESTAMP | Manager approval time |
| `manager_comments` | TEXT | Manager comments |
| `admin_approved_by` | VARCHAR(100) | Admin username |
| `admin_approved_at` | TIMESTAMP | Admin approval time |
| `admin_comments` | TEXT | Admin comments |
| `rejected_by` | VARCHAR(100) | Rejector username |
| `rejected_at` | TIMESTAMP | Rejection time |
| `rejection_reason` | TEXT | Reason for rejection |
| `reporting_manager` | VARCHAR(100) | Manager username |
| `department` | VARCHAR(100) | Department name |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_employee_id` - Fast employee lookups
- `idx_status` - Filter by status
- `idx_date_range` - Date range queries
- `idx_reporting_manager` - Manager's pending requests
- `idx_employee_status` - Composite for employee + status queries

**Foreign Keys:**
- `employee_id` → `employees(id)` ON DELETE CASCADE

### Leave Types

```java
public enum LeaveType {
    CASUAL_LEAVE,        // Casual/personal leave
    SICK_LEAVE,          // Medical leave
    EARNED_LEAVE,        // Earned/annual leave
    MATERNITY_LEAVE,     // Maternity leave
    PATERNITY_LEAVE,     // Paternity leave
    UNPAID_LEAVE,        // Leave without pay
    COMPENSATORY_OFF,    // Comp-off for overtime
    BEREAVEMENT_LEAVE,   // Family emergency
    MARRIAGE_LEAVE       // Wedding leave
}
```

### Leave Status

```java
public enum LeaveStatus {
    PENDING,              // Awaiting manager approval
    MANAGER_APPROVED,     // Manager approved, awaiting admin
    ADMIN_APPROVED,       // Final approval (granted)
    REJECTED,             // Rejected by manager or admin
    CANCELLED             // Cancelled by employee
}
```

---

## API Endpoints

### Base URL: `/api/leaves`

### 1. Create Leave Request

**POST** `/api/leaves`

**Access:** `EMPLOYEE`, `MANAGER`, `ADMIN`, `HR`

**Request Body:**
```json
{
  "employeeId": "EMP001",
  "employeeName": "John Doe",
  "employeeEmail": "john.doe@ecovale.com",
  "leaveType": "CASUAL_LEAVE",
  "startDate": "2026-02-01",
  "endDate": "2026-02-03",
  "reason": "Family vacation",
  "reportingManager": "manager1",
  "department": "IT"
}
```

**Validations:**
- Start date must be in the future
- End date must be >= start date
- Reason must be 10-1000 characters
- No overlapping approved leaves

**Response:**
```json
{
  "success": true,
  "message": "Leave request created successfully",
  "data": {
    "id": 1,
    "employeeId": "EMP001",
    "status": "PENDING",
    "numberOfDays": 3,
    "createdAt": "2026-01-26T10:00:00"
  }
}
```

---

### 2. Get All Leave Requests

**GET** `/api/leaves`

**Access:** `ADMIN` only

**Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": [
    {
      "id": 1,
      "employeeName": "John Doe",
      "leaveType": "CASUAL_LEAVE",
      "status": "PENDING",
      "numberOfDays": 3
    }
  ]
}
```

---

### 3. Get Leave Request by ID

**GET** `/api/leaves/{id}`

**Access:** `EMPLOYEE`, `MANAGER`, `ADMIN`, `HR`

**Example:** `GET /api/leaves/1`

---

### 4. Get Leave Requests by Employee

**GET** `/api/leaves/employee/{employeeId}`

**Access:** `EMPLOYEE`, `MANAGER`, `ADMIN`, `HR`

**Example:** `GET /api/leaves/employee/EMP001`

Returns all leave requests for the specified employee.

---

### 5. Get Leave Requests by Status

**GET** `/api/leaves/status/{status}`

**Access:** `MANAGER`, `ADMIN`, `HR`

**Example:** `GET /api/leaves/status/PENDING`

**Valid Status Values:**
- `PENDING`
- `MANAGER_APPROVED`
- `ADMIN_APPROVED`
- `REJECTED`
- `CANCELLED`

---

### 6. Get Pending Leaves for Manager

**GET** `/api/leaves/manager/pending?managerUsername=manager1`

**Access:** `MANAGER` only

Returns all pending leave requests that need manager approval.

---

### 7. Get Manager-Approved Leaves (Pending Admin)

**GET** `/api/leaves/admin/pending`

**Access:** `ADMIN` only

Returns all leaves approved by manager waiting for admin approval.

---

### 8. Manager Approve Leave

**PUT** `/api/leaves/{id}/manager-approve`

**Access:** `MANAGER` only

**Request Body:**
```json
{
  "comments": "Approved. Ensure handover is complete before leaving."
}
```

**Requirements:**
- Leave must be in `PENDING` status
- Comments required (5-500 chars)

**Effect:**
- Status changes to `MANAGER_APPROVED`
- Records manager username and timestamp
- Creates audit log

---

### 9. Admin Approve Leave (Final)

**PUT** `/api/leaves/{id}/admin-approve`

**Access:** `ADMIN` only

**Request Body:**
```json
{
  "comments": "Final approval granted. Leave confirmed."
}
```

**Requirements:**
- Leave must be in `MANAGER_APPROVED` status
- Comments required (5-500 chars)

**Effect:**
- Status changes to `ADMIN_APPROVED` (final state)
- Records admin username and timestamp
- Creates audit log

---

### 10. Reject Leave Request

**PUT** `/api/leaves/{id}/reject`

**Access:** `MANAGER`, `ADMIN`

**Request Body:**
```json
{
  "comments": "Leave overlaps with critical project deadline"
}
```

**Requirements:**
- Leave must be in `PENDING` or `MANAGER_APPROVED` status
- Comments required (5-500 chars)

**Effect:**
- Status changes to `REJECTED`
- Records rejector username, timestamp, and reason
- Creates audit log

---

### 11. Cancel Leave Request

**PUT** `/api/leaves/{id}/cancel`

**Access:** `EMPLOYEE`, `MANAGER`, `ADMIN`, `HR`

**Requirements:**
- Leave must be in `PENDING` or `MANAGER_APPROVED` status
- Cannot cancel after admin approval

**Effect:**
- Status changes to `CANCELLED`
- Creates audit log

---

### 12. Delete Leave Request

**DELETE** `/api/leaves/{id}`

**Access:** `ADMIN` only

Permanently deletes the leave request from the database.

---

### 13. Get Leave Statistics

**GET** `/api/leaves/employee/{employeeId}/statistics?year=2026`

**Access:** `EMPLOYEE`, `MANAGER`, `ADMIN`, `HR`

**Example:** `GET /api/leaves/employee/EMP001/statistics?year=2026`

**Response:**
```json
{
  "success": true,
  "data": {
    "approvedDaysThisYear": 12,
    "pendingRequests": 2
  }
}
```

---

## Service Layer

### LeaveService Methods

```java
// Create and retrieve
LeaveResponseDTO createLeaveRequest(LeaveRequestDTO dto)
LeaveResponseDTO getLeaveRequestById(Long id)
List<LeaveResponseDTO> getAllLeaveRequests()
List<LeaveResponseDTO> getLeaveRequestsByEmployee(String employeeId)
List<LeaveResponseDTO> getLeaveRequestsByStatus(String status)

// Manager operations
List<LeaveResponseDTO> getPendingLeavesForManager(String managerUsername)
LeaveResponseDTO managerApproveLeave(Long id, LeaveApprovalDTO approvalDTO)

// Admin operations
List<LeaveResponseDTO> getManagerApprovedLeaves()
LeaveResponseDTO adminApproveLeave(Long id, LeaveApprovalDTO approvalDTO)

// Rejection and cancellation
LeaveResponseDTO rejectLeave(Long id, LeaveApprovalDTO rejectionDTO)
LeaveResponseDTO cancelLeave(Long id)

// Management
void deleteLeaveRequest(Long id)
LeaveStatistics getLeaveStatistics(String employeeId, int year)
```

---

## Audit Logging

All approval, rejection, and cancellation actions are logged via `AuditLogService`:

**Logged Events:**
1. **CREATE** - When leave request is created
2. **UPDATE** - When manager approves
3. **UPDATE** - When admin approves
4. **UPDATE** - When leave is rejected
5. **UPDATE** - When leave is cancelled
6. **DELETE** - When leave request is deleted

**Audit Log Example:**
```json
{
  "username": "manager1",
  "action": "UPDATE",
  "entityName": "LeaveRequest",
  "entityId": 1,
  "details": "Manager approved leave request for John Doe (3 days). Comments: Approved",
  "timestamp": "2026-01-26T11:00:00",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

---

## Validations & Business Rules

### 1. Date Validation
- Start date must be in the future (when creating)
- End date must be >= start date
- Calculates `numberOfDays` automatically

### 2. Overlapping Leave Check
Prevents creating leave requests that overlap with existing approved leaves:
```java
List<LeaveRequest> overlappingLeaves = leaveRequestRepository
    .findApprovedLeavesByEmployeeAndDateRange(employeeId, startDate, endDate);
```

### 3. Status Transition Rules

| Current Status | Allowed Actions |
|---------------|-----------------|
| `PENDING` | Manager Approve, Reject, Cancel |
| `MANAGER_APPROVED` | Admin Approve, Reject, Cancel |
| `ADMIN_APPROVED` | None (final state) |
| `REJECTED` | None (final state) |
| `CANCELLED` | None (final state) |

### 4. Role-Based Permissions

| Role | Permissions |
|------|-------------|
| `EMPLOYEE` | Create, view own, cancel own |
| `MANAGER` | All EMPLOYEE + approve (1st level), reject, view team |
| `ADMIN` | All permissions + final approval, delete |
| `HR` | View and create requests |

---

## Error Handling

### Common Error Responses

**1. Leave Not Found (404)**
```json
{
  "success": false,
  "message": "Leave request not found with ID: 99",
  "data": null
}
```

**2. Invalid Status Transition (400)**
```json
{
  "success": false,
  "message": "Leave request cannot be approved by manager in current status: ADMIN_APPROVED",
  "data": null
}
```

**3. Overlapping Leaves (400)**
```json
{
  "success": false,
  "message": "You already have approved leave during this period",
  "data": null
}
```

**4. Invalid Date Range (400)**
```json
{
  "success": false,
  "message": "End date cannot be before start date",
  "data": null
}
```

**5. Access Denied (403)**
```json
{
  "success": false,
  "message": "Access Denied",
  "data": null
}
```

---

## Testing Examples

### 1. Complete Approval Workflow

```bash
# Step 1: Employee creates leave request
curl -X POST http://localhost:8080/api/leaves \
  -H "Authorization: Bearer <employee-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "EMP001",
    "employeeName": "John Doe",
    "employeeEmail": "john@ecovale.com",
    "leaveType": "CASUAL_LEAVE",
    "startDate": "2026-02-15",
    "endDate": "2026-02-17",
    "reason": "Personal work",
    "reportingManager": "manager1",
    "department": "IT"
  }'

# Response: {"success": true, "data": {"id": 1, "status": "PENDING"}}

# Step 2: Manager approves
curl -X PUT http://localhost:8080/api/leaves/1/manager-approve \
  -H "Authorization: Bearer <manager-token>" \
  -H "Content-Type: application/json" \
  -d '{"comments": "Approved by manager"}'

# Response: {"success": true, "data": {"id": 1, "status": "MANAGER_APPROVED"}}

# Step 3: Admin gives final approval
curl -X PUT http://localhost:8080/api/leaves/1/admin-approve \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"comments": "Final approval granted"}'

# Response: {"success": true, "data": {"id": 1, "status": "ADMIN_APPROVED"}}
```

### 2. Manager Views Pending Leaves

```bash
curl -X GET "http://localhost:8080/api/leaves/manager/pending?managerUsername=manager1" \
  -H "Authorization: Bearer <manager-token>"
```

### 3. Employee Views Own Leaves

```bash
curl -X GET http://localhost:8080/api/leaves/employee/EMP001 \
  -H "Authorization: Bearer <employee-token>"
```

### 4. Reject Leave

```bash
curl -X PUT http://localhost:8080/api/leaves/1/reject \
  -H "Authorization: Bearer <manager-token>" \
  -H "Content-Type: application/json" \
  -d '{"comments": "Insufficient coverage during this period"}'
```

### 5. Get Leave Statistics

```bash
curl -X GET "http://localhost:8080/api/leaves/employee/EMP001/statistics?year=2026" \
  -H "Authorization: Bearer <employee-token>"

# Response: {"approvedDaysThisYear": 12, "pendingRequests": 1}
```

---

## Database Migration

**File:** `V8__Create_leave_requests_table.sql`

Automatically executed by Flyway on application startup.

**To manually check migration status:**
```bash
mvn flyway:info
```

**To validate migrations:**
```bash
mvn flyway:validate
```

---

## Security Configuration

All endpoints are secured with Spring Security:

```java
@PreAuthorize("hasRole('MANAGER')")  // Manager only
@PreAuthorize("hasRole('ADMIN')")    // Admin only
@PreAuthorize("hasAnyRole('EMPLOYEE', 'MANAGER', 'ADMIN')")  // Multiple roles
```

Authentication required via JWT token in `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

---

## Performance Optimizations

1. **Database Indexes** - Fast queries for common operations
2. **Date Range Queries** - Optimized composite indexes
3. **Eager vs Lazy Loading** - No N+1 query issues
4. **Async Audit Logging** - Non-blocking audit operations
5. **Transaction Management** - ACID compliance for approvals

---

## Frontend Integration

### Recommended UI Flow

**Employee View:**
1. Dashboard showing leave balance and pending requests
2. "Request Leave" button → form with date picker and leave type dropdown
3. List of submitted leaves with status badges
4. Cancel button for pending/manager-approved leaves

**Manager View:**
1. Notification badge for pending approvals
2. "Pending Approvals" tab showing team member requests
3. Approve/Reject buttons with comment modal
4. History of all team leaves

**Admin View:**
1. All leaves dashboard with filters (status, department, date range)
2. Manager-approved leaves requiring final approval
3. Analytics: leave trends, department-wise usage
4. Override capabilities and deletion

---

## Future Enhancements

1. **Leave Balance Tracking** - Track annual leave quotas
2. **Email Notifications** - Notify on approval/rejection
3. **Calendar Integration** - Show team availability
4. **Bulk Operations** - Approve multiple leaves at once
5. **Leave Policies** - Configurable approval rules
6. **Reporting** - Leave reports and analytics
7. **Attachments** - Support for medical certificates

---

## Troubleshooting

### Issue: Cannot approve leave

**Error:** "Leave request cannot be approved by manager in current status: ADMIN_APPROVED"

**Solution:** Check leave status - already approved leaves cannot be re-approved.

### Issue: Overlapping leave error

**Error:** "You already have approved leave during this period"

**Solution:** Check existing approved leaves for the employee in the date range.

### Issue: Access denied on manager approval

**Error:** 403 Forbidden

**Solution:** Ensure user has `ROLE_MANAGER` role in JWT token.

---

**Module Complete! All features implemented with security, audit logging, and proper workflow. 🎉**
