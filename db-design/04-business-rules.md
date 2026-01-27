# Business Rules and Invariants - EcoVale HR System

## Overview
This document captures all business rules, domain logic, validation rules, calculation formulas, and invariants extracted from the frontend implementation. These rules must be enforced at the application or database level.

---

## 1. User Authentication and Authorization Rules

### 1.1 User Registration
**Rule**: New users can be created by admins only

**Validation**:
- Email must be unique across all users
- Email format must be valid (RFC 5322)
- Full name is required
- Role must be one of: 'admin', 'manager', 'hr', 'employee'
- Default role is 'admin' if not specified

---

### 1.2 Password Requirements
**Rule**: Strong password policy enforced

**Requirements**:
- Minimum length: 8 characters
- Must contain at least 1 uppercase letter (A-Z)
- Must contain at least 1 lowercase letter (a-z)
- Must contain at least 1 number (0-9)
- Must contain at least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

**Password Storage**:
- Never store plain text passwords
- Use bcrypt with cost factor 12 or argon2id
- Hash passwords before storing in database

**Password Change**:
- Current password must be verified before change
- New password must meet requirements
- Password history: Cannot reuse last 3 passwords

---

### 1.3 Authentication Process
**Rule**: JWT-based stateless authentication

**Login Flow**:
```
1. User submits email and password
2. System validates email format
3. System checks if account exists and is active
4. System checks if account is locked (account_locked_until)
5. System verifies password hash
6. If password correct:
   - Reset failed_login_attempts to 0
   - Update last_login timestamp
   - Update last_login_ip
   - Generate access token (expires in 1 hour)
   - Generate refresh token (expires in 7 days)
   - Create session record
   - Return tokens to client
7. If password incorrect:
   - Increment failed_login_attempts
   - If failed_login_attempts >= 5:
     - Set account_locked_until = NOW() + 30 minutes
   - Return error message
```

**JWT Payload**:
```json
{
  "sub": "user_id",
  "email": "user@ecovale.com",
  "role": "admin",
  "employee_id": "123",
  "iat": 1234567890,
  "exp": 1234571490,
  "jti": "unique_token_id"
}
```

---

### 1.4 Account Lockout
**Rule**: Protect against brute force attacks

**Implementation**:
- Maximum failed login attempts: 5
- Lock duration: 30 minutes
- Counter reset on successful login
- Manual unlock by admin if needed

**Validation**:
```
IF failed_login_attempts >= 5 AND account_locked_until > NOW():
    REJECT login with message "Account locked. Try again after {time}"
ELSE IF account_locked_until < NOW():
    RESET failed_login_attempts to 0
    CLEAR account_locked_until
```

---

### 1.5 Token Expiration and Refresh
**Rule**: Short-lived access tokens with refresh capability

**Access Token**:
- Lifetime: 1 hour (3600 seconds)
- Used for API authentication
- Cannot be revoked (stateless)
- Payload includes: user_id, email, role, employee_id, session_id, jti

**Refresh Token**:
- Lifetime: 7 days (604800 seconds)
- Stored in sessions table
- Can be revoked (logout)
- Used to obtain new access token
- Payload includes: user_id, session_id, jti

**Token Refresh Flow**:
```
1. Client submits refresh token
2. System validates refresh token signature (JWT)
3. System extracts session_id from token payload
4. System validates session:
   - Session exists in database
   - session.is_active = true
   - session.expires_at > NOW()
   - session.refresh_token_hash matches submitted token
   - User is still active
5. If valid:
   - Generate new access token (same session_id)
   - Update session.last_activity = NOW()
   - Optionally rotate refresh token:
     - Generate new refresh token
     - Update session.refresh_token
     - Invalidate old refresh token
   - Return new tokens to client
6. If invalid:
   - Log failed refresh attempt
   - Return 401 Unauthorized
   - Require user re-login
```

**Token Rotation (Recommended)**:
- Generate new refresh token on each use
- Update session record with new token
- Old refresh token becomes invalid
- Prevents replay attacks
- Detects token theft (old token reuse)

---

### 1.5a Session Management Rules
**Rule**: Comprehensive session lifecycle management

#### Session Creation (Login)
**Trigger**: Successful user login

**Process**:
```
1. Validate user credentials (email + password)
2. Check account status (is_active, account_locked_until)
3. Generate session data:
   - session_id: UUID
   - refresh_token: JWT with 7-day expiry
   - refresh_token_hash: SHA-256 hash of token
   - access_token: JWT with 1-hour expiry
4. Capture session metadata:
   - ip_address: From request headers
   - user_agent: From request headers
   - device_name: Parsed from user_agent
   - device_fingerprint: Hashed device signature
   - location: Geo-locate from IP
5. Create session record:
   - INSERT INTO sessions (...)
   - Set is_active = true
   - Set expires_at = NOW() + 7 days
6. Update user.last_login and user.last_login_ip
7. Log session creation in audit_logs
8. Return tokens to client
```

**Validation**:
- User must exist and be active
- Account must not be locked
- Previous failed login attempts reset to 0

#### Session Validation (Token Refresh)
**Trigger**: Client requests new access token

**Process**:
```
1. Extract and validate refresh token JWT:
   - Verify signature with secret key
   - Check expiry (exp claim)
   - Extract session_id from payload
2. Look up session by session_id
3. Validate session state:
   - is_active = true
   - expires_at > NOW()
   - refresh_token_hash matches
4. Validate user:
   - User exists
   - User is_active = true
5. If all valid:
   - Generate new access token
   - Update last_activity
   - Optionally rotate refresh token
   - Return new tokens
6. If validation fails:
   - Log failure reason
   - Return 401 error
   - Client must re-login
```

**Auto-Expiration**:
- Expired sessions (expires_at < NOW()) automatically invalid
- Validation function auto-revokes expired sessions
- No manual intervention needed

#### Session Activity Tracking
**Trigger**: Every authenticated API request

**Process** (async, non-blocking):
```
1. Extract session_id from access token
2. Update session.last_activity = NOW()
3. No response to client (fire-and-forget)
```

**Purpose**:
- Track active vs abandoned sessions
- Detect inactive sessions for cleanup
- Security monitoring (unusual activity patterns)

**Implementation**:
- Execute asynchronously (background job)
- Batch updates every 5 minutes for performance
- Don't block API response

#### Session Revocation (Logout)
**Trigger**: User initiates logout

**Single Device Logout**:
```
1. Extract session_id from access token
2. UPDATE sessions SET:
   - is_active = false
   - revoked_at = NOW()
   - revoked_reason = 'user_logout'
3. Log revocation in audit_logs
4. Return success (204 No Content)
```

**All Devices Logout**:
```
1. Extract user_id from access token
2. UPDATE sessions SET:
   - is_active = false
   - revoked_at = NOW()
   - revoked_reason = 'logout_all_devices'
   WHERE user_id = {user_id} AND is_active = true
3. Log mass revocation
4. Return success with count
```

**Admin Revoke Session**:
```
1. Admin specifies session_id or user_id
2. Revoke target session(s)
3. Set revoked_reason = 'admin_revoke'
4. Notify user (optional)
5. Log admin action in audit_logs
```

**Password Change Auto-Revoke**:
```
1. User changes password successfully
2. Revoke ALL user sessions except current
3. Set revoked_reason = 'password_change'
4. Force re-login on all other devices
5. Current session remains active
```

#### Session Cleanup
**Trigger**: Daily cron job (2am UTC)

**Process**:
```
DELETE FROM sessions
WHERE expires_at < NOW() - INTERVAL '30 days'
   OR (is_active = false AND revoked_at < NOW() - INTERVAL '30 days');
```

**Retention Policy**:
- Active sessions: Kept until expires_at
- Revoked sessions: Kept for 30 days (audit)
- Expired sessions: Deleted after 30 days
- Maximum session lifetime: 37 days total

**Monitoring**:
- Log cleanup count
- Alert if cleanup count exceeds threshold (10,000+)
- Track database table size

#### Multi-Device Sessions
**Rule**: Users can have multiple concurrent sessions

**Limits**:
- No hard limit by default
- Soft limit: 10 active sessions (configurable)
- Alert if user exceeds 10 sessions
- Admin can set per-user limits

**Use Cases**:
- User has multiple devices (phone, laptop, tablet)
- User has multiple browsers
- User logs in from different locations
- Development/testing environments

**Management**:
- User can view all active sessions
- User can revoke specific session
- User can revoke all other sessions
- Each session tracked independently

#### Session Security Features

**1. Device Fingerprinting**:
```
fingerprint = hash(
    user_agent + 
    screen_resolution + 
    timezone + 
    language + 
    plugins
)
```
- Detect device changes
- Flag suspicious logins
- Optional: Require re-auth on device change

**2. IP Address Tracking**:
- Store IP on session creation
- Track IP changes during session
- Alert on significant location changes
- Geo-locate IP to city/country

**3. Suspicious Activity Detection**:
- IP address change (risk +30)
- Location change (risk +20)
- Device fingerprint change (risk +40)
- Unusual login time 2am-5am (risk +10)
- Risk score ≥50: Flag as suspicious

**4. Token Reuse Detection**:
```
After token rotation:
- Old refresh token becomes invalid
- If old token used again:
  1. Detect reuse (potential theft)
  2. Revoke ALL user sessions
  3. Alert security team
  4. Notify user
  5. Require password reset
```

**5. Concurrent Session Monitoring**:
- Track session count per user
- Alert if count > 10
- Dashboard shows all active sessions
- Admin can force revoke sessions

#### Session Timeouts

**Idle Timeout (Optional)**:
- Default: 30 days of inactivity
- After 30 days: Auto-revoke session
- Set revoked_reason = 'inactivity_timeout'
- Cleanup job enforces this

**Absolute Timeout**:
- Maximum: 7 days (refresh token expiry)
- Cannot be extended beyond 7 days
- User must re-login after 7 days
- Enforced by JWT expiry claim

**Sliding Window (Not Implemented)**:
- Would extend expiry on each activity
- Not recommended for security
- Current implementation: Fixed 7-day expiry

---

### 1.5b Session API Requirements
**Rule**: API endpoints must handle sessions correctly

#### Protected Endpoints
**Requirements**:
```
1. Extract access token from Authorization header
2. Validate JWT signature and expiry
3. Extract session_id from token payload
4. Optionally verify session still active:
   - Check sessions.is_active = true
   - Check sessions.expires_at > NOW()
5. Extract user_id and role for authorization
6. Process request
7. Async update session.last_activity
```

**Performance Consideration**:
- Most endpoints don't need to query sessions table
- Trust access token if signature valid
- Session check only for sensitive operations
- Reduces database load

#### Sensitive Operations
**Require Session Validation**:
- Password change
- Email change
- User deletion
- Role change
- Export sensitive data
- Admin operations

**Process**:
```
1. Validate access token (standard)
2. Query sessions table:
   - Verify is_active = true
   - Verify not expired
3. Proceed with operation
```

**Purpose**:
- Ensure session not revoked
- Prevent use of stolen tokens
- Add extra security layer

---

### 1.6 Audit Logging Rules
**Rule**: Comprehensive audit trail for all operations

#### What Must Be Logged

**1. Authentication Events (ALL)**:
```
- LOGIN (success): user_id, session_id, IP, location, device
- LOGIN_FAILED: email_attempted, IP, reason (invalid password, account locked)
- LOGOUT: user_id, session_id, logout_type (single/all)
- PASSWORD_CHANGE: user_id, forced_by (admin/user)
- PASSWORD_RESET_REQUEST: email, IP
- PASSWORD_RESET: user_id, token_used
- ACCOUNT_LOCKED: user_id, reason, locked_until
- ACCOUNT_UNLOCKED: user_id, unlocked_by (admin/auto)
- SESSION_EXPIRED: user_id, session_id
- TOKEN_REFRESH: user_id, session_id, rotated (yes/no)
```

**2. Employee CRUD Operations (ALL)**:
```
- CREATE_EMPLOYEE: Include full employee data in metadata
- UPDATE_EMPLOYEE: Include before/after values in changes
- DELETE_EMPLOYEE: Soft delete with reason
- UPDATE_EMPLOYEE_SALARY: Always log salary changes
- UPDATE_EMPLOYEE_STATUS: active ↔ inactive transitions
- UPDATE_EMPLOYEE_DESIGNATION: Promotions/demotions
```

**3. Payroll Operations (ALL)**:
```
- GENERATE_PAYRUN: month, year, employee_count, total_amount
- APPROVE_PAYRUN: approver, payrun_id
- DELETE_PAYRUN: deleter, payrun_id, reason
- GENERATE_PAYSLIP: employee_id, month, year
- DOWNLOAD_PAYSLIP: employee_id, downloaded_by
- EXPORT_PAYROLL: month, year, format, exported_by
```

**4. Sensitive Data Access**:
```
- VIEW_SALARY: When HR/admin views employee salary
- VIEW_PERSONAL_INFO: When viewing PII (addresses, contacts)
- VIEW_DOCUMENTS: Document type, employee_id
- DOWNLOAD_DOCUMENT: Document ID, employee_id
- EXPORT_EMPLOYEE_DATA: Format, filters, record_count
- BULK_DOWNLOAD: Resource type, count
```

**5. Configuration Changes (ALL)**:
```
- UPDATE_SETTINGS: Setting name, before/after
- CREATE_DEPARTMENT: Department name
- CREATE_DESIGNATION: Title, department
- UPDATE_TAX_SETTINGS: Before/after values
- UPDATE_LETTER_TEMPLATE: Template ID, changes
```

**6. Security Events (ALL)**:
```
- SUSPICIOUS_LOGIN: Risk score, factors
- MULTIPLE_FAILED_LOGINS: Count, IP, user
- IP_CHANGE_DETECTED: Old IP, new IP, location_change
- DEVICE_CHANGE_DETECTED: Old device, new device
- UNAUTHORIZED_ACCESS_ATTEMPT: Endpoint, required_role, user_role
- ROLE_ESCALATION_ATTEMPT: User, attempted_role, current_role
```

#### Logging Implementation

**Synchronous Logging** (blocks request):
- Authentication events (login, logout)
- Security events (unauthorized access)
- Critical data modifications (salary, status)
- Configuration changes
- Reason: Ensure logged before proceeding

**Asynchronous Logging** (non-blocking):
- Read operations (view, list, get)
- Export operations (after file generated)
- Session activity updates
- Reason: Don't slow down read operations

**Logging Middleware** (Express/FastAPI):
```javascript
async function auditMiddleware(req, res, next) {
    const startTime = Date.now();
    
    // Capture request details
    const logData = {
        user_id: req.user?.id,
        session_id: req.user?.session_id,
        method: req.method,
        endpoint: req.path,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
    };
    
    // Wait for response
    res.on('finish', async () => {
        logData.status_code = res.statusCode;
        logData.duration_ms = Date.now() - startTime;
        logData.status = res.statusCode < 400 ? 'success' : 'failure';
        
        // Log asynchronously (don't await)
        logAudit(logData);
    });
    
    next();
}
```

#### Change Tracking Format

**Salary Change Example**:
```json
{
  "action": "UPDATE_EMPLOYEE_SALARY",
  "resource_type": "EMPLOYEE",
  "resource_id": "123",
  "resource_name": "John Doe",
  "changes": {
    "before": {
      "ctc": 1200000,
      "basic": 50000,
      "gross": 100000,
      "net": 85000
    },
    "after": {
      "ctc": 1500000,
      "basic": 62500,
      "gross": 125000,
      "net": 106250
    },
    "fields_changed": ["ctc", "basic", "gross", "net"],
    "change_summary": "Salary increased by ₹300,000 (25%)"
  }
}
```

**Status Change Example**:
```json
{
  "action": "UPDATE_EMPLOYEE_STATUS",
  "resource_type": "EMPLOYEE",
  "resource_id": "123",
  "resource_name": "John Doe",
  "changes": {
    "before": {"status": "active"},
    "after": {"status": "inactive"},
    "fields_changed": ["status"],
    "change_summary": "Employee marked as inactive",
    "reason": "Resignation effective 2026-01-31"
  }
}
```

#### Retention & Archival

**Active Storage (PostgreSQL)**:
- Last 12 months
- Full query capability
- All indexes available
- Fast access

**Partition Management**:
```sql
-- Monthly partitions auto-created
-- Partition naming: audit_logs_YYYY_MM
-- Current month + next 12 months always available
```

**Archive Process (After 12 months)**:
```
1. Export partition to CSV/Parquet
2. Compress and store in S3/Glacier
3. Detach partition from main table
4. Keep partition table for 1 year (warm storage)
5. Drop partition after 13 months (data in S3)
6. Compliance: Keep S3 archives for 7 years
```

**Restoration**:
```
1. Locate archive by date range
2. Download from S3
3. Load into temporary table
4. Query as needed
5. Time to restore: Minutes to hours
```

#### Security & Privacy

**Sensitive Field Handling**:
```
Never log:
- Passwords (plain or hashed)
- Credit card numbers
- API keys
- Private tokens
- Full SSN/Aadhar numbers

Log with masking:
- Email: jo**@example.com
- Phone: ***-***-1234
- Salary: Log but access-controlled
- PII: Encrypted in JSONB
```

**Access Control**:
```
Admin: Full access (all logs)
HR: Employee-related logs only
Manager: Team member logs only
Employee: Own logs only
Auditor: Read-only access to all
```

**Encryption**:
```
- Database encryption at rest (transparent)
- TLS 1.3 for transmission
- Sensitive changes JSONB encrypted
- Archive files encrypted in S3
```

#### Monitoring & Alerting

**Real-time Alerts**:
```
1. Multiple failed logins (5 within 15 min)
   → Alert: Security team
   → Action: Review IP, lock account

2. Unauthorized access attempt
   → Alert: Security team + Admin
   → Action: Review user permissions

3. Critical error rate > 5%
   → Alert: On-call engineer
   → Action: Check system health

4. Bulk data export
   → Alert: Data protection officer
   → Action: Verify authorization

5. Configuration change
   → Alert: Admin
   → Action: Review change
```

**Daily Reports**:
- Failed operations summary
- User activity statistics
- Security events count
- System performance metrics
- Top active users

**Weekly Reports**:
- Compliance audit summary
- Data modification history
- Access pattern analysis
- Anomaly detection results

#### Compliance Requirements

**SOC 2 Type II**:
- ✅ All access logged with user ID and timestamp
- ✅ Changes tracked with before/after values
- ✅ Failed access attempts logged
- ✅ Administrative actions logged
- ✅ Logs are immutable (cannot be modified)
- ✅ Retention: 7 years minimum

**ISO 27001**:
- ✅ Security events logged
- ✅ User accountability established
- ✅ Non-repudiation through audit trail
- ✅ Regular log review process
- ✅ Incident response supported

**GDPR Article 30**:
- ✅ Processing activities logged
- ✅ Data access logged (who accessed what when)
- ✅ Data modifications logged
- ✅ Data exports logged
- ✅ Retention period enforced (7 years then delete)
- ✅ Data subject can request own logs

**Financial Audit (SOX)**:
- ✅ Payroll changes logged
- ✅ Salary modifications logged
- ✅ Financial calculations auditable
- ✅ Approval workflows logged
- ✅ 7-year retention

#### Query Performance Optimization

**Partitioning Benefits**:
```
-- Query only current month (fast)
SELECT * FROM audit_logs
WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01'
AND user_id = 'uuid';

-- PostgreSQL uses only audit_logs_2026_01 partition
-- Other partitions not scanned
-- Result: 10-100x faster than full table scan
```

**Index Strategy**:
```
-- User activity: Use idx_audit_logs_user_timeline
SELECT * FROM audit_logs
WHERE user_id = 'uuid'
ORDER BY created_at DESC LIMIT 100;

-- Resource history: Use idx_audit_logs_resource_history  
SELECT * FROM audit_logs
WHERE resource_type = 'EMPLOYEE' AND resource_id = '123'
ORDER BY created_at DESC;

-- Failures: Use idx_audit_logs_failures
SELECT * FROM audit_logs
WHERE status = 'failure'
ORDER BY created_at DESC;
```

**JSONB Search**:
```sql
-- Find salary changes over $100k
SELECT * FROM audit_logs
WHERE changes->>'before'->>'ctc' IS NOT NULL
  AND (changes->'after'->>'ctc')::DECIMAL - (changes->'before'->>'ctc')::DECIMAL > 100000;

-- Uses idx_audit_logs_changes (GIN index)
```

---

**Refresh Token**:
- Lifetime: 7 days (604800 seconds)
- Stored in sessions table
- Can be revoked (logout)
- Used to obtain new access token

**Token Refresh Flow**:
```
1. Client submits refresh token
2. System validates refresh token signature
3. System checks if token exists in sessions table
4. System checks if session is active
5. System checks if token has not expired
6. If valid:
   - Generate new access token
   - Optionally rotate refresh token
   - Update session last_activity
   - Return new tokens
7. If invalid:
   - Delete session
   - Return error requiring re-login
```

---

### 1.6 Password Reset
**Rule**: Secure password reset via email token

**Reset Flow**:
```
1. User requests password reset with email
2. System checks if user exists
3. System generates random token (UUID v4 or crypto.randomBytes)
4. System stores token in password_reset_token
5. System sets password_reset_expires = NOW() + 1 hour
6. System sends email with reset link
7. User clicks link and submits new password
8. System validates token and expiry
9. System hashes new password
10. System clears password_reset_token and password_reset_expires
11. System invalidates all active sessions (force re-login)
```

**Validation**:
- Reset token valid for 1 hour only
- Token can be used only once
- After password reset, all sessions invalidated

---

### 1.7 Logout
**Rule**: Secure session termination

**Logout Single Device**:
```
1. Client submits logout request with access token
2. System extracts session ID from token
3. System sets session.is_active = false
4. System returns success
```

**Logout All Devices**:
```
1. User requests logout from all devices
2. System marks all sessions for user as inactive
3. System returns success
```

---

### 1.8 Session Management
**Rule**: Track and manage user sessions

**Validation**:
- User can have multiple active sessions (multi-device login)
- Each session has unique refresh token
- Sessions expired after 7 days of inactivity
- Periodic cleanup job removes expired sessions

**Session Cleanup**:
```sql
DELETE FROM sessions
WHERE expires_at < NOW() - INTERVAL '7 days'
   OR (is_active = false AND created_at < NOW() - INTERVAL '30 days');
```

---

### 1.9 Role-Based Access Control (RBAC)
**Rule**: Users have roles that determine permissions

**Roles and Permissions**:

| Role | Permissions |
|------|-------------|
| **admin** | Full system access: manage users, employees, payroll, settings, reports |
| **hr** | Employee management, payroll processing, attendance, advances, loans, letters |
| **manager** | View team data, approve advances/loans, view reports for team |
| **employee** | View own data, request leaves, view payslips, self-service portal |

**Permission Checks**:
- Middleware validates user role before allowing access to endpoints
- Endpoints specify required roles in authorization decorator/middleware
- Employee role can only access own data (user.employee_id === resource.employee_id)

---

### 1.10 Audit Logging
**Rule**: All sensitive operations must be logged

**Logged Actions**:
- Login success/failure
- Logout
- Password reset request
- Password change
- User creation/update/deletion
- Employee creation/update/deletion
- Salary changes
- Pay run generation
- Advance/loan approval
- Settings changes

**Log Format**:
```json
{
  "user_id": "uuid",
  "action": "UPDATE_EMPLOYEE_SALARY",
  "resource_type": "EMPLOYEE",
  "resource_id": "123",
  "ip_address": "192.168.1.100",
  "changes": {
    "before": {"ctc": 1200000},
    "after": {"ctc": 1500000}
  },
  "status": "success",
  "created_at": "2026-01-20T10:30:00Z"
}
```

**Retention**:
- Audit logs retained for minimum 7 years
- Logs are append-only (cannot be modified/deleted)

---

## 2. Employee Management Rules

### 1.1 Employee ID Generation
**Rule**: Employee IDs are sequential numeric strings (1, 2, 3, ...)

**Implementation**:
```
- New employee ID = MAX(existing employee IDs) + 1
- Format: Plain integer as string (no prefixes like "EMP")
- Start from 1 for the first employee
```

**Validation**:
- ID must be unique
- ID must be numeric
- Cannot be manually set by user

---

### 2.2 Official Email Generation
**Rule**: Official email is auto-generated based on employee name

**Formula**:
```
official_email = {first_name}.{last_name}@ecovale.com
```

**Example**:
```
First Name: Alice
Last Name: Johnson
Official Email: alice.johnson@ecovale.com
```

**Edge Cases**:
- Convert to lowercase
- Remove spaces and special characters from names
- Handle duplicates with numeric suffix (alice.johnson2@ecovale.com)
- Middle name is ignored in email generation

**Validation**:
- Email must be unique across all employees
- Must follow valid email format

---

### 2.2a Employee Personal Information Management
**Rule**: Validate and manage employee personal details for identity, communication, and compliance

#### 2.2a.1 Name Validation & Formatting
**Rule**: Ensure proper name format and validation

**Validation Rules**:
- First name and last name are mandatory (minimum 2 characters each)
- Allow only alphabets, spaces, hyphens, apostrophes (e.g., "O'Brien", "Mary-Jane", "Kumar")
- Maximum length: first_name (100 chars), last_name (100 chars), middle_name (100 chars)
- Auto-trim leading/trailing spaces
- Auto-capitalize first letter of each word (title case)

**Full Name Generation**:
```javascript
full_name = first_name + (middle_name ? ' ' + middle_name : '') + ' ' + last_name
// Example: "John Michael Smith" or "John Smith" (if no middle name)
```

**Display Name**:
- Optional preferred name for internal use (e.g., "Johnny" instead of "John")
- Used in email signatures, chat systems, informal communications
- Legal name (first + last) used for official documents

**Edge Cases**:
- Single-word names: Store in first_name, use placeholder for last_name if system requires
- Hyphenated names: Preserve hyphens (e.g., "Mary-Jane" or "Garcia-Lopez")
- Apostrophes: Preserve for Irish/Italian names (e.g., "O'Brien", "D'Angelo")
- Multiple spaces: Replace with single space

---

#### 2.2a.2 Date of Birth & Age Validation
**Rule**: Validate employee age for legal compliance

**Age Requirements**:
- Minimum age: 18 years on join_date (legal working age in India)
- Maximum age: Typically 60 years (standard retirement age)
- Extended retirement: Up to 65 years with board approval

**Validation Formula**:
```sql
age = EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))
age_on_joining = EXTRACT(YEAR FROM AGE(join_date, date_of_birth))

-- Validate
IF age_on_joining < 18 THEN
  RAISE EXCEPTION 'Employee must be at least 18 years old on joining date'
END IF
```

**Use Cases**:
- **Birthday Reminders**: Send automatic birthday wishes on date_of_birth
- **Retirement Planning**: Flag employees approaching retirement age (60 years)
- **Age-based Benefits**: Medical insurance premiums vary by age brackets
- **Minor Employment**: Reject if age < 18 (child labor laws)

**Query Example**:
```sql
-- Find employees with birthdays this month
SELECT * FROM employees
WHERE EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND status = 'active'
ORDER BY EXTRACT(DAY FROM date_of_birth);

-- Find employees approaching retirement (age >= 58)
SELECT * FROM employees
WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 58
  AND status = 'active';
```

---

#### 2.2a.3 Gender & Diversity Tracking
**Rule**: Support inclusive gender options and diversity reporting

**Gender Options**:
- 'Male'
- 'Female'
- 'Other'
- 'Prefer not to say'

**Diversity Fields** (Optional for reporting):
- Marital status: 'Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'
- Religion: Free text (e.g., 'Hindu', 'Muslim', 'Christian', 'Sikh', 'Other')
- Caste category (India): 'General', 'OBC', 'SC', 'ST' (for affirmative action reporting)
- Nationality: Free text (e.g., 'Indian', 'American')

**Privacy & Compliance**:
- All diversity fields are optional (employees can choose not to provide)
- Store in encrypted form if required by data privacy regulations
- Use only for anonymous aggregated reporting (diversity metrics)
- Never use for hiring decisions (anti-discrimination laws)
- Access restricted to HR Analytics team

**Reporting Example**:
```sql
-- Gender distribution (anonymous aggregate)
SELECT gender, COUNT(*) as count, 
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM employees
WHERE status = 'active'
GROUP BY gender;

-- Diversity report (no individual identification)
SELECT caste_category, COUNT(*) as employee_count
FROM employees
WHERE status = 'active' AND caste_category IS NOT NULL
GROUP BY caste_category;
```

---

#### 2.2a.4 Contact Number Validation
**Rule**: Ensure valid phone numbers for communication

**Primary Contact Number**:
- **Mandatory**: Required for SMS notifications, OTP, emergency calls
- **Format**: +91-XXXXXXXXXX (Indian mobile format) or E.164 international format
- **Validation**: Must be exactly 10 digits after country code
- **Type**: Mobile preferred (for SMS/WhatsApp notifications)

**Validation Logic**:
```javascript
function validatePhoneNumber(phone) {
  // Remove spaces, hyphens, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Indian mobile: +91-XXXXXXXXXX or 0XXXXXXXXXX
  const indianMobileRegex = /^(\+91|91|0)?[6-9]\d{9}$/;
  
  // International: E.164 format
  const internationalRegex = /^\+[1-9]\d{1,14}$/;
  
  if (!indianMobileRegex.test(cleaned) && !internationalRegex.test(cleaned)) {
    throw new Error('Invalid phone number format');
  }
  
  return cleaned;
}
```

**Alternate Contact**:
- Optional secondary number (landline or mobile)
- Used as fallback if primary number is unreachable
- Format validation same as primary contact

**Emergency Contact**:
- Capture emergency contact person's name, relationship, phone number
- **Mandatory recommendation**: At least one emergency contact
- Displayed on employee ID cards
- Used for critical incident notifications (accidents, medical emergencies)
- Relationship options: 'Spouse', 'Parent', 'Sibling', 'Friend', 'Other'

**Use Cases**:
- Send payslip SMS notifications
- OTP for self-service portal login
- Emergency alerts (fire drill, security incident)
- Attendance reminder SMS

---

#### 2.2a.5 Email Validation
**Rule**: Validate personal email for post-exit communication

**Personal Email**:
- **Mandatory**: Required for communication after employee exit
- **Unique**: Cannot be duplicate across all employees (current and past)
- **Format**: RFC 5322 compliant email address
- **Restriction**: Cannot be same as official_email
- **Use Cases**:
  - Password reset if official email is deactivated
  - Send final settlement details after exit
  - Alumni network communication
  - Rehire invitations

**Validation Logic**:
```javascript
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  
  // Check against official email
  if (email === official_email) {
    throw new Error('Personal email cannot be same as official email');
  }
  
  // Check uniqueness
  if (employeeRepository.existsByPersonalEmail(email)) {
    throw new Error('Personal email already registered');
  }
}
```

---

#### 2.2a.6 Address Management
**Rule**: Maintain permanent and current addresses with validation

**Permanent Address** (Home/Native Address):
- Used for official correspondence
- Fields: line1, line2, city, state, pincode, country
- Optional but highly recommended

**Current Address** (Residential Address):
- **Mandatory**: Where employee currently resides
- Used for location-based benefits (HRA calculation varies by city)
- Used for local compliance (professional tax varies by state)
- Fields: line1, line2, city, state, pincode, country

**Same as Permanent Flag**:
- If `same_as_permanent = true`, auto-copy permanent address to current address
- Reduces data entry effort
- Trigger updates current address whenever permanent address is modified

**Address Validation**:
```javascript
function validateAddress(address) {
  // Current address validation (mandatory)
  if (!address.current_line1) throw new Error('Current address line 1 is required');
  if (!address.current_city) throw new Error('Current city is required');
  if (!address.current_state) throw new Error('Current state is required');
  if (!address.current_pincode) throw new Error('Current pincode is required');
  if (!address.current_country) throw new Error('Current country is required');
  
  // Pincode validation (India)
  if (address.current_country === 'India') {
    if (!/^\d{6}$/.test(address.current_pincode)) {
      throw new Error('Invalid Indian pincode (must be 6 digits)');
    }
  }
  
  // Auto-capitalize city and state
  address.current_city = titleCase(address.current_city);
  address.current_state = titleCase(address.current_state);
  
  // Same as permanent logic
  if (address.same_as_permanent) {
    address.current_line1 = address.permanent_line1;
    address.current_line2 = address.permanent_line2;
    address.current_city = address.permanent_city;
    address.current_state = address.permanent_state;
    address.current_pincode = address.permanent_pincode;
    address.current_country = address.permanent_country;
  }
}
```

**Full Address Generation**:
```sql
-- Auto-generate full address for display
current_address = CONCAT_WS(', ',
  NULLIF(current_address_line1, ''),
  NULLIF(current_address_line2, ''),
  NULLIF(current_city, ''),
  NULLIF(current_state, ''),
  NULLIF(current_pincode, ''),
  NULLIF(current_country, '')
)

-- Example: "123 Main Street, Apartment 4B, Bangalore, Karnataka, 560001, India"
```

---

#### 2.2a.7 Statutory Number Validation
**Rule**: Validate PF, ESI, PAN, Aadhar numbers for compliance

##### PF (Provident Fund) Number
- **Format**: UAN (Universal Account Number) - 12 digits
- **Applicability**: Mandatory for employees with basic salary > ₹15,000
- **Uniqueness**: Must be unique across all employees
- **Validation**: Must be exactly 12 numeric digits

```javascript
function validatePfNumber(pfNumber) {
  if (!/^\d{12}$/.test(pfNumber)) {
    throw new Error('PF UAN must be exactly 12 digits');
  }
  
  if (employeeRepository.existsByPfNumber(pfNumber)) {
    throw new Error('PF number already exists for another employee');
  }
}
```

##### ESI (Employee State Insurance) Number
- **Format**: 17 digits (10 for IP number + 7 for family code)
- **Applicability**: Mandatory for employees with gross salary < ₹21,000/month
- **Auto-compute eligibility**: `esi_eligible = (gross < 21000)`
- **Validation**: Must be exactly 17 numeric digits

```javascript
function validateEsiNumber(esiNumber, grossSalary) {
  if (!/^\d{17}$/.test(esiNumber)) {
    throw new Error('ESI number must be exactly 17 digits');
  }
  
  if (grossSalary >= 21000) {
    throw new Warning('Employee not eligible for ESI (gross >= ₹21,000)');
  }
  
  if (employeeRepository.existsByEsiNumber(esiNumber)) {
    throw new Error('ESI number already exists for another employee');
  }
}
```

##### PAN (Permanent Account Number)
- **Format**: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
- **Applicability**: Mandatory for TDS deduction (if salary > taxable limit ₹2.5 lakh)
- **Validation**: Strict format check, uppercase only
- **Fourth character**: Must be 'P' for individuals

```javascript
function validatePan(pan) {
  // Convert to uppercase
  pan = pan.toUpperCase();
  
  // Format validation: ABCDE1234F
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panRegex.test(pan)) {
    throw new Error('Invalid PAN format. Expected: ABCDE1234F');
  }
  
  // Fourth character should be 'P' for individual
  if (pan.charAt(3) !== 'P') {
    throw new Warning('Fourth character should be P for individual taxpayer');
  }
  
  // Check uniqueness
  if (employeeRepository.existsByPanNumber(pan)) {
    throw new Error('PAN already exists for another employee');
  }
  
  return pan;
}
```

##### Aadhar (Unique Identity Number)
- **Format**: 12 digits
- **Storage**: Encrypt at rest using AES-256 encryption
- **Display**: Masked version only - 'XXXX-XXXX-1234' (show last 4 digits)
- **Applicability**: Not mandatory but recommended for identity verification
- **Privacy**: Never display full Aadhar in UI, logs, or reports

```javascript
function validateAadhar(aadhar) {
  if (!/^\d{12}$/.test(aadhar)) {
    throw new Error('Aadhar must be exactly 12 digits');
  }
  
  // Encrypt before storage
  const encrypted = encrypt(aadhar, AES_256_KEY);
  
  // Generate masked version for display
  const masked = 'XXXX-XXXX-' + aadhar.slice(-4);
  
  return { encrypted, masked };
}

// Never log or display full Aadhar
console.log('Aadhar updated:', masked); // ✓ Correct
console.log('Aadhar updated:', aadhar); // ✗ Privacy violation
```

**Statutory Number Lookup**:
```sql
-- Find employee by PF number (for PF remittance)
SELECT employee_id, full_name, pf_number, basic
FROM employees
WHERE pf_number = 'PF-NUMBER-HERE' AND status = 'active';

-- Find employees eligible for ESI
SELECT employee_id, full_name, gross, esi_number
FROM employees
WHERE gross < 21000 AND include_esi = true AND status = 'active';

-- Find employees without PAN (for TDS compliance)
SELECT employee_id, full_name, ctc
FROM employees
WHERE pan_number IS NULL AND ctc > 250000 AND status = 'active';
```

---

#### 2.2a.8 Blood Group & Medical Information
**Rule**: Capture blood group for emergency medical response

**Blood Group Values**:
- 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
- Optional but highly recommended

**Use Cases**:
- Emergency medical response (accidents, health emergencies)
- Display on employee ID cards
- Organize blood donation camps
- Match donors with recipients within organization

**Validation**:
```javascript
function validateBloodGroup(bloodGroup) {
  const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  if (bloodGroup && !validGroups.includes(bloodGroup)) {
    throw new Error('Invalid blood group. Must be one of: ' + validGroups.join(', '));
  }
}
```

---

#### 2.2a.9 Physical Disability & Accessibility
**Rule**: Support employees with disabilities through reasonable accommodation

**Fields**:
- `physically_challenged`: Boolean flag (default: false)
- `disability_details`: Text field describing the disability (if applicable)

**Use Cases**:
- Reasonable accommodation planning (wheelchair access, special equipment)
- Reserved parking spots for employees with mobility challenges
- Adaptive technology provision (screen readers, ergonomic keyboards)
- Diversity reporting (percentage of employees with disabilities)

**Privacy**:
- Disability details visible only to HR and Admin
- Anonymous aggregation for diversity metrics
- Ensure confidentiality and non-discrimination

---

#### 2.2a.10 Photo Management
**Rule**: Store and manage employee photos for identification

**Photo Requirements**:
- **Format**: JPG, JPEG, PNG only
- **Size**: Passport-size (recommended 200x200 pixels)
- **Max file size**: 500 KB
- **Storage**: Base64 encoding or cloud storage URL

**Thumbnail Generation**:
- Auto-generate 100x100 pixel thumbnail for quick loading
- Use thumbnail in employee list views
- Load full-resolution photo only when viewing profile

**Use Cases**:
- Employee ID cards
- Internal directory
- Attendance systems (facial recognition)
- Video conferencing profiles

**Validation**:
```javascript
function validatePhoto(photoBase64) {
  // Check file size (max 500 KB)
  const sizeInBytes = (photoBase64.length * 3) / 4;
  if (sizeInBytes > 512000) {
    throw new Error('Photo size exceeds 500 KB limit');
  }
  
  // Check MIME type
  const mimeType = photoBase64.substring(5, photoBase64.indexOf(';'));
  if (!['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType)) {
    throw new Error('Photo must be JPG, JPEG, or PNG format');
  }
  
  // Generate thumbnail
  const thumbnail = generateThumbnail(photoBase64, 100, 100);
  
  return { photo: photoBase64, thumbnail };
}
```

---

#### 2.2a.11 Family Details & Dependents
**Rule**: Capture family information for tax and insurance purposes

**Fields**:
- `father_name`: Father's full name (as per documents)
- `mother_name`: Mother's full name (as per documents)
- `spouse_name`: Spouse's full name (if married)
- `number_of_children`: Count of dependent children

**Use Cases**:
- **Tax Declarations**: Dependent declarations for income tax (Section 80C, 80D)
- **Health Insurance**: Family floater coverage (spouse + children)
- **Leave Management**: Paternity/maternity leave eligibility
- **Emergency Contact**: Family members as default emergency contacts

**Validation**:
```javascript
function validateFamilyDetails(data) {
  // If married, spouse name is recommended
  if (data.marital_status === 'Married' && !data.spouse_name) {
    flagForReview('Spouse name not provided for married employee');
  }
  
  // Number of children validation
  if (data.number_of_children < 0 || data.number_of_children > 20) {
    throw new Error('Invalid number of children');
  }
}
```

---

#### 2.2a.12 Previous Employment & Experience
**Rule**: Track prior work experience for role assignment and compensation

**Fields**:
- `previous_employer_name`: Name of last employer
- `previous_employer_designation`: Role/designation at previous company
- `previous_employer_experience_years`: Years worked at previous employer
- `total_experience_years`: Total professional experience (sum of all previous roles)

**Use Cases**:
- **Experience-based Compensation**: Higher CTC for experienced candidates
- **Probation Period**: Shorter probation for experienced employees (3 months vs 6 months)
- **Role Assignment**: Assign senior roles based on total experience
- **Background Verification**: Verify through experience letters

**Validation**:
```javascript
function validateExperience(data) {
  // Total experience should be sum of all previous experiences
  if (data.total_experience_years < data.previous_employer_experience_years) {
    throw new Error('Total experience cannot be less than previous employer experience');
  }
  
  // Experience cannot exceed age - 18 years (earliest working age)
  const maxPossibleExperience = data.age - 18;
  if (data.total_experience_years > maxPossibleExperience) {
    throw new Error(`Total experience (${data.total_experience_years} years) exceeds maximum possible (${maxPossibleExperience} years)`);
  }
}
```

---

#### 2.2a.13 Educational Qualifications
**Rule**: Verify education for role eligibility and career planning

**Fields**:
- `highest_qualification`: 'High School', '12th', 'Diploma', 'Bachelor', 'Master', 'PhD'
- `highest_qualification_stream`: Stream/specialization (e.g., 'Computer Science', 'MBA-Finance')
- `university_institute`: Name of university/college
- `year_of_passing`: Year of graduation
- `percentage_cgpa`: Academic performance (percentage or CGPA)

**Use Cases**:
- **Role Eligibility**: Minimum qualification requirements (e.g., Bachelor's degree for Software Engineer)
- **Career Progression**: Educational background for promotions and role changes
- **Training Needs**: Identify skill gaps and training requirements
- **Campus Hiring**: Track university-wise recruitment success

**Validation**:
```javascript
function validateEducation(data) {
  // Year of passing validation
  const currentYear = new Date().getFullYear();
  if (data.year_of_passing > currentYear) {
    throw new Error('Year of passing cannot be in the future');
  }
  
  // Year should align with age
  const expectedYear = currentYear - data.age + 22; // Assuming graduation at 22
  if (Math.abs(data.year_of_passing - expectedYear) > 10) {
    flagForReview('Year of passing seems unusual for employee age');
  }
  
  // Verify against uploaded degree certificates
  if (!hasDocument(data.employee_id, 'Degree Certificate')) {
    flagForReview('Degree certificate not uploaded for verification');
  }
}
```

---

#### 2.2a.14 Data Privacy & Security
**Rule**: Protect sensitive personal information with encryption and access control

**Sensitive Fields** (Encrypt at rest):
- Aadhar number (12 digits)
- Bank account number
- Passport number
- Driving license number

**Masked Display**:
- Aadhar: 'XXXX-XXXX-1234' (show last 4 digits)
- PAN: 'XXXXX1234F' (show last 5 characters)
- Bank account: 'XXXX-XXXX-1234' (show last 4 digits)

**Access Control**:
| Role | Access Level |
|------|--------------|
| Employee | View own data (sensitive fields masked) |
| Manager | View direct reports' basic contact info only |
| HR | View/edit all employees' full personal information |
| Admin | Full access to all fields including encrypted data |
| Finance | View bank details and statutory numbers (for payroll) |

**Audit Logging**:
- Log all access to sensitive fields (Aadhar, PAN, bank details)
- Track who viewed/edited personal information
- Generate audit reports for compliance reviews

**GDPR/Data Privacy Compliance**:
- Allow employees to request data export (portable format)
- Allow employees to request data deletion (with legal review)
- Retain employee data for 7 years after exit (Indian labor laws)
- Obtain consent before collecting optional diversity data

---

#### 2.2a.15 Onboarding Checklist
**Rule**: Define mandatory vs optional fields for employee onboarding

**Mandatory Fields** (Cannot create employee without):
- first_name
- last_name
- date_of_birth (age validation)
- gender
- contact_number
- personal_email
- current_address (all fields: line1, city, state, pincode, country)

**Highly Recommended Fields**:
- emergency_contact_name, emergency_contact_number
- blood_group
- father_name, mother_name
- photo

**Statutory Fields** (Conditional):
- PF number: Mandatory if basic salary > ₹15,000
- ESI number: Mandatory if gross salary < ₹21,000
- PAN: Mandatory if CTC > ₹2.5 lakh (for TDS)

**Optional Fields**:
- middle_name
- alternate_contact
- permanent_address
- previous employment details
- educational qualifications
- diversity fields (religion, caste, nationality)

**Onboarding Status**:
```javascript
function calculateOnboardingStatus(employee) {
  const mandatoryFields = ['first_name', 'last_name', 'date_of_birth', 'gender', 
                           'contact_number', 'personal_email', 'current_address'];
  const missingFields = mandatoryFields.filter(field => !employee[field]);
  
  if (missingFields.length > 0) {
    return { status: 'Incomplete', missing: missingFields };
  }
  
  // Check statutory numbers
  if (employee.basic > 15000 && !employee.pf_number) {
    return { status: 'Pending', message: 'PF number required' };
  }
  
  if (employee.gross < 21000 && !employee.esi_number) {
    return { status: 'Pending', message: 'ESI number required' };
  }
  
  if (employee.ctc > 250000 && !employee.pan_number) {
    return { status: 'Pending', message: 'PAN required for TDS' };
  }
  
  return { status: 'Complete' };
}
```

---

### 2.3 Employee Employment Details Management
**Rule**: Validate and manage employment-specific information including role, reporting, location, and contractual terms

#### 2.3.1 Employee ID Generation
**Rule**: Auto-generate unique employee ID for each new hire

**Format**: `EMP-{YEAR}-{SEQUENTIAL_NUMBER}`

**Examples**:
- EMP-2026-0001 (first employee in 2026)
- EMP-2026-0002 (second employee in 2026)
- EMP-2027-0001 (first employee in 2027, sequence resets)

**Generation Logic**:
```javascript
function generateEmployeeId() {
  const year = new Date().getFullYear();
  
  // Get the last employee ID for current year
  const lastEmployee = await db.query(`
    SELECT employee_id 
    FROM employees 
    WHERE employee_id LIKE 'EMP-${year}-%'
    ORDER BY employee_id DESC 
    LIMIT 1
  `);
  
  let sequenceNumber = 1;
  if (lastEmployee) {
    // Extract sequence number from last ID (EMP-2026-0001 → 0001)
    const lastSequence = parseInt(lastEmployee.employee_id.split('-')[2]);
    sequenceNumber = lastSequence + 1;
  }
  
  // Pad with zeros (4 digits)
  const paddedSequence = String(sequenceNumber).padStart(4, '0');
  
  return `EMP-${year}-${paddedSequence}`;
}

// Example output: EMP-2026-0001, EMP-2026-0002, ...
```

**Business Rules**:
- Auto-generated on employee creation (cannot be manually set)
- Unique across all employees (enforced by PRIMARY KEY constraint)
- Never reused even after employee exits
- Sequential number resets each calendar year
- Used as primary reference across all HR systems

---

#### 2.3.2 Employment Type & Contract Management
**Rule**: Define employment relationship and contract terms

**Employment Types**:
- **full-time**: Regular full-time employment (40 hrs/week), all benefits included
- **part-time**: Reduced hours (< 40 hrs/week), pro-rated benefits
- **contract**: Fixed-term contract with defined start and end dates
- **intern**: Temporary internship (typically 3-6 months), limited benefits
- **consultant**: External consultant on retainer or project basis

**Employment Category**:
- **Permanent**: Indefinite term employment
- **Temporary**: Short-term employment (covering leaves, projects)
- **Fixed-Term Contract**: Specific end date
- **Probation**: Initial probationary period before confirmation

**Contract Management** (for contract/consultant employees):
```javascript
function validateContract(employee) {
  if (['contract', 'consultant'].includes(employee.employment_type)) {
    // Contract dates are mandatory
    if (!employee.contract_start_date) {
      throw new Error('Contract start date is required for contract employees');
    }
    if (!employee.contract_end_date) {
      throw new Error('Contract end date is required for contract employees');
    }
    
    // End date must be after start date
    if (employee.contract_end_date <= employee.contract_start_date) {
      throw new Error('Contract end date must be after start date');
    }
    
    // Auto-compute duration
    employee.contract_duration_months = monthsBetween(
      employee.contract_start_date,
      employee.contract_end_date
    );
    
    // Send renewal reminder 60 days before expiry
    if (daysUntil(employee.contract_end_date) <= 60) {
      sendContractRenewalReminder(employee);
    }
  }
}
```

**Contract Renewal**:
- Check `is_contract_renewable` flag
- Send reminder to HR 60 days before contract_end_date
- Options: Renew contract, Convert to permanent, Let contract lapse
- Update employment_type to 'full-time' if converting to permanent

---

#### 2.3.3 Official Email Generation & Management
**Rule**: Auto-generate company email address for each employee

**Email Format**: `{first_name}.{last_name}@ecovale.com`

**Generation Algorithm**:
```javascript
function generateOfficialEmail(firstName, lastName) {
  // Convert to lowercase and remove special characters
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
  
  let baseEmail = `${cleanFirst}.${cleanLast}@ecovale.com`;
  
  // Check for duplicates
  let suffix = 1;
  let finalEmail = baseEmail;
  
  while (await emailExists(finalEmail)) {
    suffix++;
    finalEmail = `${cleanFirst}.${cleanLast}${suffix}@ecovale.com`;
  }
  
  return finalEmail;
}

// Examples:
// John Smith → john.smith@ecovale.com
// John Smith (duplicate) → john.smith2@ecovale.com
// Mary-Jane O'Brien → maryjane.obrien@ecovale.com (special chars removed)
```

**Email Lifecycle**:
1. **Creation**: Auto-create email account in company system (Azure AD, G Suite, Exchange)
2. **Active**: Employee can send/receive emails
3. **Exit**: On employee separation:
   - Disable login (employee cannot access)
   - Enable forwarding to manager for 90 days
   - After 90 days: Delete or archive mailbox
4. **Rehire**: Reactivate old email if employee rejoins within 1 year

**Validation**:
- Email must be unique across all current and past employees
- Cannot be manually edited after creation
- Follows company domain: @ecovale.com

---

#### 2.3.4 Department & Designation Assignment
**Rule**: Every employee must belong to a department and have a designation

**Department Assignment**:
- Mandatory field (cannot be NULL)
- Must reference valid department from `departments` table
- Department determines cost center and reporting structure
- Changes to department trigger career_history event

**Designation Assignment**:
- Mandatory field (cannot be NULL)
- Must reference valid designation from `designations` table
- Designation must belong to the selected department
- Designation determines:
  - Salary range (min/max CTC)
  - Job responsibilities
  - Approval authorities
  - Organizational level

**Validation**:
```javascript
function validateDepartmentDesignation(employee) {
  // Check department exists
  const department = await db.departments.findById(employee.department_id);
  if (!department) {
    throw new Error('Invalid department');
  }
  
  // Check designation exists
  const designation = await db.designations.findById(employee.designation_id);
  if (!designation) {
    throw new Error('Invalid designation');
  }
  
  // Check designation belongs to department
  if (designation.department_id !== employee.department_id) {
    throw new Error(`Designation ${designation.title} does not belong to ${department.name}`);
  }
  
  // Check salary is within designation range
  if (employee.ctc < designation.min_salary || employee.ctc > designation.max_salary) {
    flagForReview(`CTC ₹${employee.ctc} is outside designation range (₹${designation.min_salary} - ₹${designation.max_salary})`);
  }
}
```

**Job Title vs Designation**:
- `designation_id`: References predefined designation (e.g., "Software Engineer")
- `job_title`: Custom title for specialized roles (e.g., "Full Stack Software Engineer")
- job_title is optional, defaults to designation.title

---

#### 2.3.5 Reporting Structure & Hierarchy
**Rule**: Define organizational reporting relationships and validate hierarchy

**Reporting Relationships**:
1. **Direct Manager** (`reporting_manager_id`): 
   - Primary reporting relationship
   - Employee's direct supervisor for performance reviews, approvals, leave
   - Mandatory for all employees except CEO

2. **Functional Manager** (`functional_manager_id`):
   - Matrix organization dotted line reporting
   - Technical or functional guidance
   - Optional, used in matrix structures

3. **HR Manager** (`hr_manager_id`):
   - Assigned HR business partner
   - HR point of contact for employee support
   - Optional but recommended

**Validation Rules**:
```javascript
function validateReportingStructure(employee) {
  // Employee cannot report to self
  if (employee.reporting_manager_id === employee.employee_id) {
    throw new Error('Employee cannot report to themselves');
  }
  
  // Reporting manager must be an active employee
  const manager = await db.employees.findById(employee.reporting_manager_id);
  if (!manager || manager.status !== 'active') {
    throw new Error('Reporting manager must be an active employee');
  }
  
  // Check for circular reporting (A → B → C → A)
  if (hasCircularReporting(employee)) {
    throw new Error('Circular reporting relationship detected');
  }
  
  // Validate hierarchy depth (max 20 levels)
  const hierarchyDepth = calculateHierarchyDepth(employee);
  if (hierarchyDepth > 20) {
    throw new Error('Organization hierarchy too deep (max 20 levels)');
  }
}

function hasCircularReporting(employee) {
  const visited = new Set();
  let current = employee.reporting_manager_id;
  
  while (current) {
    if (current === employee.employee_id) {
      return true; // Circular reference found
    }
    if (visited.has(current)) {
      return true; // Loop detected
    }
    visited.add(current);
    
    const manager = db.employees.findById(current);
    current = manager?.reporting_manager_id;
    
    if (visited.size > 20) {
      return true; // Hierarchy too deep
    }
  }
  
  return false;
}
```

**Reporting Chain Queries**:
```sql
-- Get employee's direct reports
SELECT * FROM employees 
WHERE reporting_manager_id = 'EMP-2026-0001' 
  AND status = 'active';

-- Get employee's reporting chain (up to CEO)
WITH RECURSIVE reporting_chain AS (
  -- Base: Employee's direct manager
  SELECT e.employee_id, e.full_name, e.designation_id, 1 as level
  FROM employees e
  WHERE e.employee_id = (
    SELECT reporting_manager_id 
    FROM employees 
    WHERE employee_id = 'EMP-2026-0100'
  )
  
  UNION ALL
  
  -- Recursive: Manager's manager
  SELECT e.employee_id, e.full_name, e.designation_id, rc.level + 1
  FROM employees e
  JOIN reporting_chain rc ON e.employee_id = (
    SELECT reporting_manager_id 
    FROM employees 
    WHERE employee_id = rc.employee_id
  )
  WHERE rc.level < 10
)
SELECT * FROM reporting_chain ORDER BY level;

-- Get all subordinates (entire team hierarchy)
WITH RECURSIVE subordinates AS (
  -- Base: Direct reports
  SELECT employee_id, full_name, designation_id, 1 as level
  FROM employees
  WHERE reporting_manager_id = 'EMP-2026-0001'
    AND status = 'active'
  
  UNION ALL
  
  -- Recursive: Reports' reports
  SELECT e.employee_id, e.full_name, e.designation_id, s.level + 1
  FROM employees e
  JOIN subordinates s ON e.reporting_manager_id = s.employee_id
  WHERE e.status = 'active' AND s.level < 10
)
SELECT * FROM subordinates ORDER BY level, full_name;
```

**Auto-compute Team Size**:
```javascript
// Update direct_reports_count when reporting structure changes
function updateManagerReportCounts(managerId) {
  const directReports = db.query(`
    SELECT COUNT(*) as count
    FROM employees
    WHERE reporting_manager_id = ?
      AND status = 'active'
  `, [managerId]);
  
  db.query(`
    UPDATE employees
    SET direct_reports_count = ?,
        is_people_manager = ?
    WHERE employee_id = ?
  `, [directReports.count, directReports.count > 0, managerId]);
}
```

---

#### 2.3.6 Join Date & Tenure Calculation
**Rule**: Track employment start date and calculate tenure

**Join Date Validation**:
- Mandatory field (cannot be NULL)
- Cannot be in the future
- Typically set to first day of employment
- Used as baseline for all tenure calculations

**Tenure Auto-computation**:
```sql
-- Tenure in years, months, days (computed columns)
tenure_years = EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date))
tenure_months = EXTRACT(MONTH FROM AGE(CURRENT_DATE, join_date))  
tenure_days = EXTRACT(DAY FROM AGE(CURRENT_DATE, join_date))

-- Example: join_date = '2024-03-15', today = '2026-01-20'
-- tenure_years = 1
-- tenure_months = 10
-- tenure_days = 5
-- Display: "1 year, 10 months, 5 days"
```

**Special Cases**:
- **Rehired Employees**: 
  - `original_join_date`: First join date before employee left
  - `join_date`: Most recent join date (current tenure)
  - Track both for service awards and benefits eligibility

- **Internal Transfers**:
  - `join_date`: Original company join date (unchanged)
  - `effective_date`: Start date of current role
  - Used for role tenure vs company tenure distinction

**Use Cases**:
- **Service Awards**: Trigger alerts for 1-year, 5-year, 10-year milestones
- **Leave Accrual**: Leave entitlement increases with tenure
- **Gratuity**: Payable after 5 years of service
- **Probation**: Calculate probation end date from join_date

**Query Examples**:
```sql
-- Employees completing 1 year this month
SELECT employee_id, full_name, join_date,
       EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date)) as years
FROM employees
WHERE EXTRACT(MONTH FROM join_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date)) = 1
  AND status = 'active';

-- Employees with tenure >= 5 years (gratuity eligible)
SELECT employee_id, full_name, join_date,
       EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date)) as years
FROM employees
WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date)) >= 5
  AND status = 'active';
```

---

#### 2.3.7 Probation Management & Confirmation
**Rule**: Manage probationary period and employee confirmation

**Probation Period**:
- Default: 6 months (can be customized 3-12 months based on role)
- Auto-compute probation_end_date = join_date + probation_period_months
- Confirmation status: 'pending' (default) → 'confirmed' or 'extended' or 'terminated'

**Probation Workflow**:
```javascript
function manageProbation(employee) {
  const today = new Date();
  const probationEndDate = addMonths(employee.join_date, employee.probation_period_months);
  
  // Send reminders 30 days before probation end
  if (daysUntil(probationEndDate) === 30) {
    sendProbationReminderToManager(employee);
    sendProbationReminderToHR(employee);
  }
  
  // Check if probation has ended but status is still 'pending'
  if (today > probationEndDate && employee.confirmation_status === 'pending') {
    flagForHRAction('Probation period ended. Confirmation pending.', employee);
  }
}
```

**Confirmation Process**:
1. **30 days before end**: Send reminder to manager and HR
2. **Manager reviews** performance and provides recommendation
3. **HR reviews** attendance, disciplinary record, document completion
4. **Decision**:
   - **Confirm**: Update confirmation_status = 'confirmed', set confirmation_date
   - **Extend**: Update confirmation_status = 'extended', add probation_extended_by_months, capture reason
   - **Terminate**: Update confirmation_status = 'terminated', initiate exit process

**Confirmation Status Impact**:
- Cannot process annual performance appraisal until confirmed
- Confirmed employees eligible for internal job postings
- Probation extension maximum: 3 months (total max probation: 9 months)

**Validation**:
```javascript
function validateConfirmation(employee) {
  const probationEndDate = addMonths(employee.join_date, employee.probation_period_months);
  
  if (employee.confirmation_status === 'confirmed') {
    // Confirmation date should be after probation end date
    if (employee.confirmation_date < probationEndDate) {
      throw new Error('Cannot confirm before probation end date');
    }
  }
  
  if (employee.confirmation_status === 'extended') {
    // Extension cannot exceed 3 months
    if (employee.probation_extended_by_months > 3) {
      throw new Error('Probation extension cannot exceed 3 months');
    }
    
    // Extension reason is mandatory
    if (!employee.probation_extension_reason) {
      throw new Error('Extension reason is required');
    }
  }
}
```

---

#### 2.3.8 Work Location & Remote Work Policy
**Rule**: Define employee work location and remote work eligibility

**Work Locations** (EcoVale offices):
- Bangalore (Headquarters)
- Mangaluru
- Mysore
- Belagaum
- Hubballi
- Kolar
- Tumkur
- Shivamogga
- Remote (full-time remote employees)
- Hybrid (mix of office and remote)

**Work Arrangement Types**:
- **office**: Full-time in office (5 days/week)
- **remote**: Full-time remote (0 days in office)
- **hybrid**: Mix of office and remote (2-3 days office, 2-3 days remote)
- **field**: Field-based roles (sales, client-facing)

**Remote Work Eligibility**:
```javascript
function determineRemoteEligibility(employee) {
  // Remote eligibility criteria
  const eligibilityCriteria = {
    // Role-based (some roles require office presence)
    roleEligible: !['Receptionist', 'Facilities', 'IT Support'].includes(employee.designation.title),
    
    // Tenure-based (must complete probation)
    tenureEligible: employee.confirmation_status === 'confirmed',
    
    // Performance-based (must have good performance rating)
    performanceEligible: employee.last_performance_rating in ['Outstanding', 'Exceeds Expectations'],
    
    // Manager approval
    managerApproved: employee.remote_work_manager_approved === true
  };
  
  employee.remote_work_eligible = Object.values(eligibilityCriteria).every(x => x);
  
  return eligibilityCriteria;
}
```

**Hybrid Work Policy**:
- Capture `office_days_per_week` (e.g., 3 days office, 2 days remote)
- Employees must specify which days they'll be in office (Monday, Wednesday, Friday)
- Track office attendance vs remote attendance
- Team collaboration days: Designate specific days when full team is in office (e.g., Wednesdays)

**Validation**:
```javascript
function validateWorkArrangement(employee) {
  if (employee.work_arrangement === 'hybrid') {
    // office_days_per_week is mandatory for hybrid
    if (!employee.office_days_per_week) {
      throw new Error('office_days_per_week is required for hybrid work arrangement');
    }
    
    // Must be between 1 and 4 days
    if (employee.office_days_per_week < 1 || employee.office_days_per_week > 4) {
      throw new Error('Hybrid arrangement requires 1-4 office days per week');
    }
    
    // Auto-compute remote days
    employee.remote_work_days_per_week = 5 - employee.office_days_per_week;
  }
  
  if (employee.work_arrangement === 'remote') {
    // Check remote work eligibility
    if (!employee.remote_work_eligible) {
      throw new Error('Employee is not eligible for remote work');
    }
  }
}
```

---

#### 2.3.9 Shift Management & Work Hours
**Rule**: Define work shifts and standard hours

**Shift Types**:
- **day**: Regular day shift (9 AM - 6 PM)
- **night**: Night shift (9 PM - 6 AM) - for global teams, support roles
- **rotational**: Alternating day/night shifts
- **flexible**: Flexible hours (core hours 11 AM - 4 PM)
- **general**: Standard shift for most employees

**Work Hours**:
- Standard: 8 hours/day, 40 hours/week (Monday-Friday)
- Part-time: Reduced hours (e.g., 20 hours/week)
- Capture shift_start_time and shift_end_time

**Overtime Eligibility**:
- `overtime_eligible = true`: Eligible for overtime pay (hourly employees, non-management)
- `overtime_eligible = false`: Not eligible (salaried, management positions)
- Overtime rate: 1.5x regular hourly rate for hours beyond 40/week

**Validation**:
```javascript
function validateShift(employee) {
  if (employee.shift_type !== 'flexible') {
    // Start and end times are mandatory for fixed shifts
    if (!employee.shift_start_time || !employee.shift_end_time) {
      throw new Error('Shift start and end times are required');
    }
    
    // End time must be after start time
    if (employee.shift_end_time <= employee.shift_start_time) {
      throw new Error('Shift end time must be after start time');
    }
    
    // Calculate work hours
    const hours = hoursBetween(employee.shift_start_time, employee.shift_end_time);
    if (hours !== employee.work_hours_per_day) {
      flagForReview(`Shift duration (${hours} hrs) does not match work_hours_per_day (${employee.work_hours_per_day} hrs)`);
    }
  }
  
  // Part-time validation
  if (employee.employment_type === 'part-time') {
    if (employee.work_hours_per_week >= 40) {
      throw new Error('Part-time employees must work < 40 hours/week');
    }
  }
}
```

---

#### 2.3.10 Notice Period & Exit Management
**Rule**: Define notice period requirements and manage employee exits

**Notice Period**:
- Standard: 60 days (2 months)
- Varies by level:
  - Junior roles: 30 days
  - Mid-level: 60 days
  - Senior/Management: 90 days

**Notice Period Calculation**:
```javascript
function calculateLastWorkingDay(resignationDate, noticePeriodDays) {
  // Add notice period days (excluding weekends and holidays)
  let workingDays = 0;
  let currentDate = new Date(resignationDate);
  
  while (workingDays < noticePeriodDays) {
    currentDate = addDays(currentDate, 1);
    
    // Skip weekends
    if (isWeekend(currentDate)) continue;
    
    // Skip holidays
    if (isHoliday(currentDate)) continue;
    
    workingDays++;
  }
  
  return currentDate;
}

// Example: Resignation on Jan 1, 2026, 60 days notice
// Last working day ≈ March 15, 2026 (60 working days later)
```

**Notice Period Buyout**:
- If `notice_period_buyout_allowed = true`, employee can pay to reduce notice period
- Buyout amount = (Monthly salary / 30) × Days to be bought out
- Example: Buy out 30 days = (₹50,000 / 30) × 30 = ₹50,000

**Notice Period Waiver**:
- Employer can waive notice period (`notice_period_waived = true`)
- Typically for redundancy, layoffs, mutual separation
- Employee can leave immediately without serving notice

**Exit Process**:
1. **Resignation Submission**: Employee submits resignation letter, capture resignation_date
2. **Notice Period**: Calculate last_working_day = resignation_date + notice_period_days
3. **Manager Acceptance**: Manager accepts/negotiates last working day
4. **Exit Workflow**:
   - Asset return (laptop, ID card, access card)
   - Knowledge transfer
   - Exit interview
   - Clearance certificate
   - Full & Final Settlement
5. **Status Update**: Change status to 'exited' on separation_date
6. **Email Deactivation**: Disable email on exit_date (after handover period)

**Exit Types**:
- **Resignation**: Employee-initiated voluntary exit
- **Termination**: Employer-initiated exit (performance, misconduct)
- **Retirement**: Age-based retirement (60 years)
- **Layoff**: Business-driven workforce reduction
- **End of Contract**: Contract expiry
- **Death**: In case of employee death (insurance claim process)

**Rehire Eligibility**:
- Mark `rehire_eligible = true/false` based on exit circumstances
- Positive exit (resignation, retirement, end of contract): Eligible
- Negative exit (termination for cause, absconding): Not eligible

**Validation**:
```javascript
function validateExit(employee) {
  // Separation date must be after resignation date
  if (employee.separation_date < employee.resignation_date) {
    throw new Error('Separation date cannot be before resignation date');
  }
  
  // Check notice period served
  const noticeDays = workingDaysBetween(employee.resignation_date, employee.separation_date);
  employee.notice_period_served_days = noticeDays;
  
  if (noticeDays < employee.notice_period_days && !employee.notice_period_waived) {
    flagForReview(`Notice period served (${noticeDays} days) is less than required (${employee.notice_period_days} days)`);
  }
  
  // Exit reason is mandatory for termination/layoff
  if (['Termination', 'Layoff'].includes(employee.exit_type) && !employee.exit_reason) {
    throw new Error('Exit reason is mandatory for termination/layoff');
  }
}
```

---

#### 2.3.11 Background Verification & Compliance
**Rule**: Ensure background verification completion before onboarding

**Background Verification Process**:
1. **Initiate BGV**: After offer acceptance, send details to BGV agency
2. **Checks Performed**:
   - Identity verification (Aadhar, PAN, Address)
   - Education verification (degree certificates)
   - Employment verification (experience letters, salary slips)
   - Criminal record check (court records, police verification)
   - Reference check (2-3 professional references)
3. **Status Tracking**: 'Pending' → 'In Progress' → 'Completed' / 'Failed'
4. **Completion**: Mark `background_verification_status = 'Completed'`, capture date and agency

**Payroll Blocking**:
```javascript
function canActivatePayroll(employee) {
  // BGV must be completed before payroll activation
  if (employee.background_verification_status !== 'Completed') {
    return {
      allowed: false,
      reason: 'Background verification pending. Cannot activate payroll.'
    };
  }
  
  // All mandatory documents must be uploaded
  if (!allMandatoryDocumentsSubmitted(employee)) {
    return {
      allowed: false,
      reason: 'Mandatory documents not submitted.'
    };
  }
  
  return { allowed: true };
}
```

**Police Verification**:
- Required for sensitive roles (finance, security, legal)
- Capture `police_verification_status`
- Obtain police clearance certificate from local police station

**Reference Check**:
- Contact 2-3 references provided by candidate
- Verify employment dates, designation, performance
- Mark `reference_check_status = 'Completed'`

---

#### 2.3.12 Onboarding & Buddy System
**Rule**: Structured onboarding process for new hires

**Onboarding Checklist**:
1. **Pre-joining**:
   - Send offer letter, appointment letter
   - Collect documents (Aadhar, PAN, certificates)
   - Initiate background verification

2. **Day 1**:
   - IT setup (laptop, email, system access)
   - Issue ID card, access card
   - Office tour, desk assignment
   - Meet team and buddy

3. **Week 1**:
   - Employee handbook acknowledgment
   - Confidentiality agreement signing
   - Induction training (company, policies, culture)
   - HR orientation, benefits enrollment

4. **Month 1**:
   - Role-specific training
   - Project assignment
   - Regular check-ins with manager and buddy
   - Onboarding feedback survey

**Buddy System**:
- Assign `buddy_employee_id`: A peer to help new hire settle in
- Buddy responsibilities:
  - Answer questions about processes, culture
  - Lunch companion in first week
  - Introduce to team members
  - Help with onboarding tasks
- Buddy tenure: First 3 months

**Mentor System**:
- Assign `mentor_employee_id`: A senior employee for career guidance
- Mentor responsibilities:
  - Career planning and development
  - Skills development advice
  - Long-term career guidance (beyond 1 year)

**Onboarding Completion**:
- Mark `onboarding_completed = true` after 30 days
- Set `onboarding_completion_date`
- HR survey: Measure onboarding effectiveness

---

#### 2.3.13 Asset Management
**Rule**: Track company assets issued to employees

**Assets Tracked**:
1. **Laptop/Desktop**:
   - `laptop_issued = true/false`
   - `laptop_serial_number`: For asset tracking
   - Laptop must be returned on exit

2. **ID Card**:
   - `id_card_issued = true/false`
   - `id_card_number`: Unique ID card number
   - Photo ID for building access and identification

3. **Access Card**:
   - `access_card_number`: RFID card for building/floor entry
   - Deactivate on employee exit

4. **Parking**:
   - `parking_allocated = true/false`
   - `parking_spot_number`: Reserved spot number
   - Available for senior roles or on request

5. **Other Assets**:
   - Mobile phone (if provided)
   - Desk phone extension
   - Office key
   - Company credit card

**Asset Return on Exit**:
```javascript
function checkAssetReturn(employee) {
  const pendingAssets = [];
  
  if (employee.laptop_issued && !employee.laptop_returned) {
    pendingAssets.push(`Laptop (Serial: ${employee.laptop_serial_number})`);
  }
  
  if (employee.id_card_issued && !employee.id_card_returned) {
    pendingAssets.push(`ID Card (${employee.id_card_number})`);
  }
  
  if (employee.access_card_number && !employee.access_card_returned) {
    pendingAssets.push(`Access Card (${employee.access_card_number})`);
  }
  
  if (pendingAssets.length > 0) {
    return {
      clearanceGranted: false,
      pendingAssets: pendingAssets,
      message: 'Cannot process Full & Final settlement until all assets are returned'
    };
  }
  
  return { clearanceGranted: true };
}
```

---

#### 2.3.14 Status Management & Lifecycle
**Rule**: Track employee status throughout lifecycle

**Status Values**:
- **new**: Just created, onboarding in progress (BGV pending, documents pending)
- **active**: Confirmed, actively working (default for most employees)
- **on_leave**: On extended leave (maternity, sabbatical, unpaid leave > 30 days)
- **suspended**: Temporarily suspended (disciplinary action pending)
- **exited**: No longer employed (resigned, terminated, retired)
- **deceased**: In case of employee death

**Status Transitions**:
```
new → active (onboarding complete, BGV cleared, probation confirmed)
active → on_leave (extended leave starts)
on_leave → active (employee returns from leave)
active → suspended (disciplinary suspension)
suspended → active (suspension lifted) or exited (termination)
active → exited (resignation, retirement, termination)
```

**Status Change Tracking**:
- Capture `status_change_date` on every status change
- Capture `status_change_reason` for audit trail
- Log status changes in audit_logs table
- Notify stakeholders (manager, HR) on status change

**Payroll Impact**:
```javascript
function getPayrollEligibility(employee) {
  const eligibleStatuses = ['active', 'on_leave'];
  
  if (!eligibleStatuses.includes(employee.status)) {
    return {
      eligible: false,
      reason: `Employee status is ${employee.status}. Only active and on_leave employees are eligible for payroll.`
    };
  }
  
  // on_leave: Pay based on leave policy (paid/unpaid)
  if (employee.status === 'on_leave') {
    return {
      eligible: true,
      note: 'Check leave type (paid/unpaid) for salary calculation'
    };
  }
  
  return { eligible: true };
}
```

---

### 2.4 Probation Period
**Rule**: Default probation period is 6 months

**Validation**:
- Probation period ≥ 0 months
- Typically 3 or 6 months
- Can be customized per employee

---

### 2.5 Reporting Structure
**Rule**: Employees can have a reporting manager

**Validation**:
- Reporting manager must be a valid active employee
- Cannot report to self (employee_id ≠ reporting_manager_id)
- Circular reporting not allowed (A → B → C → A)
- Reporting manager can be NULL (for top-level executives)

**Circular Check**:
```
Algorithm: Traverse reporting chain up to root
If employee_id appears in chain, reject update
Maximum hierarchy depth: 20 levels
```

**Implementation**:
- Database trigger validates on INSERT/UPDATE
- Application layer also validates before submission
- Hierarchy queries use recursive CTEs

---

### 2.6 Employee Data Validation
**Rule**: Comprehensive validation for all employee fields

**Personal Information Validation**:
- First name: Required, 1-100 characters, alphabetic
- Last name: Required, 1-100 characters, alphabetic
- Middle name: Optional, 1-100 characters if provided
- Contact number: Required, 10 digits (Indian format)
- Personal email: Required, valid email format
- Date of birth: Optional, must be ≥ 18 years ago (legal working age)
- Gender: Required, must be 'Male', 'Female', or 'Other'
- Address: Current address required, max 500 characters
- Blood group: Optional, must match valid types (A+, A-, B+, B-, O+, O-, AB+, AB-)

**Employment Validation**:
- Department: Required, must reference valid department
- Designation: Required, must reference valid designation
- Join date: Optional, cannot be future date
- Employment type: Required, 'full-time' or 'part-time'
- Work location: Required, must be from predefined list
- Probation period: Required, 0-12 months typically
- Official email: Auto-generated, must be unique

**Statutory Numbers Validation**:
- PF number: Optional, alphanumeric, 22 characters
- ESI number: Optional, 17 digits
- If provided, must be unique across all employees

---

### 2.4 Employee Salary Information Management
**Rule**: Comprehensive salary calculation and management following Indian statutory requirements

**Purpose**: Define how employee salaries are structured, calculated, and processed including CTC breakdown, statutory deductions (PF, ESI, PT, TDS), employer contributions, net salary computation, and special handling for consultants with GST.

---

#### 2.4.1 CTC (Cost to Company) Calculation & Breakdown

**Definition**: CTC is the total annual cost to the company for employing an individual, including salary, allowances, employer contributions, and benefits.

**CTC Components**:
```
CTC = Annual Gross Salary + Employer PF + Employer ESI + Health Insurance + Variable Pay
```

**Example Calculation** (₹6,00,000 CTC):
```javascript
const ctc = 600000; // Annual CTC

// Monthly components
const basic = (ctc * 0.50) / 12; // ₹25,000 (50% of CTC)
const hra = basic * 0.40; // ₹10,000 (40% of basic)
const conveyance = 1600; // ₹1,600 (fixed)
const medical = 1250; // ₹1,250 (fixed)
const telephone = 500; // ₹500 (variable)
const healthInsurance = 1000 / 12; // ₹83.33 (annual premium)

// Employer contributions
const employerPF = Math.min(basic, 15000) * 0.12; // ₹1,800
const employerESI = 0; // Not applicable if gross > ₹21,000

// Special allowance (balancing component)
const specialAllowance = (ctc / 12) - basic - hra - conveyance - medical - telephone - healthInsurance - employerPF - employerESI;
// = ₹50,000 - ₹25,000 - ₹10,000 - ₹1,600 - ₹1,250 - ₹500 - ₹83 - ₹1,800 - ₹0 = ₹9,767

console.log('Monthly CTC Breakdown:');
console.log('Basic: ₹' + basic);
console.log('HRA: ₹' + hra);
console.log('Conveyance: ₹' + conveyance);
console.log('Medical: ₹' + medical);
console.log('Telephone: ₹' + telephone);
console.log('Special Allowance: ₹' + specialAllowance);
console.log('Health Insurance: ₹' + (healthInsurance).toFixed(2));
console.log('Employer PF: ₹' + employerPF);
console.log('Monthly CTC: ₹' + (ctc / 12));
```

**Validation**:
```javascript
function validateCTC(ctc, components) {
  // CTC must be positive
  if (ctc <= 0) {
    throw new Error('CTC must be greater than zero');
  }
  
  // Sum of all components should match CTC
  const calculatedCTC = (
    (components.basic + components.hra + components.allowances) * 12 +
    components.employerPF * 12 +
    components.employerESI * 12 +
    components.healthInsurance
  );
  
  const difference = Math.abs(ctc - calculatedCTC);
  if (difference > 100) { // Allow ₹100 tolerance for rounding
    throw new Error(`CTC mismatch: Declared ₹${ctc}, Calculated ₹${calculatedCTC}`);
  }
  
  return true;
}
```

**Business Rules**:
- CTC must be ≥ ₹1,00,000/year (minimum wage compliance)
- CTC must be ≤ ₹2,00,00,000/year (maximum cap for validation)
- CTC should be in multiples of ₹1,000
- Special allowance is the balancing component (positive value required)
- If special allowance becomes negative, restructure salary components

---

#### 2.4.2 Basic Salary Calculation

**Rule**: Basic salary is the foundation of salary structure and statutory calculations

**Formula**:
```
Basic Salary (Monthly) = (CTC × 50%) / 12
```

**Industry Standards**:
- Typically 50% of CTC (standard practice)
- Minimum: 40% of CTC (for higher CTC roles with more allowances)
- Maximum: 60% of CTC (rare, usually for simple salary structures)

**Example**:
```javascript
function calculateBasicSalary(annualCTC, basicPercentage = 50) {
  // Validate percentage
  if (basicPercentage < 40 || basicPercentage > 60) {
    throw new Error('Basic percentage must be between 40% and 60%');
  }
  
  // Calculate monthly basic
  const monthlyBasic = (annualCTC * (basicPercentage / 100)) / 12;
  
  // Round to 2 decimal places
  return Math.round(monthlyBasic * 100) / 100;
}

// Usage
const ctc = 600000;
const basic = calculateBasicSalary(ctc, 50); // ₹25,000/month
console.log('Monthly Basic Salary: ₹' + basic);
```

**Validation**:
```javascript
function validateBasicSalary(basic, ctc, basicPercentage) {
  const expectedBasic = (ctc * (basicPercentage / 100)) / 12;
  const tolerance = 10; // ₹10 tolerance for rounding
  
  if (Math.abs(basic - expectedBasic) > tolerance) {
    throw new Error(`Basic salary mismatch. Expected: ₹${expectedBasic}, Got: ₹${basic}`);
  }
  
  // Basic should be reasonable amount
  if (basic < 8333) { // Minimum wage ₹1,00,000/year
    throw new Error('Basic salary below minimum wage');
  }
  
  return true;
}
```

**Business Rules**:
- Basic is the base for PF calculation (12% of basic, capped at ₹15,000)
- Basic is the base for HRA calculation (typically 40-50% of basic)
- Basic is used in gratuity calculation (last drawn basic × 15/26 × years)
- Higher basic = higher PF deduction (beneficial for retirement savings)
- Lower basic = lower PF deduction but higher take-home (trade-off)

**SQL Generated Column**:
```sql
ALTER TABLE employees
ADD COLUMN basic_monthly DECIMAL(12,2) 
GENERATED ALWAYS AS ((ctc * (basic_percentage / 100)) / 12) STORED;
```

---

#### 2.4.3 HRA (House Rent Allowance) Calculation & Exemption

**Rule**: HRA is calculated as a percentage of basic salary and eligible for tax exemption under Section 10(13A)

**Formula**:
```
HRA (Monthly) = Basic Salary × (HRA Percentage / 100)
```

**HRA Percentage Standards**:
- Metro cities (Mumbai, Delhi, Kolkata, Chennai, Bangalore, Hyderabad): 50% of basic
- Non-metro cities: 40% of basic

**Example**:
```javascript
function calculateHRA(basic, city = 'metro') {
  const hraPercentage = city === 'metro' ? 50 : 40;
  const hra = basic * (hraPercentage / 100);
  return Math.round(hra * 100) / 100;
}

// Usage
const basic = 25000;
const hraMetro = calculateHRA(basic, 'metro'); // ₹12,500
const hraNonMetro = calculateHRA(basic, 'non-metro'); // ₹10,000

console.log('HRA (Metro): ₹' + hraMetro);
console.log('HRA (Non-Metro): ₹' + hraNonMetro);
```

**Tax Exemption Calculation** (Under Old Tax Regime):
```javascript
function calculateHRAExemption(hra, basic, rentPaid, city = 'metro') {
  // HRA exemption is minimum of:
  // 1. Actual HRA received
  // 2. Rent paid - 10% of basic
  // 3. 50% of basic (metro) or 40% of basic (non-metro)
  
  const rentMinus10Percent = rentPaid - (basic * 0.10);
  const cityPercentage = city === 'metro' ? 0.50 : 0.40;
  const cityBasedAllowance = basic * cityPercentage;
  
  const exemption = Math.min(hra, rentMinus10Percent, cityBasedAllowance);
  
  return exemption > 0 ? exemption : 0;
}

// Example
const hra = 12500;
const basic = 25000;
const rentPaid = 20000;
const exemption = calculateHRAExemption(hra, basic, rentPaid, 'metro');
console.log('HRA Exemption: ₹' + exemption); // ₹12,500 (minimum of all three)

// Taxable HRA
const taxableHRA = hra - exemption;
console.log('Taxable HRA: ₹' + taxableHRA); // ₹0
```

**Validation**:
```javascript
function validateHRA(hra, basic, hraPercentage) {
  const expectedHRA = basic * (hraPercentage / 100);
  const tolerance = 5; // ₹5 tolerance
  
  if (Math.abs(hra - expectedHRA) > tolerance) {
    throw new Error(`HRA mismatch. Expected: ₹${expectedHRA}, Got: ₹${hra}`);
  }
  
  // HRA percentage should be between 30% and 60% of basic
  if (hraPercentage < 30 || hraPercentage > 60) {
    throw new Error('HRA percentage must be between 30% and 60% of basic');
  }
  
  return true;
}
```

**Business Rules**:
- HRA is fully taxable under new tax regime (no exemption)
- HRA is eligible for exemption under old tax regime (Section 10(13A))
- Employee must submit rent receipts to claim exemption (if rent > ₹1,00,000/year, landlord PAN required)
- If employee lives in own house, HRA is fully taxable (no exemption)
- HRA exemption calculated annually during ITR filing

**SQL Trigger** (Auto-compute HRA):
```sql
CREATE OR REPLACE FUNCTION update_hra()
RETURNS TRIGGER AS $$
BEGIN
  -- Update HRA when basic or hra_percentage changes
  NEW.hra := NEW.basic * (NEW.hra_percentage / 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hra
BEFORE INSERT OR UPDATE OF basic, hra_percentage ON employees
FOR EACH ROW
EXECUTE FUNCTION update_hra();
```

---

#### 2.4.4 Fixed Allowances (Conveyance, Medical, Telephone)

**Rule**: Fixed allowances are standard monthly allowances with specific tax treatment

**Conveyance Allowance**:
- Purpose: Commuting expenses (travel to/from office)
- Standard Amount:
  - Metro cities: ₹1,600/month
  - Non-metro cities: ₹800/month
- Tax Treatment: Fully exempt up to ₹1,600/month (under old regime)
- Under new tax regime: Fully taxable

```javascript
function calculateConveyance(city = 'metro') {
  return city === 'metro' ? 1600 : 800;
}
```

**Medical Allowance**:
- Purpose: Medical expenses reimbursement
- Standard Amount: ₹1,250/month (₹15,000/year)
- Tax Treatment:
  - Old regime: Exempt up to ₹15,000/year with medical bills
  - New regime: Fully taxable
- Validation: Employee must submit medical bills to claim exemption

```javascript
const MEDICAL_ALLOWANCE_MONTHLY = 1250;
const MEDICAL_ALLOWANCE_ANNUAL = 15000;

function calculateMedicalExemption(medicalBills) {
  // Maximum exemption is ₹15,000/year
  return Math.min(medicalBills, MEDICAL_ALLOWANCE_ANNUAL);
}
```

**Telephone/Mobile Allowance**:
- Purpose: Mobile/phone bill reimbursement
- Variable Amount: ₹500 - ₹2,000/month (based on role)
  - Junior staff: ₹500/month
  - Mid-level: ₹1,000/month
  - Senior/Manager: ₹1,500-₹2,000/month
- Tax Treatment: Fully taxable
- Validation: Optional, based on company policy

```javascript
function calculateTelephoneAllowance(role) {
  const allowanceMap = {
    'employee': 500,
    'senior': 1000,
    'manager': 1500,
    'senior_manager': 2000
  };
  return allowanceMap[role] || 500;
}
```

**Other Allowances**:
- **LTA (Leave Travel Allowance)**: ₹10,000-₹20,000/year (exempt for travel within India)
- **Education Allowance**: ₹100-₹200/month per child (max 2 children)
- **Uniform Allowance**: ₹500-₹1,000/month (for specific roles)
- **Food Allowance**: ₹500-₹1,500/month (taxable)

**Total Fixed Allowances**:
```javascript
function calculateFixedAllowances(city, role) {
  const conveyance = calculateConveyance(city);
  const medical = 1250;
  const telephone = calculateTelephoneAllowance(role);
  
  return {
    conveyance,
    medical,
    telephone,
    total: conveyance + medical + telephone
  };
}

// Example
const allowances = calculateFixedAllowances('metro', 'manager');
console.log('Conveyance: ₹' + allowances.conveyance); // ₹1,600
console.log('Medical: ₹' + allowances.medical); // ₹1,250
console.log('Telephone: ₹' + allowances.telephone); // ₹1,500
console.log('Total Fixed Allowances: ₹' + allowances.total); // ₹4,350
```

**Validation**:
```javascript
function validateAllowances(allowances) {
  // Conveyance
  if (allowances.conveyance < 0 || allowances.conveyance > 2000) {
    throw new Error('Conveyance must be between ₹0 and ₹2,000');
  }
  
  // Medical
  if (allowances.medical < 0 || allowances.medical > 2000) {
    throw new Error('Medical allowance must be between ₹0 and ₹2,000');
  }
  
  // Telephone
  if (allowances.telephone < 0 || allowances.telephone > 3000) {
    throw new Error('Telephone allowance must be between ₹0 and ₹3,000');
  }
  
  return true;
}
```

---

#### 2.4.5 Special Allowance (Balancing Component)

**Rule**: Special allowance is the adjustable component used to match the desired CTC

**Purpose**: After allocating basic, HRA, fixed allowances, and employer contributions, the remaining amount is assigned to special allowance to match the monthly CTC.

**Formula**:
```
Special Allowance = (CTC / 12) - Basic - HRA - Fixed Allowances - Health Insurance - Employer PF - Employer ESI
```

**Calculation Example**:
```javascript
function calculateSpecialAllowance(ctc, basic, hra, fixedAllowances, healthInsurance, employerContributions) {
  const monthlyCTC = ctc / 12;
  const specialAllowance = monthlyCTC - basic - hra - fixedAllowances - healthInsurance - employerContributions.pf - employerContributions.esi;
  
  // Special allowance must be non-negative
  if (specialAllowance < 0) {
    throw new Error('Special allowance cannot be negative. Salary structure needs adjustment.');
  }
  
  return Math.round(specialAllowance * 100) / 100;
}

// Example
const ctc = 600000;
const basic = 25000;
const hra = 10000;
const fixedAllowances = 4350; // Conveyance + Medical + Telephone
const healthInsurance = 83.33;
const employerPF = 1800;
const employerESI = 0;

const specialAllowance = calculateSpecialAllowance(
  ctc, basic, hra, fixedAllowances, healthInsurance, 
  { pf: employerPF, esi: employerESI }
);

console.log('Special Allowance: ₹' + specialAllowance); // ₹8,766.67
```

**Tax Treatment**:
- Special allowance is fully taxable (no exemptions)
- Part of gross salary for tax computation
- Contributes to TDS calculation

**Business Rules**:
- Special allowance can be zero (if other components consume entire CTC)
- Special allowance cannot be negative
- If negative, reduce other allowances or restructure salary
- Typically ranges from 10-30% of gross salary

**Validation**:
```javascript
function validateSpecialAllowance(specialAllowance, gross) {
  if (specialAllowance < 0) {
    throw new Error('Special allowance cannot be negative');
  }
  
  // Should not exceed 50% of gross (sanity check)
  if (specialAllowance > gross * 0.50) {
    console.warn('Special allowance is unusually high (> 50% of gross). Review salary structure.');
  }
  
  return true;
}
```

---

#### 2.4.6 Gross Salary Calculation

**Rule**: Gross salary is the sum of all earnings before deductions

**Formula**:
```
Gross Salary (Monthly) = Basic + HRA + Conveyance + Medical + Telephone + Special Allowance + Other Allowances
```

**Calculation**:
```javascript
function calculateGrossSalary(components) {
  const gross = 
    components.basic +
    components.hra +
    components.conveyance +
    components.medical +
    components.telephone +
    components.specialAllowance +
    (components.otherAllowances || 0) +
    (components.variablePay || 0) +
    (components.bonus || 0) +
    (components.incentive || 0) +
    (components.overtime || 0);
  
  return Math.round(gross * 100) / 100;
}

// Example
const components = {
  basic: 25000,
  hra: 10000,
  conveyance: 1600,
  medical: 1250,
  telephone: 1500,
  specialAllowance: 8766.67,
  otherAllowances: 0,
  variablePay: 0,
  bonus: 0,
  incentive: 0,
  overtime: 0
};

const gross = calculateGrossSalary(components);
console.log('Gross Salary: ₹' + gross); // ₹48,116.67
```

**Annual Gross**:
```javascript
const grossAnnual = gross * 12; // ₹5,77,400
```

**Business Rules**:
- Gross is used as the base for ESI calculation (if gross < ₹21,000)
- Gross is used for PT (Professional Tax) calculation
- Gross is used for TDS calculation (after standard deduction)
- Gross includes all taxable and non-taxable allowances
- Variable pay, bonuses, and overtime are added to gross

**Validation**:
```javascript
function validateGrossSalary(gross, ctc) {
  // Gross should be less than monthly CTC (CTC includes employer contributions)
  const monthlyCTC = ctc / 12;
  if (gross > monthlyCTC) {
    throw new Error(`Gross salary (₹${gross}) cannot exceed monthly CTC (₹${monthlyCTC})`);
  }
  
  // Gross should be at least 80% of monthly CTC (sanity check)
  if (gross < monthlyCTC * 0.80) {
    console.warn('Gross salary is less than 80% of monthly CTC. Review salary structure.');
  }
  
  return true;
}
```

**SQL Generated Column**:
```sql
ALTER TABLE employees
ADD COLUMN gross DECIMAL(12,2) 
GENERATED ALWAYS AS (
  basic + hra + conveyance + telephone + medical_allowance + special_allowance + 
  COALESCE(other_allowances, 0) + COALESCE(variable_pay_monthly, 0) + 
  COALESCE(bonus_amount, 0) + COALESCE(incentive_amount, 0) + COALESCE(overtime_amount, 0)
) STORED;
```

---

#### 2.4.7 PF (Provident Fund) Calculation

**Rule**: PF is a retirement savings scheme where both employee and employer contribute 12% of basic salary (capped at ₹15,000 wage ceiling)

**Applicability**:
- Mandatory for employees with basic > ₹15,000
- Optional for employees with basic ≤ ₹15,000 (can opt-in)
- Governed by Employees' Provident Funds and Miscellaneous Provisions Act, 1952

**Wage Ceiling**:
- ₹15,000/month (as per EPF Act)
- PF is calculated on MIN(basic, ₹15,000)

**Employee Contribution**:
- 12% of basic (capped at ₹15,000)
- Deducted from monthly salary
- Formula: `PF Deduction = MIN(basic, ₹15,000) × 12%`

**Employer Contribution**:
- 12% of basic (capped at ₹15,000)
- Split into:
  - EPS (Employees' Pension Scheme): 8.33% of basic (max ₹1,250)
  - EPF (Employees' Provident Fund): Remaining (3.67% or more)

**Calculation Example**:
```javascript
const PF_WAGE_CEILING = 15000;
const PF_PERCENTAGE = 12;
const EPS_PERCENTAGE = 8.33;

function calculatePF(basic, includePF = true) {
  if (!includePF) {
    return { employee: 0, employer: 0, eps: 0, epf: 0, total: 0 };
  }
  
  // PF eligible wage (capped at ₹15,000)
  const pfEligibleWage = Math.min(basic, PF_WAGE_CEILING);
  
  // Employee contribution (12% of eligible wage)
  const employeePF = Math.round(pfEligibleWage * (PF_PERCENTAGE / 100));
  
  // Employer contributions
  const employerPF = Math.round(pfEligibleWage * (PF_PERCENTAGE / 100));
  const employerEPS = Math.round(pfEligibleWage * (EPS_PERCENTAGE / 100));
  const employerEPF = employerPF - employerEPS;
  
  // Total PF (employee + employer EPF + employer EPS)
  const totalPF = employeePF + employerPF;
  
  return {
    employee: employeePF, // Deducted from salary
    employer: employerPF, // Paid by company
    eps: employerEPS, // Goes to pension fund
    epf: employerEPF, // Goes to provident fund
    total: totalPF // Total PF accumulation
  };
}

// Example 1: Basic = ₹25,000 (above ceiling)
const pf1 = calculatePF(25000, true);
console.log('Basic: ₹25,000');
console.log('Employee PF Deduction: ₹' + pf1.employee); // ₹1,800
console.log('Employer PF: ₹' + pf1.employer); // ₹1,800
console.log('  - Employer EPS: ₹' + pf1.eps); // ₹1,250
console.log('  - Employer EPF: ₹' + pf1.epf); // ₹550
console.log('Total PF: ₹' + pf1.total); // ₹3,600

// Example 2: Basic = ₹12,000 (below ceiling)
const pf2 = calculatePF(12000, true);
console.log('\nBasic: ₹12,000');
console.log('Employee PF Deduction: ₹' + pf2.employee); // ₹1,440
console.log('Employer PF: ₹' + pf2.employer); // ₹1,440
console.log('Total PF: ₹' + pf2.total); // ₹2,880
```

**Validation**:
```javascript
function validatePF(basic, pfDeduction, includePF) {
  if (!includePF && pfDeduction > 0) {
    throw new Error('PF deduction must be zero when PF is not applicable');
  }
  
  if (includePF) {
    const expectedPF = Math.min(basic, PF_WAGE_CEILING) * 0.12;
    const tolerance = 5; // ₹5 tolerance for rounding
    
    if (Math.abs(pfDeduction - expectedPF) > tolerance) {
      throw new Error(`PF deduction mismatch. Expected: ₹${expectedPF}, Got: ₹${pfDeduction}`);
    }
  }
  
  // PF deduction cannot exceed ₹1,800 (12% of ₹15,000)
  if (pfDeduction > 1800) {
    throw new Error('PF deduction cannot exceed ₹1,800');
  }
  
  return true;
}
```

**Business Rules**:
- PF account has UAN (Universal Account Number) - 12 digits, unique per employee
- PF is tax-free under Section 80C (up to ₹1.5 lakh/year)
- PF interest rate: ~8% per annum (set by EPFO annually)
- PF withdrawal allowed after 2 months of unemployment or at retirement (58+ years)
- Employer can opt for higher PF contribution (> 12%) voluntarily

**SQL Trigger** (Auto-compute PF):
```sql
CREATE OR REPLACE FUNCTION update_pf()
RETURNS TRIGGER AS $$
DECLARE
  pf_eligible_wage DECIMAL(12,2);
BEGIN
  -- Calculate PF only if include_pf is true
  IF NEW.include_pf THEN
    pf_eligible_wage := LEAST(NEW.basic, NEW.pf_wage_ceiling);
    NEW.pf_eligible_wage := pf_eligible_wage;
    NEW.pf_deduction := ROUND(pf_eligible_wage * (NEW.pf_deduction_percentage / 100), 2);
    NEW.employer_pf := ROUND(pf_eligible_wage * (NEW.employer_pf_percentage / 100), 2);
    NEW.employer_eps := ROUND(pf_eligible_wage * 0.0833, 2); -- 8.33%
    NEW.employer_epf := NEW.employer_pf - NEW.employer_eps;
  ELSE
    NEW.pf_deduction := 0;
    NEW.employer_pf := 0;
    NEW.employer_eps := 0;
    NEW.employer_epf := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pf
BEFORE INSERT OR UPDATE OF basic, include_pf, pf_wage_ceiling ON employees
FOR EACH ROW
EXECUTE FUNCTION update_pf();
```

---

#### 2.4.8 ESI (Employee State Insurance) Calculation

**Rule**: ESI is a social security scheme providing medical and cash benefits to employees with gross salary < ₹21,000/month

**Applicability**:
- Mandatory for employees with gross < ₹21,000/month
- Once gross exceeds ₹21,000, ESI is permanently discontinued (not restored even if gross falls below later)
- Governed by Employees' State Insurance Act, 1948

**Wage Ceiling**:
- ₹21,000/month (as per ESI Act)
- If gross ≥ ₹21,000, ESI is not applicable

**Employee Contribution**:
- 0.75% of gross salary
- Deducted from monthly salary
- Formula: `ESI Deduction = Gross × 0.75%`

**Employer Contribution**:
- 3.25% of gross salary
- Paid by company (not deducted from employee)
- Formula: `Employer ESI = Gross × 3.25%`

**Calculation Example**:
```javascript
const ESI_WAGE_CEILING = 21000;
const ESI_EMPLOYEE_PERCENTAGE = 0.75;
const ESI_EMPLOYER_PERCENTAGE = 3.25;

function calculateESI(gross, includeESI = true) {
  // ESI not applicable if gross >= ₹21,000
  if (gross >= ESI_WAGE_CEILING) {
    return { employee: 0, employer: 0, eligible: false };
  }
  
  if (!includeESI) {
    return { employee: 0, employer: 0, eligible: false };
  }
  
  // Employee ESI deduction (0.75% of gross)
  const employeeESI = Math.round(gross * (ESI_EMPLOYEE_PERCENTAGE / 100) * 100) / 100;
  
  // Employer ESI contribution (3.25% of gross)
  const employerESI = Math.round(gross * (ESI_EMPLOYER_PERCENTAGE / 100) * 100) / 100;
  
  return {
    employee: employeeESI, // Deducted from salary
    employer: employerESI, // Paid by company
    eligible: true
  };
}

// Example 1: Gross = ₹18,000 (below ceiling, eligible)
const esi1 = calculateESI(18000, true);
console.log('Gross: ₹18,000');
console.log('ESI Eligible: ' + esi1.eligible); // true
console.log('Employee ESI Deduction: ₹' + esi1.employee); // ₹135 (0.75%)
console.log('Employer ESI: ₹' + esi1.employer); // ₹585 (3.25%)

// Example 2: Gross = ₹25,000 (above ceiling, not eligible)
const esi2 = calculateESI(25000, true);
console.log('\nGross: ₹25,000');
console.log('ESI Eligible: ' + esi2.eligible); // false
console.log('Employee ESI Deduction: ₹' + esi2.employee); // ₹0
console.log('Employer ESI: ₹' + esi2.employer); // ₹0
```

**Validation**:
```javascript
function validateESI(gross, esiDeduction, includeESI) {
  // If gross >= ₹21,000, ESI should be zero
  if (gross >= ESI_WAGE_CEILING && esiDeduction > 0) {
    throw new Error('ESI deduction must be zero when gross >= ₹21,000');
  }
  
  // If ESI not included, deduction should be zero
  if (!includeESI && esiDeduction > 0) {
    throw new Error('ESI deduction must be zero when ESI is not applicable');
  }
  
  // If ESI applicable, validate calculation
  if (includeESI && gross < ESI_WAGE_CEILING) {
    const expectedESI = gross * (ESI_EMPLOYEE_PERCENTAGE / 100);
    const tolerance = 2; // ₹2 tolerance
    
    if (Math.abs(esiDeduction - expectedESI) > tolerance) {
      throw new Error(`ESI deduction mismatch. Expected: ₹${expectedESI}, Got: ₹${esiDeduction}`);
    }
  }
  
  return true;
}
```

**Business Rules**:
- ESI card (ESIC number) issued to eligible employees - 17 digits
- Covers medical benefits for employee and family (spouse, children, parents)
- Provides cash benefits during sickness, maternity, disability
- ESI contribution is mandatory (cannot opt-out if eligible)
- Once ESI stops due to salary increase, it cannot be restarted even if salary decreases
- Employer must register with ESIC if employing 10+ eligible employees

**SQL Trigger** (Auto-compute ESI):
```sql
CREATE OR REPLACE FUNCTION update_esi()
RETURNS TRIGGER AS $$
BEGIN
  -- ESI applicable only if gross < ₹21,000
  IF NEW.gross < NEW.esi_wage_ceiling AND NEW.include_esi THEN
    NEW.esi_eligible := TRUE;
    NEW.esi_deduction := ROUND(NEW.gross * (NEW.esi_deduction_percentage / 100), 2);
    NEW.employer_esi := ROUND(NEW.gross * (NEW.employer_esi_percentage / 100), 2);
  ELSE
    NEW.esi_eligible := FALSE;
    NEW.esi_deduction := 0;
    NEW.employer_esi := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_esi
BEFORE INSERT OR UPDATE OF gross, include_esi ON employees
FOR EACH ROW
EXECUTE FUNCTION update_esi();
```

---

#### 2.4.9 Professional Tax (PT) Calculation

**Rule**: Professional tax is a state-level tax levied on salaried individuals, with rates varying by state

**State-Specific PT Slabs** (Examples):

**Karnataka PT**:
- Gross ≤ ₹15,000: Nil
- Gross > ₹15,000: ₹200/month

**Maharashtra PT**:
- Gross ≤ ₹5,000: Nil
- ₹5,001 - ₹10,000: ₹175/month
- ₹10,001 and above: ₹300/month (₹2,500 in February)

**Tamil Nadu PT**:
- Gross ≤ ₹21,000: Nil
- ₹21,001 - ₹30,000: ₹135/month
- ₹30,001 - ₹45,000: ₹208/month
- ₹45,001 and above: ₹312/month

**Calculation Example**:
```javascript
function calculateProfessionalTax(gross, state) {
  let pt = 0;
  
  switch (state.toLowerCase()) {
    case 'karnataka':
      pt = gross > 15000 ? 200 : 0;
      break;
    
    case 'maharashtra':
      if (gross <= 5000) pt = 0;
      else if (gross <= 10000) pt = 175;
      else pt = 300; // ₹2,500 in February (handled separately)
      break;
    
    case 'tamil nadu':
      if (gross <= 21000) pt = 0;
      else if (gross <= 30000) pt = 135;
      else if (gross <= 45000) pt = 208;
      else pt = 312;
      break;
    
    case 'delhi':
    case 'haryana':
    case 'rajasthan':
      pt = 0; // PT not applicable in these states
      break;
    
    default:
      console.warn(`PT calculation not defined for state: ${state}`);
      pt = 0;
  }
  
  return pt;
}

// Examples
console.log('Karnataka PT (Gross ₹20,000): ₹' + calculateProfessionalTax(20000, 'Karnataka')); // ₹200
console.log('Maharashtra PT (Gross ₹15,000): ₹' + calculateProfessionalTax(15000, 'Maharashtra')); // ₹300
console.log('Tamil Nadu PT (Gross ₹25,000): ₹' + calculateProfessionalTax(25000, 'Tamil Nadu')); // ₹135
console.log('Delhi PT (Gross ₹30,000): ₹' + calculateProfessionalTax(30000, 'Delhi')); // ₹0
```

**February Adjustment (Maharashtra)**:
- In Maharashtra, February PT is ₹2,500 (instead of ₹300)
- Annual PT: (₹300 × 11) + ₹2,500 = ₹5,800

```javascript
function calculateProfessionalTaxMaharashtra(gross, month) {
  if (gross <= 5000) return 0;
  if (gross <= 10000) return 175;
  
  // For gross > ₹10,000
  return month === 2 ? 2500 : 300; // February = ₹2,500, others = ₹300
}
```

**Validation**:
```javascript
function validateProfessionalTax(pt, gross, state) {
  const expectedPT = calculateProfessionalTax(gross, state);
  
  if (pt !== expectedPT) {
    throw new Error(`PT mismatch for ${state}. Expected: ₹${expectedPT}, Got: ₹${pt}`);
  }
  
  // PT should not exceed ₹3,000/month (sanity check)
  if (pt > 3000) {
    throw new Error('Professional tax cannot exceed ₹3,000/month');
  }
  
  return true;
}
```

**Business Rules**:
- PT is deducted monthly by employer and remitted to state government
- PT is tax-deductible (reduces taxable income under Section 16(iii))
- PT rates change periodically (check state tax department for updates)
- PT is nil in some states (Delhi, Haryana, Rajasthan)
- Employer must register for PT in applicable states

**SQL Function** (PT Calculation):
```sql
CREATE OR REPLACE FUNCTION calculate_professional_tax(gross DECIMAL, state VARCHAR)
RETURNS DECIMAL AS $$
BEGIN
  CASE state
    WHEN 'Karnataka' THEN
      RETURN CASE WHEN gross > 15000 THEN 200 ELSE 0 END;
    WHEN 'Maharashtra' THEN
      RETURN CASE 
        WHEN gross <= 5000 THEN 0
        WHEN gross <= 10000 THEN 175
        ELSE 300 -- February adjustment handled in payroll processing
      END;
    WHEN 'Tamil Nadu' THEN
      RETURN CASE 
        WHEN gross <= 21000 THEN 0
        WHEN gross <= 30000 THEN 135
        WHEN gross <= 45000 THEN 208
        ELSE 312
      END;
    WHEN 'Delhi', 'Haryana', 'Rajasthan' THEN
      RETURN 0;
    ELSE
      RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql;
```

---

#### 2.4.10 TDS (Tax Deducted at Source) Calculation

**Rule**: TDS is income tax deducted by employer from employee's salary as per IT Act, 1961

**Tax Regimes** (as per Finance Act):
1. **Old Tax Regime**: Allows deductions (80C, 80D, HRA, etc.)
2. **New Tax Regime**: Lower tax rates, no deductions (except standard deduction)

**Standard Deduction**:
- ₹50,000/year (applicable in both regimes)

**Income Tax Slabs** (FY 2024-25):

**Old Regime**:
- Up to ₹2,50,000: Nil
- ₹2,50,001 - ₹5,00,000: 5%
- ₹5,00,001 - ₹10,00,000: 20%
- Above ₹10,00,000: 30%
- Cess: 4% on total tax

**New Regime** (FY 2024-25):
- Up to ₹3,00,000: Nil
- ₹3,00,001 - ₹6,00,000: 5%
- ₹6,00,001 - ₹9,00,000: 10%
- ₹9,00,001 - ₹12,00,000: 15%
- ₹12,00,001 - ₹15,00,000: 20%
- Above ₹15,00,000: 30%
- Cess: 4% on total tax

**TDS Calculation (Old Regime)**:
```javascript
function calculateTDS_OldRegime(grossAnnual, exemptions) {
  const standardDeduction = 50000;
  
  // Taxable income = Gross - Standard Deduction - Exemptions
  const taxableIncome = grossAnnual - standardDeduction - exemptions;
  
  if (taxableIncome <= 0) return 0;
  
  let tax = 0;
  
  // Apply slabs
  if (taxableIncome <= 250000) {
    tax = 0;
  } else if (taxableIncome <= 500000) {
    tax = (taxableIncome - 250000) * 0.05;
  } else if (taxableIncome <= 1000000) {
    tax = (250000 * 0.05) + ((taxableIncome - 500000) * 0.20);
  } else {
    tax = (250000 * 0.05) + (500000 * 0.20) + ((taxableIncome - 1000000) * 0.30);
  }
  
  // Add 4% cess
  tax = tax * 1.04;
  
  return Math.round(tax);
}

// Example
const grossAnnual = 600000;
const exemptions = 50000; // 80C: ₹50,000
const tdsOld = calculateTDS_OldRegime(grossAnnual, exemptions);
console.log('TDS (Old Regime): ₹' + tdsOld); // ₹0 (taxable income < ₹2.5L)
```

**TDS Calculation (New Regime)**:
```javascript
function calculateTDS_NewRegime(grossAnnual) {
  const standardDeduction = 50000;
  
  // Taxable income = Gross - Standard Deduction (no other exemptions)
  const taxableIncome = grossAnnual - standardDeduction;
  
  if (taxableIncome <= 0) return 0;
  
  let tax = 0;
  
  // Apply slabs
  if (taxableIncome <= 300000) {
    tax = 0;
  } else if (taxableIncome <= 600000) {
    tax = (taxableIncome - 300000) * 0.05;
  } else if (taxableIncome <= 900000) {
    tax = (300000 * 0.05) + ((taxableIncome - 600000) * 0.10);
  } else if (taxableIncome <= 1200000) {
    tax = (300000 * 0.05) + (300000 * 0.10) + ((taxableIncome - 900000) * 0.15);
  } else if (taxableIncome <= 1500000) {
    tax = (300000 * 0.05) + (300000 * 0.10) + (300000 * 0.15) + ((taxableIncome - 1200000) * 0.20);
  } else {
    tax = (300000 * 0.05) + (300000 * 0.10) + (300000 * 0.15) + (300000 * 0.20) + ((taxableIncome - 1500000) * 0.30);
  }
  
  // Add 4% cess
  tax = tax * 1.04;
  
  // Rebate under Section 87A (if taxable income ≤ ₹7 lakh)
  if (taxableIncome <= 700000) {
    tax = Math.max(0, tax - 25000); // Rebate up to ₹25,000
  }
  
  return Math.round(tax);
}

// Example
const grossAnnual2 = 800000;
const tdsNew = calculateTDS_NewRegime(grossAnnual2);
console.log('TDS (New Regime): ₹' + tdsNew); // ₹22,500 (after rebate)
```

**Monthly TDS Distribution**:
```javascript
function distributeTDSMonthly(annualTDS) {
  // Distribute TDS equally across 12 months
  const monthlyTDS = Math.floor(annualTDS / 12);
  const remainder = annualTDS - (monthlyTDS * 12);
  
  // Add remainder to February (last month of FY)
  const tdsSchedule = Array(12).fill(monthlyTDS);
  tdsSchedule[1] += remainder; // February adjustment
  
  return tdsSchedule;
}

// Example
const annualTDS = 52000;
const monthlySchedule = distributeTDSMonthly(annualTDS);
console.log('Monthly TDS:');
monthlySchedule.forEach((tds, index) => {
  const month = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'][index];
  console.log(`${month}: ₹${tds}`);
});
```

**Validation**:
```javascript
function validateTDS(tds, grossAnnual, regime, exemptions = 0) {
  const expectedTDS = regime === 'old' 
    ? calculateTDS_OldRegime(grossAnnual, exemptions)
    : calculateTDS_NewRegime(grossAnnual);
  
  const tolerance = 1000; // ₹1,000 tolerance
  
  if (Math.abs(tds - expectedTDS) > tolerance) {
    throw new Error(`TDS mismatch (${regime} regime). Expected: ₹${expectedTDS}, Got: ₹${tds}`);
  }
  
  return true;
}
```

**Business Rules**:
- Employee must submit Form 12BB (declarations for exemptions under old regime)
- Employer issues Form 16 (TDS certificate) at end of FY
- TDS deposited monthly to government within 7 days of next month
- Employee can adjust TDS during ITR filing (claim refund or pay additional tax)
- New regime is default; employee must opt for old regime explicitly

---

#### 2.4.11 Net Salary Calculation

**Rule**: Net salary is the take-home pay after all deductions

**Formula**:
```
Net Salary (Monthly) = Gross - (PF + ESI + PT + TDS + Other Deductions)
```

**Calculation Example**:
```javascript
function calculateNetSalary(gross, deductions) {
  const net = gross - (
    deductions.pf +
    deductions.esi +
    deductions.pt +
    deductions.tds +
    (deductions.advance || 0) +
    (deductions.loan || 0) +
    (deductions.others || 0)
  );
  
  return Math.round(net * 100) / 100;
}

// Example
const gross = 48116.67;
const deductions = {
  pf: 1800,
  esi: 0,
  pt: 200,
  tds: 3000,
  advance: 0,
  loan: 0,
  others: 0
};

const net = calculateNetSalary(gross, deductions);
console.log('Gross Salary: ₹' + gross);
console.log('Deductions:');
console.log('  - PF: ₹' + deductions.pf);
console.log('  - ESI: ₹' + deductions.esi);
console.log('  - PT: ₹' + deductions.pt);
console.log('  - TDS: ₹' + deductions.tds);
console.log('Total Deductions: ₹' + (deductions.pf + deductions.esi + deductions.pt + deductions.tds));
console.log('Net Salary (Take-Home): ₹' + net); // ₹43,116.67
```

**Net Salary Validation**:
```javascript
function validateNetSalary(net, gross, totalDeductions) {
  const expectedNet = gross - totalDeductions;
  const tolerance = 5; // ₹5 tolerance
  
  if (Math.abs(net - expectedNet) > tolerance) {
    throw new Error(`Net salary mismatch. Expected: ₹${expectedNet}, Got: ₹${net}`);
  }
  
  // Net should be positive
  if (net < 0) {
    throw new Error('Net salary cannot be negative. Check deductions.');
  }
  
  // Net should be at least 50% of gross (sanity check)
  if (net < gross * 0.50) {
    console.warn('Net salary is less than 50% of gross. Deductions are very high.');
  }
  
  return true;
}
```

**Business Rules**:
- Net salary is the amount credited to employee's bank account
- Net salary should always be positive (deductions cannot exceed gross)
- If deductions exceed gross, carry forward excess to next month or adjust
- Net salary is not the same as CTC (CTC includes employer contributions)
- Typical net-to-CTC ratio: 70-85% (depending on deductions)

**SQL Generated Column**:
```sql
ALTER TABLE employees
ADD COLUMN net DECIMAL(12,2) 
GENERATED ALWAYS AS (
  gross - (
    pf_deduction + esi_deduction + professional_tax + tds_monthly + 
    COALESCE(advance_deduction_pending, 0) + 
    COALESCE(loan_emi_deduction, 0) + 
    COALESCE(other_deductions, 0)
  )
) STORED;
```

---

#### 2.4.12 GST & Professional Fees (For Consultants)

**Rule**: Consultants/freelancers are paid professional fees with 18% GST and 10% TDS

**Applicability**:
- Employment type: 'consultant', 'freelancer', 'contractor'
- GST registration required if turnover > ₹20 lakh/year
- TDS under Section 194J: 10% of professional fees (before GST)

**GST Calculation**:
```javascript
function calculateConsultantPayment(baseFees, isGSTInclusive = false) {
  const GST_RATE = 18; // 18%
  const TDS_RATE = 10; // 10%
  
  let baseFees, gst, totalFees, tds, netPayment;
  
  if (isGSTInclusive) {
    // Total fees include GST
    totalFees = baseFees;
    baseFees = totalFees / 1.18;
    gst = totalFees - baseFees;
  } else {
    // GST is additional
    baseFees = baseFees;
    gst = baseFees * (GST_RATE / 100);
    totalFees = baseFees + gst;
  }
  
  // TDS on base fees (not on GST)
  tds = baseFees * (TDS_RATE / 100);
  
  // Net payment = Total fees - TDS
  netPayment = totalFees - tds;
  
  return {
    baseFees: Math.round(baseFees * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    tds: Math.round(tds * 100) / 100,
    netPayment: Math.round(netPayment * 100) / 100
  };
}

// Example 1: GST exclusive
console.log('GST Exclusive:');
const payment1 = calculateConsultantPayment(100000, false);
console.log('Base Fees: ₹' + payment1.baseFees); // ₹1,00,000
console.log('GST (18%): ₹' + payment1.gst); // ₹18,000
console.log('Total Fees: ₹' + payment1.totalFees); // ₹1,18,000
console.log('TDS (10%): ₹' + payment1.tds); // ₹10,000
console.log('Net Payment: ₹' + payment1.netPayment); // ₹1,08,000

// Example 2: GST inclusive
console.log('\nGST Inclusive:');
const payment2 = calculateConsultantPayment(118000, true);
console.log('Base Fees: ₹' + payment2.baseFees); // ₹1,00,000
console.log('GST (18%): ₹' + payment2.gst); // ₹18,000
console.log('Total Fees: ₹' + payment2.totalFees); // ₹1,18,000
console.log('TDS (10%): ₹' + payment2.tds); // ₹10,000
console.log('Net Payment: ₹' + payment2.netPayment); // ₹1,08,000
```

**Validation**:
```javascript
function validateConsultantPayment(payment, gstApplicable) {
  if (gstApplicable && payment.gst <= 0) {
    throw new Error('GST must be positive when GST is applicable');
  }
  
  if (!gstApplicable && payment.gst > 0) {
    throw new Error('GST must be zero when GST is not applicable');
  }
  
  // GST should be 18% of base fees
  const expectedGST = payment.baseFees * 0.18;
  if (Math.abs(payment.gst - expectedGST) > 10) {
    throw new Error(`GST mismatch. Expected: ₹${expectedGST}, Got: ₹${payment.gst}`);
  }
  
  // TDS should be 10% of base fees
  const expectedTDS = payment.baseFees * 0.10;
  if (Math.abs(payment.tds - expectedTDS) > 10) {
    throw new Error(`TDS mismatch. Expected: ₹${expectedTDS}, Got: ₹${payment.tds}`);
  }
  
  return true;
}
```

**Business Rules**:
- Consultant must provide GST invoice for payment
- Company deducts TDS and remits to government
- Company issues Form 16A (TDS certificate) to consultant
- Consultant files GST returns (monthly/quarterly)
- Consultant claims TDS credit during ITR filing

---

#### 2.4.13 Variable Pay, Bonuses & Incentives

**Rule**: Additional earnings beyond fixed salary components

**Variable Pay**:
- Performance-based annual bonus (typically 10-30% of CTC)
- Paid quarterly or annually based on performance rating
- Fully taxable

```javascript
function calculateVariablePay(ctc, performanceRating) {
  const variablePercentage = {
    'outstanding': 30, // 30% of CTC
    'exceeds': 20, // 20% of CTC
    'meets': 10, // 10% of CTC
    'below': 0 // 0%
  };
  
  const percentage = variablePercentage[performanceRating] || 0;
  const variableAnnual = ctc * (percentage / 100);
  const variableMonthly = variableAnnual / 12;
  
  return {
    annual: Math.round(variableAnnual),
    monthly: Math.round(variableMonthly * 100) / 100,
    percentage
  };
}

// Example
const ctc = 600000;
const rating = 'exceeds';
const variable = calculateVariablePay(ctc, rating);
console.log(`Variable Pay (${rating}): ₹${variable.annual}/year (${variable.percentage}% of CTC)`);
console.log(`Variable Pay Monthly: ₹${variable.monthly}`);
```

**Bonuses**:
- **Festival Bonus**: Diwali, Pongal, etc. (fixed amount, e.g., ₹5,000-₹10,000)
- **Joining Bonus**: Paid on joining or after probation
- **Retention Bonus**: To retain key employees
- **Referral Bonus**: For successful referrals

```javascript
function addBonus(employeeId, bonusType, amount, reason) {
  // Add bonus to employee salary for current month
  db.query(`
    UPDATE employees
    SET bonus_amount = ?,
        bonus_type = ?
    WHERE employee_id = ?
  `, [amount, bonusType, employeeId]);
  
  // Log in career history
  db.query(`
    INSERT INTO career_history (employee_id, change_type, change_details, effective_date)
    VALUES (?, 'bonus', ?, CURRENT_DATE)
  `, [employeeId, JSON.stringify({ type: bonusType, amount, reason })]);
}
```

**Sales Incentives**:
- Commission based on sales/revenue targets
- Calculated monthly or quarterly
- Formula varies by role (% of sales, tiered structure)

```javascript
function calculateSalesIncentive(sales, targets) {
  let incentive = 0;
  
  if (sales < targets.threshold) {
    incentive = 0; // No incentive if below threshold
  } else if (sales >= targets.excellent) {
    incentive = sales * 0.10; // 10% of sales if excellent
  } else if (sales >= targets.good) {
    incentive = sales * 0.07; // 7% of sales if good
  } else {
    incentive = sales * 0.05; // 5% of sales if met threshold
  }
  
  return Math.round(incentive);
}

// Example
const sales = 500000;
const targets = { threshold: 200000, good: 400000, excellent: 600000 };
const incentive = calculateSalesIncentive(sales, targets);
console.log('Sales Incentive: ₹' + incentive); // ₹35,000 (7%)
```

**Business Rules**:
- All bonuses and incentives are fully taxable
- Add to gross salary for TDS calculation
- Paid in the month earned (or next month if processing delay)
- Requires approval from manager/HR

---

#### 2.4.14 Overtime Pay Calculation

**Rule**: Overtime pay for eligible employees working beyond standard hours

**Eligibility**:
- Non-management, hourly employees
- Typically: Production staff, security, support staff
- Not applicable for management/salaried employees

**Overtime Rate**:
- 1.5x regular hourly rate for hours beyond 40/week (or 8/day)
- 2x regular hourly rate for holidays/Sundays

**Calculation**:
```javascript
function calculateOvertimePay(monthlySalary, overtimeHours, rate = 1.5) {
  // Assume 26 working days/month, 8 hours/day
  const hoursPerMonth = 26 * 8; // 208 hours
  const hourlyRate = monthlySalary / hoursPerMonth;
  const overtimeRate = hourlyRate * rate;
  const overtimePay = overtimeHours * overtimeRate;
  
  return Math.round(overtimePay * 100) / 100;
}

// Example
const monthlySalary = 30000;
const overtimeHours = 10;
const overtimePay = calculateOvertimePay(monthlySalary, overtimeHours, 1.5);
console.log('Monthly Salary: ₹' + monthlySalary);
console.log('Overtime Hours: ' + overtimeHours);
console.log('Overtime Pay: ₹' + overtimePay); // ₹2,163
```

**Validation**:
```javascript
function validateOvertimePay(overtimePay, monthlySalary, overtimeHours) {
  const expectedPay = calculateOvertimePay(monthlySalary, overtimeHours);
  const tolerance = 50; // ₹50 tolerance
  
  if (Math.abs(overtimePay - expectedPay) > tolerance) {
    throw new Error(`Overtime pay mismatch. Expected: ₹${expectedPay}, Got: ₹${overtimePay}`);
  }
  
  // Overtime should not exceed 50 hours/month (sanity check)
  if (overtimeHours > 50) {
    console.warn('Overtime hours exceed 50/month. Review work hours policy.');
  }
  
  return true;
}
```

**Business Rules**:
- Overtime must be pre-approved by manager
- Record overtime hours in attendance system
- Overtime pay is fully taxable
- Add to gross salary for current month

---

#### 2.4.15 Gratuity Calculation

**Rule**: Gratuity is a lump sum payment to employees with 5+ years of continuous service

**Eligibility**:
- Minimum 5 years of continuous service
- Paid on retirement, resignation, death, or disability

**Formula**:
```
Gratuity = (Last drawn basic × 15 days × Years of service) / 26
```

**Calculation**:
```javascript
function calculateGratuity(lastDrawnBasic, yearsOfService) {
  // Eligibility check
  if (yearsOfService < 5) {
    return { eligible: false, amount: 0 };
  }
  
  // Formula: (Basic × 15 × Years) / 26
  const gratuity = (lastDrawnBasic * 15 * yearsOfService) / 26;
  
  // Maximum gratuity: ₹20 lakh (as per Payment of Gratuity Act)
  const maxGratuity = 2000000;
  const finalGratuity = Math.min(gratuity, maxGratuity);
  
  return {
    eligible: true,
    amount: Math.round(finalGratuity),
    taxExempt: finalGratuity, // Fully exempt up to ₹20 lakh
    taxable: gratuity > maxGratuity ? gratuity - maxGratuity : 0
  };
}

// Example 1: 7 years of service
const gratuity1 = calculateGratuity(30000, 7);
console.log('Gratuity (7 years, Basic ₹30,000):');
console.log('  Eligible: ' + gratuity1.eligible); // true
console.log('  Amount: ₹' + gratuity1.amount); // ₹1,21,154
console.log('  Tax Exempt: ₹' + gratuity1.taxExempt); // ₹1,21,154
console.log('  Taxable: ₹' + gratuity1.taxable); // ₹0

// Example 2: 3 years of service (not eligible)
const gratuity2 = calculateGratuity(25000, 3);
console.log('\nGratuity (3 years, Basic ₹25,000):');
console.log('  Eligible: ' + gratuity2.eligible); // false
console.log('  Amount: ₹' + gratuity2.amount); // ₹0
```

**Business Rules**:
- Governed by Payment of Gratuity Act, 1972
- 26 working days per month (standard)
- Applicable to companies with 10+ employees
- Tax exempt up to ₹20 lakh (under Section 10(10))
- Paid within 30 days of exit

---

#### 2.4.16 Leave Encashment Calculation

**Rule**: Encash unused leave on exit or annually (as per company policy)

**Formula**:
```
Leave Encashment = Unused Leave Days × (Monthly Basic / 26)
```

**Calculation**:
```javascript
function calculateLeaveEncashment(unusedLeaveDays, monthlyBasic, maxEncashment = 30) {
  // Limit encashment to max days (e.g., 30 days)
  const encashableDays = Math.min(unusedLeaveDays, maxEncashment);
  
  // Calculate encashment amount
  const dailyRate = monthlyBasic / 26;
  const encashmentAmount = encashableDays * dailyRate;
  
  return {
    unusedDays: unusedLeaveDays,
    encashableDays,
    dailyRate: Math.round(dailyRate * 100) / 100,
    amount: Math.round(encashmentAmount * 100) / 100
  };
}

// Example
const unusedLeaves = 25;
const monthlyBasic = 30000;
const encashment = calculateLeaveEncashment(unusedLeaves, monthlyBasic, 30);
console.log('Leave Encashment:');
console.log('  Unused Leaves: ' + encashment.unusedDays + ' days');
console.log('  Encashable Leaves: ' + encashment.encashableDays + ' days');
console.log('  Daily Rate: ₹' + encashment.dailyRate);
console.log('  Encashment Amount: ₹' + encashment.amount); // ₹28,846
```

**Business Rules**:
- Policy-driven (30 days max encashment is common)
- Paid during final settlement (exit) or annually
- Tax treatment: ₹3 lakh exempt on retirement, fully taxable otherwise
- Unused leave balance reset or carried forward (as per policy)

---

#### 2.4.17 Arrears & Adjustments

**Rule**: Handle pending arrears from backdated increments and salary adjustments

**Arrears Calculation**:
```javascript
function calculateArrears(oldSalary, newSalary, effectiveDate) {
  const currentDate = new Date();
  const effective = new Date(effectiveDate);
  
  // Calculate months between effective date and current date
  const monthsDiff = (currentDate.getFullYear() - effective.getFullYear()) * 12 +
                     (currentDate.getMonth() - effective.getMonth());
  
  // Arrears = (New Salary - Old Salary) × Months
  const monthlydifference = newSalary - oldSalary;
  const arrears = monthlydifference * monthsDiff;
  
  return {
    months: monthsDiff,
    monthlyDifference: Math.round(monthlydifference * 100) / 100,
    totalArrears: Math.round(arrears * 100) / 100
  };
}

// Example: Increment effective from 3 months ago
const oldSalary = 40000;
const newSalary = 45000;
const effectiveDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 3 months ago

const arrears = calculateArrears(oldSalary, newSalary, effectiveDate);
console.log('Arrears Calculation:');
console.log('  Old Salary: ₹' + oldSalary);
console.log('  New Salary: ₹' + newSalary);
console.log('  Months: ' + arrears.months);
console.log('  Monthly Difference: ₹' + arrears.monthlyDifference); // ₹5,000
console.log('  Total Arrears: ₹' + arrears.totalArrears); // ₹15,000
```

**Advance Recovery**:
```javascript
function calculateAdvanceRecovery(advanceAmount, installments) {
  const monthlyDeduction = Math.ceil(advanceAmount / installments);
  
  return {
    totalAdvance: advanceAmount,
    installments,
    monthlyDeduction,
    totalRecovered: monthlyDeduction * installments
  };
}

// Example
const advanceAmount = 50000;
const installments = 10;
const recovery = calculateAdvanceRecovery(advanceAmount, installments);
console.log('Advance Recovery:');
console.log('  Total Advance: ₹' + recovery.totalAdvance);
console.log('  Installments: ' + recovery.installments);
console.log('  Monthly Deduction: ₹' + recovery.monthlyDeduction); // ₹5,000
```

**Business Rules**:
- Arrears are taxable in the year received (not spread across previous years)
- Advance recovery should not exceed 30% of net salary
- Loan EMI deduction requires employee consent
- Adjustments tracked in payroll history

---

#### 2.4.18 Salary Hold & Release

**Rule**: Temporarily hold salary for specific reasons (pending documents, notice period, etc.)

**Hold Reasons**:
- Pending joining documents
- Notice period not served
- Disciplinary action
- Advance recovery dispute
- Background verification pending

**Salary Hold Process**:
```javascript
function holdSalary(employeeId, reason) {
  db.query(`
    UPDATE employees
    SET salary_hold = true,
        salary_hold_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = ?
  `, [reason, employeeId]);
  
  // Log in audit
  auditLog('salary_hold', employeeId, { reason, date: new Date() });
}

function releaseSalary(employeeId) {
  db.query(`
    UPDATE employees
    SET salary_hold = false,
        salary_hold_reason = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = ?
  `, [employeeId]);
  
  // Log in audit
  auditLog('salary_release', employeeId, { date: new Date() });
}
```

**Validation**:
```javascript
function validateSalaryHold(employeeId) {
  const employee = db.query(`
    SELECT salary_hold, salary_hold_reason
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  if (employee.salary_hold) {
    throw new Error(`Salary is on hold. Reason: ${employee.salary_hold_reason}`);
  }
  
  return true;
}
```

**Business Rules**:
- Cannot process payroll if salary is on hold
- Notify employee via email when salary is held
- Salary released after issue resolution
- Track hold/release history in audit logs

---

#### 2.4.19 Payment Mode & Bank Integration

**Rule**: Support multiple payment modes with validation

**Payment Modes**:
- **Bank Transfer**: NEFT, IMPS, salary transfer (default, recommended)
- **Cash**: For contract labor, daily wage workers (rare)
- **Cheque**: For consultants, vendors (rare)
- **UPI**: For small amounts, freelancers

**Bank Transfer Validation**:
```javascript
function validateBankTransfer(employeeId) {
  const employee = db.query(`
    SELECT bank_account_id
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  if (!employee.bank_account_id) {
    throw new Error('Bank account not linked. Cannot process bank transfer.');
  }
  
  // Validate bank account is verified
  const bankAccount = db.query(`
    SELECT verification_status
    FROM bank_details
    WHERE id = ?
  `, [employee.bank_account_id]);
  
  if (bankAccount.verification_status !== 'verified') {
    throw new Error('Bank account not verified. Cannot process bank transfer.');
  }
  
  return true;
}
```

**Payment File Generation** (for bulk salary transfer):
```javascript
function generateSalaryPaymentFile(month, year) {
  const employees = db.query(`
    SELECT e.employee_id, e.full_name, e.net, b.account_number, b.ifsc_code
    FROM employees e
    JOIN bank_details b ON e.bank_account_id = b.id
    WHERE e.status = 'active'
      AND e.salary_hold = false
      AND e.payment_mode = 'Bank'
      AND e.payroll_processed_month = ?
  `, [`${year}-${String(month).padStart(2, '0')}`]);
  
  // Generate CSV for bank upload
  const csv = employees.map(emp => 
    `${emp.account_number},${emp.ifsc_code},${emp.net},${emp.full_name},${emp.employee_id}`
  ).join('\n');
  
  return csv;
}
```

**Business Rules**:
- Bank transfer is mandatory for permanent employees
- Verify bank account before first salary credit
- Generate payment file for bulk transfers (NEFT/IMPS)
- Track salary credit date in system
- Notify employees via email/SMS after credit

---

#### 2.4.20 Salary Revision & Increment Tracking

**Rule**: Track salary revisions and increments over time

**Revision Types**:
- **Annual Increment**: Yearly performance-based increase
- **Promotion**: Designation change with salary increase
- **Market Correction**: Adjust salary to match market rates
- **Retention**: Special increment to retain key employees

**Increment Calculation**:
```javascript
function calculateIncrement(currentCTC, incrementPercentage) {
  const incrementAmount = currentCTC * (incrementPercentage / 100);
  const newCTC = currentCTC + incrementAmount;
  
  return {
    currentCTC,
    incrementPercentage,
    incrementAmount: Math.round(incrementAmount),
    newCTC: Math.round(newCTC)
  };
}

// Example
const currentCTC = 600000;
const incrementPercentage = 10; // 10% increment
const increment = calculateIncrement(currentCTC, incrementPercentage);
console.log('Salary Increment:');
console.log('  Current CTC: ₹' + increment.currentCTC);
console.log('  Increment %: ' + increment.incrementPercentage + '%');
console.log('  Increment Amount: ₹' + increment.incrementAmount); // ₹60,000
console.log('  New CTC: ₹' + increment.newCTC); // ₹6,60,000
```

**Revision Process**:
```javascript
function processSalaryRevision(employeeId, newCTC, effectiveDate, revisionType, reason) {
  // Get current salary
  const currentSalary = db.query(`
    SELECT ctc FROM employees WHERE employee_id = ?
  `, [employeeId]);
  
  // Calculate increment percentage
  const incrementPercentage = ((newCTC - currentSalary.ctc) / currentSalary.ctc) * 100;
  
  // Update salary components
  recalculateSalaryComponents(employeeId, newCTC);
  
  // Update revision tracking fields
  db.query(`
    UPDATE employees
    SET ctc = ?,
        last_salary_revision_date = ?,
        next_salary_revision_date = DATE_ADD(?, INTERVAL 1 YEAR)
    WHERE employee_id = ?
  `, [newCTC, effectiveDate, effectiveDate, employeeId]);
  
  // Log in career history
  db.query(`
    INSERT INTO career_history (employee_id, change_type, change_details, effective_date)
    VALUES (?, 'salary_revision', ?, ?)
  `, [employeeId, JSON.stringify({
    oldCTC: currentSalary.ctc,
    newCTC,
    incrementPercentage,
    revisionType,
    reason
  }), effectiveDate]);
  
  // Calculate arrears if backdated
  if (new Date(effectiveDate) < new Date()) {
    const arrears = calculateArrears(currentSalary.ctc / 12, newCTC / 12, effectiveDate);
    db.query(`
      UPDATE employees
      SET arrears_pending = ?
      WHERE employee_id = ?
    `, [arrears.totalArrears, employeeId]);
  }
}
```

**Business Rules**:
- Annual increment cycle typically in April or January
- Promotion increments are immediate (no wait for annual cycle)
- Track next_salary_revision_date for planning
- Generate arrears if increment is backdated
- Notify employee via email with revised salary structure

---

### 2.7 Employee CRUD Operations
**Rule**: Specific rules for Create, Read, Update, Delete operations

**Create Employee**:
1. Validate all required fields
2. Auto-generate employee ID (sequential)
3. Auto-generate official email (handle duplicates)
4. Calculate salary components from CTC
5. Set default status = 'active'
6. Set default probation_period = 6
7. Log creation in audit_logs
8. Return created employee with generated ID and email

**Read Employee**:
- By ID: Direct lookup by employee.id
- List: Support filters (status, department, designation, type)
- Pagination: Default 50 per page, max 500
- Search: By name, email, employee ID
- Authorization: HR/Admin see all, Managers see team, Employees see self

**Update Employee**:
1. Validate employee exists
2. Validate changed fields
3. If name changed, regenerate official_email (handle conflicts)
4. If salary changed, recalculate all components
5. If reporting_manager changed, check circular reference
6. Update updated_at timestamp
7. Log changes in audit_logs (before/after values)
8. If salary changed, create career_history entry

**Delete Employee**:
- Hard delete not allowed if payroll records exist
- Soft delete: Set status = 'inactive'
- Retain all historical data
- Remove from active pay runs
- Log deletion in audit_logs

---

### 2.8 Salary Annexure Generation & Management
**Rule**: Auto-generate and manage detailed salary breakdown documents for employees with historical accuracy and compliance

**Purpose**: Provide employees with transparent salary breakdown documents for onboarding, annual reviews, salary revisions, loan applications, and compliance requirements. Maintain historical snapshots for audit and legal purposes.

---

#### 2.8.1 Annexure Structure & Template Design

**Rule**: Standardized salary annexure format with comprehensive CTC breakdown

**Annexure Template Structure**:
```javascript
const SALARY_ANNEXURE_TEMPLATE = {
  header: {
    companyName: 'EcoVale HR Solutions Pvt Ltd',
    companyAddress: 'Bangalore, Karnataka, India',
    companyLogo: 'base64_encoded_logo',
    documentTitle: 'SALARY ANNEXURE',
    generatedDate: 'current_date',
    annexureNumber: 'ANN-{employee_id}-{timestamp}'
  },
  employeeDetails: {
    employeeId: 'employee_id',
    fullName: 'first_name middle_name last_name',
    designation: 'designation_title',
    department: 'department_name',
    joinDate: 'join_date',
    workLocation: 'work_location',
    employmentType: 'employment_type',
    bankAccount: 'masked_account_number'
  },
  ctcBreakdown: {
    annualCTC: 'total_annual_ctc',
    monthlyCTC: 'ctc / 12',
    components: [
      { name: 'Basic Salary', monthly: 'basic_salary', annual: 'basic_salary × 12', percentage: 'basic / gross × 100' },
      { name: 'House Rent Allowance (HRA)', monthly: 'hra', annual: 'hra × 12', percentage: 'hra / gross × 100' },
      { name: 'Conveyance Allowance', monthly: 'conveyance_allowance', annual: 'conveyance × 12', percentage: 'conveyance / gross × 100' },
      { name: 'Medical Allowance', monthly: 'medical_allowance', annual: 'medical × 12', percentage: 'medical / gross × 100' },
      { name: 'Special Allowance', monthly: 'special_allowance', annual: 'special × 12', percentage: 'special / gross × 100' },
      { name: 'Gross Salary', monthly: 'gross_salary', annual: 'gross × 12', isBold: true },
      { name: 'Employer PF Contribution', monthly: 'employer_pf', annual: 'employer_pf × 12', note: '12% of Basic (max ₹15,000)' },
      { name: 'Employer ESI Contribution', monthly: 'employer_esi', annual: 'employer_esi × 12', note: '3.25% of Gross (if Gross ≤ ₹21,000)' },
      { name: 'Gratuity Provision', monthly: 'gratuity / 12', annual: 'gratuity', note: '4.81% of Annual Basic' },
      { name: 'Total Cost to Company (CTC)', monthly: 'ctc / 12', annual: 'ctc', isBold: true, isTotal: true }
    ]
  },
  deductions: {
    title: 'Monthly Deductions from Gross Salary',
    items: [
      { name: 'Employee PF (12%)', amount: 'employee_pf', calculation: '12% of Basic (max ₹15,000)' },
      { name: 'Employee ESI (0.75%)', amount: 'employee_esi', calculation: '0.75% of Gross (if Gross ≤ ₹21,000)' },
      { name: 'Professional Tax', amount: 'professional_tax', calculation: 'State-specific (₹200 if Gross > ₹25,000)' },
      { name: 'TDS (if applicable)', amount: 'tds', calculation: 'As per Income Tax Act' },
      { name: 'Total Deductions', amount: 'total_deductions', isBold: true }
    ]
  },
  netSalary: {
    calculation: 'gross_salary - total_deductions',
    monthly: 'net_salary',
    annual: 'net_salary × 12',
    inWords: 'number_to_words(net_salary)'
  },
  footer: {
    notes: [
      'This salary structure is confidential and for the employee only.',
      'Actual take-home salary may vary based on attendance, leaves, and deductions.',
      'PF and ESI contributions are as per statutory requirements.',
      'Professional Tax is state-specific and subject to change.',
      'TDS is calculated as per prevailing Income Tax slabs and regime chosen.'
    ],
    signature: {
      authorized_by: 'HR Manager / Admin',
      signature_date: 'generated_date',
      digital_signature: 'optional_digital_signature_hash'
    }
  }
};
```

**Template Rendering**:
```javascript
function renderSalaryAnnexure(employeeId) {
  // Fetch employee and salary data
  const employee = await db.query(`
    SELECT e.employee_id, e.first_name, e.middle_name, e.last_name,
           e.designation_id, e.department_id, e.join_date, e.work_location, e.employment_type,
           e.salary_ctc, e.basic_salary, e.hra, e.conveyance_allowance, e.medical_allowance,
           e.special_allowance, e.gross_salary, e.employer_pf, e.employer_esi, e.gratuity,
           e.employee_pf, e.employee_esi, e.professional_tax, e.tds, e.net_salary,
           d.title as designation_title, dep.name as department_name,
           b.masked_account_number
    FROM employees e
    LEFT JOIN designations d ON e.designation_id = d.id
    LEFT JOIN departments dep ON e.department_id = dep.id
    LEFT JOIN bank_details b ON e.employee_id = b.employee_id AND b.is_primary = true
    WHERE e.employee_id = ?
  `, [employeeId]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Build salary breakdown
  const breakdown = {
    basic: {
      monthly: employee.basic_salary,
      annual: employee.basic_salary * 12,
      percentage: ((employee.basic_salary / employee.gross_salary) * 100).toFixed(2)
    },
    hra: {
      monthly: employee.hra,
      annual: employee.hra * 12,
      percentage: ((employee.hra / employee.gross_salary) * 100).toFixed(2)
    },
    conveyance: {
      monthly: employee.conveyance_allowance,
      annual: employee.conveyance_allowance * 12,
      percentage: ((employee.conveyance_allowance / employee.gross_salary) * 100).toFixed(2)
    },
    medical: {
      monthly: employee.medical_allowance,
      annual: employee.medical_allowance * 12,
      percentage: ((employee.medical_allowance / employee.gross_salary) * 100).toFixed(2)
    },
    special: {
      monthly: employee.special_allowance,
      annual: employee.special_allowance * 12,
      percentage: ((employee.special_allowance / employee.gross_salary) * 100).toFixed(2)
    },
    gross: {
      monthly: employee.gross_salary,
      annual: employee.gross_salary * 12
    },
    employerPF: {
      monthly: employee.employer_pf,
      annual: employee.employer_pf * 12
    },
    employerESI: {
      monthly: employee.employer_esi,
      annual: employee.employer_esi * 12
    },
    gratuity: {
      monthly: (employee.gratuity / 12).toFixed(2),
      annual: employee.gratuity
    },
    ctc: {
      monthly: (employee.salary_ctc / 12).toFixed(2),
      annual: employee.salary_ctc
    }
  };
  
  const deductions = {
    employeePF: employee.employee_pf,
    employeeESI: employee.employee_esi,
    professionalTax: employee.professional_tax,
    tds: employee.tds,
    total: employee.employee_pf + employee.employee_esi + employee.professional_tax + employee.tds
  };
  
  const netSalary = {
    monthly: employee.net_salary,
    annual: employee.net_salary * 12,
    inWords: numberToWords(employee.net_salary)
  };
  
  // Generate HTML template
  const html = generateAnnexureHTML({
    employee,
    breakdown,
    deductions,
    netSalary,
    generatedDate: new Date().toLocaleDateString('en-IN'),
    annexureNumber: `ANN-${employee.employee_id}-${Date.now()}`
  });
  
  return html;
}

// Number to words converter
function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  // Implementation for converting numbers to words (Indian numbering system)
  // Rupees + Lakhs + Thousands + Hundreds + Tens + Ones + Paise
  
  return `${words} Rupees Only`;
}
```

**Business Rules**:
- Standard template format for all employees
- Include company logo and letterhead
- Display both monthly and annual figures
- Show percentage breakdown of components
- Include notes about PF, ESI, PT, TDS calculations
- Display net salary in words (Indian numbering system)
- Watermark document as "Confidential"
- Footer with authorized signature

---

#### 2.8.2 Auto-Generation Triggers & Scenarios

**Rule**: Automatically generate salary annexure at key lifecycle events

**Trigger Scenarios**:
```javascript
const ANNEXURE_GENERATION_TRIGGERS = {
  'onboarding': {
    trigger: 'Employee joins company',
    event: 'employee_status_change',
    condition: 'status = "active" OR status = "confirmed"',
    timing: 'immediately_after_salary_setup',
    purpose: 'Provide joining kit document',
    automatic: true
  },
  'salary_revision': {
    trigger: 'Salary increment or revision',
    event: 'career_history_insert',
    condition: 'event_type IN ("annual_increment", "promotion", "salary_revision")',
    timing: 'after_approval',
    purpose: 'Document new salary structure',
    automatic: true
  },
  'annual_review': {
    trigger: 'Yearly salary review',
    event: 'scheduled_cron',
    condition: 'annual_review_month',
    timing: 'first_day_of_review_month',
    purpose: 'Annual documentation',
    automatic: true
  },
  'employee_request': {
    trigger: 'Employee self-service request',
    event: 'manual_request',
    condition: 'employee_portal_action',
    timing: 'on_demand',
    purpose: 'Loan application, visa, personal records',
    automatic: false
  },
  'hr_request': {
    trigger: 'HR/Admin manual generation',
    event: 'admin_action',
    condition: 'admin_portal_action',
    timing: 'on_demand',
    purpose: 'Compliance, audit, verification',
    automatic: false
  }
};

// Onboarding trigger
async function onEmployeeOnboarding(employeeId) {
  // Check if employee has complete salary setup
  const employee = await db.query(`
    SELECT employee_id, salary_ctc, gross_salary, net_salary, employment_status
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  if (!employee.salary_ctc || employee.salary_ctc === 0) {
    console.log('Skipping annexure generation: Salary not set');
    return;
  }
  
  if (employee.employment_status !== 'active' && employee.employment_status !== 'confirmed') {
    console.log('Skipping annexure generation: Employee not active');
    return;
  }
  
  // Generate annexure
  await generateAndStoreSalaryAnnexure(employeeId, 'onboarding');
}

// Salary revision trigger
async function onSalaryRevision(careerHistoryEventId) {
  const event = await db.query(`
    SELECT employee_id, event_type, new_salary_ctc, approval_status
    FROM career_history
    WHERE id = ? AND approval_status = 'approved'
  `, [careerHistoryEventId]);
  
  if (!event) {
    return; // Not approved yet
  }
  
  if (!['annual_increment', 'promotion', 'salary_revision'].includes(event.event_type)) {
    return; // Not a salary change event
  }
  
  // Generate new annexure with revised salary
  await generateAndStoreSalaryAnnexure(event.employee_id, 'salary_revision', {
    careerEventId: careerHistoryEventId,
    newCTC: event.new_salary_ctc
  });
}

// Manual request (employee self-service)
async function employeeRequestAnnexure(employeeId, requestedBy, reason) {
  // Validate requester is the employee or authorized HR
  const employee = await db.query(`
    SELECT employee_id FROM employees WHERE employee_id = ?
  `, [employeeId]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  if (requestedBy !== employeeId && !isHROrAdmin(requestedBy)) {
    throw new Error('Unauthorized: You can only request your own salary annexure');
  }
  
  // Generate annexure
  const annexureId = await generateAndStoreSalaryAnnexure(employeeId, 'employee_request', {
    requestedBy,
    reason
  });
  
  // Log request
  await db.query(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (?, 'annexure_requested', 'salary_annexures', ?, ?)
  `, [requestedBy, annexureId, JSON.stringify({ reason })]);
  
  return annexureId;
}
```

**Business Rules**:
- Auto-generate on employee onboarding (after salary setup)
- Auto-generate on salary revision (increment, promotion)
- Auto-generate annually on review month
- Allow employee self-service requests (download current annexure)
- Allow HR/Admin to generate on-demand
- Track generation reason and requester in audit log

---

#### 2.8.3 PDF Generation & Document Storage

**Rule**: Generate professional PDF documents and store with versioning

**PDF Generation** (using Puppeteer or PDFKit):
```javascript
const puppeteer = require('puppeteer');

async function generateAnnexurePDF(employeeId) {
  // Render HTML template
  const html = await renderSalaryAnnexure(employeeId);
  
  // Launch headless browser
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set content
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  // Generate PDF
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    },
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 10px; text-align: center; width: 100%;">
        <img src="company_logo" style="height: 30px;" />
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 9px; text-align: center; width: 100%; color: #666;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span> | 
        Generated on ${new Date().toLocaleDateString('en-IN')} | 
        Confidential Document
      </div>
    `
  });
  
  await browser.close();
  
  return pdfBuffer;
}

// Alternative: Generate using PDFKit (server-side)
const PDFDocument = require('pdfkit');

async function generateAnnexurePDFKit(employeeId, salaryData) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const buffers = [];
  
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    return pdfData;
  });
  
  // Header
  doc.fontSize(20).text('SALARY ANNEXURE', { align: 'center' });
  doc.moveDown();
  
  // Employee details
  doc.fontSize(12).text(`Employee ID: ${salaryData.employee_id}`);
  doc.text(`Name: ${salaryData.full_name}`);
  doc.text(`Designation: ${salaryData.designation}`);
  doc.moveDown();
  
  // CTC Table
  doc.fontSize(14).text('Cost to Company (CTC) Breakdown', { underline: true });
  doc.moveDown();
  
  // Table header
  doc.fontSize(10);
  const tableTop = doc.y;
  const col1 = 50, col2 = 250, col3 = 350, col4 = 450;
  
  doc.text('Component', col1, tableTop);
  doc.text('Monthly', col2, tableTop);
  doc.text('Annual', col3, tableTop);
  doc.text('%', col4, tableTop);
  
  // Table rows (loop through components)
  // ... (add all salary components)
  
  // Footer
  doc.moveDown(3);
  doc.fontSize(8).text('This is a system-generated document and does not require a signature.', { align: 'center' });
  
  doc.end();
}
```

**Store Annexure**:
```javascript
async function generateAndStoreSalaryAnnexure(employeeId, generationType, metadata = {}) {
  // Generate PDF
  const pdfBuffer = await generateAnnexurePDF(employeeId);
  
  // Convert to base64
  const base64Data = pdfBuffer.toString('base64');
  
  // Get employee details
  const employee = await db.query(`
    SELECT employee_id, first_name, last_name, salary_ctc, gross_salary, net_salary,
           basic_salary, hra, employer_pf, employer_esi, employee_pf, employee_esi,
           professional_tax, tds, gratuity
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  // Create salary snapshot
  const salarySnapshot = {
    employee_id: employee.employee_id,
    ctc: employee.salary_ctc,
    gross: employee.gross_salary,
    net: employee.net_salary,
    basic: employee.basic_salary,
    hra: employee.hra,
    employer_pf: employee.employer_pf,
    employer_esi: employee.employer_esi,
    employee_pf: employee.employee_pf,
    employee_esi: employee.employee_esi,
    professional_tax: employee.professional_tax,
    tds: employee.tds,
    gratuity: employee.gratuity,
    snapshot_date: new Date().toISOString()
  };
  
  // Generate filename
  const timestamp = Date.now();
  const fileName = `SalaryAnnexure_${employee.employee_id}_${employee.first_name}_${employee.last_name}_${timestamp}.pdf`;
  
  // Insert into database
  const annexureId = await db.query(`
    INSERT INTO salary_annexures (
      employee_id, file_name, file_data, salary_snapshot,
      generation_type, generated_by, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `, [
    employeeId,
    fileName,
    base64Data,
    JSON.stringify(salarySnapshot),
    generationType,
    metadata.requestedBy || 'system',
    JSON.stringify(metadata)
  ]);
  
  // Link to career history event (if applicable)
  if (metadata.careerEventId) {
    await db.query(`
      UPDATE career_history
      SET document_ids = array_append(document_ids, ?)
      WHERE id = ?
    `, [annexureId, metadata.careerEventId]);
  }
  
  return annexureId;
}
```

**Business Rules**:
- Generate PDF using professional template
- Store as base64 in database
- Generate unique filename with timestamp
- Include salary snapshot (JSON) for historical accuracy
- Link to career history event (if salary revision)
- Support A4 format with company letterhead
- Include page numbers and footer

---

#### 2.8.4 Historical Snapshots & Version Control

**Rule**: Maintain complete history of all salary structures with snapshots

**Salary Snapshot Structure**:
```javascript
const SALARY_SNAPSHOT_SCHEMA = {
  employee_id: 'VARCHAR(20)',
  snapshot_date: 'ISO8601 timestamp',
  ctc: 'Decimal(10,2)',
  gross: 'Decimal(10,2)',
  net: 'Decimal(10,2)',
  basic: 'Decimal(10,2)',
  hra: 'Decimal(10,2)',
  conveyance: 'Decimal(10,2)',
  medical: 'Decimal(10,2)',
  special_allowance: 'Decimal(10,2)',
  employer_pf: 'Decimal(10,2)',
  employer_esi: 'Decimal(10,2)',
  employee_pf: 'Decimal(10,2)',
  employee_esi: 'Decimal(10,2)',
  professional_tax: 'Decimal(10,2)',
  tds: 'Decimal(10,2)',
  gratuity: 'Decimal(10,2)',
  designation: 'String',
  department: 'String',
  work_location: 'String',
  metadata: {
    generation_type: 'onboarding | salary_revision | annual_review | employee_request',
    career_event_id: 'UUID (if applicable)',
    reason: 'String',
    requested_by: 'User ID'
  }
};
```

**Query Salary History**:
```javascript
async function getSalaryAnnexureHistory(employeeId) {
  const history = await db.query(`
    SELECT id, file_name, generated_at, generation_type,
           salary_snapshot->>'ctc' as ctc,
           salary_snapshot->>'gross' as gross,
           salary_snapshot->>'net' as net,
           salary_snapshot->>'designation' as designation
    FROM salary_annexures
    WHERE employee_id = ?
    ORDER BY generated_at DESC
  `, [employeeId]);
  
  return history;
}

// Compare salary changes over time
async function compareSalarySnapshots(annexureId1, annexureId2) {
  const [snapshot1, snapshot2] = await Promise.all([
    db.query(`SELECT salary_snapshot FROM salary_annexures WHERE id = ?`, [annexureId1]),
    db.query(`SELECT salary_snapshot FROM salary_annexures WHERE id = ?`, [annexureId2])
  ]);
  
  const salary1 = JSON.parse(snapshot1.salary_snapshot);
  const salary2 = JSON.parse(snapshot2.salary_snapshot);
  
  const comparison = {
    ctc: {
      old: salary1.ctc,
      new: salary2.ctc,
      change: salary2.ctc - salary1.ctc,
      changePercent: ((salary2.ctc - salary1.ctc) / salary1.ctc * 100).toFixed(2)
    },
    gross: {
      old: salary1.gross,
      new: salary2.gross,
      change: salary2.gross - salary1.gross,
      changePercent: ((salary2.gross - salary1.gross) / salary1.gross * 100).toFixed(2)
    },
    net: {
      old: salary1.net,
      new: salary2.net,
      change: salary2.net - salary1.net,
      changePercent: ((salary2.net - salary1.net) / salary1.net * 100).toFixed(2)
    }
  };
  
  return comparison;
}

// Get latest annexure
async function getLatestAnnexure(employeeId) {
  const latest = await db.query(`
    SELECT id, file_name, file_data, generated_at, salary_snapshot
    FROM salary_annexures
    WHERE employee_id = ?
    ORDER BY generated_at DESC
    LIMIT 1
  `, [employeeId]);
  
  return latest;
}

// Get annexure valid at specific date (historical lookup)
async function getAnnexureAtDate(employeeId, date) {
  const annexure = await db.query(`
    SELECT id, file_name, file_data, generated_at, salary_snapshot
    FROM salary_annexures
    WHERE employee_id = ?
      AND generated_at <= ?
    ORDER BY generated_at DESC
    LIMIT 1
  `, [employeeId, date]);
  
  return annexure;
}
```

**Business Rules**:
- Every annexure includes complete salary snapshot (JSON)
- Never delete or modify historical annexures
- Snapshots capture salary at generation time
- Support salary history comparison
- Query latest annexure or historical annexure by date
- Snapshots are immutable (audit trail)

---

#### 2.8.5 Employee Self-Service Download

**Rule**: Allow employees to download their current salary annexure via portal

**Download Endpoint**:
```javascript
async function downloadSalaryAnnexure(employeeId, requestedBy) {
  // Authorization check
  if (requestedBy !== employeeId && !isHROrAdmin(requestedBy)) {
    throw new Error('Unauthorized: You can only download your own salary annexure');
  }
  
  // Get latest annexure
  const annexure = await getLatestAnnexure(employeeId);
  
  if (!annexure) {
    // Generate new annexure if none exists
    const newAnnexureId = await generateAndStoreSalaryAnnexure(employeeId, 'employee_request', {
      requestedBy,
      reason: 'First-time download'
    });
    
    annexure = await db.query(`
      SELECT id, file_name, file_data FROM salary_annexures WHERE id = ?
    `, [newAnnexureId]);
  }
  
  // Decode base64 to buffer
  const pdfBuffer = Buffer.from(annexure.file_data, 'base64');
  
  // Log download
  await db.query(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (?, 'annexure_downloaded', 'salary_annexures', ?, ?)
  `, [requestedBy, annexure.id, JSON.stringify({ fileName: annexure.file_name })]);
  
  return {
    buffer: pdfBuffer,
    fileName: annexure.file_name,
    mimeType: 'application/pdf'
  };
}

// Express.js route example
app.get('/api/employees/:employeeId/salary-annexure/download', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const requestedBy = req.user.id; // From JWT token
    
    const { buffer, fileName, mimeType } = await downloadSalaryAnnexure(employeeId, requestedBy);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
    
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// React component example
function DownloadAnnexureButton({ employeeId }) {
  async function handleDownload() {
    try {
      const response = await fetch(`/api/employees/${employeeId}/salary-annexure/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SalaryAnnexure_${employeeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      showToast('Salary annexure downloaded successfully', 'success');
      
    } catch (error) {
      showToast('Failed to download annexure', 'error');
    }
  }
  
  return (
    <button onClick={handleDownload}>
      Download Salary Annexure
    </button>
  );
}
```

**Business Rules**:
- Employees can download own annexure only (unless HR/Admin)
- Auto-generate if no annexure exists
- Download as PDF attachment
- Log all downloads in audit log
- Support browser download (Content-Disposition header)

---

#### 2.8.6 Email Delivery & Notifications

**Rule**: Automatically email salary annexure to employees after generation

**Email Notification**:
```javascript
const nodemailer = require('nodemailer');

async function emailSalaryAnnexure(employeeId, annexureId, reason) {
  // Get employee details
  const employee = await db.query(`
    SELECT employee_id, first_name, last_name, official_email, personal_email
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  // Get annexure
  const annexure = await db.query(`
    SELECT file_name, file_data FROM salary_annexures WHERE id = ?
  `, [annexureId]);
  
  // Decode PDF
  const pdfBuffer = Buffer.from(annexure.file_data, 'base64');
  
  // Email configuration
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
  
  // Email content
  const emailBody = `
    Dear ${employee.first_name},
    
    Your salary annexure has been generated. Please find the attached document for your reference.
    
    Reason: ${reason}
    Generated on: ${new Date().toLocaleDateString('en-IN')}
    
    This is a confidential document. Please keep it secure and do not share with unauthorized parties.
    
    If you have any questions about your salary structure, please contact HR.
    
    Best regards,
    EcoVale HR Team
  `;
  
  // Send email
  const mailOptions = {
    from: 'hr@ecovale.com',
    to: employee.official_email,
    cc: employee.personal_email, // Optional: CC personal email
    subject: 'Your Salary Annexure - EcoVale HR',
    text: emailBody,
    attachments: [
      {
        filename: annexure.file_name,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };
  
  await transporter.sendMail(mailOptions);
  
  // Log email sent
  await db.query(`
    UPDATE salary_annexures
    SET email_sent = true,
        email_sent_at = CURRENT_TIMESTAMP,
        email_sent_to = ?
    WHERE id = ?
  `, [employee.official_email, annexureId]);
  
  return { success: true, message: 'Email sent successfully' };
}

// Auto-email after generation
async function generateAndEmailAnnexure(employeeId, reason) {
  const annexureId = await generateAndStoreSalaryAnnexure(employeeId, 'auto_generated', {
    reason
  });
  
  await emailSalaryAnnexure(employeeId, annexureId, reason);
  
  return annexureId;
}
```

**Business Rules**:
- Email annexure to official email (primary)
- CC personal email (optional)
- Attach PDF as email attachment
- Include confidentiality notice
- Track email sent status and timestamp
- Auto-email after onboarding and salary revisions

---

#### 2.8.7 Watermarking & Security

**Rule**: Add watermarks and security features to prevent misuse

**Watermark Implementation**:
```javascript
const { PDFDocument, rgb } = require('pdf-lib');

async function addWatermarkToAnnexure(pdfBuffer, watermarkText = 'CONFIDENTIAL') {
  // Load PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  
  // Add watermark to each page
  pages.forEach(page => {
    const { width, height } = page.getSize();
    
    // Diagonal watermark
    page.drawText(watermarkText, {
      x: width / 2 - 100,
      y: height / 2,
      size: 50,
      color: rgb(0.8, 0.8, 0.8),
      opacity: 0.3,
      rotate: { angle: Math.PI / 4 } // 45 degrees
    });
    
    // Footer watermark
    page.drawText('For Official Use Only - Do Not Share', {
      x: 50,
      y: 20,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.7
    });
    
    // Employee ID watermark (small, in corner)
    page.drawText(`Employee ID: ${employeeId}`, {
      x: width - 150,
      y: 20,
      size: 8,
      color: rgb(0.5, 0.5, 0.5)
    });
  });
  
  // Save modified PDF
  const watermarkedPDF = await pdfDoc.save();
  return watermarkedPDF;
}

// Add password protection
async function addPasswordProtection(pdfBuffer, password) {
  // Use pdf-lib or qpdf to add password
  // Owner password (for editing) and user password (for viewing)
  
  const { exec } = require('child_process');
  const fs = require('fs');
  
  // Save to temp file
  const tempInput = `/tmp/input_${Date.now()}.pdf`;
  const tempOutput = `/tmp/output_${Date.now()}.pdf`;
  fs.writeFileSync(tempInput, pdfBuffer);
  
  // Use qpdf to encrypt
  return new Promise((resolve, reject) => {
    exec(
      `qpdf --encrypt ${password} ${password} 128 -- ${tempInput} ${tempOutput}`,
      (error) => {
        if (error) return reject(error);
        
        const encryptedPDF = fs.readFileSync(tempOutput);
        
        // Clean up temp files
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);
        
        resolve(encryptedPDF);
      }
    );
  });
}
```

**Digital Signature** (Optional):
```javascript
async function addDigitalSignature(pdfBuffer, signerName, signerRole) {
  // Add digital signature metadata
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  
  // Add signature metadata
  pdfDoc.setTitle('Salary Annexure - Digitally Signed');
  pdfDoc.setAuthor('EcoVale HR System');
  pdfDoc.setSubject('Employee Salary Breakdown');
  pdfDoc.setKeywords(['salary', 'annexure', 'confidential', 'official']);
  pdfDoc.setProducer('EcoVale HR Portal');
  pdfDoc.setCreator('Automated System');
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());
  
  // Add signature info in custom metadata
  const customMetadata = {
    signed_by: signerName,
    signed_role: signerRole,
    signed_at: new Date().toISOString(),
    signature_hash: 'SHA256_HASH_HERE' // Actual signature hash
  };
  
  // Save with signature
  const signedPDF = await pdfDoc.save();
  return signedPDF;
}
```

**Business Rules**:
- Add "CONFIDENTIAL" diagonal watermark on all pages
- Add "For Official Use Only" footer
- Include employee ID in corner (audit trail)
- Optional: Password protection for sensitive annexures
- Optional: Digital signature for legal validity
- Track watermark addition in audit log

---

#### 2.8.8 Bulk Generation & Batch Processing

**Rule**: Generate annexures for multiple employees in batch (annual review, onboarding)

**Batch Generation**:
```javascript
async function bulkGenerateAnnexures(employeeIds, reason) {
  const results = {
    success: [],
    failed: [],
    total: employeeIds.length
  };
  
  for (const employeeId of employeeIds) {
    try {
      const annexureId = await generateAndStoreSalaryAnnexure(employeeId, 'bulk_generation', {
        reason,
        batch_id: `BATCH-${Date.now()}`
      });
      
      results.success.push({ employeeId, annexureId });
      
      // Optional: Email to employee
      // await emailSalaryAnnexure(employeeId, annexureId, reason);
      
    } catch (error) {
      results.failed.push({ employeeId, error: error.message });
    }
  }
  
  return results;
}

// Annual review batch
async function generateAnnualReviewAnnexures() {
  // Get all active employees
  const employees = await db.query(`
    SELECT employee_id FROM employees
    WHERE employment_status IN ('active', 'confirmed')
  `);
  
  const employeeIds = employees.map(e => e.employee_id);
  
  const results = await bulkGenerateAnnexures(employeeIds, 'Annual Review 2026');
  
  console.log(`Batch generation complete: ${results.success.length} success, ${results.failed.length} failed`);
  
  return results;
}

// Schedule annual batch generation
const cron = require('node-cron');

cron.schedule('0 0 1 4 *', async () => {
  // Run on April 1st every year (annual review month)
  console.log('Starting annual salary annexure generation...');
  await generateAnnualReviewAnnexures();
});
```

**Progress Tracking**:
```javascript
// For large batches, track progress
async function bulkGenerateWithProgress(employeeIds, reason, progressCallback) {
  let completed = 0;
  
  for (const employeeId of employeeIds) {
    try {
      await generateAndStoreSalaryAnnexure(employeeId, 'bulk_generation', { reason });
      completed++;
      
      // Report progress
      if (progressCallback) {
        progressCallback({
          completed,
          total: employeeIds.length,
          percentage: ((completed / employeeIds.length) * 100).toFixed(2)
        });
      }
      
    } catch (error) {
      console.error(`Failed to generate for ${employeeId}:`, error.message);
    }
  }
}

// Usage with WebSocket progress updates
async function bulkGenerateWithWebSocketProgress(employeeIds, reason, socket) {
  await bulkGenerateWithProgress(employeeIds, reason, (progress) => {
    socket.emit('bulk_generation_progress', progress);
  });
}
```

**Business Rules**:
- Support bulk generation for multiple employees
- Used for annual review, new batch onboarding
- Track success and failure for each employee
- Optional: Email all employees after generation
- Progress tracking for large batches (real-time updates)
- Schedule annual batch generation via cron

---

#### 2.8.9 Compliance & Legal Requirements

**Rule**: Ensure salary annexures meet legal and compliance standards

**Compliance Checklist**:
```javascript
const COMPLIANCE_REQUIREMENTS = {
  'statutory_disclosure': {
    required: true,
    fields: ['PF contribution', 'ESI contribution', 'Professional Tax', 'TDS'],
    description: 'Must show all statutory deductions as per Indian labor laws'
  },
  'transparency': {
    required: true,
    fields: ['CTC breakdown', 'Gross salary', 'Net salary', 'All allowances'],
    description: 'Complete salary breakdown must be visible'
  },
  'accuracy': {
    required: true,
    validation: 'CTC = Gross × 12 + Employer contributions + Gratuity',
    description: 'All calculations must be accurate and verifiable'
  },
  'confidentiality': {
    required: true,
    measures: ['Watermark', 'Access control', 'Audit log'],
    description: 'Salary information must be kept confidential'
  },
  'historical_preservation': {
    required: true,
    retention: '7 years after employee exit',
    description: 'Historical salary records must be preserved for audit'
  },
  'employee_acknowledgment': {
    required: false,
    method: 'Email delivery with read receipt',
    description: 'Employee should acknowledge receipt of annexure'
  }
};

function validateAnnexureCompliance(salaryData) {
  const issues = [];
  
  // Check statutory disclosure
  if (!salaryData.employer_pf || !salaryData.employee_pf) {
    issues.push('Missing PF contribution details');
  }
  
  // Check accuracy
  const calculatedCTC = (salaryData.gross * 12) + 
                        (salaryData.employer_pf * 12) + 
                        (salaryData.employer_esi * 12) + 
                        salaryData.gratuity;
  
  const tolerance = 10; // ±₹10 for rounding
  if (Math.abs(calculatedCTC - salaryData.ctc) > tolerance) {
    issues.push(`CTC calculation mismatch: Expected ${calculatedCTC}, Got ${salaryData.ctc}`);
  }
  
  // Check transparency
  if (!salaryData.basic || !salaryData.hra) {
    issues.push('Missing basic salary components');
  }
  
  return {
    compliant: issues.length === 0,
    issues
  };
}
```

**Audit Trail**:
```javascript
async function getAnnexureAuditTrail(annexureId) {
  const trail = await db.query(`
    SELECT action, user_id, timestamp, details
    FROM audit_logs
    WHERE entity_type = 'salary_annexures'
      AND entity_id = ?
    ORDER BY timestamp ASC
  `, [annexureId]);
  
  return trail;
}

// Track all annexure actions
async function logAnnexureAction(annexureId, action, userId, details) {
  await db.query(`
    INSERT INTO audit_logs (entity_type, entity_id, action, user_id, details)
    VALUES ('salary_annexures', ?, ?, ?, ?)
  `, [annexureId, action, userId, JSON.stringify(details)]);
}
```

**Business Rules**:
- Include all statutory disclosures (PF, ESI, PT, TDS)
- Ensure calculation accuracy with tolerance validation
- Preserve historical annexures for 7 years post-exit
- Maintain complete audit trail (generation, download, email)
- Mark document as confidential
- Optional: Digital signature for legal validity
- Comply with Indian labor laws and tax regulations

---

#### 2.8.10 Analytics & Reporting

**Rule**: Provide HR analytics on salary annexure generation and usage

**Analytics Dashboard**:
```javascript
async function getAnnexureAnalytics(filters = {}) {
  // Total annexures generated
  const totalGenerated = await db.query(`
    SELECT COUNT(*) as count FROM salary_annexures
    WHERE generated_at >= COALESCE(?, '1970-01-01')
  `, [filters.startDate]);
  
  // By generation type
  const byType = await db.query(`
    SELECT generation_type, COUNT(*) as count
    FROM salary_annexures
    WHERE generated_at >= COALESCE(?, '1970-01-01')
    GROUP BY generation_type
  `, [filters.startDate]);
  
  // Most downloaded annexures
  const mostDownloaded = await db.query(`
    SELECT sa.employee_id, e.first_name, e.last_name, COUNT(al.id) as download_count
    FROM salary_annexures sa
    JOIN employees e ON sa.employee_id = e.employee_id
    LEFT JOIN audit_logs al ON al.entity_type = 'salary_annexures' 
                           AND al.entity_id = sa.id 
                           AND al.action = 'annexure_downloaded'
    GROUP BY sa.employee_id, e.first_name, e.last_name
    ORDER BY download_count DESC
    LIMIT 10
  `);
  
  // Employees without annexure
  const withoutAnnexure = await db.query(`
    SELECT e.employee_id, e.first_name, e.last_name, e.join_date
    FROM employees e
    LEFT JOIN salary_annexures sa ON e.employee_id = sa.employee_id
    WHERE e.employment_status IN ('active', 'confirmed')
      AND sa.id IS NULL
  `);
  
  // Average generation time (last 100)
  const avgGenerationTime = await db.query(`
    SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, generated_at)) as avg_seconds
    FROM salary_annexures
    ORDER BY generated_at DESC
    LIMIT 100
  `);
  
  return {
    totalGenerated: totalGenerated.count,
    byType,
    mostDownloaded,
    withoutAnnexure,
    avgGenerationTime: avgGenerationTime.avg_seconds
  };
}

// Export report
async function exportAnnexureReport(startDate, endDate) {
  const data = await db.query(`
    SELECT sa.employee_id, e.first_name, e.last_name, e.designation_id, e.department_id,
           sa.generated_at, sa.generation_type, 
           sa.salary_snapshot->>'ctc' as ctc,
           sa.salary_snapshot->>'net' as net
    FROM salary_annexures sa
    JOIN employees e ON sa.employee_id = e.employee_id
    WHERE sa.generated_at BETWEEN ? AND ?
    ORDER BY sa.generated_at DESC
  `, [startDate, endDate]);
  
  // Convert to CSV
  const csv = convertToCSV(data);
  return csv;
}
```

**Business Rules**:
- Track total annexures generated
- Analytics by generation type (onboarding, revision, request)
- Identify employees without annexure
- Track download statistics
- Monitor generation performance
- Export reports for compliance audits

---

### 2.9 Employee Import/Export
**Rule**: Bulk operations for employee data

**Bulk Import (CSV/Excel)**:
1. Validate file format (CSV, XLSX)
2. Validate all rows before any inserts
3. Check for duplicate employee IDs
4. Check for duplicate official emails
5. Validate all foreign keys (department, designation)
6. Auto-generate IDs if not provided
7. Calculate salary components from CTC
8. Rollback entire import if any row fails
9. Return success count and error list

**Bulk Export**:
- Export all active employees by default
- Support filters (department, designation, status)
- Include all fields or selected fields
- Format: CSV, Excel, JSON
- Mask sensitive data based on user role

---

### 2.9 Employee Search and Filtering
**Rule**: Flexible search capabilities

**Search Fields**:
- Employee ID (exact match)
- Name (first, middle, last - partial match)
- Official email (partial match)
- Personal email (partial match)
- Contact number (partial match)
- Department (exact match or multi-select)
- Designation (exact match or multi-select)
- Status (active/inactive)
- Employment type (full-time/part-time)
- Work location (multi-select)

**Advanced Filters**:
- Join date range (from-to)
- Salary range (CTC from-to)
- Reporting manager (by ID or name)
- Age range (calculated from DOB)
- Tenure range (calculated from join_date)

**Sorting**:
- Default: Employee ID ascending
- Options: Name, Join date, CTC, Department, Designation

---

### 2.10 Employee Uniqueness Constraints
**Rule**: Prevent duplicate employee data

**Unique Fields**:
- Employee ID (PRIMARY KEY)
- Official email (UNIQUE constraint)
- PF number (UNIQUE if not NULL)
- ESI number (UNIQUE if not NULL)

**Duplicate Prevention**:
- Before insert, check all unique fields
- Official email: Auto-increment suffix if duplicate
- Statutory numbers: Reject with error if duplicate
- Error messages: "PF number already exists for employee X"

---

### 2.11 Employee Status Transitions
**Rule**: Valid state transitions for employee status

**Valid Transitions**:
```
new → active (employee onboarding complete)
active → inactive (resignation/termination)
inactive → active (rehire - requires new employee record recommended)
```

**On Status Change**:
- active → inactive:
  - Remove from upcoming pay runs
  - Mark all pending advances/loans as frozen
  - Update reporting relationships (reassign reports to manager's manager)
  - Generate exit documents
  - Log status change with reason
  
- inactive → active:
  - Validate no pending dues
  - Re-enable payroll inclusion
  - Verify all required documents present
  - Send reactivation notifications

---

### 2.12 Employee Data Integrity
**Rule**: Maintain referential integrity and data consistency

**Foreign Key Validation**:
- department_id must reference existing departments.id
- designation_id must reference existing designations.id
- reporting_manager_id must reference existing employees.id
- Designation must belong to specified department

**Cascade Rules**:
- Department deleted: RESTRICT (cannot delete if employees exist)
- Designation deleted: RESTRICT (cannot delete if employees exist)
- Reporting manager deleted: SET NULL (reports have no manager until reassigned)
- Employee deleted: CASCADE delete bank_details, documents, career_history

**Data Consistency Checks**:
- Salary calculations sum correctly
- Status is consistent with payroll records
- Reporting chain has no cycles
- All active employees have valid department and designation

---

### 2.13 Employee Tenure and Age Calculations
**Rule**: Calculate derived fields from dates

**Tenure Calculation**:
```
tenure_years = DATEDIFF(YEAR, join_date, CURRENT_DATE)
tenure_months = DATEDIFF(MONTH, join_date, CURRENT_DATE)
tenure_days = DATEDIFF(DAY, join_date, CURRENT_DATE)
```

**Age Calculation**:
```
age_years = DATEDIFF(YEAR, date_of_birth, CURRENT_DATE)
```

**Validation**:
- Age must be ≥ 18 years (legal working age)
- Join date cannot be in the future
- If date_of_birth provided, employee must be ≥ 18 on join_date

---

### 2.14 Employee Performance & Hierarchy
**Rule**: Support organizational structure queries

**Direct Reports**:
```sql
SELECT * FROM employees 
WHERE reporting_manager_id = '{manager_id}' 
AND status = 'active';
```

**All Subordinates (Recursive)**:
- Use recursive CTE to get entire hierarchy
- Include all levels below manager
- Useful for manager dashboards and approvals

**Reporting Chain (Up to CEO)**:
- Traverse reporting_manager_id upward
- Stop when reporting_manager_id IS NULL
- Useful for approval workflows

---

### 2.5 BankDetails Management Rules
**Rule**: Comprehensive management of employee bank accounts for salary disbursement, verification, security, and compliance

**Purpose**: Define how employee bank accounts are managed including validation, verification, primary account designation, payment processing, failure tracking, and secure access control.

---

#### 2.5.1 IFSC Code Validation & Bank Identification

**Rule**: IFSC (Indian Financial System Code) must be valid 11-character code following RBI format

**IFSC Format**:
- Total length: Exactly 11 characters
- Format: `BBBB0XXXXXX`
  - First 4 characters (BBBB): Bank code (alphabetic, uppercase)
  - 5th character: Always '0' (zero)
  - Last 6 characters (XXXXXX): Branch code (alphanumeric, uppercase)
- Example: `SBIN0001234` (State Bank of India, Branch 001234)

**Validation**:
```javascript
function validateIFSC(ifscCode) {
  // Convert to uppercase
  const ifsc = ifscCode.toUpperCase().trim();
  
  // Length check
  if (ifsc.length !== 11) {
    throw new Error('IFSC code must be exactly 11 characters');
  }
  
  // Format validation: BBBB0XXXXXX
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifsc)) {
    throw new Error('Invalid IFSC code format. Expected: BBBB0XXXXXX (e.g., SBIN0001234)');
  }
  
  // Extract bank code and branch code
  const bankCode = ifsc.substring(0, 4); // e.g., 'SBIN'
  const branchCode = ifsc.substring(5); // e.g., '001234'
  
  return {
    ifsc,
    bankCode,
    branchCode,
    valid: true
  };
}

// Example usage
try {
  const result = validateIFSC('SBIN0001234');
  console.log('Valid IFSC:', result.ifsc);
  console.log('Bank Code:', result.bankCode);
  console.log('Branch Code:', result.branchCode);
} catch (error) {
  console.error('IFSC validation failed:', error.message);
}
```

**Bank Name Lookup** (via IFSC API):
```javascript
async function fetchBankDetailsFromIFSC(ifscCode) {
  // Option 1: Use RazorPay IFSC API (free, no auth required)
  const response = await fetch(`https://ifsc.razorpay.com/${ifscCode}`);
  
  if (!response.ok) {
    throw new Error('IFSC code not found in RBI database');
  }
  
  const data = await response.json();
  
  return {
    ifsc: data.IFSC,
    bankName: data.BANK, // e.g., 'State Bank of India'
    branch: data.BRANCH, // e.g., 'Mumbai Main Branch'
    address: data.ADDRESS,
    city: data.CITY,
    district: data.DISTRICT,
    state: data.STATE,
    contact: data.CONTACT,
    micr: data.MICR, // Magnetic Ink Character Recognition code
    upi: data.UPI // UPI enabled or not
  };
}

// Example: Auto-populate bank details from IFSC
async function addBankAccount(employeeId, ifscCode, accountNumber) {
  // Validate IFSC
  const ifscValidation = validateIFSC(ifscCode);
  
  // Fetch bank details from IFSC
  const bankDetails = await fetchBankDetailsFromIFSC(ifscValidation.ifsc);
  
  // Save to database
  await db.query(`
    INSERT INTO bank_details (employee_id, ifsc_code, bank_name, branch, account_number)
    VALUES (?, ?, ?, ?, ?)
  `, [employeeId, bankDetails.ifsc, bankDetails.bankName, bankDetails.branch, accountNumber]);
  
  console.log(`Bank account added for ${employeeId}:`);
  console.log(`  Bank: ${bankDetails.bankName}`);
  console.log(`  Branch: ${bankDetails.branch}`);
  console.log(`  IFSC: ${bankDetails.ifsc}`);
}
```

**Business Rules**:
- IFSC is mandatory for all Indian bank accounts
- Auto-populate bank_name and branch from IFSC lookup
- Case-insensitive input, store as uppercase
- Invalid IFSC should be rejected immediately at entry
- Cache IFSC lookups to reduce API calls

**SQL Trigger** (IFSC uppercase conversion):
```sql
CREATE OR REPLACE FUNCTION uppercase_ifsc()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ifsc_code := UPPER(TRIM(NEW.ifsc_code));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_uppercase_ifsc
BEFORE INSERT OR UPDATE OF ifsc_code ON bank_details
FOR EACH ROW
EXECUTE FUNCTION uppercase_ifsc();
```

---

#### 2.5.2 Account Number Validation & Confirmation

**Rule**: Account numbers must be validated for format and require double-entry confirmation to prevent errors

**Account Number Format**:
- Length: 8-20 digits (varies by bank)
- Type: Numeric (most banks) or alphanumeric (few banks like ICICI, HDFC)
- Leading zeros are significant (preserve them)

**Validation**:
```javascript
function validateAccountNumber(accountNumber, bankCode) {
  // Remove spaces and hyphens
  const cleanedAccount = accountNumber.replace(/[\s-]/g, '');
  
  // Length check
  if (cleanedAccount.length < 8 || cleanedAccount.length > 20) {
    throw new Error('Account number must be between 8 and 20 characters');
  }
  
  // Bank-specific validation rules
  const bankRules = {
    'SBIN': /^\d{11}$/, // SBI: 11 digits
    'HDFC': /^[0-9]{14}$/, // HDFC: 14 digits
    'ICIC': /^\d{12}$/, // ICICI: 12 digits
    'UTIB': /^\d{15}$/, // Axis Bank: 15 digits
    'KKBK': /^\d{16}$/, // Kotak: 16 digits
    'PUNB': /^\d{16}$/, // PNB: 16 digits
  };
  
  // Validate against bank-specific rule if available
  if (bankRules[bankCode]) {
    if (!bankRules[bankCode].test(cleanedAccount)) {
      throw new Error(`Invalid account number format for ${bankCode}`);
    }
  } else {
    // Generic validation: numeric or alphanumeric
    if (!/^[0-9A-Z]{8,20}$/.test(cleanedAccount)) {
      throw new Error('Account number must contain only digits or alphanumeric characters');
    }
  }
  
  return cleanedAccount;
}

// Double-entry confirmation
function confirmAccountNumber(accountNumber, confirmAccountNumber) {
  if (accountNumber !== confirmAccountNumber) {
    throw new Error('Account numbers do not match. Please re-enter.');
  }
  return true;
}

// Example usage
try {
  const account = validateAccountNumber('1234567890123', 'HDFC');
  confirmAccountNumber(account, '1234567890123'); // Must match
  console.log('Account number validated:', account);
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

**UI Implementation** (Double-Entry Field):
```javascript
// React component example
function BankAccountForm({ employee }) {
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [accountMatch, setAccountMatch] = useState(null);
  
  const handleConfirmAccountChange = (value) => {
    setConfirmAccount(value);
    setAccountMatch(value === accountNumber && value.length > 0);
  };
  
  return (
    <div>
      <input
        type="text"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value)}
        placeholder="Enter account number"
        maxLength={20}
      />
      
      <input
        type="text"
        value={confirmAccount}
        onChange={(e) => handleConfirmAccountChange(e.target.value)}
        placeholder="Confirm account number"
        maxLength={20}
        style={{ borderColor: accountMatch === false ? 'red' : 'green' }}
      />
      
      {accountMatch === false && (
        <p style={{ color: 'red' }}>Account numbers do not match</p>
      )}
      {accountMatch === true && (
        <p style={{ color: 'green' }}>✓ Account numbers match</p>
      )}
    </div>
  );
}
```

**Business Rules**:
- Account number is mandatory
- Require confirmation field (confirm_account_number) during entry
- Prevent copy-paste in confirmation field (force manual re-entry)
- Preserve leading zeros (e.g., '0123456789' ≠ '123456789')
- Never display full account number after entry (mask immediately)

---

#### 2.5.3 Account Holder Name Matching

**Rule**: Account holder name must closely match employee's legal name to prevent fraud and payment failures

**Name Matching Algorithm**:
```javascript
function calculateNameSimilarity(name1, name2) {
  // Normalize names
  const normalize = (name) => name.toLowerCase()
    .replace(/[^a-z\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  // Exact match
  if (n1 === n2) return 1.0;
  
  // Levenshtein distance (edit distance)
  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  const similarity = 1 - (distance / maxLength);
  
  return similarity;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Name validation logic
function validateAccountHolderName(accountHolderName, employeeLegalName) {
  const similarity = calculateNameSimilarity(accountHolderName, employeeLegalName);
  
  // Thresholds
  const EXACT_MATCH = 1.0;
  const HIGH_SIMILARITY = 0.85; // 85%
  const ACCEPTABLE_SIMILARITY = 0.70; // 70%
  const LOW_SIMILARITY = 0.50; // 50%
  
  if (similarity >= HIGH_SIMILARITY) {
    return { valid: true, status: 'approved', similarity };
  } else if (similarity >= ACCEPTABLE_SIMILARITY) {
    return { valid: true, status: 'review_recommended', similarity, message: 'Name similarity is acceptable but below threshold. Consider review.' };
  } else if (similarity >= LOW_SIMILARITY) {
    return { valid: false, status: 'requires_review', similarity, message: 'Name mismatch. HR review required before approval.' };
  } else {
    return { valid: false, status: 'rejected', similarity, message: 'Significant name mismatch. Account holder name does not match employee name.' };
  }
}

// Example usage
const employeeName = 'Rajesh Kumar Sharma';
const accountName1 = 'RAJESH KUMAR SHARMA'; // Exact match (case-insensitive)
const accountName2 = 'Rajesh K Sharma'; // High similarity (middle name abbreviated)
const accountName3 = 'Rajesh Sharma'; // Acceptable (middle name omitted)
const accountName4 = 'R K Sharma'; // Low similarity (names abbreviated)
const accountName5 = 'John Doe'; // No match

console.log(validateAccountHolderName(accountName1, employeeName));
// { valid: true, status: 'approved', similarity: 1.0 }

console.log(validateAccountHolderName(accountName2, employeeName));
// { valid: true, status: 'approved', similarity: 0.92 }

console.log(validateAccountHolderName(accountName3, employeeName));
// { valid: true, status: 'review_recommended', similarity: 0.78 }

console.log(validateAccountHolderName(accountName4, employeeName));
// { valid: false, status: 'requires_review', similarity: 0.58 }

console.log(validateAccountHolderName(accountName5, employeeName));
// { valid: false, status: 'rejected', similarity: 0.0 }
```

**Allowed Name Variations**:
- Case differences: 'JOHN DOE' ≈ 'John Doe'
- Middle name abbreviation: 'Rajesh Kumar Sharma' ≈ 'Rajesh K Sharma'
- Middle name omission: 'Rajesh Kumar Sharma' ≈ 'Rajesh Sharma'
- Initials: 'R Kumar' ≈ 'Rajesh Kumar' (with review)
- Punctuation: "O'Connor" ≈ "O Connor"

**Business Rules**:
- Similarity ≥ 85%: Auto-approve
- Similarity 70-85%: Auto-approve with warning to HR
- Similarity 50-70%: Flag for HR review (manual approval required)
- Similarity < 50%: Reject, require correction
- Store both employee's legal name and account holder name for audit

---

#### 2.5.4 Primary Account Management & Enforcement

**Rule**: Each employee must have exactly ONE primary account at all times for salary disbursement

**Primary Account Logic**:
```javascript
async function setPrimaryAccount(employeeId, bankAccountId) {
  // Begin transaction
  await db.beginTransaction();
  
  try {
    // Step 1: Check if account exists and belongs to employee
    const account = await db.query(`
      SELECT id, employee_id, is_active
      FROM bank_details
      WHERE id = ? AND employee_id = ?
    `, [bankAccountId, employeeId]);
    
    if (!account) {
      throw new Error('Bank account not found or does not belong to employee');
    }
    
    if (!account.is_active) {
      throw new Error('Cannot set inactive account as primary');
    }
    
    // Step 2: Unset all other primary accounts for this employee
    await db.query(`
      UPDATE bank_details
      SET is_primary = false,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ?
      WHERE employee_id = ? AND is_primary = true AND id != ?
    `, [currentUserId, employeeId, bankAccountId]);
    
    // Step 3: Set new primary account
    await db.query(`
      UPDATE bank_details
      SET is_primary = true,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ?
      WHERE id = ?
    `, [currentUserId, bankAccountId]);
    
    // Step 4: Log change in audit
    await db.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'primary_account_changed', 'bank_details', ?, ?)
    `, [currentUserId, bankAccountId, JSON.stringify({
      employeeId,
      newPrimaryAccountId: bankAccountId
    })]);
    
    // Commit transaction
    await db.commit();
    
    return { success: true, message: 'Primary account updated successfully' };
    
  } catch (error) {
    // Rollback on error
    await db.rollback();
    throw error;
  }
}
```

**SQL Trigger** (Enforce Single Primary Account):
```sql
CREATE OR REPLACE FUNCTION ensure_single_primary_bank_account()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting is_primary = true, unset all others for same employee
  IF NEW.is_primary = TRUE THEN
    UPDATE bank_details
    SET is_primary = FALSE
    WHERE employee_id = NEW.employee_id
      AND id != NEW.id
      AND is_primary = TRUE;
  END IF;
  
  -- Ensure at least one primary account exists
  -- If deactivating the only primary account, reject
  IF NEW.is_primary = FALSE AND OLD.is_primary = TRUE THEN
    IF NOT EXISTS (
      SELECT 1 FROM bank_details
      WHERE employee_id = NEW.employee_id
        AND is_primary = TRUE
        AND id != NEW.id
        AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Cannot unset primary account. Employee must have at least one primary account.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary
BEFORE UPDATE OF is_primary ON bank_details
FOR EACH ROW
EXECUTE FUNCTION ensure_single_primary_bank_account();
```

**Get Primary Account**:
```javascript
async function getPrimaryAccount(employeeId) {
  const account = await db.query(`
    SELECT id, bank_name, account_number, ifsc_code, is_verified
    FROM bank_details
    WHERE employee_id = ?
      AND is_primary = true
      AND is_active = true
    LIMIT 1
  `, [employeeId]);
  
  if (!account) {
    throw new Error('No primary bank account found for employee');
  }
  
  return account;
}
```

**Business Rules**:
- Exactly ONE primary account per employee (enforced by trigger)
- Cannot deactivate primary account without setting another as primary first
- Primary account used for all salary payments by default
- Secondary accounts can be used for bonuses, reimbursements (if configured)
- UI should clearly indicate which account is primary

---

#### 2.5.5 Account Verification (Penny Drop Test)

**Rule**: Verify bank accounts using penny drop test before first salary payment to ensure account validity and holder name match

**Penny Drop Process**:
```javascript
async function verifyBankAccountPennyDrop(bankAccountId) {
  // Get bank account details
  const account = await db.query(`
    SELECT bd.*, e.first_name, e.last_name
    FROM bank_details bd
    JOIN employees e ON bd.employee_id = e.employee_id
    WHERE bd.id = ?
  `, [bankAccountId]);
  
  if (!account) {
    throw new Error('Bank account not found');
  }
  
  // Step 1: Initiate penny drop via payment gateway API
  const pennyDropResponse = await inititatePennyDrop(
    account.account_number,
    account.ifsc_code,
    account.bank_name
  );
  
  // Step 2: Compare account holder name from bank response
  const expectedName = `${account.first_name} ${account.last_name}`;
  const actualName = pennyDropResponse.account_holder_name;
  const nameSimilarity = calculateNameSimilarity(expectedName, actualName);
  
  // Step 3: Update verification status
  if (nameSimilarity >= 0.85 && pennyDropResponse.status === 'success') {
    await db.query(`
      UPDATE bank_details
      SET is_verified = true,
          verified_at = CURRENT_TIMESTAMP,
          verified_by = ?,
          verification_method = 'penny_drop',
          verification_reference = ?
      WHERE id = ?
    `, [currentUserId, pennyDropResponse.transaction_id, bankAccountId]);
    
    return {
      success: true,
      verified: true,
      accountHolderName: actualName,
      nameSimilarity,
      message: 'Bank account verified successfully'
    };
  } else {
    return {
      success: true,
      verified: false,
      accountHolderName: actualName,
      nameSimilarity,
      message: 'Verification failed. Account holder name mismatch.',
      requiresReview: true
    };
  }
}

// Integration with Razorpay Fund Account Validation API
async function inititatePennyDrop(accountNumber, ifscCode, bankName) {
  const razorpayApiKey = process.env.RAZORPAY_KEY_ID;
  const razorpayApiSecret = process.env.RAZORPAY_KEY_SECRET;
  
  const response = await fetch('https://api.razorpay.com/v1/fund_accounts/validations', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${razorpayApiKey}:${razorpayApiSecret}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_number: accountNumber,
      ifsc: ifscCode,
      fund_account: {
        account_type: 'bank_account',
        bank_account: {
          name: bankName,
          ifsc: ifscCode,
          account_number: accountNumber
        }
      },
      amount: 100, // ₹1.00
      currency: 'INR',
      notes: {
        purpose: 'account_verification'
      }
    })
  });
  
  const data = await response.json();
  
  return {
    status: data.status, // 'completed' or 'failed'
    account_holder_name: data.fund_account.bank_account.name,
    transaction_id: data.id,
    utr: data.utr, // Unique Transaction Reference
    registered_name: data.results.account_status === 'active' ? data.results.registered_name : null
  };
}
```

**Alternative: Cashfree Bank Verification API**:
```javascript
async function verifyBankAccountCashfree(accountNumber, ifscCode, name) {
  const cashfreeClientId = process.env.CASHFREE_CLIENT_ID;
  const cashfreeClientSecret = process.env.CASHFREE_CLIENT_SECRET;
  
  const response = await fetch('https://payout-api.cashfree.com/payout/v1/validation/bankDetails', {
    method: 'POST',
    headers: {
      'X-Client-Id': cashfreeClientId,
      'X-Client-Secret': cashfreeClientSecret,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name,
      phone: '9999999999', // Optional
      bankAccount: accountNumber,
      ifsc: ifscCode
    })
  });
  
  const data = await response.json();
  
  return {
    status: data.status, // 'SUCCESS' or 'ERROR'
    accountExists: data.data.accountExists, // true/false
    nameAtBank: data.data.nameAtBank, // Actual account holder name
    message: data.message
  };
}
```

**Business Rules**:
- Verify all new accounts before first salary payment (mandatory)
- Re-verify if account details are modified
- Verification fee: ~₹2-3 per verification (charged by payment gateway)
- Failed verification: Flag for HR review, do not auto-reject
- Unverified accounts trigger warning during payroll processing
- Store verification transaction reference for audit trail

---

#### 2.5.6 Account Number Encryption & Masking

**Rule**: Encrypt account numbers at rest and mask in UI to protect sensitive financial data

**Encryption** (AES-256):
```javascript
const crypto = require('crypto');

// Encryption key (store in environment variable, never hardcode)
const ENCRYPTION_KEY = process.env.BANK_ACCOUNT_ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16

function encryptAccountNumber(accountNumber) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(accountNumber, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV + encrypted data (IV needed for decryption)
  return iv.toString('hex') + ':' + encrypted;
}

function decryptAccountNumber(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Example usage
const accountNumber = '1234567890123456';
const encrypted = encryptAccountNumber(accountNumber);
console.log('Encrypted:', encrypted); // e.g., '5f4dcc3b5aa765d61d8327deb882cf99:a1b2c3d4...'

const decrypted = decryptAccountNumber(encrypted);
console.log('Decrypted:', decrypted); // '1234567890123456'
```

**Masking**:
```javascript
function maskAccountNumber(accountNumber) {
  if (!accountNumber || accountNumber.length < 4) {
    return 'XXXX';
  }
  
  // Show only last 4 digits
  const visibleDigits = accountNumber.slice(-4);
  const maskedLength = accountNumber.length - 4;
  const masked = 'X'.repeat(maskedLength);
  
  // Format: XXXX-XXXX-1234 (for readability)
  if (accountNumber.length <= 8) {
    return masked + visibleDigits;
  } else if (accountNumber.length <= 12) {
    return masked.slice(0, 4) + '-' + masked.slice(4) + '-' + visibleDigits;
  } else {
    return masked.slice(0, 4) + '-' + masked.slice(4, 8) + '-' + masked.slice(8) + visibleDigits;
  }
}

// Example
console.log(maskAccountNumber('1234567890123456')); // 'XXXX-XXXX-XXXX-3456'
console.log(maskAccountNumber('12345678')); // 'XXXX5678'
```

**Database Storage**:
```sql
-- Encrypt before insert
INSERT INTO bank_details (employee_id, account_number, ifsc_code)
VALUES (?, AES_ENCRYPT(?, ?, ENCRYPTION_KEY), ?);

-- Decrypt when retrieving (only for authorized users)
SELECT id, employee_id, 
       AES_DECRYPT(account_number, ENCRYPTION_KEY) as account_number_decrypted,
       CONCAT('XXXX-XXXX-', RIGHT(AES_DECRYPT(account_number, ENCRYPTION_KEY), 4)) as account_number_masked
FROM bank_details
WHERE employee_id = ?;
```

**Access Control**:
```javascript
function getAccountNumber(bankAccountId, userRole) {
  const account = db.query(`SELECT * FROM bank_details WHERE id = ?`, [bankAccountId]);
  
  // Role-based access to full account number
  const canViewFullAccount = ['admin', 'hr', 'payroll'].includes(userRole);
  
  if (canViewFullAccount) {
    // Decrypt and return full account number
    account.account_number = decryptAccountNumber(account.account_number);
  } else {
    // Return masked account number only
    const decrypted = decryptAccountNumber(account.account_number);
    account.account_number = maskAccountNumber(decrypted);
  }
  
  // Log access
  auditLog('bank_account_viewed', bankAccountId, { userRole, maskedView: !canViewFullAccount });
  
  return account;
}
```

**Business Rules**:
- Encrypt account_number at rest (database)
- Encrypt in transit (TLS 1.3)
- Mask in UI by default (show last 4 digits only)
- Full account number visible only to HR, Payroll, Admin roles
- Never log full account number in application logs
- Audit all access to full account numbers

---

#### 2.5.7 Payment Failure Tracking & Recovery

**Rule**: Track payment failures and implement recovery mechanisms to ensure reliable salary disbursement

**Payment Failure Handling**:
```javascript
async function recordPaymentFailure(bankAccountId, failureReason) {
  await db.query(`
    UPDATE bank_details
    SET payment_failure_count = payment_failure_count + 1,
        last_payment_failure_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [failureReason, bankAccountId]);
  
  // Get updated failure count
  const account = await db.query(`
    SELECT payment_failure_count, employee_id, bank_name, account_number
    FROM bank_details
    WHERE id = ?
  `, [bankAccountId]);
  
  // Alert logic based on failure count
  if (account.payment_failure_count >= 3) {
    // Critical alert: 3+ failures
    await sendAlert({
      type: 'critical',
      recipient: 'hr@company.com',
      subject: `Critical: Bank account verification required`,
      message: `Employee ${account.employee_id} has ${account.payment_failure_count} consecutive payment failures. Account: ${maskAccountNumber(account.account_number)}. Reason: ${failureReason}`
    });
    
    // Consider auto-deactivating account
    await db.query(`
      UPDATE bank_details
      SET is_active = false,
          deactivated_at = CURRENT_TIMESTAMP,
          deactivation_reason = 'Auto-deactivated after 3 payment failures'
      WHERE id = ?
    `, [bankAccountId]);
    
  } else if (account.payment_failure_count === 2) {
    // Warning alert: 2 failures
    await sendAlert({
      type: 'warning',
      recipient: 'payroll@company.com',
      subject: `Warning: Payment failure detected`,
      message: `Payment to ${account.bank_name} failed (Attempt ${account.payment_failure_count}). Employee: ${account.employee_id}. Reason: ${failureReason}`
    });
  } else {
    // Info alert: 1 failure (log only)
    console.log(`Payment failure #${account.payment_failure_count} for bank account ${bankAccountId}: ${failureReason}`);
  }
}

// Reset failure count after successful payment
async function recordSuccessfulPayment(bankAccountId) {
  await db.query(`
    UPDATE bank_details
    SET payment_failure_count = 0,
        last_payment_failure_reason = NULL,
        last_used_for_payment = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [bankAccountId]);
}
```

**Common Failure Reasons**:
- `account_closed`: Bank account closed by customer
- `invalid_account`: Account number invalid or doesn't exist
- `insufficient_balance`: Insufficient balance in company account (rare)
- `bank_offline`: Bank server temporarily offline
- `name_mismatch`: Account holder name doesn't match
- `account_frozen`: Account frozen by bank or regulatory authority
- `invalid_ifsc`: IFSC code invalid
- `network_error`: Network timeout or connectivity issue

**Automatic Retry Logic**:
```javascript
async function retryFailedPayment(bankAccountId, maxRetries = 3) {
  const account = await db.query(`
    SELECT * FROM bank_details WHERE id = ?
  `, [bankAccountId]);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Attempt payment via payment gateway
      const result = await processPayment(account.employee_id, bankAccountId);
      
      if (result.success) {
        await recordSuccessfulPayment(bankAccountId);
        return { success: true, attempts: attempt };
      }
      
      // Wait before retry (exponential backoff)
      await sleep(Math.pow(2, attempt) * 1000); // 2s, 4s, 8s
      
    } catch (error) {
      if (attempt === maxRetries) {
        await recordPaymentFailure(bankAccountId, error.message);
        throw error;
      }
    }
  }
}
```

**Fallback to Secondary Account**:
```javascript
async function processPayrollWithFallback(employeeId, amount) {
  // Try primary account first
  const primaryAccount = await getPrimaryAccount(employeeId);
  
  try {
    const result = await processPayment(employeeId, primaryAccount.id, amount);
    if (result.success) {
      return { success: true, accountUsed: 'primary' };
    }
  } catch (error) {
    console.log(`Primary account failed: ${error.message}. Trying secondary account...`);
  }
  
  // Fallback to secondary account
  const secondaryAccount = await db.query(`
    SELECT id FROM bank_details
    WHERE employee_id = ?
      AND is_primary = false
      AND is_active = true
      AND is_verified = true
      AND payment_failure_count < 3
    ORDER BY created_at DESC
    LIMIT 1
  `, [employeeId]);
  
  if (secondaryAccount) {
    const result = await processPayment(employeeId, secondaryAccount.id, amount);
    if (result.success) {
      // Alert HR about fallback
      await sendAlert({
        type: 'info',
        message: `Salary for ${employeeId} paid to secondary account due to primary account failure`
      });
      return { success: true, accountUsed: 'secondary' };
    }
  }
  
  // All accounts failed
  throw new Error('All bank accounts failed. Manual intervention required.');
}
```

**Business Rules**:
- Track all payment failures with reasons
- After 3 consecutive failures, auto-deactivate account and alert HR
- Implement automatic retry with exponential backoff
- Fallback to secondary verified account if primary fails
- Reset failure count after successful payment
- Generate monthly report of failed payments

---

#### 2.5.8 Multiple Accounts & Secondary Accounts

**Rule**: Support multiple bank accounts per employee for different payment purposes

**Add Secondary Account**:
```javascript
async function addSecondaryBankAccount(employeeId, accountData) {
  // Check if this is the first account for employee
  const existingAccounts = await db.query(`
    SELECT COUNT(*) as count FROM bank_details
    WHERE employee_id = ? AND is_active = true
  `, [employeeId]);
  
  // First account is automatically primary
  const isPrimary = existingAccounts.count === 0;
  
  // Encrypt account number
  const encryptedAccount = encryptAccountNumber(accountData.account_number);
  
  // Insert new account
  const accountId = await db.query(`
    INSERT INTO bank_details (
      employee_id, bank_name, account_holder_name, account_number, ifsc_code,
      branch, account_type, is_primary, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    employeeId, accountData.bank_name, accountData.account_holder_name,
    encryptedAccount, accountData.ifsc_code, accountData.branch,
    accountData.account_type, isPrimary, currentUserId
  ]);
  
  return {
    id: accountId,
    isPrimary,
    message: isPrimary ? 'Added as primary account' : 'Added as secondary account'
  };
}
```

**Get All Accounts for Employee**:
```javascript
async function getEmployeeBankAccounts(employeeId, includeInactive = false) {
  const whereClause = includeInactive 
    ? 'WHERE employee_id = ?'
    : 'WHERE employee_id = ? AND is_active = true';
  
  const accounts = await db.query(`
    SELECT id, bank_name, account_holder_name, ifsc_code, branch,
           account_type, is_primary, is_verified, is_active,
           payment_failure_count, last_used_for_payment, created_at
    FROM bank_details
    ${whereClause}
    ORDER BY is_primary DESC, created_at DESC
  `, [employeeId]);
  
  // Mask account numbers
  accounts.forEach(account => {
    const decrypted = decryptAccountNumber(account.account_number);
    account.account_number_masked = maskAccountNumber(decrypted);
    delete account.account_number; // Don't expose encrypted data
  });
  
  return accounts;
}
```

**Use Cases for Multiple Accounts**:
- **Primary Account**: Salary disbursement
- **Secondary Account**: Bonus, incentive payments
- **Reimbursement Account**: Travel, medical reimbursements
- **Savings Account**: Provident Fund withdrawals (rare)

**Business Rules**:
- Support unlimited secondary accounts per employee
- Only one account can be primary at a time
- Secondary accounts can be verified but not used for regular salary
- Manual selection required to use secondary account for specific payment
- All accounts must be verified before use

---

#### 2.5.9 Account Activation & Deactivation

**Rule**: Support soft deletion of bank accounts while preserving audit trail

**Deactivate Account**:
```javascript
async function deactivateBankAccount(bankAccountId, reason) {
  const account = await db.query(`
    SELECT is_primary, employee_id FROM bank_details WHERE id = ?
  `, [bankAccountId]);
  
  // Cannot deactivate primary account without designating new primary
  if (account.is_primary) {
    const otherAccounts = await db.query(`
      SELECT COUNT(*) as count FROM bank_details
      WHERE employee_id = ? AND id != ? AND is_active = true
    `, [account.employee_id, bankAccountId]);
    
    if (otherAccounts.count === 0) {
      throw new Error('Cannot deactivate the only active account. Add another account first.');
    }
    
    throw new Error('Cannot deactivate primary account. Designate another account as primary first.');
  }
  
  // Deactivate account
  await db.query(`
    UPDATE bank_details
    SET is_active = false,
        deactivated_at = CURRENT_TIMESTAMP,
        deactivated_by = ?,
        deactivation_reason = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [currentUserId, reason, bankAccountId]);
  
  return { success: true, message: 'Bank account deactivated successfully' };
}
```

**Reactivate Account**:
```javascript
async function reactivateBankAccount(bankAccountId) {
  await db.query(`
    UPDATE bank_details
    SET is_active = true,
        deactivated_at = NULL,
        deactivated_by = NULL,
        deactivation_reason = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [bankAccountId]);
  
  return { success: true, message: 'Bank account reactivated successfully' };
}
```

**Business Rules**:
- Use soft delete (is_active = false) instead of hard delete
- Preserve audit trail (deactivated_at, deactivated_by, deactivation_reason)
- Cannot deactivate primary account without setting new primary
- Cannot deactivate the only active account for an employee
- Deactivated accounts excluded from payroll processing
- Can be reactivated anytime (requires re-verification recommended)

---

#### 2.5.10 Proof Document Requirement & Compliance

**Rule**: Require proof documents (cancelled cheque or passbook) for bank account verification and compliance

**Upload Proof Document**:
```javascript
async function uploadBankProofDocument(bankAccountId, documentFile) {
  // Upload document to Document entity
  const documentId = await uploadDocument({
    employee_id: bankAccountId.employee_id,
    document_category: 'Financial',
    document_type: 'Cancelled Cheque',
    file: documentFile
  });
  
  // Link document to bank account
  await db.query(`
    UPDATE bank_details
    SET proof_document_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [documentId, bankAccountId]);
  
  return { success: true, documentId };
}
```

**Validate Proof Document**:
- Cancelled cheque must clearly show:
  - Account holder name
  - Account number
  - IFSC code
  - Bank name and branch
  - "CANCELLED" stamp/watermark across cheque
- Passbook copy must show:
  - First page with account details
  - Recent transactions (optional)
  - Bank seal/stamp

**Business Rules**:
- Proof document mandatory for account verification
- Acceptable formats: PDF, JPG, PNG
- Max file size: 5 MB
- Store reference in proof_document_id (foreign key to Document entity)
- HR reviews proof document during account verification
- Proof required for compliance audits

---

### 2.6 Document Management Rules
**Rule**: Comprehensive management of employee documents with versioning, expiry tracking, OCR extraction, secure storage, and access control

**Purpose**: Define how employee documents are uploaded, stored, verified, versioned, searched, and accessed while maintaining security, compliance, and audit trail.

---

#### 2.6.1 Document Categories & Type Classification

**Rule**: Organize documents into predefined categories for easy management and retrieval

**Document Categories**:

**1. Identity Documents**:
- Aadhar Card (Government ID)
- PAN Card (Permanent Account Number)
- Passport
- Voter ID Card
- Driving License
- Employee ID Card

**2. Address Proof Documents**:
- Utility Bills (Electricity, Water, Gas)
- Rental Agreement / Lease Deed
- Property Tax Receipt
- Bank Statement with address
- Ration Card

**3. Educational Documents**:
- 10th Marksheet / Certificate
- 12th Marksheet / Certificate
- Degree Certificates (Bachelor's, Master's, PhD)
- Transcripts / Mark Sheets
- Professional Certifications (PMP, AWS, Google Cloud, etc.)
- Course Completion Certificates

**4. Professional Documents**:
- Previous Company Offer Letters
- Experience Letters / Relieving Letters
- Appointment Letters
- Salary Slips (last 3 months)
- Form 16 (previous employer)
- Resignation Letters (previous company)

**5. Financial Documents**:
- Bank Statements
- Form 16 (current employer, annual)
- Investment Proofs (80C, 80D)
- Home Loan Statements
- Insurance Premium Receipts
- Cancelled Cheque / Bank Passbook

**6. Compliance Documents**:
- Background Verification Report
- Police Verification Certificate
- Medical Fitness Certificate
- Vaccination Certificates (COVID-19, etc.)
- Drug Test Results
- Reference Letters

**7. HR Documents**:
- Appointment Letter (current company)
- Confirmation Letter
- Increment Letter
- Promotion Letter
- Appraisal Letters
- Warning Letters / Show Cause Notices
- Resignation Letter (current)
- Exit Interview Form
- Full & Final Settlement

**8. Other Documents**:
- Passport-size Photo
- Signature Specimen
- Family Details Form
- Emergency Contact Form
- Declaration Forms
- Consent Forms

**Document Type Metadata**:
```javascript
const DOCUMENT_TYPES = {
  'Identity': [
    { type: 'Aadhar', mandatory: true, hasExpiry: false, hasNumber: true, numberFormat: /^\d{4}-\d{4}-\d{4}$/ },
    { type: 'PAN', mandatory: true, hasExpiry: false, hasNumber: true, numberFormat: /^[A-Z]{5}\d{4}[A-Z]$/ },
    { type: 'Passport', mandatory: false, hasExpiry: true, hasNumber: true, numberFormat: /^[A-Z]\d{7}$/ },
    { type: 'Driving License', mandatory: false, hasExpiry: true, hasNumber: true, numberFormat: /^[A-Z]{2}\d{13}$/ },
    { type: 'Voter ID', mandatory: false, hasExpiry: false, hasNumber: true, numberFormat: /^[A-Z]{3}\d{7}$/ }
  ],
  'Educational': [
    { type: '10th Marksheet', mandatory: true, hasExpiry: false, hasNumber: true },
    { type: '12th Marksheet', mandatory: false, hasExpiry: false, hasNumber: true },
    { type: 'Degree Certificate', mandatory: true, hasExpiry: false, hasNumber: true },
    { type: 'Professional Certification', mandatory: false, hasExpiry: true, hasNumber: true }
  ],
  'Compliance': [
    { type: 'Medical Fitness Certificate', mandatory: true, hasExpiry: true, validityMonths: 12 },
    { type: 'Vaccination Certificate', mandatory: false, hasExpiry: true, validityMonths: 24 },
    { type: 'Background Verification', mandatory: true, hasExpiry: false }
  ]
};

function getDocumentMetadata(category, type) {
  const categoryDocs = DOCUMENT_TYPES[category];
  return categoryDocs?.find(doc => doc.type === type);
}

// Example
const aadharMeta = getDocumentMetadata('Identity', 'Aadhar');
console.log('Aadhar Mandatory:', aadharMeta.mandatory); // true
console.log('Has Expiry:', aadharMeta.hasExpiry); // false
console.log('Number Format:', aadharMeta.numberFormat); // /^\d{4}-\d{4}-\d{4}$/
```

**Business Rules**:
- Category is mandatory for all documents
- Type must match one of the predefined types within the category
- Subtype is optional (e.g., "Bachelor's Degree in Computer Science")
- System can auto-suggest type based on OCR extraction
- Custom types allowed under "Other" category with approval

---

#### 2.6.2 File Upload Validation & Size Limits

**Rule**: Validate file format, size, and content before accepting uploads

**Allowed File Formats**:
```javascript
const ALLOWED_FORMATS = {
  extensions: ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'doc'],
  mimeTypes: {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword'
  }
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const RECOMMENDED_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
```

**Upload Validation**:
```javascript
async function validateDocumentUpload(file) {
  const errors = [];
  
  // 1. Check file existence
  if (!file || file.size === 0) {
    errors.push('File is empty or not selected');
    return { valid: false, errors };
  }
  
  // 2. Extract extension
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();
  
  // 3. Validate extension
  if (!ALLOWED_FORMATS.extensions.includes(extension)) {
    errors.push(`Invalid file format. Allowed: ${ALLOWED_FORMATS.extensions.join(', ')}`);
  }
  
  // 4. Validate MIME type (prevent spoofing)
  const expectedMimeType = ALLOWED_FORMATS.mimeTypes[extension];
  if (file.type !== expectedMimeType) {
    errors.push(`MIME type mismatch. Expected: ${expectedMimeType}, Got: ${file.type}`);
  }
  
  // 5. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit`);
  }
  
  // 6. Warn if file size > recommended
  if (file.size > RECOMMENDED_FILE_SIZE) {
    console.warn(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds recommended ${RECOMMENDED_FILE_SIZE / (1024 * 1024)} MB`);
  }
  
  // 7. Validate file content (magic numbers for PDFs and images)
  const isValidContent = await validateFileContent(file, extension);
  if (!isValidContent) {
    errors.push('File content validation failed. File may be corrupted or format mismatch.');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    fileInfo: {
      name: file.name,
      size: file.size,
      type: file.type,
      extension,
      sizeReadable: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
    }
  };
}

// Validate file content using magic numbers (file signatures)
async function validateFileContent(file, extension) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer).slice(0, 4);
  
  // File signatures (magic numbers)
  const signatures = {
    'pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'jpg': [0xFF, 0xD8, 0xFF],
    'png': [0x89, 0x50, 0x4E, 0x47], // PNG
    'docx': [0x50, 0x4B, 0x03, 0x04], // ZIP (DOCX is ZIP archive)
    'doc': [0xD0, 0xCF, 0x11, 0xE0] // DOC
  };
  
  const expectedSig = signatures[extension];
  if (!expectedSig) return true; // Unknown signature, skip validation
  
  // Check if file starts with expected signature
  for (let i = 0; i < expectedSig.length; i++) {
    if (bytes[i] !== expectedSig[i]) {
      return false;
    }
  }
  
  return true;
}

// Example usage
const file = document.getElementById('fileInput').files[0];
const validation = await validateDocumentUpload(file);

if (validation.valid) {
  console.log('File validation passed:', validation.fileInfo);
  // Proceed with upload
} else {
  console.error('File validation failed:', validation.errors);
  // Show errors to user
}
```

**SQL Trigger** (Validate file size at database level):
```sql
CREATE OR REPLACE FUNCTION validate_document_file_size()
RETURNS TRIGGER AS $$
BEGIN
  -- Enforce 10 MB limit (10 * 1024 * 1024 bytes)
  IF NEW.file_size > 10485760 THEN
    RAISE EXCEPTION 'File size exceeds 10 MB limit. File size: % bytes', NEW.file_size;
  END IF;
  
  -- Warn if file is very small (< 10 KB, might be corrupted)
  IF NEW.file_size < 10240 THEN
    RAISE WARNING 'File size is unusually small (% bytes). Verify file integrity.', NEW.file_size;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_document_file_size
BEFORE INSERT OR UPDATE OF file_size ON documents
FOR EACH ROW
EXECUTE FUNCTION validate_document_file_size();
```

**Business Rules**:
- Maximum file size: 10 MB
- Recommended file size: ≤ 5 MB
- Allowed formats: PDF, JPG, JPEG, PNG, DOCX, DOC
- MIME type must match file extension (prevent spoofing)
- Validate file content using magic numbers
- Reject corrupted files or files with mismatched extensions

---

#### 2.6.3 Storage Strategy & Cloud Integration

**Rule**: Dynamically choose storage based on file size and type to optimize cost and performance

**Storage Decision Logic**:
```javascript
const STORAGE_THRESHOLDS = {
  database: 1 * 1024 * 1024, // < 1 MB: Store in database as base64
  cloud: 1 * 1024 * 1024, // >= 1 MB: Store in cloud (S3/GCS)
  cdn: ['photo', 'signature'] // Always use CDN for frequently accessed docs
};

function determineStorageType(fileSize, documentType) {
  // Frequently accessed documents -> CDN
  if (STORAGE_THRESHOLDS.cdn.includes(documentType.toLowerCase())) {
    return 'cloud'; // CDN backed by cloud storage
  }
  
  // Small files -> Database
  if (fileSize < STORAGE_THRESHOLDS.database) {
    return 'database';
  }
  
  // Large files -> Cloud
  return 'cloud';
}
```

**Database Storage** (< 1 MB):
```javascript
async function storeInDatabase(file) {
  // Convert file to base64
  const base64 = await fileToBase64(file);
  
  await db.query(`
    INSERT INTO documents (employee_id, file_name, file_extension, mime_type, file_size, storage_type, file_data, file_hash)
    VALUES (?, ?, ?, ?, ?, 'database', ?, ?)
  `, [employeeId, file.name, extension, file.type, file.size, base64, fileHash]);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // Remove data:image/...;base64, prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

**Cloud Storage** (>= 1 MB):
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

async function uploadToS3(file, employeeId, documentType) {
  const bucket = process.env.S3_BUCKET_NAME || 'ecovale-hr-docs-prod';
  const timestamp = Date.now();
  const key = `documents/${employeeId}/${documentType}/${timestamp}_${file.name}`;
  
  const params = {
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ServerSideEncryption: 'AES256', // Encrypt at rest
    Metadata: {
      'employee-id': employeeId,
      'document-type': documentType,
      'upload-date': new Date().toISOString()
    }
  };
  
  const result = await s3.upload(params).promise();
  
  return {
    file_path: key,
    storage_bucket: bucket,
    storage_region: process.env.AWS_REGION,
    s3_url: result.Location,
    s3_etag: result.ETag
  };
}

// Store metadata in database
async function storeCloudDocumentMetadata(file, s3Result, fileHash) {
  await db.query(`
    INSERT INTO documents (
      employee_id, file_name, file_extension, mime_type, file_size,
      storage_type, file_path, storage_bucket, storage_region, file_hash
    ) VALUES (?, ?, ?, ?, ?, 'cloud', ?, ?, ?, ?)
  `, [
    employeeId, file.name, extension, file.mimetype, file.size,
    s3Result.file_path, s3Result.storage_bucket, s3Result.storage_region, fileHash
  ]);
}
```

**Generate Signed URL** (Temporary access):
```javascript
function generateSignedURL(documentId) {
  const document = db.query(`
    SELECT file_path, storage_bucket FROM documents WHERE id = ?
  `, [documentId]);
  
  if (document.storage_type !== 'cloud') {
    throw new Error('Document is not stored in cloud');
  }
  
  // Generate signed URL (valid for 15 minutes)
  const params = {
    Bucket: document.storage_bucket,
    Key: document.file_path,
    Expires: 15 * 60 // 15 minutes
  };
  
  const signedURL = s3.getSignedUrl('getObject', params);
  
  // Log access
  auditLog('document_access', documentId, { signedURL: true, expiresIn: '15 minutes' });
  
  return signedURL;
}
```

**Business Rules**:
- Files < 1 MB: Store as base64 in database (fast retrieval)
- Files >= 1 MB: Store in cloud (S3/GCS) to save database space
- Profile photos, signatures: Always use cloud + CDN (frequently accessed)
- Generate signed URLs for cloud documents (15-minute expiry)
- Enable server-side encryption (AES-256) for cloud storage
- Use lifecycle policies to move old documents to cold storage (after 3 years)

---

#### 2.6.4 File Hash Generation & Deduplication

**Rule**: Compute SHA-256 hash for every uploaded file to detect duplicates and ensure integrity

**Hash Computation**:
```javascript
const crypto = require('crypto');

function computeFileHash(fileBuffer) {
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

// For browser (client-side)
async function computeFileHashBrowser(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
```

**Deduplication Logic**:
```javascript
async function checkDuplicateDocument(fileHash, employeeId) {
  // Check if exact same file already exists for any employee
  const duplicates = await db.query(`
    SELECT id, employee_id, document_type, file_name, uploaded_at
    FROM documents
    WHERE file_hash = ?
      AND is_deleted = false
    ORDER BY uploaded_at DESC
    LIMIT 5
  `, [fileHash]);
  
  if (duplicates.length === 0) {
    return { isDuplicate: false };
  }
  
  // Check if same employee uploaded same file
  const selfDuplicate = duplicates.find(d => d.employee_id === employeeId);
  if (selfDuplicate) {
    return {
      isDuplicate: true,
      type: 'self',
      message: `You already uploaded this document on ${selfDuplicate.uploaded_at}`,
      documentId: selfDuplicate.id,
      action: 'replace' // Offer to replace existing document
    };
  }
  
  // Different employee uploaded same file (possible shared document or fraud)
  return {
    isDuplicate: true,
    type: 'other',
    message: 'This file has been uploaded by another employee',
    action: 'flag_review' // Flag for HR review
  };
}

// Upload with deduplication
async function uploadDocumentWithDedup(file, employeeId, documentType) {
  // Step 1: Compute hash
  const fileBuffer = await file.arrayBuffer();
  const fileHash = computeFileHash(Buffer.from(fileBuffer));
  
  // Step 2: Check for duplicates
  const dupCheck = await checkDuplicateDocument(fileHash, employeeId);
  
  if (dupCheck.isDuplicate) {
    if (dupCheck.type === 'self') {
      // Ask user: Replace existing document?
      return {
        success: false,
        duplicate: true,
        message: dupCheck.message,
        existingDocumentId: dupCheck.documentId,
        action: 'confirm_replace'
      };
    } else {
      // Flag for HR review (potential fraud)
      await db.query(`
        INSERT INTO audit_logs (action, entity_type, entity_id, details)
        VALUES ('duplicate_document_upload', 'documents', ?, ?)
      `, [null, JSON.stringify({ employeeId, fileHash, message: dupCheck.message })]);
      
      // Still allow upload but flag it
      console.warn('Duplicate document uploaded by different employee:', dupCheck);
    }
  }
  
  // Step 3: Proceed with upload
  // ... (normal upload logic)
}
```

**Periodic Integrity Check**:
```javascript
async function verifyDocumentIntegrity(documentId) {
  const document = await db.query(`
    SELECT id, file_hash, file_data, file_path, storage_type, storage_bucket
    FROM documents
    WHERE id = ?
  `, [documentId]);
  
  let fileBuffer;
  
  // Retrieve file content based on storage type
  if (document.storage_type === 'database') {
    fileBuffer = Buffer.from(document.file_data, 'base64');
  } else if (document.storage_type === 'cloud') {
    // Download from S3
    const params = {
      Bucket: document.storage_bucket,
      Key: document.file_path
    };
    const s3Data = await s3.getObject(params).promise();
    fileBuffer = s3Data.Body;
  }
  
  // Recompute hash
  const currentHash = computeFileHash(fileBuffer);
  
  // Compare with stored hash
  if (currentHash !== document.file_hash) {
    // File corrupted or tampered
    await db.query(`
      UPDATE documents
      SET notes = CONCAT(COALESCE(notes, ''), '\n[ALERT] File integrity check failed on ', NOW())
      WHERE id = ?
    `, [documentId]);
    
    throw new Error('File integrity check failed. Document may be corrupted.');
  }
  
  return { valid: true, message: 'File integrity verified' };
}

// Schedule periodic integrity checks
async function scheduleIntegrityChecks() {
  // Check documents uploaded in last 7 days
  const recentDocuments = await db.query(`
    SELECT id FROM documents
    WHERE uploaded_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND is_deleted = false
  `);
  
  for (const doc of recentDocuments) {
    try {
      await verifyDocumentIntegrity(doc.id);
    } catch (error) {
      console.error(`Integrity check failed for document ${doc.id}:`, error.message);
    }
  }
}
```

**Business Rules**:
- Compute SHA-256 hash for every uploaded file
- Store hash in `file_hash` column (indexed)
- Check for duplicates before storing
- If employee uploads same file twice, offer to replace existing version
- If different employees upload same file, flag for HR review (potential fraud)
- Periodic integrity checks (recompute hash and compare)
- Detect file corruption or tampering

---

#### 2.6.5 Document Number Extraction & Masking

**Rule**: Extract document numbers (Aadhar, PAN, Passport) using OCR and mask them for security

**Document Number Formats**:
```javascript
const DOCUMENT_NUMBER_FORMATS = {
  'Aadhar': {
    format: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/,
    example: '1234-5678-9012',
    masked: 'XXXX-XXXX-9012',
    showLast: 4
  },
  'PAN': {
    format: /^[A-Z]{5}\d{4}[A-Z]$/,
    example: 'ABCDE1234F',
    masked: 'XXXXX1234F',
    showLast: 5
  },
  'Passport': {
    format: /^[A-Z]\d{7}$/,
    example: 'A1234567',
    masked: 'XXXXX567',
    showLast: 3
  },
  'Driving License': {
    format: /^[A-Z]{2}\d{2}\s?\d{11}$/,
    example: 'KA01 20230012345',
    masked: 'KAXX XXXXXXXXX345',
    showLast: 3
  },
  'Voter ID': {
    format: /^[A-Z]{3}\d{7}$/,
    example: 'ABC1234567',
    masked: 'XXXXX4567',
    showLast: 4
  }
};

function maskDocumentNumber(documentNumber, documentType) {
  const config = DOCUMENT_NUMBER_FORMATS[documentType];
  if (!config) {
    // Unknown document type, mask all but last 4
    return 'X'.repeat(Math.max(0, documentNumber.length - 4)) + documentNumber.slice(-4);
  }
  
  // Validate format
  if (!config.format.test(documentNumber)) {
    console.warn(`Invalid ${documentType} format: ${documentNumber}`);
  }
  
  // Mask all but last N characters
  const visible = documentNumber.slice(-config.showLast);
  const masked = 'X'.repeat(documentNumber.length - config.showLast);
  
  return masked + visible;
}

// Examples
console.log(maskDocumentNumber('1234567890123', 'Aadhar')); // XXXX-XXXX-0123 (formatted)
console.log(maskDocumentNumber('ABCDE1234F', 'PAN')); // XXXXX1234F
console.log(maskDocumentNumber('A1234567', 'Passport')); // XXXXX567
```

**OCR Extraction** (using Tesseract.js or Google Vision API):
```javascript
const Tesseract = require('tesseract.js');

async function extractDocumentNumberOCR(file, documentType) {
  // Perform OCR on image/PDF
  const result = await Tesseract.recognize(file, 'eng', {
    logger: m => console.log(m) // Progress logger
  });
  
  const extractedText = result.data.text;
  
  // Search for document number pattern
  const config = DOCUMENT_NUMBER_FORMATS[documentType];
  if (!config) {
    return { success: false, message: 'Unknown document type' };
  }
  
  const matches = extractedText.match(config.format);
  if (!matches || matches.length === 0) {
    return { 
      success: false, 
      message: `Could not extract ${documentType} number from document`,
      extractedText // Return full text for manual review
    };
  }
  
  // Clean up extracted number (remove spaces, hyphens)
  const documentNumber = matches[0].replace(/[\s-]/g, '');
  const maskedNumber = maskDocumentNumber(documentNumber, documentType);
  
  return {
    success: true,
    documentNumber,
    maskedNumber,
    extractedText
  };
}

// Example: Extract Aadhar number
const aadharFile = document.getElementById('aadharUpload').files[0];
const extraction = await extractDocumentNumberOCR(aadharFile, 'Aadhar');

if (extraction.success) {
  console.log('Extracted Aadhar:', extraction.maskedNumber); // XXXX-XXXX-9012
  
  // Store in database
  await db.query(`
    UPDATE documents
    SET document_number = ?,
        document_number_masked = ?,
        ocr_extracted_text = ?
    WHERE id = ?
  `, [
    encryptDocumentNumber(extraction.documentNumber), // Encrypt full number
    extraction.maskedNumber,
    extraction.extractedText,
    documentId
  ]);
} else {
  console.error('Extraction failed:', extraction.message);
  // Prompt user to enter number manually
}
```

**Encryption** (for full document numbers):
```javascript
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.DOCUMENT_NUMBER_ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encryptDocumentNumber(documentNumber) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(documentNumber, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

function decryptDocumentNumber(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Business Rules**:
- Extract document numbers using OCR automatically
- Validate extracted numbers against format regex
- Encrypt full document number (AES-256) before storing
- Generate masked version for UI display
- Never display full document number without authorization
- Admin role can view full numbers (audit logged)
- Allow manual entry if OCR extraction fails

---

#### 2.6.6 Document Verification & API Integration

**Rule**: Verify documents using manual review, OCR validation, or third-party APIs (DigiLocker, Income Tax)

**Manual Verification** (by HR):
```javascript
async function manuallyVerifyDocument(documentId, verifiedBy, notes) {
  await db.query(`
    UPDATE documents
    SET is_verified = true,
        verified_at = CURRENT_TIMESTAMP,
        verified_by = ?,
        verification_method = 'manual_review',
        verification_notes = ?
    WHERE id = ?
  `, [verifiedBy, notes, documentId]);
  
  // Notify employee
  await sendNotification(employeeId, {
    type: 'document_verified',
    message: `Your ${documentType} has been verified`,
    documentId
  });
}
```

**Aadhar Verification** (via DigiLocker API):
```javascript
async function verifyAadharDigiLocker(aadharNumber) {
  const DIGILOCKER_API_URL = 'https://api.digitallocker.gov.in/public/oauth2/1/eaadhaar';
  const ACCESS_TOKEN = process.env.DIGILOCKER_ACCESS_TOKEN;
  
  try {
    const response = await fetch(DIGILOCKER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aadhaar_number: aadharNumber,
        consent: 'Y'
      })
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        verified: true,
        name: data.name,
        dob: data.dob,
        gender: data.gender,
        address: data.address,
        photo: data.photo_base64
      };
    } else {
      return {
        verified: false,
        error: data.message
      };
    }
  } catch (error) {
    console.error('DigiLocker API error:', error);
    return { verified: false, error: error.message };
  }
}

// Update document after verification
async function updateDocumentAfterAadharVerification(documentId, verificationResult) {
  if (!verificationResult.verified) {
    throw new Error(`Aadhar verification failed: ${verificationResult.error}`);
  }
  
  await db.query(`
    UPDATE documents
    SET is_verified = true,
        verified_at = CURRENT_TIMESTAMP,
        verification_method = 'api_verification',
        verification_notes = 'Verified via DigiLocker API',
        ocr_metadata = ?
    WHERE id = ?
  `, [
    JSON.stringify({
      name: verificationResult.name,
      dob: verificationResult.dob,
      gender: verificationResult.gender,
      address: verificationResult.address
    }),
    documentId
  ]);
}
```

**PAN Verification** (via Income Tax API):
```javascript
async function verifyPAN(panNumber, fullName, dob) {
  const INCOME_TAX_API_URL = 'https://api.incometax.gov.in/pan/verify';
  const API_KEY = process.env.INCOME_TAX_API_KEY;
  
  try {
    const response = await fetch(INCOME_TAX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pan: panNumber,
        name: fullName,
        dob: dob
      })
    });
    
    const data = await response.json();
    
    return {
      verified: data.valid === true,
      name: data.registered_name,
      status: data.status, // 'Active', 'Inactive', 'Invalid'
      category: data.category, // 'Individual', 'Company', 'Trust', etc.
      lastUpdated: data.last_updated
    };
  } catch (error) {
    console.error('PAN verification API error:', error);
    return { verified: false, error: error.message };
  }
}
```

**OCR-based Validation**:
```javascript
async function validateDocumentViaOCR(documentId) {
  const document = await db.query(`
    SELECT d.*, e.first_name, e.last_name, e.date_of_birth
    FROM documents d
    JOIN employees e ON d.employee_id = e.employee_id
    WHERE d.id = ?
  `, [documentId]);
  
  if (!document.ocr_metadata) {
    throw new Error('OCR data not available. Run OCR extraction first.');
  }
  
  const ocrData = JSON.parse(document.ocr_metadata);
  const issues = [];
  
  // Validate name match
  const employeeName = `${document.first_name} ${document.last_name}`.toLowerCase();
  const ocrName = ocrData.name?.toLowerCase();
  
  if (ocrName && !employeeName.includes(ocrName) && !ocrName.includes(employeeName.split(' ')[0])) {
    issues.push(`Name mismatch: Employee name "${employeeName}" does not match OCR extracted name "${ocrName}"`);
  }
  
  // Validate DOB match
  if (ocrData.dob && document.date_of_birth) {
    if (ocrData.dob !== document.date_of_birth) {
      issues.push(`DOB mismatch: Employee DOB "${document.date_of_birth}" does not match OCR extracted DOB "${ocrData.dob}"`);
    }
  }
  
  // Validate document number match
  if (ocrData.id_number && document.document_number) {
    const decryptedNumber = decryptDocumentNumber(document.document_number);
    if (ocrData.id_number !== decryptedNumber) {
      issues.push(`Document number mismatch`);
    }
  }
  
  if (issues.length > 0) {
    return {
      valid: false,
      issues,
      message: 'OCR validation failed. Manual review required.'
    };
  }
  
  // Auto-verify if all validations pass
  await db.query(`
    UPDATE documents
    SET is_verified = true,
        verified_at = CURRENT_TIMESTAMP,
        verification_method = 'ocr_extraction',
        verification_notes = 'Auto-verified via OCR validation'
    WHERE id = ?
  `, [documentId]);
  
  return {
    valid: true,
    message: 'Document verified via OCR validation'
  };
}
```

**Business Rules**:
- Three verification methods: Manual, OCR, API
- API verification (DigiLocker, Income Tax) is most reliable
- OCR validation: Match name, DOB, document number with employee record
- Manual review required if API/OCR verification fails
- Mark `is_verified = true` only after successful verification
- Store verification method and timestamp for audit
- Unverified documents trigger warnings during onboarding

---

#### 2.6.7 Expiry Tracking & Automated Alerts

**Rule**: Track document expiry dates and send automated reminders to prevent lapses

**Documents with Expiry**:
- Passport (10 years validity)
- Driving License (renewal required)
- Professional Certifications (varies: 1-3 years)
- Medical Fitness Certificate (1 year)
- Vaccination Certificates (varies)
- Visa/Work Permits (for foreign employees)

**SQL Generated Columns**:
```sql
-- Auto-compute expiry status
ALTER TABLE documents
ADD COLUMN is_expired BOOLEAN 
GENERATED ALWAYS AS (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE) STORED;

-- Auto-compute days until expiry
ALTER TABLE documents
ADD COLUMN days_until_expiry INT
GENERATED ALWAYS AS (
  CASE 
    WHEN expiry_date IS NULL THEN NULL
    ELSE DATEDIFF(expiry_date, CURRENT_DATE)
  END
) STORED;
```

**Expiry Alert Scheduler**:
```javascript
async function sendExpiryAlerts() {
  // Get documents expiring in 60, 30, 7 days
  const alerts = await db.query(`
    SELECT d.id, d.document_type, d.expiry_date, d.days_until_expiry,
           d.expiry_alert_sent, e.employee_id, e.first_name, e.official_email
    FROM documents d
    JOIN employees e ON d.employee_id = e.employee_id
    WHERE d.expiry_date IS NOT NULL
      AND d.is_deleted = false
      AND d.is_latest_version = true
      AND d.days_until_expiry IN (60, 30, 7, 0)
      AND (d.expiry_alert_sent = false OR d.days_until_expiry <= 7)
  `);
  
  for (const doc of alerts) {
    const urgency = getExpiryUrgency(doc.days_until_expiry);
    
    await sendEmail({
      to: doc.official_email,
      subject: `${urgency}: ${doc.document_type} expiring ${doc.days_until_expiry === 0 ? 'today' : `in ${doc.days_until_expiry} days`}`,
      template: 'document_expiry_reminder',
      data: {
        employeeName: doc.first_name,
        documentType: doc.document_type,
        expiryDate: doc.expiry_date,
        daysUntilExpiry: doc.days_until_expiry,
        actionRequired: 'Please upload renewed document'
      }
    });
    
    // Mark alert as sent
    await db.query(`
      UPDATE documents
      SET expiry_alert_sent = true,
          expiry_alert_date = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [doc.id]);
  }
}

function getExpiryUrgency(daysUntilExpiry) {
  if (daysUntilExpiry <= 0) return 'URGENT: Document Expired';
  if (daysUntilExpiry <= 7) return 'URGENT REMINDER';
  if (daysUntilExpiry <= 30) return 'REMINDER';
  return 'NOTICE';
}

// Schedule daily cron job
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily document expiry alert check...');
  await sendExpiryAlerts();
});
```

**Expiry Dashboard Widget**:
```javascript
async function getExpiringDocuments(days = 30) {
  const documents = await db.query(`
    SELECT d.employee_id, e.first_name, e.last_name,
           d.document_type, d.expiry_date, d.days_until_expiry, d.is_expired
    FROM documents d
    JOIN employees e ON d.employee_id = e.employee_id
    WHERE d.expiry_date IS NOT NULL
      AND d.is_deleted = false
      AND d.is_latest_version = true
      AND (d.is_expired = true OR d.days_until_expiry <= ?)
    ORDER BY d.days_until_expiry ASC
  `, [days]);
  
  return {
    expired: documents.filter(d => d.is_expired),
    expiringSoon: documents.filter(d => !d.is_expired && d.days_until_expiry <= 7),
    expiringThisMonth: documents.filter(d => !d.is_expired && d.days_until_expiry <= 30)
  };
}

// Example: Show expiry widget in HR dashboard
const expiryData = await getExpiringDocuments(30);
console.log(`Expired: ${expiryData.expired.length}`);
console.log(`Expiring in 7 days: ${expiryData.expiringSoon.length}`);
console.log(`Expiring in 30 days: ${expiryData.expiringThisMonth.length}`);
```

**Prevent Payroll if Mandatory Documents Expired**:
```javascript
async function validateEmployeeDocumentsForPayroll(employeeId) {
  const expiredMandatory = await db.query(`
    SELECT document_type, expiry_date
    FROM documents
    WHERE employee_id = ?
      AND is_mandatory = true
      AND is_expired = true
      AND is_deleted = false
      AND is_latest_version = true
  `, [employeeId]);
  
  if (expiredMandatory.length > 0) {
    const expiredDocs = expiredMandatory.map(d => d.document_type).join(', ');
    throw new Error(`Cannot process payroll. Mandatory documents expired: ${expiredDocs}`);
  }
  
  return { valid: true };
}
```

**Business Rules**:
- Track expiry for Passport, Driving License, Certifications, Medical certificates
- Auto-compute `is_expired` and `days_until_expiry` (SQL generated columns)
- Send email alerts: 60 days, 30 days, 7 days before expiry, and on expiry date
- Dashboard widget: Show all documents expiring in next 30 days
- Prevent payroll processing if mandatory documents are expired
- Allow grace period (7 days) for document renewal

---

#### 2.6.8 Document Versioning & History Tracking

**Rule**: Maintain complete version history of all documents with parent-child linking

**Version Control Logic**:
```javascript
async function replaceDocument(oldDocumentId, newFile, replacementReason) {
  // Begin transaction
  await db.beginTransaction();
  
  try {
    // Step 1: Get old document details
    const oldDoc = await db.query(`
      SELECT * FROM documents WHERE id = ?
    `, [oldDocumentId]);
    
    if (!oldDoc) {
      throw new Error('Document not found');
    }
    
    // Step 2: Mark old version as not latest
    await db.query(`
      UPDATE documents
      SET is_latest_version = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [oldDocumentId]);
    
    // Step 3: Upload new document
    const newDocumentId = await uploadDocument(newFile, {
      employee_id: oldDoc.employee_id,
      document_category: oldDoc.document_category,
      document_type: oldDoc.document_type,
      parent_document_id: oldDocumentId, // Link to old version
      version: oldDoc.version + 1,
      is_latest_version: true,
      replacement_reason: replacementReason
    });
    
    // Commit transaction
    await db.commit();
    
    return {
      success: true,
      oldDocumentId,
      newDocumentId,
      version: oldDoc.version + 1
    };
    
  } catch (error) {
    await db.rollback();
    throw error;
  }
}
```

**Get Document Version History**:
```javascript
async function getDocumentVersionHistory(documentId) {
  // Get all versions (parent chain)
  const versions = await db.query(`
    WITH RECURSIVE version_history AS (
      -- Base: Latest version
      SELECT id, parent_document_id, version, uploaded_at, file_name, 
             replacement_reason, created_by, is_latest_version
      FROM documents
      WHERE id = ?
      
      UNION ALL
      
      -- Recursive: Previous versions
      SELECT d.id, d.parent_document_id, d.version, d.uploaded_at, d.file_name,
             d.replacement_reason, d.created_by, d.is_latest_version
      FROM documents d
      JOIN version_history vh ON d.id = vh.parent_document_id
    )
    SELECT * FROM version_history
    ORDER BY version DESC
  `, [documentId]);
  
  return versions;
}

// Example: Show version history in UI
const history = await getDocumentVersionHistory(documentId);
console.log('Document Version History:');
history.forEach(v => {
  console.log(`Version ${v.version} - ${v.uploaded_at} ${v.is_latest_version ? '(LATEST)' : ''}`);
  if (v.replacement_reason) {
    console.log(`  Reason: ${v.replacement_reason}`);
  }
});
```

**Prevent Deletion of Old Versions**:
```sql
CREATE OR REPLACE FUNCTION prevent_old_version_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow deletion only of latest version
  IF OLD.is_latest_version = false AND NEW.is_deleted = true THEN
    RAISE EXCEPTION 'Cannot delete old document versions. Audit trail must be preserved.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_old_version_deletion
BEFORE UPDATE OF is_deleted ON documents
FOR EACH ROW
EXECUTE FUNCTION prevent_old_version_deletion();
```

**Business Rules**:
- Every document has a `version` number (starts at 1)
- When replacing a document, increment version and link to old via `parent_document_id`
- Mark old version as `is_latest_version = false`
- Maintain complete version history (cannot delete old versions)
- Show version history in UI with diff capability
- Track replacement reason for audit purposes

---

#### 2.6.9 Mandatory Documents & Onboarding Checklist

**Rule**: Define mandatory documents required for employee onboarding and prevent payroll activation until verified

**Mandatory Document List**:
```javascript
const MANDATORY_DOCUMENTS = {
  'Identity': [
    { type: 'Aadhar', description: 'Aadhar Card (Government ID)' },
    { type: 'PAN', description: 'PAN Card (Tax compliance)' }
  ],
  'Professional': [
    { type: 'Photo', description: 'Passport-size photograph' },
    { type: 'Educational Certificate', description: 'Highest degree certificate' }
  ],
  'Financial': [
    { type: 'Cancelled Cheque', description: 'Cancelled cheque or bank passbook' }
  ],
  'Compliance': [
    { type: 'Medical Fitness Certificate', description: 'Medical fitness certificate' }
  ]
};

function getMandatoryDocumentList() {
  const list = [];
  for (const [category, docs] of Object.entries(MANDATORY_DOCUMENTS)) {
    docs.forEach(doc => {
      list.push({
        category,
        type: doc.type,
        description: doc.description,
        mandatory: true
      });
    });
  }
  return list;
}
```

**Check Onboarding Completion**:
```javascript
async function checkOnboardingDocumentsStatus(employeeId) {
  const mandatoryList = getMandatoryDocumentList();
  const status = [];
  
  for (const mandatoryDoc of mandatoryList) {
    const uploaded = await db.query(`
      SELECT id, is_verified, uploaded_at
      FROM documents
      WHERE employee_id = ?
        AND document_category = ?
        AND document_type = ?
        AND is_deleted = false
        AND is_latest_version = true
      LIMIT 1
    `, [employeeId, mandatoryDoc.category, mandatoryDoc.type]);
    
    status.push({
      ...mandatoryDoc,
      uploaded: uploaded !== null,
      verified: uploaded?.is_verified || false,
      documentId: uploaded?.id,
      uploadedAt: uploaded?.uploaded_at
    });
  }
  
  const totalMandatory = status.length;
  const uploaded = status.filter(s => s.uploaded).length;
  const verified = status.filter(s => s.verified).length;
  const pending = status.filter(s => !s.uploaded);
  
  return {
    totalMandatory,
    uploaded,
    verified,
    pending,
    completionPercentage: Math.round((verified / totalMandatory) * 100),
    isComplete: verified === totalMandatory,
    details: status
  };
}

// Example
const onboardingStatus = await checkOnboardingDocumentsStatus('EMP-2026-0001');
console.log('Onboarding Progress:', onboardingStatus.completionPercentage + '%');
console.log('Verified:', onboardingStatus.verified, '/', onboardingStatus.totalMandatory);
console.log('Pending:', onboardingStatus.pending.map(p => p.type).join(', '));
```

**Prevent Payroll Activation**:
```javascript
async function canActivatePayroll(employeeId) {
  const onboardingStatus = await checkOnboardingDocumentsStatus(employeeId);
  
  if (!onboardingStatus.isComplete) {
    const pendingDocs = onboardingStatus.pending.map(p => p.type).join(', ');
    return {
      canActivate: false,
      message: `Cannot activate payroll. Pending mandatory documents: ${pendingDocs}`,
      completionPercentage: onboardingStatus.completionPercentage
    };
  }
  
  return {
    canActivate: true,
    message: 'All mandatory documents verified. Payroll can be activated.'
  };
}
```

**Onboarding Checklist UI**:
```javascript
// React component example
function OnboardingChecklist({ employeeId }) {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    fetchOnboardingStatus();
  }, []);
  
  async function fetchOnboardingStatus() {
    const data = await checkOnboardingDocumentsStatus(employeeId);
    setStatus(data);
  }
  
  return (
    <div>
      <h3>Onboarding Document Checklist</h3>
      <ProgressBar value={status?.completionPercentage} />
      <p>{status?.verified} / {status?.totalMandatory} documents verified</p>
      
      <ul>
        {status?.details.map(doc => (
          <li key={doc.type} style={{ color: doc.verified ? 'green' : 'red' }}>
            {doc.verified ? '✓' : '✗'} {doc.description}
            {!doc.uploaded && <button>Upload</button>}
            {doc.uploaded && !doc.verified && <span> (Pending verification)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Business Rules**:
- Define mandatory documents in system configuration
- Track onboarding completion percentage
- Employee profile shows "Incomplete" until all mandatory docs verified
- Cannot activate payroll until 100% completion
- Send reminders to employees for pending documents
- HR dashboard shows list of employees with incomplete onboarding

---

#### 2.6.10 Access Control, Confidentiality & Signed URLs

**Rule**: Implement role-based access control and generate time-limited signed URLs for secure document downloads

**Access Level Matrix**:
```javascript
const ACCESS_LEVELS = {
  'employee': ['employee', 'hr', 'admin'], // Employee can view if access_level = 'employee'
  'hr': ['hr', 'admin'], // HR and Admin can view
  'admin': ['admin'], // Only Admin can view
  'public': ['employee', 'hr', 'admin'] // Everyone can view
};

function canAccessDocument(userRole, documentAccessLevel) {
  const allowedRoles = ACCESS_LEVELS[documentAccessLevel];
  return allowedRoles?.includes(userRole) || false;
}
```

**Document Access Check**:
```javascript
async function getDocument(documentId, userId, userRole) {
  const document = await db.query(`
    SELECT d.*, e.employee_id
    FROM documents d
    JOIN employees e ON d.employee_id = e.employee_id
    WHERE d.id = ?
      AND d.is_deleted = false
  `, [documentId]);
  
  if (!document) {
    throw new Error('Document not found');
  }
  
  // Check if user is the employee (can view own documents)
  const isOwnDocument = document.employee_id === userId;
  
  // Check access level
  const hasAccess = isOwnDocument || canAccessDocument(userRole, document.access_level);
  
  if (!hasAccess) {
    // Audit unauthorized access attempt
    await db.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, status)
      VALUES (?, 'unauthorized_document_access', 'documents', ?, 'denied')
    `, [userId, documentId]);
    
    throw new Error('Access denied. You do not have permission to view this document.');
  }
  
  // Audit successful access
  await db.query(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, status)
    VALUES (?, 'document_accessed', 'documents', ?, 'success')
  `, [userId, documentId]);
  
  // Generate signed URL if cloud storage
  if (document.storage_type === 'cloud') {
    document.download_url = generateSignedURL(documentId, 900); // 15 minutes
  } else {
    document.file_data_base64 = document.file_data; // Database storage
  }
  
  return document;
}
```

**Generate Signed URL** (with expiry):
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

function generateSignedURL(documentId, expirySeconds = 900) {
  const document = db.query(`
    SELECT file_path, storage_bucket FROM documents WHERE id = ?
  `, [documentId]);
  
  const params = {
    Bucket: document.storage_bucket,
    Key: document.file_path,
    Expires: expirySeconds, // Default: 15 minutes
    ResponseContentDisposition: `attachment; filename="${document.file_name}"`
  };
  
  const signedURL = s3.getSignedUrl('getObject', params);
  
  return {
    url: signedURL,
    expiresIn: expirySeconds,
    expiresAt: new Date(Date.now() + (expirySeconds * 1000)).toISOString()
  };
}
```

**Watermark Documents**:
```javascript
const PDFDocument = require('pdf-lib');

async function addWatermarkToPDF(pdfBuffer, watermarkText) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  
  pages.forEach(page => {
    const { width, height } = page.getSize();
    
    page.drawText(watermarkText, {
      x: 50,
      y: height - 50,
      size: 10,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.5,
      rotate: degrees(0)
    });
  });
  
  const watermarkedPDF = await pdfDoc.save();
  return watermarkedPDF;
}

// Add watermark before download
async function downloadDocumentWithWatermark(documentId, userId) {
  const document = await getDocument(documentId, userId, userRole);
  
  // Download from S3
  const s3Params = {
    Bucket: document.storage_bucket,
    Key: document.file_path
  };
  const fileData = await s3.getObject(s3Params).promise();
  
  // Add watermark
  const watermarkText = `Downloaded by: ${userId} on ${new Date().toLocaleString()}\nConfidential - For Internal Use Only`;
  const watermarkedPDF = await addWatermarkToPDF(fileData.Body, watermarkText);
  
  return {
    data: watermarkedPDF,
    filename: document.file_name,
    mimetype: document.mime_type
  };
}
```

**Confidential Documents** (extra encryption):
```javascript
async function uploadConfidentialDocument(file, employeeId, documentType) {
  // Mark as confidential
  const is_confidential = ['PAN', 'Aadhar', 'Medical Certificate', 'Warning Letter'].includes(documentType);
  
  // Set access level
  const access_level = is_confidential ? 'admin' : 'hr';
  
  // Upload with encryption
  const documentId = await uploadDocument(file, {
    employee_id: employeeId,
    document_type: documentType,
    is_confidential,
    access_level
  });
  
  return documentId;
}
```

**Business Rules**:
- Access levels: `employee` (self), `hr` (HR team), `admin` (Admin only), `public` (all)
- Confidential documents (Aadhar, PAN, Medical, Disciplinary): Default to `admin` access
- Generate time-limited signed URLs (15 minutes expiry) for downloads
- Watermark documents with download timestamp and user details
- Audit all document access attempts (successful and denied)
- Encrypt sensitive documents with additional layer of security

---

### 2.17 Career History & Progression Rules

---

### 2.17 Career History & Progression Rules
**Rule**: Track employee career events with approvals, salary changes, and milestone detection

**Event Categories & Types**:
- **Career Events**: promotion, demotion, lateral_move, confirmation
- **Compensation Events**: increment, salary_revision, performance_bonus
- **Transfer Events**: department_transfer, location_transfer
- **Status Events**: resignation, termination, retirement, contract_renewal
- **Performance Events**: award, warning, suspension, reinstatement
- **Milestones**: 1-year, 5-year, 10-year anniversaries, first_promotion

**Promotion Workflow**:
1. Create promotion event with `approval_status = 'pending'`
2. Record old and new designations, old and new salaries
3. Auto-calculate salary increment (amount and percentage)
4. Attach promotion letter as supporting document
5. Approver reviews and approves/rejects
6. Upon approval:
   - Update employee's `designation_id` to new designation
   - Update employee's `ctc` to new salary
   - Recalculate full salary breakdown (basic, HRA, allowances)
   - Send notification email to employee
   - Generate promotion letter for download
7. Audit log tracks all changes

**Salary Increment Logic**:
- Auto-compute: `salary_increment_amount = new_salary_ctc - old_salary_ctc`
- Auto-compute: `salary_increment_percentage = ((new - old) / old) * 100`
- Trigger: `apply_career_event_to_employee()` updates employee record upon approval
- Store old and new salary breakdowns in JSONB for complete audit trail

**Retroactive Increments**:
- Support backdated increments: Set `is_retroactive = true`
- Record `retroactive_from_date` (when change should have taken effect)
- Calculate arrears: `arrears_amount = (new_salary - old_salary) * months_elapsed`
- Track arrears payment: `arrears_paid`, `arrears_payment_date`
- Payroll integration: Include arrears in next salary payment

**Department & Location Transfers**:
- Record old and new department/location
- Update employee's current department and location upon approval
- Optionally change reporting manager (cross-department transfers)
- Notify old and new managers via email
- Track transfer reason (business need, employee request, performance)

**Manager Changes**:
- Record old and new reporting managers
- Update employee's `reporting_manager_id` upon approval
- Validate: New manager must be valid employee in target department
- Prevent circular reporting: Employee cannot report to self or subordinate

**Employment Status Changes**:
- **Confirmation**: Mark probation completion, change status to 'confirmed'
- **Resignation**: Record resignation_date, last_working_date, exit_reason
- **Termination**: Record termination date, reason, eligibility for rehire
- **Retirement**: Record retirement date, mark as 'retired' in employee status
- **Contract Renewal**: Extend contract end date for contract employees

**Exit Management**:
- Resignation: Trigger exit workflow (asset return, clearance, exit interview)
- Record: `exit_reason`, `exit_interview_completed`, `exit_interview_feedback`
- Determine `rehire_eligible` based on exit circumstances
- Full & Final Settlement: Link to payroll for final dues calculation
- Offboarding: Auto-update employee status to 'exited'
- View: `v_upcoming_exits` shows all employees with future last working dates

**Approval Workflow**:
- Default status: 'pending' (awaiting approval)
- Approver hierarchy: Manager → HR → Admin (multi-level for promotions)
- Upon approval:
  - Update employee record with new values
  - Send notifications to employee and stakeholders
  - Generate letters (promotion letter, increment letter, etc.)
- Rejection: Record reason in `approval_comments`, no changes to employee record
- On-hold: Temporarily pause approval (pending additional documents/review)

**Performance Integration**:
- Link career events to performance reviews via `performance_review_id`
- Record `performance_rating` for context (promotions based on performance)
- Track performance bonuses separately from regular increments
- Annual increment cycle: Batch create events for all eligible employees

**Disciplinary Actions**:
- Record warnings (verbal, written, final) with reasons
- Track suspensions (start date, end date, reason)
- Link to HR policy violations or performance issues
- Visibility: Confidential (accessible only to HR and Admin)
- Impact on career: Flag for consideration during promotions/increments

**Milestone Tracking**:
- Auto-detect milestones: 1-year, 5-year, 10-year work anniversaries
- Mark first promotion, first award as milestones
- Trigger: `detect_career_milestones()` auto-sets `is_milestone = true`
- Generate appreciation certificates/emails for milestones
- Dashboard: Upcoming milestones widget for HR planning

**Document Attachments**:
- Attach supporting documents: Offer letters, appraisal letters, approval emails
- Store document IDs in `document_ids` array (references to `documents` table)
- Required documents:
  - Promotion letter (promotion)
  - Increment letter (increment)
  - Warning letter (warning)
  - Resignation letter (resignation)

**Notifications**:
- Auto-send email notification to employee upon approval
- Notify manager on status changes (confirmation, transfer, exit)
- Notify HR on disciplinary actions
- Track: `notification_sent`, `notification_sent_at`
- Email templates: Customizable for each event type

**Visibility & Privacy**:
- **Public**: Visible to all employees (awards, milestones)
- **Internal**: Visible to HR, managers, and employee (promotions, increments)
- **Confidential**: Visible only to HR and Admin (warnings, terminations)
- Employee can always view own career history (all events)

**Timeline & Reporting**:
- Employee profile: Display career timeline (chronological view)
- View: `v_employee_career_timeline` shows all events for an employee
- Analytics: Average time to promotion, increment trends, turnover analysis
- Reports: Promotion pipeline, pending confirmations, upcoming resignations
- Export: Career history as PDF for employee records

**Data Integrity & Audit**:
- Immutable records: Once approved, cannot be edited (only add correction entries)
- Full audit trail: Track `created_by`, `updated_by`, timestamps
- Audit log: All career events logged to `audit_logs` table
- Archival: Retain career history for 10 years after employee exit

**Example Promotion Scenario**:
```
Employee: John Doe (EMP-2023-001)
Current Designation: Software Engineer (Grade B)
Current CTC: ₹800,000
New Designation: Senior Software Engineer (Grade A)
New CTC: ₹1,000,000
Increment: ₹200,000 (25%)

1. Manager creates promotion event:
   CALL create_promotion('EMP-2023-001', <senior_engineer_id>, 1000000, '2026-02-01', <manager_user_id>);

2. Event created with approval_status = 'pending'

3. HR reviews and approves:
   UPDATE career_history SET approval_status = 'approved', approved_by = <hr_user_id>, approval_date = CURRENT_DATE
   WHERE id = <event_id>;

4. Trigger applies changes to employee record:
   - designation_id → Senior Software Engineer
   - ctc → 1,000,000
   - basic → 41,667 (recalculated)
   - [All salary components recalculated]

5. Notification sent to John Doe:
   "Congratulations! You have been promoted to Senior Software Engineer effective February 1, 2026."

6. Promotion letter generated for download

7. Career history updated with approved event
```

---

## 3. Salary Calculation Rules

### 3.1 Basic Salary Calculation
**Rule**: Basic salary is 50% of annual CTC divided by 12

**Formula**:
```
monthly_basic = (annual_ctc × 0.50) / 12
```

**Example**:
```
CTC = ₹1,200,000
Basic = (1,200,000 × 0.50) / 12 = ₹50,000/month
```

**Constraint**:
- Basic must always be exactly 50% of CTC
- Database check constraint enforces this

---

### 2.2 HRA Calculation
**Rule**: HRA is a percentage of monthly basic salary

**Formula**:
```
monthly_hra = monthly_basic × (hra_percentage / 100)
```

**Typical Values**:
- HRA Percentage: 40%, 50% (common in India)
- Can vary by location and company policy

**Example**:
```
Basic = ₹50,000
HRA % = 40%
HRA = ₹50,000 × 0.40 = ₹20,000
```

---

### 2.3 Special Allowance (Balancing Component)
**Rule**: Special allowance is the balancing amount to match CTC after all components

**Formula (Iterative)**:
```
Step 1: Calculate initial components
- Basic = CTC × 0.5 / 12
- HRA = Basic × HRA%
- Conveyance, Telephone, Medical = Fixed amounts

Step 2: Calculate employer contributions
- Employer PF = min(Basic, 15000) × 0.12
- Employer ESI = Gross × 0.0325 (if applicable)
- Gratuity provision = Basic × 12 × 0.0481 (if PF and ESI both included)

Step 3: Balance CTC
CTC = Gross × 12 + Employer PF × 12 + Employer ESI × 12 + Gratuity

Step 4: Adjust special allowance
Special Allowance = (CTC - Basic × 12 - HRA × 12 - Conveyance × 12 - Telephone × 12 - Medical × 12 - Employer PF × 12 - Employer ESI × 12 - Gratuity) / 12

Iterate 5-10 times until CTC matches
```

**Note**: Special allowance absorbs rounding differences

---

### 2.4 Gross Salary Calculation
**Rule**: Gross is the sum of all monthly earnings

**Formula**:
```
gross = basic + hra + conveyance + telephone + medical_allowance + special_allowance
```

---

### 2.5 PF (Provident Fund) Calculation

#### Employee PF Deduction
**Rule**: 12% of basic salary, capped at PF wage ceiling

**Formula**:
```
pf_wage = min(basic, 15000)
employee_pf = pf_wage × 0.12
```

**Example**:
```
Basic = ₹80,000
PF Wage = min(80000, 15000) = ₹15,000
Employee PF = ₹15,000 × 0.12 = ₹1,800
```

**Constants**:
- PF Wage Ceiling: ₹15,000/month
- Employee PF Rate: 12%
- Employer PF Rate: 12%

**Applicability**:
- Controlled by `include_pf` flag
- If `include_pf = false`, PF deduction = 0

---

#### Employer PF Contribution
**Rule**: 12% of PF wage, added to CTC

**Formula**:
```
employer_pf = pf_wage × 0.12
```

**Business Logic**:
- Employer contribution is part of CTC but not part of take-home
- Contributed to employee's PF account

---

### 2.6 ESI (Employee State Insurance) Calculation

#### ESI Applicability
**Rule**: ESI applicable only if monthly gross < ₹21,000

**Condition**:
```
if (gross < 21000 AND include_esi = true):
    apply ESI
else:
    ESI = 0
```

#### Employee ESI Deduction
**Formula**:
```
employee_esi = gross × 0.0075
```

**Example**:
```
Gross = ₹20,000
Employee ESI = ₹20,000 × 0.0075 = ₹150
```

#### Employer ESI Contribution
**Formula**:
```
employer_esi = gross × 0.0325
```

**Example**:
```
Gross = ₹20,000
Employer ESI = ₹20,000 × 0.0325 = ₹650
```

**Constants**:
- ESI Wage Ceiling: ₹21,000/month
- Employee ESI Rate: 0.75%
- Employer ESI Rate: 3.25%

---

### 2.7 Professional Tax Calculation
**Rule**: Professional tax based on gross salary slabs

**Slab Structure (Karnataka)**:
```
Gross ≤ ₹15,000: PT = ₹0
Gross > ₹15,000 and ≤ ₹25,000: PT = ₹150
Gross > ₹25,000: PT = ₹200
```

**Current Implementation**:
```
if (gross > 25000):
    professional_tax = 200
else:
    professional_tax = 0
```

**Note**: PT varies by state; configuration should be flexible

---

### 2.8 TDS (Tax Deducted at Source) Calculation
**Rule**: TDS is a percentage of gross salary (optional)

**Formula**:
```
monthly_tds = gross × (tds_percentage / 100)
annual_tds = monthly_tds × 12
```

**Business Logic**:
- TDS percentage is configurable per employee
- Typically 0-30% based on tax slab
- User-provided or calculated by tax calculator
- Not auto-calculated in current system

---

### 2.9 Gratuity Provision
**Rule**: Gratuity provision approximately 4.81% of annual basic

**Formula**:
```
gratuity_annual = monthly_basic × 12 × 0.0481
```

**Applicability**:
- Only when **both** PF and ESI are included
- Part of CTC calculation
- Not a monthly deduction; provision for future payment

---

### 2.10 Net Salary Calculation
**Rule**: Net salary is gross minus all deductions

**Formula**:
```
net = gross - employee_pf - employee_esi - professional_tax - tds_monthly
```

**Validation**:
- Net must be positive
- If net is negative, salary structure is invalid

---

### 2.11 CTC Verification
**Rule**: Annual CTC must match the sum of all components

**Formula**:
```
ctc = (gross × 12) + (employer_pf × 12) + (employer_esi × 12) + gratuity_annual
```

**Tolerance**: Allow ±₹10 difference for rounding

---

## 3. Attendance Rules

### 3.1 Payable Days Calculation
**Rule**: Payable days = Present days + Paid leave

**Formula**:
```
payable_days = present_days + paid_leave
```

**Auto-calculated**: Stored as computed column in database

---

### 3.2 Loss of Pay Days Calculation
**Rule**: LOP days = Unpaid leave + Absent days

**Formula**:
```
loss_of_pay_days = unpaid_leave + absent_days
```

**Auto-calculated**: Stored as computed column in database

---

### 3.3 Attendance Validation
**Rule**: Total attendance components cannot exceed working days

**Constraint**:
```
present_days + absent_days + paid_leave + unpaid_leave ≤ total_working_days
```

**Also**:
```
payable_days + loss_of_pay_days ≤ total_working_days
```

---

### 3.4 Working Days Range
**Rule**: Total working days must be reasonable

**Validation**:
```
0 < total_working_days ≤ 31
Typical: 26-30 days
```

---

### 3.5 Monthly Attendance Uniqueness
**Rule**: One attendance record per employee per month-year

**Constraint**:
```
UNIQUE (employee_id, month, year)
```

**Business Logic**:
- Update existing record if found
- Create new record if not found

---

## 5. Payroll Processing Rules

### 5.1 Pay Run Generation Eligibility
**Rule**: Only active employees are included in pay runs

**Filter**:
```
employees WHERE status = 'active'
```

---

### 4.2 Attendance-Based Pro-Rating
**Rule**: Salary components are pro-rated based on attendance

**Formulas**:
```
attendance_ratio = payable_days / total_working_days
adjusted_basic = basic × attendance_ratio
adjusted_allowances = (hra + conveyance + telephone + medical + special) × attendance_ratio
```

**Alternative (LOP Approach)**:
```
salary_per_day = basic / total_working_days
lop_amount = loss_of_pay_days × salary_per_day
adjusted_basic = basic - lop_amount
```

**Current Implementation**: Uses LOP approach

---

### 4.3 Advance Deduction Processing
**Rule**: Advances are deducted in the specified deduction month

**Logic**:
```
For each advance_record WHERE:
    - employee_id = current_employee
    - advance_deduction_month = current_month
    - advance_deduction_year = current_year
    - status = 'pending'
    
Deduct: advance_paid_amount
Update status: 'deducted'
```

**Business Rule**:
- Typically full amount deducted in single month
- Status 'partial' allows multiple deductions

---

### 4.4 Loan EMI Deduction Processing
**Rule**: EMIs are deducted monthly as per schedule

**Logic**:
```
For each loan_record WHERE:
    - employee_id = current_employee
    - status = 'active'
    
    For each loan_emi WHERE:
        - loan_id = current_loan
        - month = current_month
        - year = current_year
        - status = 'pending'
        
    Deduct: emi_amount
    Update emi status: 'paid'
    Update emi paid_date: current_timestamp
    Increment loan.total_paid_emis
    Update loan.remaining_balance
    
    If all EMIs paid:
        Update loan.status: 'completed'
```

---

### 4.5 Statutory Deduction Pro-Rating
**Rule**: PF, ESI, PT are pro-rated based on attendance

**Formula**:
```
attendance_ratio = payable_days / total_working_days
prorated_pf = pf_deduction × attendance_ratio
prorated_esi = esi_deduction × attendance_ratio
prorated_pt = professional_tax × attendance_ratio
prorated_tds = tds_monthly × attendance_ratio
```

---

### 4.6 Net Pay Calculation in Pay Run
**Rule**: Net pay includes all earnings and deductions

**Formula**:
```
net_pay = gross_salary - (
    advance_deduction +
    loan_deduction +
    pf_deduction +
    esi_deduction +
    professional_tax +
    tds +
    loss_of_pay_amount
)
```

**Validation**:
- Net pay must be ≥ 0
- If net pay < 0, flag for review

---

### 4.7 Pay Run Uniqueness
**Rule**: One pay run per month-year

**Constraint**:
```
UNIQUE (month, year)
```

**Business Logic**:
- If pay run exists for month-year, replace it
- Allows regeneration with updated data

---

### 4.8 Pay Run Status Workflow
**States**: draft → approved → processed → cancelled

**Transitions**:
```
draft → approved: HR reviews and approves
approved → processed: Payments executed
approved → cancelled: Cancelled before processing
processed → (no reversal): Financial records locked
```

---

## 5. Advance and Loan Rules

### 5.1 Advance Amount Validation
**Rule**: Advance amount must be positive

**Constraint**:
```
advance_paid_amount > 0
```

**Business Logic**:
- Typically ≤ 50% of monthly salary (policy-based)
- Requires manager approval (not enforced in DB)

---

### 5.2 Advance Deduction Month
**Rule**: Deduction month must be in the future

**Validation**:
```
advance_deduction_date > advance_paid_date
```

**Typical**: Deducted in next month

---

### 5.3 Loan Amount Validation
**Rule**: Loan amount must be positive

**Constraint**:
```
loan_amount > 0
```

**Business Logic**:
- Maximum loan amount based on salary (policy-based)
- Requires approval (not enforced in DB)

---

### 5.4 Loan Total Calculation
**Rule**: Total amount = Principal + Interest

**Formula**:
```
total_amount = loan_amount + (loan_amount × interest_rate / 100)
```

**Example**:
```
Loan Amount = ₹50,000
Interest Rate = 10%
Total = ₹50,000 + (₹50,000 × 0.10) = ₹55,000
```

---

### 5.5 EMI Amount Calculation
**Rule**: EMI is total divided by number of installments

**Formula**:
```
emi_amount = total_amount / number_of_emis
```

**Example**:
```
Total = ₹55,000
Number of EMIs = 12
EMI = ₹55,000 / 12 = ₹4,583.33
```

**Note**: Simple interest model; no EMI schedule complexities

---

### 5.6 EMI Schedule Generation
**Rule**: EMI schedule created when loan is created

**Logic**:
```
for i = 0 to number_of_emis - 1:
    emi_record = {
        emi_number: i + 1,
        month: calculate_month(start_month, i),
        year: calculate_year(start_year, i),
        emi_amount: emi_amount,
        status: 'pending'
    }
    save emi_record
```

**Month Calculation**:
```
month_index = (start_month_index + i) % 12
year_offset = floor((start_month_index + i) / 12)
```

---

### 5.7 Loan Status Updates
**Rules**:
- `active`: Loan is being repaid
- `completed`: All EMIs paid
- `cancelled`: Loan cancelled (manual action)

**Auto-update to completed**:
```
if (total_paid_emis == number_of_emis):
    status = 'completed'
```

---

### 5.8 Remaining Balance Update
**Rule**: Remaining balance decreases with each EMI payment

**Formula**:
```
remaining_balance = total_amount - (total_paid_emis × emi_amount)
```

---

## 6. Document Management Rules

### 6.1 Document Type Uniqueness
**Rule**: Each document type should be unique per employee

**Constraint**:
```
UNIQUE (employee_id, document_type)
```

**Behavior**:
- If uploading same type again, replace existing
- Or maintain versioning (future enhancement)

---

### 6.2 Supported Document Types
**Common Types**:
- Aadhar
- PAN
- Driving License
- Passport
- Resume
- Educational Certificates
- Bank Passbook

**Validation**:
- Document type should be from predefined list or free text

---

### 6.3 File Size Limits
**Rule**: Maximum file size per document

**Limit**: 5 MB (configurable)

**Validation**:
- Check file size before upload
- Store file_size in bytes

---

### 6.4 Supported File Formats
**Allowed Formats**:
- PDF: application/pdf
- Images: image/jpeg, image/png
- Word: application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document

---

## 7. Career History Rules (Replaced with comprehensive section 2.7)

**Note**: See section 2.7 Career History & Progression Rules for comprehensive documentation with 10 detailed sub-sections covering:
- 2.7.1 Event Categories & Type Classification
- 2.7.2 Promotion Workflow & Designation Updates
- 2.7.3 Salary Increment Processing & CTC Recalculation
- 2.7.4 Department & Location Transfers
- 2.7.5 Resignation & Exit Management
- 2.7.6 Performance Bonuses & Awards
- 2.7.7 Disciplinary Actions & Warnings
- 2.7.8 Milestone Auto-Detection & Celebration
- 2.7.9 Career Timeline & Analytics
- 2.7.10 Approval Workflows & Notifications

### 7.1 Event Types (Legacy)
**Types**:
- `promotion`: Employee promoted to higher designation
- `increment`: Salary increase without designation change
- `demotion`: Employee demoted to lower designation

---

### 7.2 Promotion Logic (Legacy)
**Requirements**:
- old_designation_id must be current designation
- new_designation_id must be different
- new_salary ≥ old_salary (typically)

**Side Effects**:
- Update employee.designation_id to new_designation_id
- Update employee salary information
- Create career_history record

---

### 7.3 Increment Logic (Legacy)
**Requirements**:
- new_salary > old_salary
- Designation remains same

**Side Effects**:
- Update employee salary information
- Create career_history record

---

### 7.4 Event Date Validation (Legacy)
**Rule**: Event date should not be in future

**Validation**:
```
event_date ≤ CURRENT_DATE
```

---

## 8. Letter Generation Rules

### 8.1 Template Placeholders
**Common Placeholders**:
```
{{employee_name}}
{{designation}}
{{department}}
{{join_date}}
{{salary_components}}
{{ctc}}
{{company_name}}
{{date}}
```

**Rendering**:
- Replace placeholders with actual employee data
- Format dates, numbers appropriately

---

### 8.2 Offer Letter Requirements
**Must Include**:
- Employee name and address
- Designation and department
- Salary breakdown (CTC, gross, net)
- Join date
- Probation period
- Terms and conditions

---

### 8.3 Appointment Letter Requirements
**Must Include**:
- Similar to offer letter
- More formal language
- Company letterhead
- Signature placeholders

---

## 9. System Configuration Rules

### 9.1 PF Configuration
**Current Constants**:
```
PF_WAGE_CEILING_MONTHLY = 15000
PF_EMPLOYEE_RATE = 0.12
PF_EMPLOYER_RATE = 0.12
```

**Update Frequency**: Annually or as per government notification

---

### 9.2 ESI Configuration
**Current Constants**:
```
ESI_WAGE_CEILING_MONTHLY = 21000
ESI_EMPLOYEE_RATE = 0.0075
ESI_EMPLOYER_RATE = 0.0325
```

**Update Frequency**: Annually or as per government notification

---

### 9.3 Professional Tax Configuration
**Current Slabs**:
```
PT = 200 if gross > 25000 else 0
```

**Note**: Should be state-specific and configurable

---

## 11. Data Validation Rules

### 11.1 Email Validation
**Format**:
```
Regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
```

---

### 10.2 Phone Number Validation
**Format** (India):
```
Regex: /^[6-9]\d{9}$/
10 digits starting with 6-9
```

---

### 10.3 IFSC Code Validation
**Format**:
```
Length: exactly 11 characters
Pattern: [A-Z]{4}0[A-Z0-9]{6}
Example: HDFC0001234
```

---

### 10.4 Date Validations
**Rules**:
- Date of birth: Must be 18+ years ago
- Join date: Should not be in future (unless onboarding)
- Event dates: Logical chronology

---

### 10.5 Numeric Validations
**Rules**:
- Salary amounts: > 0
- CTC: > 0 and reasonable range
- Percentages: 0 ≤ percentage ≤ 100
- Days: 0 ≤ days ≤ 31

---

## 11. Business Invariants

### 11.1 Employee Data Completeness
**Mandatory Fields**:
- first_name, last_name
- gender, contact_number, personal_email
- current_address
- department, designation
- employment_type, work_location
- official_email
- All salary components

---

### 11.2 Financial Consistency
**Invariants**:
```
ctc = (gross × 12) + (employer_pf × 12) + (employer_esi × 12) + gratuity ± tolerance
net = gross - deductions
```

---

### 11.3 Attendance Consistency
**Invariants**:
```
payable_days + loss_of_pay_days ≤ total_working_days
present_days + absent_days + paid_leave + unpaid_leave ≤ total_working_days
```

---

### 11.4 Loan Consistency
**Invariants**:
```
total_amount = loan_amount × (1 + interest_rate / 100)
emi_amount × number_of_emis = total_amount ± rounding
remaining_balance = total_amount - (total_paid_emis × emi_amount)
```

---

## 13. Authorization and Access Rules (Legacy)

### 13.1 User Roles
**Roles** (future implementation):
- admin: Full access
- hr: Employee management, payroll
- manager: Team management, approvals
- employee: Self-service, view own data

---

### 12.2 Data Access Rules
**Rules**:
- Employees can view only their own data
- Managers can view their team's data
- HR can view all employee data
- Admin has full access

---

### 12.3 Operation Permissions
**Examples**:
- Create employee: HR, Admin
- Approve advance: Manager, Admin
- Generate pay run: HR, Admin
- View salary: Self, HR, Admin

---

## Summary

This document has captured:
- **60+ business rules** extracted from frontend
- **Salary calculation formulas** with Indian statutory compliance (PF, ESI, PT, TDS)
- **Attendance and payroll processing logic**
- **Advance and loan management rules**
- **Data validation and integrity rules**
- **Business invariants and constraints**
- **Authorization framework** (for future implementation)

These rules must be implemented in:
1. **Database constraints**: Check constraints, computed columns
2. **Application layer**: Business logic, validation
3. **API layer**: Input validation, authorization
4. **Frontend**: User feedback, pre-validation

All rules are derived from the existing frontend implementation and represent the current business logic of the EcoVale HR system.

---

## 3. Organizational Structure Management Rules

### 3.1 Department Structure & Management
**Rule**: Define and manage organizational departments with hierarchy, budgets, and employee assignment controls

**Purpose**: Organize employees into logical departments, track department heads, manage budgets, enable department-level reporting, and support organizational restructuring.

---

#### 3.1.1 Department Creation & Configuration

**Rule**: Create departments with unique names and clear organizational purpose

**Department Structure**:
```javascript
const DEPARTMENT_SCHEMA = {
  id: 'INT AUTO_INCREMENT PRIMARY KEY',
  code: 'VARCHAR(10) UNIQUE', // Short code: 'IT', 'HR', 'FIN', 'SALES'
  name: 'VARCHAR(100) UNIQUE NOT NULL', // Full name: 'Information Technology'
  short_name: 'VARCHAR(50)', // Display name: 'IT Department'
  description: 'TEXT', // Department purpose and responsibilities
  head_employee_id: 'VARCHAR(20) FOREIGN KEY', // Department head
  parent_department_id: 'INT FOREIGN KEY NULL', // For sub-departments
  department_type: 'ENUM', // 'core', 'support', 'business', 'operations'
  cost_center_code: 'VARCHAR(20)', // Accounting cost center
  location: 'VARCHAR(100)', // Primary location
  email: 'VARCHAR(255)', // Department email (e.g., hr@ecovale.com)
  phone: 'VARCHAR(20)', // Department phone
  budget_annual: 'DECIMAL(15,2)', // Annual budget
  employee_count: 'INT DEFAULT 0', // Auto-calculated
  is_active: 'BOOLEAN DEFAULT true',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};

// Predefined departments (initial setup)
const CORE_DEPARTMENTS = [
  {
    code: 'IT',
    name: 'Information Technology',
    short_name: 'IT',
    department_type: 'core',
    description: 'Manages technology infrastructure, software development, and IT support'
  },
  {
    code: 'HR',
    name: 'Human Resources',
    short_name: 'HR',
    department_type: 'support',
    description: 'Handles recruitment, employee relations, payroll, and compliance'
  },
  {
    code: 'FIN',
    name: 'Finance & Accounts',
    short_name: 'Finance',
    department_type: 'core',
    description: 'Manages financial planning, accounting, and reporting'
  },
  {
    code: 'SALES',
    name: 'Sales & Business Development',
    short_name: 'Sales',
    department_type: 'business',
    description: 'Drives revenue generation and customer acquisition'
  },
  {
    code: 'MKT',
    name: 'Marketing & Communications',
    short_name: 'Marketing',
    department_type: 'business',
    description: 'Brand management, marketing campaigns, and customer engagement'
  },
  {
    code: 'OPS',
    name: 'Operations',
    short_name: 'Operations',
    department_type: 'operations',
    description: 'Manages day-to-day business operations and logistics'
  },
  {
    code: 'ADMIN',
    name: 'Administration',
    short_name: 'Admin',
    department_type: 'support',
    description: 'Facilities management, procurement, and administrative support'
  }
];
```

**Department Creation**:
```javascript
async function createDepartment(departmentData) {
  // Validate unique name
  const existing = await db.query(`
    SELECT id FROM departments WHERE name = ? OR code = ?
  `, [departmentData.name, departmentData.code]);
  
  if (existing) {
    throw new Error(`Department with name "${departmentData.name}" or code "${departmentData.code}" already exists`);
  }
  
  // Validate parent department (if sub-department)
  if (departmentData.parent_department_id) {
    const parent = await db.query(`
      SELECT id, is_active FROM departments WHERE id = ?
    `, [departmentData.parent_department_id]);
    
    if (!parent) {
      throw new Error('Parent department not found');
    }
    
    if (!parent.is_active) {
      throw new Error('Cannot create sub-department under inactive parent');
    }
  }
  
  // Validate department head (if provided)
  if (departmentData.head_employee_id) {
    const head = await db.query(`
      SELECT employee_id, employment_status FROM employees
      WHERE employee_id = ?
    `, [departmentData.head_employee_id]);
    
    if (!head) {
      throw new Error('Department head employee not found');
    }
    
    if (head.employment_status !== 'active' && head.employment_status !== 'confirmed') {
      throw new Error('Department head must be an active employee');
    }
  }
  
  // Create department
  const departmentId = await db.query(`
    INSERT INTO departments (
      code, name, short_name, description, head_employee_id,
      parent_department_id, department_type, cost_center_code,
      location, email, phone, budget_annual, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
    RETURNING id
  `, [
    departmentData.code,
    departmentData.name,
    departmentData.short_name,
    departmentData.description,
    departmentData.head_employee_id,
    departmentData.parent_department_id,
    departmentData.department_type,
    departmentData.cost_center_code,
    departmentData.location,
    departmentData.email,
    departmentData.phone,
    departmentData.budget_annual
  ]);
  
  // Audit log
  await db.query(`
    INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('department_created', 'departments', ?, ?)
  `, [departmentId, JSON.stringify(departmentData)]);
  
  return { success: true, departmentId };
}
```

**Business Rules**:
- Department name must be unique across organization
- Department code must be unique and uppercase (2-10 characters)
- Description is mandatory for clarity
- Department type: core, support, business, operations
- Support sub-departments via parent_department_id
- Track cost center for accounting integration
- Department email format: {code}@ecovale.com

---

#### 3.1.2 Department Head Assignment & Succession

**Rule**: Assign qualified employees as department heads with proper authorization

**Head Assignment**:
```javascript
async function assignDepartmentHead(departmentId, employeeId, assignedBy) {
  // Fetch department
  const department = await db.query(`
    SELECT id, name, head_employee_id FROM departments WHERE id = ?
  `, [departmentId]);
  
  if (!department) {
    throw new Error('Department not found');
  }
  
  // Fetch employee
  const employee = await db.query(`
    SELECT employee_id, first_name, last_name, designation_id, department_id, employment_status
    FROM employees WHERE employee_id = ?
  `, [employeeId]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Validations
  if (employee.employment_status !== 'active' && employee.employment_status !== 'confirmed') {
    throw new Error('Only active employees can be department heads');
  }
  
  if (employee.department_id !== departmentId) {
    throw new Error('Employee must belong to the department to be assigned as head');
  }
  
  // Check if employee has managerial designation
  const designation = await db.query(`
    SELECT level FROM designations WHERE id = ?
  `, [employee.designation_id]);
  
  if (designation.level > 3) {
    console.warn('Warning: Assigning non-managerial employee as department head');
  }
  
  const oldHeadId = department.head_employee_id;
  
  // Update department
  await db.query(`
    UPDATE departments
    SET head_employee_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [employeeId, departmentId]);
  
  // Create career history event (promotion/assignment)
  await db.query(`
    INSERT INTO career_history (
      employee_id, event_category, event_type, event_date,
      reason, approval_status, visibility
    ) VALUES (?, 'career_progression', 'department_head_assigned', CURRENT_DATE,
      ?, 'approved', 'internal')
  `, [
    employeeId,
    `Assigned as Head of ${department.name}`
  ]);
  
  // Notify new head
  await sendNotification(employeeId, {
    type: 'department_head_assigned',
    message: `You have been assigned as Head of ${department.name}`,
    departmentId
  });
  
  // Notify old head (if exists)
  if (oldHeadId) {
    await sendNotification(oldHeadId, {
      type: 'department_head_removed',
      message: `You are no longer Head of ${department.name}`,
      departmentId
    });
  }
  
  // Audit log
  await db.query(`
    INSERT INTO audit_logs (action, entity_type, entity_id, details, user_id)
    VALUES ('department_head_assigned', 'departments', ?, ?, ?)
  `, [
    departmentId,
    JSON.stringify({ oldHeadId, newHeadId: employeeId }),
    assignedBy
  ]);
  
  return { success: true, message: 'Department head assigned successfully' };
}

// Remove department head
async function removeDepartmentHead(departmentId, reason, removedBy) {
  const department = await db.query(`
    SELECT id, name, head_employee_id FROM departments WHERE id = ?
  `, [departmentId]);
  
  if (!department.head_employee_id) {
    throw new Error('Department does not have a head assigned');
  }
  
  const oldHeadId = department.head_employee_id;
  
  await db.query(`
    UPDATE departments
    SET head_employee_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [departmentId]);
  
  // Notify removed head
  await sendNotification(oldHeadId, {
    type: 'department_head_removed',
    message: `You are no longer Head of ${department.name}. Reason: ${reason}`,
    departmentId
  });
  
  return { success: true, message: 'Department head removed' };
}
```

**Business Rules**:
- Department head must be an active employee
- Head must belong to the same department
- Preferably managerial level (designation level ≤ 3)
- Track head assignment in career history
- Notify both old and new heads
- Support succession planning (temporary/permanent)

---

#### 3.1.3 Employee Department Assignment & Transfers

**Rule**: Manage employee assignments to departments with transfer tracking

**Assign Employee to Department**:
```javascript
async function assignEmployeeToDepartment(employeeId, departmentId) {
  // Fetch current department
  const employee = await db.query(`
    SELECT employee_id, department_id, first_name, official_email
    FROM employees WHERE employee_id = ?
  `, [employeeId]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Check if already in target department
  if (employee.department_id === departmentId) {
    return { success: false, message: 'Employee is already in this department' };
  }
  
  // Validate target department
  const department = await db.query(`
    SELECT id, name, is_active FROM departments WHERE id = ?
  `, [departmentId]);
  
  if (!department) {
    throw new Error('Department not found');
  }
  
  if (!department.is_active) {
    throw new Error('Cannot assign employee to inactive department');
  }
  
  const oldDepartmentId = employee.department_id;
  
  // Update employee department
  await db.query(`
    UPDATE employees
    SET department_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = ?
  `, [departmentId, employeeId]);
  
  // Update employee counts
  await updateDepartmentEmployeeCount(oldDepartmentId);
  await updateDepartmentEmployeeCount(departmentId);
  
  // Create career history transfer event
  await db.query(`
    INSERT INTO career_history (
      employee_id, event_category, event_type, event_date,
      old_department_id, new_department_id,
      reason, approval_status
    ) VALUES (?, 'transfer', 'department_transfer', CURRENT_DATE,
      ?, ?, 'Department assignment', 'approved')
  `, [employeeId, oldDepartmentId, departmentId]);
  
  // Notify employee
  await sendNotification(employeeId, {
    type: 'department_changed',
    message: `You have been assigned to ${department.name}`,
    departmentId
  });
  
  return { success: true, message: 'Employee assigned to department' };
}

// Update employee count (auto-calculated)
async function updateDepartmentEmployeeCount(departmentId) {
  const count = await db.query(`
    SELECT COUNT(*) as count FROM employees
    WHERE department_id = ?
      AND employment_status IN ('active', 'confirmed', 'probation')
  `, [departmentId]);
  
  await db.query(`
    UPDATE departments
    SET employee_count = ?
    WHERE id = ?
  `, [count.count, departmentId]);
}
```

**SQL Trigger** (Auto-update employee count):
```sql
CREATE OR REPLACE FUNCTION update_department_employee_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update old department count (if changed)
  IF TG_OP = 'UPDATE' AND OLD.department_id IS DISTINCT FROM NEW.department_id THEN
    UPDATE departments
    SET employee_count = (
      SELECT COUNT(*) FROM employees
      WHERE department_id = OLD.department_id
        AND employment_status IN ('active', 'confirmed', 'probation')
    )
    WHERE id = OLD.department_id;
  END IF;
  
  -- Update new department count
  UPDATE departments
  SET employee_count = (
    SELECT COUNT(*) FROM employees
    WHERE department_id = NEW.department_id
      AND employment_status IN ('active', 'confirmed', 'probation')
  )
  WHERE id = NEW.department_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_department_employee_count
AFTER INSERT OR UPDATE OF department_id, employment_status ON employees
FOR EACH ROW
EXECUTE FUNCTION update_department_employee_count();
```

**Business Rules**:
- Employees can only be assigned to active departments
- Track department transfers in career history
- Auto-update department employee_count
- Notify employee of department change
- Support bulk department transfers (restructuring)

---

#### 3.1.4 Department Hierarchy & Sub-Departments

**Rule**: Support multi-level department hierarchy for large organizations

**Hierarchy Structure**:
```javascript
// Example hierarchy:
// IT (parent)
//   ├── Software Development (sub)
//   ├── Infrastructure (sub)
//   └── IT Support (sub)
// HR (parent)
//   ├── Recruitment (sub)
//   └── Payroll (sub)

async function createSubDepartment(parentDepartmentId, subDepartmentData) {
  // Validate parent exists
  const parent = await db.query(`
    SELECT id, name, is_active FROM departments WHERE id = ?
  `, [parentDepartmentId]);
  
  if (!parent) {
    throw new Error('Parent department not found');
  }
  
  if (!parent.is_active) {
    throw new Error('Cannot create sub-department under inactive parent');
  }
  
  // Check depth limit (max 2 levels)
  const parentDepth = await getDepartmentDepth(parentDepartmentId);
  if (parentDepth >= 2) {
    throw new Error('Maximum department hierarchy depth (2 levels) exceeded');
  }
  
  // Create sub-department
  const subDeptId = await createDepartment({
    ...subDepartmentData,
    parent_department_id: parentDepartmentId
  });
  
  return subDeptId;
}

// Get department depth in hierarchy
async function getDepartmentDepth(departmentId) {
  const result = await db.query(`
    WITH RECURSIVE dept_hierarchy AS (
      SELECT id, parent_department_id, 0 as depth
      FROM departments
      WHERE id = ?
      
      UNION ALL
      
      SELECT d.id, d.parent_department_id, dh.depth + 1
      FROM departments d
      JOIN dept_hierarchy dh ON d.id = dh.parent_department_id
    )
    SELECT MAX(depth) as max_depth FROM dept_hierarchy
  `, [departmentId]);
  
  return result.max_depth || 0;
}

// Get full department hierarchy
async function getDepartmentHierarchy() {
  const hierarchy = await db.query(`
    WITH RECURSIVE dept_tree AS (
      -- Root departments (no parent)
      SELECT id, code, name, parent_department_id, head_employee_id,
             employee_count, is_active, 0 as level,
             CAST(name AS VARCHAR(1000)) as path
      FROM departments
      WHERE parent_department_id IS NULL
      
      UNION ALL
      
      -- Child departments
      SELECT d.id, d.code, d.name, d.parent_department_id, d.head_employee_id,
             d.employee_count, d.is_active, dt.level + 1,
             CAST(dt.path || ' > ' || d.name AS VARCHAR(1000))
      FROM departments d
      JOIN dept_tree dt ON d.parent_department_id = dt.id
    )
    SELECT * FROM dept_tree
    ORDER BY path
  `);
  
  return hierarchy;
}

// Get department with all sub-departments
async function getDepartmentWithChildren(departmentId) {
  const tree = await db.query(`
    WITH RECURSIVE dept_subtree AS (
      SELECT id, code, name, parent_department_id, employee_count, is_active
      FROM departments
      WHERE id = ?
      
      UNION ALL
      
      SELECT d.id, d.code, d.name, d.parent_department_id, d.employee_count, d.is_active
      FROM departments d
      JOIN dept_subtree ds ON d.parent_department_id = ds.id
    )
    SELECT * FROM dept_subtree
  `, [departmentId]);
  
  return tree;
}
```

**Business Rules**:
- Support parent-child department relationships
- Maximum hierarchy depth: 2 levels (parent → child)
- Cannot create sub-department under inactive parent
- Recursive queries for hierarchy traversal
- Display hierarchy as tree structure in UI

---

#### 3.1.5 Department Budget Management

**Rule**: Track and monitor department budgets for financial planning

**Budget Allocation**:
```javascript
async function allocateDepartmentBudget(departmentId, budgetData) {
  // Validate department
  const department = await db.query(`
    SELECT id, name FROM departments WHERE id = ?
  `, [departmentId]);
  
  if (!department) {
    throw new Error('Department not found');
  }
  
  // Update budget
  await db.query(`
    UPDATE departments
    SET budget_annual = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [budgetData.budget_annual, departmentId]);
  
  // Create budget record (for tracking)
  await db.query(`
    INSERT INTO department_budgets (
      department_id, fiscal_year, budget_allocated,
      budget_category, notes
    ) VALUES (?, ?, ?, ?, ?)
  `, [
    departmentId,
    budgetData.fiscal_year,
    budgetData.budget_annual,
    budgetData.category || 'operational',
    budgetData.notes
  ]);
  
  return { success: true, message: 'Budget allocated successfully' };
}

// Get budget utilization
async function getDepartmentBudgetUtilization(departmentId, fiscalYear) {
  // Get allocated budget
  const budget = await db.query(`
    SELECT budget_annual FROM departments WHERE id = ?
  `, [departmentId]);
  
  // Calculate actual expenses (from payroll)
  const expenses = await db.query(`
    SELECT SUM(net_salary) as total_salary_expense
    FROM payroll
    WHERE employee_id IN (
      SELECT employee_id FROM employees WHERE department_id = ?
    )
    AND fiscal_year = ?
  `, [departmentId, fiscalYear]);
  
  const budgetAllocated = budget.budget_annual || 0;
  const budgetUtilized = expenses.total_salary_expense || 0;
  const budgetRemaining = budgetAllocated - budgetUtilized;
  const utilizationPercentage = budgetAllocated > 0
    ? ((budgetUtilized / budgetAllocated) * 100).toFixed(2)
    : 0;
  
  return {
    departmentId,
    fiscalYear,
    budgetAllocated,
    budgetUtilized,
    budgetRemaining,
    utilizationPercentage: `${utilizationPercentage}%`,
    status: utilizationPercentage > 100 ? 'over_budget' : 
            utilizationPercentage > 90 ? 'near_limit' : 'within_budget'
  };
}
```

**Business Rules**:
- Track annual budget per department
- Monitor budget utilization (salary expenses)
- Alert when budget utilization exceeds 90%
- Support budget allocation per fiscal year
- Link to cost center for accounting

---

#### 3.1.6 Department Analytics & Reporting

**Rule**: Provide comprehensive analytics for department performance and composition

**Department Analytics**:
```javascript
async function getDepartmentAnalytics(departmentId) {
  const analytics = {};
  
  // 1. Employee composition
  const composition = await db.query(`
    SELECT 
      COUNT(*) as total_employees,
      COUNT(CASE WHEN gender = 'Male' THEN 1 END) as male_count,
      COUNT(CASE WHEN gender = 'Female' THEN 1 END) as female_count,
      COUNT(CASE WHEN employment_type = 'Full-Time' THEN 1 END) as fulltime_count,
      COUNT(CASE WHEN employment_type = 'Part-Time' THEN 1 END) as parttime_count,
      COUNT(CASE WHEN employment_type = 'Contract' THEN 1 END) as contract_count,
      AVG(TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())) as avg_age,
      AVG(TIMESTAMPDIFF(MONTH, join_date, CURDATE())) / 12 as avg_tenure_years
    FROM employees
    WHERE department_id = ?
      AND employment_status IN ('active', 'confirmed', 'probation')
  `, [departmentId]);
  
  analytics.composition = composition;
  
  // 2. Salary statistics
  const salary = await db.query(`
    SELECT 
      AVG(salary_ctc) as avg_ctc,
      MIN(salary_ctc) as min_ctc,
      MAX(salary_ctc) as max_ctc,
      SUM(salary_ctc) as total_ctc,
      AVG(net_salary) as avg_net
    FROM employees
    WHERE department_id = ?
      AND employment_status IN ('active', 'confirmed')
  `, [departmentId]);
  
  analytics.salary = salary;
  
  // 3. Turnover rate (last 12 months)
  const turnover = await db.query(`
    SELECT 
      COUNT(*) as resignations,
      AVG(tenure_months) as avg_tenure_at_exit
    FROM career_history
    WHERE employee_id IN (
      SELECT employee_id FROM employees WHERE department_id = ?
    )
    AND event_type = 'resignation'
    AND event_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
  `, [departmentId]);
  
  const turnoverRate = composition.total_employees > 0
    ? ((turnover.resignations / composition.total_employees) * 100).toFixed(2)
    : 0;
  
  analytics.turnover = {
    resignations: turnover.resignations,
    turnoverRate: `${turnoverRate}%`,
    avgTenureAtExit: turnover.avg_tenure_at_exit
  };
  
  // 4. Top designations
  const topDesignations = await db.query(`
    SELECT d.title, COUNT(*) as count
    FROM employees e
    JOIN designations d ON e.designation_id = d.id
    WHERE e.department_id = ?
      AND e.employment_status IN ('active', 'confirmed')
    GROUP BY d.title
    ORDER BY count DESC
    LIMIT 5
  `, [departmentId]);
  
  analytics.topDesignations = topDesignations;
  
  // 5. Attendance summary (current month)
  const attendance = await db.query(`
    SELECT 
      AVG(present_days) as avg_present_days,
      AVG(loss_of_pay_days) as avg_lop_days
    FROM attendance_records
    WHERE employee_id IN (
      SELECT employee_id FROM employees WHERE department_id = ?
    )
    AND month = MONTHNAME(CURDATE())
    AND year = YEAR(CURDATE())
  `, [departmentId]);
  
  analytics.attendance = attendance;
  
  return analytics;
}

// Department comparison report
async function compareDepartments() {
  const comparison = await db.query(`
    SELECT 
      d.id, d.name, d.employee_count,
      AVG(e.salary_ctc) as avg_ctc,
      SUM(e.salary_ctc) as total_payroll,
      d.budget_annual,
      ROUND((SUM(e.salary_ctc) / d.budget_annual * 100), 2) as budget_utilization
    FROM departments d
    LEFT JOIN employees e ON d.id = e.department_id
      AND e.employment_status IN ('active', 'confirmed')
    WHERE d.is_active = true
    GROUP BY d.id, d.name, d.employee_count, d.budget_annual
    ORDER BY d.name
  `);
  
  return comparison;
}
```

**Business Rules**:
- Track employee composition (gender, type, age, tenure)
- Monitor salary statistics (avg, min, max, total)
- Calculate turnover rate (resignations / total employees)
- Track top designations within department
- Monitor attendance patterns
- Compare departments for benchmarking

---

#### 3.1.7 Department Activation & Deactivation

**Rule**: Support department lifecycle management with soft delete

**Deactivate Department**:
```javascript
async function deactivateDepartment(departmentId, reason, deactivatedBy) {
  // Check if department has active employees
  const activeEmployees = await db.query(`
    SELECT COUNT(*) as count FROM employees
    WHERE department_id = ?
      AND employment_status IN ('active', 'confirmed', 'probation')
  `, [departmentId]);
  
  if (activeEmployees.count > 0) {
    throw new Error(`Cannot deactivate department. ${activeEmployees.count} active employees must be transferred first.`);
  }
  
  // Check for sub-departments
  const subDepartments = await db.query(`
    SELECT COUNT(*) as count FROM departments
    WHERE parent_department_id = ? AND is_active = true
  `, [departmentId]);
  
  if (subDepartments.count > 0) {
    throw new Error(`Cannot deactivate department. ${subDepartments.count} active sub-departments exist.`);
  }
  
  // Deactivate
  await db.query(`
    UPDATE departments
    SET is_active = false,
        head_employee_id = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [departmentId]);
  
  // Audit log
  await db.query(`
    INSERT INTO audit_logs (action, entity_type, entity_id, details, user_id)
    VALUES ('department_deactivated', 'departments', ?, ?, ?)
  `, [departmentId, JSON.stringify({ reason }), deactivatedBy]);
  
  return { success: true, message: 'Department deactivated' };
}

// Reactivate department
async function reactivateDepartment(departmentId, reactivatedBy) {
  // Check parent status (if sub-department)
  const department = await db.query(`
    SELECT id, parent_department_id FROM departments WHERE id = ?
  `, [departmentId]);
  
  if (department.parent_department_id) {
    const parent = await db.query(`
      SELECT is_active FROM departments WHERE id = ?
    `, [department.parent_department_id]);
    
    if (!parent.is_active) {
      throw new Error('Cannot reactivate sub-department. Parent department is inactive.');
    }
  }
  
  await db.query(`
    UPDATE departments
    SET is_active = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [departmentId]);
  
  return { success: true, message: 'Department reactivated' };
}
```

**Business Rules**:
- Cannot deactivate department with active employees
- Cannot deactivate department with active sub-departments
- Remove department head on deactivation
- Cannot reactivate sub-department if parent is inactive
- Maintain historical data (soft delete)
- Track deactivation reason in audit log

---

#### 3.1.8 Department Notifications & Communications

**Rule**: Centralized communication channels for department-wide announcements

**Send Department Announcement**:
```javascript
async function sendDepartmentAnnouncement(departmentId, announcementData) {
  // Get all active employees in department
  const employees = await db.query(`
    SELECT employee_id, first_name, official_email
    FROM employees
    WHERE department_id = ?
      AND employment_status IN ('active', 'confirmed', 'probation')
  `, [departmentId]);
  
  if (employees.length === 0) {
    return { success: false, message: 'No active employees in department' };
  }
  
  // Create announcement record
  const announcementId = await db.query(`
    INSERT INTO announcements (
      title, content, department_id, created_by, type
    ) VALUES (?, ?, ?, ?, 'department')
    RETURNING id
  `, [
    announcementData.title,
    announcementData.content,
    departmentId,
    announcementData.created_by
  ]);
  
  // Send email to all employees
  const emailPromises = employees.map(emp => 
    sendEmail({
      to: emp.official_email,
      subject: `[Department Announcement] ${announcementData.title}`,
      body: `
        Dear ${emp.first_name},
        
        ${announcementData.content}
        
        Best regards,
        ${announcementData.senderName || 'Department Head'}
      `
    })
  );
  
  await Promise.all(emailPromises);
  
  return {
    success: true,
    announcementId,
    recipientCount: employees.length
  };
}
```

**Business Rules**:
- Support department-wide announcements
- Email all active employees in department
- Track announcement delivery
- Department head can send announcements
- Support urgent vs regular announcements

---

#### 3.1.9 Department Metrics Dashboard

**Rule**: Real-time dashboard for department KPIs

**Dashboard Metrics**:
```javascript
async function getDepartmentDashboard(departmentId) {
  const dashboard = {};
  
  // Current metrics
  dashboard.snapshot = {
    totalEmployees: await getEmployeeCount(departmentId),
    departmentHead: await getDepartmentHead(departmentId),
    budgetUtilization: await getDepartmentBudgetUtilization(departmentId, new Date().getFullYear()),
    avgSalary: await getAverageSalary(departmentId),
    turnoverRate: await getTurnoverRate(departmentId),
    openPositions: await getOpenPositions(departmentId)
  };
  
  // Trends (last 12 months)
  dashboard.trends = {
    employeeGrowth: await getEmployeeGrowthTrend(departmentId),
    salaryTrend: await getSalaryTrend(departmentId),
    attendanceTrend: await getAttendanceTrend(departmentId)
  };
  
  // Alerts
  dashboard.alerts = [];
  
  if (dashboard.snapshot.budgetUtilization.utilizationPercentage > 90) {
    dashboard.alerts.push({
      type: 'warning',
      message: 'Budget utilization exceeds 90%'
    });
  }
  
  if (dashboard.snapshot.turnoverRate > 15) {
    dashboard.alerts.push({
      type: 'warning',
      message: `High turnover rate: ${dashboard.snapshot.turnoverRate}%`
    });
  }
  
  if (!dashboard.snapshot.departmentHead) {
    dashboard.alerts.push({
      type: 'info',
      message: 'No department head assigned'
    });
  }
  
  return dashboard;
}
```

**Business Rules**:
- Real-time department metrics
- Historical trends visualization
- Automated alerts for budget, turnover
- Department head dashboard access
- HR/Admin full access to all departments

---

#### 3.1.10 Department Export & Reporting

**Rule**: Export department data for analysis and compliance

**Export Department Data**:
```javascript
async function exportDepartmentReport(departmentId, format = 'csv') {
  // Get department details
  const department = await db.query(`
    SELECT * FROM departments WHERE id = ?
  `, [departmentId]);
  
  // Get all employees
  const employees = await db.query(`
    SELECT 
      e.employee_id, e.first_name, e.last_name, e.official_email,
      d.title as designation, e.employment_type, e.join_date,
      e.salary_ctc, e.gross_salary, e.net_salary,
      e.employment_status
    FROM employees e
    LEFT JOIN designations d ON e.designation_id = d.id
    WHERE e.department_id = ?
    ORDER BY e.join_date DESC
  `, [departmentId]);
  
  // Generate report
  const report = {
    department: department.name,
    exportDate: new Date().toISOString(),
    totalEmployees: employees.length,
    employees: employees
  };
  
  // Convert to format
  if (format === 'csv') {
    return convertToCSV(report.employees);
  } else if (format === 'json') {
    return JSON.stringify(report, null, 2);
  } else if (format === 'pdf') {
    return generatePDF(report);
  }
}
```

**Business Rules**:
- Export department employee list
- Support CSV, JSON, PDF formats
- Include salary data (based on permissions)
- Filter by employment status, date range
- Schedule monthly/quarterly reports

---

### 3.2 Designation Structure & Management
**Rule**: Define job roles, hierarchies, career paths, and salary bands within the organization

**Purpose**: Establish clear designation hierarchy, reporting structures, role definitions, career progression paths, and salary bands for organizational clarity and talent management.

---

#### 3.2.1 Designation Creation & Configuration

**Rule**: Create designations with clear hierarchy levels and reporting structures

**Designation Structure**:
```javascript
const DESIGNATION_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  code: 'VARCHAR(20) UNIQUE', // Short code: 'CEO', 'CTO', 'MGR-IT'
  title: 'VARCHAR(255) NOT NULL', // Full title: 'Chief Technology Officer'
  short_title: 'VARCHAR(100)', // Display: 'CTO'
  department_id: 'INT FOREIGN KEY NOT NULL', // Primary department
  description: 'TEXT', // Role responsibilities
  reporting_to_designation_id: 'UUID FOREIGN KEY NULL', // Reports to
  level: 'INT NOT NULL', // Hierarchy level (1=CEO, 2=CXO, 3=VP, 4=Director, etc.)
  grade: 'VARCHAR(10)', // Salary grade: 'E1', 'E2', 'M1', 'M2', etc.
  job_family: 'VARCHAR(100)', // Job family: 'Engineering', 'Sales', 'Operations'
  min_experience_years: 'INT', // Minimum experience required
  max_experience_years: 'INT', // Maximum experience for role
  skills_required: 'JSONB', // Array of required skills
  qualifications_required: 'JSONB', // Array of required qualifications
  min_salary_range: 'DECIMAL(12,2)', // Minimum CTC for designation
  max_salary_range: 'DECIMAL(12,2)', // Maximum CTC for designation
  is_managerial: 'BOOLEAN DEFAULT false', // Indicates people management role
  headcount_allocated: 'INT', // Number of positions allocated
  headcount_filled: 'INT DEFAULT 0', // Current filled positions
  is_active: 'BOOLEAN DEFAULT true',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};

// Predefined hierarchy levels
const HIERARCHY_LEVELS = {
  1: 'C-Level (CEO, CTO, CFO, COO)',
  2: 'Vice President',
  3: 'Director',
  4: 'Senior Manager',
  5: 'Manager',
  6: 'Team Lead / Supervisor',
  7: 'Senior Professional',
  8: 'Mid-Level Professional',
  9: 'Junior Professional',
  10: 'Entry Level / Trainee'
};

// Salary grades mapping
const SALARY_GRADES = {
  'C1': { level: 1, min: 5000000, max: 10000000 }, // C-Level
  'VP1': { level: 2, min: 3000000, max: 5000000 }, // VP
  'D1': { level: 3, min: 2000000, max: 3000000 }, // Director
  'M3': { level: 4, min: 1500000, max: 2000000 }, // Senior Manager
  'M2': { level: 5, min: 1000000, max: 1500000 }, // Manager
  'M1': { level: 6, min: 800000, max: 1200000 }, // Team Lead
  'E3': { level: 7, min: 600000, max: 900000 }, // Senior Professional
  'E2': { level: 8, min: 400000, max: 700000 }, // Mid-Level
  'E1': { level: 9, min: 250000, max: 500000 }, // Junior
  'T1': { level: 10, min: 180000, max: 300000 }  // Trainee
};
```

**Create Designation**:
```javascript
async function createDesignation(designationData) {
  // Validate unique title within department
  const existing = await db.query(`
    SELECT id FROM designations
    WHERE title = ? AND department_id = ?
  `, [designationData.title, designationData.department_id]);
  
  if (existing) {
    throw new Error(`Designation "${designationData.title}" already exists in this department`);
  }
  
  // Validate code uniqueness
  if (designationData.code) {
    const codeExists = await db.query(`
      SELECT id FROM designations WHERE code = ?
    `, [designationData.code]);
    
    if (codeExists) {
      throw new Error(`Designation code "${designationData.code}" already exists`);
    }
  }
  
  // Validate department exists
  const department = await db.query(`
    SELECT id, name FROM departments WHERE id = ?
  `, [designationData.department_id]);
  
  if (!department) {
    throw new Error('Department not found');
  }
  
  // Validate reporting designation
  if (designationData.reporting_to_designation_id) {
    const reportingDesignation = await db.query(`
      SELECT id, level FROM designations WHERE id = ?
    `, [designationData.reporting_to_designation_id]);
    
    if (!reportingDesignation) {
      throw new Error('Reporting designation not found');
    }
    
    // Validate hierarchy: reporting designation must be higher level (lower number)
    if (reportingDesignation.level >= designationData.level) {
      throw new Error('Reporting designation must be at a higher level (lower level number)');
    }
  }
  
  // Validate salary range
  if (designationData.min_salary_range && designationData.max_salary_range) {
    if (designationData.min_salary_range >= designationData.max_salary_range) {
      throw new Error('Minimum salary must be less than maximum salary');
    }
  }
  
  // Create designation
  const designationId = await db.query(`
    INSERT INTO designations (
      code, title, short_title, department_id, description,
      reporting_to_designation_id, level, grade, job_family,
      min_experience_years, max_experience_years,
      skills_required, qualifications_required,
      min_salary_range, max_salary_range,
      is_managerial, headcount_allocated, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
    RETURNING id
  `, [
    designationData.code,
    designationData.title,
    designationData.short_title,
    designationData.department_id,
    designationData.description,
    designationData.reporting_to_designation_id,
    designationData.level,
    designationData.grade,
    designationData.job_family,
    designationData.min_experience_years,
    designationData.max_experience_years,
    JSON.stringify(designationData.skills_required || []),
    JSON.stringify(designationData.qualifications_required || []),
    designationData.min_salary_range,
    designationData.max_salary_range,
    designationData.is_managerial,
    designationData.headcount_allocated
  ]);
  
  // Audit log
  await db.query(`
    INSERT INTO audit_logs (action, entity_type, entity_id, details)
    VALUES ('designation_created', 'designations', ?, ?)
  `, [designationId, JSON.stringify(designationData)]);
  
  return { success: true, designationId };
}
```

**Business Rules**:
- Designation title must be unique within department
- Code must be globally unique (across all departments)
- Level 1 = highest (CEO), higher numbers = lower hierarchy
- Reporting designation must be at higher level
- Salary range: min < max
- Track headcount allocated vs filled
- Support cross-department roles (secondary departments)

---

#### 3.2.2 Designation Hierarchy & Reporting Structure

**Rule**: Build and maintain clear organizational reporting hierarchy

**Get Designation Hierarchy**:
```javascript
async function getDesignationHierarchy(departmentId = null) {
  const whereClause = departmentId 
    ? `WHERE department_id = ${departmentId}` 
    : '';
  
  const hierarchy = await db.query(`
    WITH RECURSIVE designation_tree AS (
      -- Root designations (no reporting structure)
      SELECT 
        id, code, title, department_id, reporting_to_designation_id,
        level, grade, is_managerial, headcount_allocated, headcount_filled,
        0 as depth,
        CAST(title AS VARCHAR(1000)) as path
      FROM designations
      WHERE reporting_to_designation_id IS NULL
        ${departmentId ? 'AND department_id = ' + departmentId : ''}
      
      UNION ALL
      
      -- Child designations (recursive)
      SELECT 
        d.id, d.code, d.title, d.department_id, d.reporting_to_designation_id,
        d.level, d.grade, d.is_managerial, d.headcount_allocated, d.headcount_filled,
        dt.depth + 1,
        CAST(dt.path || ' > ' || d.title AS VARCHAR(1000))
      FROM designations d
      JOIN designation_tree dt ON d.reporting_to_designation_id = dt.id
    )
    SELECT * FROM designation_tree
    ORDER BY path, level
  `);
  
  return hierarchy;
}

// Get direct reports for a designation
async function getDesignationDirectReports(designationId) {
  const directReports = await db.query(`
    SELECT 
      d.id, d.code, d.title, d.level, d.grade,
      d.headcount_allocated, d.headcount_filled,
      dept.name as department_name,
      COUNT(e.employee_id) as current_employees
    FROM designations d
    LEFT JOIN departments dept ON d.department_id = dept.id
    LEFT JOIN employees e ON e.designation_id = d.id 
      AND e.employment_status IN ('active', 'confirmed', 'probation')
    WHERE d.reporting_to_designation_id = ?
      AND d.is_active = true
    GROUP BY d.id, d.code, d.title, d.level, d.grade,
             d.headcount_allocated, d.headcount_filled, dept.name
    ORDER BY d.level, d.title
  `, [designationId]);
  
  return directReports;
}

// Get reporting chain (employee's designation up to CEO)
async function getReportingChain(designationId) {
  const chain = await db.query(`
    WITH RECURSIVE reporting_chain AS (
      SELECT 
        id, code, title, reporting_to_designation_id, level, 0 as chain_level
      FROM designations
      WHERE id = ?
      
      UNION ALL
      
      SELECT 
        d.id, d.code, d.title, d.reporting_to_designation_id, d.level,
        rc.chain_level + 1
      FROM designations d
      JOIN reporting_chain rc ON d.id = rc.reporting_to_designation_id
    )
    SELECT * FROM reporting_chain
    ORDER BY chain_level DESC
  `, [designationId]);
  
  return chain;
}

// Detect circular reporting (prevent designation reporting to itself)
async function detectCircularReporting(designationId, reportingToId) {
  const chain = await getReportingChain(reportingToId);
  
  const hasCircular = chain.some(node => node.id === designationId);
  
  if (hasCircular) {
    throw new Error('Circular reporting structure detected. A designation cannot report to itself or its subordinates.');
  }
  
  return false;
}
```

**Business Rules**:
- Support recursive reporting structures
- Prevent circular reporting chains
- Maximum hierarchy depth: 10 levels
- Display organizational chart based on designation hierarchy
- Track span of control (direct reports count)

---

#### 3.2.3 Employee Assignment to Designations

**Rule**: Assign employees to designations with validation

**Assign Employee to Designation**:
```javascript
async function assignEmployeeToDesignation(employeeId, designationId) {
  // Validate employee
  const employee = await db.query(`
    SELECT employee_id, designation_id, department_id, salary_ctc
    FROM employees WHERE employee_id = ?
  `, [employeeId]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Validate designation
  const designation = await db.query(`
    SELECT 
      id, title, department_id, level, grade,
      min_salary_range, max_salary_range,
      headcount_allocated, headcount_filled, is_active
    FROM designations WHERE id = ?
  `, [designationId]);
  
  if (!designation) {
    throw new Error('Designation not found');
  }
  
  if (!designation.is_active) {
    throw new Error('Cannot assign employee to inactive designation');
  }
  
  // Check if already assigned
  if (employee.designation_id === designationId) {
    return { success: false, message: 'Employee already has this designation' };
  }
  
  // Validate department alignment (optional warning)
  if (employee.department_id !== designation.department_id) {
    console.warn(`Warning: Employee department (${employee.department_id}) differs from designation department (${designation.department_id})`);
  }
  
  // Validate salary against designation range
  if (designation.min_salary_range && employee.salary_ctc < designation.min_salary_range) {
    console.warn(`Warning: Employee salary (${employee.salary_ctc}) is below designation minimum (${designation.min_salary_range})`);
  }
  
  if (designation.max_salary_range && employee.salary_ctc > designation.max_salary_range) {
    console.warn(`Warning: Employee salary (${employee.salary_ctc}) exceeds designation maximum (${designation.max_salary_range})`);
  }
  
  // Check headcount availability
  if (designation.headcount_allocated && designation.headcount_filled >= designation.headcount_allocated) {
    throw new Error(`Headcount limit reached for designation "${designation.title}" (${designation.headcount_filled}/${designation.headcount_allocated})`);
  }
  
  const oldDesignationId = employee.designation_id;
  
  // Update employee designation
  await db.query(`
    UPDATE employees
    SET designation_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = ?
  `, [designationId, employeeId]);
  
  // Update headcount
  await updateDesignationHeadcount(designationId);
  if (oldDesignationId) {
    await updateDesignationHeadcount(oldDesignationId);
  }
  
  // Create career history event (promotion or role change)
  await db.query(`
    INSERT INTO career_history (
      employee_id, event_category, event_type, event_date,
      old_designation_id, new_designation_id,
      reason, approval_status
    ) VALUES (?, 'career_progression', 'designation_change', CURRENT_DATE,
      ?, ?, 'Designation assignment', 'approved')
  `, [employeeId, oldDesignationId, designationId]);
  
  return { success: true, message: 'Employee assigned to designation' };
}

// Update headcount (auto-calculated)
async function updateDesignationHeadcount(designationId) {
  const count = await db.query(`
    SELECT COUNT(*) as count FROM employees
    WHERE designation_id = ?
      AND employment_status IN ('active', 'confirmed', 'probation')
  `, [designationId]);
  
  await db.query(`
    UPDATE designations
    SET headcount_filled = ?
    WHERE id = ?
  `, [count.count, designationId]);
}
```

**SQL Trigger** (Auto-update headcount):
```sql
CREATE OR REPLACE FUNCTION update_designation_headcount()
RETURNS TRIGGER AS $$
BEGIN
  -- Update old designation count (if changed)
  IF TG_OP = 'UPDATE' AND OLD.designation_id IS DISTINCT FROM NEW.designation_id THEN
    UPDATE designations
    SET headcount_filled = (
      SELECT COUNT(*) FROM employees
      WHERE designation_id = OLD.designation_id
        AND employment_status IN ('active', 'confirmed', 'probation')
    )
    WHERE id = OLD.designation_id;
  END IF;
  
  -- Update new designation count
  UPDATE designations
  SET headcount_filled = (
    SELECT COUNT(*) FROM employees
    WHERE designation_id = NEW.designation_id
      AND employment_status IN ('active', 'confirmed', 'probation')
  )
  WHERE id = NEW.designation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_designation_headcount
AFTER INSERT OR UPDATE OF designation_id, employment_status ON employees
FOR EACH ROW
EXECUTE FUNCTION update_designation_headcount();
```

**Business Rules**:
- Validate employee salary against designation range
- Check headcount limits before assignment
- Track designation changes in career history
- Auto-update headcount_filled count
- Support temporary acting designations

---

#### 3.2.4 Career Progression & Promotion Paths

**Rule**: Define clear career progression paths and promotion criteria

**Career Path Mapping**:
```javascript
// Define career progression paths
const CAREER_PATHS = {
  'Engineering': [
    { level: 10, title: 'Trainee Engineer', grade: 'T1' },
    { level: 9, title: 'Junior Engineer', grade: 'E1' },
    { level: 8, title: 'Software Engineer', grade: 'E2' },
    { level: 7, title: 'Senior Engineer', grade: 'E3' },
    { level: 6, title: 'Tech Lead', grade: 'M1' },
    { level: 5, title: 'Engineering Manager', grade: 'M2' },
    { level: 4, title: 'Senior Engineering Manager', grade: 'M3' },
    { level: 3, title: 'Director of Engineering', grade: 'D1' },
    { level: 2, title: 'VP Engineering', grade: 'VP1' },
    { level: 1, title: 'CTO', grade: 'C1' }
  ],
  'Sales': [
    { level: 9, title: 'Sales Trainee', grade: 'T1' },
    { level: 8, title: 'Sales Executive', grade: 'E2' },
    { level: 7, title: 'Senior Sales Executive', grade: 'E3' },
    { level: 6, title: 'Team Leader - Sales', grade: 'M1' },
    { level: 5, title: 'Sales Manager', grade: 'M2' },
    { level: 4, title: 'Senior Sales Manager', grade: 'M3' },
    { level: 3, title: 'Director of Sales', grade: 'D1' },
    { level: 2, title: 'VP Sales', grade: 'VP1' }
  ]
};

// Get possible promotions for an employee
async function getPromotionOptions(employeeId) {
  const employee = await db.query(`
    SELECT 
      e.employee_id, e.designation_id, e.salary_ctc, e.join_date,
      d.title as current_title, d.level as current_level,
      d.grade as current_grade, d.job_family,
      TIMESTAMPDIFF(MONTH, e.join_date, CURDATE()) / 12 as tenure_years
    FROM employees e
    JOIN designations d ON e.designation_id = d.id
    WHERE e.employee_id = ?
  `, [employeeId]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Find next level designations in same job family
  const nextLevelDesignations = await db.query(`
    SELECT 
      id, title, level, grade, min_salary_range, max_salary_range,
      min_experience_years
    FROM designations
    WHERE job_family = ?
      AND level = ?
      AND is_active = true
    ORDER BY title
  `, [employee.job_family, employee.current_level - 1]); // Next level up
  
  // Check eligibility
  const options = nextLevelDesignations.map(designation => {
    const eligible = employee.tenure_years >= (designation.min_experience_years || 0);
    const salaryInRange = employee.salary_ctc >= (designation.min_salary_range || 0);
    
    return {
      designation,
      eligible,
      salaryInRange,
      currentTenure: employee.tenure_years,
      requiredTenure: designation.min_experience_years,
      recommendedPromotion: eligible && salaryInRange
    };
  });
  
  return options;
}

// Create promotion workflow
async function initiatePromotion(employeeId, newDesignationId, salaryIncrease, reason, initiatedBy) {
  // Validate promotion eligibility
  const options = await getPromotionOptions(employeeId);
  const targetDesignation = options.find(opt => opt.designation.id === newDesignationId);
  
  if (!targetDesignation) {
    throw new Error('Invalid promotion designation');
  }
  
  if (!targetDesignation.recommendedPromotion) {
    console.warn('Warning: Employee may not meet promotion criteria');
  }
  
  // Create promotion workflow (requires approval)
  const workflowId = await db.query(`
    INSERT INTO approval_workflows (
      workflow_type, employee_id, initiated_by,
      status, data
    ) VALUES ('promotion', ?, ?, 'pending', ?)
    RETURNING id
  `, [
    employeeId,
    initiatedBy,
    JSON.stringify({
      currentDesignationId: targetDesignation.designation.id,
      newDesignationId,
      salaryIncrease,
      reason
    })
  ]);
  
  // Notify approvers (department head, HR)
  await notifyApprovers(workflowId, 'promotion');
  
  return { success: true, workflowId, message: 'Promotion initiated for approval' };
}
```

**Business Rules**:
- Define clear career paths per job family
- Promotion eligibility: tenure, performance, skills
- Next level = current level - 1 (lower number)
- Promotions require approval workflow
- Track all designation changes in career history
- Support lateral moves across departments

---

#### 3.2.5 Designation Salary Bands & Grade Mapping

**Rule**: Link designations to salary grades and enforce compensation bands

**Salary Band Management**:
```javascript
async function updateDesignationSalaryBand(designationId, salaryBandData) {
  // Validate designation
  const designation = await db.query(`
    SELECT id, title, grade FROM designations WHERE id = ?
  `, [designationId]);
  
  if (!designation) {
    throw new Error('Designation not found');
  }
  
  // Validate salary band
  if (salaryBandData.min_salary >= salaryBandData.max_salary) {
    throw new Error('Minimum salary must be less than maximum salary');
  }
  
  // Update salary band
  await db.query(`
    UPDATE designations
    SET min_salary_range = ?,
        max_salary_range = ?,
        grade = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    salaryBandData.min_salary,
    salaryBandData.max_salary,
    salaryBandData.grade,
    designationId
  ]);
  
  // Check if any employees fall outside new band
  const outOfBandEmployees = await db.query(`
    SELECT 
      employee_id, first_name, last_name, salary_ctc
    FROM employees
    WHERE designation_id = ?
      AND (salary_ctc < ? OR salary_ctc > ?)
      AND employment_status IN ('active', 'confirmed')
  `, [
    designationId,
    salaryBandData.min_salary,
    salaryBandData.max_salary
  ]);
  
  if (outOfBandEmployees.length > 0) {
    console.warn(`Warning: ${outOfBandEmployees.length} employees have salaries outside new band`);
  }
  
  return {
    success: true,
    message: 'Salary band updated',
    outOfBandEmployees
  };
}

// Get salary distribution for designation
async function getDesignationSalaryDistribution(designationId) {
  const distribution = await db.query(`
    SELECT 
      d.title, d.grade, d.min_salary_range, d.max_salary_range,
      COUNT(e.employee_id) as employee_count,
      AVG(e.salary_ctc) as avg_salary,
      MIN(e.salary_ctc) as min_salary,
      MAX(e.salary_ctc) as max_salary,
      PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY e.salary_ctc) as p25_salary,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY e.salary_ctc) as median_salary,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY e.salary_ctc) as p75_salary
    FROM designations d
    LEFT JOIN employees e ON d.id = e.designation_id
      AND e.employment_status IN ('active', 'confirmed')
    WHERE d.id = ?
    GROUP BY d.id, d.title, d.grade, d.min_salary_range, d.max_salary_range
  `, [designationId]);
  
  return distribution;
}

// Salary band benchmark across company
async function getSalaryBandBenchmark() {
  const benchmark = await db.query(`
    SELECT 
      d.level,
      d.grade,
      d.job_family,
      COUNT(DISTINCT d.id) as designation_count,
      AVG(d.min_salary_range) as avg_min_salary,
      AVG(d.max_salary_range) as avg_max_salary,
      COUNT(e.employee_id) as total_employees,
      AVG(e.salary_ctc) as avg_actual_salary
    FROM designations d
    LEFT JOIN employees e ON d.id = e.designation_id
      AND e.employment_status IN ('active', 'confirmed')
    WHERE d.is_active = true
    GROUP BY d.level, d.grade, d.job_family
    ORDER BY d.level, d.grade
  `);
  
  return benchmark;
}
```

**Business Rules**:
- Each designation has min-max salary range
- Link grade to salary band (E1, E2, M1, etc.)
- Alert if employee salary outside band
- Support salary band revisions (annual market adjustment)
- Track salary percentiles within designation

---

#### 3.2.6 Job Descriptions & Competency Requirements

**Rule**: Maintain detailed job descriptions and skill requirements

**Job Description Management**:
```javascript
async function updateJobDescription(designationId, jobDescriptionData) {
  // Validate designation
  const designation = await db.query(`
    SELECT id, title FROM designations WHERE id = ?
  `, [designationId]);
  
  if (!designation) {
    throw new Error('Designation not found');
  }
  
  // Update job description
  await db.query(`
    UPDATE designations
    SET description = ?,
        skills_required = ?,
        qualifications_required = ?,
        min_experience_years = ?,
        max_experience_years = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    jobDescriptionData.description,
    JSON.stringify(jobDescriptionData.skills_required || []),
    JSON.stringify(jobDescriptionData.qualifications_required || []),
    jobDescriptionData.min_experience_years,
    jobDescriptionData.max_experience_years,
    designationId
  ]);
  
  // Version control for job descriptions
  await db.query(`
    INSERT INTO job_description_history (
      designation_id, description, skills_required,
      qualifications_required, version, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    designationId,
    jobDescriptionData.description,
    JSON.stringify(jobDescriptionData.skills_required),
    JSON.stringify(jobDescriptionData.qualifications_required),
    jobDescriptionData.version || 1,
    jobDescriptionData.updated_by
  ]);
  
  return { success: true, message: 'Job description updated' };
}

// Skills matching for recruitment
async function getSkillsGapAnalysis(designationId, candidateSkills) {
  const designation = await db.query(`
    SELECT 
      id, title, skills_required, qualifications_required
    FROM designations
    WHERE id = ?
  `, [designationId]);
  
  if (!designation) {
    throw new Error('Designation not found');
  }
  
  const requiredSkills = JSON.parse(designation.skills_required || '[]');
  const candidateSkillSet = new Set(candidateSkills.map(s => s.toLowerCase()));
  
  const matchedSkills = requiredSkills.filter(skill => 
    candidateSkillSet.has(skill.toLowerCase())
  );
  
  const missingSkills = requiredSkills.filter(skill => 
    !candidateSkillSet.has(skill.toLowerCase())
  );
  
  const matchPercentage = requiredSkills.length > 0
    ? ((matchedSkills.length / requiredSkills.length) * 100).toFixed(2)
    : 100;
  
  return {
    designation: designation.title,
    requiredSkills,
    candidateSkills,
    matchedSkills,
    missingSkills,
    matchPercentage: `${matchPercentage}%`,
    recommendation: matchPercentage >= 70 ? 'Strong match' :
                    matchPercentage >= 50 ? 'Good match' : 'Skills gap exists'
  };
}
```

**Business Rules**:
- Store job description with versioning
- Track required skills (array/JSONB)
- Track required qualifications (degrees, certifications)
- Define experience range (min-max years)
- Skills matching for recruitment
- Update job descriptions annually

---

#### 3.2.7 Designation Headcount Planning

**Rule**: Manage headcount allocation and hiring plans per designation

**Headcount Planning**:
```javascript
async function updateHeadcountPlan(designationId, planData) {
  // Validate designation
  const designation = await db.query(`
    SELECT 
      id, title, headcount_allocated, headcount_filled
    FROM designations
    WHERE id = ?
  `, [designationId]);
  
  if (!designation) {
    throw new Error('Designation not found');
  }
  
  // Validate headcount increase (cannot reduce below filled)
  if (planData.headcount_allocated < designation.headcount_filled) {
    throw new Error(`Cannot reduce headcount below current filled positions (${designation.headcount_filled})`);
  }
  
  // Update headcount
  await db.query(`
    UPDATE designations
    SET headcount_allocated = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [planData.headcount_allocated, designationId]);
  
  // Create headcount planning record
  await db.query(`
    INSERT INTO headcount_plans (
      designation_id, fiscal_year, planned_headcount,
      budget_per_position, justification, approved_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    designationId,
    planData.fiscal_year,
    planData.headcount_allocated,
    planData.budget_per_position,
    planData.justification,
    planData.approved_by
  ]);
  
  return { success: true, message: 'Headcount plan updated' };
}

// Get open positions (headcount gaps)
async function getOpenPositions(departmentId = null) {
  const whereClause = departmentId 
    ? `AND d.department_id = ${departmentId}` 
    : '';
  
  const openPositions = await db.query(`
    SELECT 
      d.id, d.code, d.title, d.level, d.grade,
      dept.name as department_name,
      d.headcount_allocated,
      d.headcount_filled,
      (d.headcount_allocated - d.headcount_filled) as open_positions,
      d.min_salary_range,
      d.max_salary_range
    FROM designations d
    JOIN departments dept ON d.department_id = dept.id
    WHERE d.is_active = true
      AND d.headcount_allocated > d.headcount_filled
      ${whereClause}
    ORDER BY (d.headcount_allocated - d.headcount_filled) DESC, d.level
  `);
  
  return openPositions;
}

// Hiring pipeline tracking
async function getHiringPipeline(designationId) {
  const pipeline = await db.query(`
    SELECT 
      stage, COUNT(*) as candidate_count
    FROM recruitment_candidates
    WHERE designation_id = ?
      AND status = 'active'
    GROUP BY stage
    ORDER BY 
      CASE stage
        WHEN 'applied' THEN 1
        WHEN 'screening' THEN 2
        WHEN 'interview' THEN 3
        WHEN 'offer' THEN 4
        WHEN 'hired' THEN 5
      END
  `, [designationId]);
  
  return pipeline;
}
```

**Business Rules**:
- Track allocated vs filled headcount
- Cannot reduce headcount below filled positions
- Open positions = allocated - filled
- Link to recruitment pipeline
- Budget approval required for headcount increase
- Annual headcount planning per designation

---

#### 3.2.8 Designation Analytics & Reporting

**Rule**: Provide analytics for workforce planning and talent management

**Designation Analytics**:
```javascript
async function getDesignationAnalytics(designationId) {
  const analytics = {};
  
  // 1. Current state
  const currentState = await db.query(`
    SELECT 
      d.id, d.title, d.level, d.grade,
      d.headcount_allocated, d.headcount_filled,
      d.min_salary_range, d.max_salary_range,
      dept.name as department_name
    FROM designations d
    JOIN departments dept ON d.department_id = dept.id
    WHERE d.id = ?
  `, [designationId]);
  
  analytics.designation = currentState;
  
  // 2. Employee demographics
  const demographics = await db.query(`
    SELECT 
      COUNT(*) as total_employees,
      AVG(TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())) as avg_age,
      AVG(TIMESTAMPDIFF(MONTH, join_date, CURDATE())) / 12 as avg_tenure_years,
      COUNT(CASE WHEN gender = 'Male' THEN 1 END) as male_count,
      COUNT(CASE WHEN gender = 'Female' THEN 1 END) as female_count
    FROM employees
    WHERE designation_id = ?
      AND employment_status IN ('active', 'confirmed', 'probation')
  `, [designationId]);
  
  analytics.demographics = demographics;
  
  // 3. Salary analysis
  const salaryAnalysis = await db.query(`
    SELECT 
      AVG(salary_ctc) as avg_ctc,
      MIN(salary_ctc) as min_ctc,
      MAX(salary_ctc) as max_ctc,
      STDDEV(salary_ctc) as salary_stddev
    FROM employees
    WHERE designation_id = ?
      AND employment_status IN ('active', 'confirmed')
  `, [designationId]);
  
  analytics.salary = salaryAnalysis;
  
  // 4. Turnover & attrition (last 12 months)
  const turnover = await db.query(`
    SELECT 
      COUNT(*) as exits,
      AVG(tenure_months) as avg_tenure_at_exit
    FROM career_history
    WHERE employee_id IN (
      SELECT employee_id FROM employees WHERE designation_id = ?
    )
    AND event_type IN ('resignation', 'termination')
    AND event_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
  `, [designationId]);
  
  const attritionRate = demographics.total_employees > 0
    ? ((turnover.exits / demographics.total_employees) * 100).toFixed(2)
    : 0;
  
  analytics.turnover = {
    exits: turnover.exits,
    attritionRate: `${attritionRate}%`,
    avgTenureAtExit: turnover.avg_tenure_at_exit
  };
  
  // 5. Performance distribution
  const performance = await db.query(`
    SELECT 
      performance_rating,
      COUNT(*) as count
    FROM employees
    WHERE designation_id = ?
      AND employment_status IN ('active', 'confirmed')
      AND performance_rating IS NOT NULL
    GROUP BY performance_rating
    ORDER BY performance_rating DESC
  `, [designationId]);
  
  analytics.performance = performance;
  
  return analytics;
}

// Designation comparison across company
async function compareDesignations(jobFamily = null) {
  const whereClause = jobFamily 
    ? `WHERE d.job_family = '${jobFamily}'` 
    : '';
  
  const comparison = await db.query(`
    SELECT 
      d.title, d.level, d.grade, d.job_family,
      d.headcount_allocated, d.headcount_filled,
      COUNT(e.employee_id) as actual_employees,
      AVG(e.salary_ctc) as avg_salary,
      d.min_salary_range, d.max_salary_range,
      dept.name as department_name
    FROM designations d
    JOIN departments dept ON d.department_id = dept.id
    LEFT JOIN employees e ON d.id = e.designation_id
      AND e.employment_status IN ('active', 'confirmed')
    ${whereClause}
    GROUP BY d.id, d.title, d.level, d.grade, d.job_family,
             d.headcount_allocated, d.headcount_filled,
             d.min_salary_range, d.max_salary_range, dept.name
    ORDER BY d.level, d.title
  `);
  
  return comparison;
}
```

**Business Rules**:
- Track designation-level demographics
- Monitor salary distribution vs band
- Calculate attrition rate per designation
- Track performance ratings distribution
- Benchmark designations across company
- Support workforce planning decisions

---

#### 3.2.9 Designation Deactivation & Archival

**Rule**: Manage designation lifecycle with proper deactivation handling

**Deactivate Designation**:
```javascript
async function deactivateDesignation(designationId, reason, deactivatedBy) {
  // Check for active employees
  const activeEmployees = await db.query(`
    SELECT COUNT(*) as count FROM employees
    WHERE designation_id = ?
      AND employment_status IN ('active', 'confirmed', 'probation')
  `, [designationId]);
  
  if (activeEmployees.count > 0) {
    throw new Error(`Cannot deactivate designation. ${activeEmployees.count} active employees must be reassigned first.`);
  }
  
  // Check for child designations in reporting structure
  const childDesignations = await db.query(`
    SELECT COUNT(*) as count FROM designations
    WHERE reporting_to_designation_id = ? AND is_active = true
  `, [designationId]);
  
  if (childDesignations.count > 0) {
    throw new Error(`Cannot deactivate designation. ${childDesignations.count} designations report to this one.`);
  }
  
  // Deactivate
  await db.query(`
    UPDATE designations
    SET is_active = false,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [designationId]);
  
  // Audit log
  await db.query(`
    INSERT INTO audit_logs (action, entity_type, entity_id, details, user_id)
    VALUES ('designation_deactivated', 'designations', ?, ?, ?)
  `, [designationId, JSON.stringify({ reason }), deactivatedBy]);
  
  return { success: true, message: 'Designation deactivated' };
}

// Merge designations (consolidation)
async function mergeDesignations(sourceDesignationId, targetDesignationId, mergedBy) {
  // Validate both designations exist
  const source = await db.query(`
    SELECT id, title, headcount_filled FROM designations WHERE id = ?
  `, [sourceDesignationId]);
  
  const target = await db.query(`
    SELECT id, title, headcount_allocated, headcount_filled FROM designations WHERE id = ?
  `, [targetDesignationId]);
  
  if (!source || !target) {
    throw new Error('Source or target designation not found');
  }
  
  // Check if target can accommodate source employees
  const totalEmployees = source.headcount_filled + target.headcount_filled;
  if (target.headcount_allocated && totalEmployees > target.headcount_allocated) {
    throw new Error(`Target designation headcount insufficient (needs ${totalEmployees}, has ${target.headcount_allocated})`);
  }
  
  // Move all employees from source to target
  await db.query(`
    UPDATE employees
    SET designation_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE designation_id = ?
  `, [targetDesignationId, sourceDesignationId]);
  
  // Create career history records
  await db.query(`
    INSERT INTO career_history (
      employee_id, event_category, event_type, event_date,
      old_designation_id, new_designation_id,
      reason, approval_status
    )
    SELECT 
      employee_id, 'career_progression', 'designation_change', CURRENT_DATE,
      ?, ?, 'Designation merger', 'approved'
    FROM employees
    WHERE designation_id = ?
  `, [sourceDesignationId, targetDesignationId, targetDesignationId]);
  
  // Deactivate source designation
  await deactivateDesignation(sourceDesignationId, 'Merged into ' + target.title, mergedBy);
  
  return {
    success: true,
    message: `${source.headcount_filled} employees moved from "${source.title}" to "${target.title}"`
  };
}
```

**Business Rules**:
- Cannot deactivate with active employees
- Cannot deactivate if other designations report to it
- Support designation merger for consolidation
- Maintain historical data (soft delete)
- Track deactivation reason in audit log

---

#### 3.2.10 Designation Export & Job Posting Integration

**Rule**: Export designation data and integrate with recruitment systems

**Export Designations**:
```javascript
async function exportDesignations(format = 'csv') {
  const designations = await db.query(`
    SELECT 
      d.code, d.title, d.short_title,
      dept.name as department,
      d.level, d.grade, d.job_family,
      d.min_experience_years, d.max_experience_years,
      d.min_salary_range, d.max_salary_range,
      d.headcount_allocated, d.headcount_filled,
      (d.headcount_allocated - d.headcount_filled) as open_positions,
      d.is_managerial, d.is_active
    FROM designations d
    JOIN departments dept ON d.department_id = dept.id
    ORDER BY d.level, d.title
  `);
  
  if (format === 'csv') {
    return convertToCSV(designations);
  } else if (format === 'json') {
    return JSON.stringify(designations, null, 2);
  }
}

// Generate job posting from designation
async function generateJobPosting(designationId) {
  const designation = await db.query(`
    SELECT 
      d.title, d.description, d.level, d.grade,
      d.min_experience_years, d.max_experience_years,
      d.skills_required, d.qualifications_required,
      d.min_salary_range, d.max_salary_range,
      dept.name as department_name,
      dept.location
    FROM designations d
    JOIN departments dept ON d.department_id = dept.id
    WHERE d.id = ?
  `, [designationId]);
  
  if (!designation) {
    throw new Error('Designation not found');
  }
  
  const skills = JSON.parse(designation.skills_required || '[]');
  const qualifications = JSON.parse(designation.qualifications_required || '[]');
  
  const jobPosting = {
    title: designation.title,
    department: designation.department_name,
    location: designation.location,
    experienceRequired: `${designation.min_experience_years}-${designation.max_experience_years} years`,
    salaryRange: `₹${designation.min_salary_range.toLocaleString('en-IN')} - ₹${designation.max_salary_range.toLocaleString('en-IN')}`,
    description: designation.description,
    skills: skills,
    qualifications: qualifications,
    grade: designation.grade,
    level: designation.level
  };
  
  return jobPosting;
}

// Sync with external recruitment platforms
async function syncWithRecruitmentPlatform(designationId, platform = 'naukri') {
  const jobPosting = await generateJobPosting(designationId);
  
  // Integration with recruitment platforms (Naukri, LinkedIn, Indeed)
  // This would involve API calls to respective platforms
  
  const response = await fetch(`https://api.${platform}.com/jobs`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env[`${platform.toUpperCase()}_API_KEY`]}` },
    body: JSON.stringify(jobPosting)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync with ${platform}`);
  }
  
  return { success: true, platform, jobPosting };
}
```

**Business Rules**:
- Export designation master data (CSV/JSON)
- Auto-generate job postings from designation details
- Include skills, qualifications, salary range
- Sync open positions with recruitment platforms
- Track job posting status per designation

---

## 4. Attendance and Leave Management Rules

### 4.1 AttendanceRecord Management
**Rule**: Track and manage monthly attendance records for accurate payroll processing and compliance

**Purpose**: Capture employee attendance data monthly, calculate payable days and LOP days, support pro-rated salary calculations, ensure attendance compliance, and provide audit trail for statutory reporting.

---

#### 4.1.1 Attendance Record Creation & Structure

**Rule**: Create monthly attendance records with proper validation and auto-calculation

**Attendance Record Structure**:
```javascript
const ATTENDANCE_RECORD_SCHEMA = {
  id: 'VARCHAR(50) PRIMARY KEY', // Format: ATT{timestamp}
  employee_id: 'VARCHAR(20) FOREIGN KEY NOT NULL',
  employee_name: 'VARCHAR(255) NOT NULL', // Denormalized for performance
  month: 'VARCHAR(20) NOT NULL', // 'January', 'February', etc.
  year: 'VARCHAR(4) NOT NULL', // '2026', '2027', etc.
  total_working_days: 'INT NOT NULL', // Excluding Sundays/holidays
  present_days: 'INT NOT NULL', // Days employee was present
  absent_days: 'INT NOT NULL', // Unauthorized absences
  paid_leave: 'INT NOT NULL', // CL, EL, PL used
  unpaid_leave: 'INT NOT NULL', // LOP days
  payable_days: 'INT NOT NULL COMPUTED', // present_days + paid_leave
  loss_of_pay_days: 'INT NOT NULL COMPUTED', // unpaid_leave + absent_days
  weekends: 'INT NOT NULL DEFAULT 0', // Count of Sundays/Saturdays
  public_holidays: 'INT NOT NULL DEFAULT 0', // National/state holidays
  half_days: 'INT NOT NULL DEFAULT 0', // Half-day attendance
  overtime_hours: 'DECIMAL(5,2) DEFAULT 0', // Overtime worked
  late_arrivals: 'INT DEFAULT 0', // Late coming count
  early_departures: 'INT DEFAULT 0', // Early going count
  remote_work_days: 'INT DEFAULT 0', // WFH days
  on_site_days: 'INT DEFAULT 0', // Client location days
  remarks: 'TEXT', // Additional notes
  approved_by: 'UUID FOREIGN KEY', // Manager who approved
  approval_date: 'TIMESTAMP',
  status: 'ENUM', // 'draft', 'submitted', 'approved', 'locked'
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};

// Computed fields formulas
const ATTENDANCE_CALCULATIONS = {
  payable_days: 'present_days + paid_leave + (half_days * 0.5)',
  loss_of_pay_days: 'unpaid_leave + absent_days',
  total_accounted_days: 'present_days + absent_days + paid_leave + unpaid_leave + weekends + public_holidays',
  attendance_percentage: '(present_days / total_working_days) * 100'
};

// Working days calculation (excluding Sundays and public holidays)
const WORKING_DAYS_CONFIG = {
  standard_month: 26, // Typical working days
  week_pattern: 6, // 6-day week (Monday-Saturday)
  weekend_days: ['Sunday'], // Weekend configuration
  half_day_saturday: true // Optional: Saturday half-day
};
```

**Create Attendance Record**:
```javascript
async function createAttendanceRecord(attendanceData) {
  // Validate employee exists
  const employee = await db.query(`
    SELECT employee_id, first_name, last_name, join_date, employment_status
    FROM employees WHERE employee_id = ?
  `, [attendanceData.employee_id]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  if (employee.employment_status !== 'active' && employee.employment_status !== 'confirmed') {
    throw new Error('Attendance can only be recorded for active employees');
  }
  
  // Check for duplicate record
  const existing = await db.query(`
    SELECT id FROM attendance_records
    WHERE employee_id = ? AND month = ? AND year = ?
  `, [attendanceData.employee_id, attendanceData.month, attendanceData.year]);
  
  if (existing) {
    throw new Error(`Attendance record for ${attendanceData.month} ${attendanceData.year} already exists`);
  }
  
  // Calculate working days for the month
  const workingDays = calculateWorkingDays(attendanceData.month, attendanceData.year);
  
  // Validate attendance data
  const totalDays = attendanceData.present_days + attendanceData.absent_days + 
                    attendanceData.paid_leave + attendanceData.unpaid_leave;
  
  if (totalDays > workingDays.total_working_days) {
    throw new Error(`Total attendance days (${totalDays}) exceeds working days (${workingDays.total_working_days})`);
  }
  
  // Auto-calculate computed fields
  const payableDays = attendanceData.present_days + attendanceData.paid_leave + 
                      (attendanceData.half_days * 0.5);
  const lopDays = attendanceData.unpaid_leave + attendanceData.absent_days;
  
  // Generate unique ID
  const recordId = `ATT${Date.now()}`;
  
  // Create record
  await db.query(`
    INSERT INTO attendance_records (
      id, employee_id, employee_name, month, year,
      total_working_days, present_days, absent_days,
      paid_leave, unpaid_leave, payable_days, loss_of_pay_days,
      weekends, public_holidays, half_days, overtime_hours,
      late_arrivals, early_departures, remote_work_days, on_site_days,
      remarks, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `, [
    recordId,
    attendanceData.employee_id,
    `${employee.first_name} ${employee.last_name}`,
    attendanceData.month,
    attendanceData.year,
    workingDays.total_working_days,
    attendanceData.present_days,
    attendanceData.absent_days,
    attendanceData.paid_leave,
    attendanceData.unpaid_leave,
    payableDays,
    lopDays,
    workingDays.weekends,
    workingDays.public_holidays,
    attendanceData.half_days || 0,
    attendanceData.overtime_hours || 0,
    attendanceData.late_arrivals || 0,
    attendanceData.early_departures || 0,
    attendanceData.remote_work_days || 0,
    attendanceData.on_site_days || 0,
    attendanceData.remarks
  ]);
  
  return { success: true, recordId, payableDays, lopDays };
}

// Calculate working days in a month
function calculateWorkingDays(month, year) {
  const monthIndex = {
    'January': 0, 'February': 1, 'March': 2, 'April': 3,
    'May': 4, 'June': 5, 'July': 6, 'August': 7,
    'September': 8, 'October': 9, 'November': 10, 'December': 11
  }[month];
  
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let sundays = 0;
  let publicHolidays = 0;
  
  // Count Sundays
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    if (date.getDay() === 0) { // Sunday
      sundays++;
    }
  }
  
  // Get public holidays for the month (from holidays table)
  // This would be fetched from database in real implementation
  publicHolidays = getPublicHolidaysCount(month, year);
  
  const totalWorkingDays = daysInMonth - sundays - publicHolidays;
  
  return {
    total_days: daysInMonth,
    total_working_days: totalWorkingDays,
    weekends: sundays,
    public_holidays: publicHolidays
  };
}
```

**SQL Trigger** (Auto-calculate payable and LOP days):
```sql
CREATE OR REPLACE FUNCTION calculate_attendance_days()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate payable days
  NEW.payable_days := NEW.present_days + NEW.paid_leave + (NEW.half_days * 0.5);
  
  -- Calculate loss of pay days
  NEW.loss_of_pay_days := NEW.unpaid_leave + NEW.absent_days;
  
  -- Validate total doesn't exceed working days
  IF (NEW.present_days + NEW.absent_days + NEW.paid_leave + NEW.unpaid_leave) > NEW.total_working_days THEN
    RAISE EXCEPTION 'Total attendance days exceed working days for the month';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_attendance_days
BEFORE INSERT OR UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION calculate_attendance_days();
```

**Business Rules**:
- One record per employee per month-year (unique constraint)
- Payable days = present + paid_leave + (half_days × 0.5)
- LOP days = unpaid_leave + absent_days
- Total attendance days ≤ working days
- Auto-calculate working days excluding Sundays and public holidays
- Support half-day attendance (0.5 day credit)

---

#### 4.1.2 Bulk Attendance Import & Processing

**Rule**: Support bulk attendance upload from biometric systems or Excel files

**Bulk Import**:
```javascript
async function bulkImportAttendance(file, month, year, importedBy) {
  // Parse CSV/Excel file
  const attendanceData = await parseAttendanceFile(file);
  
  const results = {
    success: [],
    failed: [],
    total: attendanceData.length
  };
  
  for (const record of attendanceData) {
    try {
      // Validate employee ID
      const employee = await db.query(`
        SELECT employee_id FROM employees WHERE employee_id = ?
      `, [record.employee_id]);
      
      if (!employee) {
        results.failed.push({
          employee_id: record.employee_id,
          reason: 'Employee not found'
        });
        continue;
      }
      
      // Check for existing record
      const existing = await db.query(`
        SELECT id FROM attendance_records
        WHERE employee_id = ? AND month = ? AND year = ?
      `, [record.employee_id, month, year]);
      
      if (existing) {
        // Update existing record
        await updateAttendanceRecord(existing.id, record);
        results.success.push({
          employee_id: record.employee_id,
          action: 'updated'
        });
      } else {
        // Create new record
        await createAttendanceRecord({
          ...record,
          month,
          year
        });
        results.success.push({
          employee_id: record.employee_id,
          action: 'created'
        });
      }
    } catch (error) {
      results.failed.push({
        employee_id: record.employee_id,
        reason: error.message
      });
    }
  }
  
  // Audit log
  await db.query(`
    INSERT INTO audit_logs (action, entity_type, details, user_id)
    VALUES ('bulk_attendance_import', 'attendance_records', ?, ?)
  `, [JSON.stringify(results), importedBy]);
  
  return results;
}

// Parse attendance file (CSV format)
async function parseAttendanceFile(file) {
  const data = [];
  const lines = file.split('\n');
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(',');
    
    if (columns.length < 5) continue; // Invalid row
    
    data.push({
      employee_id: columns[0].trim(),
      present_days: parseInt(columns[1]) || 0,
      absent_days: parseInt(columns[2]) || 0,
      paid_leave: parseInt(columns[3]) || 0,
      unpaid_leave: parseInt(columns[4]) || 0,
      half_days: parseInt(columns[5]) || 0,
      overtime_hours: parseFloat(columns[6]) || 0,
      remarks: columns[7] || ''
    });
  }
  
  return data;
}

// Export attendance template
function generateAttendanceTemplate(employees) {
  const csv = ['Employee ID,Employee Name,Present Days,Absent Days,Paid Leave,Unpaid Leave,Half Days,Overtime Hours,Remarks'];
  
  employees.forEach(emp => {
    csv.push(`${emp.employee_id},${emp.first_name} ${emp.last_name},0,0,0,0,0,0,`);
  });
  
  return csv.join('\n');
}
```

**Business Rules**:
- Support CSV/Excel bulk import
- Validate all employee IDs before import
- Update existing records if duplicate
- Report success and failure counts
- Generate downloadable template for easy data entry
- Log bulk import operations in audit trail

---

#### 4.1.3 Attendance Approval Workflow

**Rule**: Implement approval workflow for attendance records

**Approval Workflow**:
```javascript
async function submitAttendanceForApproval(recordId, submittedBy) {
  const record = await db.query(`
    SELECT 
      ar.*, e.reporting_manager_id
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.employee_id
    WHERE ar.id = ?
  `, [recordId]);
  
  if (!record) {
    throw new Error('Attendance record not found');
  }
  
  if (record.status !== 'draft') {
    throw new Error('Only draft records can be submitted for approval');
  }
  
  // Update status to submitted
  await db.query(`
    UPDATE attendance_records
    SET status = 'submitted',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [recordId]);
  
  // Notify reporting manager
  if (record.reporting_manager_id) {
    await sendNotification(record.reporting_manager_id, {
      type: 'attendance_approval_pending',
      message: `Attendance for ${record.employee_name} (${record.month} ${record.year}) requires approval`,
      recordId
    });
  }
  
  return { success: true, message: 'Attendance submitted for approval' };
}

async function approveAttendance(recordId, approvedBy, comments) {
  const record = await db.query(`
    SELECT * FROM attendance_records WHERE id = ?
  `, [recordId]);
  
  if (!record) {
    throw new Error('Attendance record not found');
  }
  
  if (record.status !== 'submitted') {
    throw new Error('Only submitted records can be approved');
  }
  
  // Verify approver is the reporting manager
  const employee = await db.query(`
    SELECT reporting_manager_id FROM employees WHERE employee_id = ?
  `, [record.employee_id]);
  
  if (employee.reporting_manager_id !== approvedBy) {
    // Check if approver is HR admin
    const isHRAdmin = await checkHRAdminRole(approvedBy);
    if (!isHRAdmin) {
      throw new Error('Only reporting manager or HR admin can approve attendance');
    }
  }
  
  // Approve
  await db.query(`
    UPDATE attendance_records
    SET status = 'approved',
        approved_by = ?,
        approval_date = CURRENT_TIMESTAMP,
        remarks = CONCAT(COALESCE(remarks, ''), '\n[Approved: ', ?, ']')
    WHERE id = ?
  `, [approvedBy, comments || 'Approved by manager', recordId]);
  
  // Notify employee
  await sendNotification(record.employee_id, {
    type: 'attendance_approved',
    message: `Your attendance for ${record.month} ${record.year} has been approved`,
    recordId
  });
  
  return { success: true, message: 'Attendance approved' };
}

async function rejectAttendance(recordId, rejectedBy, reason) {
  await db.query(`
    UPDATE attendance_records
    SET status = 'draft',
        remarks = CONCAT(COALESCE(remarks, ''), '\n[Rejected: ', ?, ']')
    WHERE id = ?
  `, [reason, recordId]);
  
  // Notify HR/submitter
  const record = await db.query(`
    SELECT employee_id, employee_name, month, year FROM attendance_records WHERE id = ?
  `, [recordId]);
  
  await sendNotification(record.employee_id, {
    type: 'attendance_rejected',
    message: `Attendance for ${record.month} ${record.year} rejected. Reason: ${reason}`,
    recordId
  });
  
  return { success: true, message: 'Attendance rejected' };
}

// Lock attendance (prevent further edits after payroll processing)
async function lockAttendance(month, year) {
  await db.query(`
    UPDATE attendance_records
    SET status = 'locked'
    WHERE month = ? AND year = ? AND status = 'approved'
  `, [month, year]);
  
  return { success: true, message: `Attendance locked for ${month} ${year}` };
}
```

**Business Rules**:
- Attendance flow: draft → submitted → approved → locked
- Only reporting manager or HR can approve
- Lock attendance after payroll generation
- Cannot edit locked records
- Track approval timestamp and approver
- Notify employees of approval/rejection

---

#### 4.1.4 Attendance Regularization Requests

**Rule**: Allow employees to request attendance corrections

**Regularization Request**:
```javascript
async function createRegularizationRequest(requestData) {
  // Validate employee and date
  const employee = await db.query(`
    SELECT employee_id, reporting_manager_id FROM employees WHERE employee_id = ?
  `, [requestData.employee_id]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Check if attendance record exists
  const record = await db.query(`
    SELECT id, status FROM attendance_records
    WHERE employee_id = ? AND month = ? AND year = ?
  `, [requestData.employee_id, requestData.month, requestData.year]);
  
  if (!record) {
    throw new Error('Attendance record not found for the specified month');
  }
  
  if (record.status === 'locked') {
    throw new Error('Cannot request regularization for locked attendance');
  }
  
  // Create regularization request
  const requestId = await db.query(`
    INSERT INTO attendance_regularization_requests (
      employee_id, attendance_record_id, request_date,
      regularization_type, current_status, requested_status,
      reason, supporting_documents, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    RETURNING id
  `, [
    requestData.employee_id,
    record.id,
    requestData.request_date,
    requestData.regularization_type, // 'absent_to_present', 'unpaid_to_paid', 'half_to_full'
    requestData.current_status,
    requestData.requested_status,
    requestData.reason,
    requestData.supporting_documents
  ]);
  
  // Notify manager
  await sendNotification(employee.reporting_manager_id, {
    type: 'regularization_request',
    message: `Attendance regularization request from ${requestData.employee_id}`,
    requestId
  });
  
  return { success: true, requestId };
}

async function approveRegularizationRequest(requestId, approvedBy) {
  const request = await db.query(`
    SELECT * FROM attendance_regularization_requests WHERE id = ?
  `, [requestId]);
  
  if (!request) {
    throw new Error('Regularization request not found');
  }
  
  // Update attendance record based on regularization type
  switch (request.regularization_type) {
    case 'absent_to_present':
      await db.query(`
        UPDATE attendance_records
        SET absent_days = absent_days - 1,
            present_days = present_days + 1
        WHERE id = ?
      `, [request.attendance_record_id]);
      break;
      
    case 'unpaid_to_paid':
      await db.query(`
        UPDATE attendance_records
        SET unpaid_leave = unpaid_leave - 1,
            paid_leave = paid_leave + 1
        WHERE id = ?
      `, [request.attendance_record_id]);
      break;
      
    case 'half_to_full':
      await db.query(`
        UPDATE attendance_records
        SET half_days = half_days - 1,
            present_days = present_days + 1
        WHERE id = ?
      `, [request.attendance_record_id]);
      break;
  }
  
  // Update request status
  await db.query(`
    UPDATE attendance_regularization_requests
    SET status = 'approved',
        approved_by = ?,
        approval_date = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [approvedBy, requestId]);
  
  return { success: true, message: 'Regularization request approved' };
}
```

**Business Rules**:
- Employees can request attendance corrections
- Require reason and supporting documents
- Manager approval required
- Cannot regularize locked attendance
- Update attendance record upon approval
- Track all regularization requests for audit

---

#### 4.1.5 Attendance Analytics & Reports

**Rule**: Provide comprehensive attendance analytics for management insights

**Attendance Analytics**:
```javascript
async function getAttendanceAnalytics(month, year, departmentId = null) {
  const whereClause = departmentId 
    ? `AND e.department_id = ${departmentId}` 
    : '';
  
  const analytics = {};
  
  // 1. Overall attendance summary
  const summary = await db.query(`
    SELECT 
      COUNT(DISTINCT ar.employee_id) as total_employees,
      AVG(ar.present_days) as avg_present_days,
      AVG(ar.payable_days) as avg_payable_days,
      AVG(ar.loss_of_pay_days) as avg_lop_days,
      SUM(ar.absent_days) as total_absents,
      SUM(ar.paid_leave) as total_paid_leaves,
      SUM(ar.unpaid_leave) as total_unpaid_leaves,
      AVG((ar.present_days * 100.0 / ar.total_working_days)) as avg_attendance_percentage
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.employee_id
    WHERE ar.month = ? AND ar.year = ?
      ${whereClause}
  `, [month, year]);
  
  analytics.summary = summary;
  
  // 2. Department-wise breakdown
  const departmentBreakdown = await db.query(`
    SELECT 
      d.name as department,
      COUNT(DISTINCT ar.employee_id) as employee_count,
      AVG(ar.present_days) as avg_present_days,
      AVG((ar.present_days * 100.0 / ar.total_working_days)) as attendance_percentage,
      SUM(ar.loss_of_pay_days) as total_lop_days
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.employee_id
    JOIN departments d ON e.department_id = d.id
    WHERE ar.month = ? AND ar.year = ?
    GROUP BY d.name
    ORDER BY attendance_percentage DESC
  `, [month, year]);
  
  analytics.departmentBreakdown = departmentBreakdown;
  
  // 3. Employees with high absenteeism (>20% absent)
  const highAbsenteeism = await db.query(`
    SELECT 
      ar.employee_id, ar.employee_name,
      ar.absent_days, ar.unpaid_leave,
      (ar.absent_days + ar.unpaid_leave) as total_absences,
      ((ar.absent_days + ar.unpaid_leave) * 100.0 / ar.total_working_days) as absence_percentage
    FROM attendance_records ar
    WHERE ar.month = ? AND ar.year = ?
      AND ((ar.absent_days + ar.unpaid_leave) * 100.0 / ar.total_working_days) > 20
    ORDER BY absence_percentage DESC
  `, [month, year]);
  
  analytics.highAbsenteeism = highAbsenteeism;
  
  // 4. Perfect attendance (100% present)
  const perfectAttendance = await db.query(`
    SELECT 
      ar.employee_id, ar.employee_name,
      ar.present_days, ar.total_working_days
    FROM attendance_records ar
    WHERE ar.month = ? AND ar.year = ?
      AND ar.present_days = ar.total_working_days
      AND ar.absent_days = 0
      AND ar.unpaid_leave = 0
  `, [month, year]);
  
  analytics.perfectAttendance = perfectAttendance;
  
  // 5. Late arrivals and early departures
  const punctuality = await db.query(`
    SELECT 
      COUNT(*) as employees_with_late_arrivals,
      AVG(late_arrivals) as avg_late_arrivals,
      COUNT(CASE WHEN late_arrivals > 5 THEN 1 END) as excessive_late_arrivals
    FROM attendance_records
    WHERE month = ? AND year = ?
  `, [month, year]);
  
  analytics.punctuality = punctuality;
  
  return analytics;
}

// Attendance trend analysis (last 6 months)
async function getAttendanceTrend(employeeId) {
  const trend = await db.query(`
    SELECT 
      month, year,
      present_days,
      total_working_days,
      (present_days * 100.0 / total_working_days) as attendance_percentage,
      loss_of_pay_days,
      overtime_hours
    FROM attendance_records
    WHERE employee_id = ?
    ORDER BY year DESC, 
      FIELD(month, 'January','February','March','April','May','June',
                   'July','August','September','October','November','December') DESC
    LIMIT 6
  `, [employeeId]);
  
  return trend;
}

// Compliance report (for labor department)
async function generateComplianceReport(year) {
  const report = await db.query(`
    SELECT 
      e.employee_id,
      CONCAT(e.first_name, ' ', e.last_name) as employee_name,
      e.department_id,
      SUM(ar.present_days) as total_present_days,
      SUM(ar.paid_leave) as total_paid_leaves,
      SUM(ar.unpaid_leave) as total_unpaid_leaves,
      SUM(ar.loss_of_pay_days) as total_lop_days,
      SUM(ar.overtime_hours) as total_overtime_hours,
      AVG((ar.present_days * 100.0 / ar.total_working_days)) as avg_attendance_percentage
    FROM employees e
    LEFT JOIN attendance_records ar ON e.employee_id = ar.employee_id
    WHERE ar.year = ?
    GROUP BY e.employee_id, e.first_name, e.last_name, e.department_id
    ORDER BY e.employee_id
  `, [year]);
  
  return report;
}
```

**Business Rules**:
- Calculate average attendance percentage
- Identify high absenteeism (>20% absences)
- Track perfect attendance for recognition
- Department-wise attendance comparison
- Monitor punctuality (late arrivals/early departures)
- Generate compliance reports for statutory audits

---

#### 4.1.6 Attendance Integration with Payroll

**Rule**: Seamless integration between attendance and payroll processing

**Payroll Integration**:
```javascript
async function getAttendanceForPayroll(employeeId, month, year) {
  const attendance = await db.query(`
    SELECT 
      employee_id,
      total_working_days,
      present_days,
      payable_days,
      loss_of_pay_days,
      overtime_hours,
      status
    FROM attendance_records
    WHERE employee_id = ? AND month = ? AND year = ?
  `, [employeeId, month, year]);
  
  if (!attendance) {
    // Create default attendance if missing
    console.warn(`No attendance record for ${employeeId} - ${month} ${year}. Using defaults.`);
    const workingDays = calculateWorkingDays(month, year);
    return {
      employee_id: employeeId,
      total_working_days: workingDays.total_working_days,
      payable_days: workingDays.total_working_days, // Assume full attendance
      loss_of_pay_days: 0,
      overtime_hours: 0,
      status: 'auto_generated'
    };
  }
  
  if (attendance.status !== 'approved' && attendance.status !== 'locked') {
    console.warn(`Attendance for ${employeeId} is not approved (status: ${attendance.status})`);
  }
  
  return attendance;
}

// Calculate pro-rated salary based on attendance
function calculateProRatedSalary(baseSalary, totalWorkingDays, payableDays) {
  const perDaySalary = baseSalary / totalWorkingDays;
  const proRatedSalary = perDaySalary * payableDays;
  
  return {
    baseSalary,
    perDaySalary: parseFloat(perDaySalary.toFixed(2)),
    payableDays,
    totalWorkingDays,
    proRatedSalary: parseFloat(proRatedSalary.toFixed(2)),
    lopDeduction: parseFloat((baseSalary - proRatedSalary).toFixed(2))
  };
}

// Bulk fetch attendance for payroll processing
async function getAttendanceForPayrollBatch(month, year) {
  const attendanceRecords = await db.query(`
    SELECT 
      ar.employee_id,
      ar.employee_name,
      ar.total_working_days,
      ar.payable_days,
      ar.loss_of_pay_days,
      ar.overtime_hours,
      ar.status,
      e.salary_basic,
      e.salary_ctc
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.employee_id
    WHERE ar.month = ? AND ar.year = ?
      AND e.employment_status IN ('active', 'confirmed')
      AND ar.status IN ('approved', 'locked')
    ORDER BY ar.employee_id
  `, [month, year]);
  
  return attendanceRecords.map(record => ({
    ...record,
    proRatedCalculation: calculateProRatedSalary(
      record.salary_basic,
      record.total_working_days,
      record.payable_days
    )
  }));
}
```

**Business Rules**:
- Only approved/locked attendance used for payroll
- Pro-rate salary: (Basic / Working Days) × Payable Days
- LOP deduction: (Basic / Working Days) × LOP Days
- Default to full attendance if record missing (with warning)
- Lock attendance after payroll processing
- Overtime calculation based on overtime_hours

---

#### 4.1.7 Biometric Integration & Daily Logs

**Rule**: Integrate with biometric attendance systems for real-time tracking

**Biometric Integration**:
```javascript
// Daily attendance log (raw biometric data)
const DAILY_ATTENDANCE_LOG_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  employee_id: 'VARCHAR(20) FOREIGN KEY',
  attendance_date: 'DATE NOT NULL',
  check_in_time: 'TIMESTAMP',
  check_out_time: 'TIMESTAMP',
  total_hours: 'DECIMAL(5,2) COMPUTED',
  status: 'ENUM', // 'present', 'absent', 'half_day', 'leave', 'holiday'
  location: 'VARCHAR(100)', // Office location/branch
  device_id: 'VARCHAR(50)', // Biometric device ID
  created_at: 'TIMESTAMP'
};

async function recordDailyAttendance(attendanceLog) {
  // Validate employee
  const employee = await db.query(`
    SELECT employee_id, shift_start_time, shift_end_time
    FROM employees WHERE employee_id = ?
  `, [attendanceLog.employee_id]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // Calculate total hours worked
  const checkIn = new Date(attendanceLog.check_in_time);
  const checkOut = new Date(attendanceLog.check_out_time);
  const totalHours = (checkOut - checkIn) / (1000 * 60 * 60); // Convert ms to hours
  
  // Determine status
  let status = 'present';
  if (totalHours < 4) {
    status = 'half_day';
  } else if (totalHours > 9) {
    // Calculate overtime
    const overtimeHours = totalHours - 9;
  }
  
  // Check if late arrival
  const expectedCheckIn = new Date(attendanceLog.attendance_date + ' ' + employee.shift_start_time);
  const isLate = checkIn > expectedCheckIn;
  
  // Insert daily log
  await db.query(`
    INSERT INTO daily_attendance_logs (
      employee_id, attendance_date,
      check_in_time, check_out_time, total_hours,
      status, location, device_id, is_late
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    attendanceLog.employee_id,
    attendanceLog.attendance_date,
    attendanceLog.check_in_time,
    attendanceLog.check_out_time,
    totalHours,
    status,
    attendanceLog.location,
    attendanceLog.device_id,
    isLate
  ]);
  
  return { success: true, totalHours, status, isLate };
}

// Aggregate daily logs into monthly attendance
async function aggregateMonthlyAttendance(month, year) {
  const aggregated = await db.query(`
    SELECT 
      dal.employee_id,
      COUNT(CASE WHEN dal.status = 'present' THEN 1 END) as present_days,
      COUNT(CASE WHEN dal.status = 'absent' THEN 1 END) as absent_days,
      COUNT(CASE WHEN dal.status = 'half_day' THEN 1 END) as half_days,
      COUNT(CASE WHEN dal.is_late = true THEN 1 END) as late_arrivals,
      SUM(CASE WHEN dal.total_hours > 9 THEN dal.total_hours - 9 ELSE 0 END) as overtime_hours
    FROM daily_attendance_logs dal
    WHERE MONTHNAME(dal.attendance_date) = ?
      AND YEAR(dal.attendance_date) = ?
    GROUP BY dal.employee_id
  `, [month, year]);
  
  // Update or create monthly attendance records
  for (const record of aggregated) {
    await db.query(`
      INSERT INTO attendance_records (
        id, employee_id, month, year,
        present_days, absent_days, half_days,
        late_arrivals, overtime_hours, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      ON DUPLICATE KEY UPDATE
        present_days = ?,
        absent_days = ?,
        half_days = ?,
        late_arrivals = ?,
        overtime_hours = ?
    `, [
      `ATT${Date.now()}_${record.employee_id}`,
      record.employee_id,
      month,
      year,
      record.present_days,
      record.absent_days,
      record.half_days,
      record.late_arrivals,
      record.overtime_hours,
      // ON DUPLICATE KEY values
      record.present_days,
      record.absent_days,
      record.half_days,
      record.late_arrivals,
      record.overtime_hours
    ]);
  }
  
  return { success: true, recordsProcessed: aggregated.length };
}
```

**Business Rules**:
- Capture daily check-in/check-out from biometric devices
- Calculate total hours worked per day
- Determine late arrivals based on shift timings
- Auto-calculate overtime (hours > 9 per day)
- Aggregate daily logs into monthly attendance
- Support multiple office locations/branches

---

#### 4.1.8 Attendance Notifications & Alerts

**Rule**: Automated notifications for attendance-related events

**Notification System**:
```javascript
async function sendAttendanceAlerts(month, year) {
  // 1. Alert employees with pending attendance submission
  const pendingAttendance = await db.query(`
    SELECT e.employee_id, e.official_email, e.first_name
    FROM employees e
    LEFT JOIN attendance_records ar ON e.employee_id = ar.employee_id
      AND ar.month = ? AND ar.year = ?
    WHERE e.employment_status IN ('active', 'confirmed')
      AND (ar.id IS NULL OR ar.status = 'draft')
  `, [month, year]);
  
  for (const emp of pendingAttendance) {
    await sendEmail({
      to: emp.official_email,
      subject: `Action Required: Submit Attendance for ${month} ${year}`,
      body: `Dear ${emp.first_name},\n\nYour attendance for ${month} ${year} is pending submission. Please submit it at the earliest.\n\nBest regards,\nHR Team`
    });
  }
  
  // 2. Alert managers with pending approvals
  const pendingApprovals = await db.query(`
    SELECT 
      e.reporting_manager_id,
      COUNT(*) as pending_count
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.employee_id
    WHERE ar.month = ? AND ar.year = ?
      AND ar.status = 'submitted'
    GROUP BY e.reporting_manager_id
  `, [month, year]);
  
  for (const manager of pendingApprovals) {
    await sendNotification(manager.reporting_manager_id, {
      type: 'attendance_approvals_pending',
      message: `You have ${manager.pending_count} attendance records pending approval for ${month} ${year}`,
      priority: 'high'
    });
  }
  
  // 3. Alert HR about high absenteeism
  const highAbsenteeism = await db.query(`
    SELECT 
      ar.employee_id, ar.employee_name,
      ((ar.absent_days + ar.unpaid_leave) * 100.0 / ar.total_working_days) as absence_percentage
    FROM attendance_records ar
    WHERE ar.month = ? AND ar.year = ?
      AND ((ar.absent_days + ar.unpaid_leave) * 100.0 / ar.total_working_days) > 20
  `, [month, year]);
  
  if (highAbsenteeism.length > 0) {
    await sendEmailToHR({
      subject: `High Absenteeism Alert - ${month} ${year}`,
      body: `${highAbsenteeism.length} employees have absenteeism above 20%:\n\n` +
            highAbsenteeism.map(emp => 
              `- ${emp.employee_name} (${emp.employee_id}): ${emp.absence_percentage.toFixed(2)}%`
            ).join('\n')
    });
  }
  
  return { success: true };
}

// Daily late arrival alerts
async function sendLateArrivalAlerts() {
  const today = new Date().toISOString().split('T')[0];
  
  const lateEmployees = await db.query(`
    SELECT 
      dal.employee_id,
      e.first_name, e.official_email, e.reporting_manager_id,
      dal.check_in_time,
      e.shift_start_time
    FROM daily_attendance_logs dal
    JOIN employees e ON dal.employee_id = e.employee_id
    WHERE dal.attendance_date = ?
      AND dal.is_late = true
  `, [today]);
  
  for (const emp of lateEmployees) {
    // Notify manager
    await sendNotification(emp.reporting_manager_id, {
      type: 'late_arrival',
      message: `${emp.first_name} arrived late today (${emp.check_in_time})`
    });
  }
}
```

**Business Rules**:
- Alert employees with pending attendance submission
- Notify managers of pending approvals
- Alert HR about high absenteeism (>20%)
- Daily late arrival notifications to managers
- Reminder emails 5 days before month-end
- Escalation alerts for unapproved attendance

---

#### 4.1.9 Attendance Export & Statutory Reports

**Rule**: Generate attendance reports for compliance and analysis

**Report Generation**:
```javascript
async function exportAttendanceReport(month, year, format = 'csv') {
  const attendanceData = await db.query(`
    SELECT 
      ar.employee_id,
      ar.employee_name,
      d.name as department,
      des.title as designation,
      ar.total_working_days,
      ar.present_days,
      ar.absent_days,
      ar.paid_leave,
      ar.unpaid_leave,
      ar.payable_days,
      ar.loss_of_pay_days,
      ar.half_days,
      ar.overtime_hours,
      ar.late_arrivals,
      ar.early_departures,
      ROUND((ar.present_days * 100.0 / ar.total_working_days), 2) as attendance_percentage,
      ar.status
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.employee_id
    JOIN departments d ON e.department_id = d.id
    JOIN designations des ON e.designation_id = des.id
    WHERE ar.month = ? AND ar.year = ?
    ORDER BY d.name, ar.employee_name
  `, [month, year]);
  
  if (format === 'csv') {
    return convertToCSV(attendanceData);
  } else if (format === 'json') {
    return JSON.stringify(attendanceData, null, 2);
  } else if (format === 'pdf') {
    return generatePDFReport(attendanceData, month, year);
  }
}

// Statutory compliance report (Form required by labor department)
async function generateStatutoryAttendanceReport(year) {
  const report = await db.query(`
    SELECT 
      e.employee_id,
      e.first_name,
      e.last_name,
      e.date_of_birth,
      e.gender,
      d.name as department,
      SUM(ar.present_days) as total_present_days,
      SUM(ar.paid_leave) as total_paid_leaves,
      SUM(ar.unpaid_leave) as total_unpaid_leaves,
      SUM(ar.overtime_hours) as total_overtime_hours,
      COUNT(*) as months_worked
    FROM employees e
    LEFT JOIN attendance_records ar ON e.employee_id = ar.employee_id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE ar.year = ?
    GROUP BY e.employee_id, e.first_name, e.last_name, 
             e.date_of_birth, e.gender, d.name
    ORDER BY e.employee_id
  `, [year]);
  
  return report;
}
```

**Business Rules**:
- Export attendance in CSV, JSON, PDF formats
- Include all key metrics (present, absent, LOP, overtime)
- Department-wise and employee-wise reports
- Statutory compliance reports for labor department
- Monthly and annual attendance summaries
- Support filtered exports (by department, date range)

---

#### 4.1.10 Attendance Validation & Data Quality

**Rule**: Ensure data quality and consistency in attendance records

**Data Validation**:
```javascript
async function validateAttendanceRecord(recordId) {
  const record = await db.query(`
    SELECT * FROM attendance_records WHERE id = ?
  `, [recordId]);
  
  if (!record) {
    throw new Error('Record not found');
  }
  
  const validationErrors = [];
  
  // 1. Check if total days match
  const totalAccounted = record.present_days + record.absent_days + 
                         record.paid_leave + record.unpaid_leave;
  
  if (totalAccounted > record.total_working_days) {
    validationErrors.push({
      field: 'total_days',
      message: `Total accounted days (${totalAccounted}) exceed working days (${record.total_working_days})`
    });
  }
  
  // 2. Validate computed fields
  const expectedPayable = record.present_days + record.paid_leave + (record.half_days * 0.5);
  if (Math.abs(record.payable_days - expectedPayable) > 0.1) {
    validationErrors.push({
      field: 'payable_days',
      message: `Payable days mismatch. Expected: ${expectedPayable}, Actual: ${record.payable_days}`
    });
  }
  
  const expectedLOP = record.unpaid_leave + record.absent_days;
  if (record.loss_of_pay_days !== expectedLOP) {
    validationErrors.push({
      field: 'loss_of_pay_days',
      message: `LOP days mismatch. Expected: ${expectedLOP}, Actual: ${record.loss_of_pay_days}`
    });
  }
  
  // 3. Validate against leave balance
  const leaveBalance = await db.query(`
    SELECT 
      total_earned_leaves,
      earned_leaves_used,
      casual_leaves_total,
      casual_leaves_used
    FROM employee_leave_balances
    WHERE employee_id = ? AND year = ?
  `, [record.employee_id, record.year]);
  
  if (leaveBalance && record.paid_leave > (leaveBalance.total_earned_leaves + leaveBalance.casual_leaves_total)) {
    validationErrors.push({
      field: 'paid_leave',
      message: 'Paid leave days exceed available leave balance'
    });
  }
  
  // 4. Check for negative values
  ['present_days', 'absent_days', 'paid_leave', 'unpaid_leave'].forEach(field => {
    if (record[field] < 0) {
      validationErrors.push({
        field,
        message: `${field} cannot be negative`
      });
    }
  });
  
  return {
    valid: validationErrors.length === 0,
    errors: validationErrors
  };
}

// Bulk validation for month
async function validateMonthlyAttendance(month, year) {
  const allRecords = await db.query(`
    SELECT id FROM attendance_records
    WHERE month = ? AND year = ?
  `, [month, year]);
  
  const results = {
    total: allRecords.length,
    valid: 0,
    invalid: 0,
    errors: []
  };
  
  for (const record of allRecords) {
    const validation = await validateAttendanceRecord(record.id);
    if (validation.valid) {
      results.valid++;
    } else {
      results.invalid++;
      results.errors.push({
        recordId: record.id,
        errors: validation.errors
      });
    }
  }
  
  return results;
}
```

**Business Rules**:
- Validate total days don't exceed working days
- Verify computed fields (payable_days, LOP_days)
- Check against leave balance
- Prevent negative values
- Validate before approval
- Report validation errors for correction

---

## 5. Payroll Management Rules

### 5.1 PayRun Processing & Management
**Rule**: Execute monthly payroll with comprehensive salary calculations, statutory deductions, and compliance reporting

**Purpose**: Process monthly payroll for all active employees, calculate pro-rated salaries based on attendance, apply statutory and non-statutory deductions, generate payslips, ensure compliance with labor laws, and provide financial reporting for accounting integration.

---

#### 5.1.1 PayRun Creation & Initialization

**Rule**: Create monthly payroll run with proper validation and employee inclusion

**PayRun Structure**:
```javascript
const PAYRUN_SCHEMA = {
  id: 'VARCHAR(50) PRIMARY KEY', // Format: PR{timestamp}
  month: 'VARCHAR(20) NOT NULL', // 'January', 'February', etc.
  year: 'VARCHAR(4) NOT NULL', // '2026', '2027', etc.
  payroll_period_start: 'DATE NOT NULL', // Salary calculation period start
  payroll_period_end: 'DATE NOT NULL', // Salary calculation period end
  payment_date: 'DATE', // Actual salary payment date
  generated_at: 'TIMESTAMP NOT NULL',
  generated_by_user_id: 'UUID FOREIGN KEY',
  status: 'ENUM', // 'draft', 'in_review', 'approved', 'processed', 'paid', 'cancelled'
  total_employees: 'INT NOT NULL',
  total_gross: 'DECIMAL(15,2) NOT NULL',
  total_deductions: 'DECIMAL(15,2) NOT NULL',
  total_net_pay: 'DECIMAL(15,2) NOT NULL',
  total_employer_pf: 'DECIMAL(15,2)', // Employer PF contribution
  total_employer_esi: 'DECIMAL(15,2)', // Employer ESI contribution
  total_employer_cost: 'DECIMAL(15,2)', // Total cost to company
  approval_comments: 'TEXT',
  approved_by: 'UUID FOREIGN KEY',
  approval_date: 'TIMESTAMP',
  processed_by: 'UUID FOREIGN KEY',
  processed_date: 'TIMESTAMP',
  is_locked: 'BOOLEAN DEFAULT false',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};

// Payroll processing status flow
const PAYRUN_STATUS_FLOW = {
  draft: 'Initial creation, can be edited',
  in_review: 'Submitted for review by HR/Finance',
  approved: 'Approved by authorized personnel',
  processed: 'Payroll processed, payslips generated',
  paid: 'Salaries disbursed to employees',
  cancelled: 'Payroll run cancelled'
};
```

**Create PayRun**:
```javascript
async function createPayRun(month, year, createdBy) {
  // Check for existing pay run
  const existing = await db.query(`
    SELECT id, status FROM pay_runs
    WHERE month = ? AND year = ?
  `, [month, year]);
  
  if (existing) {
    if (existing.status === 'cancelled') {
      console.log('Previous pay run was cancelled. Creating new one.');
    } else {
      throw new Error(`Pay run for ${month} ${year} already exists (Status: ${existing.status})`);
    }
  }
  
  // Validate attendance records are approved
  const unapprovedAttendance = await db.query(`
    SELECT COUNT(*) as count FROM attendance_records
    WHERE month = ? AND year = ?
      AND status NOT IN ('approved', 'locked')
  `, [month, year]);
  
  if (unapprovedAttendance.count > 0) {
    console.warn(`Warning: ${unapprovedAttendance.count} attendance records are not approved`);
  }
  
  // Get all active employees
  const employees = await db.query(`
    SELECT employee_id FROM employees
    WHERE employment_status IN ('active', 'confirmed')
      AND (
        resignation_date IS NULL 
        OR resignation_date > LAST_DAY(CONCAT(?, '-01'))
      )
  `, [year + '-' + getMonthNumber(month)]);
  
  if (employees.length === 0) {
    throw new Error('No active employees found for payroll processing');
  }
  
  // Calculate payroll period dates
  const periodDates = calculatePayrollPeriod(month, year);
  
  // Generate unique ID
  const payRunId = `PR${Date.now()}`;
  
  // Create pay run
  await db.query(`
    INSERT INTO pay_runs (
      id, month, year,
      payroll_period_start, payroll_period_end,
      generated_at, generated_by_user_id,
      status, total_employees,
      total_gross, total_deductions, total_net_pay
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'draft', ?, 0, 0, 0)
  `, [
    payRunId,
    month,
    year,
    periodDates.start,
    periodDates.end,
    createdBy,
    employees.length
  ]);
  
  // Audit log
  await db.query(`
    INSERT INTO audit_logs (action, entity_type, entity_id, details, user_id)
    VALUES ('payrun_created', 'pay_runs', ?, ?, ?)
  `, [
    payRunId,
    JSON.stringify({ month, year, employeeCount: employees.length }),
    createdBy
  ]);
  
  return {
    success: true,
    payRunId,
    employeeCount: employees.length,
    message: `Pay run created for ${month} ${year}`
  };
}

// Calculate payroll period (typically 1st to last day of month)
function calculatePayrollPeriod(month, year) {
  const monthNum = getMonthNumber(month);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0); // Last day of month
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0]
  };
}

function getMonthNumber(monthName) {
  const months = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
  };
  return months[monthName];
}
```

**Business Rules**:
- One pay run per month-year (unique constraint)
- Include all active employees (not resigned or terminated)
- Validate attendance records are approved before processing
- Auto-calculate payroll period dates (1st to last day of month)
- Payment date typically 1st of next month
- Track generation timestamp and user

---

#### 5.1.2 Employee Salary Calculation & Pro-Rating

**Rule**: Calculate individual employee salaries with attendance-based pro-rating

**Salary Calculation**:
```javascript
async function calculateEmployeeSalary(employeeId, payRunId, month, year) {
  // 1. Get employee salary components
  const employee = await db.query(`
    SELECT 
      employee_id,
      CONCAT(first_name, ' ', last_name) as full_name,
      salary_basic,
      salary_hra,
      salary_conveyance,
      salary_medical,
      salary_special_allowance,
      salary_telephone,
      salary_ctc,
      salary_gross,
      pf_number,
      esi_number,
      pan_number
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  if (!employee) {
    throw new Error('Employee not found');
  }
  
  // 2. Get attendance for the month
  const attendance = await db.query(`
    SELECT 
      total_working_days,
      payable_days,
      loss_of_pay_days,
      overtime_hours
    FROM attendance_records
    WHERE employee_id = ? AND month = ? AND year = ?
  `, [employeeId, month, year]);
  
  // Default to full month if no attendance record
  const workingDays = attendance?.total_working_days || 26;
  const payableDays = attendance?.payable_days || workingDays;
  const lopDays = attendance?.loss_of_pay_days || 0;
  const overtimeHours = attendance?.overtime_hours || 0;
  
  // 3. Pro-rate salary components
  const proRatedBasic = (employee.salary_basic / workingDays) * payableDays;
  const proRatedHRA = (employee.salary_hra / workingDays) * payableDays;
  const proRatedConveyance = (employee.salary_conveyance / workingDays) * payableDays;
  const proRatedMedical = (employee.salary_medical / workingDays) * payableDays;
  const proRatedSpecialAllowance = (employee.salary_special_allowance / workingDays) * payableDays;
  const proRatedTelephone = (employee.salary_telephone / workingDays) * payableDays;
  
  // 4. Calculate LOP deduction
  const lopAmount = (employee.salary_gross / workingDays) * lopDays;
  
  // 5. Calculate overtime (if applicable)
  const overtimeRate = (employee.salary_basic / workingDays / 9); // Per hour rate
  const overtimeAmount = overtimeHours * overtimeRate * 2; // 2x rate for overtime
  
  // 6. Total allowances and gross
  const totalAllowances = proRatedHRA + proRatedConveyance + proRatedMedical + 
                          proRatedSpecialAllowance + proRatedTelephone;
  const grossSalary = proRatedBasic + totalAllowances + overtimeAmount;
  
  // 7. Calculate statutory deductions
  const deductions = await calculateStatutoryDeductions(employee, proRatedBasic, grossSalary);
  
  // 8. Get advance and loan deductions
  const advanceDeduction = await getAdvanceDeduction(employeeId, month, year);
  const loanDeduction = await getLoanEMI(employeeId, month, year);
  
  // 9. Calculate total deductions
  const totalDeductions = deductions.pf + deductions.esi + deductions.pt + deductions.tds +
                          advanceDeduction + loanDeduction + lopAmount;
  
  // 10. Calculate net pay
  const netPay = grossSalary - totalDeductions;
  
  return {
    employee_id: employeeId,
    employee_name: employee.full_name,
    // Earnings
    basic_salary: parseFloat(proRatedBasic.toFixed(2)),
    hra: parseFloat(proRatedHRA.toFixed(2)),
    conveyance: parseFloat(proRatedConveyance.toFixed(2)),
    telephone: parseFloat(proRatedTelephone.toFixed(2)),
    medical_allowance: parseFloat(proRatedMedical.toFixed(2)),
    special_allowance: parseFloat(proRatedSpecialAllowance.toFixed(2)),
    overtime_amount: parseFloat(overtimeAmount.toFixed(2)),
    total_allowances: parseFloat(totalAllowances.toFixed(2)),
    gross_salary: parseFloat(grossSalary.toFixed(2)),
    // Attendance
    total_working_days: workingDays,
    payable_days: payableDays,
    loss_of_pay_days: lopDays,
    overtime_hours: overtimeHours,
    // Deductions
    loss_of_pay_amount: parseFloat(lopAmount.toFixed(2)),
    pf_deduction: parseFloat(deductions.pf.toFixed(2)),
    esi_deduction: parseFloat(deductions.esi.toFixed(2)),
    professional_tax: parseFloat(deductions.pt.toFixed(2)),
    tds: parseFloat(deductions.tds.toFixed(2)),
    advance_deduction: parseFloat(advanceDeduction.toFixed(2)),
    loan_deduction: parseFloat(loanDeduction.toFixed(2)),
    total_deductions: parseFloat(totalDeductions.toFixed(2)),
    // Net pay
    net_pay: parseFloat(netPay.toFixed(2)),
    // Employer contributions
    employer_pf: parseFloat(deductions.employer_pf.toFixed(2)),
    employer_esi: parseFloat(deductions.employer_esi.toFixed(2))
  };
}

// Calculate statutory deductions (PF, ESI, PT, TDS)
async function calculateStatutoryDeductions(employee, basicSalary, grossSalary) {
  const deductions = {
    pf: 0,
    employer_pf: 0,
    esi: 0,
    employer_esi: 0,
    pt: 0,
    tds: 0
  };
  
  // 1. PF Calculation (12% employee + 12% employer on basic, capped at ₹15,000)
  if (employee.pf_number) {
    const pfBase = Math.min(basicSalary, 15000);
    deductions.pf = pfBase * 0.12;
    deductions.employer_pf = pfBase * 0.12;
  }
  
  // 2. ESI Calculation (0.75% employee + 3.25% employer on gross, if gross < ₹21,000)
  if (employee.esi_number && grossSalary <= 21000) {
    deductions.esi = grossSalary * 0.0075;
    deductions.employer_esi = grossSalary * 0.0325;
  }
  
  // 3. Professional Tax (state-specific, example for Maharashtra)
  deductions.pt = calculateProfessionalTax(grossSalary);
  
  // 4. TDS Calculation (based on annual projections)
  if (employee.pan_number) {
    deductions.tds = await calculateTDS(employee.employee_id, grossSalary);
  }
  
  return deductions;
}

// Professional Tax calculation (Maharashtra rates)
function calculateProfessionalTax(grossSalary) {
  if (grossSalary <= 7500) return 0;
  if (grossSalary <= 10000) return 175;
  return 200; // Max PT per month
}

// Get advance deduction for the month
async function getAdvanceDeduction(employeeId, month, year) {
  const advance = await db.query(`
    SELECT advance_paid_amount FROM advance_records
    WHERE employee_id = ?
      AND advance_deduction_month = ?
      AND advance_deduction_year = ?
      AND status IN ('pending', 'partial')
  `, [employeeId, month, year]);
  
  return advance?.advance_paid_amount || 0;
}

// Get loan EMI for the month
async function getLoanEMI(employeeId, month, year) {
  const emi = await db.query(`
    SELECT emi_amount FROM loan_emis
    WHERE loan_id IN (
      SELECT id FROM loan_records
      WHERE employee_id = ? AND status = 'active'
    )
    AND month = ? AND year = ?
    AND status = 'pending'
  `, [employeeId, month, year]);
  
  return emi?.emi_amount || 0;
}
```

**Business Rules**:
- Pro-rate all salary components: (Component / Working Days) × Payable Days
- LOP deduction: (Gross / Working Days) × LOP Days
- Overtime: (Basic / Working Days / 9) × Hours × 2
- PF: 12% on basic (max ₹15,000), both employee and employer
- ESI: 0.75% employee + 3.25% employer (if gross ≤ ₹21,000)
- Professional Tax: State-specific rates
- TDS: Based on annual income projection
- Net Pay = Gross - Total Deductions

---

#### 5.1.3 Bulk Payroll Processing

**Rule**: Process payroll for all employees in batch with error handling

**Batch Processing**:
```javascript
async function processPayRun(payRunId, processedBy) {
  // Get pay run details
  const payRun = await db.query(`
    SELECT * FROM pay_runs WHERE id = ?
  `, [payRunId]);
  
  if (!payRun) {
    throw new Error('Pay run not found');
  }
  
  if (payRun.status !== 'draft' && payRun.status !== 'in_review') {
    throw new Error(`Cannot process pay run with status: ${payRun.status}`);
  }
  
  // Get all active employees
  const employees = await db.query(`
    SELECT employee_id FROM employees
    WHERE employment_status IN ('active', 'confirmed')
  `);
  
  const results = {
    success: [],
    failed: [],
    total: employees.length,
    totalGross: 0,
    totalDeductions: 0,
    totalNetPay: 0
  };
  
  // Process each employee
  for (const emp of employees) {
    try {
      // Calculate salary
      const salaryData = await calculateEmployeeSalary(
        emp.employee_id,
        payRunId,
        payRun.month,
        payRun.year
      );
      
      // Create pay run employee record
      await db.query(`
        INSERT INTO pay_run_employee_records (
          pay_run_id, employee_id, employee_name,
          basic_salary, hra, conveyance, telephone,
          medical_allowance, special_allowance,
          total_allowances, gross_salary,
          total_working_days, payable_days, loss_of_pay_days,
          loss_of_pay_amount, advance_deduction, loan_deduction,
          pf_deduction, esi_deduction, professional_tax, tds,
          total_deductions, net_pay
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        payRunId,
        salaryData.employee_id,
        salaryData.employee_name,
        salaryData.basic_salary,
        salaryData.hra,
        salaryData.conveyance,
        salaryData.telephone,
        salaryData.medical_allowance,
        salaryData.special_allowance,
        salaryData.total_allowances,
        salaryData.gross_salary,
        salaryData.total_working_days,
        salaryData.payable_days,
        salaryData.loss_of_pay_days,
        salaryData.loss_of_pay_amount,
        salaryData.advance_deduction,
        salaryData.loan_deduction,
        salaryData.pf_deduction,
        salaryData.esi_deduction,
        salaryData.professional_tax,
        salaryData.tds,
        salaryData.total_deductions,
        salaryData.net_pay
      ]);
      
      // Update advance status
      if (salaryData.advance_deduction > 0) {
        await updateAdvanceStatus(emp.employee_id, payRun.month, payRun.year);
      }
      
      // Update loan EMI status
      if (salaryData.loan_deduction > 0) {
        await updateLoanEMIStatus(emp.employee_id, payRun.month, payRun.year);
      }
      
      // Accumulate totals
      results.totalGross += salaryData.gross_salary;
      results.totalDeductions += salaryData.total_deductions;
      results.totalNetPay += salaryData.net_pay;
      
      results.success.push({
        employee_id: emp.employee_id,
        net_pay: salaryData.net_pay
      });
      
    } catch (error) {
      results.failed.push({
        employee_id: emp.employee_id,
        error: error.message
      });
    }
  }
  
  // Update pay run totals
  await db.query(`
    UPDATE pay_runs
    SET total_gross = ?,
        total_deductions = ?,
        total_net_pay = ?,
        status = 'processed',
        processed_by = ?,
        processed_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    results.totalGross,
    results.totalDeductions,
    results.totalNetPay,
    processedBy,
    payRunId
  ]);
  
  // Lock attendance records
  await db.query(`
    UPDATE attendance_records
    SET status = 'locked'
    WHERE month = ? AND year = ?
      AND status = 'approved'
  `, [payRun.month, payRun.year]);
  
  return results;
}

// Update advance record status after deduction
async function updateAdvanceStatus(employeeId, month, year) {
  await db.query(`
    UPDATE advance_records
    SET status = 'deducted',
        remaining_amount = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = ?
      AND advance_deduction_month = ?
      AND advance_deduction_year = ?
      AND status = 'pending'
  `, [employeeId, month, year]);
}

// Update loan EMI status after deduction
async function updateLoanEMIStatus(employeeId, month, year) {
  await db.query(`
    UPDATE loan_emis
    SET status = 'paid',
        payment_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE loan_id IN (
      SELECT id FROM loan_records WHERE employee_id = ?
    )
    AND month = ? AND year = ?
    AND status = 'pending'
  `, [employeeId, month, year]);
  
  // Update loan record
  await db.query(`
    UPDATE loan_records lr
    SET total_paid_emis = (
      SELECT COUNT(*) FROM loan_emis
      WHERE loan_id = lr.id AND status = 'paid'
    ),
    remaining_balance = loan_amount - (
      SELECT SUM(emi_amount) FROM loan_emis
      WHERE loan_id = lr.id AND status = 'paid'
    ),
    status = CASE
      WHEN (SELECT COUNT(*) FROM loan_emis WHERE loan_id = lr.id AND status = 'paid') >= lr.number_of_emis
      THEN 'completed'
      ELSE 'active'
    END
    WHERE employee_id = ?
  `, [employeeId]);
}
```

**Business Rules**:
- Process all active employees in batch
- Track success and failure with error messages
- Calculate and store totals (gross, deductions, net pay)
- Update advance and loan statuses after deduction
- Lock attendance records after processing
- Change pay run status to 'processed'
- Generate audit trail for payroll processing

---

#### 5.1.4 PayRun Approval Workflow

**Rule**: Multi-level approval workflow for payroll processing

**Approval Workflow**:
```javascript
async function submitPayRunForReview(payRunId, submittedBy) {
  const payRun = await db.query(`
    SELECT status FROM pay_runs WHERE id = ?
  `, [payRunId]);
  
  if (!payRun) {
    throw new Error('Pay run not found');
  }
  
  if (payRun.status !== 'processed') {
    throw new Error('Only processed pay runs can be submitted for review');
  }
  
  await db.query(`
    UPDATE pay_runs
    SET status = 'in_review',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [payRunId]);
  
  // Notify finance team
  await notifyFinanceTeam({
    type: 'payrun_review_required',
    payRunId,
    submittedBy
  });
  
  return { success: true, message: 'Pay run submitted for review' };
}

async function approvePayRun(payRunId, approvedBy, comments) {
  const payRun = await db.query(`
    SELECT * FROM pay_runs WHERE id = ?
  `, [payRunId]);
  
  if (!payRun) {
    throw new Error('Pay run not found');
  }
  
  if (payRun.status !== 'in_review') {
    throw new Error('Only pay runs in review can be approved');
  }
  
  // Verify approver has authorization (Finance Manager or above)
  const isAuthorized = await checkFinanceApprovalRole(approvedBy);
  if (!isAuthorized) {
    throw new Error('User not authorized to approve payroll');
  }
  
  await db.query(`
    UPDATE pay_runs
    SET status = 'approved',
        approved_by = ?,
        approval_date = CURRENT_TIMESTAMP,
        approval_comments = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [approvedBy, comments, payRunId]);
  
  // Notify HR team
  await notifyHRTeam({
    type: 'payrun_approved',
    payRunId,
    month: payRun.month,
    year: payRun.year,
    approvedBy
  });
  
  return { success: true, message: 'Pay run approved' };
}

async function rejectPayRun(payRunId, rejectedBy, reason) {
  await db.query(`
    UPDATE pay_runs
    SET status = 'draft',
        approval_comments = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [`Rejected: ${reason}`, payRunId]);
  
  return { success: true, message: 'Pay run rejected. Status reset to draft.' };
}
```

**Business Rules**:
- Approval flow: draft → processed → in_review → approved → paid
- Only Finance Manager or above can approve
- Approved pay runs cannot be edited
- Rejected pay runs return to draft status
- Track approval timestamp and comments
- Notify stakeholders at each stage

---

#### 5.1.5 Payslip Generation & Distribution

**Rule**: Auto-generate detailed payslips for all employees

**Payslip Generation**:
```javascript
async function generatePayslips(payRunId) {
  const payRun = await db.query(`
    SELECT * FROM pay_runs WHERE id = ?
  `, [payRunId]);
  
  if (!payRun) {
    throw new Error('Pay run not found');
  }
  
  if (payRun.status !== 'approved') {
    throw new Error('Only approved pay runs can generate payslips');
  }
  
  // Get all employee records
  const employeeRecords = await db.query(`
    SELECT * FROM pay_run_employee_records WHERE pay_run_id = ?
  `, [payRunId]);
  
  const payslips = [];
  
  for (const record of employeeRecords) {
    // Get additional employee details
    const employee = await db.query(`
      SELECT 
        e.*,
        d.name as department_name,
        des.title as designation_title
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN designations des ON e.designation_id = des.id
      WHERE e.employee_id = ?
    `, [record.employee_id]);
    
    // Create payslip record
    const payslipId = await db.query(`
      INSERT INTO payslips (
        employee_id, pay_run_employee_record_id,
        salary_month, salary_year, salary_date,
        period_start_date, period_end_date,
        department, designation, date_of_joining,
        total_working_days, present_days, leaves, absents,
        paid_leaves, unpaid_leaves, overtime_hours,
        basic_salary, hra, conveyance, medical, special_allowance,
        gross_salary, lop_deduction,
        pf, esi, professional_tax, tds,
        advance_deduction, loan_deduction,
        total_deductions, net_pay
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
      record.employee_id,
      record.id,
      payRun.month,
      payRun.year,
      payRun.payment_date || new Date(),
      payRun.payroll_period_start,
      payRun.payroll_period_end,
      employee.department_name,
      employee.designation_title,
      employee.join_date,
      record.total_working_days,
      record.payable_days - record.loss_of_pay_days,
      0, // Total leaves
      record.loss_of_pay_days,
      record.payable_days - record.loss_of_pay_days,
      record.loss_of_pay_days,
      0, // Overtime hours
      record.basic_salary,
      record.hra,
      record.conveyance,
      record.medical_allowance,
      record.special_allowance,
      record.gross_salary,
      record.loss_of_pay_amount,
      record.pf_deduction,
      record.esi_deduction,
      record.professional_tax,
      record.tds,
      record.advance_deduction,
      record.loan_deduction,
      record.total_deductions,
      record.net_pay
    ]);
    
    payslips.push({
      employee_id: record.employee_id,
      payslipId
    });
  }
  
  return {
    success: true,
    payslipsGenerated: payslips.length,
    payslips
  };
}

// Generate PDF payslip
async function generatePayslipPDF(payslipId) {
  const payslip = await db.query(`
    SELECT 
      p.*,
      e.first_name, e.last_name, e.employee_id, e.bank_account_number
    FROM payslips p
    JOIN employees e ON p.employee_id = e.employee_id
    WHERE p.id = ?
  `, [payslipId]);
  
  if (!payslip) {
    throw new Error('Payslip not found');
  }
  
  // Generate PDF using template
  const pdfBuffer = await generatePDFFromTemplate('payslip_template', {
    employeeName: `${payslip.first_name} ${payslip.last_name}`,
    employeeId: payslip.employee_id,
    department: payslip.department,
    designation: payslip.designation,
    month: payslip.salary_month,
    year: payslip.salary_year,
    workingDays: payslip.total_working_days,
    presentDays: payslip.present_days,
    // Earnings
    basicSalary: payslip.basic_salary,
    hra: payslip.hra,
    conveyance: payslip.conveyance,
    medical: payslip.medical,
    specialAllowance: payslip.special_allowance,
    grossSalary: payslip.gross_salary,
    // Deductions
    lopDeduction: payslip.lop_deduction,
    pf: payslip.pf,
    esi: payslip.esi,
    professionalTax: payslip.professional_tax,
    tds: payslip.tds,
    advanceDeduction: payslip.advance_deduction,
    loanDeduction: payslip.loan_deduction,
    totalDeductions: payslip.total_deductions,
    // Net pay
    netPay: payslip.net_pay,
    bankAccount: payslip.bank_account_number
  });
  
  return pdfBuffer;
}

// Email payslips to employees
async function emailPayslips(payRunId) {
  const payRun = await db.query(`
    SELECT month, year FROM pay_runs WHERE id = ?
  `, [payRunId]);
  
  const payslips = await db.query(`
    SELECT 
      p.id, p.employee_id,
      e.first_name, e.official_email
    FROM payslips p
    JOIN employees e ON p.employee_id = e.employee_id
    WHERE p.salary_month = ? AND p.salary_year = ?
  `, [payRun.month, payRun.year]);
  
  const results = {
    success: 0,
    failed: 0
  };
  
  for (const payslip of payslips) {
    try {
      const pdfBuffer = await generatePayslipPDF(payslip.id);
      
      await sendEmail({
        to: payslip.official_email,
        subject: `Payslip for ${payRun.month} ${payRun.year}`,
        body: `Dear ${payslip.first_name},\n\nPlease find attached your payslip for ${payRun.month} ${payRun.year}.\n\nBest regards,\nHR Team`,
        attachments: [{
          filename: `Payslip_${payslip.employee_id}_${payRun.month}_${payRun.year}.pdf`,
          content: pdfBuffer
        }]
      });
      
      results.success++;
    } catch (error) {
      console.error(`Failed to email payslip to ${payslip.employee_id}:`, error);
      results.failed++;
    }
  }
  
  return results;
}
```

**Business Rules**:
- Generate payslips only for approved pay runs
- Create one payslip per employee per month
- Include all earnings and deductions breakdown
- Generate PDF with company branding
- Email payslips to employee official email
- Store payslips for historical access
- Password-protect PDF (employee ID or DOB)

---

#### 5.1.6 Salary Payment Processing & Bank Integration

**Rule**: Process salary payments via bank integration or manual transfer

**Payment Processing**:
```javascript
async function markPayRunAsPaid(payRunId, paymentDate, paidBy) {
  const payRun = await db.query(`
    SELECT * FROM pay_runs WHERE id = ?
  `, [payRunId]);
  
  if (!payRun) {
    throw new Error('Pay run not found');
  }
  
  if (payRun.status !== 'approved') {
    throw new Error('Only approved pay runs can be marked as paid');
  }
  
  await db.query(`
    UPDATE pay_runs
    SET status = 'paid',
        payment_date = ?,
        is_locked = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [paymentDate, payRunId]);
  
  // Update employee salary payment history
  await db.query(`
    UPDATE pay_run_employee_records
    SET payment_status = 'paid',
        payment_date = ?
    WHERE pay_run_id = ?
  `, [paymentDate, payRunId]);
  
  return { success: true, message: 'Pay run marked as paid' };
}

// Generate bank payment file (NEFT/RTGS format)
async function generateBankPaymentFile(payRunId) {
  const payRunRecords = await db.query(`
    SELECT 
      per.employee_id,
      per.employee_name,
      per.net_pay,
      e.bank_account_number,
      e.bank_ifsc_code,
      e.bank_name,
      e.bank_branch
    FROM pay_run_employee_records per
    JOIN employees e ON per.employee_id = e.employee_id
    WHERE per.pay_run_id = ?
      AND per.net_pay > 0
  `, [payRunId]);
  
  // Generate NEFT file format (example)
  const neftFile = [];
  neftFile.push('EMP_ID,EMP_NAME,ACCOUNT_NUMBER,IFSC_CODE,AMOUNT,BANK_NAME');
  
  payRunRecords.forEach(record => {
    neftFile.push(
      `${record.employee_id},${record.employee_name},${record.bank_account_number},` +
      `${record.bank_ifsc_code},${record.net_pay},${record.bank_name}`
    );
  });
  
  return neftFile.join('\n');
}
```

**Business Rules**:
- Mark as paid only after successful bank transfer
- Lock pay run after payment (prevent edits)
- Generate bank payment file (NEFT/RTGS format)
- Track payment date and user
- Support payment reversals (with approval)
- Update employee payment history

---

#### 5.1.7 PayRun Analytics & Reports

**Rule**: Comprehensive payroll analytics for management insights

**Payroll Analytics**:
```javascript
async function getPayrollAnalytics(month, year) {
  const analytics = {};
  
  // 1. Overall summary
  const summary = await db.query(`
    SELECT 
      total_employees,
      total_gross,
      total_deductions,
      total_net_pay,
      status
    FROM pay_runs
    WHERE month = ? AND year = ?
  `, [month, year]);
  
  analytics.summary = summary;
  
  // 2. Department-wise breakdown
  const departmentBreakdown = await db.query(`
    SELECT 
      d.name as department,
      COUNT(per.employee_id) as employee_count,
      SUM(per.gross_salary) as total_gross,
      SUM(per.total_deductions) as total_deductions,
      SUM(per.net_pay) as total_net_pay,
      AVG(per.net_pay) as avg_net_pay
    FROM pay_run_employee_records per
    JOIN employees e ON per.employee_id = e.employee_id
    JOIN departments d ON e.department_id = d.id
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE pr.month = ? AND pr.year = ?
    GROUP BY d.name
    ORDER BY total_net_pay DESC
  `, [month, year]);
  
  analytics.departmentBreakdown = departmentBreakdown;
  
  // 3. Statutory deductions summary
  const statutoryDeductions = await db.query(`
    SELECT 
      SUM(pf_deduction) as total_pf_employee,
      SUM(esi_deduction) as total_esi_employee,
      SUM(professional_tax) as total_pt,
      SUM(tds) as total_tds
    FROM pay_run_employee_records per
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE pr.month = ? AND pr.year = ?
  `, [month, year]);
  
  analytics.statutoryDeductions = statutoryDeductions;
  
  // 4. Top earners
  const topEarners = await db.query(`
    SELECT 
      per.employee_name,
      per.gross_salary,
      per.net_pay,
      d.name as department
    FROM pay_run_employee_records per
    JOIN employees e ON per.employee_id = e.employee_id
    JOIN departments d ON e.department_id = d.id
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE pr.month = ? AND pr.year = ?
    ORDER BY per.net_pay DESC
    LIMIT 10
  `, [month, year]);
  
  analytics.topEarners = topEarners;
  
  // 5. Advance and loan recovery
  const recoveries = await db.query(`
    SELECT 
      SUM(advance_deduction) as total_advance_recovered,
      SUM(loan_deduction) as total_loan_recovered,
      SUM(loss_of_pay_amount) as total_lop_deducted
    FROM pay_run_employee_records per
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE pr.month = ? AND pr.year = ?
  `, [month, year]);
  
  analytics.recoveries = recoveries;
  
  return analytics;
}

// Year-to-date payroll summary
async function getYTDPayrollSummary(year) {
  const ytd = await db.query(`
    SELECT 
      month,
      total_employees,
      total_gross,
      total_deductions,
      total_net_pay
    FROM pay_runs
    WHERE year = ?
    ORDER BY 
      FIELD(month, 'January','February','March','April','May','June',
                   'July','August','September','October','November','December')
  `, [year]);
  
  return ytd;
}
```

**Business Rules**:
- Track payroll costs by department
- Monitor statutory compliance (PF, ESI, PT, TDS)
- Identify top earners for budget planning
- Track advance and loan recoveries
- Year-to-date payroll summaries
- Export reports for accounting system integration

---

#### 5.1.8 PayRun Validation & Compliance Checks

**Rule**: Validate payroll data for accuracy and compliance

**Validation**:
```javascript
async function validatePayRun(payRunId) {
  const validationErrors = [];
  
  // 1. Check if all active employees are included
  const missingEmployees = await db.query(`
    SELECT e.employee_id, e.first_name, e.last_name
    FROM employees e
    LEFT JOIN pay_run_employee_records per ON e.employee_id = per.employee_id
      AND per.pay_run_id = ?
    WHERE e.employment_status IN ('active', 'confirmed')
      AND per.employee_id IS NULL
  `, [payRunId]);
  
  if (missingEmployees.length > 0) {
    validationErrors.push({
      type: 'missing_employees',
      message: `${missingEmployees.length} active employees not included in pay run`,
      employees: missingEmployees
    });
  }
  
  // 2. Validate net pay calculations
  const calculationErrors = await db.query(`
    SELECT employee_id, employee_name
    FROM pay_run_employee_records
    WHERE pay_run_id = ?
      AND ABS(net_pay - (gross_salary - total_deductions)) > 0.01
  `, [payRunId]);
  
  if (calculationErrors.length > 0) {
    validationErrors.push({
      type: 'calculation_error',
      message: 'Net pay calculation mismatch',
      employees: calculationErrors
    });
  }
  
  // 3. Check for negative net pay
  const negativeNetPay = await db.query(`
    SELECT employee_id, employee_name, net_pay
    FROM pay_run_employee_records
    WHERE pay_run_id = ? AND net_pay < 0
  `, [payRunId]);
  
  if (negativeNetPay.length > 0) {
    validationErrors.push({
      type: 'negative_net_pay',
      message: 'Employees with negative net pay (excessive deductions)',
      employees: negativeNetPay
    });
  }
  
  // 4. Validate statutory deductions
  const statutoryErrors = await db.query(`
    SELECT employee_id, employee_name
    FROM pay_run_employee_records
    WHERE pay_run_id = ?
      AND (pf_deduction < 0 OR esi_deduction < 0 OR professional_tax < 0)
  `, [payRunId]);
  
  if (statutoryErrors.length > 0) {
    validationErrors.push({
      type: 'statutory_deduction_error',
      message: 'Invalid statutory deductions',
      employees: statutoryErrors
    });
  }
  
  // 5. Check bank details
  const missingBankDetails = await db.query(`
    SELECT per.employee_id, per.employee_name
    FROM pay_run_employee_records per
    JOIN employees e ON per.employee_id = e.employee_id
    WHERE per.pay_run_id = ?
      AND (e.bank_account_number IS NULL OR e.bank_ifsc_code IS NULL)
      AND per.net_pay > 0
  `, [payRunId]);
  
  if (missingBankDetails.length > 0) {
    validationErrors.push({
      type: 'missing_bank_details',
      message: 'Employees with missing bank account details',
      employees: missingBankDetails
    });
  }
  
  return {
    valid: validationErrors.length === 0,
    errors: validationErrors
  };
}
```

**Business Rules**:
- Validate all active employees included
- Verify net pay = gross - deductions
- Check for negative net pay (over-deduction)
- Validate statutory deduction calculations
- Ensure bank details present for payment
- Flag missing attendance records
- Run validation before approval

---

#### 5.1.9 PayRun Export & Statutory Reports

**Rule**: Generate compliance reports for statutory authorities

**Report Generation**:
```javascript
async function exportPayrollReport(payRunId, format = 'csv') {
  const payrollData = await db.query(`
    SELECT 
      per.employee_id,
      per.employee_name,
      d.name as department,
      des.title as designation,
      per.gross_salary,
      per.basic_salary,
      per.pf_deduction,
      per.esi_deduction,
      per.professional_tax,
      per.tds,
      per.total_deductions,
      per.net_pay
    FROM pay_run_employee_records per
    JOIN employees e ON per.employee_id = e.employee_id
    JOIN departments d ON e.department_id = d.id
    JOIN designations des ON e.designation_id = des.id
    WHERE per.pay_run_id = ?
    ORDER BY d.name, per.employee_name
  `, [payRunId]);
  
  if (format === 'csv') {
    return convertToCSV(payrollData);
  } else if (format === 'json') {
    return JSON.stringify(payrollData, null, 2);
  }
}

// PF Compliance Report (ECR format)
async function generatePFReport(month, year) {
  const pfData = await db.query(`
    SELECT 
      e.pf_number,
      per.employee_name,
      per.basic_salary,
      per.pf_deduction as employee_pf,
      per.pf_deduction as employer_pf,
      (per.pf_deduction * 2) as total_pf
    FROM pay_run_employee_records per
    JOIN employees e ON per.employee_id = e.employee_id
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE pr.month = ? AND pr.year = ?
      AND e.pf_number IS NOT NULL
    ORDER BY e.pf_number
  `, [month, year]);
  
  return pfData;
}

// ESI Compliance Report
async function generateESIReport(month, year) {
  const esiData = await db.query(`
    SELECT 
      e.esi_number,
      per.employee_name,
      per.gross_salary,
      per.esi_deduction as employee_esi,
      (per.esi_deduction * 4.33) as employer_esi,
      (per.esi_deduction * 5.33) as total_esi
    FROM pay_run_employee_records per
    JOIN employees e ON per.employee_id = e.employee_id
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE pr.month = ? AND pr.year = ?
      AND e.esi_number IS NOT NULL
    ORDER BY e.esi_number
  `, [month, year]);
  
  return esiData;
}

// Professional Tax Report
async function generatePTReport(month, year) {
  const ptData = await db.query(`
    SELECT 
      per.employee_id,
      per.employee_name,
      per.gross_salary,
      per.professional_tax
    FROM pay_run_employee_records per
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE pr.month = ? AND pr.year = ?
      AND per.professional_tax > 0
    ORDER BY per.employee_id
  `, [month, year]);
  
  return ptData;
}
```

**Business Rules**:
- Export payroll in CSV/JSON/Excel formats
- Generate PF ECR report for EPFO portal
- Generate ESI monthly return
- Generate PT challan for state authorities
- Form 16 generation for TDS compliance
- Annual wage register for labor department

---

#### 5.1.10 PayRun Revision & Correction

**Rule**: Support payroll corrections and revisions with audit trail

**Revision Handling**:
```javascript
async function createPayRunRevision(payRunId, revisionReason, revisedBy) {
  const payRun = await db.query(`
    SELECT * FROM pay_runs WHERE id = ?
  `, [payRunId]);
  
  if (!payRun) {
    throw new Error('Pay run not found');
  }
  
  if (payRun.is_locked) {
    throw new Error('Cannot revise locked pay run. Requires special approval.');
  }
  
  // Create revision record
  const revisionId = await db.query(`
    INSERT INTO pay_run_revisions (
      original_pay_run_id, revision_reason, revised_by, revision_date
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    RETURNING id
  `, [payRunId, revisionReason, revisedBy]);
  
  return {
    success: true,
    revisionId,
    message: 'Pay run revision created. Original data preserved.'
  };
}

// Correct individual employee salary
async function correctEmployeeSalary(payRunEmployeeRecordId, corrections, correctedBy) {
  const record = await db.query(`
    SELECT * FROM pay_run_employee_records WHERE id = ?
  `, [payRunEmployeeRecordId]);
  
  if (!record) {
    throw new Error('Pay run employee record not found');
  }
  
  // Store original values
  await db.query(`
    INSERT INTO pay_run_corrections (
      pay_run_employee_record_id, field_name, old_value, new_value,
      reason, corrected_by
    ) VALUES ?
  `, [corrections.map(c => [
    payRunEmployeeRecordId,
    c.field,
    record[c.field],
    c.newValue,
    c.reason,
    correctedBy
  ])]);
  
  // Apply corrections
  const updateFields = corrections.map(c => `${c.field} = ?`).join(', ');
  const updateValues = corrections.map(c => c.newValue);
  
  await db.query(`
    UPDATE pay_run_employee_records
    SET ${updateFields}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [...updateValues, payRunEmployeeRecordId]);
  
  // Recalculate totals
  await recalculatePayRunTotals(record.pay_run_id);
  
  return { success: true, message: 'Salary corrected successfully' };
}
```

**Business Rules**:
- Allow revisions only for draft/in_review status
- Locked pay runs require special approval
- Store original values before correction
- Track all corrections with reason and timestamp
- Recalculate pay run totals after correction
- Generate revised payslips if needed
- Notify employees of salary corrections

---

### 5.2 PayRunEmployeeRecord Management
**Rule**: Manage individual employee salary records within payroll runs with detailed earnings, deductions, and compliance tracking

**Purpose**: Store complete salary breakdown for each employee per month, maintain historical accuracy for audits, support individual salary corrections, enable detailed payslip generation, and provide granular financial reporting.

---

#### 5.2.1 Employee Record Structure & Creation

**Rule**: Create comprehensive employee salary records with complete breakdown

**PayRunEmployeeRecord Structure**:
```javascript
const PAYRUN_EMPLOYEE_RECORD_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  pay_run_id: 'VARCHAR(50) FOREIGN KEY NOT NULL',
  employee_id: 'VARCHAR(20) FOREIGN KEY NOT NULL',
  employee_name: 'VARCHAR(255) NOT NULL', // Denormalized
  department: 'VARCHAR(100)', // Denormalized for reporting
  designation: 'VARCHAR(255)', // Denormalized for reporting
  bank_account_number: 'VARCHAR(20)', // Denormalized for payment
  pan_number: 'VARCHAR(10)', // Denormalized for compliance
  
  // Attendance details
  total_working_days: 'INT NOT NULL',
  present_days: 'INT NOT NULL',
  payable_days: 'DECIMAL(5,2) NOT NULL', // Can be fractional (half days)
  loss_of_pay_days: 'INT NOT NULL',
  overtime_hours: 'DECIMAL(5,2) DEFAULT 0',
  
  // Earnings (pro-rated)
  basic_salary: 'DECIMAL(12,2) NOT NULL',
  hra: 'DECIMAL(12,2) NOT NULL',
  conveyance: 'DECIMAL(12,2) NOT NULL',
  telephone: 'DECIMAL(12,2) NOT NULL',
  medical_allowance: 'DECIMAL(12,2) NOT NULL',
  special_allowance: 'DECIMAL(12,2) NOT NULL',
  overtime_amount: 'DECIMAL(12,2) DEFAULT 0',
  bonus: 'DECIMAL(12,2) DEFAULT 0',
  incentives: 'DECIMAL(12,2) DEFAULT 0',
  arrears: 'DECIMAL(12,2) DEFAULT 0', // Previous month arrears
  total_allowances: 'DECIMAL(12,2) NOT NULL',
  gross_salary: 'DECIMAL(12,2) NOT NULL',
  
  // Deductions
  loss_of_pay_amount: 'DECIMAL(12,2) NOT NULL',
  advance_deduction: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
  loan_deduction: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
  pf_deduction: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
  esi_deduction: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
  professional_tax: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
  tds: 'DECIMAL(12,2) NOT NULL DEFAULT 0',
  other_deductions: 'DECIMAL(12,2) DEFAULT 0',
  total_deductions: 'DECIMAL(12,2) NOT NULL',
  
  // Employer contributions (for cost calculation)
  employer_pf: 'DECIMAL(12,2) DEFAULT 0',
  employer_esi: 'DECIMAL(12,2) DEFAULT 0',
  total_employer_cost: 'DECIMAL(12,2)',
  
  // Payment tracking
  net_pay: 'DECIMAL(12,2) NOT NULL',
  payment_status: 'ENUM', // 'pending', 'paid', 'failed', 'hold'
  payment_date: 'DATE',
  payment_reference: 'VARCHAR(100)', // Bank transaction reference
  payment_method: 'ENUM', // 'bank_transfer', 'cash', 'cheque'
  
  // Audit fields
  calculated_at: 'TIMESTAMP',
  verified_by: 'UUID FOREIGN KEY',
  verification_date: 'TIMESTAMP',
  is_revised: 'BOOLEAN DEFAULT false',
  revision_count: 'INT DEFAULT 0',
  notes: 'TEXT',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};
```

**SQL Trigger** (Auto-calculate totals):
```sql
CREATE OR REPLACE FUNCTION calculate_payrun_employee_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total allowances (excluding basic)
  NEW.total_allowances := NEW.hra + NEW.conveyance + NEW.telephone + 
                          NEW.medical_allowance + NEW.special_allowance;
  
  -- Calculate gross salary
  NEW.gross_salary := NEW.basic_salary + NEW.total_allowances + 
                      COALESCE(NEW.overtime_amount, 0) + COALESCE(NEW.bonus, 0) + 
                      COALESCE(NEW.incentives, 0) + COALESCE(NEW.arrears, 0);
  
  -- Calculate total deductions
  NEW.total_deductions := NEW.loss_of_pay_amount + COALESCE(NEW.advance_deduction, 0) + 
                          COALESCE(NEW.loan_deduction, 0) + COALESCE(NEW.pf_deduction, 0) + 
                          COALESCE(NEW.esi_deduction, 0) + COALESCE(NEW.professional_tax, 0) + 
                          COALESCE(NEW.tds, 0) + COALESCE(NEW.other_deductions, 0);
  
  -- Calculate net pay
  NEW.net_pay := NEW.gross_salary - NEW.total_deductions;
  
  -- Calculate employer cost
  NEW.total_employer_cost := NEW.gross_salary + COALESCE(NEW.employer_pf, 0) + 
                             COALESCE(NEW.employer_esi, 0);
  
  -- Validate net pay is not negative
  IF NEW.net_pay < 0 THEN
    RAISE WARNING 'Net pay is negative for employee %: ₹%', NEW.employee_id, NEW.net_pay;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_payrun_employee_totals
BEFORE INSERT OR UPDATE ON pay_run_employee_records
FOR EACH ROW
EXECUTE FUNCTION calculate_payrun_employee_totals();
```

**Business Rules**:
- One record per employee per pay run
- Auto-calculate total_allowances, gross_salary, total_deductions, net_pay
- Denormalize employee details for historical accuracy
- Track employer contributions (PF, ESI) for cost analysis
- Support fractional payable_days for half-day attendance
- Warn if net pay is negative (excessive deductions)

---

#### 5.2.2 Earnings & Deductions Calculation

**Rule**: Comprehensive salary calculation with all components

**Salary Components**:
```javascript
async function calculateEmployeeSalaryComponents(employeeId, month, year) {
  // Get employee master salary
  const employee = await db.query(`
    SELECT 
      salary_basic, salary_hra, salary_conveyance,
      salary_telephone, salary_medical, salary_special_allowance,
      pf_number, esi_number, pan_number
    FROM employees WHERE employee_id = ?
  `, [employeeId]);
  
  // Get attendance
  const attendance = await db.query(`
    SELECT total_working_days, payable_days, loss_of_pay_days, overtime_hours
    FROM attendance_records
    WHERE employee_id = ? AND month = ? AND year = ?
  `, [employeeId, month, year]);
  
  const workingDays = attendance?.total_working_days || 26;
  const payableDays = attendance?.payable_days || workingDays;
  const lopDays = attendance?.loss_of_pay_days || 0;
  
  // Pro-rate earnings
  const earnings = {
    basic_salary: (employee.salary_basic / workingDays) * payableDays,
    hra: (employee.salary_hra / workingDays) * payableDays,
    conveyance: (employee.salary_conveyance / workingDays) * payableDays,
    telephone: (employee.salary_telephone / workingDays) * payableDays,
    medical_allowance: (employee.salary_medical / workingDays) * payableDays,
    special_allowance: (employee.salary_special_allowance / workingDays) * payableDays,
    overtime_amount: 0,
    bonus: 0,
    incentives: 0,
    arrears: 0
  };
  
  // Overtime calculation
  if (attendance?.overtime_hours > 0) {
    const hourlyRate = (employee.salary_basic / workingDays / 9);
    earnings.overtime_amount = attendance.overtime_hours * hourlyRate * 2;
  }
  
  // Get bonus, incentives, arrears
  const additions = await db.query(`
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'bonus' THEN amount END), 0) as bonus,
      COALESCE(SUM(CASE WHEN type = 'incentive' THEN amount END), 0) as incentives,
      COALESCE(SUM(CASE WHEN type = 'arrears' THEN amount END), 0) as arrears
    FROM salary_additions
    WHERE employee_id = ? AND payment_month = ? AND payment_year = ? AND status = 'approved'
  `, [employeeId, month, year]);
  
  earnings.bonus = additions?.bonus || 0;
  earnings.incentives = additions?.incentives || 0;
  earnings.arrears = additions?.arrears || 0;
  
  earnings.total_allowances = earnings.hra + earnings.conveyance + earnings.telephone +
                              earnings.medical_allowance + earnings.special_allowance;
  earnings.gross_salary = earnings.basic_salary + earnings.total_allowances + 
                          earnings.overtime_amount + earnings.bonus + 
                          earnings.incentives + earnings.arrears;
  
  // Calculate deductions
  const deductions = {
    loss_of_pay_amount: (earnings.gross_salary / workingDays) * lopDays,
    advance_deduction: 0,
    loan_deduction: 0,
    pf_deduction: 0,
    esi_deduction: 0,
    professional_tax: 0,
    tds: 0,
    other_deductions: 0
  };
  
  // Advance
  const advance = await db.query(`
    SELECT SUM(advance_paid_amount) as total FROM advance_records
    WHERE employee_id = ? AND advance_deduction_month = ? 
      AND advance_deduction_year = ? AND status = 'pending'
  `, [employeeId, month, year]);
  deductions.advance_deduction = advance?.total || 0;
  
  // Loan EMI
  const loan = await db.query(`
    SELECT SUM(emi_amount) as total FROM loan_emis
    WHERE loan_id IN (SELECT id FROM loan_records WHERE employee_id = ? AND status = 'active')
      AND month = ? AND year = ? AND status = 'pending'
  `, [employeeId, month, year]);
  deductions.loan_deduction = loan?.total || 0;
  
  // PF (12% on basic, max ₹15,000)
  if (employee.pf_number) {
    deductions.pf_deduction = Math.min(earnings.basic_salary, 15000) * 0.12;
  }
  
  // ESI (0.75% on gross, if gross ≤ ₹21,000)
  if (employee.esi_number && earnings.gross_salary <= 21000) {
    deductions.esi_deduction = earnings.gross_salary * 0.0075;
  }
  
  // Professional Tax
  if (earnings.gross_salary <= 7500) deductions.professional_tax = 0;
  else if (earnings.gross_salary <= 10000) deductions.professional_tax = 175;
  else deductions.professional_tax = 200;
  
  // TDS (simplified)
  if (employee.pan_number) {
    deductions.tds = await calculateTDS(employeeId, earnings.gross_salary, year);
  }
  
  deductions.total_deductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);
  
  // Net pay
  const net_pay = earnings.gross_salary - deductions.total_deductions;
  
  // Employer contributions
  const employer_pf = deductions.pf_deduction;
  const employer_esi = deductions.esi_deduction * 4.33;
  
  return {
    ...earnings,
    ...deductions,
    net_pay,
    employer_pf,
    employer_esi,
    total_working_days: workingDays,
    payable_days,
    loss_of_pay_days: lopDays,
    overtime_hours: attendance?.overtime_hours || 0
  };
}
```

**Business Rules**:
- Pro-rate: (Component / Working Days) × Payable Days
- LOP: (Gross / Working Days) × LOP Days
- Overtime: (Basic / Working Days / 9) × Hours × 2
- PF: 12% on basic (max ₹15,000)
- ESI: 0.75% on gross (if ≤ ₹21,000)
- PT: Slab-based (₹0, ₹175, ₹200)
- TDS: Annual projection method
- Net Pay = Gross - Total Deductions

---

#### 5.2.3 Record Validation & Verification

**Rule**: Validate calculations and data integrity

**Validation**:
```javascript
async function validateEmployeeRecord(recordId) {
  const record = await db.query(`
    SELECT * FROM pay_run_employee_records WHERE id = ?
  `, [recordId]);
  
  const errors = [];
  
  // 1. Validate totals
  const expectedAllowances = record.hra + record.conveyance + record.telephone +
                            record.medical_allowance + record.special_allowance;
  if (Math.abs(record.total_allowances - expectedAllowances) > 0.01) {
    errors.push('Total allowances mismatch');
  }
  
  const expectedGross = record.basic_salary + record.total_allowances + 
                       (record.overtime_amount || 0) + (record.bonus || 0) + 
                       (record.incentives || 0) + (record.arrears || 0);
  if (Math.abs(record.gross_salary - expectedGross) > 0.01) {
    errors.push('Gross salary mismatch');
  }
  
  const expectedDeductions = record.loss_of_pay_amount + (record.advance_deduction || 0) +
                            (record.loan_deduction || 0) + (record.pf_deduction || 0) + 
                            (record.esi_deduction || 0) + (record.professional_tax || 0) + 
                            (record.tds || 0) + (record.other_deductions || 0);
  if (Math.abs(record.total_deductions - expectedDeductions) > 0.01) {
    errors.push('Total deductions mismatch');
  }
  
  const expectedNetPay = record.gross_salary - record.total_deductions;
  if (Math.abs(record.net_pay - expectedNetPay) > 0.01) {
    errors.push('Net pay mismatch');
  }
  
  // 2. Validate attendance
  if (record.payable_days > record.total_working_days) {
    errors.push('Payable days exceed working days');
  }
  
  // 3. Negative checks
  if (record.net_pay < 0) {
    errors.push('Net pay is negative');
  }
  
  return { valid: errors.length === 0, errors };
}
```

**Business Rules**:
- Validate all computed totals
- Check payable days ≤ working days
- Flag negative net pay
- Tolerance: ±₹0.01 for rounding
- Require verification before payment

---

#### 5.2.4 Payment Tracking & Status

**Rule**: Track payment lifecycle

**Payment Management**:
```javascript
async function markRecordAsPaid(recordId, paymentDetails) {
  await db.query(`
    UPDATE pay_run_employee_records
    SET payment_status = 'paid',
        payment_date = ?,
        payment_reference = ?,
        payment_method = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    paymentDetails.payment_date,
    paymentDetails.payment_reference,
    paymentDetails.payment_method || 'bank_transfer',
    recordId
  ]);
  
  return { success: true };
}

async function getPaymentSummary(payRunId) {
  return await db.query(`
    SELECT 
      payment_status,
      COUNT(*) as count,
      SUM(net_pay) as total_amount
    FROM pay_run_employee_records
    WHERE pay_run_id = ?
    GROUP BY payment_status
  `, [payRunId]);
}
```

**Business Rules**:
- Status: pending → paid/failed/hold
- Store payment reference for reconciliation
- Track payment method (bank/cash/cheque)
- Cannot pay twice (idempotent)
- Notify employees on successful payment

---

#### 5.2.5 Record Comparison & Trends

**Rule**: Month-over-month salary analysis

**Comparison**:
```javascript
async function compareEmployeeSalary(employeeId) {
  const last6Months = await db.query(`
    SELECT 
      pr.month, pr.year,
      per.gross_salary, per.net_pay, per.total_deductions,
      per.payable_days, per.loss_of_pay_days
    FROM pay_run_employee_records per
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE per.employee_id = ?
    ORDER BY pr.year DESC, FIELD(pr.month, 'December','November','October',
      'September','August','July','June','May','April','March','February','January')
    LIMIT 6
  `, [employeeId]);
  
  return {
    trend: last6Months,
    avg_net_pay: last6Months.reduce((sum, m) => sum + m.net_pay, 0) / last6Months.length
  };
}
```

**Business Rules**:
- Compare salary month-over-month
- Track 6-month historical trend
- Alert on sudden changes (>20%)
- Calculate average net pay

---

#### 5.2.6 Record Corrections & Revisions

**Rule**: Support salary corrections with audit trail

**Corrections**:
```javascript
async function correctEmployeeRecord(recordId, corrections, correctedBy, reason) {
  const record = await db.query(`
    SELECT * FROM pay_run_employee_records WHERE id = ?
  `, [recordId]);
  
  // Store correction history
  await db.query(`
    INSERT INTO pay_run_record_corrections (
      pay_run_employee_record_id, field_name, old_value, new_value,
      correction_reason, corrected_by
    ) VALUES ?
  `, [corrections.map(c => [
    recordId, c.field, record[c.field], c.newValue, reason, correctedBy
  ])]);
  
  // Apply corrections
  const updates = corrections.map(c => `${c.field} = ?`).join(', ');
  await db.query(`
    UPDATE pay_run_employee_records
    SET ${updates}, is_revised = true, revision_count = revision_count + 1
    WHERE id = ?
  `, [...corrections.map(c => c.newValue), recordId]);
  
  return { success: true };
}
```

**Business Rules**:
- Allow corrections before payment
- Store all original values
- Track correction reason and user
- Increment revision counter
- Cannot correct paid records without approval

---

#### 5.2.7 Export & Reporting

**Rule**: Export employee records for analysis

**Export**:
```javascript
async function exportEmployeeRecords(payRunId, format = 'csv') {
  const records = await db.query(`
    SELECT 
      employee_id, employee_name, department, designation,
      total_working_days, payable_days, loss_of_pay_days,
      basic_salary, hra, gross_salary,
      pf_deduction, esi_deduction, professional_tax, tds,
      total_deductions, net_pay, payment_status
    FROM pay_run_employee_records
    WHERE pay_run_id = ?
    ORDER BY department, employee_name
  `, [payRunId]);
  
  if (format === 'csv') return convertToCSV(records);
  if (format === 'json') return JSON.stringify(records, null, 2);
  return records;
}

// Department-wise report
async function getDepartmentSalaryReport(payRunId) {
  return await db.query(`
    SELECT 
      department,
      COUNT(*) as employee_count,
      SUM(gross_salary) as total_gross,
      AVG(net_pay) as avg_net_pay,
      SUM(employer_pf + employer_esi) as total_employer_cost
    FROM pay_run_employee_records
    WHERE pay_run_id = ?
    GROUP BY department
  `, [payRunId]);
}
```

**Business Rules**:
- Export in CSV/JSON/Excel formats
- Department-wise salary summaries
- Include employer cost analysis
- Generate bank payment files (NEFT)
- Mask sensitive data by permissions

---

### 5.3 Payslip Management
**Rule**: Generate, distribute, and manage monthly payslips for employees with complete salary breakdown and compliance details

**Purpose**: Provide employees with detailed salary statements, maintain statutory compliance for payslip format, support PDF generation and email delivery, enable employee self-service access, track distribution status, and maintain historical payslip archives.

---

#### 5.3.1 Payslip Structure & Generation

**Rule**: Generate comprehensive payslips with all statutory details

**Payslip Schema**:
```javascript
const PAYSLIP_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  payslip_number: 'VARCHAR(50) UNIQUE NOT NULL', // Format: PS/YYYY/MM/EMPID
  pay_run_id: 'VARCHAR(50) FOREIGN KEY NOT NULL',
  pay_run_employee_record_id: 'UUID FOREIGN KEY NOT NULL',
  employee_id: 'VARCHAR(20) FOREIGN KEY NOT NULL',
  
  // Employee details (denormalized)
  employee_name: 'VARCHAR(255) NOT NULL',
  department: 'VARCHAR(100)',
  designation: 'VARCHAR(255)',
  date_of_joining: 'DATE',
  pan_number: 'VARCHAR(10)',
  uan_number: 'VARCHAR(12)', // Universal Account Number (PF)
  esi_number: 'VARCHAR(17)',
  bank_name: 'VARCHAR(100)',
  bank_account_number: 'VARCHAR(20)',
  
  // Pay period
  month: 'ENUM NOT NULL', // 'January' to 'December'
  year: 'INT NOT NULL',
  pay_period_start: 'DATE NOT NULL',
  pay_period_end: 'DATE NOT NULL',
  payment_date: 'DATE',
  
  // Attendance
  total_working_days: 'INT NOT NULL',
  payable_days: 'DECIMAL(5,2) NOT NULL',
  loss_of_pay_days: 'INT NOT NULL',
  overtime_hours: 'DECIMAL(5,2)',
  
  // Earnings breakdown (JSON for flexibility)
  earnings: 'JSONB NOT NULL', // { basic, hra, conveyance, telephone, medical, special, overtime, bonus, incentives, arrears }
  gross_salary: 'DECIMAL(12,2) NOT NULL',
  
  // Deductions breakdown (JSON)
  deductions: 'JSONB NOT NULL', // { lop, advance, loan, pf, esi, pt, tds, other }
  total_deductions: 'DECIMAL(12,2) NOT NULL',
  
  // Net pay
  net_pay: 'DECIMAL(12,2) NOT NULL',
  net_pay_in_words: 'TEXT', // "Rupees Fifty Thousand Only"
  
  // Employer contributions (for employee reference)
  employer_pf: 'DECIMAL(12,2)',
  employer_esi: 'DECIMAL(12,2)',
  
  // Year-to-date summary
  ytd_gross: 'DECIMAL(12,2)', // Year-to-date gross
  ytd_deductions: 'DECIMAL(12,2)',
  ytd_net_pay: 'DECIMAL(12,2)',
  ytd_pf: 'DECIMAL(12,2)',
  ytd_tds: 'DECIMAL(12,2)',
  
  // PDF generation
  pdf_generated: 'BOOLEAN DEFAULT false',
  pdf_path: 'TEXT', // S3 or local file path
  pdf_generated_at: 'TIMESTAMP',
  
  // Distribution
  email_sent: 'BOOLEAN DEFAULT false',
  email_sent_at: 'TIMESTAMP',
  email_sent_to: 'VARCHAR(255)',
  download_count: 'INT DEFAULT 0',
  first_downloaded_at: 'TIMESTAMP',
  last_downloaded_at: 'TIMESTAMP',
  
  // Status
  status: 'ENUM NOT NULL', // 'draft', 'generated', 'sent', 'downloaded'
  is_revised: 'BOOLEAN DEFAULT false',
  revision_number: 'INT DEFAULT 0',
  revision_reason: 'TEXT',
  
  // Audit
  generated_by: 'UUID FOREIGN KEY',
  notes: 'TEXT',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};
```

**Payslip Generation**:
```javascript
async function generatePayslip(payRunEmployeeRecordId) {
  // Get employee record
  const record = await db.query(`
    SELECT per.*, pr.month, pr.year, pr.pay_period_start, pr.pay_period_end,
           e.employee_name, e.department, e.designation, e.date_of_joining,
           e.pan_number, e.uan_number, e.esi_number,
           e.bank_name, e.bank_account_number
    FROM pay_run_employee_records per
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    JOIN employees e ON per.employee_id = e.employee_id
    WHERE per.id = ?
  `, [payRunEmployeeRecordId]);
  
  // Calculate YTD (year-to-date)
  const ytd = await db.query(`
    SELECT 
      SUM(gross_salary) as ytd_gross,
      SUM(total_deductions) as ytd_deductions,
      SUM(net_pay) as ytd_net_pay,
      SUM(pf_deduction) as ytd_pf,
      SUM(tds) as ytd_tds
    FROM pay_run_employee_records per
    JOIN pay_runs pr ON per.pay_run_id = pr.id
    WHERE per.employee_id = ? AND pr.year = ? 
      AND pr.status = 'locked'
      AND FIELD(pr.month, 'January','February','March','April','May','June',
        'July','August','September','October','November','December') 
        <= FIELD(?, 'January','February','March','April','May','June',
        'July','August','September','October','November','December')
  `, [record.employee_id, record.year, record.month]);
  
  // Build earnings JSON
  const earnings = {
    basic_salary: record.basic_salary,
    hra: record.hra,
    conveyance: record.conveyance,
    telephone: record.telephone,
    medical_allowance: record.medical_allowance,
    special_allowance: record.special_allowance,
    overtime_amount: record.overtime_amount || 0,
    bonus: record.bonus || 0,
    incentives: record.incentives || 0,
    arrears: record.arrears || 0
  };
  
  // Build deductions JSON
  const deductions = {
    loss_of_pay: record.loss_of_pay_amount,
    advance: record.advance_deduction || 0,
    loan: record.loan_deduction || 0,
    provident_fund: record.pf_deduction || 0,
    esi: record.esi_deduction || 0,
    professional_tax: record.professional_tax || 0,
    tds: record.tds || 0,
    other: record.other_deductions || 0
  };
  
  // Generate payslip number
  const payslipNumber = `PS/${record.year}/${String(getMonthNumber(record.month)).padStart(2, '0')}/${record.employee_id}`;
  
  // Create payslip
  const payslipId = await db.query(`
    INSERT INTO payslips (
      payslip_number, pay_run_id, pay_run_employee_record_id, employee_id,
      employee_name, department, designation, date_of_joining,
      pan_number, uan_number, esi_number, bank_name, bank_account_number,
      month, year, pay_period_start, pay_period_end, payment_date,
      total_working_days, payable_days, loss_of_pay_days, overtime_hours,
      earnings, gross_salary, deductions, total_deductions, net_pay, net_pay_in_words,
      employer_pf, employer_esi,
      ytd_gross, ytd_deductions, ytd_net_pay, ytd_pf, ytd_tds,
      status, generated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    payslipNumber, record.pay_run_id, payRunEmployeeRecordId, record.employee_id,
    record.employee_name, record.department, record.designation, record.date_of_joining,
    record.pan_number, record.uan_number, record.esi_number, record.bank_name, record.bank_account_number,
    record.month, record.year, record.pay_period_start, record.pay_period_end, record.payment_date,
    record.total_working_days, record.payable_days, record.loss_of_pay_days, record.overtime_hours,
    JSON.stringify(earnings), record.gross_salary, 
    JSON.stringify(deductions), record.total_deductions, 
    record.net_pay, convertAmountToWords(record.net_pay),
    record.employer_pf, record.employer_esi,
    ytd.ytd_gross, ytd.ytd_deductions, ytd.ytd_net_pay, ytd.ytd_pf, ytd.ytd_tds,
    'draft', getCurrentUserId()
  ]);
  
  return { payslipId, payslipNumber };
}

// Bulk generate for entire pay run
async function generatePayslipsForPayRun(payRunId) {
  const records = await db.query(`
    SELECT id FROM pay_run_employee_records
    WHERE pay_run_id = ? AND payment_status IN ('paid', 'pending')
  `, [payRunId]);
  
  const results = [];
  for (const record of records) {
    try {
      const result = await generatePayslip(record.id);
      results.push({ success: true, ...result });
    } catch (error) {
      results.push({ success: false, recordId: record.id, error: error.message });
    }
  }
  
  return results;
}
```

**Business Rules**:
- One payslip per employee per month
- Payslip number format: PS/YYYY/MM/EMPID
- Denormalize employee details for historical accuracy
- Calculate YTD totals (current financial year)
- Store earnings and deductions as JSON for flexibility
- Generate net pay in words
- Auto-generate when pay run is locked
- Track PDF generation and email distribution

---

#### 5.3.2 PDF Generation & Formatting

**Rule**: Generate professional PDF payslips with company branding

**PDF Template**:
```javascript
async function generatePayslipPDF(payslipId) {
  const payslip = await db.query(`
    SELECT * FROM payslips WHERE id = ?
  `, [payslipId]);
  
  const company = await getCompanyDetails();
  
  const pdfContent = {
    header: {
      company_logo: company.logo_base64,
      company_name: company.name,
      company_address: company.address,
      document_title: 'SALARY SLIP',
      month_year: `${payslip.month} ${payslip.year}`
    },
    employee: {
      name: payslip.employee_name,
      employee_id: payslip.employee_id,
      department: payslip.department,
      designation: payslip.designation,
      date_of_joining: formatDate(payslip.date_of_joining),
      pan: payslip.pan_number,
      uan: payslip.uan_number,
      bank: `${payslip.bank_name} - ${maskAccount(payslip.bank_account_number)}`
    },
    attendance: {
      pay_period: `${formatDate(payslip.pay_period_start)} to ${formatDate(payslip.pay_period_end)}`,
      working_days: payslip.total_working_days,
      payable_days: payslip.payable_days,
      lop_days: payslip.loss_of_pay_days,
      overtime_hours: payslip.overtime_hours || 0
    },
    earnings: JSON.parse(payslip.earnings),
    deductions: JSON.parse(payslip.deductions),
    summary: {
      gross_salary: payslip.gross_salary,
      total_deductions: payslip.total_deductions,
      net_pay: payslip.net_pay,
      net_pay_in_words: payslip.net_pay_in_words
    },
    employer_contribution: {
      pf: payslip.employer_pf,
      esi: payslip.employer_esi
    },
    ytd: {
      gross: payslip.ytd_gross,
      deductions: payslip.ytd_deductions,
      net_pay: payslip.ytd_net_pay,
      pf: payslip.ytd_pf,
      tds: payslip.ytd_tds
    },
    footer: {
      payment_date: formatDate(payslip.payment_date),
      generated_date: new Date().toISOString(),
      note: 'This is a system-generated payslip and does not require a signature.'
    }
  };
  
  // Generate PDF using library (e.g., pdfkit, puppeteer)
  const pdfBuffer = await createPDFFromTemplate(pdfContent);
  
  // Save to storage
  const pdfPath = await savePDFToStorage(pdfBuffer, `payslips/${payslip.year}/${payslip.month}/${payslip.payslip_number}.pdf`);
  
  // Update payslip
  await db.query(`
    UPDATE payslips
    SET pdf_generated = true,
        pdf_path = ?,
        pdf_generated_at = CURRENT_TIMESTAMP,
        status = 'generated'
    WHERE id = ?
  `, [pdfPath, payslipId]);
  
  return { pdfPath, pdfBuffer };
}

// Bulk PDF generation
async function generatePayslipPDFsForPayRun(payRunId) {
  const payslips = await db.query(`
    SELECT id FROM payslips
    WHERE pay_run_id = ? AND pdf_generated = false
  `, [payRunId]);
  
  const results = await Promise.allSettled(
    payslips.map(p => generatePayslipPDF(p.id))
  );
  
  return results;
}
```

**Business Rules**:
- Include company logo and details
- Earnings and deductions in two-column format
- Show attendance summary
- Display YTD totals
- Include employer contributions (PF, ESI)
- Net pay in words
- Payment date and generation timestamp
- Watermark for revised payslips
- Password-protect PDF (optional)

---

#### 5.3.3 Email Distribution & Delivery

**Rule**: Send payslips to employees via email with secure access

**Email Distribution**:
```javascript
async function sendPayslipEmail(payslipId) {
  const payslip = await db.query(`
    SELECT p.*, e.email, e.employee_name
    FROM payslips p
    JOIN employees e ON p.employee_id = e.employee_id
    WHERE p.id = ?
  `, [payslipId]);
  
  if (!payslip.pdf_generated) {
    await generatePayslipPDF(payslipId);
  }
  
  // Get PDF from storage
  const pdfBuffer = await getPDFFromStorage(payslip.pdf_path);
  
  // Email content
  const emailData = {
    to: payslip.email,
    subject: `Payslip for ${payslip.month} ${payslip.year} - ${payslip.employee_name}`,
    html: `
      <p>Dear ${payslip.employee_name},</p>
      <p>Your salary for <strong>${payslip.month} ${payslip.year}</strong> has been processed.</p>
      <p><strong>Net Pay: ₹${payslip.net_pay.toLocaleString('en-IN')}</strong></p>
      <p>Please find your payslip attached.</p>
      <p>You can also download your payslip from the employee portal: 
         <a href="${getEmployeePortalURL()}/payslips">View Payslips</a>
      </p>
      <p>Regards,<br/>HR Team</p>
    `,
    attachments: [{
      filename: `Payslip_${payslip.month}_${payslip.year}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  };
  
  // Send email
  await sendEmail(emailData);
  
  // Update payslip
  await db.query(`
    UPDATE payslips
    SET email_sent = true,
        email_sent_at = CURRENT_TIMESTAMP,
        email_sent_to = ?,
        status = 'sent'
    WHERE id = ?
  `, [payslip.email, payslipId]);
  
  return { success: true, email: payslip.email };
}

// Bulk email distribution
async function sendPayslipsForPayRun(payRunId) {
  const payslips = await db.query(`
    SELECT id FROM payslips
    WHERE pay_run_id = ? AND email_sent = false AND pdf_generated = true
  `, [payRunId]);
  
  const results = [];
  for (const payslip of payslips) {
    try {
      await sendPayslipEmail(payslip.id);
      results.push({ success: true, payslipId: payslip.id });
      await sleep(100); // Rate limiting
    } catch (error) {
      results.push({ success: false, payslipId: payslip.id, error: error.message });
    }
  }
  
  return results;
}
```

**Business Rules**:
- Send to employee's registered email
- Attach PDF payslip
- Include net pay in email body
- Provide portal link for re-download
- Rate limit: 10 emails/second
- Log email delivery status
- Retry failed emails (max 3 attempts)
- Update status to 'sent' on success

---

#### 5.3.4 Employee Self-Service Access

**Rule**: Enable employees to view and download their payslips

**Portal Access**:
```javascript
async function getEmployeePayslips(employeeId, filters = {}) {
  let query = `
    SELECT 
      id, payslip_number, month, year,
      gross_salary, total_deductions, net_pay,
      payment_date, status, pdf_generated,
      is_revised, revision_number,
      created_at
    FROM payslips
    WHERE employee_id = ?
  `;
  
  const params = [employeeId];
  
  if (filters.year) {
    query += ` AND year = ?`;
    params.push(filters.year);
  }
  
  if (filters.month) {
    query += ` AND month = ?`;
    params.push(filters.month);
  }
  
  query += ` ORDER BY year DESC, FIELD(month, 'December','November','October',
    'September','August','July','June','May','April','March','February','January')`;
  
  return await db.query(query, params);
}

async function downloadPayslip(payslipId, employeeId) {
  const payslip = await db.query(`
    SELECT * FROM payslips
    WHERE id = ? AND employee_id = ?
  `, [payslipId, employeeId]);
  
  if (!payslip) {
    throw new Error('Payslip not found or access denied');
  }
  
  if (!payslip.pdf_generated) {
    throw new Error('Payslip PDF not yet generated');
  }
  
  // Get PDF from storage
  const pdfBuffer = await getPDFFromStorage(payslip.pdf_path);
  
  // Update download tracking
  await db.query(`
    UPDATE payslips
    SET download_count = download_count + 1,
        first_downloaded_at = COALESCE(first_downloaded_at, CURRENT_TIMESTAMP),
        last_downloaded_at = CURRENT_TIMESTAMP,
        status = 'downloaded'
    WHERE id = ?
  `, [payslipId]);
  
  return {
    filename: `Payslip_${payslip.month}_${payslip.year}.pdf`,
    buffer: pdfBuffer,
    contentType: 'application/pdf'
  };
}

async function getPayslipSummary(employeeId, year) {
  return await db.query(`
    SELECT 
      month,
      gross_salary,
      total_deductions,
      net_pay,
      ytd_pf,
      ytd_tds
    FROM payslips
    WHERE employee_id = ? AND year = ?
    ORDER BY FIELD(month, 'January','February','March','April','May','June',
      'July','August','September','October','November','December')
  `, [employeeId, year]);
}
```

**Business Rules**:
- Employees can view only their own payslips
- Show payslip list with filters (year, month)
- Allow PDF download unlimited times
- Track download count and timestamps
- Display YTD summary
- Show revision history
- Enable search by month/year
- Highlight revised payslips

---

#### 5.3.5 Payslip Revision & Reissue

**Rule**: Support payslip corrections with proper versioning

**Revision Management**:
```javascript
async function revisePayslip(payslipId, correctedRecordId, reason, revisedBy) {
  const originalPayslip = await db.query(`
    SELECT * FROM payslips WHERE id = ?
  `, [payslipId]);
  
  // Archive original payslip
  await db.query(`
    INSERT INTO payslip_revisions (
      original_payslip_id, payslip_number, revision_number,
      employee_id, month, year,
      earnings, deductions, gross_salary, total_deductions, net_pay,
      revision_reason, revised_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    payslipId, originalPayslip.payslip_number, originalPayslip.revision_number,
    originalPayslip.employee_id, originalPayslip.month, originalPayslip.year,
    originalPayslip.earnings, originalPayslip.deductions,
    originalPayslip.gross_salary, originalPayslip.total_deductions, originalPayslip.net_pay,
    reason, revisedBy
  ]);
  
  // Generate new payslip from corrected record
  const newPayslip = await generatePayslip(correctedRecordId);
  
  // Mark as revised
  await db.query(`
    UPDATE payslips
    SET is_revised = true,
        revision_number = ?,
        revision_reason = ?,
        pdf_generated = false
    WHERE id = ?
  `, [originalPayslip.revision_number + 1, reason, newPayslip.payslipId]);
  
  // Regenerate PDF with "REVISED" watermark
  await generatePayslipPDF(newPayslip.payslipId);
  
  // Resend email
  await sendPayslipEmail(newPayslip.payslipId);
  
  return { success: true, newPayslipId: newPayslip.payslipId };
}

async function getPayslipRevisionHistory(payslipId) {
  return await db.query(`
    SELECT * FROM payslip_revisions
    WHERE original_payslip_id = ?
    ORDER BY revision_number DESC
  `, [payslipId]);
}
```

**Business Rules**:
- Archive original payslip before revision
- Increment revision number
- Add "REVISED" watermark on PDF
- Store revision reason and approver
- Resend email to employee
- Maintain complete revision history
- Cannot revise payslips older than 3 months (configurable)
- Require manager approval for revisions

---

#### 5.3.6 Payslip Analytics & Reports

**Rule**: Generate insights from payslip data

**Analytics**:
```javascript
async function getPayslipDistributionStatus(payRunId) {
  return await db.query(`
    SELECT 
      COUNT(*) as total_payslips,
      SUM(CASE WHEN pdf_generated THEN 1 ELSE 0 END) as pdf_generated_count,
      SUM(CASE WHEN email_sent THEN 1 ELSE 0 END) as email_sent_count,
      SUM(CASE WHEN download_count > 0 THEN 1 ELSE 0 END) as downloaded_count,
      SUM(CASE WHEN is_revised THEN 1 ELSE 0 END) as revised_count,
      AVG(download_count) as avg_downloads
    FROM payslips
    WHERE pay_run_id = ?
  `, [payRunId]);
}

async function getUndownloadedPayslips(payRunId) {
  return await db.query(`
    SELECT 
      payslip_number, employee_id, employee_name,
      month, year, email_sent_at
    FROM payslips
    WHERE pay_run_id = ? AND download_count = 0 AND email_sent = true
    ORDER BY employee_name
  `, [payRunId]);
}

async function getEmployeeAnnualPayslipSummary(employeeId, year) {
  const payslips = await db.query(`
    SELECT 
      month, gross_salary, total_deductions, net_pay,
      earnings, deductions
    FROM payslips
    WHERE employee_id = ? AND year = ?
    ORDER BY FIELD(month, 'January','February','March','April','May','June',
      'July','August','September','October','November','December')
  `, [employeeId, year]);
  
  // Calculate annual totals
  const annual = {
    total_gross: payslips.reduce((sum, p) => sum + p.gross_salary, 0),
    total_deductions: payslips.reduce((sum, p) => sum + p.total_deductions, 0),
    total_net_pay: payslips.reduce((sum, p) => sum + p.net_pay, 0),
    total_pf: payslips.reduce((sum, p) => {
      const deductions = JSON.parse(p.deductions);
      return sum + (deductions.provident_fund || 0);
    }, 0),
    total_tds: payslips.reduce((sum, p) => {
      const deductions = JSON.parse(p.deductions);
      return sum + (deductions.tds || 0);
    }, 0),
    months_paid: payslips.length
  };
  
  return { payslips, annual };
}
```

**Business Rules**:
- Track distribution completion rate
- Identify employees who haven't downloaded
- Send reminders for undownloaded payslips
- Generate annual salary summary (Form 16 preparation)
- Track average download count per payslip
- Monitor revision frequency
- Alert on high revision rates (>10%)

---

#### 5.3.7 Bulk Operations & Automation

**Rule**: Automate payslip generation and distribution workflows

**Automation**:
```javascript
async function processPayslipsForPayRun(payRunId) {
  console.log(`[Payslip] Starting bulk processing for pay run: ${payRunId}`);
  
  // Step 1: Generate payslips
  console.log('[Payslip] Step 1: Generating payslips...');
  const generated = await generatePayslipsForPayRun(payRunId);
  const successCount = generated.filter(r => r.success).length;
  console.log(`[Payslip] Generated ${successCount}/${generated.length} payslips`);
  
  // Step 2: Generate PDFs
  console.log('[Payslip] Step 2: Generating PDFs...');
  const pdfs = await generatePayslipPDFsForPayRun(payRunId);
  const pdfCount = pdfs.filter(r => r.status === 'fulfilled').length;
  console.log(`[Payslip] Generated ${pdfCount}/${pdfs.length} PDFs`);
  
  // Step 3: Send emails
  console.log('[Payslip] Step 3: Sending emails...');
  const emails = await sendPayslipsForPayRun(payRunId);
  const emailCount = emails.filter(r => r.success).length;
  console.log(`[Payslip] Sent ${emailCount}/${emails.length} emails`);
  
  // Step 4: Update pay run status
  await db.query(`
    UPDATE pay_runs
    SET payslips_generated = true,
        payslips_sent = true
    WHERE id = ?
  `, [payRunId]);
  
  return {
    generated: successCount,
    pdfs: pdfCount,
    emails: emailCount,
    total: generated.length
  };
}

// Scheduled job: Send reminders for undownloaded payslips
async function sendPayslipDownloadReminders() {
  const undownloaded = await db.query(`
    SELECT p.id, p.employee_name, p.month, p.year, e.email
    FROM payslips p
    JOIN employees e ON p.employee_id = e.employee_id
    WHERE p.email_sent = true 
      AND p.download_count = 0
      AND p.email_sent_at < DATE_SUB(NOW(), INTERVAL 7 DAYS)
      AND p.reminder_sent_at IS NULL
  `);
  
  for (const payslip of undownloaded) {
    await sendEmail({
      to: payslip.email,
      subject: `Reminder: Download Your Payslip for ${payslip.month} ${payslip.year}`,
      html: `
        <p>Dear ${payslip.employee_name},</p>
        <p>This is a reminder to download your payslip for ${payslip.month} ${payslip.year}.</p>
        <p><a href="${getEmployeePortalURL()}/payslips">Click here to download</a></p>
      `
    });
    
    await db.query(`
      UPDATE payslips SET reminder_sent_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [payslip.id]);
  }
  
  return { reminders_sent: undownloaded.length };
}
```

**Business Rules**:
- Auto-generate payslips when pay run is locked
- Generate PDFs in bulk (parallel processing)
- Send emails with rate limiting
- Send reminders after 7 days
- Log all bulk operation results
- Retry failed operations (max 3 attempts)
- Notify HR on completion

---

#### 5.3.8 Statutory Compliance & Archival

**Rule**: Maintain payslips for statutory compliance and audits

**Compliance**:
```javascript
async function archivePayslips(year, month) {
  const payslips = await db.query(`
    SELECT * FROM payslips
    WHERE year = ? AND month = ?
  `, [year, month]);
  
  // Create archive package
  const archiveData = {
    year,
    month,
    total_payslips: payslips.length,
    total_gross: payslips.reduce((sum, p) => sum + p.gross_salary, 0),
    total_net_pay: payslips.reduce((sum, p) => sum + p.net_pay, 0),
    payslips: payslips.map(p => ({
      payslip_number: p.payslip_number,
      employee_id: p.employee_id,
      net_pay: p.net_pay,
      pdf_path: p.pdf_path
    })),
    archived_at: new Date().toISOString()
  };
  
  // Save archive manifest
  const archivePath = await saveArchive(archiveData, `payslips/archives/${year}/${month}/manifest.json`);
  
  // Copy all PDFs to archive location
  for (const payslip of payslips) {
    await copyToArchive(payslip.pdf_path, `payslips/archives/${year}/${month}/pdfs/`);
  }
  
  return { archived: payslips.length, archivePath };
}

async function validatePayslipCompliance(payslipId) {
  const payslip = await db.query(`
    SELECT * FROM payslips WHERE id = ?
  `, [payslipId]);
  
  const checks = [];
  
  // Check 1: All mandatory fields present
  const mandatoryFields = ['employee_name', 'employee_id', 'pan_number', 'month', 'year',
    'gross_salary', 'net_pay', 'payment_date'];
  for (const field of mandatoryFields) {
    if (!payslip[field]) {
      checks.push({ field, status: 'missing', severity: 'high' });
    }
  }
  
  // Check 2: Calculations correct
  const earnings = JSON.parse(payslip.earnings);
  const calculatedGross = Object.values(earnings).reduce((sum, val) => sum + val, 0);
  if (Math.abs(calculatedGross - payslip.gross_salary) > 0.01) {
    checks.push({ field: 'gross_salary', status: 'mismatch', severity: 'high' });
  }
  
  // Check 3: Statutory deductions present (if applicable)
  const deductions = JSON.parse(payslip.deductions);
  if (payslip.uan_number && !deductions.provident_fund) {
    checks.push({ field: 'pf_deduction', status: 'missing', severity: 'medium' });
  }
  if (payslip.esi_number && !deductions.esi) {
    checks.push({ field: 'esi_deduction', status: 'missing', severity: 'medium' });
  }
  
  // Check 4: PDF generated
  if (!payslip.pdf_generated) {
    checks.push({ field: 'pdf', status: 'not_generated', severity: 'high' });
  }
  
  return {
    compliant: checks.length === 0,
    checks
  };
}
```

**Business Rules**:
- Retain payslips for 7 years (statutory requirement)
- Archive monthly payslips after 1 year
- Maintain PDF copies in immutable storage
- Generate archive manifest with checksums
- Validate compliance before archival
- Support audit trail extraction
- Encrypt archived payslips

---

#### 5.3.9 Search & Export

**Rule**: Enable search and export of payslip data

**Search & Export**:
```javascript
async function searchPayslips(criteria) {
  let query = `
    SELECT 
      payslip_number, employee_id, employee_name, department, designation,
      month, year, gross_salary, total_deductions, net_pay,
      payment_date, status, is_revised
    FROM payslips
    WHERE 1=1
  `;
  
  const params = [];
  
  if (criteria.employee_id) {
    query += ` AND employee_id = ?`;
    params.push(criteria.employee_id);
  }
  
  if (criteria.department) {
    query += ` AND department = ?`;
    params.push(criteria.department);
  }
  
  if (criteria.year) {
    query += ` AND year = ?`;
    params.push(criteria.year);
  }
  
  if (criteria.month) {
    query += ` AND month = ?`;
    params.push(criteria.month);
  }
  
  if (criteria.min_net_pay) {
    query += ` AND net_pay >= ?`;
    params.push(criteria.min_net_pay);
  }
  
  if (criteria.max_net_pay) {
    query += ` AND net_pay <= ?`;
    params.push(criteria.max_net_pay);
  }
  
  if (criteria.is_revised !== undefined) {
    query += ` AND is_revised = ?`;
    params.push(criteria.is_revised);
  }
  
  query += ` ORDER BY year DESC, FIELD(month, 'December','November','October',
    'September','August','July','June','May','April','March','February','January')`;
  
  return await db.query(query, params);
}

async function exportPayslipsToExcel(payRunId) {
  const payslips = await db.query(`
    SELECT 
      payslip_number, employee_id, employee_name, department, designation,
      month, year, payment_date,
      total_working_days, payable_days, loss_of_pay_days,
      earnings, gross_salary, deductions, total_deductions, net_pay,
      employer_pf, employer_esi,
      ytd_gross, ytd_deductions, ytd_net_pay
    FROM payslips
    WHERE pay_run_id = ?
    ORDER BY department, employee_name
  `, [payRunId]);
  
  // Flatten JSON fields for Excel
  const flattenedData = payslips.map(p => {
    const earnings = JSON.parse(p.earnings);
    const deductions = JSON.parse(p.deductions);
    
    return {
      'Payslip Number': p.payslip_number,
      'Employee ID': p.employee_id,
      'Employee Name': p.employee_name,
      'Department': p.department,
      'Designation': p.designation,
      'Month': p.month,
      'Year': p.year,
      'Payment Date': p.payment_date,
      'Working Days': p.total_working_days,
      'Payable Days': p.payable_days,
      'LOP Days': p.loss_of_pay_days,
      'Basic Salary': earnings.basic_salary,
      'HRA': earnings.hra,
      'Conveyance': earnings.conveyance,
      'Other Allowances': earnings.telephone + earnings.medical_allowance + earnings.special_allowance,
      'Overtime': earnings.overtime_amount,
      'Bonus': earnings.bonus,
      'Gross Salary': p.gross_salary,
      'PF': deductions.provident_fund,
      'ESI': deductions.esi,
      'PT': deductions.professional_tax,
      'TDS': deductions.tds,
      'LOP Deduction': deductions.loss_of_pay,
      'Loan': deductions.loan,
      'Advance': deductions.advance,
      'Total Deductions': p.total_deductions,
      'Net Pay': p.net_pay,
      'Employer PF': p.employer_pf,
      'Employer ESI': p.employer_esi,
      'YTD Gross': p.ytd_gross,
      'YTD Net Pay': p.ytd_net_pay
    };
  });
  
  // Generate Excel file
  const excelBuffer = await generateExcelFromData(flattenedData);
  
  return {
    filename: `Payslips_${payslips[0]?.month}_${payslips[0]?.year}.xlsx`,
    buffer: excelBuffer
  };
}
```

**Business Rules**:
- Search by employee, department, month, year
- Filter by salary range
- Export to Excel with flattened structure
- Include YTD columns for tax reporting
- Support bulk PDF download (zip file)
- Export department-wise summaries
- Generate Form 16 data extract

---

#### 5.3.10 Notifications & Alerts

**Rule**: Proactive communication about payslips

**Notifications**:
```javascript
async function sendPayslipNotifications(payRunId) {
  const payRun = await db.query(`
    SELECT month, year FROM pay_runs WHERE id = ?
  `, [payRunId]);
  
  // Notify all employees
  const employees = await db.query(`
    SELECT DISTINCT e.employee_id, e.email, e.employee_name
    FROM employees e
    JOIN payslips p ON e.employee_id = p.employee_id
    WHERE p.pay_run_id = ? AND p.email_sent = false
  `, [payRunId]);
  
  for (const emp of employees) {
    await sendNotification({
      user_id: emp.employee_id,
      type: 'payslip_ready',
      title: 'Your Payslip is Ready',
      message: `Your salary for ${payRun.month} ${payRun.year} has been processed. Download your payslip now.`,
      action_url: '/payslips',
      priority: 'high'
    });
  }
  
  return { notified: employees.length };
}

async function alertHROnFailures(payRunId) {
  const failures = await db.query(`
    SELECT 
      COUNT(*) as failed_pdfs
    FROM payslips
    WHERE pay_run_id = ? AND pdf_generated = false
  `, [payRunId]);
  
  const emailFailures = await db.query(`
    SELECT 
      COUNT(*) as failed_emails
    FROM payslips
    WHERE pay_run_id = ? AND pdf_generated = true AND email_sent = false
  `, [payRunId]);
  
  if (failures.failed_pdfs > 0 || emailFailures.failed_emails > 0) {
    await sendEmail({
      to: 'hr@company.com',
      subject: `Payslip Distribution Failures - ${payRunId}`,
      html: `
        <p>Payslip generation/distribution has some failures:</p>
        <ul>
          <li>Failed PDFs: ${failures.failed_pdfs}</li>
          <li>Failed Emails: ${emailFailures.failed_emails}</li>
        </ul>
        <p>Please review and retry.</p>
      `
    });
  }
}
```

**Business Rules**:
- Notify employees when payslip is ready
- Send reminders for undownloaded payslips
- Alert HR on generation/distribution failures
- Weekly digest of payslip access stats
- Notify on payslip revisions
- Send annual summary (end of financial year)

---

## 6. Advance and Loan Management

### 6.1 AdvanceRecord Management
**Rule**: Manage salary advances with transparent request, approval, disbursement, and recovery workflows

**Purpose**: Support employees with short-term financial needs through salary advances, maintain proper authorization and documentation, ensure timely recovery from future salaries, track advance history, prevent excessive advances, and provide self-service request capabilities.

---

#### 6.1.1 Advance Request & Structure

**Rule**: Enable employees to request salary advances with proper justification

**AdvanceRecord Schema**:
```javascript
const ADVANCE_RECORD_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  advance_number: 'VARCHAR(50) UNIQUE NOT NULL', // Format: ADV/YYYY/MM/EMPID/SEQ
  employee_id: 'VARCHAR(20) FOREIGN KEY NOT NULL',
  employee_name: 'VARCHAR(255) NOT NULL', // Denormalized
  department: 'VARCHAR(100)', // Denormalized
  designation: 'VARCHAR(255)', // Denormalized
  current_salary: 'DECIMAL(12,2)', // Denormalized for limit calculation
  
  // Request details
  requested_amount: 'DECIMAL(12,2) NOT NULL',
  approved_amount: 'DECIMAL(12,2)', // May differ from requested
  reason: 'TEXT NOT NULL',
  request_date: 'DATE NOT NULL',
  
  // Disbursement details
  advance_month: 'VARCHAR(20) NOT NULL', // Month when advance is paid
  advance_year: 'INT NOT NULL',
  advance_paid_amount: 'DECIMAL(12,2)', // Actual disbursed amount
  payment_date: 'DATE',
  payment_method: 'ENUM', // 'bank_transfer', 'cash', 'cheque'
  payment_reference: 'VARCHAR(100)',
  
  // Recovery details
  advance_deduction_month: 'VARCHAR(20) NOT NULL', // Month for recovery
  advance_deduction_year: 'INT NOT NULL',
  deduction_count: 'INT DEFAULT 1', // Number of installments
  per_month_deduction: 'DECIMAL(12,2)', // Amount per installment
  
  // Tracking
  total_deducted: 'DECIMAL(12,2) DEFAULT 0',
  remaining_amount: 'DECIMAL(12,2) NOT NULL',
  status: 'ENUM NOT NULL', // 'requested', 'approved', 'rejected', 'paid', 'recovering', 'recovered', 'cancelled'
  
  // Approval workflow
  requested_by: 'UUID FOREIGN KEY NOT NULL',
  approved_by: 'UUID FOREIGN KEY',
  approval_date: 'TIMESTAMP',
  rejection_reason: 'TEXT',
  paid_by: 'UUID FOREIGN KEY', // Finance team member
  
  // Audit
  remarks: 'TEXT',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};
```

**Advance Request**:
```javascript
async function requestAdvance(employeeId, advanceData) {
  // Get employee details
  const employee = await db.query(`
    SELECT 
      employee_name, department, designation,
      salary_basic + salary_hra + salary_conveyance + salary_telephone + 
      salary_medical + salary_special_allowance as current_salary
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  // Validate advance limit (max 50% of monthly salary)
  const maxAdvance = employee.current_salary * 0.5;
  if (advanceData.requested_amount > maxAdvance) {
    throw new Error(`Advance cannot exceed 50% of monthly salary (₹${maxAdvance})`);
  }
  
  // Check if employee has pending advances
  const pendingAdvances = await db.query(`
    SELECT SUM(remaining_amount) as pending_total
    FROM advance_records
    WHERE employee_id = ? AND status IN ('approved', 'paid', 'recovering')
  `, [employeeId]);
  
  if (pendingAdvances.pending_total > 0) {
    throw new Error(`Employee has pending advance recovery of ₹${pendingAdvances.pending_total}`);
  }
  
  // Generate advance number
  const currentDate = new Date();
  const sequenceCount = await db.query(`
    SELECT COUNT(*) as count FROM advance_records
    WHERE employee_id = ? AND YEAR(request_date) = ?
  `, [employeeId, currentDate.getFullYear()]);
  
  const advanceNumber = `ADV/${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${employeeId}/${String(sequenceCount.count + 1).padStart(3, '0')}`;
  
  // Create advance request
  const advanceId = await db.query(`
    INSERT INTO advance_records (
      advance_number, employee_id, employee_name, department, designation, current_salary,
      requested_amount, reason, request_date,
      advance_month, advance_year,
      advance_deduction_month, advance_deduction_year,
      deduction_count, per_month_deduction, remaining_amount,
      status, requested_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?)
  `, [
    advanceNumber, employeeId, employee.employee_name, employee.department, 
    employee.designation, employee.current_salary,
    advanceData.requested_amount, advanceData.reason, currentDate,
    advanceData.advance_month, advanceData.advance_year,
    advanceData.deduction_month, advanceData.deduction_year,
    advanceData.deduction_count || 1,
    advanceData.requested_amount / (advanceData.deduction_count || 1),
    advanceData.requested_amount,
    employeeId
  ]);
  
  // Notify manager for approval
  await notifyManager(employeeId, 'advance_request', {
    advance_number: advanceNumber,
    amount: advanceData.requested_amount,
    reason: advanceData.reason
  });
  
  return { advanceId, advanceNumber };
}
```

**Business Rules**:
- Maximum advance: 50% of monthly gross salary
- No multiple pending advances per employee
- Require written reason/justification
- Generate unique advance number: ADV/YYYY/MM/EMPID/SEQ
- Default recovery: single deduction from next month's salary
- Support multi-month recovery (installments)
- Auto-notify manager on request submission

---

#### 6.1.2 Approval Workflow & Authorization

**Rule**: Multi-level approval based on advance amount

**Approval Management**:
```javascript
async function approveAdvance(advanceId, approvedBy, approvalData) {
  const advance = await db.query(`
    SELECT * FROM advance_records WHERE id = ?
  `, [advanceId]);
  
  if (advance.status !== 'requested') {
    throw new Error('Advance is not in requested status');
  }
  
  // Authorization check based on amount
  const approver = await db.query(`
    SELECT role, department FROM users WHERE id = ?
  `, [approvedBy]);
  
  // Approval authority rules
  const canApprove = 
    (advance.requested_amount <= 10000 && approver.role === 'manager') ||
    (advance.requested_amount <= 50000 && approver.role === 'hr_manager') ||
    (advance.requested_amount > 50000 && approver.role === 'director');
  
  if (!canApprove) {
    throw new Error('Insufficient authorization to approve this advance amount');
  }
  
  // Check if approved amount differs from requested
  const approvedAmount = approvalData.approved_amount || advance.requested_amount;
  
  if (approvedAmount > advance.requested_amount) {
    throw new Error('Approved amount cannot exceed requested amount');
  }
  
  // Update advance
  await db.query(`
    UPDATE advance_records
    SET status = 'approved',
        approved_amount = ?,
        approved_by = ?,
        approval_date = CURRENT_TIMESTAMP,
        per_month_deduction = ?,
        remaining_amount = ?
    WHERE id = ?
  `, [
    approvedAmount,
    approvedBy,
    approvedAmount / advance.deduction_count,
    approvedAmount,
    advanceId
  ]);
  
  // Notify employee
  await sendNotification({
    user_id: advance.employee_id,
    type: 'advance_approved',
    title: 'Advance Request Approved',
    message: `Your advance request of ₹${approvedAmount} has been approved.`,
    priority: 'high'
  });
  
  // Notify finance for disbursement
  await notifyFinanceTeam('advance_approved', {
    advance_number: advance.advance_number,
    employee_name: advance.employee_name,
    amount: approvedAmount
  });
  
  return { success: true };
}

async function rejectAdvance(advanceId, rejectedBy, reason) {
  await db.query(`
    UPDATE advance_records
    SET status = 'rejected',
        approved_by = ?,
        approval_date = CURRENT_TIMESTAMP,
        rejection_reason = ?
    WHERE id = ?
  `, [rejectedBy, reason, advanceId]);
  
  const advance = await db.query(`
    SELECT employee_id, employee_name, requested_amount FROM advance_records WHERE id = ?
  `, [advanceId]);
  
  // Notify employee
  await sendNotification({
    user_id: advance.employee_id,
    type: 'advance_rejected',
    title: 'Advance Request Rejected',
    message: `Your advance request of ₹${advance.requested_amount} has been rejected. Reason: ${reason}`,
    priority: 'medium'
  });
  
  return { success: true };
}
```

**Business Rules**:
- Approval authority by amount:
  - ≤ ₹10,000: Manager
  - ≤ ₹50,000: HR Manager
  - > ₹50,000: Director
- Approved amount ≤ requested amount
- Cannot approve own advance request
- Rejection requires written reason
- Notify employee on approval/rejection
- Forward to finance team on approval

---

#### 6.1.3 Disbursement & Payment Tracking

**Rule**: Record advance payments with proper documentation

**Disbursement**:
```javascript
async function disburseAdvance(advanceId, paymentDetails, paidBy) {
  const advance = await db.query(`
    SELECT * FROM advance_records WHERE id = ?
  `, [advanceId]);
  
  if (advance.status !== 'approved') {
    throw new Error('Advance must be approved before disbursement');
  }
  
  // Get employee bank details
  const employee = await db.query(`
    SELECT bank_name, bank_account_number, ifsc_code
    FROM employees WHERE employee_id = ?
  `, [advance.employee_id]);
  
  // Record payment
  await db.query(`
    UPDATE advance_records
    SET status = 'paid',
        advance_paid_amount = ?,
        payment_date = ?,
        payment_method = ?,
        payment_reference = ?,
        paid_by = ?,
        remaining_amount = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    paymentDetails.amount || advance.approved_amount,
    paymentDetails.payment_date || new Date(),
    paymentDetails.payment_method || 'bank_transfer',
    paymentDetails.payment_reference,
    paidBy,
    paymentDetails.amount || advance.approved_amount,
    advanceId
  ]);
  
  // Create payment transaction record
  await db.query(`
    INSERT INTO payment_transactions (
      transaction_type, reference_id, reference_number,
      employee_id, amount, payment_date, payment_method, payment_reference,
      processed_by
    ) VALUES ('advance_payment', ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    advanceId, advance.advance_number,
    advance.employee_id, paymentDetails.amount || advance.approved_amount,
    paymentDetails.payment_date, paymentDetails.payment_method,
    paymentDetails.payment_reference, paidBy
  ]);
  
  // Notify employee
  await sendNotification({
    user_id: advance.employee_id,
    type: 'advance_paid',
    title: 'Advance Payment Processed',
    message: `Your advance of ₹${paymentDetails.amount || advance.approved_amount} has been credited to your account.`,
    priority: 'high'
  });
  
  return { success: true };
}

async function getAdvancePaymentSummary(month, year) {
  return await db.query(`
    SELECT 
      COUNT(*) as total_advances,
      SUM(advance_paid_amount) as total_amount,
      payment_method,
      COUNT(DISTINCT employee_id) as unique_employees
    FROM advance_records
    WHERE advance_month = ? AND advance_year = ?
      AND status = 'paid'
    GROUP BY payment_method
  `, [month, year]);
}
```

**Business Rules**:
- Disburse only approved advances
- Record payment method (bank transfer, cash, cheque)
- Store payment reference for reconciliation
- Paid amount ≤ approved amount
- Auto-notify employee on payment
- Create audit trail in payment_transactions
- Update status from 'approved' to 'paid'

---

#### 6.1.4 Recovery & Deduction Processing

**Rule**: Auto-deduct advances from monthly salary during payroll

**Recovery Processing**:
```javascript
async function processAdvanceDeductions(payRunId, month, year) {
  // Get all advances due for deduction this month
  const dueAdvances = await db.query(`
    SELECT * FROM advance_records
    WHERE advance_deduction_month = ? 
      AND advance_deduction_year = ?
      AND status IN ('paid', 'recovering')
      AND remaining_amount > 0
  `, [month, year]);
  
  const deductions = [];
  
  for (const advance of dueAdvances) {
    // Calculate deduction amount (per installment)
    let deductionAmount = advance.per_month_deduction;
    
    // If remaining is less than per month deduction
    if (advance.remaining_amount < deductionAmount) {
      deductionAmount = advance.remaining_amount;
    }
    
    // Update advance record
    const newRemaining = advance.remaining_amount - deductionAmount;
    const newTotalDeducted = advance.total_deducted + deductionAmount;
    const newStatus = newRemaining <= 0 ? 'recovered' : 'recovering';
    
    await db.query(`
      UPDATE advance_records
      SET total_deducted = ?,
          remaining_amount = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newTotalDeducted, newRemaining, newStatus, advance.id]);
    
    // Add to pay run employee record deductions
    await db.query(`
      UPDATE pay_run_employee_records
      SET advance_deduction = advance_deduction + ?
      WHERE pay_run_id = ? AND employee_id = ?
    `, [deductionAmount, payRunId, advance.employee_id]);
    
    deductions.push({
      advance_id: advance.id,
      advance_number: advance.advance_number,
      employee_id: advance.employee_id,
      deduction_amount: deductionAmount,
      remaining_amount: newRemaining,
      status: newStatus
    });
    
    // Notify employee if fully recovered
    if (newStatus === 'recovered') {
      await sendNotification({
        user_id: advance.employee_id,
        type: 'advance_recovered',
        title: 'Advance Fully Recovered',
        message: `Your advance of ₹${advance.advance_paid_amount} has been fully recovered.`,
        priority: 'medium'
      });
    }
  }
  
  return deductions;
}

// Manual adjustment for partial deduction
async function adjustAdvanceDeduction(advanceId, adjustmentAmount, reason, adjustedBy) {
  const advance = await db.query(`
    SELECT * FROM advance_records WHERE id = ?
  `, [advanceId]);
  
  const newRemaining = advance.remaining_amount - adjustmentAmount;
  const newTotalDeducted = advance.total_deducted + adjustmentAmount;
  
  await db.query(`
    UPDATE advance_records
    SET total_deducted = ?,
        remaining_amount = ?,
        status = ?,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    newTotalDeducted,
    Math.max(0, newRemaining),
    newRemaining <= 0 ? 'recovered' : 'recovering',
    `Adjustment: ₹${adjustmentAmount} on ${new Date().toISOString()} by ${adjustedBy}. Reason: ${reason}`,
    advanceId
  ]);
  
  return { success: true, new_remaining: newRemaining };
}
```

**Business Rules**:
- Auto-deduct during pay run processing
- Deduct per_month_deduction amount per installment
- If remaining < installment, deduct only remaining
- Update status: paid → recovering → recovered
- Track total_deducted and remaining_amount
- Notify employee on full recovery
- Support manual adjustments with audit trail
- Handle employee resignation (recover full amount from final settlement)

---

#### 6.1.5 Advance History & Reporting

**Rule**: Track advance patterns and employee eligibility

**History & Analytics**:
```javascript
async function getEmployeeAdvanceHistory(employeeId) {
  return await db.query(`
    SELECT 
      advance_number, request_date, 
      requested_amount, approved_amount, advance_paid_amount,
      advance_month, advance_year,
      advance_deduction_month, advance_deduction_year,
      deduction_count, total_deducted, remaining_amount,
      status, reason
    FROM advance_records
    WHERE employee_id = ?
    ORDER BY request_date DESC
  `, [employeeId]);
}

async function checkAdvanceEligibility(employeeId) {
  const employee = await db.query(`
    SELECT 
      date_of_joining,
      salary_basic + salary_hra + salary_conveyance + salary_telephone + 
      salary_medical + salary_special_allowance as current_salary
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  // Check tenure (min 3 months)
  const tenureMonths = Math.floor(
    (new Date() - new Date(employee.date_of_joining)) / (1000 * 60 * 60 * 24 * 30)
  );
  
  if (tenureMonths < 3) {
    return {
      eligible: false,
      reason: 'Minimum 3 months tenure required',
      max_advance: 0
    };
  }
  
  // Check pending advances
  const pending = await db.query(`
    SELECT SUM(remaining_amount) as pending_total
    FROM advance_records
    WHERE employee_id = ? AND status IN ('approved', 'paid', 'recovering')
  `, [employeeId]);
  
  if (pending.pending_total > 0) {
    return {
      eligible: false,
      reason: `Pending advance recovery: ₹${pending.pending_total}`,
      max_advance: 0
    };
  }
  
  // Check advance frequency (max 3 per year)
  const currentYearAdvances = await db.query(`
    SELECT COUNT(*) as count FROM advance_records
    WHERE employee_id = ? 
      AND YEAR(request_date) = YEAR(CURRENT_DATE)
      AND status NOT IN ('rejected', 'cancelled')
  `, [employeeId]);
  
  if (currentYearAdvances.count >= 3) {
    return {
      eligible: false,
      reason: 'Maximum 3 advances per year limit reached',
      max_advance: 0
    };
  }
  
  return {
    eligible: true,
    max_advance: employee.current_salary * 0.5,
    remaining_quota: 3 - currentYearAdvances.count
  };
}

async function getAdvanceAnalytics(filters = {}) {
  let query = `
    SELECT 
      DATE_FORMAT(request_date, '%Y-%m') as month,
      COUNT(*) as total_requests,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      AVG(requested_amount) as avg_requested,
      AVG(approved_amount) as avg_approved,
      SUM(advance_paid_amount) as total_disbursed,
      SUM(total_deducted) as total_recovered,
      SUM(remaining_amount) as total_outstanding
    FROM advance_records
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filters.year) {
    query += ` AND advance_year = ?`;
    params.push(filters.year);
  }
  
  if (filters.department) {
    query += ` AND department = ?`;
    params.push(filters.department);
  }
  
  query += ` GROUP BY DATE_FORMAT(request_date, '%Y-%m') ORDER BY month DESC`;
  
  return await db.query(query, params);
}
```

**Business Rules**:
- Track complete advance history per employee
- Eligibility criteria:
  - Minimum 3 months tenure
  - No pending advance recovery
  - Maximum 3 advances per year
  - Max amount: 50% of monthly salary
- Calculate approval rate, average amounts
- Monitor outstanding advances
- Alert on high-frequency requesters
- Department-wise advance analytics

---

#### 6.1.6 Bulk Operations & Automation

**Rule**: Automate advance deduction during payroll processing

**Bulk Processing**:
```javascript
async function processBulkAdvanceRequests(advanceIds, approvedBy, action) {
  const results = [];
  
  for (const advanceId of advanceIds) {
    try {
      if (action === 'approve') {
        await approveAdvance(advanceId, approvedBy, {});
        results.push({ advanceId, success: true, action: 'approved' });
      } else if (action === 'reject') {
        await rejectAdvance(advanceId, approvedBy, 'Bulk rejection');
        results.push({ advanceId, success: true, action: 'rejected' });
      }
    } catch (error) {
      results.push({ advanceId, success: false, error: error.message });
    }
  }
  
  return results;
}

async function generateAdvanceDeductionReport(month, year) {
  return await db.query(`
    SELECT 
      ar.advance_number,
      ar.employee_id,
      ar.employee_name,
      ar.department,
      ar.advance_paid_amount,
      ar.per_month_deduction as deduction_amount,
      ar.total_deducted,
      ar.remaining_amount,
      ar.status
    FROM advance_records ar
    WHERE ar.advance_deduction_month = ?
      AND ar.advance_deduction_year = ?
      AND ar.status IN ('paid', 'recovering')
      AND ar.remaining_amount > 0
    ORDER BY ar.department, ar.employee_name
  `, [month, year]);
}

// Scheduled job: Auto-process deductions during pay run
async function autoProcessAdvanceDeductions() {
  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const currentYear = new Date().getFullYear();
  
  // Find active pay run for current month
  const payRun = await db.query(`
    SELECT id FROM pay_runs
    WHERE month = ? AND year = ? AND status = 'draft'
    LIMIT 1
  `, [currentMonth, currentYear]);
  
  if (payRun) {
    const deductions = await processAdvanceDeductions(payRun.id, currentMonth, currentYear);
    console.log(`Processed ${deductions.length} advance deductions for ${currentMonth} ${currentYear}`);
    return deductions;
  }
  
  return [];
}
```

**Business Rules**:
- Bulk approve/reject multiple requests
- Auto-deduct during pay run creation
- Generate monthly deduction reports
- Integrate with payroll processing
- Schedule advance recovery reminders
- Export advance registers (CSV/Excel)

---

#### 6.1.7 Employee Self-Service Portal

**Rule**: Enable employees to request and track advances online

**Portal Features**:
```javascript
async function getEmployeeAdvanceDashboard(employeeId) {
  // Eligibility check
  const eligibility = await checkAdvanceEligibility(employeeId);
  
  // Active advances
  const activeAdvances = await db.query(`
    SELECT * FROM advance_records
    WHERE employee_id = ? 
      AND status IN ('requested', 'approved', 'paid', 'recovering')
    ORDER BY request_date DESC
  `, [employeeId]);
  
  // History (last 12 months)
  const history = await db.query(`
    SELECT * FROM advance_records
    WHERE employee_id = ?
      AND request_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)
    ORDER BY request_date DESC
  `, [employeeId]);
  
  // Pending amount
  const pending = await db.query(`
    SELECT SUM(remaining_amount) as total_pending
    FROM advance_records
    WHERE employee_id = ? AND status IN ('paid', 'recovering')
  `, [employeeId]);
  
  return {
    eligibility,
    active_advances: activeAdvances,
    history,
    total_pending: pending.total_pending || 0
  };
}

async function submitAdvanceRequest(employeeId, requestData) {
  // Validate eligibility
  const eligibility = await checkAdvanceEligibility(employeeId);
  
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason);
  }
  
  if (requestData.amount > eligibility.max_advance) {
    throw new Error(`Amount exceeds maximum limit of ₹${eligibility.max_advance}`);
  }
  
  // Submit request
  return await requestAdvance(employeeId, {
    requested_amount: requestData.amount,
    reason: requestData.reason,
    advance_month: requestData.advance_month || getCurrentMonth(),
    advance_year: requestData.advance_year || getCurrentYear(),
    deduction_month: requestData.deduction_month || getNextMonth(),
    deduction_year: requestData.deduction_year || getDeductionYear(),
    deduction_count: requestData.deduction_count || 1
  });
}
```

**Business Rules**:
- Show eligibility status and max advance
- Display active advances with remaining balance
- Allow online request submission
- Track request status in real-time
- Show deduction schedule
- Enable request cancellation (before approval)
- Download advance statement

---

#### 6.1.8 Cancellation & Adjustments

**Rule**: Support advance cancellation and manual adjustments

**Cancellation**:
```javascript
async function cancelAdvance(advanceId, cancelledBy, reason) {
  const advance = await db.query(`
    SELECT * FROM advance_records WHERE id = ?
  `, [advanceId]);
  
  // Can cancel only if not yet paid
  if (advance.status === 'paid' || advance.status === 'recovering') {
    throw new Error('Cannot cancel paid/recovering advance. Use adjustment instead.');
  }
  
  if (advance.status === 'recovered') {
    throw new Error('Cannot cancel already recovered advance');
  }
  
  await db.query(`
    UPDATE advance_records
    SET status = 'cancelled',
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [`Cancelled on ${new Date().toISOString()} by ${cancelledBy}. Reason: ${reason}`, advanceId]);
  
  // Notify employee
  await sendNotification({
    user_id: advance.employee_id,
    type: 'advance_cancelled',
    title: 'Advance Request Cancelled',
    message: `Your advance request ${advance.advance_number} has been cancelled.`,
    priority: 'medium'
  });
  
  return { success: true };
}

async function waiveOffAdvance(advanceId, waivedBy, reason) {
  const advance = await db.query(`
    SELECT * FROM advance_records WHERE id = ?
  `, [advanceId]);
  
  // Require director approval
  const approver = await db.query(`
    SELECT role FROM users WHERE id = ?
  `, [waivedBy]);
  
  if (approver.role !== 'director') {
    throw new Error('Only directors can waive off advances');
  }
  
  await db.query(`
    UPDATE advance_records
    SET status = 'recovered',
        remaining_amount = 0,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    `Waived off: ₹${advance.remaining_amount} on ${new Date().toISOString()} by ${waivedBy}. Reason: ${reason}`,
    advanceId
  ]);
  
  return { success: true, waived_amount: advance.remaining_amount };
}
```

**Business Rules**:
- Cancel only 'requested' or 'approved' status advances
- Cannot cancel paid/recovering advances (use adjustment)
- Waive-off requires director approval
- Store cancellation/waive-off reason
- Update audit trail in remarks
- Notify employee on cancellation

---

#### 6.1.9 Notifications & Reminders

**Rule**: Proactive communication about advance lifecycle

**Notifications**:
```javascript
async function sendAdvanceNotifications() {
  // 1. Pending approval reminders (after 3 days)
  const pendingApprovals = await db.query(`
    SELECT ar.*, e.email as manager_email
    FROM advance_records ar
    JOIN employees emp ON ar.employee_id = emp.employee_id
    JOIN users e ON emp.reporting_manager_id = e.id
    WHERE ar.status = 'requested'
      AND ar.request_date < DATE_SUB(CURRENT_DATE, INTERVAL 3 DAY)
  `);
  
  for (const advance of pendingApprovals) {
    await sendEmail({
      to: advance.manager_email,
      subject: `Pending Advance Approval - ${advance.employee_name}`,
      html: `
        <p>Advance Request ${advance.advance_number} is pending your approval.</p>
        <p>Employee: ${advance.employee_name}</p>
        <p>Amount: ₹${advance.requested_amount}</p>
        <p>Reason: ${advance.reason}</p>
        <p><a href="${getPortalURL()}/advances/approve/${advance.id}">Approve/Reject</a></p>
      `
    });
  }
  
  // 2. Upcoming deduction reminders (5 days before)
  const upcomingDeductions = await db.query(`
    SELECT ar.*, e.email
    FROM advance_records ar
    JOIN employees e ON ar.employee_id = e.employee_id
    WHERE ar.status IN ('paid', 'recovering')
      AND ar.remaining_amount > 0
      AND STR_TO_DATE(CONCAT('01-', ar.advance_deduction_month, '-', ar.advance_deduction_year), '%d-%M-%Y')
        BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY)
  `);
  
  for (const advance of upcomingDeductions) {
    await sendEmail({
      to: advance.email,
      subject: `Advance Recovery Reminder - ₹${advance.per_month_deduction}`,
      html: `
        <p>Dear ${advance.employee_name},</p>
        <p>This is a reminder that ₹${advance.per_month_deduction} will be deducted from your ${advance.advance_deduction_month} ${advance.advance_deduction_year} salary towards advance recovery.</p>
        <p>Remaining balance: ₹${advance.remaining_amount}</p>
      `
    });
  }
  
  return {
    pending_approval_reminders: pendingApprovals.length,
    deduction_reminders: upcomingDeductions.length
  };
}
```

**Business Rules**:
- Notify manager on new request
- Remind manager after 3 days if pending
- Notify employee on approval/rejection
- Notify employee on payment
- Send deduction reminder 5 days before
- Notify on full recovery
- Weekly digest to HR (pending approvals, outstanding advances)

---

#### 6.1.10 Compliance & Audit Trail

**Rule**: Maintain complete audit trail for all advance transactions

**Audit & Compliance**:
```javascript
async function generateAdvanceAuditReport(startDate, endDate) {
  return await db.query(`
    SELECT 
      ar.advance_number,
      ar.employee_id,
      ar.employee_name,
      ar.department,
      ar.request_date,
      ar.requested_amount,
      ar.approved_amount,
      ar.advance_paid_amount,
      ar.total_deducted,
      ar.remaining_amount,
      ar.status,
      ar.reason,
      CONCAT(u1.first_name, ' ', u1.last_name) as requested_by_name,
      CONCAT(u2.first_name, ' ', u2.last_name) as approved_by_name,
      ar.approval_date,
      ar.payment_date,
      ar.payment_method,
      ar.payment_reference,
      ar.remarks,
      ar.created_at,
      ar.updated_at
    FROM advance_records ar
    LEFT JOIN users u1 ON ar.requested_by = u1.id
    LEFT JOIN users u2 ON ar.approved_by = u2.id
    WHERE ar.request_date BETWEEN ? AND ?
    ORDER BY ar.request_date DESC
  `, [startDate, endDate]);
}

async function validateAdvanceCompliance(advanceId) {
  const advance = await db.query(`
    SELECT * FROM advance_records WHERE id = ?
  `, [advanceId]);
  
  const issues = [];
  
  // Check if approved amount > 50% salary
  if (advance.approved_amount > advance.current_salary * 0.5) {
    issues.push('Approved amount exceeds 50% of salary');
  }
  
  // Check if proper approval obtained
  if (advance.status === 'approved' && !advance.approved_by) {
    issues.push('No approver recorded');
  }
  
  // Check if payment details recorded
  if (advance.status === 'paid' && !advance.payment_reference) {
    issues.push('Payment reference missing');
  }
  
  // Check deduction tracking
  if (advance.total_deducted > advance.advance_paid_amount) {
    issues.push('Total deducted exceeds paid amount');
  }
  
  // Check recovery schedule
  if (advance.status === 'recovering') {
    const monthsPassed = calculateMonthsDiff(
      advance.payment_date,
      new Date()
    );
    
    const expectedDeducted = Math.min(
      monthsPassed * advance.per_month_deduction,
      advance.advance_paid_amount
    );
    
    if (Math.abs(advance.total_deducted - expectedDeducted) > advance.per_month_deduction) {
      issues.push('Deduction schedule mismatch');
    }
  }
  
  return {
    compliant: issues.length === 0,
    issues
  };
}
```

**Business Rules**:
- Log all state changes (requested → approved → paid → recovering → recovered)
- Track approver, disbursement officer, adjustment maker
- Store complete remarks/reason history
- Generate audit reports for date ranges
- Validate compliance rules automatically
- Alert on policy violations
- Maintain immutable audit log
- Support regulator/auditor queries

---

### 6.2 LoanRecord Management
**Rule**: Manage employee loans with EMI schedule, interest calculation, and automated monthly deductions

**Purpose**: Provide employees with structured loan facilities, maintain transparent interest calculations and EMI schedules, ensure automated recovery through salary deductions, track loan lifecycle from disbursement to closure, support prepayment and foreclosure options, and maintain complete audit trail for financial compliance.

---

#### 6.2.1 Loan Request & Structure

**Rule**: Enable structured loan requests with complete terms and EMI calculation

**LoanRecord Schema**:
```javascript
const LOAN_RECORD_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  loan_number: 'VARCHAR(50) UNIQUE NOT NULL', // Format: LOAN/YYYY/MM/EMPID/SEQ
  employee_id: 'VARCHAR(20) FOREIGN KEY NOT NULL',
  employee_name: 'VARCHAR(255) NOT NULL', // Denormalized
  department: 'VARCHAR(100)', // Denormalized
  designation: 'VARCHAR(255)', // Denormalized
  current_salary: 'DECIMAL(12,2)', // Denormalized for eligibility check
  tenure_months: 'INT', // Employee tenure at time of loan
  
  // Request details
  loan_type: 'ENUM', // 'personal', 'emergency', 'education', 'housing', 'medical'
  requested_amount: 'DECIMAL(12,2) NOT NULL',
  approved_amount: 'DECIMAL(12,2)', // May differ from requested
  purpose: 'TEXT NOT NULL',
  request_date: 'DATE NOT NULL',
  
  // Loan terms
  loan_amount: 'DECIMAL(12,2) NOT NULL', // Final sanctioned amount
  interest_rate: 'DECIMAL(5,2) NOT NULL', // Annual interest rate %
  number_of_emis: 'INT NOT NULL', // Tenure in months
  emi_amount: 'DECIMAL(12,2) NOT NULL', // Monthly EMI
  total_amount: 'DECIMAL(12,2) NOT NULL', // Principal + Interest
  total_interest: 'DECIMAL(12,2) NOT NULL', // Total interest payable
  
  // Schedule
  start_month: 'VARCHAR(20) NOT NULL', // EMI start month
  start_year: 'INT NOT NULL',
  end_month: 'VARCHAR(20)', // Calculated end month
  end_year: 'INT', // Calculated end year
  
  // Disbursement
  disbursement_date: 'DATE',
  disbursement_method: 'ENUM', // 'bank_transfer', 'cash', 'cheque'
  disbursement_reference: 'VARCHAR(100)',
  
  // Tracking
  total_paid_emis: 'INT DEFAULT 0',
  total_paid_amount: 'DECIMAL(12,2) DEFAULT 0',
  remaining_balance: 'DECIMAL(12,2) NOT NULL',
  remaining_emis: 'INT',
  
  // Status
  status: 'ENUM NOT NULL', // 'requested', 'approved', 'rejected', 'active', 'completed', 'foreclosed', 'cancelled'
  
  // Approval workflow
  requested_by: 'UUID FOREIGN KEY NOT NULL',
  approved_by: 'UUID FOREIGN KEY',
  approval_date: 'TIMESTAMP',
  rejection_reason: 'TEXT',
  disbursed_by: 'UUID FOREIGN KEY',
  
  // Prepayment/Foreclosure
  prepayment_allowed: 'BOOLEAN DEFAULT true',
  foreclosure_charges_percent: 'DECIMAL(5,2) DEFAULT 2', // % of outstanding
  foreclosure_date: 'DATE',
  foreclosure_amount: 'DECIMAL(12,2)',
  
  // Audit
  remarks: 'TEXT',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};

// LoanEMI Schema (individual EMI records)
const LOAN_EMI_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  loan_id: 'UUID FOREIGN KEY NOT NULL',
  emi_number: 'INT NOT NULL', // Sequence: 1, 2, 3...
  month: 'VARCHAR(20) NOT NULL',
  year: 'INT NOT NULL',
  emi_amount: 'DECIMAL(12,2) NOT NULL',
  principal_component: 'DECIMAL(12,2)', // Principal portion
  interest_component: 'DECIMAL(12,2)', // Interest portion
  outstanding_balance: 'DECIMAL(12,2)', // Balance after this EMI
  status: 'ENUM NOT NULL', // 'pending', 'paid', 'waived'
  paid_date: 'DATE',
  deducted_from_payrun: 'VARCHAR(50)', // Pay run reference
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP',
  UNIQUE: '(loan_id, emi_number)'
};
```

**Loan Request**:
```javascript
async function requestLoan(employeeId, loanData) {
  // Get employee details
  const employee = await db.query(`
    SELECT 
      employee_name, department, designation,
      date_of_joining,
      salary_basic + salary_hra + salary_conveyance + salary_telephone + 
      salary_medical + salary_special_allowance as current_salary
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  // Calculate tenure
  const tenureMonths = Math.floor(
    (new Date() - new Date(employee.date_of_joining)) / (1000 * 60 * 60 * 24 * 30)
  );
  
  // Validate eligibility
  const eligibility = await checkLoanEligibility(employeeId);
  if (!eligibility.eligible) {
    throw new Error(eligibility.reason);
  }
  
  // Validate loan amount
  if (loanData.requested_amount > eligibility.max_loan) {
    throw new Error(`Loan amount cannot exceed ₹${eligibility.max_loan}`);
  }
  
  // Generate loan number
  const currentDate = new Date();
  const sequenceCount = await db.query(`
    SELECT COUNT(*) as count FROM loan_records
    WHERE employee_id = ? AND YEAR(request_date) = ?
  `, [employeeId, currentDate.getFullYear()]);
  
  const loanNumber = `LOAN/${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${employeeId}/${String(sequenceCount.count + 1).padStart(3, '0')}`;
  
  // Create loan request
  const loanId = await db.query(`
    INSERT INTO loan_records (
      loan_number, employee_id, employee_name, department, designation,
      current_salary, tenure_months,
      loan_type, requested_amount, purpose, request_date,
      interest_rate, number_of_emis,
      start_month, start_year,
      remaining_balance, status, requested_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?)
  `, [
    loanNumber, employeeId, employee.employee_name, employee.department,
    employee.designation, employee.current_salary, tenureMonths,
    loanData.loan_type, loanData.requested_amount, loanData.purpose, currentDate,
    loanData.interest_rate || 8, // Default 8% annual
    loanData.number_of_emis || 12, // Default 12 months
    loanData.start_month, loanData.start_year,
    loanData.requested_amount, // Initial remaining balance
    employeeId
  ]);
  
  // Notify manager
  await notifyManager(employeeId, 'loan_request', {
    loan_number: loanNumber,
    amount: loanData.requested_amount,
    purpose: loanData.purpose,
    loan_type: loanData.loan_type
  });
  
  return { loanId, loanNumber };
}
```

**Business Rules**:
- Loan types: personal, emergency, education, housing, medical
- Maximum loan: 3× monthly salary (based on tenure)
- Minimum tenure: 6 months to apply
- Default interest rate: 8% per annum (configurable by type)
- EMI tenure: 6-60 months
- One active loan per employee
- Generate unique loan number: LOAN/YYYY/MM/EMPID/SEQ
- Require detailed purpose/justification

---

#### 6.2.2 Loan Eligibility & Limits

**Rule**: Define eligibility criteria based on tenure, salary, and existing obligations

**Eligibility Calculation**:
```javascript
async function checkLoanEligibility(employeeId) {
  const employee = await db.query(`
    SELECT 
      date_of_joining,
      salary_basic + salary_hra + salary_conveyance + salary_telephone + 
      salary_medical + salary_special_allowance as current_salary,
      employment_status
    FROM employees
    WHERE employee_id = ?
  `, [employeeId]);
  
  // Check 1: Employment status
  if (employee.employment_status !== 'active') {
    return {
      eligible: false,
      reason: 'Employee must be in active status',
      max_loan: 0
    };
  }
  
  // Check 2: Tenure (minimum 6 months)
  const tenureMonths = Math.floor(
    (new Date() - new Date(employee.date_of_joining)) / (1000 * 60 * 60 * 24 * 30)
  );
  
  if (tenureMonths < 6) {
    return {
      eligible: false,
      reason: 'Minimum 6 months tenure required',
      max_loan: 0
    };
  }
  
  // Check 3: Existing active loans
  const activeLoan = await db.query(`
    SELECT id, remaining_balance FROM loan_records
    WHERE employee_id = ? AND status = 'active'
  `, [employeeId]);
  
  if (activeLoan) {
    return {
      eligible: false,
      reason: `Active loan exists with ₹${activeLoan.remaining_balance} outstanding`,
      max_loan: 0
    };
  }
  
  // Check 4: Recent defaults
  const defaults = await db.query(`
    SELECT COUNT(*) as count FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE lr.employee_id = ? 
      AND le.status = 'pending'
      AND STR_TO_DATE(CONCAT('01-', le.month, '-', le.year), '%d-%M-%Y') < DATE_SUB(CURRENT_DATE, INTERVAL 3 MONTH)
  `, [employeeId]);
  
  if (defaults.count > 0) {
    return {
      eligible: false,
      reason: 'Previous loan defaults detected',
      max_loan: 0
    };
  }
  
  // Calculate maximum loan based on tenure
  let multiplier = 2; // Base: 2× salary
  if (tenureMonths >= 12) multiplier = 3; // 1 year: 3× salary
  if (tenureMonths >= 24) multiplier = 4; // 2 years: 4× salary
  if (tenureMonths >= 36) multiplier = 5; // 3 years: 5× salary
  
  const maxLoan = employee.current_salary * multiplier;
  
  // Check EMI affordability (EMI ≤ 40% of salary)
  const maxEMI = employee.current_salary * 0.4;
  
  return {
    eligible: true,
    max_loan: maxLoan,
    max_emi: maxEMI,
    multiplier,
    tenure_months: tenureMonths
  };
}

async function calculateLoanTerms(principal, interestRate, emiCount) {
  // Simple interest calculation
  const totalInterest = principal * (interestRate / 100);
  const totalAmount = principal + totalInterest;
  const emiAmount = Math.round((totalAmount / emiCount) * 100) / 100;
  
  return {
    loan_amount: principal,
    interest_rate: interestRate,
    number_of_emis: emiCount,
    total_interest: totalInterest,
    total_amount: totalAmount,
    emi_amount: emiAmount
  };
}
```

**Business Rules**:
- Minimum tenure: 6 months
- Maximum loan by tenure:
  - 6-11 months: 2× monthly salary
  - 12-23 months: 3× monthly salary
  - 24-35 months: 4× monthly salary
  - 36+ months: 5× monthly salary
- EMI ≤ 40% of monthly salary
- No multiple active loans
- No loan if previous defaults exist
- Employment status must be 'active'

---

#### 6.2.3 Loan Approval & Sanction

**Rule**: Multi-level approval with terms negotiation

**Approval Workflow**:
```javascript
async function approveLoan(loanId, approvedBy, approvalData) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  if (loan.status !== 'requested') {
    throw new Error('Loan is not in requested status');
  }
  
  // Authorization check
  const approver = await db.query(`
    SELECT role FROM users WHERE id = ?
  `, [approvedBy]);
  
  const canApprove = 
    (loan.requested_amount <= 50000 && approver.role === 'hr_manager') ||
    (loan.requested_amount <= 200000 && approver.role === 'director') ||
    (loan.requested_amount > 200000 && approver.role === 'ceo');
  
  if (!canApprove) {
    throw new Error('Insufficient authorization for this loan amount');
  }
  
  // Approved amount and terms
  const approvedAmount = approvalData.approved_amount || loan.requested_amount;
  const interestRate = approvalData.interest_rate || loan.interest_rate;
  const numberOfEmis = approvalData.number_of_emis || loan.number_of_emis;
  
  if (approvedAmount > loan.requested_amount) {
    throw new Error('Approved amount cannot exceed requested amount');
  }
  
  // Calculate EMI terms
  const terms = await calculateLoanTerms(approvedAmount, interestRate, numberOfEmis);
  
  // Calculate end date
  const startDate = new Date(`${loan.start_month} 1, ${loan.start_year}`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + numberOfEmis - 1);
  
  // Update loan
  await db.query(`
    UPDATE loan_records
    SET status = 'approved',
        approved_amount = ?,
        loan_amount = ?,
        interest_rate = ?,
        number_of_emis = ?,
        emi_amount = ?,
        total_interest = ?,
        total_amount = ?,
        remaining_balance = ?,
        remaining_emis = ?,
        end_month = ?,
        end_year = ?,
        approved_by = ?,
        approval_date = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    approvedAmount, approvedAmount, interestRate, numberOfEmis,
    terms.emi_amount, terms.total_interest, terms.total_amount,
    terms.total_amount, numberOfEmis,
    endDate.toLocaleString('default', { month: 'long' }), endDate.getFullYear(),
    approvedBy, loanId
  ]);
  
  // Notify employee
  await sendNotification({
    user_id: loan.employee_id,
    type: 'loan_approved',
    title: 'Loan Approved',
    message: `Your loan of ₹${approvedAmount} has been approved. EMI: ₹${terms.emi_amount} for ${numberOfEmis} months.`,
    priority: 'high'
  });
  
  return { success: true, terms };
}

async function rejectLoan(loanId, rejectedBy, reason) {
  await db.query(`
    UPDATE loan_records
    SET status = 'rejected',
        approved_by = ?,
        approval_date = CURRENT_TIMESTAMP,
        rejection_reason = ?
    WHERE id = ?
  `, [rejectedBy, reason, loanId]);
  
  const loan = await db.query(`
    SELECT employee_id, requested_amount FROM loan_records WHERE id = ?
  `, [loanId]);
  
  await sendNotification({
    user_id: loan.employee_id,
    type: 'loan_rejected',
    title: 'Loan Request Rejected',
    message: `Your loan request of ₹${loan.requested_amount} has been rejected. Reason: ${reason}`,
    priority: 'medium'
  });
  
  return { success: true };
}
```

**Business Rules**:
- Approval authority by amount:
  - ≤ ₹50,000: HR Manager
  - ≤ ₹2,00,000: Director
  - > ₹2,00,000: CEO
- Can modify terms during approval (amount, rate, tenure)
- Approved amount ≤ requested amount
- Calculate total interest and EMI
- Auto-calculate loan end date
- Notify employee with EMI details
- Require rejection reason

---

#### 6.2.4 Loan Disbursement & EMI Schedule Generation

**Rule**: Disburse loan and create complete EMI schedule

**Disbursement**:
```javascript
async function disburseLoan(loanId, disbursementDetails, disbursedBy) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  if (loan.status !== 'approved') {
    throw new Error('Loan must be approved before disbursement');
  }
  
  // Get employee bank details
  const employee = await db.query(`
    SELECT bank_name, bank_account_number, ifsc_code
    FROM employees WHERE employee_id = ?
  `, [loan.employee_id]);
  
  // Update loan status
  await db.query(`
    UPDATE loan_records
    SET status = 'active',
        disbursement_date = ?,
        disbursement_method = ?,
        disbursement_reference = ?,
        disbursed_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    disbursementDetails.disbursement_date || new Date(),
    disbursementDetails.disbursement_method || 'bank_transfer',
    disbursementDetails.disbursement_reference,
    disbursedBy,
    loanId
  ]);
  
  // Generate EMI schedule
  await generateEMISchedule(loanId);
  
  // Create payment transaction
  await db.query(`
    INSERT INTO payment_transactions (
      transaction_type, reference_id, reference_number,
      employee_id, amount, payment_date, payment_method, payment_reference,
      processed_by
    ) VALUES ('loan_disbursement', ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    loanId, loan.loan_number, loan.employee_id, loan.loan_amount,
    disbursementDetails.disbursement_date, disbursementDetails.disbursement_method,
    disbursementDetails.disbursement_reference, disbursedBy
  ]);
  
  // Notify employee
  await sendNotification({
    user_id: loan.employee_id,
    type: 'loan_disbursed',
    title: 'Loan Disbursed',
    message: `Your loan of ₹${loan.loan_amount} has been credited. First EMI: ${loan.start_month} ${loan.start_year}`,
    priority: 'high'
  });
  
  return { success: true };
}

async function generateEMISchedule(loanId) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  const startDate = new Date(`${loan.start_month} 1, ${loan.start_year}`);
  let outstandingBalance = loan.total_amount;
  
  const emis = [];
  for (let i = 1; i <= loan.number_of_emis; i++) {
    const emiDate = new Date(startDate);
    emiDate.setMonth(emiDate.getMonth() + (i - 1));
    
    // Calculate principal and interest components (simple interest, equal EMI)
    const interestComponent = (loan.total_interest / loan.number_of_emis);
    const principalComponent = loan.emi_amount - interestComponent;
    outstandingBalance -= loan.emi_amount;
    
    emis.push([
      loanId,
      i, // EMI number
      emiDate.toLocaleString('default', { month: 'long' }),
      emiDate.getFullYear(),
      loan.emi_amount,
      principalComponent,
      interestComponent,
      Math.max(0, outstandingBalance),
      'pending'
    ]);
  }
  
  // Bulk insert EMIs
  await db.query(`
    INSERT INTO loan_emis (
      loan_id, emi_number, month, year, emi_amount,
      principal_component, interest_component, outstanding_balance, status
    ) VALUES ?
  `, [emis]);
  
  return { generated: emis.length };
}
```

**Business Rules**:
- Disburse only approved loans
- Generate complete EMI schedule on disbursement
- EMI schedule: one record per month
- Calculate principal and interest components per EMI
- Track outstanding balance after each EMI
- Record disbursement method and reference
- Create payment transaction record
- Status changes: approved → active
- First EMI due date = start_month/start_year

---

#### 6.2.5 EMI Deduction & Recovery Automation

**Rule**: Auto-deduct EMIs from monthly salary during payroll

**EMI Processing**:
```javascript
async function processLoanEMIs(payRunId, month, year) {
  // Get all EMIs due this month
  const dueEMIs = await db.query(`
    SELECT le.*, lr.employee_id, lr.loan_number
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.month = ? AND le.year = ?
      AND le.status = 'pending'
      AND lr.status = 'active'
  `, [month, year]);
  
  const deductions = [];
  
  for (const emi of dueEMIs) {
    // Mark EMI as paid
    await db.query(`
      UPDATE loan_emis
      SET status = 'paid',
          paid_date = CURRENT_DATE,
          deducted_from_payrun = ?
      WHERE id = ?
    `, [payRunId, emi.id]);
    
    // Update loan record
    await db.query(`
      UPDATE loan_records
      SET total_paid_emis = total_paid_emis + 1,
          total_paid_amount = total_paid_amount + ?,
          remaining_balance = remaining_balance - ?,
          remaining_emis = remaining_emis - 1
      WHERE id = ?
    `, [emi.emi_amount, emi.emi_amount, emi.loan_id]);
    
    // Check if loan is completed
    const loan = await db.query(`
      SELECT remaining_emis FROM loan_records WHERE id = ?
    `, [emi.loan_id]);
    
    if (loan.remaining_emis === 0) {
      await db.query(`
        UPDATE loan_records
        SET status = 'completed',
            remaining_balance = 0
        WHERE id = ?
      `, [emi.loan_id]);
      
      // Notify employee
      await sendNotification({
        user_id: emi.employee_id,
        type: 'loan_completed',
        title: 'Loan Fully Repaid',
        message: `Your loan ${emi.loan_number} has been fully repaid. Congratulations!`,
        priority: 'high'
      });
    }
    
    // Add to payroll deductions
    await db.query(`
      UPDATE pay_run_employee_records
      SET loan_deduction = loan_deduction + ?
      WHERE pay_run_id = ? AND employee_id = ?
    `, [emi.emi_amount, payRunId, emi.employee_id]);
    
    deductions.push({
      loan_id: emi.loan_id,
      loan_number: emi.loan_number,
      employee_id: emi.employee_id,
      emi_number: emi.emi_number,
      emi_amount: emi.emi_amount,
      remaining_balance: loan.remaining_balance - emi.emi_amount
    });
  }
  
  return deductions;
}

async function getUpcomingEMIs(employeeId) {
  return await db.query(`
    SELECT 
      lr.loan_number, lr.loan_amount, lr.emi_amount,
      le.emi_number, le.month, le.year, le.status,
      le.outstanding_balance
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE lr.employee_id = ? AND lr.status = 'active'
    ORDER BY le.year, FIELD(le.month, 'January','February','March','April',
      'May','June','July','August','September','October','November','December')
  `, [employeeId]);
}
```

**Business Rules**:
- Auto-deduct EMI during pay run processing
- Mark EMI as 'paid' and record paid_date
- Update loan: total_paid_emis, total_paid_amount, remaining_balance, remaining_emis
- When remaining_emis = 0, status → 'completed'
- Add to pay_run_employee_records.loan_deduction
- Link EMI to pay run (deducted_from_payrun)
- Notify employee on loan completion
- Handle missed EMIs (track defaults)

---

#### 6.2.6 Prepayment & Foreclosure

**Rule**: Allow early loan closure with foreclosure charges

**Prepayment**:
```javascript
async function prepayLoan(loanId, prepaymentAmount, prepaidBy) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  if (loan.status !== 'active') {
    throw new Error('Only active loans can be prepaid');
  }
  
  if (!loan.prepayment_allowed) {
    throw new Error('Prepayment not allowed for this loan');
  }
  
  if (prepaymentAmount > loan.remaining_balance) {
    throw new Error('Prepayment amount exceeds remaining balance');
  }
  
  // Adjust remaining balance
  const newRemainingBalance = loan.remaining_balance - prepaymentAmount;
  
  // Recalculate EMI count
  const remainingEMICount = Math.ceil(newRemainingBalance / loan.emi_amount);
  
  await db.query(`
    UPDATE loan_records
    SET total_paid_amount = total_paid_amount + ?,
        remaining_balance = ?,
        remaining_emis = ?,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    prepaymentAmount,
    newRemainingBalance,
    remainingEMICount,
    `Prepayment: ₹${prepaymentAmount} on ${new Date().toISOString()} by ${prepaidBy}`,
    loanId
  ]);
  
  // Cancel excess EMIs
  await db.query(`
    UPDATE loan_emis
    SET status = 'waived'
    WHERE loan_id = ? AND emi_number > ?
  `, [loanId, loan.total_paid_emis + remainingEMICount]);
  
  return { success: true, new_remaining_balance: newRemainingBalance };
}

async function forecloseLoan(loanId, foreclosedBy) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  if (loan.status !== 'active') {
    throw new Error('Only active loans can be foreclosed');
  }
  
  // Calculate foreclosure charges
  const foreclosureCharges = loan.remaining_balance * (loan.foreclosure_charges_percent / 100);
  const totalForeclosureAmount = loan.remaining_balance + foreclosureCharges;
  
  await db.query(`
    UPDATE loan_records
    SET status = 'foreclosed',
        foreclosure_date = CURRENT_DATE,
        foreclosure_amount = ?,
        total_paid_amount = total_paid_amount + ?,
        remaining_balance = 0,
        remaining_emis = 0,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    totalForeclosureAmount,
    totalForeclosureAmount,
    `Foreclosed on ${new Date().toISOString()}. Foreclosure charges: ₹${foreclosureCharges} (${loan.foreclosure_charges_percent}%)`,
    loanId
  ]);
  
  // Mark all pending EMIs as waived
  await db.query(`
    UPDATE loan_emis
    SET status = 'waived'
    WHERE loan_id = ? AND status = 'pending'
  `, [loanId]);
  
  // Notify employee
  await sendNotification({
    user_id: loan.employee_id,
    type: 'loan_foreclosed',
    title: 'Loan Foreclosed',
    message: `Your loan has been foreclosed. Amount paid: ₹${totalForeclosureAmount} (incl. charges ₹${foreclosureCharges})`,
    priority: 'high'
  });
  
  return {
    success: true,
    foreclosure_amount: totalForeclosureAmount,
    foreclosure_charges: foreclosureCharges
  };
}
```

**Business Rules**:
- Allow partial prepayment (reduces EMI count)
- Foreclosure = full outstanding + charges
- Default foreclosure charges: 2% of outstanding
- Prepayment allowed: configurable per loan
- Waive remaining EMIs on foreclosure
- Record foreclosure date and amount
- Status changes: active → foreclosed
- Notify employee of charges

---

#### 6.2.7 Loan History & Employee Dashboard

**Rule**: Comprehensive loan tracking and employee self-service

**Employee Dashboard**:
```javascript
async function getEmployeeLoanDashboard(employeeId) {
  // Current active loan
  const activeLoan = await db.query(`
    SELECT 
      loan_number, loan_type, loan_amount, interest_rate,
      number_of_emis, emi_amount, total_amount,
      start_month, start_year, end_month, end_year,
      total_paid_emis, total_paid_amount,
      remaining_balance, remaining_emis,
      disbursement_date, status
    FROM loan_records
    WHERE employee_id = ? AND status = 'active'
  `, [employeeId]);
  
  // Upcoming EMIs (next 3 months)
  const upcomingEMIs = await getUpcomingEMIs(employeeId);
  
  // Loan history
  const history = await db.query(`
    SELECT 
      loan_number, loan_type, loan_amount, emi_amount,
      number_of_emis, total_paid_emis, status,
      disbursement_date, request_date
    FROM loan_records
    WHERE employee_id = ?
    ORDER BY request_date DESC
  `, [employeeId]);
  
  // Eligibility for new loan
  const eligibility = await checkLoanEligibility(employeeId);
  
  // Total interest paid (lifetime)
  const lifetimeStats = await db.query(`
    SELECT 
      SUM(loan_amount) as total_borrowed,
      SUM(total_paid_amount) as total_repaid,
      SUM(total_interest) as total_interest_paid
    FROM loan_records
    WHERE employee_id = ? AND status IN ('completed', 'foreclosed')
  `, [employeeId]);
  
  return {
    active_loan: activeLoan,
    upcoming_emis: upcomingEMIs.slice(0, 3),
    history,
    eligibility,
    lifetime_stats: lifetimeStats || {}
  };
}

async function getLoanStatement(loanId) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  const emis = await db.query(`
    SELECT * FROM loan_emis
    WHERE loan_id = ?
    ORDER BY emi_number
  `, [loanId]);
  
  return {
    loan_details: loan,
    emi_schedule: emis,
    summary: {
      total_emis: loan.number_of_emis,
      paid_emis: loan.total_paid_emis,
      pending_emis: loan.remaining_emis,
      total_paid: loan.total_paid_amount,
      remaining: loan.remaining_balance,
      total_interest: loan.total_interest
    }
  };
}
```

**Business Rules**:
- Show active loan with remaining balance
- Display upcoming EMIs (next 3 months)
- Track complete loan history
- Calculate lifetime interest paid
- Show eligibility for new loan
- Provide downloadable loan statement
- Display EMI schedule with status
- Calculate total borrowed vs repaid

---

#### 6.2.8 Loan Analytics & Reporting

**Rule**: Monitor loan portfolio and trends

**Analytics**:
```javascript
async function getLoanPortfolioAnalytics(filters = {}) {
  let query = `
    SELECT 
      COUNT(*) as total_loans,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_loans,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_loans,
      SUM(loan_amount) as total_disbursed,
      SUM(total_paid_amount) as total_recovered,
      SUM(remaining_balance) as total_outstanding,
      AVG(interest_rate) as avg_interest_rate,
      AVG(number_of_emis) as avg_tenure
    FROM loan_records
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filters.year) {
    query += ` AND YEAR(disbursement_date) = ?`;
    params.push(filters.year);
  }
  
  if (filters.department) {
    query += ` AND department = ?`;
    params.push(filters.department);
  }
  
  if (filters.loan_type) {
    query += ` AND loan_type = ?`;
    params.push(filters.loan_type);
  }
  
  return await db.query(query, params);
}

async function getLoanDefaultReport() {
  return await db.query(`
    SELECT 
      lr.loan_number, lr.employee_id, lr.employee_name, lr.department,
      le.emi_number, le.month, le.year, le.emi_amount,
      DATEDIFF(CURRENT_DATE, STR_TO_DATE(CONCAT('01-', le.month, '-', le.year), '%d-%M-%Y')) as days_overdue
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.status = 'pending'
      AND STR_TO_DATE(CONCAT('01-', le.month, '-', le.year), '%d-%M-%Y') < CURRENT_DATE
    ORDER BY days_overdue DESC
  `);
}

async function getDepartmentLoanSummary() {
  return await db.query(`
    SELECT 
      department,
      COUNT(DISTINCT employee_id) as employee_count,
      COUNT(*) as loan_count,
      SUM(loan_amount) as total_disbursed,
      SUM(remaining_balance) as total_outstanding,
      AVG(emi_amount) as avg_emi
    FROM loan_records
    WHERE status = 'active'
    GROUP BY department
    ORDER BY total_outstanding DESC
  `);
}
```

**Business Rules**:
- Track active vs completed loans
- Monitor total outstanding portfolio
- Calculate recovery rate
- Identify loan defaults (overdue EMIs)
- Department-wise loan distribution
- Track average loan amount and tenure
- Alert on high default rates
- Monthly loan disbursement trends

---

#### 6.2.9 Loan Cancellation & Write-offs

**Rule**: Handle loan cancellations and bad debt write-offs

**Cancellation & Write-offs**:
```javascript
async function cancelLoan(loanId, cancelledBy, reason) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  // Can cancel only before disbursement
  if (loan.status === 'active' || loan.status === 'completed') {
    throw new Error('Cannot cancel disbursed loans. Use foreclosure instead.');
  }
  
  await db.query(`
    UPDATE loan_records
    SET status = 'cancelled',
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    `Cancelled on ${new Date().toISOString()} by ${cancelledBy}. Reason: ${reason}`,
    loanId
  ]);
  
  // Delete EMI schedule if generated
  await db.query(`
    DELETE FROM loan_emis WHERE loan_id = ?
  `, [loanId]);
  
  await sendNotification({
    user_id: loan.employee_id,
    type: 'loan_cancelled',
    title: 'Loan Request Cancelled',
    message: `Your loan request ${loan.loan_number} has been cancelled.`,
    priority: 'medium'
  });
  
  return { success: true };
}

async function writeOffLoan(loanId, writtenOffBy, reason) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  // Require director approval
  const approver = await db.query(`
    SELECT role FROM users WHERE id = ?
  `, [writtenOffBy]);
  
  if (approver.role !== 'director' && approver.role !== 'ceo') {
    throw new Error('Only directors/CEO can write off loans');
  }
  
  await db.query(`
    UPDATE loan_records
    SET status = 'written_off',
        remaining_balance = 0,
        remaining_emis = 0,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    `Written off: ₹${loan.remaining_balance} on ${new Date().toISOString()} by ${writtenOffBy}. Reason: ${reason}`,
    loanId
  ]);
  
  // Mark all pending EMIs as waived
  await db.query(`
    UPDATE loan_emis
    SET status = 'waived'
    WHERE loan_id = ? AND status = 'pending'
  `, [loanId]);
  
  // Create write-off record for accounting
  await db.query(`
    INSERT INTO loan_writeoffs (
      loan_id, loan_number, employee_id,
      written_off_amount, reason, approved_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [loanId, loan.loan_number, loan.employee_id, loan.remaining_balance, reason, writtenOffBy]);
  
  return {
    success: true,
    written_off_amount: loan.remaining_balance
  };
}
```

**Business Rules**:
- Cancel only 'requested' or 'approved' loans (before disbursement)
- Cannot cancel active/completed loans (use foreclosure)
- Write-off requires director/CEO approval
- Write-off = bad debt (no recovery expected)
- Mark all pending EMIs as 'waived'
- Create separate write-off record for accounting
- Store detailed reason and approver
- Update audit trail

---

#### 6.2.10 Notifications & Compliance

**Rule**: Automated notifications and audit compliance

**Notifications**:
```javascript
async function sendLoanNotifications() {
  // 1. Upcoming EMI reminders (5 days before)
  const upcomingEMIs = await db.query(`
    SELECT 
      lr.employee_id, e.email, lr.loan_number,
      le.emi_amount, le.month, le.year
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    JOIN employees e ON lr.employee_id = e.employee_id
    WHERE le.status = 'pending'
      AND STR_TO_DATE(CONCAT('01-', le.month, '-', le.year), '%d-%M-%Y')
        BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY)
  `);
  
  for (const emi of upcomingEMIs) {
    await sendEmail({
      to: emi.email,
      subject: `EMI Reminder - ₹${emi.emi_amount}`,
      html: `
        <p>This is a reminder that your EMI of ₹${emi.emi_amount} for loan ${emi.loan_number} will be deducted from your ${emi.month} ${emi.year} salary.</p>
      `
    });
  }
  
  // 2. Overdue EMI alerts
  const overdueEMIs = await db.query(`
    SELECT 
      lr.employee_id, e.email, lr.loan_number,
      le.emi_number, le.emi_amount, le.month, le.year,
      DATEDIFF(CURRENT_DATE, STR_TO_DATE(CONCAT('01-', le.month, '-', le.year), '%d-%M-%Y')) as days_overdue
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    JOIN employees e ON lr.employee_id = e.employee_id
    WHERE le.status = 'pending'
      AND STR_TO_DATE(CONCAT('01-', le.month, '-', le.year), '%d-%M-%Y') < CURRENT_DATE
  `);
  
  for (const emi of overdueEMIs) {
    await sendEmail({
      to: 'hr@company.com',
      subject: `Overdue EMI Alert - ${emi.loan_number}`,
      html: `
        <p>Employee ${emi.employee_id} has an overdue EMI of ₹${emi.emi_amount} for ${emi.days_overdue} days.</p>
        <p>Loan: ${emi.loan_number}</p>
        <p>EMI #${emi.emi_number} for ${emi.month} ${emi.year}</p>
      `
    });
  }
  
  return {
    emi_reminders: upcomingEMIs.length,
    overdue_alerts: overdueEMIs.length
  };
}

async function generateLoanComplianceReport(startDate, endDate) {
  return await db.query(`
    SELECT 
      lr.loan_number, lr.employee_id, lr.employee_name, lr.department,
      lr.loan_amount, lr.interest_rate, lr.number_of_emis, lr.emi_amount,
      lr.disbursement_date, lr.status,
      lr.total_paid_emis, lr.total_paid_amount, lr.remaining_balance,
      CONCAT(u1.first_name, ' ', u1.last_name) as approved_by_name,
      lr.approval_date,
      CONCAT(u2.first_name, ' ', u2.last_name) as disbursed_by_name,
      lr.remarks
    FROM loan_records lr
    LEFT JOIN users u1 ON lr.approved_by = u1.id
    LEFT JOIN users u2 ON lr.disbursed_by = u2.id
    WHERE lr.disbursement_date BETWEEN ? AND ?
    ORDER BY lr.disbursement_date DESC
  `, [startDate, endDate]);
}
```

**Business Rules**:
- Send EMI reminder 5 days before deduction
- Alert HR on overdue EMIs
- Notify employee on loan approval/rejection
- Notify on disbursement
- Notify on loan completion
- Send monthly loan statement to employee
- Weekly digest to HR (pending approvals, overdues)
- Maintain complete audit trail
- Generate compliance reports for audits
- Track all approvers and disbursement officers

---

### 6.3 LoanEMI Management
**Rule**: Manage individual EMI installments with precise tracking, payment processing, and exception handling

**Purpose**: Track each EMI installment separately for granular control, support EMI-level status updates, enable partial payments and deferrals, maintain complete payment history, calculate principal and interest components per EMI, handle missed payments and penalties, support EMI rescheduling, and provide detailed repayment analytics.

---

#### 6.3.1 EMI Record Structure & Generation

**Rule**: Create detailed EMI schedule with principal/interest breakdown

**LoanEMI Schema**:
```javascript
const LOAN_EMI_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  loan_id: 'UUID FOREIGN KEY NOT NULL',
  emi_number: 'INT NOT NULL', // Sequence: 1, 2, 3...
  
  // Due date
  month: 'VARCHAR(20) NOT NULL', // 'January', 'February', etc.
  year: 'INT NOT NULL',
  due_date: 'DATE NOT NULL', // Actual due date (1st of month)
  
  // EMI breakdown
  emi_amount: 'DECIMAL(12,2) NOT NULL',
  principal_component: 'DECIMAL(12,2) NOT NULL', // Principal portion
  interest_component: 'DECIMAL(12,2) NOT NULL', // Interest portion
  outstanding_balance: 'DECIMAL(12,2) NOT NULL', // Balance after this EMI
  
  // Payment tracking
  status: 'ENUM NOT NULL', // 'pending', 'paid', 'overdue', 'deferred', 'waived', 'partial'
  paid_amount: 'DECIMAL(12,2) DEFAULT 0', // Actual paid (for partial payments)
  paid_date: 'DATE',
  payment_mode: 'ENUM', // 'salary_deduction', 'cash', 'bank_transfer', 'adjustment'
  deducted_from_payrun: 'VARCHAR(50)', // Pay run reference
  
  // Late payment tracking
  days_overdue: 'INT DEFAULT 0',
  penalty_amount: 'DECIMAL(12,2) DEFAULT 0',
  penalty_paid: 'DECIMAL(12,2) DEFAULT 0',
  
  // Deferment
  is_deferred: 'BOOLEAN DEFAULT false',
  deferment_reason: 'TEXT',
  deferred_to_month: 'VARCHAR(20)',
  deferred_to_year: 'INT',
  deferred_by: 'UUID FOREIGN KEY',
  deferment_date: 'TIMESTAMP',
  
  // Audit
  remarks: 'TEXT',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP',
  
  UNIQUE: '(loan_id, emi_number)'
};
```

**EMI Schedule Generation** (Enhanced):
```javascript
async function generateDetailedEMISchedule(loanId) {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  const startDate = new Date(`${loan.start_month} 1, ${loan.start_year}`);
  let outstandingBalance = loan.total_amount;
  
  // Calculate per-EMI interest and principal using reducing balance method
  const monthlyInterestRate = loan.interest_rate / 12 / 100;
  const emiAmount = loan.emi_amount;
  
  const emis = [];
  for (let i = 1; i <= loan.number_of_emis; i++) {
    const emiDate = new Date(startDate);
    emiDate.setMonth(emiDate.getMonth() + (i - 1));
    
    // Calculate interest and principal components
    const interestComponent = outstandingBalance * monthlyInterestRate;
    const principalComponent = emiAmount - interestComponent;
    
    // Update outstanding balance
    outstandingBalance -= principalComponent;
    
    // Ensure last EMI clears any rounding differences
    if (i === loan.number_of_emis && outstandingBalance !== 0) {
      outstandingBalance = 0;
    }
    
    emis.push([
      loanId,
      i, // EMI number
      emiDate.toLocaleString('default', { month: 'long' }),
      emiDate.getFullYear(),
      emiDate, // due_date
      emiAmount,
      Math.round(principalComponent * 100) / 100,
      Math.round(interestComponent * 100) / 100,
      Math.max(0, Math.round(outstandingBalance * 100) / 100),
      'pending',
      0 // paid_amount
    ]);
  }
  
  // Bulk insert EMIs
  await db.query(`
    INSERT INTO loan_emis (
      loan_id, emi_number, month, year, due_date,
      emi_amount, principal_component, interest_component,
      outstanding_balance, status, paid_amount
    ) VALUES ?
  `, [emis]);
  
  return { generated: emis.length };
}

async function recalculateEMISchedule(loanId, fromEmiNumber) {
  // Used after prepayment or restructuring
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  const paidEmis = await db.query(`
    SELECT * FROM loan_emis
    WHERE loan_id = ? AND emi_number < ? AND status = 'paid'
    ORDER BY emi_number
  `, [loanId, fromEmiNumber]);
  
  // Calculate remaining balance after last paid EMI
  let outstandingBalance = loan.remaining_balance;
  
  // Get pending EMIs
  const pendingEmis = await db.query(`
    SELECT * FROM loan_emis
    WHERE loan_id = ? AND emi_number >= ?
    ORDER BY emi_number
  `, [loanId, fromEmiNumber]);
  
  const monthlyInterestRate = loan.interest_rate / 12 / 100;
  const emiAmount = loan.emi_amount;
  
  // Recalculate each pending EMI
  for (const emi of pendingEmis) {
    const interestComponent = outstandingBalance * monthlyInterestRate;
    const principalComponent = emiAmount - interestComponent;
    outstandingBalance -= principalComponent;
    
    await db.query(`
      UPDATE loan_emis
      SET principal_component = ?,
          interest_component = ?,
          outstanding_balance = ?
      WHERE id = ?
    `, [
      Math.round(principalComponent * 100) / 100,
      Math.round(interestComponent * 100) / 100,
      Math.max(0, Math.round(outstandingBalance * 100) / 100),
      emi.id
    ]);
  }
  
  return { recalculated: pendingEmis.length };
}
```

**Business Rules**:
- One EMI record per installment
- Unique constraint: (loan_id, emi_number)
- Calculate principal and interest per EMI (reducing balance)
- Interest component decreases over time
- Principal component increases over time
- Due date: 1st of each month
- Outstanding balance after each EMI
- Support EMI recalculation after prepayment

---

#### 6.3.2 EMI Payment Processing & Salary Deduction

**Rule**: Process EMI payments during payroll with complete tracking

**Payment Processing**:
```javascript
async function processEMIPayment(emiId, payRunId, paymentDetails = {}) {
  const emi = await db.query(`
    SELECT le.*, lr.employee_id, lr.loan_number, lr.loan_amount
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.id = ?
  `, [emiId]);
  
  if (emi.status === 'paid') {
    throw new Error('EMI already paid');
  }
  
  const paymentAmount = paymentDetails.amount || emi.emi_amount;
  const paymentMode = paymentDetails.payment_mode || 'salary_deduction';
  
  // Check if partial payment
  let newStatus = 'paid';
  if (paymentAmount < emi.emi_amount) {
    newStatus = 'partial';
  }
  
  // Calculate days overdue
  const daysOverdue = Math.max(0, Math.floor(
    (new Date() - new Date(emi.due_date)) / (1000 * 60 * 60 * 24)
  ));
  
  // Calculate penalty for overdue (1% per month overdue)
  let penaltyAmount = 0;
  if (daysOverdue > 30) {
    const monthsOverdue = Math.floor(daysOverdue / 30);
    penaltyAmount = emi.emi_amount * 0.01 * monthsOverdue;
  }
  
  // Update EMI
  await db.query(`
    UPDATE loan_emis
    SET status = ?,
        paid_amount = paid_amount + ?,
        paid_date = CURRENT_DATE,
        payment_mode = ?,
        deducted_from_payrun = ?,
        days_overdue = ?,
        penalty_amount = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    newStatus,
    paymentAmount,
    paymentMode,
    payRunId,
    daysOverdue,
    penaltyAmount,
    emiId
  ]);
  
  // Update loan record
  await db.query(`
    UPDATE loan_records
    SET total_paid_emis = total_paid_emis + ?,
        total_paid_amount = total_paid_amount + ?,
        remaining_balance = remaining_balance - ?,
        remaining_emis = remaining_emis - ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    newStatus === 'paid' ? 1 : 0,
    paymentAmount,
    paymentAmount,
    newStatus === 'paid' ? 1 : 0,
    emi.loan_id
  ]);
  
  // Check if loan is completed
  const loan = await db.query(`
    SELECT remaining_emis FROM loan_records WHERE id = ?
  `, [emi.loan_id]);
  
  if (loan.remaining_emis === 0) {
    await db.query(`
      UPDATE loan_records
      SET status = 'completed', remaining_balance = 0
      WHERE id = ?
    `, [emi.loan_id]);
    
    await sendNotification({
      user_id: emi.employee_id,
      type: 'loan_completed',
      title: 'Loan Fully Repaid',
      message: `Your loan ${emi.loan_number} has been fully repaid!`,
      priority: 'high'
    });
  }
  
  return {
    success: true,
    paid_amount: paymentAmount,
    penalty_amount: penaltyAmount,
    status: newStatus
  };
}

async function bulkProcessEMIsForPayRun(payRunId, month, year) {
  const dueEMIs = await db.query(`
    SELECT le.id, le.emi_amount, lr.employee_id
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.month = ? AND le.year = ?
      AND le.status IN ('pending', 'overdue')
      AND lr.status = 'active'
  `, [month, year]);
  
  const results = [];
  for (const emi of dueEMIs) {
    try {
      const result = await processEMIPayment(emi.id, payRunId);
      results.push({ emiId: emi.id, success: true, ...result });
      
      // Add to payroll deductions
      await db.query(`
        UPDATE pay_run_employee_records
        SET loan_deduction = loan_deduction + ?
        WHERE pay_run_id = ? AND employee_id = ?
      `, [emi.emi_amount, payRunId, emi.employee_id]);
    } catch (error) {
      results.push({ emiId: emi.id, success: false, error: error.message });
    }
  }
  
  return results;
}
```

**Business Rules**:
- Process EMIs during payroll (auto-deduction)
- Mark as 'paid' and record paid_date
- Track payment mode (salary_deduction, cash, bank_transfer)
- Calculate days overdue if past due_date
- Apply penalty: 1% per month overdue
- Support partial payments (status = 'partial')
- Update loan: total_paid_emis, total_paid_amount, remaining_balance
- Complete loan when remaining_emis = 0
- Link EMI to pay run reference

---

#### 6.3.3 Overdue EMI Tracking & Penalties

**Rule**: Monitor overdue EMIs and apply late payment charges

**Overdue Management**:
```javascript
async function updateOverdueEMIs() {
  // Mark EMIs as overdue if past due date
  await db.query(`
    UPDATE loan_emis
    SET status = 'overdue',
        days_overdue = DATEDIFF(CURRENT_DATE, due_date)
    WHERE status = 'pending'
      AND due_date < CURRENT_DATE
  `);
  
  // Calculate penalties for overdue EMIs
  const overdueEMIs = await db.query(`
    SELECT * FROM loan_emis
    WHERE status = 'overdue' AND penalty_amount = 0
  `);
  
  for (const emi of overdueEMIs) {
    const monthsOverdue = Math.floor(emi.days_overdue / 30);
    if (monthsOverdue > 0) {
      const penaltyAmount = emi.emi_amount * 0.01 * monthsOverdue;
      
      await db.query(`
        UPDATE loan_emis
        SET penalty_amount = ?
        WHERE id = ?
      `, [penaltyAmount, emi.id]);
    }
  }
  
  return { updated: overdueEMIs.length };
}

async function getOverdueEMIReport() {
  return await db.query(`
    SELECT 
      lr.loan_number,
      lr.employee_id,
      lr.employee_name,
      lr.department,
      le.emi_number,
      le.month,
      le.year,
      le.emi_amount,
      le.paid_amount,
      le.days_overdue,
      le.penalty_amount,
      le.status
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.status IN ('overdue', 'partial')
    ORDER BY le.days_overdue DESC, lr.employee_id
  `);
}

async function calculateTotalPenalty(loanId) {
  const result = await db.query(`
    SELECT 
      SUM(penalty_amount) as total_penalty,
      SUM(penalty_paid) as total_penalty_paid,
      SUM(penalty_amount - penalty_paid) as outstanding_penalty
    FROM loan_emis
    WHERE loan_id = ?
  `, [loanId]);
  
  return result || { total_penalty: 0, total_penalty_paid: 0, outstanding_penalty: 0 };
}
```

**Business Rules**:
- Auto-mark as 'overdue' if past due_date
- Calculate days_overdue daily
- Penalty: 1% of EMI amount per month overdue
- Track penalty_amount separately
- Support penalty payment (penalty_paid)
- Generate overdue reports for HR
- Alert employee and manager on overdue EMIs
- Escalate after 90 days overdue

---

#### 6.3.4 EMI Deferment & Rescheduling

**Rule**: Allow EMI deferment for genuine hardship cases

**Deferment**:
```javascript
async function deferEMI(emiId, defermentData, deferredBy) {
  const emi = await db.query(`
    SELECT le.*, lr.status as loan_status
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.id = ?
  `, [emiId]);
  
  if (emi.status !== 'pending' && emi.status !== 'overdue') {
    throw new Error('Can only defer pending or overdue EMIs');
  }
  
  if (emi.loan_status !== 'active') {
    throw new Error('Can only defer EMIs of active loans');
  }
  
  // Require manager/HR approval
  const approver = await db.query(`
    SELECT role FROM users WHERE id = ?
  `, [deferredBy]);
  
  if (approver.role !== 'hr_manager' && approver.role !== 'director') {
    throw new Error('Only HR Manager or Director can approve EMI deferment');
  }
  
  // Calculate new due date
  const deferToDate = new Date(defermentData.deferred_to_month + ' 1, ' + defermentData.deferred_to_year);
  
  await db.query(`
    UPDATE loan_emis
    SET status = 'deferred',
        is_deferred = true,
        deferment_reason = ?,
        deferred_to_month = ?,
        deferred_to_year = ?,
        deferred_by = ?,
        deferment_date = CURRENT_TIMESTAMP,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    defermentData.reason,
    defermentData.deferred_to_month,
    defermentData.deferred_to_year,
    deferredBy,
    `Deferred from ${emi.month} ${emi.year} to ${defermentData.deferred_to_month} ${defermentData.deferred_to_year}. Reason: ${defermentData.reason}`,
    emiId
  ]);
  
  // Create new EMI for deferred month
  await db.query(`
    INSERT INTO loan_emis (
      loan_id, emi_number, month, year, due_date,
      emi_amount, principal_component, interest_component,
      outstanding_balance, status, remarks
    )
    SELECT 
      loan_id, 
      (SELECT MAX(emi_number) + 1 FROM loan_emis WHERE loan_id = ?),
      ?, ?, ?,
      emi_amount, principal_component, interest_component,
      outstanding_balance, 'pending',
      ?
    FROM loan_emis WHERE id = ?
  `, [
    emi.loan_id,
    defermentData.deferred_to_month,
    defermentData.deferred_to_year,
    deferToDate,
    `Deferred EMI from ${emi.month} ${emi.year}`,
    emiId
  ]);
  
  // Update loan tenure
  await db.query(`
    UPDATE loan_records
    SET number_of_emis = number_of_emis + 1,
        remaining_emis = remaining_emis + 1
    WHERE id = ?
  `, [emi.loan_id]);
  
  // Notify employee
  const loan = await db.query(`
    SELECT employee_id, loan_number FROM loan_records WHERE id = ?
  `, [emi.loan_id]);
  
  await sendNotification({
    user_id: loan.employee_id,
    type: 'emi_deferred',
    title: 'EMI Deferred',
    message: `Your EMI for ${emi.month} ${emi.year} has been deferred to ${defermentData.deferred_to_month} ${defermentData.deferred_to_year}`,
    priority: 'high'
  });
  
  return { success: true };
}

async function rescheduleEMIs(loanId, newStartMonth, newStartYear, rescheduledBy) {
  // Reschedule all pending EMIs to new dates
  const pendingEMIs = await db.query(`
    SELECT * FROM loan_emis
    WHERE loan_id = ? AND status = 'pending'
    ORDER BY emi_number
  `, [loanId]);
  
  const startDate = new Date(`${newStartMonth} 1, ${newStartYear}`);
  
  for (let i = 0; i < pendingEMIs.length; i++) {
    const emi = pendingEMIs[i];
    const newDate = new Date(startDate);
    newDate.setMonth(newDate.getMonth() + i);
    
    await db.query(`
      UPDATE loan_emis
      SET month = ?,
          year = ?,
          due_date = ?,
          remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
      WHERE id = ?
    `, [
      newDate.toLocaleString('default', { month: 'long' }),
      newDate.getFullYear(),
      newDate,
      `Rescheduled on ${new Date().toISOString()} by ${rescheduledBy}`,
      emi.id
    ]);
  }
  
  return { rescheduled: pendingEMIs.length };
}
```

**Business Rules**:
- Defer only pending/overdue EMIs
- Require HR Manager/Director approval
- Deferment reason mandatory
- Create new EMI for deferred month
- Extend loan tenure by 1 month
- Mark original EMI as 'deferred'
- Support bulk EMI rescheduling
- Track all deferments with audit trail
- Maximum 2 deferments per loan

---

#### 6.3.5 Partial EMI Payments

**Rule**: Handle partial EMI payments with tracking

**Partial Payments**:
```javascript
async function recordPartialEMIPayment(emiId, partialAmount, paymentMode, paidBy) {
  const emi = await db.query(`
    SELECT * FROM loan_emis WHERE id = ?
  `, [emiId]);
  
  if (emi.status === 'paid') {
    throw new Error('EMI already fully paid');
  }
  
  const remainingAmount = emi.emi_amount - emi.paid_amount;
  
  if (partialAmount > remainingAmount) {
    throw new Error(`Partial payment cannot exceed remaining amount ₹${remainingAmount}`);
  }
  
  const newPaidAmount = emi.paid_amount + partialAmount;
  const newStatus = newPaidAmount >= emi.emi_amount ? 'paid' : 'partial';
  
  await db.query(`
    UPDATE loan_emis
    SET paid_amount = ?,
        status = ?,
        payment_mode = ?,
        paid_date = CASE WHEN ? = 'paid' THEN CURRENT_DATE ELSE paid_date END,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    newPaidAmount,
    newStatus,
    paymentMode,
    newStatus,
    `Partial payment: ₹${partialAmount} on ${new Date().toISOString()} via ${paymentMode}`,
    emiId
  ]);
  
  // Update loan paid amount
  await db.query(`
    UPDATE loan_records
    SET total_paid_amount = total_paid_amount + ?,
        remaining_balance = remaining_balance - ?
    WHERE id = ?
  `, [partialAmount, partialAmount, emi.loan_id]);
  
  // If fully paid now
  if (newStatus === 'paid') {
    await db.query(`
      UPDATE loan_records
      SET total_paid_emis = total_paid_emis + 1,
          remaining_emis = remaining_emis - 1
      WHERE id = ?
    `, [emi.loan_id]);
  }
  
  return {
    success: true,
    paid_amount: newPaidAmount,
    remaining_amount: emi.emi_amount - newPaidAmount,
    status: newStatus
  };
}

async function getPartialEMIReport(loanId) {
  return await db.query(`
    SELECT 
      emi_number, month, year,
      emi_amount, paid_amount,
      (emi_amount - paid_amount) as remaining_amount,
      status, payment_mode, remarks
    FROM loan_emis
    WHERE loan_id = ? AND status = 'partial'
    ORDER BY emi_number
  `, [loanId]);
}
```

**Business Rules**:
- Accept partial payments (< full EMI amount)
- Track paid_amount separately
- Status = 'partial' until fully paid
- Allow multiple partial payments per EMI
- Update loan.total_paid_amount on each payment
- Mark as 'paid' when paid_amount >= emi_amount
- Record payment mode for each partial payment
- Store all partial payment history in remarks

---

#### 6.3.6 EMI Waiver & Adjustments

**Rule**: Support EMI waivers for special cases

**Waivers**:
```javascript
async function waiveEMI(emiId, waivedBy, reason) {
  const emi = await db.query(`
    SELECT le.*, lr.employee_id, lr.loan_number
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.id = ?
  `, [emiId]);
  
  // Require director approval
  const approver = await db.query(`
    SELECT role FROM users WHERE id = ?
  `, [waivedBy]);
  
  if (approver.role !== 'director' && approver.role !== 'ceo') {
    throw new Error('Only Director/CEO can waive EMIs');
  }
  
  if (emi.status === 'paid') {
    throw new Error('Cannot waive already paid EMI');
  }
  
  const waiveAmount = emi.emi_amount - emi.paid_amount;
  
  await db.query(`
    UPDATE loan_emis
    SET status = 'waived',
        paid_amount = emi_amount,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    `Waived: ₹${waiveAmount} on ${new Date().toISOString()} by ${waivedBy}. Reason: ${reason}`,
    emiId
  ]);
  
  // Update loan
  await db.query(`
    UPDATE loan_records
    SET total_paid_emis = total_paid_emis + 1,
        remaining_balance = remaining_balance - ?,
        remaining_emis = remaining_emis - 1,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    waiveAmount,
    `EMI #${emi.emi_number} waived: ₹${waiveAmount}. Reason: ${reason}`,
    emi.loan_id
  ]);
  
  // Create waiver record for accounting
  await db.query(`
    INSERT INTO loan_emi_waivers (
      loan_id, emi_id, emi_number, waived_amount, reason, approved_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [emi.loan_id, emiId, emi.emi_number, waiveAmount, reason, waivedBy]);
  
  await sendNotification({
    user_id: emi.employee_id,
    type: 'emi_waived',
    title: 'EMI Waived',
    message: `Your EMI for ${emi.month} ${emi.year} (₹${waiveAmount}) has been waived.`,
    priority: 'high'
  });
  
  return { success: true, waived_amount: waiveAmount };
}

async function adjustEMIAmount(emiId, newAmount, adjustedBy, reason) {
  const emi = await db.query(`
    SELECT * FROM loan_emis WHERE id = ?
  `, [emiId]);
  
  if (emi.status !== 'pending') {
    throw new Error('Can only adjust pending EMIs');
  }
  
  const oldAmount = emi.emi_amount;
  const difference = newAmount - oldAmount;
  
  await db.query(`
    UPDATE loan_emis
    SET emi_amount = ?,
        remarks = CONCAT(COALESCE(remarks, ''), '\n', ?)
    WHERE id = ?
  `, [
    newAmount,
    `EMI adjusted from ₹${oldAmount} to ₹${newAmount} on ${new Date().toISOString()} by ${adjustedBy}. Reason: ${reason}`,
    emiId
  ]);
  
  // Recalculate subsequent EMIs if needed
  await recalculateEMISchedule(emi.loan_id, emi.emi_number + 1);
  
  return { success: true, adjustment: difference };
}
```

**Business Rules**:
- Waive only pending/partial/overdue EMIs
- Require Director/CEO approval
- Cannot waive paid EMIs
- Mark as 'waived' (treated as paid for loan completion)
- Reduce remaining_balance by waived amount
- Create separate waiver record for accounting
- Support EMI amount adjustments (restructuring)
- Recalculate schedule after adjustment
- Store complete audit trail

---

#### 6.3.7 EMI Analytics & Reporting

**Rule**: Generate EMI-level insights and reports

**Analytics**:
```javascript
async function getEMIPaymentAnalytics(filters = {}) {
  let query = `
    SELECT 
      COUNT(*) as total_emis,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_emis,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_emis,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_emis,
      SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_emis,
      SUM(CASE WHEN status = 'waived' THEN 1 ELSE 0 END) as waived_emis,
      SUM(emi_amount) as total_emi_value,
      SUM(paid_amount) as total_collected,
      SUM(CASE WHEN status = 'overdue' THEN emi_amount - paid_amount ELSE 0 END) as overdue_amount,
      AVG(days_overdue) as avg_days_overdue,
      SUM(penalty_amount) as total_penalties
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filters.month) {
    query += ` AND le.month = ?`;
    params.push(filters.month);
  }
  
  if (filters.year) {
    query += ` AND le.year = ?`;
    params.push(filters.year);
  }
  
  if (filters.department) {
    query += ` AND lr.department = ?`;
    params.push(filters.department);
  }
  
  return await db.query(query, params);
}

async function getMonthlyEMICollectionReport(year) {
  return await db.query(`
    SELECT 
      le.month,
      COUNT(*) as total_emis_due,
      SUM(CASE WHEN le.status = 'paid' THEN 1 ELSE 0 END) as collected_count,
      SUM(le.emi_amount) as total_due_amount,
      SUM(le.paid_amount) as total_collected_amount,
      ROUND((SUM(le.paid_amount) / SUM(le.emi_amount)) * 100, 2) as collection_rate
    FROM loan_emis le
    WHERE le.year = ?
    GROUP BY le.month
    ORDER BY FIELD(le.month, 'January','February','March','April','May','June',
      'July','August','September','October','November','December')
  `, [year]);
}

async function getEmployeeEMIHistory(employeeId) {
  return await db.query(`
    SELECT 
      lr.loan_number,
      lr.loan_type,
      le.emi_number,
      le.month,
      le.year,
      le.emi_amount,
      le.paid_amount,
      le.status,
      le.paid_date,
      le.days_overdue,
      le.penalty_amount
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE lr.employee_id = ?
    ORDER BY le.year DESC, FIELD(le.month, 'December','November','October',
      'September','August','July','June','May','April','March','February','January'),
      le.emi_number
  `, [employeeId]);
}
```

**Business Rules**:
- Track EMI payment rate (paid/total)
- Monitor overdue EMI count and amount
- Calculate collection efficiency
- Department-wise EMI analytics
- Monthly collection trends
- Identify high-risk accounts (multiple overdues)
- Track penalty collection
- Alert on declining collection rates

---

#### 6.3.8 EMI Calendar & Reminders

**Rule**: Proactive EMI reminders and calendar integration

**Calendar & Reminders**:
```javascript
async function generateEMICalendar(employeeId, year) {
  const emis = await db.query(`
    SELECT 
      lr.loan_number,
      lr.loan_type,
      le.emi_number,
      le.month,
      le.year,
      le.due_date,
      le.emi_amount,
      le.status
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE lr.employee_id = ? AND le.year = ?
      AND le.status IN ('pending', 'overdue')
    ORDER BY le.due_date
  `, [employeeId, year]);
  
  // Group by month
  const calendar = {};
  for (const emi of emis) {
    const monthKey = `${emi.month} ${emi.year}`;
    if (!calendar[monthKey]) {
      calendar[monthKey] = {
        month: emi.month,
        year: emi.year,
        emis: [],
        total_amount: 0
      };
    }
    calendar[monthKey].emis.push(emi);
    calendar[monthKey].total_amount += emi.emi_amount;
  }
  
  return Object.values(calendar);
}

async function sendEMIReminders() {
  // Reminder 1: 5 days before due date
  const upcoming = await db.query(`
    SELECT 
      lr.employee_id, e.email, e.employee_name,
      lr.loan_number, le.emi_number,
      le.month, le.year, le.emi_amount
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    JOIN employees e ON lr.employee_id = e.employee_id
    WHERE le.status = 'pending'
      AND le.due_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 5 DAY)
  `);
  
  for (const emi of upcoming) {
    await sendEmail({
      to: emi.email,
      subject: `Upcoming EMI Reminder - ₹${emi.emi_amount}`,
      html: `
        <p>Dear ${emi.employee_name},</p>
        <p>This is a reminder that your EMI of <strong>₹${emi.emi_amount}</strong> 
        for loan ${emi.loan_number} is due on ${emi.month} 1, ${emi.year}.</p>
        <p>EMI will be automatically deducted from your salary.</p>
      `
    });
  }
  
  // Reminder 2: Overdue EMIs
  const overdue = await db.query(`
    SELECT 
      lr.employee_id, e.email, e.employee_name,
      lr.loan_number, le.emi_number,
      le.month, le.year, le.emi_amount, le.days_overdue
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    JOIN employees e ON lr.employee_id = e.employee_id
    WHERE le.status = 'overdue'
      AND le.days_overdue IN (7, 15, 30) -- Send at specific intervals
  `);
  
  for (const emi of overdue) {
    await sendEmail({
      to: emi.email,
      subject: `⚠️ Overdue EMI - Action Required`,
      html: `
        <p>Dear ${emi.employee_name},</p>
        <p>Your EMI of <strong>₹${emi.emi_amount}</strong> for loan ${emi.loan_number} 
        is overdue by <strong>${emi.days_overdue} days</strong>.</p>
        <p>Please contact HR immediately to avoid penalty charges.</p>
      `
    });
  }
  
  return {
    upcoming_reminders: upcoming.length,
    overdue_reminders: overdue.length
  };
}
```

**Business Rules**:
- Send reminder 5 days before due date
- Send overdue alerts at 7, 15, 30 days
- Generate monthly EMI calendar for employees
- Show all pending EMIs on dashboard
- Notify manager on repeated overdues
- SMS/WhatsApp reminders (optional)
- Allow employees to set custom reminder preferences

---

#### 6.3.9 EMI Export & Documentation

**Rule**: Export EMI schedules and payment history

**Export**:
```javascript
async function exportEMISchedule(loanId, format = 'pdf') {
  const loan = await db.query(`
    SELECT * FROM loan_records WHERE id = ?
  `, [loanId]);
  
  const emis = await db.query(`
    SELECT * FROM loan_emis
    WHERE loan_id = ?
    ORDER BY emi_number
  `, [loanId]);
  
  const scheduleData = {
    loan_details: {
      loan_number: loan.loan_number,
      employee_name: loan.employee_name,
      loan_amount: loan.loan_amount,
      interest_rate: loan.interest_rate,
      tenure: loan.number_of_emis,
      emi_amount: loan.emi_amount,
      total_amount: loan.total_amount
    },
    emi_schedule: emis.map(emi => ({
      emi_number: emi.emi_number,
      due_date: emi.due_date,
      emi_amount: emi.emi_amount,
      principal: emi.principal_component,
      interest: emi.interest_component,
      outstanding: emi.outstanding_balance,
      status: emi.status,
      paid_date: emi.paid_date
    })),
    summary: {
      total_principal: emis.reduce((sum, e) => sum + e.principal_component, 0),
      total_interest: emis.reduce((sum, e) => sum + e.interest_component, 0),
      total_paid: emis.filter(e => e.status === 'paid').length,
      total_pending: emis.filter(e => e.status === 'pending').length
    }
  };
  
  if (format === 'pdf') {
    return await generateEMISchedulePDF(scheduleData);
  } else if (format === 'excel') {
    return await generateEMIScheduleExcel(scheduleData);
  } else {
    return scheduleData; // JSON
  }
}

async function generateEMIPaymentReceipt(emiId) {
  const emi = await db.query(`
    SELECT 
      le.*,
      lr.loan_number, lr.employee_id, lr.employee_name,
      lr.loan_amount, lr.interest_rate
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.id = ?
  `, [emiId]);
  
  if (emi.status !== 'paid') {
    throw new Error('Cannot generate receipt for unpaid EMI');
  }
  
  const receiptData = {
    receipt_number: `EMI-RCPT-${emi.loan_number}-${emi.emi_number}`,
    date: new Date().toISOString(),
    employee: {
      id: emi.employee_id,
      name: emi.employee_name
    },
    loan: {
      number: emi.loan_number,
      amount: emi.loan_amount
    },
    emi: {
      number: emi.emi_number,
      due_date: emi.due_date,
      amount: emi.emi_amount,
      principal: emi.principal_component,
      interest: emi.interest_component,
      paid_date: emi.paid_date,
      payment_mode: emi.payment_mode
    },
    outstanding_balance: emi.outstanding_balance
  };
  
  return await generatePDFReceipt(receiptData);
}
```

**Business Rules**:
- Export EMI schedule in PDF/Excel/JSON
- Include principal and interest breakdown
- Show payment status per EMI
- Generate payment receipts for paid EMIs
- Allow employee download from portal
- Include loan summary in schedule
- Show running outstanding balance
- Watermark for unpaid schedules

---

#### 6.3.10 EMI Status Dashboard & Monitoring

**Rule**: Real-time EMI status monitoring for HR and employees

**Dashboard**:
```javascript
async function getEMIDashboard(filters = {}) {
  // Overall EMI health
  const health = await db.query(`
    SELECT 
      COUNT(*) as total_emis,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial,
      ROUND((SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as payment_rate
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE lr.status = 'active'
  `);
  
  // Current month collection
  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const currentYear = new Date().getFullYear();
  
  const monthlyCollection = await db.query(`
    SELECT 
      SUM(emi_amount) as total_due,
      SUM(paid_amount) as total_collected,
      COUNT(*) as emis_due,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as emis_collected
    FROM loan_emis
    WHERE month = ? AND year = ?
  `, [currentMonth, currentYear]);
  
  // Top overdue accounts
  const topOverdue = await db.query(`
    SELECT 
      lr.employee_id,
      lr.employee_name,
      lr.department,
      COUNT(*) as overdue_count,
      SUM(le.emi_amount - le.paid_amount) as overdue_amount,
      MAX(le.days_overdue) as max_days_overdue
    FROM loan_emis le
    JOIN loan_records lr ON le.loan_id = lr.id
    WHERE le.status IN ('overdue', 'partial')
    GROUP BY lr.employee_id, lr.employee_name, lr.department
    ORDER BY overdue_amount DESC
    LIMIT 10
  `);
  
  return {
    health,
    monthly_collection: monthlyCollection,
    top_overdue: topOverdue
  };
}

async function getEmployeeEMIDashboard(employeeId) {
  const activeLoans = await db.query(`
    SELECT 
      id, loan_number, loan_type, emi_amount,
      total_paid_emis, remaining_emis
    FROM loan_records
    WHERE employee_id = ? AND status = 'active'
  `, [employeeId]);
  
  const allEMIs = [];
  for (const loan of activeLoans) {
    const emis = await db.query(`
      SELECT * FROM loan_emis
      WHERE loan_id = ? AND status IN ('pending', 'overdue', 'partial')
      ORDER BY due_date
    `, [loan.id]);
    
    allEMIs.push({
      loan_number: loan.loan_number,
      loan_type: loan.loan_type,
      emis
    });
  }
  
  return {
    active_loans: activeLoans,
    upcoming_emis: allEMIs
  };
}
```

**Business Rules**:
- Real-time EMI payment status
- Current month collection rate
- Identify top overdue accounts
- Employee-specific EMI dashboard
- Show upcoming EMIs (next 3 months)
- Track payment trends
- Alert on declining collection rates
- Department-wise EMI health metrics

---

## 7. Letter and Document Generation

### 7.1 LetterTemplate Management
**Rule**: Manage reusable letter templates with dynamic placeholders for automated document generation

**Purpose**: Centralize letter templates for consistent branding and formatting, support dynamic content through placeholders, enable version control for template changes, provide multiple template variants for different scenarios, streamline document generation workflows, maintain compliance with statutory requirements, and reduce manual document creation effort.

---

#### 7.1.1 Template Structure & Placeholders

**Rule**: Create flexible templates with standardized placeholder syntax

**LetterTemplate Schema**:
```javascript
const LETTER_TEMPLATE_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  template_code: 'VARCHAR(50) UNIQUE NOT NULL', // Unique code: OFFER_LETTER_001
  template_name: 'VARCHAR(255) NOT NULL',
  template_type: 'ENUM NOT NULL', // 'offer_letter', 'appointment_letter', 'relieving_letter', 'experience_letter', 'increment_letter', 'confirmation_letter', 'transfer_letter', 'warning_letter', 'termination_letter', 'noc', 'salary_certificate'
  
  // Template content
  template_content: 'TEXT NOT NULL', // HTML/Markdown with placeholders
  template_header: 'TEXT', // Letterhead HTML
  template_footer: 'TEXT', // Footer with signatures
  
  // Metadata
  description: 'TEXT',
  category: 'VARCHAR(100)', // 'employment', 'statutory', 'internal', 'external'
  language: 'VARCHAR(10) DEFAULT "en"', // en, hi, regional languages
  
  // Version control
  version: 'VARCHAR(20) DEFAULT "1.0"',
  parent_template_id: 'UUID FOREIGN KEY', // For versioning
  is_active: 'BOOLEAN DEFAULT true',
  effective_from: 'DATE',
  effective_to: 'DATE',
  
  // Configuration
  requires_approval: 'BOOLEAN DEFAULT false',
  approval_role: 'VARCHAR(50)', // Role required for approval
  placeholders: 'JSONB', // Available placeholder list with descriptions
  required_fields: 'JSONB', // Fields that must have values
  
  // Customization
  allow_customization: 'BOOLEAN DEFAULT false', // Allow per-employee edits
  pdf_orientation: 'ENUM DEFAULT "portrait"', // 'portrait', 'landscape'
  pdf_size: 'VARCHAR(10) DEFAULT "A4"', // 'A4', 'Letter'
  
  // Usage tracking
  usage_count: 'INT DEFAULT 0',
  last_used_at: 'TIMESTAMP',
  
  // Audit
  created_by: 'UUID FOREIGN KEY',
  updated_by: 'UUID FOREIGN KEY',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};
```

**Placeholder System**:
```javascript
// Standard placeholder syntax: {{placeholder_name}}
// Conditional syntax: {{#if condition}}...{{/if}}
// Loop syntax: {{#each items}}...{{/each}}

const STANDARD_PLACEHOLDERS = {
  // Employee details
  employee_id: 'Employee ID',
  employee_name: 'Full Name',
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email Address',
  phone_number: 'Phone Number',
  date_of_birth: 'Date of Birth',
  age: 'Age',
  gender: 'Gender',
  
  // Employment details
  date_of_joining: 'Date of Joining',
  designation: 'Designation',
  department: 'Department',
  employment_type: 'Employment Type',
  probation_period: 'Probation Period',
  reporting_manager: 'Reporting Manager Name',
  work_location: 'Work Location',
  
  // Salary details
  ctc: 'CTC (Annual)',
  ctc_monthly: 'CTC (Monthly)',
  gross_salary: 'Gross Salary',
  basic_salary: 'Basic Salary',
  hra: 'HRA',
  special_allowance: 'Special Allowance',
  
  // Dates
  current_date: 'Current Date',
  letter_date: 'Letter Date',
  effective_date: 'Effective Date',
  
  // Company details
  company_name: 'Company Name',
  company_address: 'Company Address',
  company_phone: 'Company Phone',
  company_email: 'Company Email',
  company_website: 'Company Website',
  company_logo: 'Company Logo',
  
  // Letter specific
  letter_number: 'Letter Reference Number',
  subject: 'Letter Subject'
};

async function createTemplate(templateData, createdBy) {
  // Generate template code
  const typePrefix = templateData.template_type.toUpperCase().replace(/_/g, '');
  const sequence = await db.query(`
    SELECT COUNT(*) as count FROM letter_templates
    WHERE template_type = ?
  `, [templateData.template_type]);
  
  const templateCode = `${typePrefix}_${String(sequence.count + 1).padStart(3, '0')}`;
  
  // Extract placeholders from content
  const placeholderRegex = /\{\{([a-z_]+)\}\}/g;
  const foundPlaceholders = [...templateData.template_content.matchAll(placeholderRegex)]
    .map(match => match[1]);
  
  // Validate placeholders
  const invalidPlaceholders = foundPlaceholders.filter(
    p => !STANDARD_PLACEHOLDERS[p]
  );
  
  if (invalidPlaceholders.length > 0) {
    throw new Error(`Invalid placeholders found: ${invalidPlaceholders.join(', ')}`);
  }
  
  const templateId = await db.query(`
    INSERT INTO letter_templates (
      template_code, template_name, template_type,
      template_content, template_header, template_footer,
      description, category, language, version,
      requires_approval, approval_role,
      placeholders, required_fields,
      allow_customization, pdf_orientation, pdf_size,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    templateCode,
    templateData.template_name,
    templateData.template_type,
    templateData.template_content,
    templateData.template_header || getDefaultHeader(),
    templateData.template_footer || getDefaultFooter(),
    templateData.description,
    templateData.category || 'employment',
    templateData.language || 'en',
    '1.0',
    templateData.requires_approval || false,
    templateData.approval_role,
    JSON.stringify(foundPlaceholders),
    JSON.stringify(templateData.required_fields || []),
    templateData.allow_customization || false,
    templateData.pdf_orientation || 'portrait',
    templateData.pdf_size || 'A4',
    createdBy
  ]);
  
  return { templateId, templateCode };
}
```

**Business Rules**:
- Placeholder syntax: {{field_name}}
- All placeholders must be from standard list
- Auto-extract placeholders from template content
- Version templates (1.0, 1.1, 2.0)
- One active version per template type
- Support HTML and Markdown formats
- Include header/footer for branding
- Track template usage

---

#### 7.1.2 Template Types & Categories

**Rule**: Organize templates by type and category

**Template Types**:
```javascript
const TEMPLATE_TYPES = {
  // Employment lifecycle
  offer_letter: {
    name: 'Offer Letter',
    category: 'employment',
    required_fields: ['employee_name', 'designation', 'date_of_joining', 'ctc'],
    typical_placeholders: ['employee_name', 'designation', 'date_of_joining', 'ctc', 
      'probation_period', 'reporting_manager', 'work_location']
  },
  
  appointment_letter: {
    name: 'Appointment Letter',
    category: 'employment',
    required_fields: ['employee_id', 'employee_name', 'designation', 'date_of_joining'],
    typical_placeholders: ['employee_id', 'employee_name', 'designation', 'department',
      'date_of_joining', 'employment_type', 'reporting_manager']
  },
  
  confirmation_letter: {
    name: 'Probation Confirmation Letter',
    category: 'employment',
    required_fields: ['employee_name', 'confirmation_date'],
    typical_placeholders: ['employee_name', 'designation', 'date_of_joining',
      'confirmation_date', 'probation_period']
  },
  
  increment_letter: {
    name: 'Salary Increment Letter',
    category: 'employment',
    required_fields: ['employee_name', 'old_ctc', 'new_ctc', 'increment_percentage'],
    typical_placeholders: ['employee_name', 'designation', 'old_ctc', 'new_ctc',
      'increment_percentage', 'effective_date']
  },
  
  promotion_letter: {
    name: 'Promotion Letter',
    category: 'employment',
    required_fields: ['employee_name', 'old_designation', 'new_designation'],
    typical_placeholders: ['employee_name', 'old_designation', 'new_designation',
      'effective_date', 'new_ctc']
  },
  
  transfer_letter: {
    name: 'Transfer Letter',
    category: 'employment',
    required_fields: ['employee_name', 'old_location', 'new_location'],
    typical_placeholders: ['employee_name', 'designation', 'old_location',
      'new_location', 'transfer_date', 'reason']
  },
  
  relieving_letter: {
    name: 'Relieving Letter',
    category: 'employment',
    required_fields: ['employee_name', 'last_working_day'],
    typical_placeholders: ['employee_name', 'employee_id', 'designation',
      'date_of_joining', 'last_working_day', 'reason']
  },
  
  experience_letter: {
    name: 'Experience Certificate',
    category: 'employment',
    required_fields: ['employee_name', 'date_of_joining', 'last_working_day'],
    typical_placeholders: ['employee_name', 'designation', 'date_of_joining',
      'last_working_day', 'tenure_years', 'tenure_months']
  },
  
  // Internal communications
  warning_letter: {
    name: 'Warning Letter',
    category: 'internal',
    required_fields: ['employee_name', 'violation_description'],
    requires_approval: true
  },
  
  termination_letter: {
    name: 'Termination Letter',
    category: 'internal',
    required_fields: ['employee_name', 'termination_date', 'reason'],
    requires_approval: true
  },
  
  // Certificates
  salary_certificate: {
    name: 'Salary Certificate',
    category: 'statutory',
    required_fields: ['employee_name', 'gross_salary', 'purpose']
  },
  
  noc: {
    name: 'No Objection Certificate',
    category: 'external',
    required_fields: ['employee_name', 'purpose']
  }
};

async function getTemplatesByType(templateType) {
  return await db.query(`
    SELECT * FROM letter_templates
    WHERE template_type = ? AND is_active = true
    ORDER BY version DESC, created_at DESC
  `, [templateType]);
}

async function getTemplatesByCategory(category) {
  return await db.query(`
    SELECT * FROM letter_templates
    WHERE category = ? AND is_active = true
    ORDER BY template_type, template_name
  `, [category]);
}
```

**Business Rules**:
- 11 standard template types
- Categories: employment, internal, external, statutory
- Each type has required fields
- Warning/termination letters require approval
- Support custom template types
- One default template per type
- Multiple variants allowed (with/without salary details)

---

#### 7.1.3 Template Rendering & Letter Generation

**Rule**: Render templates with dynamic data

**Template Rendering**:
```javascript
async function renderTemplate(templateId, data) {
  const template = await db.query(`
    SELECT * FROM letter_templates WHERE id = ?
  `, [templateId]);
  
  if (!template.is_active) {
    throw new Error('Template is not active');
  }
  
  // Validate required fields
  const requiredFields = JSON.parse(template.required_fields || '[]');
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Build complete data object
  const renderData = {
    ...data,
    current_date: formatDate(new Date()),
    company_name: await getCompanySetting('company_name'),
    company_address: await getCompanySetting('company_address'),
    company_phone: await getCompanySetting('company_phone'),
    company_email: await getCompanySetting('company_email'),
    company_website: await getCompanySetting('company_website'),
    company_logo: await getCompanySetting('company_logo_base64')
  };
  
  // Render header
  let renderedHeader = template.template_header;
  for (const [key, value] of Object.entries(renderData)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    renderedHeader = renderedHeader.replace(regex, value || '');
  }
  
  // Render content
  let renderedContent = template.template_content;
  for (const [key, value] of Object.entries(renderData)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    renderedContent = renderedContent.replace(regex, value || '');
  }
  
  // Render footer
  let renderedFooter = template.template_footer;
  for (const [key, value] of Object.entries(renderData)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    renderedFooter = renderedFooter.replace(regex, value || '');
  }
  
  // Handle conditionals {{#if field}}...{{/if}}
  renderedContent = processConditionals(renderedContent, renderData);
  
  // Handle loops {{#each items}}...{{/each}}
  renderedContent = processLoops(renderedContent, renderData);
  
  const fullContent = `${renderedHeader}\n${renderedContent}\n${renderedFooter}`;
  
  return {
    rendered_content: fullContent,
    template_code: template.template_code,
    template_name: template.template_name
  };
}

async function generateLetter(employeeId, templateId, additionalData = {}) {
  // Get employee data
  const employee = await db.query(`
    SELECT 
      e.*,
      ed.date_of_joining, ed.employment_type, ed.probation_period,
      ed.work_location, ed.reporting_manager_name,
      si.ctc, si.salary_basic, si.salary_hra, si.salary_conveyance,
      si.salary_telephone, si.salary_medical, si.salary_special_allowance,
      bd.bank_name, bd.bank_account_number
    FROM employees e
    LEFT JOIN employment_details ed ON e.id = ed.employee_id
    LEFT JOIN salary_info si ON e.id = si.employee_id
    LEFT JOIN bank_details bd ON e.id = bd.employee_id
    WHERE e.employee_id = ?
  `, [employeeId]);
  
  // Prepare data
  const data = {
    employee_id: employee.employee_id,
    employee_name: employee.employee_name,
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email,
    phone_number: employee.phone_number,
    date_of_birth: formatDate(employee.date_of_birth),
    age: calculateAge(employee.date_of_birth),
    gender: employee.gender,
    
    date_of_joining: formatDate(employee.date_of_joining),
    designation: employee.designation,
    department: employee.department,
    employment_type: employee.employment_type,
    probation_period: employee.probation_period,
    reporting_manager: employee.reporting_manager_name,
    work_location: employee.work_location,
    
    ctc: formatCurrency(employee.ctc),
    ctc_monthly: formatCurrency(employee.ctc / 12),
    gross_salary: formatCurrency(
      employee.salary_basic + employee.salary_hra + employee.salary_conveyance +
      employee.salary_telephone + employee.salary_medical + employee.salary_special_allowance
    ),
    basic_salary: formatCurrency(employee.salary_basic),
    hra: formatCurrency(employee.salary_hra),
    special_allowance: formatCurrency(employee.salary_special_allowance),
    
    ...additionalData // Override or add fields
  };
  
  // Render template
  const rendered = await renderTemplate(templateId, data);
  
  // Generate PDF
  const pdfBuffer = await generatePDFFromHTML(rendered.rendered_content);
  const pdfBase64 = pdfBuffer.toString('base64');
  
  // Generate letter number
  const template = await db.query(`SELECT template_type FROM letter_templates WHERE id = ?`, [templateId]);
  const letterNumber = await generateLetterNumber(template.template_type, employeeId);
  
  // Save generated letter
  const letterId = await db.query(`
    INSERT INTO generated_letters (
      employee_id, letter_type, template_id,
      letter_number, letter_content, file_data,
      generated_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    employeeId, template.template_type, templateId,
    letterNumber, rendered.rendered_content, pdfBase64,
    getCurrentUserId()
  ]);
  
  // Update template usage
  await db.query(`
    UPDATE letter_templates
    SET usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [templateId]);
  
  return {
    letter_id: letterId,
    letter_number: letterNumber,
    pdf_base64: pdfBase64
  };
}

function processConditionals(content, data) {
  const conditionalRegex = /\{\{#if ([a-z_]+)\}\}(.*?)\{\{\/if\}\}/gs;
  return content.replace(conditionalRegex, (match, condition, innerContent) => {
    return data[condition] ? innerContent : '';
  });
}

function processLoops(content, data) {
  const loopRegex = /\{\{#each ([a-z_]+)\}\}(.*?)\{\{\/each\}\}/gs;
  return content.replace(loopRegex, (match, arrayName, innerContent) => {
    const items = data[arrayName] || [];
    return items.map(item => {
      let itemContent = innerContent;
      for (const [key, value] of Object.entries(item)) {
        itemContent = itemContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
      }
      return itemContent;
    }).join('\n');
  });
}
```

**Business Rules**:
- Validate required fields before rendering
- Auto-populate company details
- Replace all placeholders with actual values
- Support conditionals: {{#if field}}...{{/if}}
- Support loops: {{#each items}}...{{/each}}
- Generate PDF from rendered HTML
- Store base64 PDF in generated_letters
- Track template usage count
- Generate unique letter numbers

---

#### 7.1.4 Template Versioning & History

**Rule**: Maintain template version history

**Versioning**:
```javascript
async function createTemplateVersion(templateId, changes, updatedBy) {
  const currentTemplate = await db.query(`
    SELECT * FROM letter_templates WHERE id = ?
  `, [templateId]);
  
  // Parse current version
  const versionParts = currentTemplate.version.split('.');
  const majorVersion = parseInt(versionParts[0]);
  const minorVersion = parseInt(versionParts[1] || 0);
  
  // Determine new version
  const isMajorChange = changes.template_content !== currentTemplate.template_content;
  const newVersion = isMajorChange 
    ? `${majorVersion + 1}.0`
    : `${majorVersion}.${minorVersion + 1}`;
  
  // Deactivate current template
  await db.query(`
    UPDATE letter_templates
    SET is_active = false,
        effective_to = CURRENT_DATE
    WHERE id = ?
  `, [templateId]);
  
  // Create new version
  const newTemplateId = await db.query(`
    INSERT INTO letter_templates (
      template_code, template_name, template_type,
      template_content, template_header, template_footer,
      description, category, language,
      version, parent_template_id, is_active, effective_from,
      requires_approval, approval_role,
      placeholders, required_fields,
      allow_customization, pdf_orientation, pdf_size,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, CURRENT_DATE, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    currentTemplate.template_code,
    changes.template_name || currentTemplate.template_name,
    currentTemplate.template_type,
    changes.template_content || currentTemplate.template_content,
    changes.template_header || currentTemplate.template_header,
    changes.template_footer || currentTemplate.template_footer,
    changes.description || currentTemplate.description,
    currentTemplate.category,
    currentTemplate.language,
    newVersion,
    templateId, // parent_template_id
    currentTemplate.requires_approval,
    currentTemplate.approval_role,
    currentTemplate.placeholders,
    currentTemplate.required_fields,
    currentTemplate.allow_customization,
    currentTemplate.pdf_orientation,
    currentTemplate.pdf_size,
    updatedBy
  ]);
  
  return { newTemplateId, version: newVersion };
}

async function getTemplateVersionHistory(templateCode) {
  return await db.query(`
    SELECT 
      id, version, template_name,
      is_active, effective_from, effective_to,
      usage_count, created_at, updated_at
    FROM letter_templates
    WHERE template_code = ?
    ORDER BY version DESC
  `, [templateCode]);
}

async function rollbackTemplateVersion(templateId) {
  const template = await db.query(`
    SELECT parent_template_id FROM letter_templates WHERE id = ?
  `, [templateId]);
  
  if (!template.parent_template_id) {
    throw new Error('No previous version to rollback to');
  }
  
  // Deactivate current
  await db.query(`
    UPDATE letter_templates SET is_active = false WHERE id = ?
  `, [templateId]);
  
  // Activate parent
  await db.query(`
    UPDATE letter_templates
    SET is_active = true, effective_from = CURRENT_DATE, effective_to = NULL
    WHERE id = ?
  `, [template.parent_template_id]);
  
  return { success: true, active_template_id: template.parent_template_id };
}
```

**Business Rules**:
- Version format: MAJOR.MINOR (1.0, 1.1, 2.0)
- Major version: content changes
- Minor version: metadata/formatting changes
- Only one active version per template_code
- Link versions via parent_template_id
- Track effective_from and effective_to dates
- Support rollback to previous version
- Maintain complete version history

---

#### 7.1.5 Template Approval Workflow

**Rule**: Require approval for sensitive templates

**Approval**:
```javascript
async function submitTemplateForApproval(templateId, submittedBy) {
  const template = await db.query(`
    SELECT * FROM letter_templates WHERE id = ?
  `, [templateId]);
  
  if (!template.requires_approval) {
    throw new Error('This template does not require approval');
  }
  
  // Create approval request
  await db.query(`
    INSERT INTO template_approvals (
      template_id, submitted_by, status
    ) VALUES (?, ?, 'pending')
  `, [templateId, submittedBy]);
  
  // Notify approver
  const approvers = await db.query(`
    SELECT id, email FROM users WHERE role = ?
  `, [template.approval_role]);
  
  for (const approver of approvers) {
    await sendNotification({
      user_id: approver.id,
      type: 'template_approval_required',
      title: 'Template Approval Required',
      message: `Template "${template.template_name}" requires your approval.`,
      priority: 'high'
    });
  }
  
  return { success: true };
}

async function approveTemplate(templateId, approvedBy, comments) {
  await db.query(`
    UPDATE template_approvals
    SET status = 'approved',
        approved_by = ?,
        approval_date = CURRENT_TIMESTAMP,
        comments = ?
    WHERE template_id = ? AND status = 'pending'
  `, [approvedBy, comments, templateId]);
  
  await db.query(`
    UPDATE letter_templates
    SET is_active = true
    WHERE id = ?
  `, [templateId]);
  
  return { success: true };
}
```

**Business Rules**:
- Warning/termination templates require approval
- Approval by specific role (HR Manager, Director)
- Template inactive until approved
- Track approval history
- Allow rejection with reason
- Notify submitter on approval/rejection

---

#### 7.1.6 Bulk Letter Generation

**Rule**: Generate letters for multiple employees

**Bulk Generation**:
```javascript
async function bulkGenerateLetters(templateId, employeeIds, commonData = {}) {
  const results = [];
  
  for (const employeeId of employeeIds) {
    try {
      const letter = await generateLetter(employeeId, templateId, commonData);
      results.push({
        employee_id: employeeId,
        success: true,
        letter_id: letter.letter_id,
        letter_number: letter.letter_number
      });
    } catch (error) {
      results.push({
        employee_id: employeeId,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function generateConfirmationLetters(month, year) {
  // Auto-generate for employees completing probation
  const employees = await db.query(`
    SELECT employee_id
    FROM employment_details
    WHERE DATE_ADD(date_of_joining, INTERVAL probation_period_months MONTH) 
      BETWEEN ? AND ?
      AND employment_status = 'active'
  `, [`${year}-${month}-01`, `${year}-${month}-31`]);
  
  const templateId = await getDefaultTemplate('confirmation_letter');
  
  return await bulkGenerateLetters(
    templateId,
    employees.map(e => e.employee_id),
    { confirmation_date: new Date().toISOString().split('T')[0] }
  );
}
```

**Business Rules**:
- Generate letters for multiple employees at once
- Use common data for all letters
- Auto-generate confirmation letters (probation end)
- Track bulk generation results
- Send email notifications with attachments
- Support batch download as ZIP

---

#### 7.1.7 Template Search & Management

**Rule**: Efficient template discovery and management

**Management**:
```javascript
async function searchTemplates(criteria) {
  let query = `
    SELECT * FROM letter_templates WHERE 1=1
  `;
  const params = [];
  
  if (criteria.template_type) {
    query += ` AND template_type = ?`;
    params.push(criteria.template_type);
  }
  
  if (criteria.category) {
    query += ` AND category = ?`;
    params.push(criteria.category);
  }
  
  if (criteria.is_active !== undefined) {
    query += ` AND is_active = ?`;
    params.push(criteria.is_active);
  }
  
  if (criteria.search) {
    query += ` AND (template_name LIKE ? OR description LIKE ?)`;
    params.push(`%${criteria.search}%`, `%${criteria.search}%`);
  }
  
  query += ` ORDER BY template_type, version DESC, created_at DESC`;
  
  return await db.query(query, params);
}

async function duplicateTemplate(templateId, newName, duplicatedBy) {
  const template = await db.query(`
    SELECT * FROM letter_templates WHERE id = ?
  `, [templateId]);
  
  const newCode = `${template.template_code}_COPY_${Date.now()}`;
  
  const newTemplateId = await db.query(`
    INSERT INTO letter_templates (
      template_code, template_name, template_type,
      template_content, template_header, template_footer,
      description, category, language, version,
      requires_approval, approval_role,
      placeholders, required_fields,
      allow_customization, pdf_orientation, pdf_size,
      created_by
    ) SELECT 
      ?, ?, template_type,
      template_content, template_header, template_footer,
      description, category, language, '1.0',
      requires_approval, approval_role,
      placeholders, required_fields,
      allow_customization, pdf_orientation, pdf_size,
      ?
    FROM letter_templates WHERE id = ?
  `, [newCode, newName, duplicatedBy, templateId]);
  
  return { newTemplateId, template_code: newCode };
}

async function deleteTemplate(templateId, deletedBy) {
  // Check if template is in use
  const usage = await db.query(`
    SELECT COUNT(*) as count FROM generated_letters
    WHERE template_id = ?
  `, [templateId]);
  
  if (usage.count > 0) {
    // Soft delete (deactivate)
    await db.query(`
      UPDATE letter_templates
      SET is_active = false, effective_to = CURRENT_DATE
      WHERE id = ?
    `, [templateId]);
  } else {
    // Hard delete
    await db.query(`
      DELETE FROM letter_templates WHERE id = ?
    `, [templateId]);
  }
  
  return { success: true };
}
```

**Business Rules**:
- Search by type, category, active status
- Support full-text search in name/description
- Duplicate templates for customization
- Soft delete if template has usage history
- Hard delete if never used
- Track who created/deleted templates

---

#### 7.1.8 Template Import/Export

**Rule**: Share templates across systems

**Import/Export**:
```javascript
async function exportTemplate(templateId, format = 'json') {
  const template = await db.query(`
    SELECT * FROM letter_templates WHERE id = ?
  `, [templateId]);
  
  const exportData = {
    template_code: template.template_code,
    template_name: template.template_name,
    template_type: template.template_type,
    template_content: template.template_content,
    template_header: template.template_header,
    template_footer: template.template_footer,
    description: template.description,
    category: template.category,
    language: template.language,
    version: template.version,
    placeholders: JSON.parse(template.placeholders),
    required_fields: JSON.parse(template.required_fields),
    pdf_orientation: template.pdf_orientation,
    pdf_size: template.pdf_size,
    exported_at: new Date().toISOString()
  };
  
  if (format === 'json') {
    return JSON.stringify(exportData, null, 2);
  }
  
  return exportData;
}

async function importTemplate(templateData, importedBy) {
  // Validate structure
  if (!templateData.template_name || !templateData.template_type) {
    throw new Error('Invalid template data');
  }
  
  // Check for conflicts
  const existing = await db.query(`
    SELECT id FROM letter_templates
    WHERE template_code = ?
  `, [templateData.template_code]);
  
  if (existing) {
    throw new Error('Template with this code already exists');
  }
  
  // Import
  return await createTemplate(templateData, importedBy);
}
```

**Business Rules**:
- Export templates as JSON
- Include all metadata and content
- Validate on import
- Check for duplicate template codes
- Support bulk import/export
- Version compatibility checks

---

#### 7.1.9 Template Analytics

**Rule**: Track template usage and effectiveness

**Analytics**:
```javascript
async function getTemplateAnalytics(filters = {}) {
  return await db.query(`
    SELECT 
      lt.template_type,
      lt.template_name,
      lt.usage_count,
      lt.last_used_at,
      COUNT(gl.id) as letters_generated,
      lt.created_at
    FROM letter_templates lt
    LEFT JOIN generated_letters gl ON lt.id = gl.template_id
    WHERE lt.is_active = true
    GROUP BY lt.id
    ORDER BY lt.usage_count DESC
  `);
}

async function getMostUsedTemplates(limit = 10) {
  return await db.query(`
    SELECT 
      template_name, template_type, usage_count, last_used_at
    FROM letter_templates
    WHERE is_active = true
    ORDER BY usage_count DESC
    LIMIT ?
  `, [limit]);
}
```

**Business Rules**:
- Track usage count per template
- Identify most/least used templates
- Monitor generation trends
- Analyze letter types distribution
- Report on template effectiveness

---

#### 7.1.10 Default Templates & Initialization

**Rule**: Provide standard templates out-of-the-box

**Default Templates**:
```javascript
async function initializeDefaultTemplates() {
  const defaultTemplates = [
    {
      template_name: 'Standard Offer Letter',
      template_type: 'offer_letter',
      template_content: `
        <div>
          <p>Date: {{current_date}}</p>
          <p>Dear {{employee_name}},</p>
          
          <p>We are pleased to offer you the position of <strong>{{designation}}</strong> 
          at {{company_name}}.</p>
          
          <p><strong>Employment Details:</strong></p>
          <ul>
            <li>Start Date: {{date_of_joining}}</li>
            <li>Department: {{department}}</li>
            <li>Location: {{work_location}}</li>
            <li>Reporting Manager: {{reporting_manager}}</li>
            <li>Probation Period: {{probation_period}} months</li>
          </ul>
          
          <p><strong>Compensation:</strong></p>
          <ul>
            <li>Annual CTC: {{ctc}}</li>
            <li>Monthly Gross: {{ctc_monthly}}</li>
          </ul>
          
          <p>Please confirm your acceptance by signing and returning this letter.</p>
          
          <p>We look forward to having you on our team!</p>
          
          <p>Best regards,<br/>HR Team</p>
        </div>
      `,
      category: 'employment',
      required_fields: ['employee_name', 'designation', 'date_of_joining', 'ctc']
    },
    // Add more default templates...
  ];
  
  for (const template of defaultTemplates) {
    await createTemplate(template, 'system');
  }
  
  return { initialized: defaultTemplates.length };
}
```

**Business Rules**:
- Provide 5-10 standard templates
- Cover all common letter types
- Use professional formatting
- Include company branding placeholders
- Allow customization of defaults
- Initialize on first system setup

---

### 7.2 GeneratedLetter Management
**Rule**: Manage generated letters with complete lifecycle tracking, distribution, and archival

**Purpose**: Store all generated letters for audit trail, provide employees access to their letters, support regeneration and reprinting, track letter distribution status, maintain statutory compliance documentation, enable bulk distribution, and ensure secure storage with proper access controls.

---

#### 7.2.1 Generated Letter Structure & Storage

**Rule**: Store complete letter data with metadata

**GeneratedLetter Schema**:
```javascript
const GENERATED_LETTER_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  letter_number: 'VARCHAR(50) UNIQUE NOT NULL', // Format: LTR/TYPE/YYYY/MM/EMPID/SEQ
  employee_id: 'VARCHAR(20) FOREIGN KEY NOT NULL',
  employee_name: 'VARCHAR(255) NOT NULL', // Denormalized
  department: 'VARCHAR(100)', // Denormalized
  designation: 'VARCHAR(255)', // Denormalized
  
  // Letter details
  letter_type: 'ENUM NOT NULL', // 'offer_letter', 'appointment_letter', etc.
  template_id: 'UUID FOREIGN KEY',
  template_code: 'VARCHAR(50)', // Denormalized for history
  template_version: 'VARCHAR(20)', // Template version used
  
  // Content storage
  letter_content: 'TEXT NOT NULL', // Rendered HTML
  letter_content_plain: 'TEXT', // Plain text version
  file_data: 'TEXT', // Base64 PDF or S3/storage path
  file_size: 'INT', // File size in bytes
  file_format: 'VARCHAR(10) DEFAULT "pdf"', // pdf, docx
  
  // Metadata
  subject: 'VARCHAR(500)',
  letter_date: 'DATE NOT NULL',
  effective_date: 'DATE',
  expiry_date: 'DATE', // For offer letters
  
  // Status tracking
  status: 'ENUM DEFAULT "draft"', // 'draft', 'generated', 'sent', 'acknowledged', 'expired', 'cancelled'
  is_signed: 'BOOLEAN DEFAULT false',
  signed_date: 'DATE',
  signature_data: 'TEXT', // Digital signature or scan
  
  // Distribution tracking
  email_sent: 'BOOLEAN DEFAULT false',
  email_sent_at: 'TIMESTAMP',
  email_sent_to: 'VARCHAR(255)',
  email_delivery_status: 'ENUM', // 'pending', 'delivered', 'failed', 'bounced'
  
  // Access tracking
  download_count: 'INT DEFAULT 0',
  first_downloaded_at: 'TIMESTAMP',
  last_downloaded_at: 'TIMESTAMP',
  view_count: 'INT DEFAULT 0',
  last_viewed_at: 'TIMESTAMP',
  
  // Acknowledgment
  acknowledged_by_employee: 'BOOLEAN DEFAULT false',
  acknowledgment_date: 'TIMESTAMP',
  acknowledgment_ip: 'VARCHAR(50)',
  acknowledgment_comments: 'TEXT',
  
  // Revision tracking
  is_revised: 'BOOLEAN DEFAULT false',
  revision_number: 'INT DEFAULT 0',
  parent_letter_id: 'UUID FOREIGN KEY', // Original letter
  revision_reason: 'TEXT',
  
  // Audit
  generated_at: 'TIMESTAMP',
  generated_by: 'UUID FOREIGN KEY',
  cancelled_at: 'TIMESTAMP',
  cancelled_by: 'UUID FOREIGN KEY',
  cancellation_reason: 'TEXT',
  remarks: 'TEXT',
  created_at: 'TIMESTAMP',
  updated_at: 'TIMESTAMP'
};
```

**Letter Generation**:
```javascript
async function createGeneratedLetter(employeeId, templateId, additionalData, generatedBy) {
  // Generate letter using template
  const letterData = await generateLetter(employeeId, templateId, additionalData);
  
  const template = await db.query(`
    SELECT template_type, template_code, version FROM letter_templates WHERE id = ?
  `, [templateId]);
  
  const employee = await db.query(`
    SELECT employee_name, department, designation FROM employees WHERE employee_id = ?
  `, [employeeId]);
  
  // Generate letter number
  const letterNumber = await generateLetterNumber(template.template_type, employeeId);
  
  // Store generated letter
  const letterId = await db.query(`
    INSERT INTO generated_letters (
      letter_number, employee_id, employee_name, department, designation,
      letter_type, template_id, template_code, template_version,
      letter_content, file_data, file_size, file_format,
      subject, letter_date, status,
      generated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pdf', ?, CURRENT_DATE, 'generated', ?)
  `, [
    letterNumber,
    employeeId,
    employee.employee_name,
    employee.department,
    employee.designation,
    template.template_type,
    templateId,
    template.template_code,
    template.version,
    letterData.rendered_content,
    letterData.pdf_base64,
    Buffer.from(letterData.pdf_base64, 'base64').length,
    additionalData.subject || `${template.template_type} - ${employee.employee_name}`,
    generatedBy
  ]);
  
  return {
    letter_id: letterId,
    letter_number: letterNumber,
    pdf_base64: letterData.pdf_base64
  };
}

function generateLetterNumber(letterType, employeeId) {
  const typeCode = letterType.toUpperCase().replace(/_/g, '').substring(0, 3);
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  
  return `LTR/${typeCode}/${year}/${month}/${employeeId}/${seq}`;
}
```

**Business Rules**:
- Unique letter number per generated letter
- Store both HTML and PDF versions
- Denormalize employee details for history
- Track template version used
- Initial status: 'generated'
- Store file size for quota management
- Support digital signatures
- Track complete revision history

---

#### 7.2.2 Letter Distribution & Delivery

**Rule**: Send letters to employees via email with tracking

**Distribution**:
```javascript
async function sendLetter(letterId, recipientEmail) {
  const letter = await db.query(`
    SELECT * FROM generated_letters WHERE id = ?
  `, [letterId]);
  
  if (letter.status === 'cancelled') {
    throw new Error('Cannot send cancelled letter');
  }
  
  // Get PDF
  const pdfBuffer = Buffer.from(letter.file_data, 'base64');
  
  // Send email
  const emailResult = await sendEmail({
    to: recipientEmail || letter.email_sent_to,
    subject: letter.subject,
    html: `
      <p>Dear ${letter.employee_name},</p>
      <p>Please find your ${letter.letter_type.replace(/_/g, ' ')} attached.</p>
      <p>Letter Number: ${letter.letter_number}</p>
      <p>Date: ${formatDate(letter.letter_date)}</p>
      ${letter.letter_type === 'offer_letter' ? 
        '<p>Please acknowledge receipt by logging into the employee portal.</p>' : ''}
      <p>Best regards,<br/>HR Team</p>
    `,
    attachments: [{
      filename: `${letter.letter_type}_${letter.employee_id}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }]
  });
  
  // Update letter
  await db.query(`
    UPDATE generated_letters
    SET email_sent = true,
        email_sent_at = CURRENT_TIMESTAMP,
        email_sent_to = ?,
        email_delivery_status = 'delivered',
        status = 'sent'
    WHERE id = ?
  `, [recipientEmail, letterId]);
  
  // Notify employee
  await sendNotification({
    user_id: letter.employee_id,
    type: 'letter_received',
    title: `${letter.letter_type.replace(/_/g, ' ')} Available`,
    message: `Your ${letter.letter_type.replace(/_/g, ' ')} has been sent to your email.`,
    priority: 'high'
  });
  
  return { success: true, email_delivery_status: 'delivered' };
}

async function bulkSendLetters(letterIds) {
  const results = [];
  
  for (const letterId of letterIds) {
    try {
      const result = await sendLetter(letterId);
      results.push({ letterId, success: true });
      
      // Rate limiting
      await sleep(200);
    } catch (error) {
      results.push({ letterId, success: false, error: error.message });
    }
  }
  
  return results;
}

async function trackEmailDelivery(letterId, deliveryStatus) {
  // Called by email service webhook
  await db.query(`
    UPDATE generated_letters
    SET email_delivery_status = ?
    WHERE id = ?
  `, [deliveryStatus, letterId]);
  
  if (deliveryStatus === 'bounced' || deliveryStatus === 'failed') {
    const letter = await db.query(`
      SELECT employee_id, employee_name, letter_type FROM generated_letters WHERE id = ?
    `, [letterId]);
    
    // Alert HR
    await sendNotification({
      user_id: 'hr_team',
      type: 'letter_delivery_failed',
      title: 'Letter Delivery Failed',
      message: `Letter delivery failed for ${letter.employee_name} (${letter.letter_type})`,
      priority: 'high'
    });
  }
  
  return { success: true };
}
```

**Business Rules**:
- Send as email attachment (PDF)
- Track delivery status (delivered, failed, bounced)
- Update status from 'generated' to 'sent'
- Store recipient email address
- Support bulk sending with rate limiting
- Notify employee on successful delivery
- Alert HR on delivery failures
- Integrate with email service webhooks

---

#### 7.2.3 Employee Access & Downloads

**Rule**: Allow employees to view and download their letters

**Employee Portal Access**:
```javascript
async function getEmployeeLetters(employeeId, filters = {}) {
  let query = `
    SELECT 
      id, letter_number, letter_type, subject,
      letter_date, status, is_signed,
      download_count, view_count,
      email_sent, email_sent_at,
      generated_at
    FROM generated_letters
    WHERE employee_id = ? AND status != 'cancelled'
  `;
  
  const params = [employeeId];
  
  if (filters.letter_type) {
    query += ` AND letter_type = ?`;
    params.push(filters.letter_type);
  }
  
  if (filters.year) {
    query += ` AND YEAR(letter_date) = ?`;
    params.push(filters.year);
  }
  
  query += ` ORDER BY letter_date DESC, generated_at DESC`;
  
  return await db.query(query, params);
}

async function viewLetter(letterId, employeeId) {
  const letter = await db.query(`
    SELECT * FROM generated_letters
    WHERE id = ? AND employee_id = ?
  `, [letterId, employeeId]);
  
  if (!letter) {
    throw new Error('Letter not found or access denied');
  }
  
  // Update view count
  await db.query(`
    UPDATE generated_letters
    SET view_count = view_count + 1,
        last_viewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [letterId]);
  
  return {
    letter_number: letter.letter_number,
    letter_type: letter.letter_type,
    subject: letter.subject,
    letter_content: letter.letter_content,
    letter_date: letter.letter_date,
    status: letter.status
  };
}

async function downloadLetter(letterId, employeeId) {
  const letter = await db.query(`
    SELECT * FROM generated_letters
    WHERE id = ? AND employee_id = ?
  `, [letterId, employeeId]);
  
  if (!letter) {
    throw new Error('Letter not found or access denied');
  }
  
  if (letter.status === 'cancelled') {
    throw new Error('This letter has been cancelled');
  }
  
  // Update download tracking
  await db.query(`
    UPDATE generated_letters
    SET download_count = download_count + 1,
        first_downloaded_at = COALESCE(first_downloaded_at, CURRENT_TIMESTAMP),
        last_downloaded_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [letterId]);
  
  return {
    filename: `${letter.letter_type}_${letter.employee_id}_${letter.letter_number}.pdf`,
    content: Buffer.from(letter.file_data, 'base64'),
    contentType: 'application/pdf'
  };
}
```

**Business Rules**:
- Employees can view only their own letters
- Show letter list with filters (type, year)
- Track view count and timestamps
- Track download count and timestamps
- Cannot download cancelled letters
- Provide both view (HTML) and download (PDF)
- Unlimited downloads allowed
- Show letter status badges

---

#### 7.2.4 Letter Acknowledgment & Digital Signature

**Rule**: Track employee acknowledgment and signatures

**Acknowledgment**:
```javascript
async function acknowledgeLetter(letterId, employeeId, acknowledgeData) {
  const letter = await db.query(`
    SELECT * FROM generated_letters
    WHERE id = ? AND employee_id = ?
  `, [letterId, employeeId]);
  
  if (!letter) {
    throw new Error('Letter not found or access denied');
  }
  
  if (letter.acknowledged_by_employee) {
    throw new Error('Letter already acknowledged');
  }
  
  await db.query(`
    UPDATE generated_letters
    SET acknowledged_by_employee = true,
        acknowledgment_date = CURRENT_TIMESTAMP,
        acknowledgment_ip = ?,
        acknowledgment_comments = ?,
        status = 'acknowledged'
    WHERE id = ?
  `, [
    acknowledgeData.ip_address,
    acknowledgeData.comments,
    letterId
  ]);
  
  // Notify HR
  await sendNotification({
    user_id: 'hr_team',
    type: 'letter_acknowledged',
    title: 'Letter Acknowledged',
    message: `${letter.employee_name} has acknowledged ${letter.letter_type}`,
    priority: 'medium'
  });
  
  return { success: true };
}

async function signLetter(letterId, employeeId, signatureData) {
  const letter = await db.query(`
    SELECT * FROM generated_letters
    WHERE id = ? AND employee_id = ?
  `, [letterId, employeeId]);
  
  if (!letter) {
    throw new Error('Letter not found or access denied');
  }
  
  if (letter.is_signed) {
    throw new Error('Letter already signed');
  }
  
  await db.query(`
    UPDATE generated_letters
    SET is_signed = true,
        signed_date = CURRENT_DATE,
        signature_data = ?,
        acknowledged_by_employee = true,
        acknowledgment_date = CURRENT_TIMESTAMP,
        status = 'acknowledged'
    WHERE id = ?
  `, [signatureData.signature_base64, letterId]);
  
  // Generate signed PDF
  const signedPDF = await addSignatureToPDF(
    Buffer.from(letter.file_data, 'base64'),
    signatureData.signature_base64
  );
  
  await db.query(`
    UPDATE generated_letters
    SET file_data = ?
    WHERE id = ?
  `, [signedPDF.toString('base64'), letterId]);
  
  return { success: true };
}

async function getUnacknowledgedLetters(filters = {}) {
  let query = `
    SELECT 
      gl.id, gl.letter_number, gl.employee_id, gl.employee_name,
      gl.letter_type, gl.letter_date, gl.email_sent_at,
      DATEDIFF(CURRENT_DATE, gl.email_sent_at) as days_pending
    FROM generated_letters gl
    WHERE gl.status = 'sent'
      AND gl.acknowledged_by_employee = false
      AND gl.email_sent = true
  `;
  
  const params = [];
  
  if (filters.min_days) {
    query += ` AND DATEDIFF(CURRENT_DATE, gl.email_sent_at) >= ?`;
    params.push(filters.min_days);
  }
  
  query += ` ORDER BY days_pending DESC`;
  
  return await db.query(query, params);
}
```

**Business Rules**:
- Track acknowledgment timestamp and IP
- Allow optional comments during acknowledgment
- Support digital signature capture
- Store signature as base64 image
- Add signature to PDF after signing
- Cannot acknowledge twice
- Notify HR on acknowledgment
- Track unacknowledged letters
- Send reminders after 7 days

---

#### 7.2.5 Letter Revision & Regeneration

**Rule**: Support letter revisions with complete history

**Revision**:
```javascript
async function reviseLetter(letterId, revisionData, revisedBy) {
  const originalLetter = await db.query(`
    SELECT * FROM generated_letters WHERE id = ?
  `, [letterId]);
  
  if (originalLetter.status === 'cancelled') {
    throw new Error('Cannot revise cancelled letter');
  }
  
  // Mark original as revised
  await db.query(`
    UPDATE generated_letters
    SET is_revised = true
    WHERE id = ?
  `, [letterId]);
  
  // Generate new letter with changes
  const newLetter = await createGeneratedLetter(
    originalLetter.employee_id,
    originalLetter.template_id,
    revisionData.additional_data,
    revisedBy
  );
  
  // Link to original
  await db.query(`
    UPDATE generated_letters
    SET parent_letter_id = ?,
        revision_number = ?,
        revision_reason = ?
    WHERE id = ?
  `, [
    letterId,
    originalLetter.revision_number + 1,
    revisionData.reason,
    newLetter.letter_id
  ]);
  
  // Notify employee
  await sendNotification({
    user_id: originalLetter.employee_id,
    type: 'letter_revised',
    title: 'Revised Letter Available',
    message: `A revised version of your ${originalLetter.letter_type} is now available.`,
    priority: 'high'
  });
  
  return newLetter;
}

async function regenerateLetter(letterId, regeneratedBy) {
  const letter = await db.query(`
    SELECT * FROM generated_letters WHERE id = ?
  `, [letterId]);
  
  // Generate new PDF from stored content
  const pdfBuffer = await generatePDFFromHTML(letter.letter_content);
  
  await db.query(`
    UPDATE generated_letters
    SET file_data = ?,
        file_size = ?
    WHERE id = ?
  `, [
    pdfBuffer.toString('base64'),
    pdfBuffer.length,
    letterId
  ]);
  
  return { success: true, file_size: pdfBuffer.length };
}

async function getLetterRevisionHistory(letterId) {
  return await db.query(`
    SELECT 
      id, letter_number, revision_number,
      letter_date, status, is_signed,
      generated_at, generated_by, revision_reason
    FROM generated_letters
    WHERE id = ? OR parent_letter_id = ?
    ORDER BY revision_number, generated_at
  `, [letterId, letterId]);
}
```

**Business Rules**:
- Mark original letter as revised
- Create new letter with incremented revision number
- Link revisions via parent_letter_id
- Store revision reason
- Notify employee of revised letter
- Maintain complete revision history
- Support PDF regeneration from HTML
- Cannot revise cancelled letters

---

#### 7.2.6 Letter Cancellation & Expiry

**Rule**: Handle letter cancellation and expiry

**Cancellation**:
```javascript
async function cancelLetter(letterId, cancelledBy, reason) {
  const letter = await db.query(`
    SELECT * FROM generated_letters WHERE id = ?
  `, [letterId]);
  
  if (letter.status === 'acknowledged') {
    throw new Error('Cannot cancel acknowledged letter. Create a revised version instead.');
  }
  
  await db.query(`
    UPDATE generated_letters
    SET status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancelled_by = ?,
        cancellation_reason = ?
    WHERE id = ?
  `, [cancelledBy, reason, letterId]);
  
  // Notify employee
  await sendNotification({
    user_id: letter.employee_id,
    type: 'letter_cancelled',
    title: 'Letter Cancelled',
    message: `Your ${letter.letter_type} (${letter.letter_number}) has been cancelled. Reason: ${reason}`,
    priority: 'high'
  });
  
  return { success: true };
}

async function checkExpiredLetters() {
  // Mark expired offer letters
  await db.query(`
    UPDATE generated_letters
    SET status = 'expired'
    WHERE letter_type = 'offer_letter'
      AND expiry_date < CURRENT_DATE
      AND status = 'sent'
  `);
  
  // Get expired letters
  const expired = await db.query(`
    SELECT id, employee_id, employee_name, letter_number, expiry_date
    FROM generated_letters
    WHERE status = 'expired'
      AND expiry_date = CURRENT_DATE - INTERVAL 1 DAY
  `);
  
  // Notify HR
  for (const letter of expired) {
    await sendNotification({
      user_id: 'hr_team',
      type: 'offer_expired',
      title: 'Offer Letter Expired',
      message: `Offer letter ${letter.letter_number} for ${letter.employee_name} has expired`,
      priority: 'medium'
    });
  }
  
  return { expired_count: expired.length };
}
```

**Business Rules**:
- Cannot cancel acknowledged letters
- Store cancellation reason and timestamp
- Notify employee on cancellation
- Offer letters have expiry dates
- Auto-mark as expired after expiry_date
- Notify HR on offer expiry
- Cancelled letters remain in system (audit)
- Cannot download cancelled letters

---

#### 7.2.7 Letter Search & Reporting

**Rule**: Comprehensive letter search and analytics

**Search & Reports**:
```javascript
async function searchLetters(criteria) {
  let query = `
    SELECT 
      gl.id, gl.letter_number, gl.employee_id, gl.employee_name,
      gl.department, gl.designation, gl.letter_type,
      gl.letter_date, gl.status, gl.is_signed,
      gl.email_sent, gl.acknowledged_by_employee,
      gl.generated_at
    FROM generated_letters gl
    WHERE 1=1
  `;
  
  const params = [];
  
  if (criteria.employee_id) {
    query += ` AND gl.employee_id = ?`;
    params.push(criteria.employee_id);
  }
  
  if (criteria.letter_type) {
    query += ` AND gl.letter_type = ?`;
    params.push(criteria.letter_type);
  }
  
  if (criteria.department) {
    query += ` AND gl.department = ?`;
    params.push(criteria.department);
  }
  
  if (criteria.status) {
    query += ` AND gl.status = ?`;
    params.push(criteria.status);
  }
  
  if (criteria.start_date) {
    query += ` AND gl.letter_date >= ?`;
    params.push(criteria.start_date);
  }
  
  if (criteria.end_date) {
    query += ` AND gl.letter_date <= ?`;
    params.push(criteria.end_date);
  }
  
  if (criteria.is_signed !== undefined) {
    query += ` AND gl.is_signed = ?`;
    params.push(criteria.is_signed);
  }
  
  if (criteria.search) {
    query += ` AND (gl.employee_name LIKE ? OR gl.letter_number LIKE ?)`;
    params.push(`%${criteria.search}%`, `%${criteria.search}%`);
  }
  
  query += ` ORDER BY gl.generated_at DESC`;
  
  return await db.query(query, params);
}

async function getLetterAnalytics(filters = {}) {
  return await db.query(`
    SELECT 
      letter_type,
      COUNT(*) as total_letters,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
      SUM(CASE WHEN acknowledged_by_employee THEN 1 ELSE 0 END) as acknowledged_count,
      SUM(CASE WHEN is_signed THEN 1 ELSE 0 END) as signed_count,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
      AVG(download_count) as avg_downloads,
      ROUND((SUM(CASE WHEN acknowledged_by_employee THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as acknowledgment_rate
    FROM generated_letters
    WHERE YEAR(letter_date) = ?
    GROUP BY letter_type
  `, [filters.year || new Date().getFullYear()]);
}

async function getDepartmentLetterReport() {
  return await db.query(`
    SELECT 
      department,
      COUNT(DISTINCT employee_id) as unique_employees,
      COUNT(*) as total_letters,
      SUM(CASE WHEN letter_type = 'offer_letter' THEN 1 ELSE 0 END) as offers,
      SUM(CASE WHEN letter_type = 'appointment_letter' THEN 1 ELSE 0 END) as appointments,
      SUM(CASE WHEN letter_type = 'relieving_letter' THEN 1 ELSE 0 END) as relievings
    FROM generated_letters
    WHERE YEAR(letter_date) = YEAR(CURRENT_DATE)
    GROUP BY department
    ORDER BY total_letters DESC
  `);
}
```

**Business Rules**:
- Search by employee, type, department, status
- Filter by date range
- Support full-text search
- Generate analytics by letter type
- Track acknowledgment rates
- Department-wise letter distribution
- Monthly/yearly letter trends
- Export search results to Excel

---

#### 7.2.8 Bulk Operations

**Rule**: Bulk letter operations for efficiency

**Bulk Operations**:
```javascript
async function bulkGenerateLetters(templateId, employeeIds, commonData, generatedBy) {
  const results = [];
  
  for (const employeeId of employeeIds) {
    try {
      const letter = await createGeneratedLetter(
        employeeId,
        templateId,
        commonData,
        generatedBy
      );
      results.push({
        employee_id: employeeId,
        success: true,
        letter_id: letter.letter_id,
        letter_number: letter.letter_number
      });
    } catch (error) {
      results.push({
        employee_id: employeeId,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function bulkDownloadLetters(letterIds) {
  const letters = await db.query(`
    SELECT id, letter_number, file_data FROM generated_letters
    WHERE id IN (?)
  `, [letterIds]);
  
  // Create ZIP file
  const zip = new JSZip();
  
  for (const letter of letters) {
    zip.file(
      `${letter.letter_number}.pdf`,
      Buffer.from(letter.file_data, 'base64')
    );
  }
  
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  
  return {
    filename: `letters_${new Date().toISOString().split('T')[0]}.zip`,
    content: zipBuffer,
    contentType: 'application/zip'
  };
}

async function bulkCancelLetters(letterIds, cancelledBy, reason) {
  const results = [];
  
  for (const letterId of letterIds) {
    try {
      await cancelLetter(letterId, cancelledBy, reason);
      results.push({ letterId, success: true });
    } catch (error) {
      results.push({ letterId, success: false, error: error.message });
    }
  }
  
  return results;
}
```

**Business Rules**:
- Generate multiple letters at once
- Send bulk emails with rate limiting
- Download multiple letters as ZIP
- Bulk cancel with common reason
- Track bulk operation results
- Show success/failure summary
- Support background processing for large batches

---

#### 7.2.9 Letter Archival & Compliance

**Rule**: Archive letters for statutory compliance

**Archival**:
```javascript
async function archiveLetters(year, month) {
  const letters = await db.query(`
    SELECT * FROM generated_letters
    WHERE YEAR(letter_date) = ? AND MONTH(letter_date) = ?
  `, [year, month]);
  
  // Create archive manifest
  const manifest = {
    year,
    month,
    total_letters: letters.length,
    archive_date: new Date().toISOString(),
    letters: letters.map(l => ({
      letter_number: l.letter_number,
      employee_id: l.employee_id,
      letter_type: l.letter_type,
      letter_date: l.letter_date,
      status: l.status
    }))
  };
  
  // Save to archive storage
  const archivePath = `letters/archive/${year}/${month}/manifest.json`;
  await saveToArchive(archivePath, JSON.stringify(manifest, null, 2));
  
  // Move PDFs to archive
  for (const letter of letters) {
    const pdfPath = `letters/archive/${year}/${month}/${letter.letter_number}.pdf`;
    await saveToArchive(pdfPath, Buffer.from(letter.file_data, 'base64'));
  }
  
  return { archived: letters.length, manifest_path: archivePath };
}

async function getLetterRetentionReport() {
  return await db.query(`
    SELECT 
      YEAR(letter_date) as year,
      COUNT(*) as total_letters,
      SUM(file_size) as total_size_bytes,
      MIN(letter_date) as oldest_letter,
      MAX(letter_date) as newest_letter
    FROM generated_letters
    GROUP BY YEAR(letter_date)
    ORDER BY year DESC
  `);
}
```

**Business Rules**:
- Retain letters for 7 years (statutory)
- Archive monthly after 1 year
- Create archive manifest with metadata
- Store in immutable storage
- Support archive retrieval
- Track storage usage
- Encrypt archived letters
- Generate retention compliance reports

---

#### 7.2.10 Letter Notifications & Reminders

**Rule**: Automated notifications and reminders

**Notifications**:
```javascript
async function sendLetterReminders() {
  // 1. Unacknowledged offer letters (7 days)
  const unacknowledgedOffers = await db.query(`
    SELECT * FROM generated_letters
    WHERE letter_type = 'offer_letter'
      AND status = 'sent'
      AND acknowledged_by_employee = false
      AND email_sent_at < DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
  `);
  
  for (const letter of unacknowledgedOffers) {
    await sendEmail({
      to: letter.email_sent_to,
      subject: `Reminder: Acknowledge Your Offer Letter`,
      html: `
        <p>Dear ${letter.employee_name},</p>
        <p>This is a reminder to acknowledge your offer letter sent on ${formatDate(letter.email_sent_at)}.</p>
        <p>Please log in to the employee portal to review and acknowledge.</p>
      `
    });
  }
  
  // 2. Expiring offer letters (3 days before)
  const expiringOffers = await db.query(`
    SELECT * FROM generated_letters
    WHERE letter_type = 'offer_letter'
      AND status = 'sent'
      AND expiry_date BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE, INTERVAL 3 DAY)
  `);
  
  for (const letter of expiringOffers) {
    await sendEmail({
      to: 'hr@company.com',
      subject: `Offer Letter Expiring Soon - ${letter.employee_name}`,
      html: `
        <p>Offer letter ${letter.letter_number} for ${letter.employee_name} expires on ${formatDate(letter.expiry_date)}.</p>
        <p>Status: ${letter.status}</p>
        <p>Acknowledged: ${letter.acknowledged_by_employee ? 'Yes' : 'No'}</p>
      `
    });
  }
  
  return {
    acknowledgment_reminders: unacknowledgedOffers.length,
    expiry_alerts: expiringOffers.length
  };
}

async function notifyHROnLetterGeneration(letterId) {
  const letter = await db.query(`
    SELECT * FROM generated_letters WHERE id = ?
  `, [letterId]);
  
  await sendNotification({
    user_id: 'hr_team',
    type: 'letter_generated',
    title: 'New Letter Generated',
    message: `${letter.letter_type} generated for ${letter.employee_name} (${letter.letter_number})`,
    priority: 'low'
  });
}
```

**Business Rules**:
- Send acknowledgment reminders after 7 days
- Alert HR 3 days before offer expiry
- Notify employee on letter generation
- Notify HR on employee acknowledgment
- Weekly digest of unacknowledged letters
- Alert on delivery failures
- Configurable reminder intervals

---

## 8. System Configuration

### 8.1 SystemSettings Management
**Rule**: Centralized configuration management for system-wide settings and parameters

**Purpose**: Store and manage all system-wide configuration values including statutory rates (PF, ESI, PT), business rules thresholds, feature toggles, calculation parameters, email templates, notification preferences, and operational constants. Enable runtime configuration changes without code deployment, maintain audit trail of configuration changes, support environment-specific settings, and provide validation for critical parameters.

---

#### 8.1.1 SystemSettings Structure & Storage

**Rule**: Structured storage for typed configuration values

**SystemSettings Schema**:
```javascript
const SYSTEM_SETTINGS_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  setting_key: 'VARCHAR(100) UNIQUE NOT NULL',
  setting_value: 'TEXT NOT NULL',
  setting_type: 'ENUM NOT NULL', // 'string', 'number', 'boolean', 'json', 'array'
  setting_category: 'VARCHAR(50) NOT NULL', // 'statutory', 'payroll', 'attendance', 'notification', 'business_rule', 'feature_flag', 'integration'
  
  // Metadata
  description: 'TEXT',
  display_name: 'VARCHAR(255)',
  is_editable: 'BOOLEAN DEFAULT true',
  is_sensitive: 'BOOLEAN DEFAULT false', // Mask in UI
  requires_restart: 'BOOLEAN DEFAULT false',
  
  // Validation
  validation_rules: 'JSONB', // {min, max, pattern, allowed_values}
  default_value: 'TEXT',
  
  // Audit
  updated_at: 'TIMESTAMP',
  updated_by: 'UUID FOREIGN KEY',
  previous_value: 'TEXT',
  change_reason: 'TEXT',
  
  // Environment
  environment: 'VARCHAR(20) DEFAULT "production"', // production, staging, development
  
  created_at: 'TIMESTAMP',
  created_by: 'UUID FOREIGN KEY'
};

// Setting categories
const SETTING_CATEGORIES = {
  STATUTORY: 'statutory', // PF, ESI, PT rates
  PAYROLL: 'payroll', // Payroll processing rules
  ATTENDANCE: 'attendance', // Attendance calculation
  NOTIFICATION: 'notification', // Email/SMS configuration
  BUSINESS_RULE: 'business_rule', // Business logic thresholds
  FEATURE_FLAG: 'feature_flag', // Feature toggles
  INTEGRATION: 'integration', // Third-party integrations
  SYSTEM: 'system' // System behavior
};

// Setting types
const SETTING_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json',
  ARRAY: 'array'
};
```

**Get Setting**:
```javascript
async function getSetting(settingKey, defaultValue = null) {
  const setting = await db.query(`
    SELECT setting_value, setting_type FROM system_settings
    WHERE setting_key = ? AND environment = ?
  `, [settingKey, process.env.NODE_ENV || 'production']);
  
  if (!setting) {
    return defaultValue;
  }
  
  // Parse based on type
  switch (setting.setting_type) {
    case 'number':
      return parseFloat(setting.setting_value);
    case 'boolean':
      return setting.setting_value === 'true';
    case 'json':
      return JSON.parse(setting.setting_value);
    case 'array':
      return JSON.parse(setting.setting_value);
    default:
      return setting.setting_value;
  }
}

async function getAllSettings(category = null) {
  let query = `
    SELECT setting_key, setting_value, setting_type, setting_category,
           display_name, description, is_editable, is_sensitive
    FROM system_settings
    WHERE environment = ?
  `;
  
  const params = [process.env.NODE_ENV || 'production'];
  
  if (category) {
    query += ` AND setting_category = ?`;
    params.push(category);
  }
  
  query += ` ORDER BY setting_category, setting_key`;
  
  const settings = await db.query(query, params);
  
  // Parse values and mask sensitive ones
  return settings.map(s => ({
    key: s.setting_key,
    value: s.is_sensitive ? '***HIDDEN***' : parseSettingValue(s.setting_value, s.setting_type),
    type: s.setting_type,
    category: s.setting_category,
    display_name: s.display_name,
    description: s.description,
    is_editable: s.is_editable,
    is_sensitive: s.is_sensitive
  }));
}
```

**Business Rules**:
- Unique setting_key per environment
- Store values as TEXT, parse based on type
- Support multiple environments (prod, staging, dev)
- Category-based organization
- Mask sensitive settings in UI
- Cache frequently accessed settings
- Validate on retrieval
- Type-safe value parsing

---

#### 8.1.2 Update Settings & Validation

**Rule**: Validate and audit all setting changes

**Update Setting**:
```javascript
async function updateSetting(settingKey, newValue, updatedBy, changeReason) {
  const setting = await db.query(`
    SELECT * FROM system_settings WHERE setting_key = ?
  `, [settingKey]);
  
  if (!setting) {
    throw new Error(`Setting ${settingKey} not found`);
  }
  
  if (!setting.is_editable) {
    throw new Error(`Setting ${settingKey} is not editable`);
  }
  
  // Validate new value
  await validateSettingValue(settingKey, newValue, setting.validation_rules);
  
  // Convert to string for storage
  const valueString = typeof newValue === 'object' 
    ? JSON.stringify(newValue) 
    : String(newValue);
  
  // Update setting
  await db.query(`
    UPDATE system_settings
    SET setting_value = ?,
        previous_value = setting_value,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = ?,
        change_reason = ?
    WHERE setting_key = ?
  `, [valueString, updatedBy, changeReason, settingKey]);
  
  // Log change
  await db.query(`
    INSERT INTO system_settings_history (
      setting_key, old_value, new_value, changed_by, change_reason
    ) VALUES (?, ?, ?, ?, ?)
  `, [settingKey, setting.setting_value, valueString, updatedBy, changeReason]);
  
  // Clear cache
  await clearSettingCache(settingKey);
  
  // Notify if requires restart
  if (setting.requires_restart) {
    await sendNotification({
      user_id: 'admin',
      type: 'setting_changed_restart_required',
      title: 'Setting Changed - Restart Required',
      message: `Setting ${setting.display_name} has been changed. Application restart required.`,
      priority: 'high'
    });
  }
  
  return { success: true, requires_restart: setting.requires_restart };
}

async function validateSettingValue(settingKey, value, validationRules) {
  if (!validationRules) return;
  
  const rules = typeof validationRules === 'string' 
    ? JSON.parse(validationRules) 
    : validationRules;
  
  // Numeric validation
  if (rules.min !== undefined && value < rules.min) {
    throw new Error(`${settingKey} must be >= ${rules.min}`);
  }
  
  if (rules.max !== undefined && value > rules.max) {
    throw new Error(`${settingKey} must be <= ${rules.max}`);
  }
  
  // String pattern
  if (rules.pattern && typeof value === 'string') {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(value)) {
      throw new Error(`${settingKey} does not match required pattern`);
    }
  }
  
  // Allowed values (enum)
  if (rules.allowed_values && Array.isArray(rules.allowed_values)) {
    if (!rules.allowed_values.includes(value)) {
      throw new Error(`${settingKey} must be one of: ${rules.allowed_values.join(', ')}`);
    }
  }
  
  // Custom validation function
  if (rules.custom_validator) {
    const isValid = await eval(rules.custom_validator)(value);
    if (!isValid) {
      throw new Error(`${settingKey} failed custom validation`);
    }
  }
}

async function bulkUpdateSettings(updates, updatedBy, changeReason) {
  const results = [];
  
  for (const {key, value} of updates) {
    try {
      await updateSetting(key, value, updatedBy, changeReason);
      results.push({ key, success: true });
    } catch (error) {
      results.push({ key, success: false, error: error.message });
    }
  }
  
  return results;
}
```

**Business Rules**:
- Only editable settings can be updated
- Validate against validation_rules
- Store previous value for rollback
- Log all changes with reason
- Clear cache after update
- Notify if restart required
- Support bulk updates
- Atomic updates with transaction

---

#### 8.1.3 Statutory Rate Configuration (PF, ESI, PT)

**Rule**: Manage statutory compliance rates and thresholds

**Statutory Settings**:
```javascript
const STATUTORY_SETTINGS = {
  // Provident Fund (PF)
  PF_WAGE_CEILING_MONTHLY: {
    key: 'PF_WAGE_CEILING_MONTHLY',
    value: 15000,
    type: 'number',
    category: 'statutory',
    description: 'Monthly wage ceiling for PF calculation',
    validation_rules: { min: 0, max: 50000 },
    is_editable: true
  },
  PF_EMPLOYEE_RATE: {
    key: 'PF_EMPLOYEE_RATE',
    value: 0.12,
    type: 'number',
    category: 'statutory',
    description: 'Employee PF contribution rate (12%)',
    validation_rules: { min: 0, max: 1 },
    is_editable: true
  },
  PF_EMPLOYER_RATE: {
    key: 'PF_EMPLOYER_RATE',
    value: 0.12,
    type: 'number',
    category: 'statutory',
    description: 'Employer PF contribution rate (12%)',
    validation_rules: { min: 0, max: 1 },
    is_editable: true
  },
  PF_EMPLOYER_PENSION_RATE: {
    key: 'PF_EMPLOYER_PENSION_RATE',
    value: 0.0833,
    type: 'number',
    category: 'statutory',
    description: 'Employer pension contribution rate (8.33%)',
    validation_rules: { min: 0, max: 1 },
    is_editable: true
  },
  PF_EMPLOYER_PF_RATE: {
    key: 'PF_EMPLOYER_PF_RATE',
    value: 0.0367,
    type: 'number',
    category: 'statutory',
    description: 'Employer PF contribution rate after pension (3.67%)',
    validation_rules: { min: 0, max: 1 },
    is_editable: true
  },
  
  // Employee State Insurance (ESI)
  ESI_WAGE_CEILING_MONTHLY: {
    key: 'ESI_WAGE_CEILING_MONTHLY',
    value: 21000,
    type: 'number',
    category: 'statutory',
    description: 'Monthly wage ceiling for ESI applicability',
    validation_rules: { min: 0, max: 50000 },
    is_editable: true
  },
  ESI_EMPLOYEE_RATE: {
    key: 'ESI_EMPLOYEE_RATE',
    value: 0.0075,
    type: 'number',
    category: 'statutory',
    description: 'Employee ESI contribution rate (0.75%)',
    validation_rules: { min: 0, max: 1 },
    is_editable: true
  },
  ESI_EMPLOYER_RATE: {
    key: 'ESI_EMPLOYER_RATE',
    value: 0.0325,
    type: 'number',
    category: 'statutory',
    description: 'Employer ESI contribution rate (3.25%)',
    validation_rules: { min: 0, max: 1 },
    is_editable: true
  },
  
  // Professional Tax (PT)
  PT_SLABS: {
    key: 'PT_SLABS',
    value: JSON.stringify([
      { min: 0, max: 10000, tax: 0 },
      { min: 10001, max: 15000, tax: 175 },
      { min: 15001, max: 25000, tax: 200 },
      { min: 25001, max: 999999, tax: 200 }
    ]),
    type: 'json',
    category: 'statutory',
    description: 'Professional Tax slabs (Karnataka)',
    is_editable: true
  },
  PT_MAX_ANNUAL: {
    key: 'PT_MAX_ANNUAL',
    value: 2500,
    type: 'number',
    category: 'statutory',
    description: 'Maximum PT deduction per year',
    validation_rules: { min: 0, max: 10000 },
    is_editable: true
  }
};

async function getPFRates() {
  return {
    wage_ceiling: await getSetting('PF_WAGE_CEILING_MONTHLY', 15000),
    employee_rate: await getSetting('PF_EMPLOYEE_RATE', 0.12),
    employer_rate: await getSetting('PF_EMPLOYER_RATE', 0.12),
    employer_pension_rate: await getSetting('PF_EMPLOYER_PENSION_RATE', 0.0833),
    employer_pf_rate: await getSetting('PF_EMPLOYER_PF_RATE', 0.0367)
  };
}

async function getESIRates() {
  return {
    wage_ceiling: await getSetting('ESI_WAGE_CEILING_MONTHLY', 21000),
    employee_rate: await getSetting('ESI_EMPLOYEE_RATE', 0.0075),
    employer_rate: await getSetting('ESI_EMPLOYER_RATE', 0.0325)
  };
}

async function getPTSlabs() {
  return await getSetting('PT_SLABS', [
    { min: 0, max: 10000, tax: 0 },
    { min: 10001, max: 15000, tax: 175 },
    { min: 15001, max: 999999, tax: 200 }
  ]);
}
```

**Business Rules**:
- PF wage ceiling: ₹15,000/month (updatable)
- PF rates: Employee 12%, Employer 12% (split into 8.33% pension + 3.67% PF)
- ESI wage ceiling: ₹21,000/month
- ESI rates: Employee 0.75%, Employer 3.25%
- PT slabs: State-specific (Karnataka default)
- Update rates when government changes regulations
- Validate rates are within legal limits
- Notify payroll team on rate changes

---

#### 8.1.4 Payroll Business Rules Configuration

**Rule**: Configurable payroll calculation parameters

**Payroll Settings**:
```javascript
const PAYROLL_SETTINGS = {
  // Attendance
  WORKING_DAYS_PER_MONTH: {
    key: 'WORKING_DAYS_PER_MONTH',
    value: 26,
    type: 'number',
    category: 'payroll',
    description: 'Standard working days per month',
    validation_rules: { min: 20, max: 31 },
    is_editable: true
  },
  WORKING_HOURS_PER_DAY: {
    key: 'WORKING_HOURS_PER_DAY',
    value: 8,
    type: 'number',
    category: 'payroll',
    description: 'Standard working hours per day',
    validation_rules: { min: 6, max: 12 },
    is_editable: true
  },
  HALF_DAY_HOURS: {
    key: 'HALF_DAY_HOURS',
    value: 4,
    type: 'number',
    category: 'payroll',
    description: 'Hours required for half day attendance',
    validation_rules: { min: 3, max: 6 },
    is_editable: true
  },
  
  // Leave
  LEAVE_ENCASHMENT_ENABLED: {
    key: 'LEAVE_ENCASHMENT_ENABLED',
    value: true,
    type: 'boolean',
    category: 'payroll',
    description: 'Enable leave encashment in payroll',
    is_editable: true
  },
  MAX_LEAVE_ENCASHMENT_DAYS: {
    key: 'MAX_LEAVE_ENCASHMENT_DAYS',
    value: 15,
    type: 'number',
    category: 'payroll',
    description: 'Maximum days allowed for leave encashment',
    validation_rules: { min: 0, max: 30 },
    is_editable: true
  },
  
  // Overtime
  OVERTIME_ENABLED: {
    key: 'OVERTIME_ENABLED',
    value: true,
    type: 'boolean',
    category: 'payroll',
    description: 'Enable overtime calculations',
    is_editable: true
  },
  OVERTIME_RATE_MULTIPLIER: {
    key: 'OVERTIME_RATE_MULTIPLIER',
    value: 2.0,
    type: 'number',
    category: 'payroll',
    description: 'Overtime hourly rate multiplier (2x = double)',
    validation_rules: { min: 1, max: 3 },
    is_editable: true
  },
  OVERTIME_THRESHOLD_HOURS: {
    key: 'OVERTIME_THRESHOLD_HOURS',
    value: 8,
    type: 'number',
    category: 'payroll',
    description: 'Hours per day after which overtime applies',
    validation_rules: { min: 6, max: 12 },
    is_editable: true
  },
  
  // Arrears
  AUTO_CALCULATE_ARREARS: {
    key: 'AUTO_CALCULATE_ARREARS',
    value: true,
    type: 'boolean',
    category: 'payroll',
    description: 'Automatically calculate arrears on salary revisions',
    is_editable: true
  },
  
  // Pro-rating
  PRORATION_METHOD: {
    key: 'PRORATION_METHOD',
    value: 'calendar_days',
    type: 'string',
    category: 'payroll',
    description: 'Method for salary proration',
    validation_rules: {
      allowed_values: ['calendar_days', 'working_days', 'monthly']
    },
    is_editable: true
  },
  
  // Rounding
  SALARY_ROUNDING_METHOD: {
    key: 'SALARY_ROUNDING_METHOD',
    value: 'nearest',
    type: 'string',
    category: 'payroll',
    description: 'Salary component rounding method',
    validation_rules: {
      allowed_values: ['floor', 'ceil', 'nearest', 'none']
    },
    is_editable: true
  },
  SALARY_ROUNDING_PRECISION: {
    key: 'SALARY_ROUNDING_PRECISION',
    value: 0,
    type: 'number',
    category: 'payroll',
    description: 'Decimal places for salary rounding (0 = whole rupees)',
    validation_rules: { min: 0, max: 2 },
    is_editable: true
  }
};

async function getPayrollSettings() {
  return {
    working_days_per_month: await getSetting('WORKING_DAYS_PER_MONTH', 26),
    working_hours_per_day: await getSetting('WORKING_HOURS_PER_DAY', 8),
    half_day_hours: await getSetting('HALF_DAY_HOURS', 4),
    leave_encashment_enabled: await getSetting('LEAVE_ENCASHMENT_ENABLED', true),
    max_leave_encashment_days: await getSetting('MAX_LEAVE_ENCASHMENT_DAYS', 15),
    overtime_enabled: await getSetting('OVERTIME_ENABLED', true),
    overtime_rate_multiplier: await getSetting('OVERTIME_RATE_MULTIPLIER', 2.0),
    overtime_threshold_hours: await getSetting('OVERTIME_THRESHOLD_HOURS', 8),
    auto_calculate_arrears: await getSetting('AUTO_CALCULATE_ARREARS', true),
    proration_method: await getSetting('PRORATION_METHOD', 'calendar_days'),
    salary_rounding_method: await getSetting('SALARY_ROUNDING_METHOD', 'nearest'),
    salary_rounding_precision: await getSetting('SALARY_ROUNDING_PRECISION', 0)
  };
}
```

**Business Rules**:
- Working days default: 26/month
- Working hours default: 8/day
- Overtime: 2× rate after 8 hours
- Proration methods: calendar_days, working_days, monthly
- Rounding: floor, ceil, nearest, or none
- Leave encashment: max 15 days/year
- All parameters configurable per company policy

---

#### 8.1.5 Loan & Advance Configuration

**Rule**: Configure loan and advance business rules

**Loan Settings**:
```javascript
const LOAN_ADVANCE_SETTINGS = {
  // Advance settings
  ADVANCE_MAX_PERCENTAGE: {
    key: 'ADVANCE_MAX_PERCENTAGE',
    value: 50,
    type: 'number',
    category: 'business_rule',
    description: 'Maximum advance as % of monthly salary',
    validation_rules: { min: 0, max: 100 },
    is_editable: true
  },
  ADVANCE_MIN_TENURE_MONTHS: {
    key: 'ADVANCE_MIN_TENURE_MONTHS',
    value: 3,
    type: 'number',
    category: 'business_rule',
    description: 'Minimum tenure (months) to request advance',
    validation_rules: { min: 0, max: 24 },
    is_editable: true
  },
  ADVANCE_MAX_COUNT_PER_YEAR: {
    key: 'ADVANCE_MAX_COUNT_PER_YEAR',
    value: 3,
    type: 'number',
    category: 'business_rule',
    description: 'Maximum advances allowed per year',
    validation_rules: { min: 1, max: 12 },
    is_editable: true
  },
  ADVANCE_AUTO_RECOVERY_MONTHS: {
    key: 'ADVANCE_AUTO_RECOVERY_MONTHS',
    value: 3,
    type: 'number',
    category: 'business_rule',
    description: 'Months to recover advance (equal installments)',
    validation_rules: { min: 1, max: 12 },
    is_editable: true
  },
  
  // Loan settings
  LOAN_INTEREST_RATE_ANNUAL: {
    key: 'LOAN_INTEREST_RATE_ANNUAL',
    value: 10,
    type: 'number',
    category: 'business_rule',
    description: 'Annual interest rate for employee loans (%)',
    validation_rules: { min: 0, max: 36 },
    is_editable: true
  },
  LOAN_MAX_TENURE_MONTHS: {
    key: 'LOAN_MAX_TENURE_MONTHS',
    value: 36,
    type: 'number',
    category: 'business_rule',
    description: 'Maximum loan tenure in months',
    validation_rules: { min: 6, max: 60 },
    is_editable: true
  },
  LOAN_MAX_EMI_PERCENTAGE: {
    key: 'LOAN_MAX_EMI_PERCENTAGE',
    value: 40,
    type: 'number',
    category: 'business_rule',
    description: 'Maximum EMI as % of monthly salary',
    validation_rules: { min: 20, max: 60 },
    is_editable: true
  },
  LOAN_ELIGIBILITY_MULTIPLIERS: {
    key: 'LOAN_ELIGIBILITY_MULTIPLIERS',
    value: JSON.stringify({
      '0-12': 2,   // 0-1 year: 2× monthly salary
      '13-24': 3,  // 1-2 years: 3× monthly salary
      '25-36': 4,  // 2-3 years: 4× monthly salary
      '37+': 5     // 3+ years: 5× monthly salary
    }),
    type: 'json',
    category: 'business_rule',
    description: 'Loan eligibility multipliers based on tenure',
    is_editable: true
  },
  LOAN_PREPAYMENT_CHARGE_PERCENTAGE: {
    key: 'LOAN_PREPAYMENT_CHARGE_PERCENTAGE',
    value: 2,
    type: 'number',
    category: 'business_rule',
    description: 'Prepayment/foreclosure charge (%)',
    validation_rules: { min: 0, max: 10 },
    is_editable: true
  },
  LOAN_OVERDUE_PENALTY_RATE: {
    key: 'LOAN_OVERDUE_PENALTY_RATE',
    value: 1,
    type: 'number',
    category: 'business_rule',
    description: 'Monthly penalty rate on overdue EMIs (%)',
    validation_rules: { min: 0, max: 5 },
    is_editable: true
  }
};

async function getLoanAdvanceSettings() {
  return {
    advance: {
      max_percentage: await getSetting('ADVANCE_MAX_PERCENTAGE', 50),
      min_tenure_months: await getSetting('ADVANCE_MIN_TENURE_MONTHS', 3),
      max_count_per_year: await getSetting('ADVANCE_MAX_COUNT_PER_YEAR', 3),
      auto_recovery_months: await getSetting('ADVANCE_AUTO_RECOVERY_MONTHS', 3)
    },
    loan: {
      interest_rate_annual: await getSetting('LOAN_INTEREST_RATE_ANNUAL', 10),
      max_tenure_months: await getSetting('LOAN_MAX_TENURE_MONTHS', 36),
      max_emi_percentage: await getSetting('LOAN_MAX_EMI_PERCENTAGE', 40),
      eligibility_multipliers: await getSetting('LOAN_ELIGIBILITY_MULTIPLIERS', {
        '0-12': 2, '13-24': 3, '25-36': 4, '37+': 5
      }),
      prepayment_charge_percentage: await getSetting('LOAN_PREPAYMENT_CHARGE_PERCENTAGE', 2),
      overdue_penalty_rate: await getSetting('LOAN_OVERDUE_PENALTY_RATE', 1)
    }
  };
}
```

**Business Rules**:
- Advance: max 50% salary, min 3 months tenure
- Loan interest: 10% annual (configurable)
- Loan tenure: max 36 months
- EMI limit: 40% of salary
- Eligibility multipliers by tenure
- Prepayment charge: 2%
- Overdue penalty: 1% per month
- All thresholds configurable

---

#### 8.1.6 Notification & Email Configuration

**Rule**: Configure notification delivery preferences

**Notification Settings**:
```javascript
const NOTIFICATION_SETTINGS = {
  // Email settings
  EMAIL_ENABLED: {
    key: 'EMAIL_ENABLED',
    value: true,
    type: 'boolean',
    category: 'notification',
    description: 'Enable email notifications',
    is_editable: true
  },
  EMAIL_FROM_ADDRESS: {
    key: 'EMAIL_FROM_ADDRESS',
    value: 'hr@ecovale.com',
    type: 'string',
    category: 'notification',
    description: 'Default from email address',
    validation_rules: {
      pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
    },
    is_editable: true
  },
  EMAIL_FROM_NAME: {
    key: 'EMAIL_FROM_NAME',
    value: 'EcoVale HR',
    type: 'string',
    category: 'notification',
    description: 'Display name for from email',
    is_editable: true
  },
  EMAIL_RATE_LIMIT_PER_MINUTE: {
    key: 'EMAIL_RATE_LIMIT_PER_MINUTE',
    value: 60,
    type: 'number',
    category: 'notification',
    description: 'Maximum emails per minute',
    validation_rules: { min: 10, max: 1000 },
    is_editable: true
  },
  
  // Payslip notifications
  PAYSLIP_EMAIL_ENABLED: {
    key: 'PAYSLIP_EMAIL_ENABLED',
    value: true,
    type: 'boolean',
    category: 'notification',
    description: 'Email payslips to employees automatically',
    is_editable: true
  },
  PAYSLIP_EMAIL_SUBJECT: {
    key: 'PAYSLIP_EMAIL_SUBJECT',
    value: 'Payslip for {{month}} {{year}} - EcoVale',
    type: 'string',
    category: 'notification',
    description: 'Email subject template for payslips',
    is_editable: true
  },
  
  // Reminder settings
  ADVANCE_ACKNOWLEDGMENT_REMINDER_DAYS: {
    key: 'ADVANCE_ACKNOWLEDGMENT_REMINDER_DAYS',
    value: 7,
    type: 'number',
    category: 'notification',
    description: 'Days after which to send acknowledgment reminder',
    validation_rules: { min: 1, max: 30 },
    is_editable: true
  },
  LOAN_EMI_REMINDER_DAYS_BEFORE: {
    key: 'LOAN_EMI_REMINDER_DAYS_BEFORE',
    value: 5,
    type: 'number',
    category: 'notification',
    description: 'Days before EMI due date to send reminder',
    validation_rules: { min: 1, max: 15 },
    is_editable: true
  },
  OFFER_LETTER_EXPIRY_ALERT_DAYS: {
    key: 'OFFER_LETTER_EXPIRY_ALERT_DAYS',
    value: 3,
    type: 'number',
    category: 'notification',
    description: 'Days before offer expiry to alert HR',
    validation_rules: { min: 1, max: 10 },
    is_editable: true
  },
  
  // SMS settings
  SMS_ENABLED: {
    key: 'SMS_ENABLED',
    value: false,
    type: 'boolean',
    category: 'notification',
    description: 'Enable SMS notifications',
    is_editable: true
  },
  SMS_GATEWAY_PROVIDER: {
    key: 'SMS_GATEWAY_PROVIDER',
    value: 'twilio',
    type: 'string',
    category: 'notification',
    description: 'SMS gateway provider',
    validation_rules: {
      allowed_values: ['twilio', 'aws_sns', 'msg91', 'none']
    },
    is_editable: true
  },
  
  // Push notifications
  PUSH_NOTIFICATIONS_ENABLED: {
    key: 'PUSH_NOTIFICATIONS_ENABLED',
    value: true,
    type: 'boolean',
    category: 'notification',
    description: 'Enable in-app push notifications',
    is_editable: true
  }
};

async function getNotificationSettings() {
  return {
    email: {
      enabled: await getSetting('EMAIL_ENABLED', true),
      from_address: await getSetting('EMAIL_FROM_ADDRESS', 'hr@ecovale.com'),
      from_name: await getSetting('EMAIL_FROM_NAME', 'EcoVale HR'),
      rate_limit_per_minute: await getSetting('EMAIL_RATE_LIMIT_PER_MINUTE', 60)
    },
    payslip: {
      email_enabled: await getSetting('PAYSLIP_EMAIL_ENABLED', true),
      email_subject: await getSetting('PAYSLIP_EMAIL_SUBJECT', 'Payslip for {{month}} {{year}}')
    },
    reminders: {
      advance_acknowledgment_days: await getSetting('ADVANCE_ACKNOWLEDGMENT_REMINDER_DAYS', 7),
      loan_emi_days_before: await getSetting('LOAN_EMI_REMINDER_DAYS_BEFORE', 5),
      offer_expiry_alert_days: await getSetting('OFFER_LETTER_EXPIRY_ALERT_DAYS', 3)
    },
    sms: {
      enabled: await getSetting('SMS_ENABLED', false),
      gateway_provider: await getSetting('SMS_GATEWAY_PROVIDER', 'twilio')
    },
    push_enabled: await getSetting('PUSH_NOTIFICATIONS_ENABLED', true)
  };
}
```

**Business Rules**:
- Email rate limiting to prevent spam
- Configurable notification templates
- Toggle email/SMS/push per channel
- Customizable reminder intervals
- Support multiple SMS gateways
- Override settings per notification type

---

#### 8.1.7 Feature Flags & Toggles

**Rule**: Control feature availability with flags

**Feature Flags**:
```javascript
const FEATURE_FLAGS = {
  FEATURE_ATTENDANCE_MODULE: {
    key: 'FEATURE_ATTENDANCE_MODULE',
    value: true,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable attendance tracking module',
    is_editable: true
  },
  FEATURE_LOAN_MODULE: {
    key: 'FEATURE_LOAN_MODULE',
    value: true,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable employee loans module',
    is_editable: true
  },
  FEATURE_ADVANCE_MODULE: {
    key: 'FEATURE_ADVANCE_MODULE',
    value: true,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable salary advance module',
    is_editable: true
  },
  FEATURE_LETTER_GENERATION: {
    key: 'FEATURE_LETTER_GENERATION',
    value: true,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable letter generation module',
    is_editable: true
  },
  FEATURE_DIGITAL_SIGNATURE: {
    key: 'FEATURE_DIGITAL_SIGNATURE',
    value: false,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable digital signature on letters',
    is_editable: true
  },
  FEATURE_BIOMETRIC_INTEGRATION: {
    key: 'FEATURE_BIOMETRIC_INTEGRATION',
    value: false,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable biometric attendance integration',
    is_editable: true
  },
  FEATURE_EXPENSE_REIMBURSEMENT: {
    key: 'FEATURE_EXPENSE_REIMBURSEMENT',
    value: false,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable expense reimbursement module',
    is_editable: true
  },
  FEATURE_PERFORMANCE_REVIEW: {
    key: 'FEATURE_PERFORMANCE_REVIEW',
    value: false,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable performance review module',
    is_editable: true
  },
  FEATURE_EXIT_MANAGEMENT: {
    key: 'FEATURE_EXIT_MANAGEMENT',
    value: true,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable employee exit management',
    is_editable: true
  },
  FEATURE_BULK_UPLOAD: {
    key: 'FEATURE_BULK_UPLOAD',
    value: true,
    type: 'boolean',
    category: 'feature_flag',
    description: 'Enable bulk upload via Excel',
    is_editable: true
  }
};

async function isFeatureEnabled(featureKey) {
  return await getSetting(featureKey, false);
}

async function getAllFeatureFlags() {
  return await getAllSettings('feature_flag');
}

async function toggleFeature(featureKey, enabled, toggledBy, reason) {
  return await updateSetting(featureKey, enabled, toggledBy, reason);
}
```

**Business Rules**:
- Enable/disable modules without code deployment
- Gradual feature rollout
- A/B testing support
- Quick feature disable in case of bugs
- Track feature usage analytics
- Environment-specific features (staging vs prod)

---

#### 8.1.8 Settings History & Audit Trail

**Rule**: Maintain complete audit trail of all setting changes

**Settings History Schema**:
```javascript
const SETTINGS_HISTORY_SCHEMA = {
  id: 'UUID PRIMARY KEY',
  setting_key: 'VARCHAR(100) NOT NULL',
  old_value: 'TEXT',
  new_value: 'TEXT',
  changed_by: 'UUID FOREIGN KEY',
  changed_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
  change_reason: 'TEXT',
  ip_address: 'VARCHAR(50)',
  user_agent: 'TEXT'
};

async function getSettingHistory(settingKey, limit = 50) {
  return await db.query(`
    SELECT 
      sh.id, sh.setting_key, sh.old_value, sh.new_value,
      sh.changed_at, sh.change_reason,
      u.name as changed_by_name
    FROM system_settings_history sh
    LEFT JOIN users u ON sh.changed_by = u.id
    WHERE sh.setting_key = ?
    ORDER BY sh.changed_at DESC
    LIMIT ?
  `, [settingKey, limit]);
}

async function getRecentSettingChanges(hours = 24) {
  return await db.query(`
    SELECT 
      sh.setting_key, sh.old_value, sh.new_value,
      sh.changed_at, sh.change_reason,
      u.name as changed_by_name,
      ss.setting_category, ss.display_name
    FROM system_settings_history sh
    LEFT JOIN users u ON sh.changed_by = u.id
    LEFT JOIN system_settings ss ON sh.setting_key = ss.setting_key
    WHERE sh.changed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    ORDER BY sh.changed_at DESC
  `, [hours]);
}

async function rollbackSetting(settingKey, historyId, rolledBackBy) {
  const history = await db.query(`
    SELECT old_value FROM system_settings_history WHERE id = ?
  `, [historyId]);
  
  if (!history) {
    throw new Error('History record not found');
  }
  
  return await updateSetting(
    settingKey, 
    history.old_value, 
    rolledBackBy,
    `Rollback to previous value (history ID: ${historyId})`
  );
}

async function exportSettingsSnapshot() {
  const settings = await db.query(`
    SELECT setting_key, setting_value, setting_type, setting_category,
           description, updated_at
    FROM system_settings
    WHERE environment = ?
  `, [process.env.NODE_ENV || 'production']);
  
  return {
    snapshot_date: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    settings: settings
  };
}
```

**Business Rules**:
- Log every setting change
- Store old and new values
- Track who made change and when
- Require change reason for critical settings
- Support rollback to previous values
- Export configuration snapshots
- Audit trail retention: 7 years

---

#### 8.1.9 Settings Import/Export & Backup

**Rule**: Support settings portability across environments

**Import/Export**:
```javascript
async function exportSettings(category = null, format = 'json') {
  const settings = await getAllSettings(category);
  
  if (format === 'json') {
    return JSON.stringify(settings, null, 2);
  } else if (format === 'csv') {
    const csv = settings.map(s => 
      `${s.key},${s.value},${s.type},${s.category},${s.description}`
    ).join('\n');
    return `key,value,type,category,description\n${csv}`;
  } else if (format === 'env') {
    return settings.map(s => `${s.key}=${s.value}`).join('\n');
  }
}

async function importSettings(settingsData, importedBy, overwrite = false) {
  const results = [];
  
  for (const setting of settingsData) {
    try {
      const existing = await db.query(`
        SELECT setting_key FROM system_settings WHERE setting_key = ?
      `, [setting.key]);
      
      if (existing && !overwrite) {
        results.push({ key: setting.key, success: false, reason: 'Already exists' });
        continue;
      }
      
      if (existing) {
        await updateSetting(setting.key, setting.value, importedBy, 'Imported from file');
      } else {
        await db.query(`
          INSERT INTO system_settings (
            setting_key, setting_value, setting_type, setting_category,
            description, is_editable, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          setting.key,
          typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value),
          setting.type,
          setting.category,
          setting.description,
          setting.is_editable !== false,
          importedBy
        ]);
      }
      
      results.push({ key: setting.key, success: true });
    } catch (error) {
      results.push({ key: setting.key, success: false, error: error.message });
    }
  }
  
  return results;
}

async function backupSettings() {
  const backup = {
    backup_date: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    version: '1.0',
    settings: await db.query(`SELECT * FROM system_settings`)
  };
  
  // Store backup
  const backupPath = `backups/system_settings_${Date.now()}.json`;
  await saveBackup(backupPath, JSON.stringify(backup, null, 2));
  
  return { backup_path: backupPath, count: backup.settings.length };
}

async function restoreSettings(backupPath, restoredBy) {
  const backup = await loadBackup(backupPath);
  
  if (!backup || !backup.settings) {
    throw new Error('Invalid backup file');
  }
  
  return await importSettings(backup.settings, restoredBy, true);
}

async function syncSettingsToEnvironment(sourceEnv, targetEnv, syncedBy) {
  const sourceSettings = await db.query(`
    SELECT * FROM system_settings WHERE environment = ?
  `, [sourceEnv]);
  
  for (const setting of sourceSettings) {
    await db.query(`
      INSERT INTO system_settings (
        setting_key, setting_value, setting_type, setting_category,
        description, is_editable, environment, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `, [
      setting.setting_key,
      setting.setting_value,
      setting.setting_type,
      setting.setting_category,
      setting.description,
      setting.is_editable,
      targetEnv,
      syncedBy
    ]);
  }
  
  return { synced_count: sourceSettings.length };
}
```

**Business Rules**:
- Export in JSON, CSV, or ENV formats
- Import with overwrite protection
- Automated daily backups
- Sync settings between environments
- Validate before import
- Support partial imports (by category)
- Backup retention: 90 days

---

#### 8.1.10 Default Settings Initialization

**Rule**: Initialize system with default settings on first setup

**Initialization**:
```javascript
async function initializeDefaultSettings(createdBy) {
  const defaultSettings = [
    // Statutory
    ...Object.values(STATUTORY_SETTINGS),
    // Payroll
    ...Object.values(PAYROLL_SETTINGS),
    // Loan & Advance
    ...Object.values(LOAN_ADVANCE_SETTINGS),
    // Notifications
    ...Object.values(NOTIFICATION_SETTINGS),
    // Feature Flags
    ...Object.values(FEATURE_FLAGS),
    
    // Company Info
    {
      key: 'COMPANY_NAME',
      value: 'EcoVale Technologies',
      type: 'string',
      category: 'system',
      description: 'Company legal name',
      is_editable: true
    },
    {
      key: 'COMPANY_ADDRESS',
      value: 'Bangalore, Karnataka, India',
      type: 'string',
      category: 'system',
      description: 'Company registered address',
      is_editable: true
    },
    {
      key: 'COMPANY_PAN',
      value: '',
      type: 'string',
      category: 'system',
      description: 'Company PAN number',
      is_editable: true,
      is_sensitive: true
    },
    {
      key: 'COMPANY_TAN',
      value: '',
      type: 'string',
      category: 'system',
      description: 'Company TAN number',
      is_editable: true,
      is_sensitive: true
    },
    {
      key: 'FINANCIAL_YEAR_START_MONTH',
      value: 4,
      type: 'number',
      category: 'system',
      description: 'Financial year start month (1-12)',
      validation_rules: { min: 1, max: 12 },
      is_editable: true
    }
  ];
  
  for (const setting of defaultSettings) {
    await db.query(`
      INSERT INTO system_settings (
        setting_key, setting_value, setting_type, setting_category,
        description, display_name, is_editable, is_sensitive,
        validation_rules, default_value, created_by, environment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE setting_key = setting_key
    `, [
      setting.key,
      typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value),
      setting.type,
      setting.category,
      setting.description,
      setting.display_name || setting.key,
      setting.is_editable !== false,
      setting.is_sensitive || false,
      setting.validation_rules ? JSON.stringify(setting.validation_rules) : null,
      typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value),
      createdBy,
      process.env.NODE_ENV || 'production'
    ]);
  }
  
  return { initialized: defaultSettings.length };
}

async function verifySettingsIntegrity() {
  const requiredSettings = [
    'PF_WAGE_CEILING_MONTHLY',
    'ESI_WAGE_CEILING_MONTHLY',
    'WORKING_DAYS_PER_MONTH',
    'EMAIL_FROM_ADDRESS',
    'COMPANY_NAME'
  ];
  
  const missing = [];
  
  for (const key of requiredSettings) {
    const setting = await db.query(`
      SELECT setting_key FROM system_settings WHERE setting_key = ?
    `, [key]);
    
    if (!setting) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required settings: ${missing.join(', ')}`);
  }
  
  return { valid: true, checked: requiredSettings.length };
}
```

**Business Rules**:
- Initialize on first system setup
- Provide sensible defaults
- Include all critical settings
- Support re-initialization (idempotent)
- Verify integrity before payroll processing
- Include company-specific settings
- Environment-specific initialization

---
