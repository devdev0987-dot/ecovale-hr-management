# Database Entities - EcoVale HR System

## Overview
This document defines all domain entities identified from the frontend implementation, their attributes, data types, constraints, and business descriptions.

---

## 1. User/Authentication Entity

### 1.1 User
**Description**: Represents system users (HR admins, managers, etc.) who can authenticate and access the system.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier for the user |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User's email address for login |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password (bcrypt/argon2) |
| full_name | VARCHAR(255) | NOT NULL | User's full name |
| role | ENUM | NOT NULL, DEFAULT 'admin' | User role: 'admin', 'manager', 'hr', 'employee' |
| employee_id | VARCHAR(20) | FOREIGN KEY, NULL | Reference to Employee if user is an employee |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Account status |
| failed_login_attempts | INT | NOT NULL, DEFAULT 0 | Count of consecutive failed login attempts |
| account_locked_until | TIMESTAMP | NULL | Account lock expiry timestamp |
| password_reset_token | VARCHAR(255) | NULL | Token for password reset |
| password_reset_expires | TIMESTAMP | NULL | Password reset token expiry |
| last_login | TIMESTAMP | NULL | Last successful login timestamp |
| last_login_ip | VARCHAR(45) | NULL | IP address of last login (IPv4/IPv6) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- Email must be unique and valid format (RFC 5322)
- Password must be stored as hash using bcrypt (cost factor 12) or argon2id
- Minimum password length: 8 characters
- Password requirements: At least 1 uppercase, 1 lowercase, 1 number, 1 special character
- Maximum failed login attempts: 5 (account locked for 30 minutes)
- Password reset token valid for 1 hour
- JWT access token expires in 1 hour, refresh token in 7 days
- Admin role has full system access
- Employee_id links user account to employee record for self-service access

---

### 1.2 Session (JWT Token Management & Session Tracking)
**Description**: Manages active user sessions, JWT refresh tokens, and provides token revocation capability for secure logout. Essential for stateless JWT authentication while maintaining session control and security.

**Purpose**:
- Store refresh tokens for obtaining new access tokens
- Enable logout functionality (token revocation)
- Track active sessions per user (multi-device support)
- Provide session management and monitoring
- Support "logout all devices" functionality
- Detect suspicious activity (location/device changes)

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique session identifier |
| user_id | UUID | FOREIGN KEY, NOT NULL | Reference to User who owns this session |
| refresh_token | VARCHAR(500) | UNIQUE, NOT NULL | JWT refresh token (hashed or full) |
| refresh_token_hash | VARCHAR(255) | NULL | SHA-256 hash of refresh token for lookup |
| access_token_jti | VARCHAR(255) | NULL | JWT ID (jti claim) of current access token |
| device_name | VARCHAR(255) | NULL | Device identifier (e.g., "iPhone 13", "Chrome on Windows") |
| device_fingerprint | VARCHAR(255) | NULL | Device fingerprint hash for security |
| ip_address | VARCHAR(45) | NULL | IP address of the session (IPv4/IPv6) |
| user_agent | TEXT | NULL | Full browser/client user agent string |
| location | VARCHAR(255) | NULL | Approximate location (City, Country) from IP |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Session status (true = active, false = revoked) |
| expires_at | TIMESTAMP | NOT NULL | Refresh token expiry timestamp (typically 7 days) |
| last_activity | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last API request timestamp |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Session creation timestamp (login time) |
| revoked_at | TIMESTAMP | NULL | When session was manually revoked |
| revoked_reason | VARCHAR(255) | NULL | Reason for revocation (logout, suspicious activity, etc.) |

**JWT Structure**:
Access Token Payload (1 hour expiry):
```json
{
  "sub": "user_uuid",
  "email": "user@ecovale.com",
  "role": "admin",
  "employee_id": "123",
  "session_id": "session_uuid",
  "jti": "unique_access_token_id",
  "iat": 1737360000,
  "exp": 1737363600,
  "type": "access"
}
```

Refresh Token Payload (7 days expiry):
```json
{
  "sub": "user_uuid",
  "session_id": "session_uuid",
  "jti": "unique_refresh_token_id",
  "iat": 1737360000,
  "exp": 1737964800,
  "type": "refresh"
}
```

**Primary Business Rules**:

1. **Session Creation (Login)**
   - New session created on successful login
   - Generate unique refresh token (JWT)
   - Store refresh token (hashed for security)
   - Capture IP address, user agent, device info
   - Set expires_at = now + 7 days
   - Set is_active = true

2. **Token Refresh**
   - Validate refresh token exists and is active
   - Check session.expires_at > now
   - Check session.is_active = true
   - Generate new access token with same session_id
   - Update last_activity timestamp
   - Optionally rotate refresh token (recommended)

3. **Session Expiry**
   - Sessions expire after 7 days from creation
   - Expired sessions automatically invalid
   - Cleanup job removes expired sessions periodically
   - User must re-login after expiry

4. **Logout (Single Device)**
   - Set session.is_active = false
   - Set revoked_at = now
   - Set revoked_reason = 'user_logout'
   - Subsequent refresh attempts rejected

5. **Logout All Devices**
   - Set is_active = false for all user sessions
   - Forces re-login on all devices
   - Useful for password change or security breach

6. **Multi-Device Support**
   - Users can have multiple active sessions
   - Each device gets unique session record
   - Sessions tracked independently
   - User can view and revoke specific sessions

7. **Inactivity Timeout**
   - Track last_activity on each API request
   - Optional: Revoke sessions inactive for 30+ days
   - Configurable per deployment

8. **Suspicious Activity Detection**
   - Track IP address and location changes
   - Detect device fingerprint changes
   - Alert on unusual activity patterns
   - Optional: Auto-revoke suspicious sessions

**Validation Rules**:
- user_id must reference existing users.id
- refresh_token must be unique across all sessions
- expires_at must be in the future on creation
- expires_at = created_at + 7 days (typically)
- is_active can only transition from true to false
- Cannot reactivate revoked session (must create new)
- revoked_at set only when is_active = false

**Security Considerations**:

1. **Token Storage**
   - Store refresh_token_hash (SHA-256) not plain token
   - Compare hash on refresh requests
   - Prevents token theft if database compromised

2. **Token Rotation**
   - Recommended: Rotate refresh token on each use
   - Invalidate old refresh token after rotation
   - Prevents replay attacks

3. **Revocation**
   - Immediate logout capability
   - No waiting for token expiry
   - Essential for compromised accounts

4. **Monitoring**
   - Track session count per user
   - Alert on excessive sessions (>10)
   - Log all session creation/revocation

**Indexes** (for performance):
- PRIMARY KEY: id
- UNIQUE: refresh_token_hash
- INDEX: user_id (frequently queried)
- INDEX: (is_active, expires_at) (for active session queries)
- INDEX: expires_at (for cleanup queries)
- INDEX: user_id, is_active (composite for user's active sessions)

**Relationships**:
- **Many-to-One**: Session → User (one user has many sessions)
- **Referenced by**: Audit logs may reference session_id

**Cascade Behavior**:
- User deleted: CASCADE delete all sessions (ON DELETE CASCADE)
- Session deleted: No impact on other tables
- User deactivated: Optional cascade to revoke all sessions

**Performance Considerations**:
- Index on (user_id, is_active) for "list active sessions" query
- Partial index on expires_at for cleanup queries
- Periodic cleanup job reduces table size
- Consider partitioning by created_at for large deployments

**Cleanup Strategy**:

1. **Automatic Cleanup Job** (daily cron):
```sql
DELETE FROM sessions
WHERE expires_at < NOW() - INTERVAL '30 days'
   OR (is_active = false AND revoked_at < NOW() - INTERVAL '30 days');
```

2. **Retention Policy**:
   - Active sessions: Keep until expiry (7 days)
   - Revoked sessions: Keep for 30 days for audit
   - Expired sessions: Delete after 30 days
   - Total retention: Max 37 days per session

**Monitoring Metrics**:
- Active sessions count per user
- Total active sessions system-wide
- Session creation rate (logins per hour)
- Session revocation rate (logouts per hour)
- Average session duration
- Sessions per device type
- Geographic distribution of sessions

**Audit Trail**:
- Session creation logged in audit_logs
- Session revocation logged in audit_logs
- Suspicious activity logged and alerted
- Include: user_id, session_id, IP, location, reason

**Edge Cases**:

1. **Concurrent Logins**
   - Allow multiple sessions per user
   - Each device gets unique session
   - No session limit by default (configurable)

2. **Refresh Token Reuse**
   - After rotation, old token becomes invalid
   - Detect reuse as potential theft
   - Auto-revoke all user sessions on token reuse

3. **Clock Skew**
   - Allow 5-minute grace period for exp claim
   - Handle timezone differences
   - Use UTC for all timestamps

4. **Session Hijacking**
   - Track IP and device changes
   - Alert on suspicious changes
   - Optional: Require re-authentication

**Integration with JWT Flow**:

1. **Login**:
   ```
   POST /auth/login
   → Validate credentials
   → Create session record
   → Generate refresh token JWT
   → Generate access token JWT
   → Return both tokens
   ```

2. **Token Refresh**:
   ```
   POST /auth/refresh
   → Validate refresh token signature
   → Lookup session by refresh_token_hash
   → Check is_active and expires_at
   → Generate new access token
   → Optionally rotate refresh token
   → Update last_activity
   → Return new tokens
   ```

3. **API Request**:
   ```
   Any protected endpoint
   → Validate access token signature
   → Extract session_id from token
   → Optionally verify session still active
   → Update last_activity (async)
   → Process request
   ```

4. **Logout**:
   ```
   POST /auth/logout
   → Extract session_id from access token
   → Set session.is_active = false
   → Return success
   ```

**Alternative Implementations**:

1. **Store Full Token**: Store complete refresh token (base64)
   - Simpler implementation
   - Faster lookup (direct match)
   - Less secure if DB compromised

2. **Store Hash Only**: Store SHA-256 hash of token
   - More secure
   - Requires hashing on each refresh
   - Prevents token recovery from DB

3. **Redis Cache**: Store sessions in Redis instead of PostgreSQL
   - Faster lookup and expiry
   - Automatic TTL expiration
   - Requires separate data store

**Recommended Approach**: Store hash with PostgreSQL for simplicity and data persistence

---

### 1.3 Audit Log (Comprehensive Audit Trail for Security & Compliance)
**Description**: Immutable audit trail recording all user actions, system events, and data modifications for security monitoring, compliance, forensic analysis, and regulatory requirements. Essential for SOC 2, ISO 27001, GDPR, and financial audit compliance.

**Purpose**:
- Track all user actions for accountability
- Record data modifications (before/after values)
- Monitor security events (login failures, suspicious activity)
- Support compliance audits (SOC 2, ISO 27001, GDPR)
- Enable forensic investigation of incidents
- Provide non-repudiation evidence
- Meet regulatory requirements (7-year retention)

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique audit log entry identifier |
| user_id | UUID | FOREIGN KEY, NULL | Reference to User who performed action (NULL for system) |
| session_id | UUID | FOREIGN KEY, NULL | Reference to Session (links to login session) |
| action | VARCHAR(100) | NOT NULL | Action performed (e.g., 'LOGIN', 'CREATE_EMPLOYEE', 'UPDATE_SALARY') |
| action_category | VARCHAR(50) | NOT NULL | Category: 'AUTH', 'EMPLOYEE', 'PAYROLL', 'SETTINGS', 'SECURITY' |
| resource_type | VARCHAR(50) | NOT NULL | Type of resource affected (e.g., 'USER', 'EMPLOYEE', 'PAYRUN') |
| resource_id | VARCHAR(50) | NULL | ID of the affected resource (employee ID, payrun ID, etc.) |
| resource_name | VARCHAR(255) | NULL | Human-readable name of resource (employee name, etc.) |
| method | VARCHAR(10) | NULL | HTTP method: 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' |
| endpoint | VARCHAR(255) | NULL | API endpoint called (e.g., '/api/employees/123') |
| ip_address | VARCHAR(45) | NULL | IP address of the request (IPv4/IPv6) |
| user_agent | TEXT | NULL | Full browser/client user agent string |
| location | VARCHAR(255) | NULL | Geo-located city/country from IP address |
| changes | JSONB | NULL | JSON object with before/after values for data changes |
| metadata | JSONB | NULL | Additional context (request params, filters, etc.) |
| status | VARCHAR(20) | NOT NULL | Status: 'success', 'failure', 'warning' |
| status_code | INT | NULL | HTTP status code (200, 201, 400, 401, 403, 500, etc.) |
| error_message | TEXT | NULL | Error message if status is failure |
| error_stack | TEXT | NULL | Stack trace for debugging (if applicable) |
| duration_ms | INT | NULL | Request duration in milliseconds |
| severity | VARCHAR(20) | NOT NULL, DEFAULT 'info' | Severity: 'debug', 'info', 'warning', 'error', 'critical' |
| tags | TEXT[] | NULL | Array of tags for categorization and search |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Timestamp of the action (immutable) |

**Action Categories & Examples**:

1. **AUTH** (Authentication & Authorization):
   - LOGIN, LOGIN_FAILED, LOGOUT, LOGOUT_ALL
   - PASSWORD_CHANGE, PASSWORD_RESET_REQUEST, PASSWORD_RESET
   - SESSION_CREATE, SESSION_REVOKE, SESSION_EXPIRED
   - ACCOUNT_LOCKED, ACCOUNT_UNLOCKED
   - TOKEN_REFRESH, TOKEN_REFRESH_FAILED

2. **EMPLOYEE** (Employee Management):
   - CREATE_EMPLOYEE, UPDATE_EMPLOYEE, DELETE_EMPLOYEE
   - UPDATE_EMPLOYEE_SALARY, UPDATE_EMPLOYEE_DESIGNATION
   - UPDATE_EMPLOYEE_STATUS, EMPLOYEE_ONBOARDING
   - UPLOAD_DOCUMENT, DELETE_DOCUMENT
   - ADD_BANK_DETAILS, UPDATE_BANK_DETAILS

3. **PAYROLL** (Payroll Operations):
   - GENERATE_PAYRUN, APPROVE_PAYRUN, DELETE_PAYRUN
   - GENERATE_PAYSLIP, DOWNLOAD_PAYSLIP
   - UPDATE_ATTENDANCE, BULK_UPDATE_ATTENDANCE
   - CREATE_ADVANCE, APPROVE_ADVANCE, DEDUCT_ADVANCE
   - CREATE_LOAN, APPROVE_LOAN, PROCESS_EMI

4. **SETTINGS** (System Configuration):
   - UPDATE_SETTINGS, UPDATE_DEPARTMENT, CREATE_DESIGNATION
   - UPDATE_TAX_SETTINGS, UPDATE_PF_SETTINGS
   - CREATE_LETTER_TEMPLATE, UPDATE_LETTER_TEMPLATE

5. **SECURITY** (Security Events):
   - SUSPICIOUS_LOGIN, MULTIPLE_FAILED_LOGINS
   - IP_CHANGE_DETECTED, DEVICE_CHANGE_DETECTED
   - UNAUTHORIZED_ACCESS_ATTEMPT, ROLE_ESCALATION_ATTEMPT
   - DATA_EXPORT, BULK_DOWNLOAD

**JSONB Schema for Changes Field**:
```json
{
  "before": {
    "field_name": "old_value",
    "ctc": 1200000,
    "status": "active"
  },
  "after": {
    "field_name": "new_value",
    "ctc": 1500000,
    "status": "active"
  },
  "fields_changed": ["ctc"],
  "change_summary": "Salary increased by ₹300,000"
}
```

**JSONB Schema for Metadata Field**:
```json
{
  "request_id": "uuid",
  "correlation_id": "uuid",
  "client_version": "1.2.0",
  "query_params": {"status": "active", "department": "IT"},
  "filters_applied": ["status=active", "department=IT"],
  "records_affected": 5,
  "execution_plan": "index_scan",
  "cache_hit": true
}
```

**Primary Business Rules**:

1. **Immutability (Append-Only)**
   - Audit logs CANNOT be modified after creation
   - Audit logs CANNOT be deleted (except by retention policy)
   - No UPDATE or DELETE operations allowed
   - INSERT only
   - Database triggers prevent modifications

2. **Mandatory Logging**
   - All authentication events (success and failure)
   - All CRUD operations on sensitive data
   - All data modifications (salary, status, personal info)
   - All administrative actions
   - All security events
   - All export/download operations
   - All configuration changes

3. **Retention Policy**
   - Minimum retention: 7 years (regulatory requirement)
   - Active logs: Kept indefinitely (within retention)
   - Archive after: 1 year (move to cold storage)
   - Compliance: SOC 2, ISO 27001, GDPR, financial audits

4. **Performance Optimization**
   - Partition by created_at (monthly partitions)
   - Index on user_id, action, resource_type, created_at
   - Archive old logs to cold storage (S3, Glacier)
   - Async logging (non-blocking API responses)

5. **Data Completeness**
   - Required: user_id (or NULL for system), action, resource_type, status
   - Optional: resource_id, changes, metadata
   - Context: IP, user agent, location captured when available
   - Timing: Duration tracked for performance monitoring

6. **Change Tracking**
   - Before/after values for all data modifications
   - Field-level granularity
   - Sensitive fields masked in logs (passwords, tokens)
   - Change summary for human readability

7. **Security Events**
   - Failed login attempts → trigger account lockout
   - Multiple failures from same IP → rate limiting
   - Suspicious activity → alert security team
   - Unauthorized access → log and deny
   - Data export → full audit trail

**Validation Rules**:
- action must not be empty
- action_category must be valid enum
- resource_type must not be empty
- status must be 'success', 'failure', or 'warning'
- severity must be valid enum
- created_at is immutable (set once)
- changes JSONB must be valid JSON if provided
- user_id must reference existing user (if not NULL)
- session_id must reference existing session (if not NULL)

**Security & Privacy**:

1. **Sensitive Data Handling**:
   - Passwords: Never logged (even hashed)
   - Credit cards: Never logged
   - API keys: Never logged
   - Tokens: Never logged (log JTI only)
   - Salary: Logged but access-controlled
   - Personal info: Logged with proper access control

2. **Access Control**:
   - Admin: Full access to all audit logs
   - HR: Access to employee-related logs
   - Manager: Access to team member logs only
   - Employee: Access to own logs only
   - Read-only: No modifications allowed

3. **Encryption**:
   - Database-level encryption (at rest)
   - TLS for transmission (in transit)
   - Sensitive fields encrypted in JSONB

**Indexes** (for performance):
- PRIMARY KEY: id
- INDEX: user_id (user action history)
- INDEX: session_id (session audit trail)
- INDEX: action, action_category (action type queries)
- INDEX: resource_type, resource_id (resource history)
- INDEX: created_at DESC (recent activity)
- INDEX: status (failed operations)
- INDEX: severity (critical events)
- COMPOSITE INDEX: (user_id, created_at DESC) (user timeline)
- COMPOSITE INDEX: (resource_type, resource_id, created_at DESC) (resource history)
- GIN INDEX: tags (tag search)
- GIN INDEX: changes (JSONB search)

**Partitioning Strategy**:
- Partition by: created_at (RANGE)
- Partition size: Monthly
- Example: audit_logs_2026_01, audit_logs_2026_02, etc.
- Automatic partition creation via cron
- Old partitions archived to cold storage

**Relationships**:
- **Many-to-One**: AuditLog → User (one user has many logs)
- **Many-to-One**: AuditLog → Session (one session has many logs)
- **Referenced by**: Compliance reports, security dashboards

**Cascade Behavior**:
- User deleted: SET NULL (keep log, user_id becomes NULL)
- Session deleted: SET NULL (keep log, session_id becomes NULL)
- Audit log: NEVER deleted (except retention policy)

**Use Cases**:

1. **Security Investigation**:
   - Who accessed what data and when?
   - Track unauthorized access attempts
   - Identify compromised accounts
   - Timeline reconstruction for incidents

2. **Compliance Audit**:
   - Prove data access controls
   - Demonstrate change management
   - Show user accountability
   - Meet regulatory requirements (SOX, GDPR, HIPAA)

3. **Forensic Analysis**:
   - Investigate data breaches
   - Track data modifications
   - Identify insider threats
   - Reconstruct event sequences

4. **Operations Monitoring**:
   - Track system performance (duration_ms)
   - Identify slow operations
   - Monitor error rates
   - Capacity planning

5. **User Activity Tracking**:
   - Employee activity reports
   - Admin action logs
   - HR operation logs
   - Manager approval history

**Reporting & Analytics**:
- Action frequency by type
- User activity heatmaps
- Failed operation trends
- Security event dashboard
- Compliance reports (who did what when)
- Performance metrics (duration_ms)

**Alerting Triggers**:
- Multiple failed logins → Account lockout alert
- Suspicious activity → Security team alert
- Critical errors → On-call alert
- Data export → Notification to admin
- Configuration changes → Change approval alert
- Unauthorized access → Immediate alert

**Archive Strategy**:

1. **Hot Storage** (PostgreSQL):
   - Last 12 months
   - Full query capability
   - Fast access

2. **Warm Storage** (Compressed PostgreSQL):
   - 1-3 years old
   - Reduced indexing
   - Slower access

3. **Cold Storage** (S3/Glacier):
   - 3-7 years old
   - Compressed archives
   - Restore on demand

4. **Deletion** (After retention):
   - After 7 years
   - Compliance approval required
   - Permanent deletion

---

## 2. Core Employee Management Entities

### 2.1 Employee
**Description**: Central entity representing an employee with complete personal, employment, and salary information. This is the core entity of the HR system, containing all employee data in a single denormalized table for performance and simplicity.

**Core Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | VARCHAR(20) | PRIMARY KEY, NOT NULL | Sequential numeric ID (1, 2, 3...) |
| status | ENUM | NOT NULL, DEFAULT 'active' | Employee status: 'active', 'inactive' |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Embedded Data Groups**:
This entity includes the following data groups (detailed in sections 2.2, 2.3, 2.4):
- **Personal Information** (2.2): Names, contacts, addresses, statutory numbers
- **Employment Details** (2.3): Department, designation, reporting, work location
- **Salary Information** (2.4): CTC, components, deductions, net salary

**Primary Business Rules**:

1. **Employee ID Generation**
   - Auto-generated sequential numeric string (1, 2, 3...)
   - Cannot be manually assigned
   - Used as employee number in UI
   - Generated via: `MAX(id) + 1`

2. **Official Email Generation**
   - Auto-generated: `{first_name}.{last_name}@ecovale.com`
   - Must be unique across all employees
   - Lowercase conversion applied
   - Duplicates handled with numeric suffix (e.g., john.doe2@ecovale.com)

3. **Employee Status**
   - `active`: Currently employed, included in payroll
   - `inactive`: Terminated/resigned, excluded from pay runs
   - Status change requires proper authorization
   - Cannot delete employees with payroll history (soft delete only)

4. **Data Integrity**
   - All salary components must sum correctly to CTC
   - Basic salary must equal 50% of annual CTC / 12
   - Gross = Sum of all allowances
   - Net = Gross - Deductions
   - Foreign keys validated: department_id, designation_id, reporting_manager_id

5. **Reporting Hierarchy**
   - reporting_manager_id must reference valid active employee
   - Cannot report to self
   - Circular reporting not allowed
   - NULL allowed for top-level executives (CEO, Directors)

6. **Statutory Compliance**
   - PF applicable when employee opts in (include_pf = true)
   - ESI applicable when gross < ₹21,000/month
   - Professional Tax applicable when gross > ₹25,000/month
   - PF and ESI numbers must be unique if provided

**Relationships**:
- **One-to-Many**: Employee → BankDetails
- **One-to-Many**: Employee → Documents
- **One-to-Many**: Employee → CareerHistory
- **One-to-Many**: Employee → AttendanceRecords
- **One-to-Many**: Employee → AdvanceRecords
- **One-to-Many**: Employee → LoanRecords
- **One-to-Many**: Employee → GeneratedLetters
- **Many-to-Many**: Employee ↔ PayRuns (through PayRunEmployeeRecord)
- **Many-to-One**: Employee → Department
- **Many-to-One**: Employee → Designation
- **Self-Referential**: Employee → Employee (reporting_manager)
- **One-to-One (optional)**: Employee ← User (via user.employee_id)

**Validation Rules**:
- First name, last name: Required, 1-100 characters
- Contact number: Required, valid phone format
- Personal email: Required, valid email format
- Official email: Auto-generated, unique
- Gender: Must be 'Male', 'Female', or 'Other'
- Employment type: Must be 'full-time' or 'part-time'
- Work location: Must be valid location from predefined list
- CTC: Must be > 0
- Salary calculations must match formulas
- Payment mode: 'Bank', 'Cash', or 'Cheque'

**Indexes** (for performance):
- Primary: id
- Unique: official_email
- Index: status (for active employee queries)
- Index: department_id (for department reports)
- Index: designation_id (for designation reports)
- Index: reporting_manager_id (for hierarchy queries)
- Index: (first_name, last_name) (for name searches)
- Index: join_date (for tenure calculations)

**Computed/Derived Fields**:
- official_email: Computed from first_name and last_name
- Age: Computed from date_of_birth and current date
- Tenure: Computed from join_date and current date
- All salary components follow calculation formulas

**Constraints**:
- CHECK: basic = ctc * 0.5 / 12 (basic must be 50% of annual CTC)
- CHECK: ctc > 0, gross > 0, net > 0 (positive salary values)
- CHECK: probation_period >= 0
- CHECK: status IN ('active', 'inactive')
- CHECK: gender IN ('Male', 'Female', 'Other')
- CHECK: employment_type IN ('full-time', 'part-time')
- CHECK: payment_mode IN ('Bank', 'Cash', 'Cheque')
- UNIQUE: official_email
- UNIQUE: pf_number (if not NULL)
- UNIQUE: esi_number (if not NULL)

**Audit Trail**:
- All CRUD operations logged in audit_logs table
- created_at: Timestamp when employee record created
- updated_at: Automatically updated on any modification
- Salary changes tracked in audit_logs.changes (before/after)
- Status changes logged for compliance

**Performance Considerations**:
- Denormalized design: All employee data in one table
- Reduces JOINs for common queries (list employees, employee details)
- Indexes on frequently queried fields
- Trade-off: Some data duplication (department name cached in reports)

**Migration/Data Import**:
- Support bulk import from CSV/Excel
- Validate all fields before insert
- Generate employee ID sequentially
- Auto-generate official email with conflict resolution
- Calculate all salary components from CTC

**Privacy & Security**:
- Sensitive fields: salary details, statutory numbers, personal email
- Role-based access control enforced at API level
- Employees can view own record (via user.employee_id)
- HR and Admin can view all records
- Managers can view direct reports
- Audit log tracks all data access and modifications

---

### 2.2 Employee Personal Information (Embedded in Employee)
**Description**: Personal and contact details of an employee including name, demographics, contact information, addresses, family details, and statutory identifiers. These fields are part of the main `employees` table and are critical for identity verification, communication, emergency response, and statutory compliance (PF, ESI).

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| first_name | VARCHAR(100) | NOT NULL | Employee's legal first name (as per government ID) |
| middle_name | VARCHAR(100) | NULL | Employee's middle name (optional) |
| last_name | VARCHAR(100) | NOT NULL | Employee's legal last name (as per government ID) |
| full_name | VARCHAR(255) | GENERATED | Auto-computed: first_name + ' ' + middle_name + ' ' + last_name (or without middle if null) |
| display_name | VARCHAR(255) | NULL | Preferred name for display (e.g., nickname, shortened name) |
| date_of_birth | DATE | NULL | Employee's date of birth (for age verification, birthday reminders) |
| age | INT | GENERATED | Auto-computed: EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) |
| gender | ENUM | NOT NULL | Gender: 'Male', 'Female', 'Other', 'Prefer not to say' |
| marital_status | ENUM | NULL | Status: 'Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say' |
| nationality | VARCHAR(100) | NULL | Nationality (e.g., 'Indian', 'American') |
| religion | VARCHAR(50) | NULL | Religion (optional, for diversity tracking) |
| caste_category | ENUM | NULL | Category: 'General', 'OBC', 'SC', 'ST' (for affirmative action reporting in India) |
| blood_group | VARCHAR(10) | NULL | Blood group: 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-' |
| physically_challenged | BOOLEAN | NOT NULL, DEFAULT false | Whether employee has any physical disability |
| disability_details | TEXT | NULL | Details of disability (if physically_challenged = true) |
| photo | TEXT | NULL | Base64 encoded passport-size photo or cloud storage URL |
| photo_url | VARCHAR(500) | NULL | Cloud storage URL for profile photo |
| thumbnail | TEXT | NULL | Base64 encoded thumbnail (100x100 pixels) for quick loading |
| contact_number | VARCHAR(20) | NOT NULL | Primary contact number (mobile preferred, format: +91-XXXXXXXXXX) |
| alternate_contact | VARCHAR(20) | NULL | Alternate contact number (landline or secondary mobile) |
| emergency_contact_name | VARCHAR(255) | NULL | Emergency contact person's name |
| emergency_contact_relationship | VARCHAR(100) | NULL | Relationship: 'Spouse', 'Parent', 'Sibling', 'Friend', 'Other' |
| emergency_contact_number | VARCHAR(20) | NULL | Emergency contact phone number |
| personal_email | VARCHAR(255) | NOT NULL, UNIQUE | Personal email address (for communication after exit) |
| permanent_address_line1 | VARCHAR(255) | NULL | Permanent address line 1 |
| permanent_address_line2 | VARCHAR(255) | NULL | Permanent address line 2 |
| permanent_city | VARCHAR(100) | NULL | Permanent address city |
| permanent_state | VARCHAR(100) | NULL | Permanent address state/province |
| permanent_pincode | VARCHAR(10) | NULL | Permanent address PIN/ZIP code |
| permanent_country | VARCHAR(100) | NULL, DEFAULT 'India' | Permanent address country |
| permanent_address | TEXT | GENERATED | Auto-computed: Concatenation of all permanent address fields |
| current_address_line1 | VARCHAR(255) | NOT NULL | Current residential address line 1 |
| current_address_line2 | VARCHAR(255) | NULL | Current residential address line 2 |
| current_city | VARCHAR(100) | NOT NULL | Current address city |
| current_state | VARCHAR(100) | NOT NULL | Current address state/province |
| current_pincode | VARCHAR(10) | NOT NULL | Current address PIN/ZIP code |
| current_country | VARCHAR(100) | NOT NULL, DEFAULT 'India' | Current address country |
| current_address | TEXT | GENERATED | Auto-computed: Concatenation of all current address fields |
| same_as_permanent | BOOLEAN | NOT NULL, DEFAULT false | Whether current address is same as permanent address |
| pf_number | VARCHAR(50) | NULL, UNIQUE | Provident Fund UAN (Universal Account Number) |
| pf_joining_date | DATE | NULL | Date when PF was activated |
| esi_number | VARCHAR(50) | NULL, UNIQUE | Employee State Insurance number |
| esi_eligible | BOOLEAN | GENERATED | Auto-computed: true if gross salary < ₹21,000 |
| pan_number | VARCHAR(10) | NULL, UNIQUE | Permanent Account Number (format: ABCDE1234F) |
| aadhar_number | VARCHAR(12) | NULL | Aadhar number (encrypted, 12 digits) |
| aadhar_masked | VARCHAR(14) | GENERATED | Auto-computed: 'XXXX-XXXX-' + last 4 digits |
| passport_number | VARCHAR(20) | NULL | Passport number (if available) |
| passport_expiry | DATE | NULL | Passport expiry date |
| driving_license_number | VARCHAR(20) | NULL | Driving license number (if available) |
| driving_license_expiry | DATE | NULL | Driving license expiry date |
| father_name | VARCHAR(255) | NULL | Father's full name (as per documents) |
| mother_name | VARCHAR(255) | NULL | Mother's full name (as per documents) |
| spouse_name | VARCHAR(255) | NULL | Spouse's full name (if married) |
| number_of_children | INT | NULL, DEFAULT 0 | Number of dependent children |
| previous_employer_name | VARCHAR(255) | NULL | Name of previous employer (if applicable) |
| previous_employer_designation | VARCHAR(255) | NULL | Previous designation/role |
| previous_employer_experience_years | DECIMAL(4,2) | NULL | Years of experience at previous employer |
| total_experience_years | DECIMAL(4,2) | NULL | Total years of professional experience before joining |
| highest_qualification | VARCHAR(100) | NULL | Highest educational qualification: 'High School', '12th', 'Diploma', 'Bachelor', 'Master', 'PhD' |
| highest_qualification_stream | VARCHAR(100) | NULL | Stream/specialization (e.g., 'Computer Science', 'Mechanical Engineering') |
| university_institute | VARCHAR(255) | NULL | Name of university/institute |
| year_of_passing | INT | NULL | Year of passing highest qualification |
| percentage_cgpa | VARCHAR(20) | NULL | Percentage or CGPA |

**Business Rules**:

1. **Name Validation & Formatting**:
   - First name and last name are mandatory (legal name as per government ID)
   - Allow only alphabets, spaces, hyphens, apostrophes (e.g., "O'Brien", "Mary-Jane")
   - Auto-trim extra spaces and capitalize first letter of each word
   - `full_name` auto-computed: `first_name + ' ' + COALESCE(middle_name + ' ', '') + last_name`
   - `display_name` optional: Allow employees to set preferred name for internal use
   - Validate name length: first_name (2-100 chars), last_name (2-100 chars)

2. **Date of Birth & Age Validation**:
   - Employee must be at least 18 years old on join_date (legal working age in India)
   - Maximum age: 60 years (adjust for retirement age policy)
   - Auto-compute `age` on query: `EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))`
   - Use for birthday reminders (HR automation)
   - Validate: date_of_birth cannot be in the future

3. **Gender & Diversity**:
   - Gender options: 'Male', 'Female', 'Other', 'Prefer not to say'
   - Optional fields for diversity reporting: religion, caste_category, nationality
   - Store in encrypted form if required by data privacy policy
   - Anonymous aggregation for diversity reports

4. **Marital Status & Family Details**:
   - Marital status: 'Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'
   - If married, capture `spouse_name` and `number_of_children`
   - Used for tax calculations (HRA exemption depends on marital status)
   - Used for health insurance (family coverage)

5. **Physical Disability & Accessibility**:
   - `physically_challenged` flag for reasonable accommodation
   - If true, capture `disability_details` for HR planning
   - Ensure workplace accessibility and adaptive tools
   - Anonymous reporting for diversity metrics

6. **Photo Management**:
   - Store passport-size photo as base64 or cloud URL
   - Recommended size: 200x200 pixels, max 500 KB
   - Generate thumbnail (100x100 pixels) for quick loading
   - Use for ID cards, directory, attendance systems
   - Validate: Only JPG, JPEG, PNG formats allowed

7. **Contact Number Validation**:
   - Primary contact number is mandatory (mobile preferred)
   - Format: +91-XXXXXXXXXX (Indian format) or E.164 international format
   - Validate: 10-digit number after country code
   - Alternate contact optional (landline or secondary mobile)
   - Used for SMS notifications, OTP, emergency calls

8. **Emergency Contact**:
   - Capture emergency contact name, relationship, phone number
   - Mandatory recommendation: At least one emergency contact
   - Displayed on employee ID cards
   - Used for critical incident notifications
   - Relationship options: 'Spouse', 'Parent', 'Sibling', 'Friend', 'Other'

9. **Personal Email**:
   - Mandatory and must be unique across all employees
   - Used for communication after employee exit
   - Used for password reset if official email is deactivated
   - Validate email format: RFC 5322 compliant
   - Cannot be same as official email

10. **Address Management**:
    - **Permanent Address**: Home/native address (for official records)
    - **Current Address**: Where employee currently resides
    - If `same_as_permanent = true`, auto-copy permanent to current
    - Store structured fields: line1, line2, city, state, pincode, country
    - Auto-compute full address as concatenated text for display
    - Validate pincode format: 6 digits for India, varies by country
    - Used for location-based benefits (HRA, conveyance)

11. **Address Validation Rules**:
    - Current address is mandatory (all fields: line1, city, state, pincode, country)
    - Permanent address optional but recommended
    - If permanent address not provided, use current address as default
    - Auto-capitalize city and state names
    - Validate pincode against city/state (API integration with postal service)

12. **Statutory Numbers - PF (Provident Fund)**:
    - PF number format: UAN (Universal Account Number) - 12 digits
    - Unique across all employees (cannot be reused)
    - Mandatory for employees with salary > ₹15,000
    - Capture `pf_joining_date` when PF is activated
    - Used for PF remittance and Form 3A/10 generation
    - Validate uniqueness before saving

13. **Statutory Numbers - ESI (Employee State Insurance)**:
    - ESI number format: 17 digits (10 for IP number + 7 for family)
    - Mandatory for employees with gross salary < ₹21,000
    - Auto-compute `esi_eligible = true` if gross < ₹21,000
    - Used for ESI premium remittance
    - Validate uniqueness before saving

14. **PAN (Permanent Account Number)**:
    - Format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
    - Case-insensitive, stored as uppercase
    - Mandatory for TDS deduction (if salary > taxable limit)
    - Validate format using regex: `^[A-Z]{5}[0-9]{4}[A-Z]$`
    - Validate uniqueness (one employee per PAN)
    - Fourth character indicates entity type: 'P' for individual

15. **Aadhar (Unique Identity Number)**:
    - Format: 12 digits
    - Encrypt at rest using AES-256
    - Display masked version: 'XXXX-XXXX-1234' (show last 4 digits only)
    - Not mandatory but recommended for identity verification
    - Used for linking PF UAN to Aadhar
    - Never display full Aadhar in UI or logs (privacy compliance)

16. **Passport & Driving License**:
    - Capture passport number and expiry date (if employee has passport)
    - Used for international travel arrangements
    - Send expiry reminders 60 days before expiration
    - Driving license: For employees using company vehicles
    - Validate expiry: Cannot be in the past for active employees

17. **Family Details**:
    - Capture father's name, mother's name (as per documents)
    - Spouse name (if married)
    - Number of children (for tax calculations, insurance coverage)
    - Used for dependent declarations in income tax
    - Used for health insurance family floater coverage

18. **Previous Employment Details**:
    - Capture previous employer name, designation, experience years
    - Total professional experience (sum of all previous experiences)
    - Used for experience-based salary calculation
    - Verify through experience letters during onboarding
    - Used for probation period determination (experienced vs fresher)

19. **Educational Qualifications**:
    - Highest qualification: 'High School', '12th', 'Diploma', 'Bachelor', 'Master', 'PhD'
    - Capture stream/specialization, university, year of passing, percentage/CGPA
    - Verify through degree certificates during onboarding
    - Used for role eligibility and career progression
    - Minimum qualification check against designation requirements

20. **Data Privacy & Security**:
    - Encrypt sensitive fields at rest: Aadhar number, bank account details
    - Mask sensitive data in UI: Aadhar (show last 4), PAN (show last 4)
    - Access control: HR and Admin can view full data, employees can view own data
    - Audit log all access to personal information
    - GDPR/data privacy compliance: Allow data export and deletion on request

21. **Mandatory vs Optional Fields (Onboarding)**:
    - **Mandatory**: first_name, last_name, date_of_birth, gender, contact_number, personal_email, current_address
    - **Highly Recommended**: emergency contact, blood group, father_name, mother_name
    - **Optional**: middle_name, alternate_contact, permanent_address, previous employment, education
    - **Statutory (conditional)**: PF number (if applicable), ESI number (if applicable), PAN (if TDS applicable)

22. **Data Validation on Save**:
    ```javascript
    function validatePersonalInfo(data) {
      // Age validation
      const age = calculateAge(data.date_of_birth);
      if (age < 18) throw new Error('Employee must be at least 18 years old');
      if (age > 60) flagForReview('Employee age exceeds retirement age');
      
      // Contact validation
      if (!/^(\+\d{1,3}[- ]?)?\d{10}$/.test(data.contact_number)) {
        throw new Error('Invalid contact number format');
      }
      
      // PAN validation
      if (data.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.pan_number)) {
        throw new Error('Invalid PAN format');
      }
      
      // Email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.personal_email)) {
        throw new Error('Invalid email format');
      }
    }
    ```

23. **Blood Group & Medical Information**:
    - Blood group: 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
    - Used for emergency medical response
    - Display on employee ID cards
    - Use for organizing blood donation camps

24. **Address Proof & Identity Verification**:
    - Link permanent address to address proof document (Aadhar, utility bill)
    - Link PAN number to PAN card document upload
    - Link Aadhar number to Aadhar card document upload
    - Verify documents during onboarding process
    - Mark verification status in documents table

**Index Specifications** (Additional to Employee indexes):
```sql
-- Personal information lookups
CREATE INDEX idx_employees_full_name ON employees(LOWER(full_name));
CREATE INDEX idx_employees_dob ON employees(date_of_birth);
CREATE INDEX idx_employees_contact ON employees(contact_number);
CREATE INDEX idx_employees_personal_email ON employees(personal_email);

-- Statutory number lookups
CREATE UNIQUE INDEX idx_employees_pf_number ON employees(pf_number) WHERE pf_number IS NOT NULL;
CREATE UNIQUE INDEX idx_employees_esi_number ON employees(esi_number) WHERE esi_number IS NOT NULL;
CREATE UNIQUE INDEX idx_employees_pan_number ON employees(pan_number) WHERE pan_number IS NOT NULL;

-- Birthday reminders
CREATE INDEX idx_employees_birthday ON employees(EXTRACT(MONTH FROM date_of_birth), EXTRACT(DAY FROM date_of_birth));

-- Age-based queries
CREATE INDEX idx_employees_age_retirement ON employees(date_of_birth) WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 58;
```

**Relationships**:
- **Documents**: Link to Aadhar, PAN, Passport, Address Proof documents
- **BankDetails**: Link via bank_account_id for salary payment

**Access Control**:
- Employees: View own personal information (read-only)
- HR: View/edit all employees' personal information
- Managers: View direct reports' basic contact information only
- Admin: Full access to all personal information
- Audit log: Track all access and modifications to sensitive fields

---

### 2.3 Employee Employment Details (Embedded in Employee)
**Description**: Employment-specific information defining an employee's position within the organization including employment type, department, designation, reporting hierarchy, location, work arrangements, and contractual terms. These fields establish the organizational structure, role clarity, and employment terms. Critical for access control, payroll processing, approval workflows, and organizational chart generation.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| employee_id | VARCHAR(20) | PRIMARY KEY, NOT NULL, UNIQUE | System-generated unique identifier (format: EMP-YYYY-NNNN) |
| employment_type | ENUM | NOT NULL | Type: 'full-time', 'part-time', 'contract', 'intern', 'consultant' |
| employment_category | ENUM | NULL | Category: 'Permanent', 'Temporary', 'Fixed-Term Contract', 'Probation' |
| contract_type | VARCHAR(50) | NULL | Contract type for consultants: 'Retainer', 'Project-based', 'Hourly' |
| contract_start_date | DATE | NULL | Contract start date (for contract/consultant employees) |
| contract_end_date | DATE | NULL | Contract end date (for fixed-term contracts) |
| contract_duration_months | INT | GENERATED | Auto-computed: MONTHS_BETWEEN(contract_end_date, contract_start_date) |
| is_contract_renewable | BOOLEAN | NULL | Whether contract is renewable upon expiry |
| department_id | INT | FOREIGN KEY, NOT NULL | Reference to Department (departments.id) |
| designation_id | UUID | FOREIGN KEY, NOT NULL | Reference to Designation (designations.id) |
| job_title | VARCHAR(255) | NULL | Official job title (may differ from designation.title) |
| job_description | TEXT | NULL | Detailed job responsibilities and expectations |
| reporting_manager_id | VARCHAR(20) | FOREIGN KEY, NULL | Reference to Employee (employees.employee_id) - Direct manager |
| functional_manager_id | VARCHAR(20) | FOREIGN KEY, NULL | Reference to Employee - Functional/dotted line manager |
| hr_manager_id | VARCHAR(20) | FOREIGN KEY, NULL | Reference to Employee - Assigned HR business partner |
| join_date | DATE | NOT NULL | Date of joining the company (first day of employment) |
| effective_date | DATE | NULL | Effective date for current role (may differ from join_date after internal transfer) |
| original_join_date | DATE | NULL | Original join date if employee left and rejoined (rehire scenario) |
| tenure_years | DECIMAL(4,2) | GENERATED | Auto-computed: YEARS_BETWEEN(CURRENT_DATE, join_date) |
| tenure_months | INT | GENERATED | Auto-computed: MONTHS_BETWEEN(CURRENT_DATE, join_date) |
| tenure_days | INT | GENERATED | Auto-computed: DAYS_BETWEEN(CURRENT_DATE, join_date) |
| confirmation_date | DATE | NULL | Date when probation ended and employee was confirmed |
| confirmation_status | ENUM | NOT NULL, DEFAULT 'pending' | Status: 'pending', 'confirmed', 'extended', 'terminated' |
| probation_period_months | INT | NOT NULL, DEFAULT 6 | Probation period in months (typically 3 or 6) |
| probation_end_date | DATE | GENERATED | Auto-computed: join_date + probation_period_months |
| probation_extended_by_months | INT | NULL, DEFAULT 0 | Additional months if probation is extended |
| probation_extension_reason | TEXT | NULL | Reason for probation extension |
| official_email | VARCHAR(255) | UNIQUE, NOT NULL | Company-provided email (format: firstname.lastname@ecovale.com) |
| email_alias | VARCHAR(255) | NULL | Email alias or distribution list membership |
| work_location | VARCHAR(100) | NOT NULL | Primary work location: 'Bangalore', 'Mangaluru', 'Mysore', 'Belagaum', 'Hubballi', 'Kolar', 'Tumkur', 'Shivamogga', 'Remote', 'Hybrid' |
| office_address | TEXT | NULL | Full office address for the work location |
| work_arrangement | ENUM | NOT NULL, DEFAULT 'office' | Arrangement: 'office', 'remote', 'hybrid', 'field' |
| remote_work_eligible | BOOLEAN | NOT NULL, DEFAULT false | Whether employee is eligible for remote work |
| remote_work_days_per_week | INT | NULL | Number of remote work days allowed per week (0-5) |
| office_days_per_week | INT | NULL | Required office days per week for hybrid employees |
| shift_type | ENUM | NULL | Shift: 'day', 'night', 'rotational', 'flexible', 'general' |
| shift_start_time | TIME | NULL | Shift start time (e.g., 09:00:00) |
| shift_end_time | TIME | NULL | Shift end time (e.g., 18:00:00) |
| work_hours_per_day | DECIMAL(4,2) | NOT NULL, DEFAULT 8.0 | Standard work hours per day |
| work_hours_per_week | DECIMAL(4,2) | NOT NULL, DEFAULT 40.0 | Standard work hours per week |
| overtime_eligible | BOOLEAN | NOT NULL, DEFAULT false | Whether employee is eligible for overtime pay |
| grade | VARCHAR(10) | NULL | Employee grade/level: 'A', 'B', 'C', 'D', 'E' (company-specific grading) |
| level | VARCHAR(20) | NULL | Career level: 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Director', 'VP', 'C-Level' |
| band | VARCHAR(10) | NULL | Salary band (e.g., 'B1', 'B2', 'B3') |
| employee_type | ENUM | NULL | Type: 'Individual Contributor', 'People Manager', 'Project Manager', 'Tech Lead' |
| cost_center | VARCHAR(50) | NULL | Cost center code for accounting and budgeting |
| business_unit | VARCHAR(100) | NULL | Business unit or division |
| project_allocation | VARCHAR(100) | NULL | Current project assignment (if project-based org) |
| billability_status | ENUM | NULL | Status: 'Billable', 'Non-Billable', 'Internal' (for consulting firms) |
| utilization_target_percentage | DECIMAL(5,2) | NULL | Target billable utilization % (e.g., 80%) |
| notice_period_days | INT | NOT NULL, DEFAULT 60 | Notice period in days (typically 30, 60, or 90) |
| notice_period_buyout_allowed | BOOLEAN | NOT NULL, DEFAULT false | Whether notice period can be bought out |
| separation_date | DATE | NULL | Last working day (if employee has resigned/terminated) |
| exit_date | DATE | NULL | Actual exit date (may differ from separation_date if serving notice) |
| exit_type | VARCHAR(50) | NULL | Type: 'Resignation', 'Termination', 'Retirement', 'Layoff', 'End of Contract', 'Death' |
| exit_initiated_by | VARCHAR(50) | NULL | Who initiated: 'Employee', 'Employer', 'Mutual', 'Retirement' |
| exit_reason | TEXT | NULL | Detailed exit reason or resignation reason |
| notice_period_served_days | INT | NULL | Actual notice period served before exit |
| notice_period_waived | BOOLEAN | NULL | Whether notice period was waived by employer |
| rehire_eligible | BOOLEAN | NULL, DEFAULT true | Whether employee is eligible for rehire |
| status | ENUM | NOT NULL, DEFAULT 'active' | Status: 'new', 'active', 'on_leave', 'suspended', 'exited', 'deceased' |
| status_change_date | DATE | NULL | Date of last status change |
| status_change_reason | TEXT | NULL | Reason for status change |
| is_people_manager | BOOLEAN | NOT NULL, DEFAULT false | Whether employee manages other employees |
| direct_reports_count | INT | GENERATED | Auto-computed: COUNT of employees reporting to this employee |
| team_size | INT | NULL | Total team size including indirect reports |
| budget_authority | BOOLEAN | NOT NULL, DEFAULT false | Whether employee has budget approval authority |
| approval_limit | DECIMAL(12,2) | NULL | Maximum approval limit for expenses/purchases |
| visa_required | BOOLEAN | NULL | Whether employee requires work visa |
| visa_type | VARCHAR(50) | NULL | Visa type: 'H1B', 'L1', 'E2', etc. (for international employees) |
| visa_expiry_date | DATE | NULL | Work visa expiry date |
| work_permit_number | VARCHAR(50) | NULL | Work permit/authorization number |
| seating_location | VARCHAR(100) | NULL | Desk/cube number or seating area |
| phone_extension | VARCHAR(20) | NULL | Office phone extension |
| employee_handbook_acknowledged | BOOLEAN | NOT NULL, DEFAULT false | Whether employee acknowledged handbook |
| handbook_acknowledged_date | DATE | NULL | Date of handbook acknowledgment |
| confidentiality_agreement_signed | BOOLEAN | NOT NULL, DEFAULT false | Whether NDA/confidentiality agreement is signed |
| non_compete_agreement_signed | BOOLEAN | NULL | Whether non-compete agreement is signed |
| background_verification_status | ENUM | NULL | Status: 'Pending', 'In Progress', 'Completed', 'Failed', 'Not Required' |
| background_verification_date | DATE | NULL | Date when BGV was completed |
| background_verification_agency | VARCHAR(255) | NULL | Name of BGV agency |
| police_verification_status | ENUM | NULL | Status: 'Pending', 'Completed', 'Not Required' |
| reference_check_status | ENUM | NULL | Status: 'Pending', 'Completed', 'Not Required' |
| onboarding_completed | BOOLEAN | NOT NULL, DEFAULT false | Whether onboarding process is completed |
| onboarding_completion_date | DATE | NULL | Date when onboarding was completed |
| buddy_employee_id | VARCHAR(20) | FOREIGN KEY, NULL | Reference to Employee - Onboarding buddy |
| mentor_employee_id | VARCHAR(20) | FOREIGN KEY, NULL | Reference to Employee - Career mentor |
| laptop_issued | BOOLEAN | NULL | Whether company laptop is issued |
| laptop_serial_number | VARCHAR(50) | NULL | Laptop serial number for asset tracking |
| id_card_issued | BOOLEAN | NULL | Whether employee ID card is issued |
| id_card_number | VARCHAR(50) | NULL | Employee ID card number |
| access_card_number | VARCHAR(50) | NULL | Building/office access card number |
| parking_allocated | BOOLEAN | NULL | Whether parking spot is allocated |
| parking_spot_number | VARCHAR(20) | NULL | Parking spot number |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |
| created_by | UUID | FOREIGN KEY, NOT NULL | User who created the record (users.id) |
| updated_by | UUID | FOREIGN KEY, NULL | User who last updated the record (users.id) |

**Business Rules**:

1. **Employee ID Generation**:
   - Format: `EMP-{YEAR}-{SEQUENTIAL_NUMBER}` (e.g., EMP-2026-0001, EMP-2026-0002)
   - Auto-generated on employee creation
   - Unique across all employees (current and past)
   - Never reused even after employee exits
   - Sequential number resets each calendar year

2. **Employment Type & Category**:
   - **Full-time**: Regular full-time employment with standard benefits
   - **Part-time**: Reduced hours with pro-rated benefits
   - **Contract**: Fixed-term contract with defined start and end dates
   - **Intern**: Temporary internship (typically 3-6 months)
   - **Consultant**: External consultant on retainer or project basis
   - Employment category: 'Permanent', 'Temporary', 'Fixed-Term Contract', 'Probation'

3. **Contract Management** (for contract/consultant employees):
   - Capture contract_start_date and contract_end_date
   - Auto-compute contract_duration_months
   - Send renewal reminders 60 days before expiry
   - Mark is_contract_renewable flag for automatic renewal eligibility
   - Convert to permanent upon renewal (update employment_type)

4. **Official Email Generation**:
   - Format: `{first_name}.{last_name}@ecovale.com`
   - Convert to lowercase, remove spaces and special characters
   - Handle duplicates with numeric suffix: alice.johnson2@ecovale.com
   - Validate uniqueness before creation
   - Create email account in company email system (Azure AD, G Suite)
   - Deactivate email on employee exit (but retain for 90 days for handover)

5. **Department & Designation**:
   - Department is mandatory (every employee must belong to a department)
   - Designation must belong to the selected department
   - Designation determines salary range and job responsibilities
   - Job title can differ from designation.title for custom roles
   - Changes to department/designation trigger career_history event

6. **Reporting Structure**:
   - **Direct Manager** (reporting_manager_id): Primary reporting relationship
   - **Functional Manager** (functional_manager_id): Matrix organization dotted line manager
   - **HR Manager** (hr_manager_id): Assigned HR business partner for employee support
   - Validate: Employee cannot report to self
   - Validate: No circular reporting (A → B → C → A)
   - Trigger: check_circular_reporting() prevents cycles

7. **Join Date & Tenure**:
   - join_date is mandatory and cannot be in the future
   - Auto-compute tenure: years, months, days since join_date
   - original_join_date: For rehired employees (track first join date)
   - effective_date: For internal transfers (current role start date)
   - Display tenure in employee profile: "2 years, 3 months, 15 days"

8. **Probation Management**:
   - Default probation period: 6 months (can be customized 3-12 months)
   - Auto-compute probation_end_date = join_date + probation_period_months
   - Confirmation status: 'pending' → 'confirmed' or 'extended' or 'terminated'
   - Send reminders 30 days before probation end date to manager/HR
   - If extended, capture probation_extended_by_months and reason
   - Cannot process performance appraisal until confirmed

9. **Work Location & Arrangement**:
   - Primary work location: Office city/name or 'Remote'
   - Work arrangement: 'office' (full-time in office), 'remote' (full-time remote), 'hybrid' (mix), 'field' (sales/field roles)
   - For hybrid: Specify office_days_per_week (e.g., 3 days office, 2 days remote)
   - remote_work_eligible flag determines eligibility
   - Remote work policy may vary by role, level, and location

10. **Shift & Work Hours**:
    - shift_type: 'day', 'night', 'rotational', 'flexible', 'general'
    - Capture shift_start_time and shift_end_time
    - Standard: 8 hours/day, 40 hours/week (can be customized)
    - overtime_eligible: Whether employee gets overtime pay (typically for non-management)
    - Use for attendance tracking and overtime calculation

11. **Grade, Level, Band**:
    - **Grade**: Company-specific grading system (A, B, C, D, E)
    - **Level**: Career level (Junior, Mid-Level, Senior, Lead, Manager, Director, VP, C-Level)
    - **Band**: Salary band within grade (B1, B2, B3)
    - Used for compensation benchmarking and career progression
    - Determines benefits eligibility and approval authorities

12. **Cost Center & Business Unit**:
    - cost_center: Accounting code for expense allocation
    - business_unit: Division or business line
    - project_allocation: For project-based organizations
    - billability_status: For consulting firms (Billable vs Non-Billable)
    - Used for financial reporting and resource planning

13. **Notice Period**:
    - Standard: 60 days (can be 30, 60, or 90 based on role/level)
    - notice_period_buyout_allowed: Whether employee can pay to reduce notice period
    - Track notice_period_served_days on exit
    - notice_period_waived: If employer waives notice period
    - Calculate last working day = resignation_date + notice_period_days

14. **Employee Exit**:
    - separation_date: Last working day
    - exit_type: 'Resignation', 'Termination', 'Retirement', 'Layoff', 'End of Contract'
    - exit_initiated_by: 'Employee', 'Employer', 'Mutual'
    - rehire_eligible: Flag for future hiring consideration
    - Status changes to 'exited' on separation_date
    - Trigger exit workflow: Asset return, clearance, full & final settlement

15. **Background Verification**:
    - background_verification_status: 'Pending' (default for new hires) → 'Completed'
    - Capture BGV agency name and completion date
    - Police verification for sensitive roles
    - Reference check status
    - Block payroll activation until BGV is completed

16. **Onboarding**:
    - onboarding_completed flag marks completion of onboarding process
    - Buddy system: Assign buddy_employee_id for new hire support
    - Mentor: Assign mentor_employee_id for career guidance
    - Employee handbook and confidentiality agreement acknowledgment required
    - Onboarding checklist: IT setup, document submission, induction training

17. **Asset Management**:
    - Track laptop issuance: laptop_issued, laptop_serial_number
    - ID card: id_card_issued, id_card_number
    - Access card: access_card_number (for building entry)
    - Parking: parking_allocated, parking_spot_number
    - Phone extension and seating location for office employees

18. **People Manager Flag**:
    - is_people_manager: true if employee has direct reports
    - Auto-compute direct_reports_count
    - Manually capture team_size (including indirect reports)
    - Determines eligibility for manager training and different appraisal process

19. **Approval Authority**:
    - budget_authority: Whether employee can approve budgets
    - approval_limit: Maximum amount employee can approve (expenses, purchases, POs)
    - Used in expense approval workflows

20. **International Employees** (Visa tracking):
    - visa_required: For employees requiring work visa
    - Capture visa_type, visa_expiry_date, work_permit_number
    - Send alerts 90 days before visa expiry
    - Block payroll if visa expires without renewal

21. **Status Management**:
    - **new**: Just created, onboarding in progress
    - **active**: Confirmed, actively working
    - **on_leave**: On extended leave (maternity, sabbatical)
    - **suspended**: Temporarily suspended (disciplinary action)
    - **exited**: No longer employed
    - **deceased**: In case of employee death
    - Track status_change_date and reason for audit

**Index Specifications** (Additional to Employee indexes):
```sql
-- Employment lookups
CREATE INDEX idx_employees_department ON employees(department_id, status);
CREATE INDEX idx_employees_designation ON employees(designation_id, status);
CREATE INDEX idx_employees_manager ON employees(reporting_manager_id) WHERE reporting_manager_id IS NOT NULL;
CREATE INDEX idx_employees_work_location ON employees(work_location, status);
CREATE INDEX idx_employees_employment_type ON employees(employment_type, status);

-- Email lookup
CREATE UNIQUE INDEX idx_employees_official_email ON employees(LOWER(official_email));

-- Probation tracking
CREATE INDEX idx_employees_probation ON employees(probation_end_date, confirmation_status) WHERE confirmation_status = 'pending';

-- Active employees
CREATE INDEX idx_employees_active ON employees(status, join_date DESC) WHERE status = 'active';

-- Tenure queries
CREATE INDEX idx_employees_tenure ON employees(join_date, status);

-- People managers
CREATE INDEX idx_employees_managers ON employees(is_people_manager) WHERE is_people_manager = true;

-- Contract expiry
CREATE INDEX idx_employees_contract_expiry ON employees(contract_end_date) WHERE employment_type IN ('contract', 'consultant') AND contract_end_date IS NOT NULL;

-- Visa expiry
CREATE INDEX idx_employees_visa_expiry ON employees(visa_expiry_date) WHERE visa_required = true AND visa_expiry_date IS NOT NULL;
```

**Relationships**:
- **Department** (N:1) - Employee belongs to one department
- **Designation** (N:1) - Employee has one designation
- **Employee** (reporting_manager_id, functional_manager_id, hr_manager_id, buddy_employee_id, mentor_employee_id) - Self-referential relationships

**Access Control**:
- Employees: View own employment details (read-only)
- Managers: View direct reports' employment details
- HR: View/edit all employees' employment details
- Admin: Full access to all employment information
- Audit log: Track all changes to employment details (esp. status, department, manager changes)

---

### 2.4 Employee Salary Information (Embedded in Employee)
**Description**: Comprehensive salary structure and payment details following Indian statutory requirements and company policies. Includes salary components (basic, HRA, allowances), statutory deductions (PF, ESI, PT, TDS), employer contributions, professional fees for consultants, and net salary computation. All calculations are automated based on CTC and follow Indian tax and labor laws. Supports multiple payment modes and integrates with payroll processing.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| ctc | DECIMAL(12,2) | NOT NULL | Annual Cost to Company (total compensation including all benefits) |
| ctc_monthly | DECIMAL(12,2) | GENERATED | Auto-computed: ctc / 12 (monthly CTC) |
| salary_structure_type | ENUM | NOT NULL, DEFAULT 'standard' | Type: 'standard', 'consultant', 'intern', 'contract' |
| basic | DECIMAL(12,2) | NOT NULL | Monthly basic salary (50% of CTC) |
| basic_percentage | DECIMAL(5,2) | NOT NULL, DEFAULT 50.00 | Basic as percentage of CTC (typically 50%) |
| hra_percentage | DECIMAL(5,2) | NOT NULL | HRA percentage of basic (typically 40% or 50%) |
| hra | DECIMAL(12,2) | NOT NULL | Monthly House Rent Allowance (hra_percentage of basic) |
| conveyance | DECIMAL(12,2) | NOT NULL, DEFAULT 1600 | Monthly conveyance allowance (₹1,600 for metro, ₹800 for non-metro) |
| telephone | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Monthly telephone/mobile allowance |
| medical_allowance | DECIMAL(12,2) | NOT NULL, DEFAULT 1250 | Monthly medical allowance (₹1,250/month = ₹15,000/year exempt) |
| special_allowance | DECIMAL(12,2) | NOT NULL | Monthly special allowance (balancing component) |
| other_allowances | DECIMAL(12,2) | NULL, DEFAULT 0 | Other monthly allowances (LTA, education, etc.) |
| fixed_allowances_total | DECIMAL(12,2) | GENERATED | Auto-computed: Sum of all fixed allowances |
| variable_pay_annual | DECIMAL(12,2) | NULL, DEFAULT 0 | Annual variable pay/performance bonus (if applicable) |
| variable_pay_monthly | DECIMAL(12,2) | NULL, DEFAULT 0 | Monthly variable pay component |
| employee_health_insurance_annual | DECIMAL(12,2) | NOT NULL, DEFAULT 1000 | Annual health insurance premium (employer-paid) |
| employee_health_insurance_monthly | DECIMAL(12,2) | GENERATED | Auto-computed: employee_health_insurance_annual / 12 |
| gross | DECIMAL(12,2) | NOT NULL | Monthly gross salary (sum of all earnings before deductions) |
| gross_annual | DECIMAL(12,2) | GENERATED | Auto-computed: gross * 12 |
| include_pf | BOOLEAN | NOT NULL | Whether PF (Provident Fund) is applicable |
| pf_wage_ceiling | DECIMAL(12,2) | NOT NULL, DEFAULT 15000 | PF wage ceiling (₹15,000 as per EPF Act) |
| pf_eligible_wage | DECIMAL(12,2) | GENERATED | Auto-computed: MIN(basic, pf_wage_ceiling) |
| pf_deduction_percentage | DECIMAL(5,2) | NOT NULL, DEFAULT 12.00 | Employee PF contribution % (12% of basic) |
| pf_deduction | DECIMAL(12,2) | NOT NULL | Monthly employee PF deduction (12% of basic, max ₹1,800) |
| employer_pf_percentage | DECIMAL(5,2) | NOT NULL, DEFAULT 12.00 | Employer PF contribution % (12% of basic) |
| employer_pf | DECIMAL(12,2) | NOT NULL | Monthly employer PF contribution (12% of basic, max ₹1,800) |
| employer_eps | DECIMAL(12,2) | GENERATED | Employer EPS contribution (8.33% of basic, max ₹1,250) |
| employer_epf | DECIMAL(12,2) | GENERATED | Employer EPF contribution (employer_pf - employer_eps) |
| include_esi | BOOLEAN | NOT NULL | Whether ESI (Employee State Insurance) is applicable |
| esi_wage_ceiling | DECIMAL(12,2) | NOT NULL, DEFAULT 21000 | ESI wage ceiling (₹21,000/month) |
| esi_eligible | BOOLEAN | GENERATED | Auto-computed: true if gross < esi_wage_ceiling |
| esi_deduction_percentage | DECIMAL(5,2) | NOT NULL, DEFAULT 0.75 | Employee ESI contribution % (0.75% of gross) |
| esi_deduction | DECIMAL(12,2) | NOT NULL | Monthly employee ESI deduction (0.75% of gross if eligible) |
| employer_esi_percentage | DECIMAL(5,2) | NOT NULL, DEFAULT 3.25 | Employer ESI contribution % (3.25% of gross) |
| employer_esi | DECIMAL(12,2) | NULL | Monthly employer ESI contribution (3.25% of gross if eligible) |
| professional_tax_state | VARCHAR(50) | NULL | State for PT calculation (e.g., 'Karnataka', 'Maharashtra') |
| professional_tax | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Monthly professional tax (state-specific, e.g., ₹200 in Karnataka) |
| pt_slab | VARCHAR(20) | NULL | PT slab based on gross (e.g., 'Above 15000') |
| income_tax_regime | ENUM | NOT NULL, DEFAULT 'new' | Tax regime: 'old', 'new' (as per Finance Act) |
| tds_exemptions | DECIMAL(12,2) | NULL, DEFAULT 0 | Annual tax exemptions (80C, 80D, HRA, etc.) |
| tds_annual | DECIMAL(12,2) | NOT NULL, DEFAULT 0 | Annual TDS amount (computed from salary structure and exemptions) |
| tds_monthly | DECIMAL(12,2) | GENERATED | Auto-computed: tds_annual / 12 |
| standard_deduction | DECIMAL(12,2) | NOT NULL, DEFAULT 50000 | Standard deduction (₹50,000/year under new regime) |
| hra_exemption_claimed | DECIMAL(12,2) | NULL, DEFAULT 0 | HRA exemption amount (under old tax regime) |
| other_deductions | DECIMAL(12,2) | NULL, DEFAULT 0 | Other monthly deductions (loans, advances, etc.) |
| total_deductions | DECIMAL(12,2) | GENERATED | Auto-computed: Sum of all deductions (PF + ESI + PT + TDS + others) |
| net | DECIMAL(12,2) | NOT NULL | Monthly net salary (take-home): gross - total_deductions |
| net_annual | DECIMAL(12,2) | GENERATED | Auto-computed: net * 12 |
| gst_applicable | BOOLEAN | NOT NULL, DEFAULT false | Whether GST applies (for consultants) |
| gst_percentage | DECIMAL(5,2) | NULL, DEFAULT 18.00 | GST percentage (18% in India) |
| gst_monthly | DECIMAL(12,2) | NULL, DEFAULT 0 | Monthly GST amount (for consultants) |
| gst_annual | DECIMAL(12,2) | NULL, DEFAULT 0 | Annual GST amount |
| professional_fees_inclusive | BOOLEAN | NULL, DEFAULT false | Whether professional fees are GST-inclusive or exclusive |
| professional_fees_base_monthly | DECIMAL(12,2) | NULL | Base monthly professional fees (before GST) |
| professional_fees_gst | DECIMAL(12,2) | NULL | GST on professional fees |
| professional_fees_total_monthly | DECIMAL(12,2) | NULL | Total monthly professional fees (base + GST) |
| professional_fees_base_annual | DECIMAL(12,2) | NULL | Base annual professional fees |
| professional_fees_total_annual | DECIMAL(12,2) | NULL | Total annual professional fees |
| consultant_tds_percentage | DECIMAL(5,2) | NULL, DEFAULT 10.00 | TDS on professional fees (10% as per Section 194J) |
| consultant_tds_monthly | DECIMAL(12,2) | NULL | Monthly TDS on consultant fees |
| payment_mode | ENUM | NOT NULL, DEFAULT 'Bank' | Payment mode: 'Bank', 'Cash', 'Cheque', 'UPI' |
| bank_account_id | UUID | FOREIGN KEY, NULL | Reference to BankDetails (primary bank account) |
| payment_frequency | ENUM | NOT NULL, DEFAULT 'monthly' | Frequency: 'monthly', 'bi-weekly', 'weekly' |
| salary_hold | BOOLEAN | NOT NULL, DEFAULT false | Whether salary is on hold (for any reason) |
| salary_hold_reason | TEXT | NULL | Reason for salary hold (pending documents, notice period, etc.) |
| last_salary_revision_date | DATE | NULL | Date of last salary revision |
| next_salary_revision_date | DATE | NULL | Expected date of next salary revision (annual cycle) |
| cost_to_company_components | JSONB | NULL | Detailed CTC breakdown as JSON (all components) |
| salary_calculation_notes | TEXT | NULL | Notes about salary calculation or special terms |
| arrears_pending | DECIMAL(12,2) | NULL, DEFAULT 0 | Pending arrears amount (from backdated increments) |
| advance_deduction_pending | DECIMAL(12,2) | NULL, DEFAULT 0 | Pending advance deductions |
| loan_emi_deduction | DECIMAL(12,2) | NULL, DEFAULT 0 | Monthly loan EMI deduction |
| reimbursements_pending | DECIMAL(12,2) | NULL, DEFAULT 0 | Pending reimbursements to be added in next payroll |
| overtime_hours | DECIMAL(5,2) | NULL, DEFAULT 0 | Overtime hours worked (for eligible employees) |
| overtime_rate_per_hour | DECIMAL(10,2) | NULL | Overtime rate (1.5x or 2x regular hourly rate) |
| overtime_amount | DECIMAL(10,2) | NULL, DEFAULT 0 | Overtime pay for the month |
| bonus_amount | DECIMAL(12,2) | NULL, DEFAULT 0 | One-time bonus (performance, festival, retention) |
| bonus_type | VARCHAR(100) | NULL | Type: 'Performance', 'Festival', 'Retention', 'Joining', 'Referral' |
| incentive_amount | DECIMAL(12,2) | NULL, DEFAULT 0 | Sales incentive or commission |
| gratuity_eligible | BOOLEAN | GENERATED | Auto-computed: true if tenure >= 5 years |
| gratuity_accrued | DECIMAL(12,2) | NULL | Accrued gratuity amount (calculated on exit) |
| leave_encashment_eligible | BOOLEAN | NOT NULL, DEFAULT false | Whether leave encashment is applicable |
| leave_encashment_amount | DECIMAL(12,2) | NULL, DEFAULT 0 | Leave encashment amount (on exit or annually) |
| payroll_processed_month | VARCHAR(7) | NULL | Last payroll processed month (YYYY-MM format) |
| payslip_generated | BOOLEAN | NOT NULL, DEFAULT false | Whether payslip is generated for current month |
| salary_credited_date | DATE | NULL | Date when salary was credited to bank account |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:

1. **CTC (Cost to Company)**:
   - Total annual compensation including salary, allowances, employer contributions, and benefits
   - Formula: CTC = Basic + HRA + Allowances + Employer PF + Employer ESI + Health Insurance + Bonus
   - Example: ₹6,00,000 CTC = ₹25,000 basic + ₹10,000 HRA + ₹8,850 allowances + ₹3,000 employer contributions

2. **Basic Salary Calculation**:
   - Formula: Basic = (CTC × 50%) / 12
   - Basic is always 50% of annual CTC (industry standard)
   - Example: CTC = ₹6,00,000 → Basic = (₹6,00,000 × 0.5) / 12 = ₹25,000/month

3. **HRA (House Rent Allowance)**:
   - Formula: HRA = Basic × (hra_percentage / 100)
   - Typical percentages: 40% (non-metro), 50% (metro cities)
   - Example: Basic = ₹25,000, HRA% = 40% → HRA = ₹10,000/month
   - Tax exemption: Least of (Actual HRA, Rent - 10% of Basic, 50% of Basic for metro / 40% for non-metro)

4. **Fixed Allowances**:
   - **Conveyance**: ₹1,600/month (metro), ₹800/month (non-metro) - Tax exempt up to ₹1,600
   - **Medical**: ₹1,250/month (₹15,000/year) - Tax exempt
   - **Telephone**: Variable based on role (₹500-₹2,000/month)
   - **Special Allowance**: Balancing component to match gross salary

5. **Special Allowance (Balancing Component)**:
   - Formula: Special Allowance = (CTC / 12) - Basic - HRA - Conveyance - Telephone - Medical - Health Insurance - Employer PF
   - This is the adjustable component to match desired CTC
   - Fully taxable without any exemptions

6. **Gross Salary Calculation**:
   - Formula: Gross = Basic + HRA + Conveyance + Telephone + Medical + Special Allowance + Other Allowances
   - Gross is the total earnings before deductions
   - Used as basis for ESI calculation

7. **PF (Provident Fund) Deduction**:
   - Applicability: Mandatory for employees with basic > ₹15,000 (can opt-in if basic ≤ ₹15,000)
   - Employee contribution: 12% of basic (capped at ₹15,000)
   - Formula: PF Deduction = MIN(basic, ₹15,000) × 12%
   - Example: Basic = ₹25,000 → PF = ₹15,000 × 12% = ₹1,800/month
   - Employer contribution: 12% of basic (split: 8.33% to EPS, 3.67% to EPF)

8. **ESI (Employee State Insurance) Deduction**:
   - Applicability: Mandatory for employees with gross < ₹21,000/month
   - Employee contribution: 0.75% of gross
   - Employer contribution: 3.25% of gross
   - Formula: ESI = Gross × 0.75% (if gross < ₹21,000)
   - Example: Gross = ₹18,000 → ESI = ₹18,000 × 0.75% = ₹135/month
   - Once gross exceeds ₹21,000, ESI is permanently discontinued

9. **Professional Tax (PT)**:
   - State-specific tax (varies by state)
   - Karnataka PT slabs:
     - Gross ≤ ₹15,000: Nil
     - Gross > ₹15,000: ₹200/month
   - Maharashtra PT: Progressive slabs (₹175-₹300/month)
   - Deducted monthly, paid to state government

10. **TDS (Tax Deducted at Source)**:
    - Annual income tax deducted at source
    - Computed based on:
      - Gross annual salary
      - Tax regime (old vs new)
      - Exemptions claimed (80C, 80D, HRA, etc.)
      - Standard deduction (₹50,000)
    - Formula (simplified): TDS = Tax on (Gross Annual - Standard Deduction - Exemptions)
    - Distributed monthly: TDS Monthly = TDS Annual / 12
    - Adjusted in February (last month of financial year)

11. **Net Salary Calculation**:
    - Formula: Net = Gross - (PF + ESI + PT + TDS + Other Deductions)
    - This is the take-home salary (credited to bank account)
    - Example: Gross ₹40,000 - PF ₹1,800 - PT ₹200 - TDS ₹3,000 = Net ₹35,000

12. **GST for Consultants**:
    - Applicable only for consultant/freelancer employment types
    - GST rate: 18% on professional fees
    - If GST inclusive: Base = Total / 1.18, GST = Total - Base
    - If GST exclusive: GST = Base × 18%, Total = Base + GST
    - TDS on consultants: 10% of base amount (Section 194J)

13. **Variable Pay & Bonuses**:
    - Variable pay: Performance-linked annual bonus (10-30% of CTC)
    - Paid quarterly or annually based on performance
    - Festival bonus: Diwali, Pongal bonus (fixed amount)
    - Retention bonus: To retain key employees
    - Joining bonus: Paid on joining or after probation
    - All bonuses are fully taxable

14. **Overtime Pay** (for eligible employees):
    - Eligibility: Non-management, hourly employees
    - Rate: 1.5x regular hourly rate for hours beyond 40/week
    - Formula: Overtime = Overtime Hours × (Monthly Salary / 173.33) × 1.5
    - Example: Monthly ₹30,000, 10 overtime hours → (30000/173.33) × 10 × 1.5 = ₹2,600

15. **Gratuity**:
    - Eligibility: 5+ years of continuous service
    - Formula: Gratuity = (Last drawn basic × 15 days × Years of service) / 26
    - Example: Basic ₹30,000, 7 years → (30000 × 15 × 7) / 26 = ₹1,21,154
    - Tax exempt up to ₹20 lakh
    - Paid on exit (resignation, retirement, death)

16. **Leave Encashment**:
    - Encash unused leave on exit or annually (as per policy)
    - Formula: Leave Encashment = Unused Leave Days × (Monthly Basic / 26)
    - Example: 20 unused leaves, Basic ₹30,000 → 20 × (30000/26) = ₹23,077
    - Maximum encashment: Typically 30 days

17. **Salary Hold**:
    - Reasons: Pending documents, notice period not served, disciplinary action
    - Mark salary_hold = true, capture reason
    - Cannot process payroll if salary is on hold
    - Release hold after issue resolution

18. **Arrears & Adjustments**:
    - **Arrears**: Pending amount from backdated increments/promotions
    - **Advance Recovery**: Deduct advance amount in installments
    - **Loan EMI**: Deduct monthly loan EMI from salary
    - **Reimbursements**: Add pending reimbursements (travel, medical)
    - All adjustments processed in payroll calculation

19. **Payment Mode**:
    - **Bank**: Direct credit to bank account (NEFT, IMPS, salary transfer) - Default
    - **Cash**: Cash payment (rare, for contract labor)
    - **Cheque**: Cheque payment (rare, for senior consultants)
    - **UPI**: UPI payment (for small amounts, freelancers)

20. **Salary Revision**:
    - Annual increment cycle (typically April or January)
    - Track last_salary_revision_date and next_salary_revision_date
    - Revision triggers:
      - Annual performance appraisal
      - Promotion
      - Market correction
      - Retention
    - Update CTC and recalculate all components

**Index Specifications** (Additional to Employee indexes):
```sql
-- Salary range queries
CREATE INDEX idx_employees_ctc ON employees(ctc, status);
CREATE INDEX idx_employees_basic ON employees(basic, status);
CREATE INDEX idx_employees_gross ON employees(gross, status);
CREATE INDEX idx_employees_net ON employees(net, status);

-- Statutory compliance
CREATE INDEX idx_employees_pf ON employees(include_pf) WHERE include_pf = true;
CREATE INDEX idx_employees_esi ON employees(include_esi) WHERE include_esi = true;

-- Payment processing
CREATE INDEX idx_employees_payment_mode ON employees(payment_mode, status);
CREATE INDEX idx_employees_bank_account ON employees(bank_account_id) WHERE bank_account_id IS NOT NULL;

-- Salary hold
CREATE INDEX idx_employees_salary_hold ON employees(salary_hold) WHERE salary_hold = true;

-- Payroll processing
CREATE INDEX idx_employees_payroll ON employees(status, salary_hold, payslip_generated) WHERE status = 'active' AND salary_hold = false;

-- Consultant GST
CREATE INDEX idx_employees_gst ON employees(gst_applicable) WHERE gst_applicable = true;

-- Gratuity eligible
CREATE INDEX idx_employees_gratuity ON employees(gratuity_eligible) WHERE gratuity_eligible = true;
```

**Relationships**:
- **BankDetails** (N:1) - Employee's primary bank account for salary payment

**Access Control**:
- Employees: View own salary details (masked sensitive components)
- Managers: View direct reports' salary ranges only (not detailed breakdown)
- HR: View/edit all employees' full salary details
- Finance: View all salary details for payroll processing
- Admin: Full access to all salary information
- Audit log: Track all salary changes (increments, revisions, adjustments)

---

### 2.5 BankDetails
**Description**: Employee bank account information for salary disbursement and financial transactions. Supports multiple bank accounts per employee with primary account designation for payroll processing. Includes verification status and audit trail for compliance and security.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier for the bank account record |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee (employees.employee_id) |
| bank_name | VARCHAR(255) | NOT NULL | Full name of the bank (e.g., 'State Bank of India', 'HDFC Bank') |
| account_holder_name | VARCHAR(255) | NOT NULL | Name as per bank account (must match employee's legal name) |
| account_number | VARCHAR(50) | NOT NULL | Bank account number (encrypted at rest) |
| confirm_account_number | VARCHAR(50) | NOT NULL | Confirmation of account number (validation field, not stored) |
| ifsc_code | VARCHAR(11) | NOT NULL | Indian Financial System Code (11 characters, uppercase) |
| branch | VARCHAR(255) | NOT NULL | Branch name and location |
| account_type | ENUM | NOT NULL | Type: 'Savings', 'Current', 'Salary' |
| is_primary | BOOLEAN | NOT NULL, DEFAULT true | Primary account flag for salary disbursement |
| is_verified | BOOLEAN | NOT NULL, DEFAULT false | Account verification status (penny drop test) |
| verified_at | TIMESTAMP | NULL | Timestamp of successful verification |
| verified_by | UUID | FOREIGN KEY, NULL | User who verified the account (users.id) |
| verification_method | VARCHAR(50) | NULL | Method: 'penny_drop', 'manual', 'statement_upload' |
| verification_reference | VARCHAR(100) | NULL | External verification transaction reference |
| proof_document_id | UUID | FOREIGN KEY, NULL | Reference to Document (cancelled cheque/passbook) |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active status (can be disabled without deletion) |
| deactivated_at | TIMESTAMP | NULL | Timestamp when account was deactivated |
| deactivated_by | UUID | FOREIGN KEY, NULL | User who deactivated the account |
| deactivation_reason | TEXT | NULL | Reason for deactivation |
| last_used_for_payment | TIMESTAMP | NULL | Last time this account was used for salary payment |
| payment_failure_count | INT | NOT NULL, DEFAULT 0 | Count of failed payment attempts to this account |
| last_payment_failure_reason | TEXT | NULL | Reason for the last failed payment |
| notes | TEXT | NULL | Internal notes about the account |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |
| created_by | UUID | FOREIGN KEY, NOT NULL | User who created the record (users.id) |
| updated_by | UUID | FOREIGN KEY, NULL | User who last updated the record (users.id) |

**UNIQUE Constraints**:
- UNIQUE(employee_id, account_number) - Prevent duplicate account entries for same employee
- UNIQUE(account_number, ifsc_code) - Ensure account uniqueness across all employees

**Business Rules**:

1. **Multiple Accounts & Primary Designation**:
   - Each employee can have multiple bank accounts (e.g., salary account, savings account)
   - Exactly ONE account must be marked as `is_primary = true` per employee at all times
   - Primary account is used for salary disbursement by default
   - When setting a new primary account, automatically unset the previous primary
   - Cannot delete or deactivate primary account without designating a new primary first

2. **IFSC Code Validation**:
   - Must be exactly 11 characters (e.g., 'SBIN0001234')
   - Format: First 4 characters = Bank code (alphabetic), 5th character = '0' (zero), Last 6 characters = Branch code (alphanumeric)
   - Case-insensitive input, stored as uppercase
   - Validate against RBI's IFSC directory (API integration recommended)
   - Extract bank name and branch from IFSC if available

3. **Account Holder Name Validation**:
   - Must closely match employee's legal name (first_name + last_name)
   - Allow minor variations (middle name inclusion, initials)
   - Flag for HR review if name mismatch exceeds threshold
   - Cannot contain special characters except: space, period, hyphen, apostrophe

4. **Account Number Validation**:
   - Encrypted at rest using AES-256 encryption
   - Length: 8-20 digits (varies by bank)
   - Numeric validation (some banks allow alphanumeric)
   - Require confirmation field during entry (confirm_account_number)
   - Never log or display full account number (mask: XXXX-XXXX-1234)

5. **Account Verification (Penny Drop)**:
   - Recommended to verify all accounts before first salary payment
   - Penny drop test: Send ₹1 to account and verify holder name
   - Integration with payment gateway APIs (Razorpay, Cashfree)
   - Mark `is_verified = true` only after successful verification
   - Unverified accounts should trigger warnings during payroll processing
   - Re-verification recommended if account details are modified

6. **Primary Account Management**:
   - System enforces exactly one primary account per employee
   - Trigger: `ensure_single_primary_bank_account()` - Automatically unsets other primary accounts when a new one is designated
   - API endpoint: `PUT /employees/{id}/bank-accounts/{bank_id}/set-primary`
   - Audit log all primary account changes

7. **Account Activation/Deactivation**:
   - Soft delete using `is_active = false` (preserve audit trail)
   - Cannot deactivate primary account without designating a new primary
   - Record deactivation reason and timestamp
   - Deactivated accounts excluded from payroll processing
   - Can be reactivated if needed

8. **Payment Failure Tracking**:
   - Increment `payment_failure_count` on each failed salary payment
   - Record `last_payment_failure_reason` for troubleshooting
   - After 3 consecutive failures, trigger alert to HR
   - System may automatically fallback to secondary account if configured

9. **Proof Document Requirement**:
   - Attach cancelled cheque or bank passbook copy as proof
   - Store reference to Document entity (`proof_document_id`)
   - Required for account verification and compliance

10. **Data Security & Privacy**:
    - Encrypt account_number at rest (AES-256)
    - Encrypt in transit (TLS 1.3)
    - Mask account number in UI (show last 4 digits only)
    - Restrict access to HR, Payroll, and Admin roles
    - Audit log all view/edit operations
    - GDPR compliance: Allow data export and deletion on employee exit

**Index Specifications**:
```sql
-- Primary lookup
CREATE INDEX idx_bank_details_employee ON bank_details(employee_id);

-- Primary account quick access
CREATE INDEX idx_bank_details_primary ON bank_details(employee_id, is_primary) WHERE is_primary = true;

-- Active accounts only
CREATE INDEX idx_bank_details_active ON bank_details(employee_id, is_active) WHERE is_active = true;

-- Verification status
CREATE INDEX idx_bank_details_verification ON bank_details(is_verified, verified_at);

-- Account number lookup (encrypted, for uniqueness check)
CREATE UNIQUE INDEX idx_bank_details_unique_account ON bank_details(account_number, ifsc_code);

-- Failed payment tracking
CREATE INDEX idx_bank_details_payment_failures ON bank_details(payment_failure_count, last_payment_failure_reason) WHERE payment_failure_count > 0;
```

**Relationships**:
- **Employee** (1:N) - One employee can have multiple bank accounts
- **User** (created_by, updated_by, verified_by, deactivated_by) - Audit trail
- **Document** (proof_document_id) - Cancelled cheque/passbook proof

**Access Control**:
- Employees can view own bank accounts (read-only, masked account number)
- HR and Payroll roles can view/edit all bank accounts (full access)
- Admin can view/edit all bank accounts
- Finance role can view for payment processing (read-only)
- Audit log tracks all access and modifications

---

### 2.6 Document
**Description**: Employee document management system for storing and tracking identity proofs, educational certificates, experience letters, compliance documents, and other HR records. Supports multiple file formats, version control, expiry tracking, and secure access control. Integrates with cloud storage for scalability and includes OCR metadata extraction for searchability.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier for the document |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee (employees.employee_id) |
| document_category | ENUM | NOT NULL | Category: 'Identity', 'Address', 'Educational', 'Professional', 'Financial', 'Compliance', 'HR', 'Other' |
| document_type | VARCHAR(100) | NOT NULL | Specific type: 'Aadhar', 'PAN', 'Passport', 'Driving License', 'Degree Certificate', 'Experience Letter', 'Offer Letter', 'Appointment Letter', 'Salary Slip', 'Bank Statement', 'Form 16', 'Vaccination Certificate', 'Medical Certificate', 'Cancelled Cheque', 'Relieving Letter', 'Resignation Letter', 'Background Verification', 'Photo', 'Signature', 'Other' |
| document_subtype | VARCHAR(100) | NULL | Optional subtype (e.g., '10th Marksheet', '12th Marksheet', 'Bachelor Degree', 'Master Degree') |
| file_name | VARCHAR(255) | NOT NULL | Original file name as uploaded |
| file_extension | VARCHAR(10) | NOT NULL | File extension: 'pdf', 'jpg', 'jpeg', 'png', 'docx', 'doc' |
| storage_type | ENUM | NOT NULL, DEFAULT 'database' | Storage: 'database' (base64), 'cloud' (S3/GCS), 'local' (file system) |
| file_data | TEXT | NULL | Base64 encoded file content (if storage_type = 'database') |
| file_path | VARCHAR(500) | NULL | Cloud storage path or local file system path (if storage_type != 'database') |
| storage_bucket | VARCHAR(100) | NULL | Cloud storage bucket name (e.g., 'ecovale-hr-docs-prod') |
| storage_region | VARCHAR(50) | NULL | Cloud storage region (e.g., 'ap-south-1') |
| mime_type | VARCHAR(100) | NOT NULL | MIME type: 'application/pdf', 'image/jpeg', 'image/png', etc. |
| file_size | BIGINT | NOT NULL | File size in bytes |
| file_hash | VARCHAR(64) | NOT NULL | SHA-256 hash of file content (for duplicate detection and integrity verification) |
| thumbnail_data | TEXT | NULL | Base64 encoded thumbnail for image/PDF preview |
| page_count | INT | NULL | Number of pages (for PDF documents) |
| document_number | VARCHAR(100) | NULL | Document identification number (e.g., Aadhar: '1234-5678-9012', PAN: 'ABCDE1234F') |
| document_number_masked | VARCHAR(100) | NULL | Masked version for display (e.g., 'XXXX-XXXX-9012', 'XXXXX1234F') |
| issue_date | DATE | NULL | Document issue date |
| expiry_date | DATE | NULL | Document expiry date (for passports, driving licenses, certifications) |
| is_verified | BOOLEAN | NOT NULL, DEFAULT false | Document verification status |
| verified_at | TIMESTAMP | NULL | Timestamp of verification |
| verified_by | UUID | FOREIGN KEY, NULL | User who verified the document (users.id) |
| verification_method | VARCHAR(50) | NULL | Method: 'manual_review', 'ocr_extraction', 'api_verification' (DigiLocker, etc.) |
| verification_notes | TEXT | NULL | Notes from verification process |
| is_mandatory | BOOLEAN | NOT NULL, DEFAULT false | Whether document is mandatory for onboarding/compliance |
| is_confidential | BOOLEAN | NOT NULL, DEFAULT false | High sensitivity flag (restricted access) |
| access_level | ENUM | NOT NULL, DEFAULT 'hr' | Access: 'employee' (self), 'hr' (HR team), 'admin' (Admin only), 'public' (company-wide) |
| is_expired | BOOLEAN | GENERATED | Auto-computed: true if expiry_date < CURRENT_DATE |
| days_until_expiry | INT | GENERATED | Auto-computed: expiry_date - CURRENT_DATE |
| expiry_alert_sent | BOOLEAN | NOT NULL, DEFAULT false | Whether expiry reminder was sent |
| expiry_alert_date | TIMESTAMP | NULL | When expiry reminder was sent |
| version | INT | NOT NULL, DEFAULT 1 | Document version number (for tracking replacements) |
| parent_document_id | UUID | FOREIGN KEY, NULL | Reference to previous version (self-referential) |
| is_latest_version | BOOLEAN | NOT NULL, DEFAULT true | Flag indicating the current active version |
| replacement_reason | TEXT | NULL | Reason for document replacement/update |
| tags | TEXT[] | NULL | Searchable tags (e.g., ['kyc', 'identity', 'verified', 'government_id']) |
| ocr_extracted_text | TEXT | NULL | Full text extracted via OCR for searchability |
| ocr_metadata | JSONB | NULL | Structured data extracted via OCR (e.g., {"name": "John Doe", "dob": "1990-01-01", "id_number": "1234"}) |
| upload_source | VARCHAR(50) | NULL | Source: 'web_app', 'mobile_app', 'admin_portal', 'bulk_import', 'api' |
| upload_ip_address | VARCHAR(45) | NULL | IP address of the uploader |
| is_deleted | BOOLEAN | NOT NULL, DEFAULT false | Soft delete flag |
| deleted_at | TIMESTAMP | NULL | Timestamp of deletion |
| deleted_by | UUID | FOREIGN KEY, NULL | User who deleted the document |
| deletion_reason | TEXT | NULL | Reason for deletion |
| notes | TEXT | NULL | Internal notes about the document |
| uploaded_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Upload timestamp |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |
| created_by | UUID | FOREIGN KEY, NOT NULL | User who created the record (users.id) |
| updated_by | UUID | FOREIGN KEY, NULL | User who last updated the record (users.id) |

**UNIQUE Constraints**:
- UNIQUE(employee_id, document_type, document_number) WHERE is_latest_version = true AND is_deleted = false
  (Prevent duplicate documents of same type with same number)

**Business Rules**:

1. **Document Categories & Types**:
   - **Identity**: Aadhar, PAN, Passport, Voter ID, Driving License
   - **Address**: Utility Bill, Rental Agreement, Property Tax Receipt
   - **Educational**: 10th Marksheet, 12th Marksheet, Degree Certificates, Transcripts
   - **Professional**: Experience Letters, Relieving Letters, Salary Slips, Offer Letters
   - **Financial**: Bank Statements, Form 16, Investment Proofs, Cancelled Cheque
   - **Compliance**: Background Verification, Police Verification, Medical Fitness Certificate, Vaccination Certificate
   - **HR**: Appointment Letter, Confirmation Letter, Appraisal Letter, Warning Letter, Resignation Letter
   - **Other**: Custom documents

2. **File Format Support**:
   - Allowed formats: PDF, JPG, JPEG, PNG, DOCX, DOC
   - Recommended format: PDF (for archival and security)
   - Maximum file size: 10 MB per document
   - Image files auto-converted to PDF for standardization (optional)
   - Validate MIME type against file extension to prevent spoofing

3. **Storage Strategy**:
   - **Database Storage** (default for < 1 MB): Store as base64 in `file_data` column
   - **Cloud Storage** (recommended for > 1 MB): Store in S3/GCS, save path in `file_path`
   - **Local File System**: Store on server, save absolute path in `file_path`
   - Choice determined by `storage_type` enum
   - Generate signed URLs for secure temporary access to cloud-stored documents
   - Implement CDN for frequently accessed documents (e.g., profile photos)

4. **File Integrity & Deduplication**:
   - Compute SHA-256 hash of file content on upload
   - Check if `file_hash` already exists in database before storing
   - If duplicate found, reference existing file instead of re-storing
   - Periodic integrity checks: recompute hash and compare with stored hash

5. **Document Numbering & Masking**:
   - Extract document numbers using OCR or manual entry
   - Store full number in encrypted `document_number` column
   - Generate masked version for display: 
     - Aadhar: `XXXX-XXXX-9012` (show last 4 digits)
     - PAN: `XXXXX1234F` (show last 5 characters)
     - Passport: `XXXXXXX890` (show last 3 characters)
   - Never display full document number in logs or UI without authorization

6. **Document Verification**:
   - Manual review by HR: Inspect document and mark `is_verified = true`
   - OCR extraction: Validate extracted data matches employee record
   - API integration: Verify Aadhar via DigiLocker, PAN via Income Tax API
   - Record verification method and timestamp
   - Unverified documents should flag warnings in employee profile

7. **Expiry Tracking & Alerts**:
   - Applicable for: Passport, Driving License, Professional Certifications, Medical Certificates
   - Auto-compute `is_expired` and `days_until_expiry` using triggers
   - Send email alerts:
     - 60 days before expiry (first reminder)
     - 30 days before expiry (second reminder)
     - 7 days before expiry (urgent reminder)
     - On expiry date (final notice)
   - Dashboard widget: Show all documents expiring in next 30 days
   - Prevent payroll processing if mandatory documents are expired

8. **Version Control**:
   - When replacing a document, increment `version` number
   - Set previous version's `is_latest_version = false`
   - Link new version to old via `parent_document_id`
   - Maintain full history of all document versions
   - UI: Show version history with diff capability
   - Cannot delete old versions (audit trail requirement)

9. **Mandatory Documents (Onboarding Checklist)**:
   - Mark critical documents as `is_mandatory = true`
   - Required for new employee onboarding:
     - Aadhar Card
     - PAN Card
     - Passport-size Photo
     - Educational Certificates (highest degree)
     - Previous Company Experience Letter (if applicable)
     - Cancelled Cheque / Bank Passbook
     - Medical Fitness Certificate
   - Employee profile status: "Incomplete" until all mandatory documents uploaded
   - Prevent payroll activation until mandatory documents verified

10. **Access Control & Confidentiality**:
    - `access_level` determines who can view:
      - **employee**: Only employee can view own document
      - **hr**: HR team and Admin can view
      - **admin**: Only Admin can view (highly sensitive)
      - **public**: All company employees can view (e.g., org charts, policies)
    - `is_confidential = true`: Additional encryption required, audit all access
    - Sensitive documents (Aadhar, PAN, Bank, Medical): Default to `admin` access
    - Generate time-limited signed URLs (15 minutes) for document download
    - Watermark documents with employee name and download timestamp

11. **OCR & Metadata Extraction**:
    - Auto-extract text from PDFs and images using OCR (Tesseract, Google Vision API)
    - Store full text in `ocr_extracted_text` for full-text search
    - Extract structured data (name, DOB, ID number) into `ocr_metadata` JSONB
    - Use extracted data for auto-validation against employee record
    - Flag mismatches for HR review

12. **Tagging & Search**:
    - Auto-generate tags based on document type: ['kyc', 'identity', 'government_id']
    - Allow manual tags for custom categorization
    - Full-text search across `file_name`, `ocr_extracted_text`, `tags`, `notes`
    - Advanced filters: category, type, verification status, expiry status, date ranges

13. **Soft Delete & Audit Trail**:
    - Never hard delete documents (compliance requirement)
    - Soft delete: Set `is_deleted = true`, record `deleted_at`, `deleted_by`, `deletion_reason`
    - Deleted documents excluded from default queries
    - Admin can view deleted documents in audit view
    - Restore capability: Set `is_deleted = false`

14. **Thumbnail Generation**:
    - Auto-generate thumbnails for images and PDFs (first page)
    - Store as base64 in `thumbnail_data` (max 200x200 pixels)
    - Use for quick preview in document list view
    - Lazy load full document only when user clicks to view

15. **Compliance & Retention**:
    - Document retention policy: 7 years after employee exit (Indian law)
    - Archive old documents to cold storage after 3 years
    - GDPR compliance: Allow employee to request data export or deletion (with legal review)
    - Maintain audit log of all document access, download, modifications

**Index Specifications**:
```sql
-- Primary lookup
CREATE INDEX idx_documents_employee ON documents(employee_id);

-- Active documents only
CREATE INDEX idx_documents_active ON documents(employee_id, is_latest_version, is_deleted) 
WHERE is_latest_version = true AND is_deleted = false;

-- Document type filtering
CREATE INDEX idx_documents_type ON documents(employee_id, document_category, document_type);

-- Expiry tracking
CREATE INDEX idx_documents_expiry ON documents(expiry_date, is_expired) WHERE expiry_date IS NOT NULL;

-- Verification status
CREATE INDEX idx_documents_verification ON documents(is_verified, verified_at);

-- Full-text search on OCR text
CREATE INDEX idx_documents_fulltext ON documents USING GIN(to_tsvector('english', ocr_extracted_text));

-- JSONB metadata search
CREATE INDEX idx_documents_ocr_metadata ON documents USING GIN(ocr_metadata);

-- File hash for deduplication
CREATE INDEX idx_documents_hash ON documents(file_hash);

-- Tags search
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);

-- Mandatory document check
CREATE INDEX idx_documents_mandatory ON documents(employee_id, is_mandatory, is_verified) WHERE is_mandatory = true;

-- Document number lookup (encrypted)
CREATE INDEX idx_documents_number ON documents(document_number) WHERE document_number IS NOT NULL;
```

**Relationships**:
- **Employee** (1:N) - One employee has many documents
- **User** (created_by, updated_by, verified_by, deleted_by) - Audit trail
- **Document** (parent_document_id) - Self-referential for version history

**Access Control**:
- Employees can view own documents (access_level = 'employee' or above)
- HR can view/edit all documents (except admin-level confidential)
- Admin can view/edit all documents including confidential
- Audit log tracks all document views and downloads
- Time-limited signed URLs for secure download

---

### 2.7 CareerHistory
**Description**: Comprehensive employee career progression tracking system that maintains a complete audit trail of all significant career events including promotions, demotions, salary increments, designation changes, department transfers, location changes, performance milestones, and employment status changes. Enables analytics on career growth patterns, retention metrics, and compensation trends. Supports approver workflows and timeline visualization.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier for the career event |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee (employees.employee_id) |
| event_category | ENUM | NOT NULL | Category: 'Career', 'Compensation', 'Transfer', 'Status', 'Performance', 'Other' |
| event_type | ENUM | NOT NULL | Type: 'promotion', 'demotion', 'lateral_move', 'increment', 'salary_revision', 'department_transfer', 'location_transfer', 'confirmation', 'contract_renewal', 'resignation', 'termination', 'retirement', 'performance_bonus', 'award', 'warning', 'suspension', 'reinstatement', 'sabbatical', 'other' |
| event_date | DATE | NOT NULL | Effective date of the career event |
| event_title | VARCHAR(255) | NOT NULL | Short descriptive title (e.g., "Promotion to Senior Engineer", "Annual Increment 2024") |
| event_description | TEXT | NULL | Detailed description of the event and its context |
| old_designation_id | UUID | FOREIGN KEY, NULL | Previous designation (for promotions/demotions) |
| new_designation_id | UUID | FOREIGN KEY, NULL | New designation (for promotions/demotions) |
| old_department_id | INT | FOREIGN KEY, NULL | Previous department (for transfers) |
| new_department_id | INT | FOREIGN KEY, NULL | New department (for transfers) |
| old_location | VARCHAR(100) | NULL | Previous work location (for location transfers) |
| new_location | VARCHAR(100) | NULL | New work location (for location transfers) |
| old_reporting_manager_id | VARCHAR(20) | FOREIGN KEY, NULL | Previous reporting manager |
| new_reporting_manager_id | VARCHAR(20) | FOREIGN KEY, NULL | New reporting manager |
| old_employment_type | VARCHAR(50) | NULL | Previous employment type: 'full-time', 'part-time', 'contract', 'intern' |
| new_employment_type | VARCHAR(50) | NULL | New employment type |
| old_salary_ctc | DECIMAL(12,2) | NULL | Previous annual CTC |
| new_salary_ctc | DECIMAL(12,2) | NULL | New annual CTC |
| salary_increment_amount | DECIMAL(12,2) | GENERATED | Auto-computed: new_salary_ctc - old_salary_ctc |
| salary_increment_percentage | DECIMAL(5,2) | GENERATED | Auto-computed: ((new_salary_ctc - old_salary_ctc) / old_salary_ctc) * 100 |
| old_salary_breakdown | JSONB | NULL | Previous salary components (basic, HRA, allowances, etc.) |
| new_salary_breakdown | JSONB | NULL | New salary components |
| increment_reason | VARCHAR(100) | NULL | Reason: 'Annual', 'Performance', 'Promotion', 'Market Correction', 'Retention', 'Special' |
| performance_rating | VARCHAR(50) | NULL | Associated performance rating: 'Outstanding', 'Exceeds Expectations', 'Meets Expectations', 'Needs Improvement', 'Unsatisfactory' |
| performance_review_id | UUID | FOREIGN KEY, NULL | Reference to PerformanceReview record (if applicable) |
| bonus_amount | DECIMAL(12,2) | NULL | One-time bonus amount (if applicable) |
| bonus_type | VARCHAR(50) | NULL | Type: 'Performance Bonus', 'Retention Bonus', 'Joining Bonus', 'Referral Bonus' |
| award_title | VARCHAR(255) | NULL | Award name (if event_type = 'award') |
| award_description | TEXT | NULL | Award details and achievement |
| warning_type | VARCHAR(100) | NULL | Type: 'Verbal Warning', 'Written Warning', 'Final Warning' (if event_type = 'warning') |
| warning_reason | TEXT | NULL | Reason for disciplinary action |
| suspension_start_date | DATE | NULL | Start date of suspension |
| suspension_end_date | DATE | NULL | End date of suspension |
| resignation_date | DATE | NULL | Date of resignation submission |
| last_working_date | DATE | NULL | Last working day (if event_type = 'resignation' or 'termination') |
| exit_reason | VARCHAR(100) | NULL | Reason: 'Better Opportunity', 'Relocation', 'Personal Reasons', 'Higher Studies', 'Health Issues', 'Retirement', 'Performance', 'Layoff', 'End of Contract', 'Other' |
| exit_interview_completed | BOOLEAN | NOT NULL, DEFAULT false | Whether exit interview was conducted |
| exit_interview_feedback | TEXT | NULL | Key feedback from exit interview |
| rehire_eligible | BOOLEAN | NULL | Whether employee is eligible for rehire |
| initiated_by | VARCHAR(100) | NULL | Who initiated: 'Employee', 'Manager', 'HR', 'Admin', 'System' |
| recommended_by | VARCHAR(255) | NULL | Name of person who recommended (for promotions) |
| approved_by | UUID | FOREIGN KEY, NULL | User who approved the event (users.id) |
| approval_date | DATE | NULL | Date of approval |
| approval_status | ENUM | NOT NULL, DEFAULT 'pending' | Status: 'pending', 'approved', 'rejected', 'on_hold' |
| approval_comments | TEXT | NULL | Comments from approver |
| effective_from | DATE | NULL | Effective start date (may differ from event_date) |
| effective_until | DATE | NULL | Effective end date (for temporary changes) |
| is_retroactive | BOOLEAN | NOT NULL, DEFAULT false | Whether event has retroactive effect (e.g., backdated increment) |
| retroactive_from_date | DATE | NULL | Retroactive effective date |
| arrears_amount | DECIMAL(12,2) | NULL | Arrears payable for retroactive changes |
| arrears_paid | BOOLEAN | NOT NULL, DEFAULT false | Whether arrears have been paid |
| arrears_payment_date | DATE | NULL | Date when arrears were paid |
| document_ids | UUID[] | NULL | References to supporting documents (offer letter, appraisal, approval email) |
| attachments | JSONB | NULL | Additional file attachments as JSON array |
| metadata | JSONB | NULL | Flexible field for event-specific data |
| tags | TEXT[] | NULL | Searchable tags (e.g., ['annual_review', '2024', 'high_performer']) |
| is_milestone | BOOLEAN | NOT NULL, DEFAULT false | Flag for significant career milestones (5-year completion, etc.) |
| milestone_type | VARCHAR(100) | NULL | Type: '1_year', '5_year', '10_year', '15_year', '20_year', 'first_promotion', 'first_award' |
| visibility | ENUM | NOT NULL, DEFAULT 'internal' | Visibility: 'public' (all employees), 'internal' (HR/managers), 'confidential' (admin only) |
| notification_sent | BOOLEAN | NOT NULL, DEFAULT false | Whether notification email was sent to employee |
| notification_sent_at | TIMESTAMP | NULL | When notification was sent |
| notes | TEXT | NULL | Internal notes and remarks |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |
| created_by | UUID | FOREIGN KEY, NOT NULL | User who created the record (users.id) |
| updated_by | UUID | FOREIGN KEY, NULL | User who last updated the record (users.id) |

**Business Rules**:

1. **Event Categories & Types**:
   - **Career Events**: Promotions, demotions, lateral moves, confirmations
   - **Compensation Events**: Salary increments, revisions, bonuses
   - **Transfer Events**: Department transfers, location changes, manager changes
   - **Status Events**: Resignation, termination, retirement, contract renewal
   - **Performance Events**: Awards, bonuses, warnings, suspensions
   - **Milestone Events**: Anniversary celebrations, long service awards

2. **Promotion Tracking**:
   - Record old and new designations
   - Auto-update employee's current designation upon approval
   - Calculate salary increment (amount and percentage)
   - Record new salary breakdown (basic, HRA, allowances)
   - Attach approval document (promotion letter)
   - Notify employee via email
   - Timeline: Record event_date (announcement) vs effective_from (actual change)

3. **Salary Increment Logic**:
   - Auto-compute `salary_increment_amount` = new_salary_ctc - old_salary_ctc
   - Auto-compute `salary_increment_percentage` = ((new - old) / old) * 100
   - Trigger: Update employee's current CTC in `employees` table upon approval
   - Support retroactive increments: Calculate arrears and mark for payment
   - Record increment reason: Annual cycle, performance-based, promotion, retention
   - Store old and new salary breakdowns in JSONB for complete audit trail

4. **Department & Location Transfers**:
   - Record old and new department/location
   - Update employee's current department and location upon approval
   - Optionally change reporting manager (cross-department transfers)
   - Notify old and new managers via email
   - Track transfer reason (business need, employee request, performance)

5. **Manager Changes**:
   - Record old and new reporting managers
   - Update employee's `reporting_manager_id` upon approval
   - Validate: New manager must be valid employee in target department
   - Prevent circular reporting: Employee cannot report to self or subordinate

6. **Employment Status Changes**:
   - **Confirmation**: Mark probation completion, change status to 'confirmed'
   - **Resignation**: Record resignation_date, last_working_date, exit_reason
   - **Termination**: Record termination date, reason, eligibility for rehire
   - **Retirement**: Record retirement date, mark as 'retired' in employee status
   - **Contract Renewal**: Extend contract end date for contract employees

7. **Retroactive Changes**:
   - Support backdated increments: Set `is_retroactive = true`
   - Record `retroactive_from_date` (when change should have taken effect)
   - Calculate `arrears_amount` = (new_salary - old_salary) * months_elapsed
   - Track arrears payment: `arrears_paid`, `arrears_payment_date`
   - Payroll integration: Include arrears in next salary payment

8. **Approval Workflow**:
   - Default status: 'pending' (awaiting approval)
   - Approver: Manager → HR → Admin (multi-level for promotions)
   - Upon approval: Update employee record, send notifications, generate letters
   - Rejection: Record reason in `approval_comments`, no changes to employee record
   - On-hold: Temporarily pause approval (pending additional documents/review)

9. **Performance Integration**:
   - Link career events to performance reviews via `performance_review_id`
   - Record `performance_rating` for context (promotions based on performance)
   - Track performance bonuses separately from regular increments
   - Annual increment cycle: Batch create events for all eligible employees

10. **Disciplinary Actions**:
    - Record warnings (verbal, written, final) with reasons
    - Track suspensions (start date, end date, reason)
    - Link to HR policy violations or performance issues
    - Visibility: Confidential (accessible only to HR and Admin)
    - Impact on career: Flag for consideration during promotions/increments

11. **Exit Management**:
    - Resignation: Trigger exit workflow (asset return, clearance, exit interview)
    - Record `exit_reason`, `exit_interview_completed`, `exit_interview_feedback`
    - Determine `rehire_eligible` based on exit circumstances
    - Full & Final Settlement: Link to payroll for final dues calculation
    - Offboarding: Auto-update employee status to 'exited'

12. **Milestone Tracking**:
    - Auto-detect milestones: 1-year, 5-year, 10-year work anniversaries
    - Mark first promotion, first award as milestones
    - Generate appreciation certificates/emails for milestones
    - Dashboard: Upcoming milestones widget for HR planning

13. **Document Attachments**:
    - Attach supporting documents: Offer letters, appraisal letters, approval emails
    - Store document IDs in `document_ids` array (references to `documents` table)
    - Store additional attachments as JSONB in `attachments` field
    - Required documents: Promotion letter (promotion), increment letter (increment), warning letter (warning)

14. **Notifications**:
    - Auto-send email notification to employee upon approval
    - Notify manager on status changes (confirmation, transfer, exit)
    - Notify HR on disciplinary actions
    - Track: `notification_sent`, `notification_sent_at`
    - Email templates: Customizable for each event type

15. **Visibility & Privacy**:
    - **Public**: Visible to all employees (awards, milestones)
    - **Internal**: Visible to HR, managers, and employee (promotions, increments)
    - **Confidential**: Visible only to HR and Admin (warnings, terminations)
    - Employee can always view own career history (all events)

16. **Timeline & Reporting**:
    - Employee profile: Display career timeline (chronological view)
    - Analytics: Average time to promotion, increment trends, turnover analysis
    - Reports: Promotion pipeline, pending confirmations, upcoming resignations
    - Export: Career history as PDF for employee records

17. **Data Integrity & Audit**:
    - Immutable records: Once approved, cannot be edited (only add correction entries)
    - Full audit trail: Track `created_by`, `updated_by`, timestamps
    - Audit log: All career events logged to `audit_logs` table
    - Archival: Retain career history for 10 years after employee exit

**Index Specifications**:
```sql
-- Primary lookup
CREATE INDEX idx_career_history_employee ON career_history(employee_id);

-- Event type filtering
CREATE INDEX idx_career_history_event ON career_history(employee_id, event_type, event_date DESC);

-- Pending approvals
CREATE INDEX idx_career_history_approval ON career_history(approval_status, created_at DESC) WHERE approval_status = 'pending';

-- Effective date range queries
CREATE INDEX idx_career_history_effective ON career_history(employee_id, effective_from, effective_until);

-- Milestone tracking
CREATE INDEX idx_career_history_milestones ON career_history(is_milestone, milestone_type, event_date DESC) WHERE is_milestone = true;

-- Salary changes
CREATE INDEX idx_career_history_salary ON career_history(employee_id, event_date DESC) WHERE new_salary_ctc IS NOT NULL;

-- Exit events
CREATE INDEX idx_career_history_exits ON career_history(event_type, event_date DESC) WHERE event_type IN ('resignation', 'termination', 'retirement');

-- Retroactive changes
CREATE INDEX idx_career_history_retroactive ON career_history(is_retroactive, arrears_paid) WHERE is_retroactive = true;

-- Performance linkage
CREATE INDEX idx_career_history_performance ON career_history(performance_review_id) WHERE performance_review_id IS NOT NULL;

-- Timeline view (chronological)
CREATE INDEX idx_career_history_timeline ON career_history(employee_id, event_date DESC, created_at DESC);
```

**Relationships**:
- **Employee** (1:N) - One employee has many career events
- **Designation** (old_designation_id, new_designation_id) - Track designation changes
- **Department** (old_department_id, new_department_id) - Track department changes
- **Employee** (old_reporting_manager_id, new_reporting_manager_id) - Track manager changes
- **User** (created_by, updated_by, approved_by) - Audit trail
- **PerformanceReview** (performance_review_id) - Link to performance reviews

**Access Control**:
- Employees can view own career history (all events)
- Managers can view direct reports' career history (non-confidential)
- HR can view/edit all career history (except confidential discipline actions)
- Admin can view/edit all career history (including confidential)
- Approvers can approve/reject pending events
- Audit log tracks all access and modifications

---

### 2.8 SalaryAnnexure
**Description**: Generated salary breakdown documents.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee |
| file_name | VARCHAR(255) | NOT NULL | Generated file name |
| file_data | TEXT | NOT NULL | Base64 encoded document |
| generated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Generation timestamp |
| salary_snapshot | JSON | NOT NULL | Snapshot of salary info at generation time |

**Business Rules**:
- Annexure is auto-generated based on employee salary structure
- Contains detailed breakdown of CTC components
- Stores snapshot to maintain historical accuracy

---

## 3. Organizational Structure Entities

### 3.1 Department
**Description**: Organizational departments.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | Unique identifier |
| name | ENUM/VARCHAR(100) | UNIQUE, NOT NULL | Department name: 'IT', 'HR', 'Finance', 'Sales', 'Marketing' |
| description | TEXT | NULL | Department description |
| head_employee_id | VARCHAR(20) | FOREIGN KEY, NULL | Department head reference |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active status |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- Department names are predefined: IT, HR, Finance, Sales, Marketing
- Can be extended to support custom departments
- Currently treated as an ENUM in frontend

---

### 3.2 Designation
**Description**: Job titles/positions within departments.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| title | VARCHAR(255) | NOT NULL | Designation title |
| department_id | INT | FOREIGN KEY, NOT NULL | Reference to Department |
| description | TEXT | NULL | Job description |
| reporting_to_designation_id | UUID | FOREIGN KEY, NULL | Reports to designation (hierarchy) |
| level | INT | NOT NULL | Hierarchy level (1=top, higher=lower) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- Designation defines role and reporting structure
- Level indicates hierarchy (lower number = higher position)
- Reporting structure can be designation-based or employee-based

---

## 4. Attendance and Leave Management

### 4.1 AttendanceRecord
**Description**: Monthly attendance summary for employees.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | VARCHAR(50) | PRIMARY KEY, NOT NULL | Unique identifier (format: ATT{timestamp}) |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee |
| employee_name | VARCHAR(255) | NOT NULL | Employee full name (denormalized) |
| month | VARCHAR(20) | NOT NULL | Month name: 'January', 'February', etc. |
| year | VARCHAR(4) | NOT NULL | Year: '2026', '2027', etc. |
| total_working_days | INT | NOT NULL | Total working days in month |
| present_days | INT | NOT NULL | Number of days present |
| absent_days | INT | NOT NULL | Number of days absent |
| paid_leave | INT | NOT NULL | Number of paid leave days |
| unpaid_leave | INT | NOT NULL | Number of unpaid leave days |
| payable_days | INT | NOT NULL, COMPUTED | Present days + Paid leave |
| loss_of_pay_days | INT | NOT NULL, COMPUTED | Unpaid leave + Absent days |
| remarks | TEXT | NULL | Additional remarks |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- One record per employee per month per year (composite unique constraint)
- Payable days = Present days + Paid leave (auto-calculated)
- Loss of Pay days = Unpaid leave + Absent days (auto-calculated)
- Total working days typically 26-30 depending on month
- Used for pro-rated salary calculation in payroll

**Unique Constraint**: `(employee_id, month, year)`

---

## 5. Payroll Management Entities

### 5.1 PayRun
**Description**: Monthly payroll execution records.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | VARCHAR(50) | PRIMARY KEY, NOT NULL | Unique identifier (format: PR{timestamp}) |
| month | VARCHAR(20) | NOT NULL | Month name: 'January', 'February', etc. |
| year | VARCHAR(4) | NOT NULL | Year: '2026', '2027', etc. |
| generated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Generation timestamp |
| generated_by_user_id | UUID | FOREIGN KEY, NULL | User who generated the pay run |
| status | ENUM | NOT NULL, DEFAULT 'draft' | Status: 'draft', 'approved', 'processed', 'cancelled' |
| total_employees | INT | NOT NULL | Count of employees in pay run |
| total_gross | DECIMAL(15,2) | NOT NULL | Total gross salary |
| total_deductions | DECIMAL(15,2) | NOT NULL | Total deductions |
| total_net_pay | DECIMAL(15,2) | NOT NULL | Total net pay |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

**Business Rules**:
- One pay run per month per year
- Includes all active employees
- Calculates salary based on attendance, advances, loans
- Aggregates totals for financial reporting

**Unique Constraint**: `(month, year)`

---

### 5.2 PayRunEmployeeRecord
**Description**: Individual employee payroll details within a pay run.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| pay_run_id | VARCHAR(50) | FOREIGN KEY, NOT NULL | Reference to PayRun |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee |
| employee_name | VARCHAR(255) | NOT NULL | Employee full name (denormalized) |
| basic_salary | DECIMAL(12,2) | NOT NULL | Pro-rated basic salary |
| hra | DECIMAL(12,2) | NOT NULL | Pro-rated HRA |
| conveyance | DECIMAL(12,2) | NOT NULL | Pro-rated conveyance |
| telephone | DECIMAL(12,2) | NOT NULL | Pro-rated telephone allowance |
| medical_allowance | DECIMAL(12,2) | NOT NULL | Pro-rated medical allowance |
| special_allowance | DECIMAL(12,2) | NOT NULL | Pro-rated special allowance |
| total_allowances | DECIMAL(12,2) | NOT NULL | Sum of all allowances |
| gross_salary | DECIMAL(12,2) | NOT NULL | Total gross for the month |
| total_working_days | INT | NOT NULL | Working days in month |
| payable_days | INT | NOT NULL | Days to be paid |
| loss_of_pay_days | INT | NOT NULL | LOP days |
| loss_of_pay_amount | DECIMAL(12,2) | NOT NULL | LOP deduction amount |
| advance_deduction | DECIMAL(12,2) | NOT NULL | Advance amount deducted |
| loan_deduction | DECIMAL(12,2) | NOT NULL | Loan EMI deducted |
| pf_deduction | DECIMAL(12,2) | NOT NULL | PF deduction |
| esi_deduction | DECIMAL(12,2) | NOT NULL | ESI deduction |
| professional_tax | DECIMAL(12,2) | NOT NULL | Professional tax |
| tds | DECIMAL(12,2) | NOT NULL | TDS deduction |
| total_deductions | DECIMAL(12,2) | NOT NULL | Sum of all deductions |
| net_pay | DECIMAL(12,2) | NOT NULL | Final net pay |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

**Business Rules**:
- Each record represents one employee's salary for a specific month
- Pro-rating based on attendance data
- Includes all deductions (statutory, advances, loans)
- Net pay = Gross - Total deductions
- Stores snapshot for audit and historical accuracy

---

### 5.3 Payslip
**Description**: Detailed payslip records for employees (more detailed than PayRunEmployeeRecord).

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee |
| pay_run_employee_record_id | UUID | FOREIGN KEY, NULL | Reference to PayRunEmployeeRecord |
| salary_month | VARCHAR(20) | NOT NULL | Salary month |
| salary_year | VARCHAR(4) | NOT NULL | Salary year |
| salary_date | DATE | NOT NULL | Salary payment date |
| period_start_date | DATE | NOT NULL | Period start date |
| period_end_date | DATE | NOT NULL | Period end date |
| department | VARCHAR(100) | NOT NULL | Department (denormalized) |
| designation | VARCHAR(255) | NOT NULL | Designation (denormalized) |
| grade | VARCHAR(10) | NULL | Employee grade |
| date_of_joining | DATE | NULL | Joining date (denormalized) |
| total_working_days | INT | NOT NULL | Working days |
| present_days | INT | NOT NULL | Present days |
| leaves | INT | NOT NULL | Total leaves |
| absents | INT | NOT NULL | Absents |
| paid_leaves | INT | NOT NULL | Paid leaves |
| unpaid_leaves | INT | NOT NULL | Unpaid leaves |
| overtime_hours | DECIMAL(5,2) | NULL | Overtime hours |
| basic_salary | DECIMAL(12,2) | NOT NULL | Basic component |
| hra | DECIMAL(12,2) | NOT NULL | HRA component |
| conveyance | DECIMAL(12,2) | NOT NULL | Conveyance |
| medical | DECIMAL(12,2) | NOT NULL | Medical allowance |
| special_allowance | DECIMAL(12,2) | NOT NULL | Special allowance |
| overtime_amount | DECIMAL(12,2) | NULL | Overtime pay |
| incentives | DECIMAL(12,2) | NULL | Incentives |
| bonus | DECIMAL(12,2) | NULL | Bonus |
| gross_salary | DECIMAL(12,2) | NOT NULL | Gross salary |
| lop_deduction | DECIMAL(12,2) | NOT NULL | LOP deduction |
| pf | DECIMAL(12,2) | NOT NULL | PF deduction |
| esi | DECIMAL(12,2) | NOT NULL | ESI deduction |
| professional_tax | DECIMAL(12,2) | NOT NULL | PT deduction |
| tds | DECIMAL(12,2) | NOT NULL | TDS deduction |
| advance_paid | DECIMAL(12,2) | NULL | Advance previously paid |
| advance_deduction | DECIMAL(12,2) | NOT NULL | Advance deducted this month |
| loan_deduction | DECIMAL(12,2) | NOT NULL | Loan EMI deducted |
| other_deduction | DECIMAL(12,2) | NULL | Other deductions |
| total_deductions | DECIMAL(12,2) | NOT NULL | Total deductions |
| net_pay | DECIMAL(12,2) | NOT NULL | Net salary |
| remarks | TEXT | NULL | Additional remarks |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

**Business Rules**:
- Comprehensive payslip with all earnings and deductions
- Can be generated from PayRunEmployeeRecord or standalone
- Period dates define the salary calculation period
- Used for official salary statements

**Unique Constraint**: `(employee_id, salary_month, salary_year)`

---

## 6. Advance and Loan Management

### 6.1 AdvanceRecord
**Description**: Employee salary advances and their recovery schedule.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee |
| employee_name | VARCHAR(255) | NOT NULL | Employee full name (denormalized) |
| advance_month | VARCHAR(20) | NOT NULL | Month when advance was paid |
| advance_year | VARCHAR(4) | NOT NULL | Year when advance was paid |
| advance_paid_amount | DECIMAL(12,2) | NOT NULL | Amount paid as advance |
| advance_deduction_month | VARCHAR(20) | NOT NULL | Month for deduction |
| advance_deduction_year | VARCHAR(4) | NOT NULL | Year for deduction |
| status | ENUM | NOT NULL, DEFAULT 'pending' | Status: 'pending', 'deducted', 'partial' |
| remaining_amount | DECIMAL(12,2) | NOT NULL | Remaining amount to recover |
| remarks | TEXT | NULL | Additional remarks |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- Advance is paid in one month and deducted in a future month
- Typically single deduction, but status supports partial recovery
- Status updated during pay run processing
- Remaining amount tracks partial deductions

---

### 6.2 LoanRecord
**Description**: Employee loans with EMI schedule.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee |
| employee_name | VARCHAR(255) | NOT NULL | Employee full name (denormalized) |
| loan_amount | DECIMAL(12,2) | NOT NULL | Principal loan amount |
| interest_rate | DECIMAL(5,2) | NOT NULL | Interest rate percentage |
| number_of_emis | INT | NOT NULL | Total number of EMIs |
| emi_amount | DECIMAL(12,2) | NOT NULL | Monthly EMI amount |
| total_amount | DECIMAL(12,2) | NOT NULL | Loan + Interest total |
| start_month | VARCHAR(20) | NOT NULL | EMI start month |
| start_year | VARCHAR(4) | NOT NULL | EMI start year |
| total_paid_emis | INT | NOT NULL, DEFAULT 0 | Count of paid EMIs |
| remaining_balance | DECIMAL(12,2) | NOT NULL | Outstanding balance |
| status | ENUM | NOT NULL, DEFAULT 'active' | Status: 'active', 'completed', 'cancelled' |
| remarks | TEXT | NULL | Additional remarks |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- Total amount = Loan amount + (Loan amount × Interest rate %)
- EMI amount = Total amount / Number of EMIs
- EMI deduction starts from the specified start month
- Status updated as EMIs are paid
- Remaining balance tracks outstanding amount

---

### 6.3 LoanEMI
**Description**: Individual EMI schedule entries for loans.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| loan_id | UUID | FOREIGN KEY, NOT NULL | Reference to LoanRecord |
| emi_number | INT | NOT NULL | EMI sequence number (1, 2, 3...) |
| month | VARCHAR(20) | NOT NULL | EMI month |
| year | VARCHAR(4) | NOT NULL | EMI year |
| emi_amount | DECIMAL(12,2) | NOT NULL | EMI amount for this installment |
| status | ENUM | NOT NULL, DEFAULT 'pending' | Status: 'pending', 'paid' |
| paid_date | TIMESTAMP | NULL | Date when EMI was paid |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- One EMI record per month of the loan tenure
- Generated when loan is created
- Status updated during pay run processing
- Paid date recorded when deduction is made

**Unique Constraint**: `(loan_id, emi_number)`

---

## 7. Letter and Document Generation

### 7.1 LetterTemplate
**Description**: Templates for generating offer letters, appointment letters, etc.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| template_name | VARCHAR(255) | UNIQUE, NOT NULL | Template name |
| template_type | ENUM | NOT NULL | Type: 'offer_letter', 'appointment_letter', 'relieving_letter', 'experience_letter' |
| template_content | TEXT | NOT NULL | Template content with placeholders |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Active status |
| created_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- Templates use placeholders for dynamic data (e.g., {{employee_name}})
- Currently generated programmatically in frontend
- Backend should support template storage and rendering

---

### 7.2 GeneratedLetter
**Description**: Generated letters for employees.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| employee_id | VARCHAR(20) | FOREIGN KEY, NOT NULL | Reference to Employee |
| letter_type | ENUM | NOT NULL | Type: 'offer_letter', 'appointment_letter', 'relieving_letter', 'experience_letter' |
| template_id | UUID | FOREIGN KEY, NULL | Reference to LetterTemplate |
| letter_content | TEXT | NOT NULL | Generated letter content |
| file_data | TEXT | NULL | Base64 encoded PDF or file reference |
| generated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Generation timestamp |
| generated_by_user_id | UUID | FOREIGN KEY, NULL | User who generated the letter |

**Business Rules**:
- Letters generated on-demand or during onboarding
- Store both content and rendered file
- Used for employee documentation

---

## 8. System Configuration

### 8.1 SystemSettings
**Description**: Application-wide configuration settings.

**Attributes**:
| Attribute | Data Type | Constraints | Description |
|-----------|-----------|-------------|-------------|
| id | UUID | PRIMARY KEY, NOT NULL | Unique identifier |
| setting_key | VARCHAR(100) | UNIQUE, NOT NULL | Setting key |
| setting_value | TEXT | NOT NULL | Setting value (JSON or string) |
| setting_type | ENUM | NOT NULL | Type: 'string', 'number', 'boolean', 'json' |
| description | TEXT | NULL | Setting description |
| is_editable | BOOLEAN | NOT NULL, DEFAULT true | Whether user can edit |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Record last update timestamp |

**Business Rules**:
- Stores system-wide constants (PF rates, ESI rates, PT slabs, etc.)
- Examples: PF_WAGE_CEILING_MONTHLY = 15000, PF_EMPLOYEE_RATE = 0.12
- Centralized configuration management

---

## Summary

This document has identified and defined **21 core entities** for the EcoVale HR system:

1. **User** - Authentication and access control
2. **Employee** - Core employee entity with embedded personal, employment, and salary information
3. **BankDetails** - Employee banking information
4. **Document** - Employee document storage
5. **CareerHistory** - Career progression tracking
6. **SalaryAnnexure** - Generated salary breakdown documents
7. **Department** - Organizational departments
8. **Designation** - Job titles and positions
9. **AttendanceRecord** - Monthly attendance tracking
10. **PayRun** - Payroll execution records
11. **PayRunEmployeeRecord** - Individual employee payroll within pay run
12. **Payslip** - Detailed payslip records
13. **AdvanceRecord** - Salary advance management
14. **LoanRecord** - Employee loan management
15. **LoanEMI** - Loan EMI schedule
16. **LetterTemplate** - Letter template storage
17. **GeneratedLetter** - Generated employee letters
18. **SystemSettings** - System configuration

Each entity includes:
- Complete attribute definitions with data types
- Constraints and validation rules
- Business logic and calculation rules
- Relationships to other entities

These entities form the foundation for the backend data model and will be used to design the database schema in the next document.
