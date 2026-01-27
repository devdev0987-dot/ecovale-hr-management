# Database Schema Design - EcoVale HR System

## Overview
This document provides the complete database schema design, including table definitions, column specifications, primary keys, foreign keys, indexes, and constraints. The schema is designed for PostgreSQL but can be adapted to other relational databases.

---

## Schema Design Approach

### Database Choice
**Recommended**: PostgreSQL 14+ or MySQL 8+

**Rationale**:
- Strong ACID compliance for financial data (payroll, advances, loans)
- Excellent support for JSON columns for flexible data (career history, letter templates)
- Mature ecosystem and tooling
- Good performance for HR system scale (10-10,000 employees)

### Normalization Level
**Target**: 3NF (Third Normal Form) with selective denormalization for performance

**Denormalization Decisions**:
- Employee names cached in transaction tables (PayRunEmployeeRecord, AttendanceRecord, AdvanceRecord, LoanRecord) for query performance
- Department and designation names cached in some views for reporting
- Rationale: Reduces joins in frequently accessed queries while maintaining data integrity through triggers/application logic

---

## 1. Authentication and User Management

### Table: `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'hr', 'employee')),
    employee_id VARCHAR(20) NULL REFERENCES employees(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    account_locked_until TIMESTAMP NULL,
    password_reset_token VARCHAR(255) NULL,
    password_reset_expires TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    last_login_ip VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token) WHERE password_reset_token IS NOT NULL;

COMMENT ON TABLE users IS 'System users with authentication credentials';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt (cost 12) or Argon2id hashed password';
COMMENT ON COLUMN users.role IS 'User role for authorization: admin, manager, hr, employee';
COMMENT ON COLUMN users.employee_id IS 'Links user account to employee record for self-service';
COMMENT ON COLUMN users.failed_login_attempts IS 'Consecutive failed login attempts counter';
COMMENT ON COLUMN users.account_locked_until IS 'Account locked until this timestamp after 5 failed attempts';
```

---

### Table: `sessions`

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    refresh_token_hash VARCHAR(255) UNIQUE NULL,
    access_token_jti VARCHAR(255) NULL,
    device_name VARCHAR(255) NULL,
    device_fingerprint VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    location VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    revoked_reason VARCHAR(255) NULL,
    
    -- Constraints
    CONSTRAINT chk_expires_future CHECK (expires_at > created_at),
    CONSTRAINT chk_revoked_inactive CHECK (
        (is_active = false AND revoked_at IS NOT NULL) OR 
        (is_active = true AND revoked_at IS NULL)
    )
);

-- Primary Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
CREATE INDEX idx_sessions_user_active ON sessions(user_id, is_active) WHERE is_active = true;

-- Composite Indexes for Common Queries
CREATE INDEX idx_sessions_active_expires ON sessions(is_active, expires_at) WHERE is_active = true;
CREATE INDEX idx_sessions_cleanup ON sessions(expires_at) WHERE is_active = false OR expires_at < NOW();

-- Additional Indexes
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity DESC);
CREATE INDEX idx_sessions_ip_address ON sessions(ip_address);

COMMENT ON TABLE sessions IS 'User sessions and refresh tokens for JWT-based authentication';
COMMENT ON COLUMN sessions.refresh_token IS 'JWT refresh token (store hashed version in refresh_token_hash for security)';
COMMENT ON COLUMN sessions.refresh_token_hash IS 'SHA-256 hash of refresh token for secure lookup';
COMMENT ON COLUMN sessions.access_token_jti IS 'JWT ID (jti claim) of current access token for revocation';
COMMENT ON COLUMN sessions.device_name IS 'Human-readable device name (e.g., iPhone 13, Chrome on Windows)';
COMMENT ON COLUMN sessions.device_fingerprint IS 'Hashed device fingerprint for security tracking';
COMMENT ON COLUMN sessions.expires_at IS 'Refresh token expiry timestamp (typically created_at + 7 days)';
COMMENT ON COLUMN sessions.last_activity IS 'Last API request timestamp for inactivity tracking';
COMMENT ON COLUMN sessions.revoked_at IS 'Timestamp when session was manually revoked (logout)';
COMMENT ON COLUMN sessions.revoked_reason IS 'Reason for revocation: user_logout, admin_revoke, suspicious_activity, password_change';
```

**Triggers and Functions for Session Management**:

```sql
-- Function to hash refresh token using SHA-256
CREATE OR REPLACE FUNCTION hash_refresh_token(token TEXT)
RETURNS VARCHAR(255) AS $$
BEGIN
    RETURN encode(digest(token, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-hash refresh token before insert
CREATE OR REPLACE FUNCTION before_session_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate refresh token hash if refresh_token provided
    IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token_hash IS NULL THEN
        NEW.refresh_token_hash := hash_refresh_token(NEW.refresh_token);
    END IF;
    
    -- Set default expiry if not provided (7 days from now)
    IF NEW.expires_at IS NULL THEN
        NEW.expires_at := NEW.created_at + INTERVAL '7 days';
    END IF;
    
    -- Initialize timestamps
    NEW.created_at := COALESCE(NEW.created_at, CURRENT_TIMESTAMP);
    NEW.last_activity := COALESCE(NEW.last_activity, CURRENT_TIMESTAMP);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_before_session_insert
BEFORE INSERT ON sessions
FOR EACH ROW
EXECUTE FUNCTION before_session_insert();

-- Trigger to update last_activity on session update
CREATE OR REPLACE FUNCTION before_session_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If being revoked, set revoked_at
    IF NEW.is_active = false AND OLD.is_active = true AND NEW.revoked_at IS NULL THEN
        NEW.revoked_at := CURRENT_TIMESTAMP;
        IF NEW.revoked_reason IS NULL THEN
            NEW.revoked_reason := 'user_logout';
        END IF;
    END IF;
    
    -- Update refresh token hash if token changed
    IF NEW.refresh_token IS DISTINCT FROM OLD.refresh_token THEN
        NEW.refresh_token_hash := hash_refresh_token(NEW.refresh_token);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_before_session_update
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION before_session_update();

-- Function to validate session before token refresh
CREATE OR REPLACE FUNCTION validate_session(session_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    session_record RECORD;
BEGIN
    SELECT is_active, expires_at, user_id
    INTO session_record
    FROM sessions
    WHERE id = session_uuid;
    
    -- Session doesn't exist
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Session is revoked
    IF NOT session_record.is_active THEN
        RETURN false;
    END IF;
    
    -- Session is expired
    IF session_record.expires_at < CURRENT_TIMESTAMP THEN
        -- Auto-revoke expired session
        UPDATE sessions
        SET is_active = false,
            revoked_at = CURRENT_TIMESTAMP,
            revoked_reason = 'expired'
        WHERE id = session_uuid;
        
        RETURN false;
    END IF;
    
    -- Check if user is still active
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = session_record.user_id AND is_active = true) THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;
```

**Stored Procedures for Session Operations**:

```sql
-- Procedure to create new session (on login)
CREATE OR REPLACE PROCEDURE create_session(
    p_user_id UUID,
    p_refresh_token VARCHAR(500),
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_name VARCHAR(255) DEFAULT NULL,
    p_device_fingerprint VARCHAR(255) DEFAULT NULL,
    p_location VARCHAR(255) DEFAULT NULL,
    OUT p_session_id UUID
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO sessions (
        user_id,
        refresh_token,
        ip_address,
        user_agent,
        device_name,
        device_fingerprint,
        location,
        is_active,
        expires_at,
        created_at,
        last_activity
    ) VALUES (
        p_user_id,
        p_refresh_token,
        p_ip_address,
        p_user_agent,
        p_device_name,
        p_device_fingerprint,
        p_location,
        true,
        CURRENT_TIMESTAMP + INTERVAL '7 days',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
    RETURNING id INTO p_session_id;
    
    -- Log session creation
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, status)
    VALUES (p_user_id, 'SESSION_CREATE', 'SESSION', p_session_id::TEXT, p_ip_address, 'success');
END;
$$;

-- Procedure to revoke session (logout)
CREATE OR REPLACE PROCEDURE revoke_session(
    p_session_id UUID,
    p_reason VARCHAR(255) DEFAULT 'user_logout'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id UUID;
BEGIN
    UPDATE sessions
    SET is_active = false,
        revoked_at = CURRENT_TIMESTAMP,
        revoked_reason = p_reason
    WHERE id = p_session_id
    RETURNING user_id INTO v_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session % not found', p_session_id;
    END IF;
    
    -- Log session revocation
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, status)
    VALUES (v_user_id, 'SESSION_REVOKE', 'SESSION', p_session_id::TEXT, 'success');
END;
$$;

-- Procedure to revoke all user sessions (logout all devices)
CREATE OR REPLACE PROCEDURE revoke_all_user_sessions(
    p_user_id UUID,
    p_reason VARCHAR(255) DEFAULT 'logout_all_devices'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_revoked_count INT;
BEGIN
    UPDATE sessions
    SET is_active = false,
        revoked_at = CURRENT_TIMESTAMP,
        revoked_reason = p_reason
    WHERE user_id = p_user_id
      AND is_active = true;
    
    GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
    
    -- Log mass revocation
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, status)
    VALUES (p_user_id, 'SESSION_REVOKE_ALL', 'SESSION', v_revoked_count::TEXT, 'success');
    
    RAISE NOTICE 'Revoked % sessions for user %', v_revoked_count, p_user_id;
END;
$$;

-- Function to update session activity timestamp
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE sessions
    SET last_activity = CURRENT_TIMESTAMP
    WHERE id = p_session_id
      AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Procedure to clean up old sessions
CREATE OR REPLACE PROCEDURE cleanup_old_sessions()
LANGUAGE plpgsql AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM sessions
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
       OR (is_active = false AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Log cleanup
    INSERT INTO audit_logs (action, resource_type, resource_id, status)
    VALUES ('SESSION_CLEANUP', 'SESSION', v_deleted_count::TEXT, 'success');
    
    RAISE NOTICE 'Cleaned up % old sessions', v_deleted_count;
END;
$$;

-- Function to detect suspicious session activity
CREATE OR REPLACE FUNCTION detect_suspicious_session(p_session_id UUID)
RETURNS TABLE(
    is_suspicious BOOLEAN,
    reason TEXT,
    risk_score INT
) AS $$
DECLARE
    v_session RECORD;
    v_last_login RECORD;
    v_risk_score INT := 0;
    v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Get current session
    SELECT * INTO v_session
    FROM sessions
    WHERE id = p_session_id;
    
    -- Get last login session for comparison
    SELECT * INTO v_last_login
    FROM sessions
    WHERE user_id = v_session.user_id
      AND id != p_session_id
      AND created_at < v_session.created_at
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Check for IP address change
    IF v_last_login.ip_address IS NOT NULL 
       AND v_session.ip_address != v_last_login.ip_address THEN
        v_risk_score := v_risk_score + 30;
        v_reasons := array_append(v_reasons, 'IP address changed');
    END IF;
    
    -- Check for location change
    IF v_last_login.location IS NOT NULL 
       AND v_session.location != v_last_login.location THEN
        v_risk_score := v_risk_score + 20;
        v_reasons := array_append(v_reasons, 'Location changed');
    END IF;
    
    -- Check for device fingerprint change
    IF v_last_login.device_fingerprint IS NOT NULL 
       AND v_session.device_fingerprint != v_last_login.device_fingerprint THEN
        v_risk_score := v_risk_score + 40;
        v_reasons := array_append(v_reasons, 'Device fingerprint changed');
    END IF;
    
    -- Check for unusual time (login between 2am-5am)
    IF EXTRACT(HOUR FROM v_session.created_at) BETWEEN 2 AND 5 THEN
        v_risk_score := v_risk_score + 10;
        v_reasons := array_append(v_reasons, 'Unusual login time');
    END IF;
    
    RETURN QUERY SELECT 
        (v_risk_score >= 50)::BOOLEAN,
        array_to_string(v_reasons, '; '),
        v_risk_score;
END;
$$ LANGUAGE plpgsql;
```

**Views for Session Monitoring**:

```sql
-- View: Active sessions with user details
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT 
    s.id AS session_id,
    s.user_id,
    u.email,
    u.full_name,
    u.role,
    s.device_name,
    s.ip_address,
    s.location,
    s.created_at AS login_time,
    s.last_activity,
    s.expires_at,
    EXTRACT(EPOCH FROM (s.expires_at - CURRENT_TIMESTAMP)) / 3600 AS hours_until_expiry,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.last_activity)) / 60 AS minutes_since_activity
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.is_active = true
  AND s.expires_at > CURRENT_TIMESTAMP
ORDER BY s.last_activity DESC;

COMMENT ON VIEW v_active_sessions IS 'Currently active sessions with user details and activity metrics';

-- View: Session statistics per user
CREATE OR REPLACE VIEW v_user_session_stats AS
SELECT 
    u.id AS user_id,
    u.email,
    u.full_name,
    COUNT(*) FILTER (WHERE s.is_active = true AND s.expires_at > CURRENT_TIMESTAMP) AS active_sessions,
    COUNT(*) FILTER (WHERE s.is_active = false) AS revoked_sessions,
    COUNT(*) AS total_sessions,
    MAX(s.created_at) AS last_login,
    MAX(s.last_activity) AS last_activity,
    COUNT(DISTINCT s.ip_address) AS unique_ips,
    COUNT(DISTINCT s.device_name) AS unique_devices
FROM users u
LEFT JOIN sessions s ON u.id = s.user_id
GROUP BY u.id, u.email, u.full_name
ORDER BY active_sessions DESC;

COMMENT ON VIEW v_user_session_stats IS 'Session statistics per user for monitoring and security';

-- View: Suspicious sessions
CREATE OR REPLACE VIEW v_suspicious_sessions AS
SELECT 
    s.id AS session_id,
    s.user_id,
    u.email,
    s.ip_address,
    s.location,
    s.device_name,
    s.created_at,
    s.last_activity,
    ds.*
FROM sessions s
JOIN users u ON s.user_id = u.id
CROSS JOIN LATERAL detect_suspicious_session(s.id) ds
WHERE s.is_active = true
  AND ds.is_suspicious = true
ORDER BY ds.risk_score DESC;

COMMENT ON VIEW v_suspicious_sessions IS 'Sessions flagged as suspicious based on risk factors';
```

---

### Table: `audit_logs`

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID NULL REFERENCES sessions(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL CHECK (action_category IN ('AUTH', 'EMPLOYEE', 'PAYROLL', 'SETTINGS', 'SECURITY')),
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50) NULL,
    resource_name VARCHAR(255) NULL,
    method VARCHAR(10) NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
    endpoint VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    location VARCHAR(255) NULL,
    changes JSONB NULL,
    metadata JSONB NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'warning')),
    status_code INT NULL,
    error_message TEXT NULL,
    error_stack TEXT NULL,
    duration_ms INT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    tags TEXT[] NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint: duration must be non-negative
    CONSTRAINT chk_duration_positive CHECK (duration_ms IS NULL OR duration_ms >= 0),
    -- Constraint: status_code must be valid HTTP code
    CONSTRAINT chk_status_code_valid CHECK (status_code IS NULL OR (status_code >= 100 AND status_code < 600))
) PARTITION BY RANGE (created_at);

-- Monthly Partitions (create for current year + 1 year ahead)
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE audit_logs_2026_08 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE audit_logs_2026_09 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE audit_logs_2026_10 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE audit_logs_2026_11 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE audit_logs_2026_12 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Indexes on Parent Table (inherited by all partitions)
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_session_id ON audit_logs(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_action_category ON audit_logs(action_category);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_audit_logs_status ON audit_logs(status);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite Indexes for Common Queries
CREATE INDEX idx_audit_logs_user_timeline ON audit_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_resource_history ON audit_logs(resource_type, resource_id, created_at DESC) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_audit_logs_failures ON audit_logs(status, created_at DESC) WHERE status = 'failure';
CREATE INDEX idx_audit_logs_critical ON audit_logs(severity, created_at DESC) WHERE severity IN ('error', 'critical');

-- GIN Indexes for JSONB and Array Searches
CREATE INDEX idx_audit_logs_changes ON audit_logs USING GIN (changes) WHERE changes IS NOT NULL;
CREATE INDEX idx_audit_logs_metadata ON audit_logs USING GIN (metadata) WHERE metadata IS NOT NULL;
CREATE INDEX idx_audit_logs_tags ON audit_logs USING GIN (tags) WHERE tags IS NOT NULL;

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all user actions, data changes, and security events';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed action (NULL for system/automated actions)';
COMMENT ON COLUMN audit_logs.session_id IS 'Session ID linking to user login session';
COMMENT ON COLUMN audit_logs.action IS 'Specific action performed (e.g., LOGIN, CREATE_EMPLOYEE, UPDATE_SALARY)';
COMMENT ON COLUMN audit_logs.action_category IS 'High-level category: AUTH, EMPLOYEE, PAYROLL, SETTINGS, SECURITY';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected (USER, EMPLOYEE, PAYRUN, etc.)';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of specific resource instance';
COMMENT ON COLUMN audit_logs.resource_name IS 'Human-readable name (employee name, payrun title, etc.)';
COMMENT ON COLUMN audit_logs.changes IS 'JSONB with before/after values for data modifications';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context: request params, filters, correlation IDs';
COMMENT ON COLUMN audit_logs.duration_ms IS 'Request duration in milliseconds for performance monitoring';
COMMENT ON COLUMN audit_logs.severity IS 'Log severity: debug, info, warning, error, critical';
COMMENT ON COLUMN audit_logs.tags IS 'Array of tags for categorization and search';
```

**Triggers and Functions for Audit Log Integrity**:

```sql
-- Trigger to prevent modification of audit logs (immutability)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_audit_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER trigger_prevent_audit_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();

-- Function to automatically create next month's partition
CREATE OR REPLACE FUNCTION create_audit_log_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'audit_logs_' || TO_CHAR(partition_date, 'YYYY_MM');
    start_date := DATE_TRUNC('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    
    -- Check if partition already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        RAISE NOTICE 'Created partition % for range % to %', partition_name, start_date, end_date;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Procedure to auto-create future partitions (run monthly)
CREATE OR REPLACE PROCEDURE create_future_audit_partitions()
LANGUAGE plpgsql AS $$
DECLARE
    i INT;
    partition_date DATE;
BEGIN
    -- Create partitions for next 12 months
    FOR i IN 1..12 LOOP
        partition_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        PERFORM create_audit_log_partition(partition_date);
    END LOOP;
    
    RAISE NOTICE 'Auto-created audit log partitions for next 12 months';
END;
$$;

-- Function to archive old audit logs to cold storage
CREATE OR REPLACE FUNCTION archive_old_audit_logs(archive_before_date DATE)
RETURNS TABLE(
    partition_name TEXT,
    row_count BIGINT,
    archived BOOLEAN
) AS $$
DECLARE
    partition_rec RECORD;
    archived_count BIGINT;
BEGIN
    FOR partition_rec IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename LIKE 'audit_logs_%'
          AND tablename < 'audit_logs_' || TO_CHAR(archive_before_date, 'YYYY_MM')
    LOOP
        -- Get row count
        EXECUTE format('SELECT COUNT(*) FROM %I', partition_rec.tablename) INTO archived_count;
        
        -- Export to CSV (example - customize for your storage)
        EXECUTE format(
            'COPY %I TO ''/archive/audit_logs/%s.csv'' WITH CSV HEADER',
            partition_rec.tablename,
            partition_rec.tablename
        );
        
        RETURN QUERY SELECT partition_rec.tablename::TEXT, archived_count, true;
        
        RAISE NOTICE 'Archived partition % with % rows', partition_rec.tablename, archived_count;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**Stored Procedures for Audit Logging**:

```sql
-- Procedure to log user action
CREATE OR REPLACE PROCEDURE log_audit(
    p_user_id UUID,
    p_session_id UUID DEFAULT NULL,
    p_action VARCHAR(100),
    p_action_category VARCHAR(50),
    p_resource_type VARCHAR(50),
    p_resource_id VARCHAR(50) DEFAULT NULL,
    p_resource_name VARCHAR(255) DEFAULT NULL,
    p_method VARCHAR(10) DEFAULT NULL,
    p_endpoint VARCHAR(255) DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_location VARCHAR(255) DEFAULT NULL,
    p_changes JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'success',
    p_status_code INT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_duration_ms INT DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT 'info',
    p_tags TEXT[] DEFAULT NULL
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, session_id, action, action_category, resource_type, resource_id, resource_name,
        method, endpoint, ip_address, user_agent, location, changes, metadata,
        status, status_code, error_message, duration_ms, severity, tags, created_at
    ) VALUES (
        p_user_id, p_session_id, p_action, p_action_category, p_resource_type, p_resource_id, p_resource_name,
        p_method, p_endpoint, p_ip_address, p_user_agent, p_location, p_changes, p_metadata,
        p_status, p_status_code, p_error_message, p_duration_ms, p_severity, p_tags, CURRENT_TIMESTAMP
    );
END;
$$;

-- Simplified procedure for common cases
CREATE OR REPLACE PROCEDURE log_action(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50),
    p_resource_id VARCHAR(50) DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'success'
)
LANGUAGE plpgsql AS $$
DECLARE
    v_category VARCHAR(50);
BEGIN
    -- Auto-determine category from action
    v_category := CASE 
        WHEN p_action LIKE '%LOGIN%' OR p_action LIKE '%LOGOUT%' OR p_action LIKE '%PASSWORD%' THEN 'AUTH'
        WHEN p_action LIKE '%EMPLOYEE%' THEN 'EMPLOYEE'
        WHEN p_action LIKE '%PAYRUN%' OR p_action LIKE '%PAYSLIP%' THEN 'PAYROLL'
        WHEN p_action LIKE '%SETTINGS%' OR p_action LIKE '%DEPARTMENT%' THEN 'SETTINGS'
        WHEN p_action LIKE '%SUSPICIOUS%' OR p_action LIKE '%UNAUTHORIZED%' THEN 'SECURITY'
        ELSE 'EMPLOYEE'
    END;
    
    CALL log_audit(
        p_user_id := p_user_id,
        p_action := p_action,
        p_action_category := v_category,
        p_resource_type := p_resource_type,
        p_resource_id := p_resource_id,
        p_status := p_status
    );
END;
$$;

-- Function to get audit trail for a resource
CREATE OR REPLACE FUNCTION get_resource_audit_trail(
    p_resource_type VARCHAR(50),
    p_resource_id VARCHAR(50),
    p_limit INT DEFAULT 100
)
RETURNS TABLE(
    log_id UUID,
    timestamp TIMESTAMP,
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    action VARCHAR(100),
    status VARCHAR(20),
    changes JSONB,
    ip_address VARCHAR(45)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.created_at,
        u.email,
        u.full_name,
        al.action,
        al.status,
        al.changes,
        al.ip_address
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.resource_type = p_resource_type
      AND al.resource_id = p_resource_id
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get user activity timeline
CREATE OR REPLACE FUNCTION get_user_activity_timeline(
    p_user_id UUID,
    p_from_date TIMESTAMP DEFAULT NULL,
    p_to_date TIMESTAMP DEFAULT NULL,
    p_limit INT DEFAULT 100
)
RETURNS TABLE(
    log_id UUID,
    timestamp TIMESTAMP,
    action VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id VARCHAR(50),
    status VARCHAR(20),
    ip_address VARCHAR(45),
    location VARCHAR(255)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.id,
        al.created_at,
        al.action,
        al.resource_type,
        al.resource_id,
        al.status,
        al.ip_address,
        al.location
    FROM audit_logs al
    WHERE al.user_id = p_user_id
      AND (p_from_date IS NULL OR al.created_at >= p_from_date)
      AND (p_to_date IS NULL OR al.created_at <= p_to_date)
    ORDER BY al.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to detect anomalies (multiple failed logins)
CREATE OR REPLACE FUNCTION detect_failed_login_anomaly(
    p_user_id UUID DEFAULT NULL,
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_time_window INTERVAL DEFAULT '15 minutes'
)
RETURNS TABLE(
    user_id UUID,
    ip_address VARCHAR(45),
    failed_count BIGINT,
    first_attempt TIMESTAMP,
    last_attempt TIMESTAMP,
    is_anomaly BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        al.user_id,
        al.ip_address,
        COUNT(*)::BIGINT AS failed_count,
        MIN(al.created_at) AS first_attempt,
        MAX(al.created_at) AS last_attempt,
        (COUNT(*) >= 5)::BOOLEAN AS is_anomaly
    FROM audit_logs al
    WHERE al.action = 'LOGIN_FAILED'
      AND al.created_at >= CURRENT_TIMESTAMP - p_time_window
      AND (p_user_id IS NULL OR al.user_id = p_user_id)
      AND (p_ip_address IS NULL OR al.ip_address = p_ip_address)
    GROUP BY al.user_id, al.ip_address
    HAVING COUNT(*) >= 3
    ORDER BY failed_count DESC;
END;
$$ LANGUAGE plpgsql;
```

**Views for Audit Monitoring and Reporting**:

```sql
-- View: Recent audit activity
CREATE OR REPLACE VIEW v_recent_audit_activity AS
SELECT 
    al.id,
    al.created_at,
    u.email AS user_email,
    u.full_name AS user_name,
    al.action,
    al.action_category,
    al.resource_type,
    al.resource_id,
    al.resource_name,
    al.status,
    al.severity,
    al.ip_address,
    al.location
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY al.created_at DESC;

COMMENT ON VIEW v_recent_audit_activity IS 'Audit activity in the last 24 hours';

-- View: Failed operations summary
CREATE OR REPLACE VIEW v_failed_operations AS
SELECT 
    DATE_TRUNC('hour', al.created_at) AS hour,
    al.action,
    al.action_category,
    al.resource_type,
    COUNT(*) AS failure_count,
    array_agg(DISTINCT al.user_id) FILTER (WHERE al.user_id IS NOT NULL) AS affected_users,
    array_agg(DISTINCT al.error_message) AS unique_errors
FROM audit_logs al
WHERE al.status = 'failure'
  AND al.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY hour, al.action, al.action_category, al.resource_type
ORDER BY hour DESC, failure_count DESC;

COMMENT ON VIEW v_failed_operations IS 'Summary of failed operations for troubleshooting';

-- View: Security events dashboard
CREATE OR REPLACE VIEW v_security_events AS
SELECT 
    al.created_at,
    u.email AS user_email,
    al.action,
    al.ip_address,
    al.location,
    al.severity,
    al.error_message,
    al.tags
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.action_category = 'SECURITY'
   OR al.severity IN ('error', 'critical')
   OR al.action LIKE '%FAILED%'
   OR al.action LIKE '%SUSPICIOUS%'
   OR al.action LIKE '%UNAUTHORIZED%'
ORDER BY al.created_at DESC;

COMMENT ON VIEW v_security_events IS 'Security-related events for monitoring';

-- View: User activity statistics
CREATE OR REPLACE VIEW v_user_activity_stats AS
SELECT 
    u.id AS user_id,
    u.email,
    u.full_name,
    u.role,
    COUNT(*) AS total_actions,
    COUNT(*) FILTER (WHERE al.status = 'success') AS successful_actions,
    COUNT(*) FILTER (WHERE al.status = 'failure') AS failed_actions,
    COUNT(DISTINCT DATE_TRUNC('day', al.created_at)) AS active_days,
    MAX(al.created_at) AS last_activity,
    array_agg(DISTINCT al.action_category) AS action_categories
FROM users u
LEFT JOIN audit_logs al ON u.id = al.user_id
WHERE al.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY u.id, u.email, u.full_name, u.role
ORDER BY total_actions DESC;

COMMENT ON VIEW v_user_activity_stats IS '30-day user activity statistics';

-- View: Resource modification history
CREATE OR REPLACE VIEW v_resource_modifications AS
SELECT 
    al.resource_type,
    al.resource_id,
    al.resource_name,
    COUNT(*) AS modification_count,
    array_agg(DISTINCT u.email) AS modified_by_users,
    MIN(al.created_at) AS first_modified,
    MAX(al.created_at) AS last_modified,
    COUNT(DISTINCT al.user_id) AS unique_modifiers
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
WHERE al.changes IS NOT NULL
  AND al.status = 'success'
  AND al.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
GROUP BY al.resource_type, al.resource_id, al.resource_name
HAVING COUNT(*) > 1
ORDER BY modification_count DESC;

COMMENT ON VIEW v_resource_modifications IS 'Resources with multiple modifications (change tracking)';

-- View: Performance metrics from audit logs
CREATE OR REPLACE VIEW v_api_performance_metrics AS
SELECT 
    al.endpoint,
    al.method,
    COUNT(*) AS request_count,
    AVG(al.duration_ms) AS avg_duration_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY al.duration_ms) AS median_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY al.duration_ms) AS p95_duration_ms,
    MAX(al.duration_ms) AS max_duration_ms,
    COUNT(*) FILTER (WHERE al.status = 'failure') AS error_count,
    (COUNT(*) FILTER (WHERE al.status = 'failure')::FLOAT / COUNT(*) * 100) AS error_rate_pct
FROM audit_logs al
WHERE al.duration_ms IS NOT NULL
  AND al.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY al.endpoint, al.method
HAVING COUNT(*) >= 10
ORDER BY avg_duration_ms DESC;

COMMENT ON VIEW v_api_performance_metrics IS 'API endpoint performance metrics from audit logs';
```

---
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    changes JSONB NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure')),
    error_message TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

COMMENT ON TABLE audit_logs IS 'Audit trail for security and compliance';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., LOGIN, CREATE_EMPLOYEE, UPDATE_SALARY)';
COMMENT ON COLUMN audit_logs.changes IS 'JSON object with before/after values for data changes';
COMMENT ON COLUMN audit_logs.status IS 'Operation status: success or failure';
```

---

## 2. Organizational Structure

### Table: `departments`

```sql
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL CHECK (name IN ('IT', 'HR', 'Finance', 'Sales', 'Marketing')),
    description TEXT,
    head_employee_id VARCHAR(20) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_departments_name ON departments(name);
CREATE INDEX idx_departments_active ON departments(is_active);

COMMENT ON TABLE departments IS 'Organizational departments';
COMMENT ON COLUMN departments.head_employee_id IS 'Department head - references employees.id';
```

**Pre-seeded Data**:
```sql
INSERT INTO departments (name, description) VALUES 
    ('IT', 'Information Technology'),
    ('HR', 'Human Resources'),
    ('Finance', 'Finance and Accounting'),
    ('Sales', 'Sales and Business Development'),
    ('Marketing', 'Marketing and Communications');
```

---

### Table: `designations`

```sql
CREATE TABLE designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    department_id INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    description TEXT,
    reporting_to_designation_id UUID NULL REFERENCES designations(id) ON DELETE SET NULL,
    level INT NOT NULL DEFAULT 1 CHECK (level > 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_designations_department ON designations(department_id);
CREATE INDEX idx_designations_level ON designations(level);
CREATE INDEX idx_designations_title ON designations(title);
CREATE INDEX idx_designations_reporting ON designations(reporting_to_designation_id) WHERE reporting_to_designation_id IS NOT NULL;

-- Composite Indexes for Common Queries
CREATE INDEX idx_designations_dept_level ON designations(department_id, level);
CREATE UNIQUE INDEX idx_designations_dept_title ON designations(department_id, title);

COMMENT ON TABLE designations IS 'Job titles and positions within departments';
COMMENT ON COLUMN designations.level IS 'Hierarchy level - lower number = higher position';
COMMENT ON COLUMN designations.reporting_to_designation_id IS 'Reporting designation for organizational hierarchy';
```

**Triggers and Functions for Departments**:

```sql
-- Trigger to update timestamp on department update
CREATE OR REPLACE FUNCTION before_department_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_before_department_update
BEFORE UPDATE ON departments
FOR EACH ROW
EXECUTE FUNCTION before_department_update();

-- Function to validate department head is actually in the department
CREATE OR REPLACE FUNCTION validate_department_head()
RETURNS TRIGGER AS $$
BEGIN
    -- If head is assigned, verify they belong to this department
    IF NEW.head_employee_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM employees 
            WHERE id = NEW.head_employee_id 
              AND department_id = NEW.id
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Department head % must be an active employee in department %', 
                NEW.head_employee_id, NEW.name;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_department_head
BEFORE INSERT OR UPDATE OF head_employee_id ON departments
FOR EACH ROW
WHEN (NEW.head_employee_id IS NOT NULL)
EXECUTE FUNCTION validate_department_head();

-- Function to prevent deletion of departments with employees
CREATE OR REPLACE FUNCTION prevent_department_deletion_with_employees()
RETURNS TRIGGER AS $$
DECLARE
    employee_count INT;
BEGIN
    SELECT COUNT(*) INTO employee_count
    FROM employees
    WHERE department_id = OLD.id;
    
    IF employee_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete department % - it has % active employees. Reassign employees first.', 
            OLD.name, employee_count;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_department_deletion
BEFORE DELETE ON departments
FOR EACH ROW
EXECUTE FUNCTION prevent_department_deletion_with_employees();

-- Function to prevent deactivation of departments with active employees
CREATE OR REPLACE FUNCTION validate_department_deactivation()
RETURNS TRIGGER AS $$
DECLARE
    active_employee_count INT;
BEGIN
    -- Only check if being deactivated
    IF OLD.is_active = true AND NEW.is_active = false THEN
        SELECT COUNT(*) INTO active_employee_count
        FROM employees
        WHERE department_id = NEW.id AND status = 'active';
        
        IF active_employee_count > 0 THEN
            RAISE EXCEPTION 'Cannot deactivate department % - it has % active employees. Reassign or deactivate employees first.', 
                NEW.name, active_employee_count;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_department_deactivation
BEFORE UPDATE OF is_active ON departments
FOR EACH ROW
EXECUTE FUNCTION validate_department_deactivation();
```

**Triggers and Functions for Designations**:

```sql
-- Trigger to update timestamp on designation update
CREATE OR REPLACE FUNCTION before_designation_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_before_designation_update
BEFORE UPDATE ON designations
FOR EACH ROW
EXECUTE FUNCTION before_designation_update();

-- Function to prevent circular designation hierarchy
CREATE OR REPLACE FUNCTION check_circular_designation_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    current_designation UUID;
    depth INT := 0;
    max_depth INT := 20;
BEGIN
    -- If no reporting designation, no check needed
    IF NEW.reporting_to_designation_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Cannot report to self
    IF NEW.reporting_to_designation_id = NEW.id THEN
        RAISE EXCEPTION 'Designation cannot report to itself';
    END IF;
    
    -- Check for circular reference by traversing up the hierarchy
    current_designation := NEW.reporting_to_designation_id;
    
    WHILE current_designation IS NOT NULL AND depth < max_depth LOOP
        -- If we encounter the designation being updated, it's circular
        IF current_designation = NEW.id THEN
            RAISE EXCEPTION 'Circular designation hierarchy detected';
        END IF;
        
        -- Move up to next reporting designation
        SELECT reporting_to_designation_id INTO current_designation
        FROM designations
        WHERE id = current_designation;
        
        depth := depth + 1;
    END LOOP;
    
    IF depth >= max_depth THEN
        RAISE EXCEPTION 'Designation hierarchy too deep (max 20 levels)';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_circular_designation
BEFORE INSERT OR UPDATE OF reporting_to_designation_id ON designations
FOR EACH ROW
EXECUTE FUNCTION check_circular_designation_hierarchy();

-- Function to validate reporting designation is in same department
CREATE OR REPLACE FUNCTION validate_designation_reporting_department()
RETURNS TRIGGER AS $$
DECLARE
    reporting_dept_id INT;
BEGIN
    IF NEW.reporting_to_designation_id IS NOT NULL THEN
        SELECT department_id INTO reporting_dept_id
        FROM designations
        WHERE id = NEW.reporting_to_designation_id;
        
        IF reporting_dept_id IS NULL THEN
            RAISE EXCEPTION 'Reporting designation not found';
        END IF;
        
        IF reporting_dept_id != NEW.department_id THEN
            RAISE EXCEPTION 'Designation can only report to another designation in the same department';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_designation_reporting_dept
BEFORE INSERT OR UPDATE OF reporting_to_designation_id, department_id ON designations
FOR EACH ROW
WHEN (NEW.reporting_to_designation_id IS NOT NULL)
EXECUTE FUNCTION validate_designation_reporting_department();

-- Function to prevent deletion of designations with employees
CREATE OR REPLACE FUNCTION prevent_designation_deletion_with_employees()
RETURNS TRIGGER AS $$
DECLARE
    employee_count INT;
BEGIN
    SELECT COUNT(*) INTO employee_count
    FROM employees
    WHERE designation_id = OLD.id;
    
    IF employee_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete designation % - it has % employees. Reassign employees first.', 
            OLD.title, employee_count;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_designation_deletion
BEFORE DELETE ON designations
FOR EACH ROW
EXECUTE FUNCTION prevent_designation_deletion_with_employees();

-- Function to validate hierarchy level consistency
CREATE OR REPLACE FUNCTION validate_designation_level()
RETURNS TRIGGER AS $$
DECLARE
    reporting_level INT;
BEGIN
    IF NEW.reporting_to_designation_id IS NOT NULL THEN
        SELECT level INTO reporting_level
        FROM designations
        WHERE id = NEW.reporting_to_designation_id;
        
        -- Reporting designation must have a lower level number (higher position)
        IF reporting_level >= NEW.level THEN
            RAISE EXCEPTION 'Designation level (%) must be higher than reporting designation level (%)', 
                NEW.level, reporting_level;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_designation_level
BEFORE INSERT OR UPDATE OF level, reporting_to_designation_id ON designations
FOR EACH ROW
WHEN (NEW.reporting_to_designation_id IS NOT NULL)
EXECUTE FUNCTION validate_designation_level();
```

**Stored Procedures for Organizational Operations**:

```sql
-- Procedure to get department statistics
CREATE OR REPLACE FUNCTION get_department_stats(dept_id INT)
RETURNS TABLE(
    department_name VARCHAR(100),
    total_employees BIGINT,
    active_employees BIGINT,
    inactive_employees BIGINT,
    total_designations BIGINT,
    avg_salary DECIMAL(12,2),
    total_salary_cost DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.name,
        COUNT(e.id),
        COUNT(e.id) FILTER (WHERE e.status = 'active'),
        COUNT(e.id) FILTER (WHERE e.status = 'inactive'),
        COUNT(DISTINCT e.designation_id),
        AVG(e.ctc),
        SUM(e.ctc)
    FROM departments d
    LEFT JOIN employees e ON d.id = e.department_id
    WHERE d.id = dept_id
    GROUP BY d.id, d.name;
END;
$$ LANGUAGE plpgsql;

-- Procedure to get designation hierarchy
CREATE OR REPLACE FUNCTION get_designation_hierarchy(dept_id INT)
RETURNS TABLE(
    designation_id UUID,
    designation_title VARCHAR(255),
    designation_level INT,
    reporting_to_title VARCHAR(255),
    employee_count BIGINT,
    hierarchy_path TEXT
) AS $$
WITH RECURSIVE hierarchy AS (
    -- Base case: top-level designations (no reporting)
    SELECT 
        d.id,
        d.title,
        d.level,
        NULL::VARCHAR(255) AS reporting_title,
        1 AS depth,
        d.title AS path
    FROM designations d
    WHERE d.department_id = dept_id
      AND d.reporting_to_designation_id IS NULL
    
    UNION ALL
    
    -- Recursive case: designations reporting to others
    SELECT 
        d.id,
        d.title,
        d.level,
        h.title,
        h.depth + 1,
        h.path || ' → ' || d.title
    FROM designations d
    JOIN hierarchy h ON d.reporting_to_designation_id = h.id
    WHERE d.department_id = dept_id
      AND h.depth < 20
)
SELECT 
    h.id,
    h.title,
    h.level,
    h.reporting_title,
    COUNT(e.id),
    h.path
FROM hierarchy h
LEFT JOIN employees e ON h.id = e.designation_id AND e.status = 'active'
GROUP BY h.id, h.title, h.level, h.reporting_title, h.path
ORDER BY h.level, h.title;
$$ LANGUAGE sql;

-- Procedure to reorganize department (reassign all employees)
CREATE OR REPLACE PROCEDURE reorganize_department(
    old_dept_id INT,
    new_dept_id INT,
    performed_by UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    employee_count INT;
    old_dept_name VARCHAR(100);
    new_dept_name VARCHAR(100);
BEGIN
    -- Validate departments exist
    SELECT name INTO old_dept_name FROM departments WHERE id = old_dept_id;
    SELECT name INTO new_dept_name FROM departments WHERE id = new_dept_id;
    
    IF old_dept_name IS NULL OR new_dept_name IS NULL THEN
        RAISE EXCEPTION 'Invalid department IDs';
    END IF;
    
    -- Count employees being moved
    SELECT COUNT(*) INTO employee_count
    FROM employees
    WHERE department_id = old_dept_id;
    
    -- Move all employees to new department
    UPDATE employees
    SET department_id = new_dept_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE department_id = old_dept_id;
    
    -- Log the reorganization
    INSERT INTO audit_logs (
        user_id, action, action_category, resource_type,
        resource_id, resource_name, status, severity,
        metadata
    ) VALUES (
        performed_by,
        'DEPARTMENT_REORGANIZATION',
        'EMPLOYEE',
        'DEPARTMENT',
        old_dept_id::TEXT,
        old_dept_name,
        'success',
        'warning',
        jsonb_build_object(
            'old_department', old_dept_name,
            'new_department', new_dept_name,
            'employees_moved', employee_count
        )
    );
    
    RAISE NOTICE 'Moved % employees from % to %', employee_count, old_dept_name, new_dept_name;
END;
$$;

-- Procedure to bulk create designations
CREATE OR REPLACE PROCEDURE bulk_create_designations(
    designations JSONB,
    created_by UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    designation JSONB;
    created_count INT := 0;
BEGIN
    FOR designation IN SELECT * FROM jsonb_array_elements(designations)
    LOOP
        INSERT INTO designations (
            title,
            department_id,
            description,
            level
        ) VALUES (
            designation->>'title',
            (designation->>'department_id')::INT,
            designation->>'description',
            COALESCE((designation->>'level')::INT, 1)
        );
        
        created_count := created_count + 1;
    END LOOP;
    
    -- Log bulk creation
    INSERT INTO audit_logs (
        user_id, action, action_category, resource_type,
        status, metadata
    ) VALUES (
        created_by,
        'BULK_CREATE_DESIGNATIONS',
        'SETTINGS',
        'DESIGNATION',
        'success',
        jsonb_build_object('count', created_count)
    );
    
    RAISE NOTICE 'Created % designations', created_count;
END;
$$;

-- Function to get org chart data
CREATE OR REPLACE FUNCTION get_org_chart()
RETURNS TABLE(
    department_id INT,
    department_name VARCHAR(100),
    designation_id UUID,
    designation_title VARCHAR(255),
    designation_level INT,
    employee_id VARCHAR(20),
    employee_name VARCHAR(255),
    reporting_manager_id VARCHAR(20),
    hierarchy_level INT
) AS $$
WITH RECURSIVE employee_hierarchy AS (
    -- Base case: top-level employees (no manager)
    SELECT 
        e.id AS emp_id,
        e.first_name || ' ' || e.last_name AS emp_name,
        e.department_id,
        e.designation_id,
        e.reporting_manager_id,
        1 AS level
    FROM employees e
    WHERE e.reporting_manager_id IS NULL
      AND e.status = 'active'
    
    UNION ALL
    
    -- Recursive case: employees with managers
    SELECT 
        e.id,
        e.first_name || ' ' || e.last_name,
        e.department_id,
        e.designation_id,
        e.reporting_manager_id,
        eh.level + 1
    FROM employees e
    JOIN employee_hierarchy eh ON e.reporting_manager_id = eh.emp_id
    WHERE e.status = 'active'
      AND eh.level < 20
)
SELECT 
    d.id,
    d.name,
    des.id,
    des.title,
    des.level,
    eh.emp_id,
    eh.emp_name,
    eh.reporting_manager_id,
    eh.level
FROM employee_hierarchy eh
JOIN departments d ON eh.department_id = d.id
JOIN designations des ON eh.designation_id = des.id
ORDER BY d.name, eh.level, des.level, eh.emp_name;
$$ LANGUAGE sql;

-- Function to validate organizational structure integrity
CREATE OR REPLACE FUNCTION validate_org_structure()
RETURNS TABLE(
    check_name VARCHAR(100),
    status VARCHAR(20),
    issue_count INT,
    details TEXT
) AS $$
BEGIN
    -- Check 1: Departments without heads
    RETURN QUERY
    SELECT 
        'Departments without heads'::VARCHAR(100),
        CASE WHEN COUNT(*) > 0 THEN 'warning' ELSE 'ok' END::VARCHAR(20),
        COUNT(*)::INT,
        STRING_AGG(name, ', ')
    FROM departments
    WHERE head_employee_id IS NULL AND is_active = true;
    
    -- Check 2: Designations without employees
    RETURN QUERY
    SELECT 
        'Designations without employees'::VARCHAR(100),
        CASE WHEN COUNT(*) > 0 THEN 'info' ELSE 'ok' END::VARCHAR(20),
        COUNT(*)::INT,
        STRING_AGG(title, ', ')
    FROM designations d
    WHERE NOT EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.designation_id = d.id AND e.status = 'active'
    );
    
    -- Check 3: Circular reporting relationships
    RETURN QUERY
    SELECT 
        'Circular reporting relationships'::VARCHAR(100),
        CASE WHEN COUNT(*) > 0 THEN 'error' ELSE 'ok' END::VARCHAR(20),
        COUNT(*)::INT,
        STRING_AGG(id::TEXT, ', ')
    FROM employees e1
    WHERE EXISTS (
        SELECT 1 FROM employees e2
        WHERE e2.id = e1.reporting_manager_id
          AND e2.reporting_manager_id = e1.id
    );
    
    -- Check 4: Orphaned designations (invalid department)
    RETURN QUERY
    SELECT 
        'Orphaned designations'::VARCHAR(100),
        CASE WHEN COUNT(*) > 0 THEN 'error' ELSE 'ok' END::VARCHAR(20),
        COUNT(*)::INT,
        STRING_AGG(d.title, ', ')
    FROM designations d
    WHERE NOT EXISTS (
        SELECT 1 FROM departments dept 
        WHERE dept.id = d.department_id
    );
    
    -- Check 5: Employees with invalid departments
    RETURN QUERY
    SELECT 
        'Employees with invalid departments'::VARCHAR(100),
        CASE WHEN COUNT(*) > 0 THEN 'error' ELSE 'ok' END::VARCHAR(20),
        COUNT(*)::INT,
        STRING_AGG(e.id, ', ')
    FROM employees e
    WHERE NOT EXISTS (
        SELECT 1 FROM departments d 
        WHERE d.id = e.department_id
    ) AND e.status = 'active';
END;
$$ LANGUAGE plpgsql;
```

**Views for Organizational Insights**:

```sql
-- View: Department summary with employee counts
CREATE OR REPLACE VIEW v_department_summary AS
SELECT 
    d.id,
    d.name,
    d.description,
    d.is_active,
    e_head.first_name || ' ' || e_head.last_name AS department_head,
    COUNT(e.id) AS total_employees,
    COUNT(e.id) FILTER (WHERE e.status = 'active') AS active_employees,
    COUNT(DISTINCT e.designation_id) AS unique_designations,
    ROUND(AVG(e.ctc), 2) AS average_ctc,
    ROUND(SUM(e.ctc), 2) AS total_salary_cost,
    d.created_at,
    d.updated_at
FROM departments d
LEFT JOIN employees e_head ON d.head_employee_id = e_head.id
LEFT JOIN employees e ON d.id = e.department_id
GROUP BY d.id, d.name, d.description, d.is_active, e_head.first_name, e_head.last_name, d.created_at, d.updated_at;

COMMENT ON VIEW v_department_summary IS 'Department overview with employee counts and salary totals';

-- View: Designation summary with employee counts
CREATE OR REPLACE VIEW v_designation_summary AS
SELECT 
    des.id,
    des.title,
    des.level,
    dept.name AS department,
    rep.title AS reports_to,
    COUNT(e.id) AS employee_count,
    ROUND(AVG(e.ctc), 2) AS average_ctc,
    MIN(e.ctc) AS min_ctc,
    MAX(e.ctc) AS max_ctc,
    des.created_at,
    des.updated_at
FROM designations des
JOIN departments dept ON des.department_id = dept.id
LEFT JOIN designations rep ON des.reporting_to_designation_id = rep.id
LEFT JOIN employees e ON des.id = e.designation_id AND e.status = 'active'
GROUP BY des.id, des.title, des.level, dept.name, rep.title, des.created_at, des.updated_at;

COMMENT ON VIEW v_designation_summary IS 'Designation overview with employee counts and salary ranges';

-- View: Organizational hierarchy tree
CREATE OR REPLACE VIEW v_org_hierarchy AS
WITH RECURSIVE hierarchy AS (
    -- Top level: employees without managers
    SELECT 
        e.id,
        e.first_name || ' ' || e.last_name AS employee_name,
        e.department_id,
        dept.name AS department,
        e.designation_id,
        des.title AS designation,
        e.reporting_manager_id,
        1 AS level,
        e.first_name || ' ' || e.last_name AS hierarchy_path,
        ARRAY[e.id] AS path_ids
    FROM employees e
    JOIN departments dept ON e.department_id = dept.id
    JOIN designations des ON e.designation_id = des.id
    WHERE e.reporting_manager_id IS NULL
      AND e.status = 'active'
    
    UNION ALL
    
    -- Subordinates
    SELECT 
        e.id,
        e.first_name || ' ' || e.last_name,
        e.department_id,
        dept.name,
        e.designation_id,
        des.title,
        e.reporting_manager_id,
        h.level + 1,
        h.hierarchy_path || ' → ' || e.first_name || ' ' || e.last_name,
        h.path_ids || e.id
    FROM employees e
    JOIN hierarchy h ON e.reporting_manager_id = h.id
    JOIN departments dept ON e.department_id = dept.id
    JOIN designations des ON e.designation_id = des.id
    WHERE e.status = 'active'
      AND h.level < 20
      AND NOT e.id = ANY(h.path_ids)  -- Prevent cycles
)
SELECT * FROM hierarchy
ORDER BY level, department, designation, employee_name;

COMMENT ON VIEW v_org_hierarchy IS 'Complete organizational hierarchy tree with reporting paths';

-- View: Department headcount by designation level
CREATE OR REPLACE VIEW v_department_headcount_by_level AS
SELECT 
    dept.id AS department_id,
    dept.name AS department,
    des.level AS designation_level,
    COUNT(e.id) AS employee_count,
    ROUND(AVG(e.ctc), 2) AS average_ctc,
    ROUND(SUM(e.ctc), 2) AS total_cost
FROM departments dept
LEFT JOIN employees e ON dept.id = e.department_id AND e.status = 'active'
LEFT JOIN designations des ON e.designation_id = des.id
GROUP BY dept.id, dept.name, des.level
ORDER BY dept.name, des.level;

COMMENT ON VIEW v_department_headcount_by_level IS 'Employee distribution and costs by department and designation level';
```

---

## 3. Employee Core Data

### Table: `employees`

```sql
CREATE TABLE employees (
    -- Primary Key
    id VARCHAR(20) PRIMARY KEY,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    photo TEXT,
    contact_number VARCHAR(20) NOT NULL,
    alternate_contact VARCHAR(20),
    emergency_contact VARCHAR(20),
    personal_email VARCHAR(255) NOT NULL,
    permanent_address TEXT,
    current_address TEXT NOT NULL,
    pf_number VARCHAR(50),
    esi_number VARCHAR(50),
    blood_group VARCHAR(10),
    father_name VARCHAR(255),
    mother_name VARCHAR(255),
    
    -- Employment Details
    employment_type VARCHAR(20) NOT NULL CHECK (employment_type IN ('full-time', 'part-time')),
    department_id INT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    designation_id UUID NOT NULL REFERENCES designations(id) ON DELETE RESTRICT,
    reporting_manager_id VARCHAR(20) NULL REFERENCES employees(id) ON DELETE SET NULL,
    join_date DATE,
    official_email VARCHAR(255) UNIQUE NOT NULL,
    work_location VARCHAR(50) NOT NULL CHECK (work_location IN ('Bangalore', 'Mangaluru', 'Mysore', 'Belagaum', 'Hubballi', 'Kolar', 'Tumkur', 'Shivamogga', 'Remote')),
    probation_period INT NOT NULL DEFAULT 6,
    grade VARCHAR(10) CHECK (grade IN ('A', 'B', 'C', 'D')),
    
    -- Salary Information
    ctc DECIMAL(12,2) NOT NULL,
    basic DECIMAL(12,2) NOT NULL,
    hra_percentage DECIMAL(5,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    conveyance DECIMAL(12,2) NOT NULL,
    telephone DECIMAL(12,2) NOT NULL,
    medical_allowance DECIMAL(12,2) NOT NULL,
    special_allowance DECIMAL(12,2) NOT NULL,
    employee_health_insurance_annual DECIMAL(12,2) NOT NULL DEFAULT 1000,
    gross DECIMAL(12,2) NOT NULL,
    include_pf BOOLEAN NOT NULL,
    include_esi BOOLEAN NOT NULL,
    pf_deduction DECIMAL(12,2) NOT NULL,
    esi_deduction DECIMAL(12,2) NOT NULL,
    employer_esi DECIMAL(12,2),
    employer_pf DECIMAL(12,2) NOT NULL,
    professional_tax DECIMAL(12,2) NOT NULL,
    tds DECIMAL(12,2) NOT NULL,
    tds_monthly DECIMAL(12,2),
    gst_monthly DECIMAL(12,2),
    gst_annual DECIMAL(12,2),
    professional_fees_monthly DECIMAL(12,2),
    professional_fees_inclusive BOOLEAN,
    professional_fees_base_monthly DECIMAL(12,2),
    professional_fees_total_monthly DECIMAL(12,2),
    professional_fees_base_annual DECIMAL(12,2),
    professional_fees_total_annual DECIMAL(12,2),
    net DECIMAL(12,2) NOT NULL,
    payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('Bank', 'Cash', 'Cheque')),
    
    -- Status and Audit
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_employees_designation ON employees(designation_id);
CREATE INDEX idx_employees_reporting_manager ON employees(reporting_manager_id);
CREATE INDEX idx_employees_official_email ON employees(official_email);
CREATE INDEX idx_employees_employment_type ON employees(employment_type);
CREATE INDEX idx_employees_name ON employees(first_name, last_name);
CREATE INDEX idx_employees_join_date ON employees(join_date);

-- Check Constraints
ALTER TABLE employees ADD CONSTRAINT chk_basic_calculation CHECK (basic = ctc * 0.5 / 12);
ALTER TABLE employees ADD CONSTRAINT chk_positive_salary CHECK (ctc > 0 AND gross > 0 AND net > 0);
ALTER TABLE employees ADD CONSTRAINT chk_probation_period CHECK (probation_period >= 0);

COMMENT ON TABLE employees IS 'Core employee information with personal, employment, and salary details';
COMMENT ON COLUMN employees.id IS 'Sequential numeric ID (1, 2, 3...)';
COMMENT ON COLUMN employees.official_email IS 'Auto-generated: {first_name}.{last_name}@ecovale.com';
COMMENT ON COLUMN employees.basic IS 'Monthly basic = 50% of annual CTC / 12';
COMMENT ON COLUMN employees.special_allowance IS 'Balancing allowance to match CTC';
```

**Triggers and Functions**:

```sql
-- Function to generate next employee ID
CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS VARCHAR(20) AS $$
DECLARE
    max_id INT;
    next_id INT;
BEGIN
    SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) INTO max_id FROM employees;
    next_id := max_id + 1;
    RETURN next_id::VARCHAR;
END;
$$ LANGUAGE plpgsql;

-- Function to generate official email
CREATE OR REPLACE FUNCTION generate_official_email(fname VARCHAR, lname VARCHAR)
RETURNS VARCHAR(255) AS $$
DECLARE
    base_email VARCHAR(255);
    final_email VARCHAR(255);
    counter INT := 1;
BEGIN
    -- Create base email: firstname.lastname@ecovale.com
    base_email := LOWER(REGEXP_REPLACE(fname, '[^a-zA-Z0-9]', '', 'g')) || '.' || 
                  LOWER(REGEXP_REPLACE(lname, '[^a-zA-Z0-9]', '', 'g')) || '@ecovale.com';
    
    final_email := base_email;
    
    -- Handle duplicates by adding numeric suffix
    WHILE EXISTS (SELECT 1 FROM employees WHERE official_email = final_email) LOOP
        counter := counter + 1;
        final_email := LOWER(REGEXP_REPLACE(fname, '[^a-zA-Z0-9]', '', 'g')) || '.' || 
                       LOWER(REGEXP_REPLACE(lname, '[^a-zA-Z0-9]', '', 'g')) || 
                       counter || '@ecovale.com';
    END LOOP;
    
    RETURN final_email;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate employee ID and official email before insert
CREATE OR REPLACE FUNCTION before_employee_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-generate employee ID if not provided
    IF NEW.id IS NULL OR NEW.id = '' THEN
        NEW.id := generate_employee_id();
    END IF;
    
    -- Auto-generate official email if not provided
    IF NEW.official_email IS NULL OR NEW.official_email = '' THEN
        NEW.official_email := generate_official_email(NEW.first_name, NEW.last_name);
    END IF;
    
    -- Set timestamps
    NEW.created_at := CURRENT_TIMESTAMP;
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_before_employee_insert
BEFORE INSERT ON employees
FOR EACH ROW
EXECUTE FUNCTION before_employee_insert();

-- Trigger to update timestamp on employee update
CREATE OR REPLACE FUNCTION before_employee_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_before_employee_update
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION before_employee_update();

-- Trigger to prevent circular reporting relationships
CREATE OR REPLACE FUNCTION check_circular_reporting()
RETURNS TRIGGER AS $$
DECLARE
    current_manager VARCHAR(20);
    depth INT := 0;
    max_depth INT := 20;
BEGIN
    -- If no reporting manager, no circular check needed
    IF NEW.reporting_manager_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Cannot report to self
    IF NEW.reporting_manager_id = NEW.id THEN
        RAISE EXCEPTION 'Employee cannot report to themselves';
    END IF;
    
    -- Check for circular reference by traversing up the hierarchy
    current_manager := NEW.reporting_manager_id;
    
    WHILE current_manager IS NOT NULL AND depth < max_depth LOOP
        -- If we encounter the employee being updated, it's circular
        IF current_manager = NEW.id THEN
            RAISE EXCEPTION 'Circular reporting relationship detected';
        END IF;
        
        -- Move up to next manager
        SELECT reporting_manager_id INTO current_manager
        FROM employees
        WHERE id = current_manager;
        
        depth := depth + 1;
    END LOOP;
    
    IF depth >= max_depth THEN
        RAISE EXCEPTION 'Reporting hierarchy too deep (max 20 levels)';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_circular_reporting
BEFORE INSERT OR UPDATE OF reporting_manager_id ON employees
FOR EACH ROW
EXECUTE FUNCTION check_circular_reporting();

-- Function to validate salary calculations
CREATE OR REPLACE FUNCTION validate_salary_calculations()
RETURNS TRIGGER AS $$
BEGIN
    -- Check basic salary is 50% of CTC
    IF ABS(NEW.basic - (NEW.ctc * 0.5 / 12)) > 1 THEN
        RAISE EXCEPTION 'Basic salary must be 50%% of annual CTC / 12. Expected: %, Got: %', 
            (NEW.ctc * 0.5 / 12), NEW.basic;
    END IF;
    
    -- Check HRA calculation
    IF ABS(NEW.hra - (NEW.basic * NEW.hra_percentage / 100)) > 1 THEN
        RAISE EXCEPTION 'HRA must equal basic * hra_percentage. Expected: %, Got: %',
            (NEW.basic * NEW.hra_percentage / 100), NEW.hra;
    END IF;
    
    -- Check gross calculation (sum of all allowances)
    DECLARE
        calculated_gross DECIMAL(12,2);
    BEGIN
        calculated_gross := NEW.basic + NEW.hra + NEW.conveyance + 
                           NEW.telephone + NEW.medical_allowance + NEW.special_allowance;
        
        IF ABS(NEW.gross - calculated_gross) > 1 THEN
            RAISE EXCEPTION 'Gross must equal sum of allowances. Expected: %, Got: %',
                calculated_gross, NEW.gross;
        END IF;
    END;
    
    -- Check net calculation (gross - deductions)
    DECLARE
        calculated_net DECIMAL(12,2);
        total_deductions DECIMAL(12,2);
    BEGIN
        total_deductions := NEW.pf_deduction + NEW.esi_deduction + 
                           NEW.professional_tax + COALESCE(NEW.tds_monthly, 0);
        calculated_net := NEW.gross - total_deductions;
        
        IF ABS(NEW.net - calculated_net) > 1 THEN
            RAISE EXCEPTION 'Net salary must equal gross - deductions. Expected: %, Got: %',
                calculated_net, NEW.net;
        END IF;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_salary
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION validate_salary_calculations();
```

**Stored Procedures for Employee Operations**:

```sql
-- Procedure to soft delete employee (set status to inactive)
CREATE OR REPLACE PROCEDURE soft_delete_employee(emp_id VARCHAR(20))
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE employees
    SET status = 'inactive',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = emp_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found', emp_id;
    END IF;
END;
$$;

-- Procedure to reactivate employee
CREATE OR REPLACE PROCEDURE reactivate_employee(emp_id VARCHAR(20))
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE employees
    SET status = 'active',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = emp_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found', emp_id;
    END IF;
END;
$$;

-- Function to get employee hierarchy (all subordinates)
CREATE OR REPLACE FUNCTION get_employee_hierarchy(manager_id VARCHAR(20))
RETURNS TABLE(
    employee_id VARCHAR(20),
    employee_name VARCHAR(255),
    designation VARCHAR(255),
    level INT
) AS $$
WITH RECURSIVE hierarchy AS (
    -- Base case: direct reports
    SELECT 
        e.id,
        e.first_name || ' ' || e.last_name AS name,
        d.title,
        1 AS level
    FROM employees e
    JOIN designations d ON e.designation_id = d.id
    WHERE e.reporting_manager_id = manager_id
    
    UNION ALL
    
    -- Recursive case: reports of reports
    SELECT 
        e.id,
        e.first_name || ' ' || e.last_name,
        d.title,
        h.level + 1
    FROM employees e
    JOIN designations d ON e.designation_id = d.id
    JOIN hierarchy h ON e.reporting_manager_id = h.id
    WHERE h.level < 10  -- Prevent infinite loops
)
SELECT id, name, title, level FROM hierarchy
ORDER BY level, name;
$$ LANGUAGE sql;

-- Function to get employee reporting chain (all managers up to CEO)
CREATE OR REPLACE FUNCTION get_reporting_chain(emp_id VARCHAR(20))
RETURNS TABLE(
    manager_id VARCHAR(20),
    manager_name VARCHAR(255),
    designation VARCHAR(255),
    level INT
) AS $$
WITH RECURSIVE chain AS (
    -- Base case: employee's direct manager
    SELECT 
        m.id,
        m.first_name || ' ' || m.last_name AS name,
        d.title,
        1 AS level
    FROM employees e
    JOIN employees m ON e.reporting_manager_id = m.id
    JOIN designations d ON m.designation_id = d.id
    WHERE e.id = emp_id
    
    UNION ALL
    
    -- Recursive case: manager's manager
    SELECT 
        m.id,
        m.first_name || ' ' || m.last_name,
        d.title,
        c.level + 1
    FROM employees m
    JOIN designations d ON m.designation_id = d.id
    JOIN chain c ON m.id = (
        SELECT reporting_manager_id 
        FROM employees 
        WHERE id = c.id
    )
    WHERE c.level < 10  -- Prevent infinite loops
)
SELECT id, name, title, level FROM chain
ORDER BY level;
$$ LANGUAGE sql;

-- Procedure to calculate employee tenure
CREATE OR REPLACE FUNCTION calculate_employee_tenure(emp_id VARCHAR(20))
RETURNS TABLE(
    years INT,
    months INT,
    days INT,
    total_months INT,
    total_days INT
) AS $$
DECLARE
    join_dt DATE;
BEGIN
    SELECT join_date INTO join_dt FROM employees WHERE id = emp_id;
    
    IF join_dt IS NULL THEN
        RAISE EXCEPTION 'Employee % not found or has no join date', emp_id;
    END IF;
    
    RETURN QUERY
    SELECT 
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_dt))::INT,
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, join_dt))::INT,
        EXTRACT(DAY FROM AGE(CURRENT_DATE, join_dt))::INT,
        ((EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_dt)) * 12) + 
         EXTRACT(MONTH FROM AGE(CURRENT_DATE, join_dt)))::INT,
        (CURRENT_DATE - join_dt)::INT;
END;
$$ LANGUAGE plpgsql;

-- Procedure to bulk update employee salaries (annual increment)
CREATE OR REPLACE PROCEDURE bulk_update_employee_salaries(
    p_increment_percentage DECIMAL(5,2),
    p_effective_date DATE,
    p_department_id INT DEFAULT NULL,
    p_updated_by UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_employee RECORD;
    v_count INT := 0;
BEGIN
    FOR v_employee IN 
        SELECT id, first_name, last_name, ctc 
        FROM employees 
        WHERE status = 'active'
          AND (p_department_id IS NULL OR department_id = p_department_id)
    LOOP
        -- Calculate new CTC
        DECLARE
            v_new_ctc DECIMAL(12,2);
        BEGIN
            v_new_ctc := v_employee.ctc * (1 + p_increment_percentage / 100);
            
            -- Update CTC (other components will be recalculated by application)
            UPDATE employees
            SET ctc = v_new_ctc,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = v_employee.id;
            
            -- Log salary revision
            INSERT INTO audit_logs (
                user_id, action, action_category, resource_type,
                resource_id, resource_name, status, metadata
            ) VALUES (
                p_updated_by,
                'SALARY_INCREMENT',
                'EMPLOYEE',
                'EMPLOYEE',
                v_employee.id,
                v_employee.first_name || ' ' || v_employee.last_name,
                'success',
                jsonb_build_object(
                    'old_ctc', v_employee.ctc,
                    'new_ctc', v_new_ctc,
                    'increment_percentage', p_increment_percentage,
                    'effective_date', p_effective_date
                )
            );
            
            v_count := v_count + 1;
        END;
    END LOOP;
    
    RAISE NOTICE 'Updated salaries for % employees with % increment', v_count, p_increment_percentage;
END;
$$;

-- Procedure to transfer employee to different department/designation
CREATE OR REPLACE PROCEDURE transfer_employee(
    p_employee_id VARCHAR(20),
    p_new_department_id INT DEFAULT NULL,
    p_new_designation_id UUID DEFAULT NULL,
    p_new_reporting_manager_id VARCHAR(20) DEFAULT NULL,
    p_new_work_location VARCHAR(50) DEFAULT NULL,
    p_effective_date DATE DEFAULT CURRENT_DATE,
    p_transfer_reason TEXT DEFAULT NULL,
    p_initiated_by UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_employee RECORD;
    v_changes JSONB;
BEGIN
    -- Get current employee details
    SELECT * INTO v_employee 
    FROM employees 
    WHERE id = p_employee_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found', p_employee_id;
    END IF;
    
    -- Build changes object
    v_changes := jsonb_build_object();
    
    -- Update fields if provided
    IF p_new_department_id IS NOT NULL AND p_new_department_id != v_employee.department_id THEN
        UPDATE employees SET department_id = p_new_department_id WHERE id = p_employee_id;
        v_changes := v_changes || jsonb_build_object('department_id', 
            jsonb_build_object('from', v_employee.department_id, 'to', p_new_department_id));
    END IF;
    
    IF p_new_designation_id IS NOT NULL AND p_new_designation_id != v_employee.designation_id THEN
        UPDATE employees SET designation_id = p_new_designation_id WHERE id = p_employee_id;
        v_changes := v_changes || jsonb_build_object('designation_id',
            jsonb_build_object('from', v_employee.designation_id::TEXT, 'to', p_new_designation_id::TEXT));
    END IF;
    
    IF p_new_reporting_manager_id IS NOT NULL 
       AND p_new_reporting_manager_id != COALESCE(v_employee.reporting_manager_id, '') THEN
        UPDATE employees SET reporting_manager_id = p_new_reporting_manager_id WHERE id = p_employee_id;
        v_changes := v_changes || jsonb_build_object('reporting_manager_id',
            jsonb_build_object('from', v_employee.reporting_manager_id, 'to', p_new_reporting_manager_id));
    END IF;
    
    IF p_new_work_location IS NOT NULL AND p_new_work_location != v_employee.work_location THEN
        UPDATE employees SET work_location = p_new_work_location WHERE id = p_employee_id;
        v_changes := v_changes || jsonb_build_object('work_location',
            jsonb_build_object('from', v_employee.work_location, 'to', p_new_work_location));
    END IF;
    
    -- Log transfer
    INSERT INTO audit_logs (
        user_id, action, action_category, resource_type,
        resource_id, resource_name, status, severity, changes, metadata
    ) VALUES (
        p_initiated_by,
        'EMPLOYEE_TRANSFER',
        'EMPLOYEE',
        'EMPLOYEE',
        p_employee_id,
        v_employee.first_name || ' ' || v_employee.last_name,
        'success',
        'info',
        v_changes,
        jsonb_build_object(
            'effective_date', p_effective_date,
            'transfer_reason', p_transfer_reason
        )
    );
    
    RAISE NOTICE 'Employee % transferred successfully', p_employee_id;
END;
$$;

-- Function to get employees by filter criteria
CREATE OR REPLACE FUNCTION search_employees(
    p_search_text VARCHAR DEFAULT NULL,
    p_department_id INT DEFAULT NULL,
    p_designation_id UUID DEFAULT NULL,
    p_status VARCHAR DEFAULT 'active',
    p_work_location VARCHAR DEFAULT NULL,
    p_employment_type VARCHAR DEFAULT NULL,
    p_min_ctc DECIMAL DEFAULT NULL,
    p_max_ctc DECIMAL DEFAULT NULL,
    p_join_date_from DATE DEFAULT NULL,
    p_join_date_to DATE DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE(
    id VARCHAR(20),
    full_name VARCHAR(255),
    official_email VARCHAR(255),
    department VARCHAR(100),
    designation VARCHAR(255),
    reporting_manager VARCHAR(255),
    ctc DECIMAL(12,2),
    join_date DATE,
    tenure_months INT,
    status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.first_name || ' ' || e.last_name,
        e.official_email,
        dept.name,
        des.title,
        mgr.first_name || ' ' || mgr.last_name,
        e.ctc,
        e.join_date,
        ((EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.join_date)) * 12) + 
         EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.join_date)))::INT,
        e.status
    FROM employees e
    JOIN departments dept ON e.department_id = dept.id
    JOIN designations des ON e.designation_id = des.id
    LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
    WHERE 
        (p_search_text IS NULL OR 
         e.first_name ILIKE '%' || p_search_text || '%' OR
         e.last_name ILIKE '%' || p_search_text || '%' OR
         e.official_email ILIKE '%' || p_search_text || '%' OR
         e.id ILIKE '%' || p_search_text || '%')
        AND (p_department_id IS NULL OR e.department_id = p_department_id)
        AND (p_designation_id IS NULL OR e.designation_id = p_designation_id)
        AND (p_status IS NULL OR e.status = p_status)
        AND (p_work_location IS NULL OR e.work_location = p_work_location)
        AND (p_employment_type IS NULL OR e.employment_type = p_employment_type)
        AND (p_min_ctc IS NULL OR e.ctc >= p_min_ctc)
        AND (p_max_ctc IS NULL OR e.ctc <= p_max_ctc)
        AND (p_join_date_from IS NULL OR e.join_date >= p_join_date_from)
        AND (p_join_date_to IS NULL OR e.join_date <= p_join_date_to)
    ORDER BY e.first_name, e.last_name
    LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to validate employee data integrity
CREATE OR REPLACE FUNCTION validate_employee_data(emp_id VARCHAR(20))
RETURNS TABLE(
    check_name VARCHAR(100),
    status VARCHAR(20),
    message TEXT
) AS $$
DECLARE
    v_employee RECORD;
BEGIN
    SELECT * INTO v_employee FROM employees WHERE id = emp_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'Employee Exists'::VARCHAR(100), 'error'::VARCHAR(20), 
            'Employee not found'::TEXT;
        RETURN;
    END IF;
    
    -- Check 1: Basic salary calculation
    RETURN QUERY
    SELECT 
        'Basic Salary'::VARCHAR(100),
        CASE WHEN ABS(v_employee.basic - (v_employee.ctc * 0.5 / 12)) <= 1 
             THEN 'ok' ELSE 'error' END::VARCHAR(20),
        CASE WHEN ABS(v_employee.basic - (v_employee.ctc * 0.5 / 12)) <= 1 
             THEN 'Basic salary is correct'
             ELSE 'Basic salary mismatch. Expected: ' || (v_employee.ctc * 0.5 / 12)::TEXT || 
                  ', Got: ' || v_employee.basic::TEXT END;
    
    -- Check 2: Gross salary calculation
    RETURN QUERY
    SELECT 
        'Gross Salary'::VARCHAR(100),
        CASE WHEN ABS(v_employee.gross - (v_employee.basic + v_employee.hra + 
            v_employee.conveyance + v_employee.telephone + v_employee.medical_allowance + 
            v_employee.special_allowance)) <= 1 THEN 'ok' ELSE 'error' END::VARCHAR(20),
        'Gross salary calculation check';
    
    -- Check 3: Department exists
    RETURN QUERY
    SELECT 
        'Department Valid'::VARCHAR(100),
        CASE WHEN EXISTS(SELECT 1 FROM departments WHERE id = v_employee.department_id) 
             THEN 'ok' ELSE 'error' END::VARCHAR(20),
        'Department reference check';
    
    -- Check 4: Designation exists
    RETURN QUERY
    SELECT 
        'Designation Valid'::VARCHAR(100),
        CASE WHEN EXISTS(SELECT 1 FROM designations WHERE id = v_employee.designation_id) 
             THEN 'ok' ELSE 'error' END::VARCHAR(20),
        'Designation reference check';
    
    -- Check 5: Reporting manager exists
    IF v_employee.reporting_manager_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'Reporting Manager Valid'::VARCHAR(100),
            CASE WHEN EXISTS(SELECT 1 FROM employees WHERE id = v_employee.reporting_manager_id) 
                 THEN 'ok' ELSE 'error' END::VARCHAR(20),
            'Reporting manager reference check';
    END IF;
    
    -- Check 6: Email uniqueness
    RETURN QUERY
    SELECT 
        'Email Unique'::VARCHAR(100),
        CASE WHEN (SELECT COUNT(*) FROM employees 
                   WHERE official_email = v_employee.official_email) = 1 
             THEN 'ok' ELSE 'error' END::VARCHAR(20),
        'Official email uniqueness check';
    
    -- Check 7: Personal email uniqueness
    RETURN QUERY
    SELECT 
        'Personal Email Unique'::VARCHAR(100),
        CASE WHEN (SELECT COUNT(*) FROM employees 
                   WHERE personal_email = v_employee.personal_email) = 1 
             THEN 'ok' ELSE 'warning' END::VARCHAR(20),
        'Personal email uniqueness check';
    
    -- Check 8: PF number uniqueness (if provided)
    IF v_employee.pf_number IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'PF Number Unique'::VARCHAR(100),
            CASE WHEN (SELECT COUNT(*) FROM employees 
                       WHERE pf_number = v_employee.pf_number) = 1 
                 THEN 'ok' ELSE 'error' END::VARCHAR(20),
            'PF number uniqueness check';
    END IF;
    
    -- Check 9: ESI number uniqueness (if provided)
    IF v_employee.esi_number IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            'ESI Number Unique'::VARCHAR(100),
            CASE WHEN (SELECT COUNT(*) FROM employees 
                       WHERE esi_number = v_employee.esi_number) = 1 
                 THEN 'ok' ELSE 'error' END::VARCHAR(20),
            'ESI number uniqueness check';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get employee count statistics
CREATE OR REPLACE FUNCTION get_employee_statistics()
RETURNS TABLE(
    metric VARCHAR(100),
    value BIGINT,
    percentage DECIMAL(5,2)
) AS $$
DECLARE
    total_employees BIGINT;
BEGIN
    SELECT COUNT(*) INTO total_employees FROM employees;
    
    -- Total employees
    RETURN QUERY
    SELECT 'Total Employees'::VARCHAR(100), total_employees, 100.00;
    
    -- Active employees
    RETURN QUERY
    SELECT 'Active Employees'::VARCHAR(100), 
           COUNT(*), 
           ROUND((COUNT(*) * 100.0 / NULLIF(total_employees, 0))::NUMERIC, 2)
    FROM employees WHERE status = 'active';
    
    -- Inactive employees
    RETURN QUERY
    SELECT 'Inactive Employees'::VARCHAR(100), 
           COUNT(*), 
           ROUND((COUNT(*) * 100.0 / NULLIF(total_employees, 0))::NUMERIC, 2)
    FROM employees WHERE status = 'inactive';
    
    -- Full-time employees
    RETURN QUERY
    SELECT 'Full-Time Employees'::VARCHAR(100), 
           COUNT(*), 
           ROUND((COUNT(*) * 100.0 / NULLIF(total_employees, 0))::NUMERIC, 2)
    FROM employees WHERE employment_type = 'full-time' AND status = 'active';
    
    -- Part-time employees
    RETURN QUERY
    SELECT 'Part-Time Employees'::VARCHAR(100), 
           COUNT(*), 
           ROUND((COUNT(*) * 100.0 / NULLIF(total_employees, 0))::NUMERIC, 2)
    FROM employees WHERE employment_type = 'part-time' AND status = 'active';
    
    -- PF enrolled
    RETURN QUERY
    SELECT 'PF Enrolled'::VARCHAR(100), 
           COUNT(*), 
           ROUND((COUNT(*) * 100.0 / NULLIF(total_employees, 0))::NUMERIC, 2)
    FROM employees WHERE include_pf = true AND status = 'active';
    
    -- ESI enrolled
    RETURN QUERY
    SELECT 'ESI Enrolled'::VARCHAR(100), 
           COUNT(*), 
           ROUND((COUNT(*) * 100.0 / NULLIF(total_employees, 0))::NUMERIC, 2)
    FROM employees WHERE include_esi = true AND status = 'active';
END;
$$ LANGUAGE plpgsql;
```

**Views for Employee Management**:

```sql
-- View: Employee summary with department and designation details
CREATE OR REPLACE VIEW v_employee_summary AS
SELECT 
    e.id,
    e.first_name || ' ' || e.last_name AS full_name,
    e.official_email,
    e.personal_email,
    e.contact_number,
    dept.name AS department,
    des.title AS designation,
    mgr.first_name || ' ' || mgr.last_name AS reporting_manager,
    e.work_location,
    e.employment_type,
    e.join_date,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.join_date))::INT AS tenure_years,
    ((EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.join_date)) * 12) + 
     EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.join_date)))::INT AS tenure_months,
    e.ctc,
    e.gross,
    e.net,
    e.include_pf,
    e.include_esi,
    e.status,
    e.created_at,
    e.updated_at
FROM employees e
JOIN departments dept ON e.department_id = dept.id
JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id;

COMMENT ON VIEW v_employee_summary IS 'Employee overview with department, designation, and tenure details';

-- View: Active employees only
CREATE OR REPLACE VIEW v_active_employees AS
SELECT * FROM v_employee_summary WHERE status = 'active';

COMMENT ON VIEW v_active_employees IS 'Active employees only with all details';

-- View: Employee salary breakdown
CREATE OR REPLACE VIEW v_employee_salary_breakdown AS
SELECT 
    e.id,
    e.first_name || ' ' || e.last_name AS employee_name,
    dept.name AS department,
    des.title AS designation,
    e.ctc AS annual_ctc,
    e.basic AS monthly_basic,
    e.hra,
    e.conveyance,
    e.telephone,
    e.medical_allowance,
    e.special_allowance,
    e.gross AS monthly_gross,
    e.pf_deduction,
    e.esi_deduction,
    e.professional_tax,
    COALESCE(e.tds_monthly, 0) AS tds,
    (e.pf_deduction + e.esi_deduction + e.professional_tax + COALESCE(e.tds_monthly, 0)) AS total_deductions,
    e.net AS monthly_net,
    e.net * 12 AS annual_net,
    e.employer_pf,
    COALESCE(e.employer_esi, 0) AS employer_esi,
    (e.employer_pf + COALESCE(e.employer_esi, 0)) AS employer_contribution,
    (e.ctc + e.employer_pf + COALESCE(e.employer_esi, 0)) AS total_cost_to_company
FROM employees e
JOIN departments dept ON e.department_id = dept.id
JOIN designations des ON e.designation_id = des.id
WHERE e.status = 'active';

COMMENT ON VIEW v_employee_salary_breakdown IS 'Detailed salary breakdown with employer costs';

-- View: Employees joining in current year
CREATE OR REPLACE VIEW v_new_joiners AS
SELECT 
    e.id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    dept.name AS department,
    des.title AS designation,
    e.join_date,
    e.probation_period,
    e.join_date + (e.probation_period || ' months')::INTERVAL AS probation_end_date,
    CASE 
        WHEN CURRENT_DATE < e.join_date + (e.probation_period || ' months')::INTERVAL 
        THEN 'In Probation'
        ELSE 'Confirmed'
    END AS employment_status,
    (CURRENT_DATE - e.join_date) AS days_since_joining,
    e.status
FROM employees e
JOIN departments dept ON e.department_id = dept.id
JOIN designations des ON e.designation_id = des.id
WHERE EXTRACT(YEAR FROM e.join_date) = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY e.join_date DESC;

COMMENT ON VIEW v_new_joiners IS 'Employees who joined in the current year with probation status';

-- View: Employees with probation ending soon
CREATE OR REPLACE VIEW v_probation_ending_soon AS
SELECT 
    e.id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    dept.name AS department,
    des.title AS designation,
    mgr.first_name || ' ' || mgr.last_name AS reporting_manager,
    e.join_date,
    e.join_date + (e.probation_period || ' months')::INTERVAL AS probation_end_date,
    (e.join_date + (e.probation_period || ' months')::INTERVAL - CURRENT_DATE)::INT AS days_remaining
FROM employees e
JOIN departments dept ON e.department_id = dept.id
JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
WHERE e.status = 'active'
  AND e.join_date + (e.probation_period || ' months')::INTERVAL BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY probation_end_date;

COMMENT ON VIEW v_probation_ending_soon IS 'Employees whose probation period ends in next 30 days';

-- View: Upcoming birthdays
CREATE OR REPLACE VIEW v_upcoming_birthdays AS
SELECT 
    e.id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    dept.name AS department,
    e.date_of_birth,
    TO_CHAR(e.date_of_birth, 'DD Mon') AS birthday,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.date_of_birth))::INT AS age,
    CASE 
        WHEN TO_CHAR(e.date_of_birth, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD')
        THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 
                       EXTRACT(MONTH FROM e.date_of_birth)::INT, 
                       EXTRACT(DAY FROM e.date_of_birth)::INT)
        ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 
                       EXTRACT(MONTH FROM e.date_of_birth)::INT, 
                       EXTRACT(DAY FROM e.date_of_birth)::INT)
    END AS next_birthday,
    CASE 
        WHEN TO_CHAR(e.date_of_birth, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD')
        THEN (MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 
                        EXTRACT(MONTH FROM e.date_of_birth)::INT, 
                        EXTRACT(DAY FROM e.date_of_birth)::INT) - CURRENT_DATE)::INT
        ELSE (MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 
                        EXTRACT(MONTH FROM e.date_of_birth)::INT, 
                        EXTRACT(DAY FROM e.date_of_birth)::INT) - CURRENT_DATE)::INT
    END AS days_until_birthday
FROM employees e
JOIN departments dept ON e.department_id = dept.id
WHERE e.status = 'active'
  AND e.date_of_birth IS NOT NULL
  AND CASE 
        WHEN TO_CHAR(e.date_of_birth, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD')
        THEN (MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 
                        EXTRACT(MONTH FROM e.date_of_birth)::INT, 
                        EXTRACT(DAY FROM e.date_of_birth)::INT) - CURRENT_DATE)::INT
        ELSE (MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 
                        EXTRACT(MONTH FROM e.date_of_birth)::INT, 
                        EXTRACT(DAY FROM e.date_of_birth)::INT) - CURRENT_DATE)::INT
    END <= 30
ORDER BY days_until_birthday;

COMMENT ON VIEW v_upcoming_birthdays IS 'Employees with birthdays in next 30 days';

-- View: Work anniversary reminders
CREATE OR REPLACE VIEW v_work_anniversaries AS
SELECT 
    e.id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    dept.name AS department,
    des.title AS designation,
    e.join_date,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.join_date))::INT AS years_completed,
    TO_CHAR(e.join_date, 'DD Mon') AS anniversary_date,
    CASE 
        WHEN TO_CHAR(e.join_date, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD')
        THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 
                       EXTRACT(MONTH FROM e.join_date)::INT, 
                       EXTRACT(DAY FROM e.join_date)::INT)
        ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 
                       EXTRACT(MONTH FROM e.join_date)::INT, 
                       EXTRACT(DAY FROM e.join_date)::INT)
    END AS next_anniversary,
    CASE 
        WHEN TO_CHAR(e.join_date, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD')
        THEN (MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 
                        EXTRACT(MONTH FROM e.join_date)::INT, 
                        EXTRACT(DAY FROM e.join_date)::INT) - CURRENT_DATE)::INT
        ELSE (MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 
                        EXTRACT(MONTH FROM e.join_date)::INT, 
                        EXTRACT(DAY FROM e.join_date)::INT) - CURRENT_DATE)::INT
    END AS days_until_anniversary
FROM employees e
JOIN departments dept ON e.department_id = dept.id
JOIN designations des ON e.designation_id = des.id
WHERE e.status = 'active'
  AND e.join_date IS NOT NULL
  AND CASE 
        WHEN TO_CHAR(e.join_date, 'MM-DD') >= TO_CHAR(CURRENT_DATE, 'MM-DD')
        THEN (MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 
                        EXTRACT(MONTH FROM e.join_date)::INT, 
                        EXTRACT(DAY FROM e.join_date)::INT) - CURRENT_DATE)::INT
        ELSE (MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1, 
                        EXTRACT(MONTH FROM e.join_date)::INT, 
                        EXTRACT(DAY FROM e.join_date)::INT) - CURRENT_DATE)::INT
    END <= 30
ORDER BY days_until_anniversary;

COMMENT ON VIEW v_work_anniversaries IS 'Employees with work anniversaries in next 30 days';

-- View: Department-wise employee distribution
CREATE OR REPLACE VIEW v_department_employee_distribution AS
SELECT 
    dept.id AS department_id,
    dept.name AS department,
    COUNT(e.id) AS total_employees,
    COUNT(e.id) FILTER (WHERE e.employment_type = 'full-time') AS full_time_count,
    COUNT(e.id) FILTER (WHERE e.employment_type = 'part-time') AS part_time_count,
    COUNT(e.id) FILTER (WHERE e.gender = 'Male') AS male_count,
    COUNT(e.id) FILTER (WHERE e.gender = 'Female') AS female_count,
    COUNT(e.id) FILTER (WHERE e.gender = 'Other') AS other_gender_count,
    ROUND(AVG(e.ctc), 2) AS average_ctc,
    MIN(e.ctc) AS min_ctc,
    MAX(e.ctc) AS max_ctc,
    ROUND(SUM(e.ctc), 2) AS total_salary_cost,
    ROUND(AVG(EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.join_date))), 2) AS average_tenure_years
FROM departments dept
LEFT JOIN employees e ON dept.id = e.department_id AND e.status = 'active'
GROUP BY dept.id, dept.name
ORDER BY total_employees DESC;

COMMENT ON VIEW v_department_employee_distribution IS 'Employee distribution and demographics by department';
```

---

### Table: `bank_details`

```sql
CREATE TABLE bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) NOT NULL,  -- Encrypted at rest
    ifsc_code VARCHAR(11) NOT NULL CHECK (LENGTH(ifsc_code) = 11 AND ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
    branch VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL DEFAULT 'Savings' CHECK (account_type IN ('Savings', 'Current', 'Salary')),
    is_primary BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMP NULL,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_method VARCHAR(50) NULL,
    verification_reference VARCHAR(100) NULL,
    proof_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deactivated_at TIMESTAMP NULL,
    deactivated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deactivation_reason TEXT NULL,
    last_used_for_payment TIMESTAMP NULL,
    payment_failure_count INT NOT NULL DEFAULT 0,
    last_payment_failure_reason TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT unique_employee_account UNIQUE (employee_id, account_number),
    CONSTRAINT unique_account_ifsc UNIQUE (account_number, ifsc_code),
    CONSTRAINT check_verification CHECK (verified_at IS NULL OR verified_by IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_bank_details_employee ON bank_details(employee_id);
CREATE INDEX idx_bank_details_primary ON bank_details(employee_id, is_primary) WHERE is_primary = true;
CREATE INDEX idx_bank_details_active ON bank_details(employee_id, is_active) WHERE is_active = true;
CREATE INDEX idx_bank_details_verification ON bank_details(is_verified, verified_at);
CREATE UNIQUE INDEX idx_bank_details_unique_account ON bank_details(account_number, ifsc_code);
CREATE INDEX idx_bank_details_payment_failures ON bank_details(payment_failure_count, last_payment_failure_reason) WHERE payment_failure_count > 0;

-- Trigger: Ensure only one primary account per employee
CREATE OR REPLACE FUNCTION ensure_single_primary_bank_account()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        -- Unset any existing primary accounts for this employee
        UPDATE bank_details
        SET is_primary = false,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = NEW.updated_by
        WHERE employee_id = NEW.employee_id
          AND id != NEW.id
          AND is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary_bank_account
BEFORE INSERT OR UPDATE OF is_primary ON bank_details
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION ensure_single_primary_bank_account();

-- Trigger: Validate IFSC code format
CREATE OR REPLACE FUNCTION validate_ifsc_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Convert to uppercase
    NEW.ifsc_code := UPPER(NEW.ifsc_code);
    
    -- Validate format: First 4 chars alphabetic, 5th char '0', last 6 chars alphanumeric
    IF NOT (NEW.ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$') THEN
        RAISE EXCEPTION 'Invalid IFSC code format: %. Expected format: XXXX0XXXXXX', NEW.ifsc_code;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_ifsc_code
BEFORE INSERT OR UPDATE OF ifsc_code ON bank_details
FOR EACH ROW
EXECUTE FUNCTION validate_ifsc_code();

-- Trigger: Prevent deactivation of primary account
CREATE OR REPLACE FUNCTION prevent_primary_deactivation()
RETURNS TRIGGER AS $$
DECLARE
    other_accounts INT;
BEGIN
    IF NEW.is_active = false AND OLD.is_primary = true THEN
        -- Check if there are other active accounts
        SELECT COUNT(*) INTO other_accounts
        FROM bank_details
        WHERE employee_id = NEW.employee_id
          AND id != NEW.id
          AND is_active = true;
        
        IF other_accounts = 0 THEN
            RAISE EXCEPTION 'Cannot deactivate primary account without designating a new primary account first';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_primary_deactivation
BEFORE UPDATE OF is_active ON bank_details
FOR EACH ROW
EXECUTE FUNCTION prevent_primary_deactivation();

-- Procedure: Verify bank account (penny drop)
CREATE OR REPLACE PROCEDURE verify_bank_account(
    p_bank_account_id UUID,
    p_verified_by UUID,
    p_verification_method VARCHAR,
    p_verification_reference VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE bank_details
    SET is_verified = true,
        verified_at = CURRENT_TIMESTAMP,
        verified_by = p_verified_by,
        verification_method = p_verification_method,
        verification_reference = p_verification_reference,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = p_verified_by
    WHERE id = p_bank_account_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bank account not found: %', p_bank_account_id;
    END IF;
END;
$$;

-- Procedure: Record payment failure
CREATE OR REPLACE PROCEDURE record_payment_failure(
    p_bank_account_id UUID,
    p_failure_reason TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE bank_details
    SET payment_failure_count = payment_failure_count + 1,
        last_payment_failure_reason = p_failure_reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_bank_account_id;
    
    -- Alert HR if failure count exceeds threshold
    IF (SELECT payment_failure_count FROM bank_details WHERE id = p_bank_account_id) >= 3 THEN
        -- Trigger alert (implement notification logic)
        RAISE NOTICE 'ALERT: Bank account % has failed % times. Reason: %', 
            p_bank_account_id,
            (SELECT payment_failure_count FROM bank_details WHERE id = p_bank_account_id),
            p_failure_reason;
    END IF;
END;
$$;

-- View: Unverified bank accounts
CREATE OR REPLACE VIEW v_unverified_bank_accounts AS
SELECT 
    ba.id,
    ba.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    ba.bank_name,
    ba.account_holder_name,
    CONCAT(REPEAT('X', LENGTH(ba.account_number) - 4), RIGHT(ba.account_number, 4)) AS masked_account_number,
    ba.ifsc_code,
    ba.branch,
    ba.is_primary,
    ba.created_at,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - ba.created_at) AS days_pending
FROM bank_details ba
JOIN employees e ON ba.employee_id = e.employee_id
WHERE ba.is_verified = false
  AND ba.is_active = true
ORDER BY ba.created_at ASC;

-- View: Failed bank accounts (for troubleshooting)
CREATE OR REPLACE VIEW v_failed_bank_accounts AS
SELECT 
    ba.id,
    ba.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    ba.bank_name,
    ba.payment_failure_count,
    ba.last_payment_failure_reason,
    ba.last_used_for_payment
FROM bank_details ba
JOIN employees e ON ba.employee_id = e.employee_id
WHERE ba.payment_failure_count > 0
  AND ba.is_active = true
ORDER BY ba.payment_failure_count DESC, ba.last_used_for_payment DESC;

COMMENT ON TABLE bank_details IS 'Employee bank account information with verification and payment tracking';
COMMENT ON COLUMN bank_details.account_number IS 'Encrypted at rest using AES-256';
COMMENT ON COLUMN bank_details.is_primary IS 'Primary account for salary payment - exactly one per employee';
COMMENT ON COLUMN bank_details.is_verified IS 'Account verified via penny drop test or manual verification';
```

---

### Table: `documents`

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    document_category VARCHAR(50) NOT NULL CHECK (document_category IN ('Identity', 'Address', 'Educational', 'Professional', 'Financial', 'Compliance', 'HR', 'Other')),
    document_type VARCHAR(100) NOT NULL,
    document_subtype VARCHAR(100) NULL,
    file_name VARCHAR(255) NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    storage_type VARCHAR(20) NOT NULL DEFAULT 'database' CHECK (storage_type IN ('database', 'cloud', 'local')),
    file_data TEXT NULL,  -- Base64 encoded (if storage_type = 'database')
    file_path VARCHAR(500) NULL,  -- Cloud/local path
    storage_bucket VARCHAR(100) NULL,
    storage_region VARCHAR(50) NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash for integrity and deduplication
    thumbnail_data TEXT NULL,
    page_count INT NULL,
    document_number VARCHAR(100) NULL,  -- Encrypted
    document_number_masked VARCHAR(100) NULL,
    issue_date DATE NULL,
    expiry_date DATE NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMP NULL,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verification_method VARCHAR(50) NULL,
    verification_notes TEXT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT false,
    is_confidential BOOLEAN NOT NULL DEFAULT false,
    access_level VARCHAR(20) NOT NULL DEFAULT 'hr' CHECK (access_level IN ('employee', 'hr', 'admin', 'public')),
    is_expired BOOLEAN GENERATED ALWAYS AS (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE) STORED,
    days_until_expiry INT GENERATED ALWAYS AS (CASE WHEN expiry_date IS NOT NULL THEN (expiry_date - CURRENT_DATE) ELSE NULL END) STORED,
    expiry_alert_sent BOOLEAN NOT NULL DEFAULT false,
    expiry_alert_date TIMESTAMP NULL,
    version INT NOT NULL DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    is_latest_version BOOLEAN NOT NULL DEFAULT true,
    replacement_reason TEXT NULL,
    tags TEXT[] NULL,
    ocr_extracted_text TEXT NULL,
    ocr_metadata JSONB NULL,
    upload_source VARCHAR(50) NULL,
    upload_ip_address VARCHAR(45) NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deletion_reason TEXT NULL,
    notes TEXT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT unique_employee_document UNIQUE (employee_id, document_type, document_number) WHERE is_latest_version = true AND is_deleted = false,
    CONSTRAINT check_storage_data CHECK (
        (storage_type = 'database' AND file_data IS NOT NULL) OR
        (storage_type != 'database' AND file_path IS NOT NULL)
    ),
    CONSTRAINT check_verification CHECK (verified_at IS NULL OR verified_by IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_documents_employee ON documents(employee_id);
CREATE INDEX idx_documents_active ON documents(employee_id, is_latest_version, is_deleted) WHERE is_latest_version = true AND is_deleted = false;
CREATE INDEX idx_documents_type ON documents(employee_id, document_category, document_type);
CREATE INDEX idx_documents_expiry ON documents(expiry_date, is_expired) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_documents_verification ON documents(is_verified, verified_at);
CREATE INDEX idx_documents_fulltext ON documents USING GIN(to_tsvector('english', ocr_extracted_text));
CREATE INDEX idx_documents_ocr_metadata ON documents USING GIN(ocr_metadata);
CREATE INDEX idx_documents_hash ON documents(file_hash);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_mandatory ON documents(employee_id, is_mandatory, is_verified) WHERE is_mandatory = true;
CREATE INDEX idx_documents_number ON documents(document_number) WHERE document_number IS NOT NULL;

-- Trigger: Validate file size limit
CREATE OR REPLACE FUNCTION validate_document_file_size()
RETURNS TRIGGER AS $$
BEGIN
    -- Maximum file size: 10 MB
    IF NEW.file_size > 10485760 THEN
        RAISE EXCEPTION 'File size exceeds 10 MB limit: % bytes', NEW.file_size;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_document_file_size
BEFORE INSERT OR UPDATE OF file_size ON documents
FOR EACH ROW
EXECUTE FUNCTION validate_document_file_size();

-- Trigger: Auto-set previous version to non-latest when new version uploaded
CREATE OR REPLACE FUNCTION manage_document_versions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_document_id IS NOT NULL THEN
        -- Mark parent as non-latest
        UPDATE documents
        SET is_latest_version = false,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.parent_document_id;
        
        -- Inherit version number from parent
        SELECT version + 1 INTO NEW.version
        FROM documents
        WHERE id = NEW.parent_document_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_manage_document_versions
BEFORE INSERT ON documents
FOR EACH ROW
WHEN (NEW.parent_document_id IS NOT NULL)
EXECUTE FUNCTION manage_document_versions();

-- Trigger: Send expiry alerts
CREATE OR REPLACE FUNCTION check_document_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_alert_sent = false THEN
        -- Send alert if expiring within 60 days
        IF NEW.days_until_expiry <= 60 AND NEW.days_until_expiry > 0 THEN
            -- Trigger notification (implement notification logic)
            RAISE NOTICE 'ALERT: Document % for employee % expires in % days',
                NEW.document_type, NEW.employee_id, NEW.days_until_expiry;
            
            NEW.expiry_alert_sent := true;
            NEW.expiry_alert_date := CURRENT_TIMESTAMP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_document_expiry
BEFORE INSERT OR UPDATE OF expiry_date ON documents
FOR EACH ROW
EXECUTE FUNCTION check_document_expiry();

-- Procedure: Upload document with deduplication
CREATE OR REPLACE PROCEDURE upload_document(
    p_employee_id VARCHAR(20),
    p_document_type VARCHAR(100),
    p_file_name VARCHAR(255),
    p_file_data TEXT,
    p_file_hash VARCHAR(64),
    p_file_size BIGINT,
    p_mime_type VARCHAR(100),
    p_created_by UUID,
    OUT p_document_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_id UUID;
BEGIN
    -- Check for duplicate file by hash
    SELECT id INTO v_existing_id
    FROM documents
    WHERE file_hash = p_file_hash
      AND is_deleted = false
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
        -- File already exists, create reference without storing data again
        INSERT INTO documents (employee_id, document_type, file_name, storage_type, file_path, mime_type, file_size, file_hash, created_by)
        VALUES (p_employee_id, p_document_type, p_file_name, 'cloud', 'duplicate:' || v_existing_id, p_mime_type, p_file_size, p_file_hash, p_created_by)
        RETURNING id INTO p_document_id;
        
        RAISE NOTICE 'Duplicate file detected. Created reference to existing document.';
    ELSE
        -- New file, store normally
        INSERT INTO documents (employee_id, document_type, file_name, storage_type, file_data, mime_type, file_size, file_hash, created_by)
        VALUES (p_employee_id, p_document_type, p_file_name, 'database', p_file_data, p_mime_type, p_file_size, p_file_hash, p_created_by)
        RETURNING id INTO p_document_id;
    END IF;
END;
$$;

-- View: Expiring documents (next 60 days)
CREATE OR REPLACE VIEW v_expiring_documents AS
SELECT 
    d.id,
    d.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    d.document_type,
    d.document_number_masked,
    d.expiry_date,
    d.days_until_expiry,
    d.is_expired,
    d.is_verified,
    CASE
        WHEN d.days_until_expiry <= 0 THEN 'Expired'
        WHEN d.days_until_expiry <= 7 THEN 'Critical'
        WHEN d.days_until_expiry <= 30 THEN 'Urgent'
        ELSE 'Warning'
    END AS alert_level
FROM documents d
JOIN employees e ON d.employee_id = e.employee_id
WHERE d.expiry_date IS NOT NULL
  AND d.days_until_expiry <= 60
  AND d.is_latest_version = true
  AND d.is_deleted = false
ORDER BY d.days_until_expiry ASC;

-- View: Mandatory documents status
CREATE OR REPLACE VIEW v_mandatory_documents_status AS
SELECT 
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    COUNT(d.id) FILTER (WHERE d.is_mandatory = true) AS mandatory_count,
    COUNT(d.id) FILTER (WHERE d.is_mandatory = true AND d.is_verified = true) AS verified_count,
    COUNT(d.id) FILTER (WHERE d.is_mandatory = true AND d.is_verified = false) AS pending_count,
    CASE
        WHEN COUNT(d.id) FILTER (WHERE d.is_mandatory = true AND d.is_verified = false) = 0 THEN 'Complete'
        ELSE 'Incomplete'
    END AS status
FROM employees e
LEFT JOIN documents d ON e.employee_id = d.employee_id AND d.is_latest_version = true AND d.is_deleted = false
GROUP BY e.employee_id, e.first_name, e.last_name, e.official_email
HAVING COUNT(d.id) FILTER (WHERE d.is_mandatory = true) > 0
ORDER BY pending_count DESC, e.first_name;

-- View: Document version history
CREATE OR REPLACE VIEW v_document_version_history AS
SELECT 
    d.employee_id,
    d.document_type,
    d.version,
    d.is_latest_version,
    d.file_name,
    d.uploaded_at,
    d.replacement_reason,
    u.full_name AS uploaded_by_name,
    d.parent_document_id
FROM documents d
LEFT JOIN users u ON d.created_by = u.id
WHERE d.is_deleted = false
ORDER BY d.employee_id, d.document_type, d.version DESC;

COMMENT ON TABLE documents IS 'Comprehensive document management with versioning, expiry tracking, OCR, and access control';
COMMENT ON COLUMN documents.file_hash IS 'SHA-256 hash for integrity verification and deduplication';
COMMENT ON COLUMN documents.is_expired IS 'Auto-computed: true if expiry_date < CURRENT_DATE';
COMMENT ON COLUMN documents.days_until_expiry IS 'Auto-computed: expiry_date - CURRENT_DATE';
```

---

### Table: `career_history`

```sql
CREATE TABLE career_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    event_category VARCHAR(50) NOT NULL CHECK (event_category IN ('Career', 'Compensation', 'Transfer', 'Status', 'Performance', 'Other')),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('promotion', 'demotion', 'lateral_move', 'increment', 'salary_revision', 'department_transfer', 'location_transfer', 'confirmation', 'contract_renewal', 'resignation', 'termination', 'retirement', 'performance_bonus', 'award', 'warning', 'suspension', 'reinstatement', 'sabbatical', 'other')),
    event_date DATE NOT NULL,
    event_title VARCHAR(255) NOT NULL,
    event_description TEXT NULL,
    old_designation_id UUID REFERENCES designations(id) ON DELETE SET NULL,
    new_designation_id UUID REFERENCES designations(id) ON DELETE SET NULL,
    old_department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    new_department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    old_location VARCHAR(100) NULL,
    new_location VARCHAR(100) NULL,
    old_reporting_manager_id VARCHAR(20) REFERENCES employees(employee_id) ON DELETE SET NULL,
    new_reporting_manager_id VARCHAR(20) REFERENCES employees(employee_id) ON DELETE SET NULL,
    old_employment_type VARCHAR(50) NULL,
    new_employment_type VARCHAR(50) NULL,
    old_salary_ctc DECIMAL(12,2) NULL,
    new_salary_ctc DECIMAL(12,2) NULL,
    salary_increment_amount DECIMAL(12,2) GENERATED ALWAYS AS (CASE WHEN new_salary_ctc IS NOT NULL AND old_salary_ctc IS NOT NULL THEN new_salary_ctc - old_salary_ctc ELSE NULL END) STORED,
    salary_increment_percentage DECIMAL(5,2) GENERATED ALWAYS AS (CASE WHEN new_salary_ctc IS NOT NULL AND old_salary_ctc IS NOT NULL AND old_salary_ctc > 0 THEN ((new_salary_ctc - old_salary_ctc) / old_salary_ctc) * 100 ELSE NULL END) STORED,
    old_salary_breakdown JSONB NULL,
    new_salary_breakdown JSONB NULL,
    increment_reason VARCHAR(100) NULL,
    performance_rating VARCHAR(50) NULL,
    performance_review_id UUID NULL,
    bonus_amount DECIMAL(12,2) NULL,
    bonus_type VARCHAR(50) NULL,
    award_title VARCHAR(255) NULL,
    award_description TEXT NULL,
    warning_type VARCHAR(100) NULL,
    warning_reason TEXT NULL,
    suspension_start_date DATE NULL,
    suspension_end_date DATE NULL,
    resignation_date DATE NULL,
    last_working_date DATE NULL,
    exit_reason VARCHAR(100) NULL,
    exit_interview_completed BOOLEAN NOT NULL DEFAULT false,
    exit_interview_feedback TEXT NULL,
    rehire_eligible BOOLEAN NULL,
    initiated_by VARCHAR(100) NULL,
    recommended_by VARCHAR(255) NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_date DATE NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'on_hold')),
    approval_comments TEXT NULL,
    effective_from DATE NULL,
    effective_until DATE NULL,
    is_retroactive BOOLEAN NOT NULL DEFAULT false,
    retroactive_from_date DATE NULL,
    arrears_amount DECIMAL(12,2) NULL,
    arrears_paid BOOLEAN NOT NULL DEFAULT false,
    arrears_payment_date DATE NULL,
    document_ids UUID[] NULL,
    attachments JSONB NULL,
    metadata JSONB NULL,
    tags TEXT[] NULL,
    is_milestone BOOLEAN NOT NULL DEFAULT false,
    milestone_type VARCHAR(100) NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'internal' CHECK (visibility IN ('public', 'internal', 'confidential')),
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_sent_at TIMESTAMP NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT check_approval CHECK (approved_by IS NULL OR approval_date IS NOT NULL),
    CONSTRAINT check_retroactive CHECK (NOT is_retroactive OR retroactive_from_date IS NOT NULL),
    CONSTRAINT check_suspension CHECK (suspension_start_date IS NULL OR suspension_end_date IS NULL OR suspension_end_date >= suspension_start_date)
);

-- Indexes
CREATE INDEX idx_career_history_employee ON career_history(employee_id);
CREATE INDEX idx_career_history_event ON career_history(employee_id, event_type, event_date DESC);
CREATE INDEX idx_career_history_approval ON career_history(approval_status, created_at DESC) WHERE approval_status = 'pending';
CREATE INDEX idx_career_history_effective ON career_history(employee_id, effective_from, effective_until);
CREATE INDEX idx_career_history_milestones ON career_history(is_milestone, milestone_type, event_date DESC) WHERE is_milestone = true;
CREATE INDEX idx_career_history_salary ON career_history(employee_id, event_date DESC) WHERE new_salary_ctc IS NOT NULL;
CREATE INDEX idx_career_history_exits ON career_history(event_type, event_date DESC) WHERE event_type IN ('resignation', 'termination', 'retirement');
CREATE INDEX idx_career_history_retroactive ON career_history(is_retroactive, arrears_paid) WHERE is_retroactive = true;
CREATE INDEX idx_career_history_performance ON career_history(performance_review_id) WHERE performance_review_id IS NOT NULL;
CREATE INDEX idx_career_history_timeline ON career_history(employee_id, event_date DESC, created_at DESC);

-- Trigger: Auto-update employee record on approval
CREATE OR REPLACE FUNCTION apply_career_event_to_employee()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.approval_status = 'approved' AND OLD.approval_status != 'approved' THEN
        -- Update designation on promotion/demotion
        IF NEW.new_designation_id IS NOT NULL THEN
            UPDATE employees
            SET designation_id = NEW.new_designation_id,
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = NEW.employee_id;
        END IF;
        
        -- Update department on transfer
        IF NEW.new_department_id IS NOT NULL THEN
            UPDATE employees
            SET department_id = NEW.new_department_id,
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = NEW.employee_id;
        END IF;
        
        -- Update location on transfer
        IF NEW.new_location IS NOT NULL THEN
            UPDATE employees
            SET work_location = NEW.new_location,
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = NEW.employee_id;
        END IF;
        
        -- Update manager on reporting change
        IF NEW.new_reporting_manager_id IS NOT NULL THEN
            UPDATE employees
            SET reporting_manager_id = NEW.new_reporting_manager_id,
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = NEW.employee_id;
        END IF;
        
        -- Update CTC on salary change
        IF NEW.new_salary_ctc IS NOT NULL THEN
            UPDATE employees
            SET ctc = NEW.new_salary_ctc,
                basic = (NEW.new_salary_ctc * 0.5 / 12),
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = NEW.employee_id;
            
            -- Recalculate all salary components
            -- (This would typically call a stored procedure to recalculate full salary breakdown)
        END IF;
        
        -- Update status on confirmation
        IF NEW.event_type = 'confirmation' THEN
            UPDATE employees
            SET status = 'active',
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = NEW.employee_id;
        END IF;
        
        -- Update status on exit
        IF NEW.event_type IN ('resignation', 'termination', 'retirement') THEN
            UPDATE employees
            SET status = 'exited',
                updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = NEW.employee_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_apply_career_event_to_employee
AFTER UPDATE OF approval_status ON career_history
FOR EACH ROW
WHEN (NEW.approval_status = 'approved')
EXECUTE FUNCTION apply_career_event_to_employee();

-- Trigger: Auto-detect milestones
CREATE OR REPLACE FUNCTION detect_career_milestones()
RETURNS TRIGGER AS $$
DECLARE
    v_years_of_service INT;
    v_promotion_count INT;
BEGIN
    -- Check for work anniversary milestones
    IF NEW.event_type = 'anniversary' THEN
        SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date))
        INTO v_years_of_service
        FROM employees
        WHERE employee_id = NEW.employee_id;
        
        IF v_years_of_service IN (1, 5, 10, 15, 20) THEN
            NEW.is_milestone := true;
            NEW.milestone_type := v_years_of_service || '_year';
        END IF;
    END IF;
    
    -- Check for first promotion
    IF NEW.event_type = 'promotion' THEN
        SELECT COUNT(*) INTO v_promotion_count
        FROM career_history
        WHERE employee_id = NEW.employee_id
          AND event_type = 'promotion'
          AND id != NEW.id;
        
        IF v_promotion_count = 0 THEN
            NEW.is_milestone := true;
            NEW.milestone_type := 'first_promotion';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_detect_career_milestones
BEFORE INSERT OR UPDATE ON career_history
FOR EACH ROW
EXECUTE FUNCTION detect_career_milestones();

-- Procedure: Create promotion event
CREATE OR REPLACE PROCEDURE create_promotion(
    p_employee_id VARCHAR(20),
    p_new_designation_id UUID,
    p_new_salary_ctc DECIMAL(12,2),
    p_effective_date DATE,
    p_created_by UUID,
    OUT p_event_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_designation_id UUID;
    v_old_salary DECIMAL(12,2);
    v_employee_name VARCHAR(255);
    v_new_designation_title VARCHAR(255);
BEGIN
    -- Get current details
    SELECT designation_id, ctc, first_name || ' ' || last_name
    INTO v_old_designation_id, v_old_salary, v_employee_name
    FROM employees
    WHERE employee_id = p_employee_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee not found: %', p_employee_id;
    END IF;
    
    -- Get new designation title
    SELECT title INTO v_new_designation_title
    FROM designations
    WHERE id = p_new_designation_id;
    
    -- Create career event
    INSERT INTO career_history (
        employee_id, event_category, event_type, event_date, event_title,
        old_designation_id, new_designation_id, old_salary_ctc, new_salary_ctc,
        approval_status, created_by
    )
    VALUES (
        p_employee_id, 'Career', 'promotion', p_effective_date,
        'Promotion to ' || v_new_designation_title,
        v_old_designation_id, p_new_designation_id, v_old_salary, p_new_salary_ctc,
        'pending', p_created_by
    )
    RETURNING id INTO p_event_id;
    
    RAISE NOTICE 'Promotion event created for % (%). Awaiting approval.', v_employee_name, p_employee_id;
END;
$$;

-- View: Pending career approvals
CREATE OR REPLACE VIEW v_pending_career_approvals AS
SELECT 
    ch.id,
    ch.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    ch.event_category,
    ch.event_type,
    ch.event_title,
    ch.event_date,
    ch.effective_from,
    ch.salary_increment_amount,
    ch.salary_increment_percentage,
    ch.created_at,
    ch.initiated_by,
    u.full_name AS created_by_name,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - ch.created_at) AS days_pending
FROM career_history ch
JOIN employees e ON ch.employee_id = e.employee_id
LEFT JOIN users u ON ch.created_by = u.id
WHERE ch.approval_status = 'pending'
ORDER BY ch.created_at ASC;

-- View: Employee career timeline
CREATE OR REPLACE VIEW v_employee_career_timeline AS
SELECT 
    ch.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    ch.event_date,
    ch.event_category,
    ch.event_type,
    ch.event_title,
    ch.event_description,
    old_des.title AS old_designation,
    new_des.title AS new_designation,
    ch.old_salary_ctc,
    ch.new_salary_ctc,
    ch.salary_increment_percentage,
    ch.approval_status,
    ch.is_milestone,
    ch.visibility
FROM career_history ch
JOIN employees e ON ch.employee_id = e.employee_id
LEFT JOIN designations old_des ON ch.old_designation_id = old_des.id
LEFT JOIN designations new_des ON ch.new_designation_id = new_des.id
ORDER BY ch.employee_id, ch.event_date DESC, ch.created_at DESC;

-- View: Upcoming exits
CREATE OR REPLACE VIEW v_upcoming_exits AS
SELECT 
    ch.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.official_email,
    e.contact_number,
    ch.event_type,
    ch.resignation_date,
    ch.last_working_date,
    ch.exit_reason,
    ch.exit_interview_completed,
    ch.rehire_eligible,
    EXTRACT(DAY FROM ch.last_working_date - CURRENT_DATE) AS days_until_exit
FROM career_history ch
JOIN employees e ON ch.employee_id = e.employee_id
WHERE ch.event_type IN ('resignation', 'termination', 'retirement')
  AND ch.last_working_date >= CURRENT_DATE
  AND ch.approval_status = 'approved'
ORDER BY ch.last_working_date ASC;

-- View: Salary increment analytics
CREATE OR REPLACE VIEW v_salary_increment_analytics AS
SELECT 
    EXTRACT(YEAR FROM ch.event_date) AS year,
    ch.increment_reason,
    COUNT(*) AS increment_count,
    AVG(ch.salary_increment_percentage) AS avg_increment_percentage,
    MIN(ch.salary_increment_percentage) AS min_increment_percentage,
    MAX(ch.salary_increment_percentage) AS max_increment_percentage,
    SUM(ch.salary_increment_amount) AS total_increment_amount
FROM career_history ch
WHERE ch.event_type IN ('increment', 'salary_revision', 'promotion')
  AND ch.approval_status = 'approved'
  AND ch.new_salary_ctc IS NOT NULL
GROUP BY EXTRACT(YEAR FROM ch.event_date), ch.increment_reason
ORDER BY year DESC, increment_count DESC;

COMMENT ON TABLE career_history IS 'Comprehensive career progression tracking with approvals, salary changes, transfers, and milestones';
COMMENT ON COLUMN career_history.salary_increment_amount IS 'Auto-computed: new_salary_ctc - old_salary_ctc';
COMMENT ON COLUMN career_history.salary_increment_percentage IS 'Auto-computed: ((new - old) / old) * 100';
```

---

### Table: `salary_annexures`

```sql
CREATE TABLE salary_annexures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    annexure_number VARCHAR(50) UNIQUE NOT NULL,
    annexure_type VARCHAR(50) NOT NULL DEFAULT 'ctc_breakdown' CHECK (annexure_type IN ('ctc_breakdown', 'salary_slip', 'increment_letter', 'bonus_slip', 'full_final_settlement')),
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_format VARCHAR(10) NOT NULL DEFAULT 'pdf' CHECK (file_format IN ('pdf', 'txt', 'html')),
    file_data TEXT NOT NULL,
    file_size INT NOT NULL,
    template_used VARCHAR(100) NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    salary_snapshot JSONB NOT NULL,
    metadata JSONB NULL,
    is_sent BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP NULL,
    sent_to_email VARCHAR(255) NULL,
    download_count INT NOT NULL DEFAULT 0,
    last_downloaded_at TIMESTAMP NULL,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMP NULL,
    tags TEXT[] NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_sent_details CHECK (NOT is_sent OR (sent_at IS NOT NULL AND sent_to_email IS NOT NULL))
);

CREATE INDEX idx_salary_annexures_employee ON salary_annexures(employee_id);
CREATE INDEX idx_salary_annexures_type ON salary_annexures(employee_id, annexure_type);
CREATE INDEX idx_salary_annexures_date ON salary_annexures(generated_at DESC);
CREATE INDEX idx_salary_annexures_number ON salary_annexures(annexure_number);
CREATE INDEX idx_salary_annexures_downloads ON salary_annexures(download_count DESC, last_downloaded_at DESC);
CREATE INDEX idx_salary_annexures_unsent ON salary_annexures(is_sent, generated_at) WHERE is_sent = false;
CREATE INDEX idx_salary_annexures_snapshot ON salary_annexures USING GIN(salary_snapshot);

-- Trigger: Generate unique annexure number
CREATE OR REPLACE FUNCTION generate_annexure_number()
RETURNS TRIGGER AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_seq INT;
BEGIN
    -- Determine prefix based on type
    v_prefix := CASE NEW.annexure_type
        WHEN 'ctc_breakdown' THEN 'CTCB'
        WHEN 'salary_slip' THEN 'SLIP'
        WHEN 'increment_letter' THEN 'INCR'
        WHEN 'bonus_slip' THEN 'BNUS'
        WHEN 'full_final_settlement' THEN 'FNF'
        ELSE 'ANX'
    END;
    
    -- Generate sequential number
    SELECT COALESCE(MAX(CAST(SUBSTRING(annexure_number FROM '[0-9]+$') AS INT)), 0) + 1
    INTO v_seq
    FROM salary_annexures
    WHERE annexure_number ~ ('^' || v_prefix);
    
    NEW.annexure_number := v_prefix || '/' || 
                           TO_CHAR(NEW.generated_at, 'YYYY') || '/' ||
                           LPAD(v_seq::TEXT, 6, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_annexure_number
BEFORE INSERT ON salary_annexures
FOR EACH ROW
WHEN (NEW.annexure_number IS NULL)
EXECUTE FUNCTION generate_annexure_number();

-- Trigger: Calculate file size from base64
CREATE OR REPLACE FUNCTION calculate_annexure_file_size()
RETURNS TRIGGER AS $$
BEGIN
    NEW.file_size := LENGTH(NEW.file_data);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_annexure_file_size
BEFORE INSERT OR UPDATE OF file_data ON salary_annexures
FOR EACH ROW
EXECUTE FUNCTION calculate_annexure_file_size();

-- Procedure: Generate CTC breakdown annexure
CREATE OR REPLACE PROCEDURE generate_ctc_breakdown_annexure(
    p_employee_id VARCHAR(20),
    p_generated_by UUID,
    OUT p_annexure_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_employee RECORD;
    v_salary_data JSONB;
    v_file_content TEXT;
BEGIN
    -- Get employee details
    SELECT * INTO v_employee FROM employees WHERE id = p_employee_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found', p_employee_id;
    END IF;
    
    -- Build salary snapshot
    v_salary_data := jsonb_build_object(
        'employee_id', v_employee.id,
        'employee_name', v_employee.first_name || ' ' || v_employee.last_name,
        'official_email', v_employee.official_email,
        'department', (SELECT name FROM departments WHERE id = v_employee.department_id),
        'designation', (SELECT title FROM designations WHERE id = v_employee.designation_id),
        'join_date', v_employee.join_date,
        'ctc', v_employee.ctc,
        'basic', v_employee.basic,
        'hra', v_employee.hra,
        'conveyance', v_employee.conveyance,
        'telephone', v_employee.telephone,
        'medical_allowance', v_employee.medical_allowance,
        'special_allowance', v_employee.special_allowance,
        'gross', v_employee.gross,
        'pf_deduction', v_employee.pf_deduction,
        'esi_deduction', v_employee.esi_deduction,
        'professional_tax', v_employee.professional_tax,
        'tds_monthly', v_employee.tds_monthly,
        'net', v_employee.net,
        'employer_pf', v_employee.employer_pf,
        'employer_esi', v_employee.employer_esi,
        'generated_at', CURRENT_TIMESTAMP
    );
    
    -- Generate file content (simplified - would use proper template)
    v_file_content := 'CTC Breakdown - ' || v_employee.first_name || ' ' || v_employee.last_name;
    
    -- Insert annexure
    INSERT INTO salary_annexures (
        employee_id, annexure_type, title, file_name, file_data,
        salary_snapshot, generated_by
    )
    VALUES (
        p_employee_id,
        'ctc_breakdown',
        'CTC Breakdown - ' || v_employee.first_name || ' ' || v_employee.last_name,
        'ctc_breakdown_' || p_employee_id || '_' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '.pdf',
        v_file_content,
        v_salary_data,
        p_generated_by
    )
    RETURNING id INTO p_annexure_id;
    
    RAISE NOTICE 'CTC breakdown annexure generated for employee %', p_employee_id;
END;
$$;

-- Procedure: Track annexure download
CREATE OR REPLACE PROCEDURE track_annexure_download(p_annexure_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE salary_annexures
    SET download_count = download_count + 1,
        last_downloaded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_annexure_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Annexure % not found', p_annexure_id;
    END IF;
END;
$$;

-- Procedure: Send annexure via email
CREATE OR REPLACE PROCEDURE send_annexure_email(
    p_annexure_id UUID,
    p_recipient_email VARCHAR(255)
)
LANGUAGE plpgsql AS $$
DECLARE
    v_annexure RECORD;
BEGIN
    SELECT * INTO v_annexure FROM salary_annexures WHERE id = p_annexure_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Annexure % not found', p_annexure_id;
    END IF;
    
    -- Send email logic would go here
    RAISE NOTICE 'Sending annexure % to %', v_annexure.title, p_recipient_email;
    
    -- Mark as sent
    UPDATE salary_annexures
    SET is_sent = true,
        sent_at = CURRENT_TIMESTAMP,
        sent_to_email = p_recipient_email,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_annexure_id;
END;
$$;

-- View: Employee annexures summary
CREATE OR REPLACE VIEW v_employee_annexures_summary AS
SELECT 
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    sa.annexure_type,
    COUNT(*) AS total_annexures,
    MAX(sa.generated_at) AS latest_generated_at,
    SUM(sa.download_count) AS total_downloads,
    COUNT(*) FILTER (WHERE sa.is_sent = true) AS sent_count,
    COUNT(*) FILTER (WHERE sa.is_sent = false) AS unsent_count
FROM employees e
LEFT JOIN salary_annexures sa ON e.employee_id = sa.employee_id
GROUP BY e.employee_id, e.first_name, e.last_name, sa.annexure_type
ORDER BY e.employee_id, sa.annexure_type;

-- View: Recent annexures
CREATE OR REPLACE VIEW v_recent_annexures AS
SELECT 
    sa.id,
    sa.annexure_number,
    sa.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    sa.annexure_type,
    sa.title,
    sa.generated_at,
    u.full_name AS generated_by_name,
    sa.is_sent,
    sa.download_count,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - sa.generated_at) AS days_ago
FROM salary_annexures sa
JOIN employees e ON sa.employee_id = e.employee_id
LEFT JOIN users u ON sa.generated_by = u.id
WHERE sa.generated_at >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY sa.generated_at DESC;

COMMENT ON TABLE salary_annexures IS 'Generated salary breakdown documents with versioning and tracking';
COMMENT ON COLUMN salary_annexures.annexure_number IS 'Unique identifier: TYPE/YYYY/NNNNNN';
COMMENT ON COLUMN salary_annexures.salary_snapshot IS 'Complete salary data snapshot at generation time for historical accuracy';
COMMENT ON COLUMN salary_annexures.file_data IS 'Base64 encoded PDF or plain text content';
```

---

## 4. Attendance Management

### Table: `attendance_records`

```sql
CREATE TABLE attendance_records (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    month VARCHAR(20) NOT NULL,
    year VARCHAR(4) NOT NULL,
    total_working_days INT NOT NULL CHECK (total_working_days > 0 AND total_working_days <= 31),
    present_days INT NOT NULL CHECK (present_days >= 0),
    absent_days INT NOT NULL CHECK (absent_days >= 0),
    paid_leave INT NOT NULL CHECK (paid_leave >= 0),
    unpaid_leave INT NOT NULL CHECK (unpaid_leave >= 0),
    week_offs INT NOT NULL DEFAULT 0 CHECK (week_offs >= 0),
    holidays INT NOT NULL DEFAULT 0 CHECK (holidays >= 0),
    half_days INT NOT NULL DEFAULT 0 CHECK (half_days >= 0),
    late_arrivals INT NOT NULL DEFAULT 0 CHECK (late_arrivals >= 0),
    early_departures INT NOT NULL DEFAULT 0 CHECK (early_departures >= 0),
    overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0),
    payable_days DECIMAL(5,2) NOT NULL GENERATED ALWAYS AS (present_days + paid_leave + (half_days::DECIMAL / 2)) STORED,
    loss_of_pay_days DECIMAL(5,2) NOT NULL GENERATED ALWAYS AS (unpaid_leave + absent_days - (half_days::DECIMAL / 2)) STORED,
    attendance_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_working_days > 0 
            THEN ROUND(((present_days + paid_leave)::DECIMAL / total_working_days * 100), 2)
            ELSE 0
        END
    ) STORED,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP NULL,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT unique_employee_month_year UNIQUE (employee_id, month, year),
    CONSTRAINT chk_attendance_days_valid CHECK (
        present_days + absent_days + paid_leave + unpaid_leave + week_offs + holidays <= total_working_days + half_days
    )
);

CREATE INDEX idx_attendance_employee ON attendance_records(employee_id);
CREATE INDEX idx_attendance_month_year ON attendance_records(month, year);
CREATE INDEX idx_attendance_created ON attendance_records(created_at DESC);
CREATE INDEX idx_attendance_approval ON attendance_records(is_approved, approved_at) WHERE is_approved = false;
CREATE INDEX idx_attendance_lop ON attendance_records(loss_of_pay_days) WHERE loss_of_pay_days > 0;

-- Trigger: Generate attendance ID
CREATE OR REPLACE FUNCTION generate_attendance_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.id := 'ATT' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT::TEXT;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_attendance_id
BEFORE INSERT ON attendance_records
FOR EACH ROW
WHEN (NEW.id IS NULL)
EXECUTE FUNCTION generate_attendance_id();

-- Trigger: Update timestamps
CREATE OR REPLACE FUNCTION update_attendance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_attendance_timestamp
BEFORE UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION update_attendance_timestamp();

-- Trigger: Validate attendance approval
CREATE OR REPLACE FUNCTION validate_attendance_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_approved = true AND OLD.is_approved = false THEN
        IF NEW.approved_by IS NULL THEN
            RAISE EXCEPTION 'Approver must be specified when approving attendance';
        END IF;
        NEW.approved_at := CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_attendance_approval
BEFORE UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION validate_attendance_approval();

-- Procedure: Import bulk attendance records
CREATE OR REPLACE PROCEDURE import_bulk_attendance(
    p_attendance_data JSONB,
    p_month VARCHAR(20),
    p_year VARCHAR(4),
    p_created_by UUID,
    OUT p_imported_count INT,
    OUT p_failed_count INT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_record JSONB;
    v_employee_id VARCHAR(20);
    v_employee_name VARCHAR(255);
BEGIN
    p_imported_count := 0;
    p_failed_count := 0;
    
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_attendance_data)
    LOOP
        BEGIN
            v_employee_id := v_record->>'employee_id';
            
            -- Get employee name
            SELECT first_name || ' ' || last_name INTO v_employee_name
            FROM employees WHERE employee_id = v_employee_id;
            
            IF v_employee_name IS NULL THEN
                RAISE EXCEPTION 'Employee % not found', v_employee_id;
            END IF;
            
            INSERT INTO attendance_records (
                employee_id, employee_name, month, year,
                total_working_days, present_days, absent_days,
                paid_leave, unpaid_leave, week_offs, holidays,
                half_days, late_arrivals, early_departures,
                overtime_hours, created_by
            )
            VALUES (
                v_employee_id, v_employee_name, p_month, p_year,
                (v_record->>'total_working_days')::INT,
                (v_record->>'present_days')::INT,
                COALESCE((v_record->>'absent_days')::INT, 0),
                COALESCE((v_record->>'paid_leave')::INT, 0),
                COALESCE((v_record->>'unpaid_leave')::INT, 0),
                COALESCE((v_record->>'week_offs')::INT, 0),
                COALESCE((v_record->>'holidays')::INT, 0),
                COALESCE((v_record->>'half_days')::INT, 0),
                COALESCE((v_record->>'late_arrivals')::INT, 0),
                COALESCE((v_record->>'early_departures')::INT, 0),
                COALESCE((v_record->>'overtime_hours')::DECIMAL, 0),
                p_created_by
            )
            ON CONFLICT (employee_id, month, year) 
            DO UPDATE SET
                total_working_days = EXCLUDED.total_working_days,
                present_days = EXCLUDED.present_days,
                absent_days = EXCLUDED.absent_days,
                paid_leave = EXCLUDED.paid_leave,
                unpaid_leave = EXCLUDED.unpaid_leave,
                week_offs = EXCLUDED.week_offs,
                holidays = EXCLUDED.holidays,
                half_days = EXCLUDED.half_days,
                late_arrivals = EXCLUDED.late_arrivals,
                early_departures = EXCLUDED.early_departures,
                overtime_hours = EXCLUDED.overtime_hours,
                updated_by = p_created_by,
                updated_at = CURRENT_TIMESTAMP;
            
            p_imported_count := p_imported_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            p_failed_count := p_failed_count + 1;
            RAISE NOTICE 'Failed to import attendance for employee %: %', v_employee_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Imported % attendance records, % failed', p_imported_count, p_failed_count;
END;
$$;

-- Procedure: Calculate monthly attendance summary for department
CREATE OR REPLACE FUNCTION calculate_department_attendance_summary(
    p_department_id INT,
    p_month VARCHAR(20),
    p_year VARCHAR(4)
)
RETURNS TABLE (
    total_employees INT,
    avg_attendance_percentage DECIMAL(5,2),
    total_lop_days DECIMAL(8,2),
    total_overtime_hours DECIMAL(10,2),
    employees_with_lop INT,
    employees_perfect_attendance INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INT AS total_employees,
        ROUND(AVG(ar.attendance_percentage), 2) AS avg_attendance_percentage,
        SUM(ar.loss_of_pay_days) AS total_lop_days,
        SUM(ar.overtime_hours) AS total_overtime_hours,
        COUNT(*) FILTER (WHERE ar.loss_of_pay_days > 0)::INT AS employees_with_lop,
        COUNT(*) FILTER (WHERE ar.absent_days = 0 AND ar.unpaid_leave = 0)::INT AS employees_perfect_attendance
    FROM attendance_records ar
    JOIN employees e ON ar.employee_id = e.employee_id
    WHERE e.department_id = p_department_id
      AND ar.month = p_month
      AND ar.year = p_year;
END;
$$ LANGUAGE plpgsql;

-- Procedure: Approve attendance for month
CREATE OR REPLACE PROCEDURE approve_monthly_attendance(
    p_month VARCHAR(20),
    p_year VARCHAR(4),
    p_approved_by UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_updated_count INT;
BEGIN
    UPDATE attendance_records
    SET is_approved = true,
        approved_by = p_approved_by,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE month = p_month
      AND year = p_year
      AND is_approved = false;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Approved % attendance records for %/%', v_updated_count, p_month, p_year;
END;
$$;

-- View: Attendance summary by employee
CREATE OR REPLACE VIEW v_employee_attendance_summary AS
SELECT 
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    d.name AS department,
    COUNT(*) AS total_months,
    ROUND(AVG(ar.attendance_percentage), 2) AS avg_attendance_percentage,
    SUM(ar.present_days) AS total_present_days,
    SUM(ar.absent_days) AS total_absent_days,
    SUM(ar.paid_leave) AS total_paid_leave,
    SUM(ar.unpaid_leave) AS total_unpaid_leave,
    SUM(ar.loss_of_pay_days) AS total_lop_days,
    SUM(ar.overtime_hours) AS total_overtime_hours,
    COUNT(*) FILTER (WHERE ar.absent_days = 0 AND ar.unpaid_leave = 0) AS months_perfect_attendance
FROM employees e
LEFT JOIN attendance_records ar ON e.employee_id = ar.employee_id
LEFT JOIN departments d ON e.department_id = d.id
GROUP BY e.employee_id, e.first_name, e.last_name, d.name
ORDER BY e.employee_id;

-- View: LOP employees (current month)
CREATE OR REPLACE VIEW v_lop_employees_current_month AS
SELECT 
    ar.employee_id,
    ar.employee_name,
    e.department_id,
    d.name AS department,
    ar.month,
    ar.year,
    ar.loss_of_pay_days,
    ar.unpaid_leave,
    ar.absent_days,
    e.basic AS monthly_basic,
    ROUND((e.basic / ar.total_working_days) * ar.loss_of_pay_days, 2) AS lop_deduction_amount
FROM attendance_records ar
JOIN employees e ON ar.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.id
WHERE ar.loss_of_pay_days > 0
  AND ar.month = TO_CHAR(CURRENT_DATE, 'Month')
  AND ar.year = TO_CHAR(CURRENT_DATE, 'YYYY')
ORDER BY ar.loss_of_pay_days DESC;

-- View: Unapproved attendance records
CREATE OR REPLACE VIEW v_unapproved_attendance AS
SELECT 
    ar.*,
    e.department_id,
    d.name AS department,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - ar.created_at) AS days_pending
FROM attendance_records ar
JOIN employees e ON ar.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.id
WHERE ar.is_approved = false
ORDER BY ar.created_at ASC;

COMMENT ON TABLE attendance_records IS 'Monthly attendance summary for employees with approval workflow';
COMMENT ON COLUMN attendance_records.id IS 'Format: ATT{timestamp}';
COMMENT ON COLUMN attendance_records.payable_days IS 'Auto-calculated: present_days + paid_leave + (half_days/2)';
COMMENT ON COLUMN attendance_records.loss_of_pay_days IS 'Auto-calculated: unpaid_leave + absent_days - (half_days/2)';
COMMENT ON COLUMN attendance_records.attendance_percentage IS 'Auto-calculated: (present + paid_leave) / total_working_days * 100';
```

---

## 5. Payroll Management

### Table: `pay_runs`

```sql
CREATE TABLE pay_runs (
    id VARCHAR(50) PRIMARY KEY,
    month VARCHAR(20) NOT NULL,
    year VARCHAR(4) NOT NULL,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    payment_date DATE NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'processed', 'cancelled')),
    total_employees INT NOT NULL DEFAULT 0,
    total_gross DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_net_pay DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_employer_contribution DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_lop_deduction DECIMAL(15,2) NOT NULL DEFAULT 0,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP NULL,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMP NULL,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_month_year UNIQUE (month, year)
);

CREATE INDEX idx_pay_runs_month_year ON pay_runs(month, year);
CREATE INDEX idx_pay_runs_status ON pay_runs(status);
CREATE INDEX idx_pay_runs_date ON pay_runs(generated_at DESC);
CREATE INDEX idx_pay_runs_payment_date ON pay_runs(payment_date);

-- Trigger: Generate pay run ID
CREATE OR REPLACE FUNCTION generate_pay_run_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.id := 'PR' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT::TEXT;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_pay_run_id
BEFORE INSERT ON pay_runs
FOR EACH ROW
WHEN (NEW.id IS NULL)
EXECUTE FUNCTION generate_pay_run_id();

-- Trigger: Validate status transitions
CREATE OR REPLACE FUNCTION validate_pay_run_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Can only move forward in status workflow
    IF OLD.status = 'processed' AND NEW.status != 'processed' THEN
        RAISE EXCEPTION 'Cannot change status from processed to %', NEW.status;
    END IF;
    
    IF OLD.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot change status of cancelled pay run';
    END IF;
    
    -- Approval tracking
    IF NEW.status = 'approved' AND OLD.status = 'draft' THEN
        IF NEW.approved_by IS NULL THEN
            RAISE EXCEPTION 'Approver must be specified when approving pay run';
        END IF;
        NEW.approved_at := CURRENT_TIMESTAMP;
    END IF;
    
    -- Processing tracking
    IF NEW.status = 'processed' AND OLD.status = 'approved' THEN
        IF NEW.processed_by IS NULL THEN
            RAISE EXCEPTION 'Processor must be specified when processing pay run';
        END IF;
        NEW.processed_at := CURRENT_TIMESTAMP;
    END IF;
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_pay_run_status_transition
BEFORE UPDATE ON pay_runs
FOR EACH ROW
EXECUTE FUNCTION validate_pay_run_status_transition();

-- Procedure: Generate pay run
CREATE OR REPLACE PROCEDURE generate_pay_run(
    p_month VARCHAR(20),
    p_year VARCHAR(4),
    p_generated_by UUID,
    OUT p_pay_run_id VARCHAR(50),
    OUT p_employee_count INT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_pay_period_start DATE;
    v_pay_period_end DATE;
    v_employee RECORD;
    v_attendance RECORD;
    v_total_gross DECIMAL(15,2) := 0;
    v_total_deductions DECIMAL(15,2) := 0;
    v_total_net DECIMAL(15,2) := 0;
    v_lop_amount DECIMAL(12,2);
BEGIN
    -- Calculate pay period dates
    v_pay_period_start := (p_year || '-' || 
        CASE p_month
            WHEN 'January' THEN '01'
            WHEN 'February' THEN '02'
            WHEN 'March' THEN '03'
            WHEN 'April' THEN '04'
            WHEN 'May' THEN '05'
            WHEN 'June' THEN '06'
            WHEN 'July' THEN '07'
            WHEN 'August' THEN '08'
            WHEN 'September' THEN '09'
            WHEN 'October' THEN '10'
            WHEN 'November' THEN '11'
            WHEN 'December' THEN '12'
        END || '-01')::DATE;
    v_pay_period_end := (v_pay_period_start + INTERVAL '1 month - 1 day')::DATE;
    
    -- Create pay run
    INSERT INTO pay_runs (month, year, pay_period_start, pay_period_end, generated_by_user_id)
    VALUES (p_month, p_year, v_pay_period_start, v_pay_period_end, p_generated_by)
    RETURNING id INTO p_pay_run_id;
    
    p_employee_count := 0;
    
    -- Process each active employee
    FOR v_employee IN 
        SELECT * FROM employees 
        WHERE status = 'active' 
        AND (exit_date IS NULL OR exit_date > v_pay_period_end)
    LOOP
        -- Get attendance record
        SELECT * INTO v_attendance
        FROM attendance_records
        WHERE employee_id = v_employee.employee_id
          AND month = p_month
          AND year = p_year;
        
        IF NOT FOUND THEN
            RAISE NOTICE 'No attendance record for employee %, skipping', v_employee.employee_id;
            CONTINUE;
        END IF;
        
        -- Calculate LOP deduction
        v_lop_amount := ROUND(
            (v_employee.gross / v_attendance.total_working_days) * v_attendance.loss_of_pay_days,
            2
        );
        
        -- Get advance and loan deductions
        DECLARE
            v_advance_deduction DECIMAL(12,2) := 0;
            v_loan_deduction DECIMAL(12,2) := 0;
        BEGIN
            SELECT COALESCE(SUM(advance_paid_amount), 0) INTO v_advance_deduction
            FROM advance_records
            WHERE employee_id = v_employee.employee_id
              AND advance_deduction_month = p_month
              AND advance_deduction_year = p_year
              AND status != 'deducted';
            
            SELECT COALESCE(SUM(emi_amount), 0) INTO v_loan_deduction
            FROM loan_records
            WHERE employee_id = v_employee.employee_id
              AND status = 'active';
        END;
        
        -- Insert pay run employee record
        INSERT INTO pay_run_employee_records (
            pay_run_id, employee_id, employee_name,
            basic_salary, hra, conveyance, telephone, medical_allowance, special_allowance,
            total_allowances, gross_salary,
            total_working_days, payable_days, loss_of_pay_days, loss_of_pay_amount,
            advance_deduction, loan_deduction,
            pf_deduction, esi_deduction, professional_tax, tds,
            total_deductions, net_pay
        )
        VALUES (
            p_pay_run_id, v_employee.employee_id, v_employee.first_name || ' ' || v_employee.last_name,
            v_employee.basic, v_employee.hra, v_employee.conveyance, 
            v_employee.telephone, v_employee.medical_allowance, v_employee.special_allowance,
            v_employee.hra + v_employee.conveyance + v_employee.telephone + 
                v_employee.medical_allowance + v_employee.special_allowance,
            v_employee.gross - v_lop_amount,
            v_attendance.total_working_days, v_attendance.payable_days, 
            v_attendance.loss_of_pay_days, v_lop_amount,
            v_advance_deduction, v_loan_deduction,
            v_employee.pf_deduction, v_employee.esi_deduction, 
            v_employee.professional_tax, v_employee.tds_monthly,
            v_employee.pf_deduction + v_employee.esi_deduction + 
                v_employee.professional_tax + v_employee.tds_monthly + 
                v_advance_deduction + v_loan_deduction,
            (v_employee.gross - v_lop_amount) - 
                (v_employee.pf_deduction + v_employee.esi_deduction + 
                 v_employee.professional_tax + v_employee.tds_monthly + 
                 v_advance_deduction + v_loan_deduction)
        );
        
        v_total_gross := v_total_gross + (v_employee.gross - v_lop_amount);
        v_total_deductions := v_total_deductions + (v_employee.pf_deduction + v_employee.esi_deduction + 
            v_employee.professional_tax + v_employee.tds_monthly + v_advance_deduction + v_loan_deduction);
        v_total_net := v_total_net + ((v_employee.gross - v_lop_amount) - 
            (v_employee.pf_deduction + v_employee.esi_deduction + 
             v_employee.professional_tax + v_employee.tds_monthly + 
             v_advance_deduction + v_loan_deduction));
        
        p_employee_count := p_employee_count + 1;
    END LOOP;
    
    -- Update pay run totals
    UPDATE pay_runs
    SET total_employees = p_employee_count,
        total_gross = v_total_gross,
        total_deductions = v_total_deductions,
        total_net_pay = v_total_net
    WHERE id = p_pay_run_id;
    
    RAISE NOTICE 'Pay run % generated for % employees', p_pay_run_id, p_employee_count;
END;
$$;

-- Procedure: Approve pay run
CREATE OR REPLACE PROCEDURE approve_pay_run(
    p_pay_run_id VARCHAR(50),
    p_approved_by UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT status INTO v_status FROM pay_runs WHERE id = p_pay_run_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pay run % not found', p_pay_run_id;
    END IF;
    
    IF v_status != 'draft' THEN
        RAISE EXCEPTION 'Can only approve pay runs in draft status, current status: %', v_status;
    END IF;
    
    UPDATE pay_runs
    SET status = 'approved',
        approved_by = p_approved_by,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_pay_run_id;
    
    RAISE NOTICE 'Pay run % approved', p_pay_run_id;
END;
$$;

-- Procedure: Process pay run (generate payslips)
CREATE OR REPLACE PROCEDURE process_pay_run(
    p_pay_run_id VARCHAR(50),
    p_processed_by UUID,
    p_payment_date DATE,
    OUT p_payslips_generated INT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_pay_run RECORD;
    v_employee_record RECORD;
BEGIN
    -- Get pay run details
    SELECT * INTO v_pay_run FROM pay_runs WHERE id = p_pay_run_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pay run % not found', p_pay_run_id;
    END IF;
    
    IF v_pay_run.status != 'approved' THEN
        RAISE EXCEPTION 'Can only process approved pay runs, current status: %', v_pay_run.status;
    END IF;
    
    p_payslips_generated := 0;
    
    -- Generate payslip for each employee record
    FOR v_employee_record IN 
        SELECT * FROM pay_run_employee_records WHERE pay_run_id = p_pay_run_id
    LOOP
        -- Get employee and attendance details
        DECLARE
            v_employee RECORD;
            v_attendance RECORD;
        BEGIN
            SELECT * INTO v_employee FROM employees WHERE employee_id = v_employee_record.employee_id;
            SELECT * INTO v_attendance FROM attendance_records 
            WHERE employee_id = v_employee_record.employee_id
              AND month = v_pay_run.month
              AND year = v_pay_run.year;
            
            INSERT INTO payslips (
                employee_id, pay_run_employee_record_id,
                salary_month, salary_year, salary_date,
                period_start_date, period_end_date,
                department, designation, grade, date_of_joining,
                total_working_days, present_days, leaves, absents,
                paid_leaves, unpaid_leaves, overtime_hours,
                basic_salary, hra, conveyance, medical, special_allowance,
                gross_salary,
                lop_deduction,
                pf, esi, professional_tax, tds,
                advance_deduction, loan_deduction,
                total_deductions, net_pay
            )
            VALUES (
                v_employee_record.employee_id, v_employee_record.id,
                v_pay_run.month, v_pay_run.year, p_payment_date,
                v_pay_run.pay_period_start, v_pay_run.pay_period_end,
                (SELECT name FROM departments WHERE id = v_employee.department_id),
                (SELECT title FROM designations WHERE id = v_employee.designation_id),
                v_employee.grade, v_employee.join_date,
                v_attendance.total_working_days, v_attendance.present_days,
                v_attendance.paid_leave + v_attendance.unpaid_leave,
                v_attendance.absent_days,
                v_attendance.paid_leave, v_attendance.unpaid_leave,
                v_attendance.overtime_hours,
                v_employee_record.basic_salary, v_employee_record.hra,
                v_employee_record.conveyance, v_employee_record.medical_allowance,
                v_employee_record.special_allowance,
                v_employee_record.gross_salary,
                v_employee_record.loss_of_pay_amount,
                v_employee_record.pf_deduction, v_employee_record.esi_deduction,
                v_employee_record.professional_tax, v_employee_record.tds,
                v_employee_record.advance_deduction, v_employee_record.loan_deduction,
                v_employee_record.total_deductions, v_employee_record.net_pay
            );
            
            p_payslips_generated := p_payslips_generated + 1;
        END;
    END LOOP;
    
    -- Update pay run status
    UPDATE pay_runs
    SET status = 'processed',
        processed_by = p_processed_by,
        processed_at = CURRENT_TIMESTAMP,
        payment_date = p_payment_date,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_pay_run_id;
    
    RAISE NOTICE 'Pay run % processed, % payslips generated', p_pay_run_id, p_payslips_generated;
END;
$$;

-- View: Pay run summary
CREATE OR REPLACE VIEW v_pay_run_summary AS
SELECT 
    pr.id,
    pr.month,
    pr.year,
    pr.status,
    pr.total_employees,
    pr.total_gross,
    pr.total_deductions,
    pr.total_net_pay,
    pr.total_lop_deduction,
    pr.payment_date,
    gu.full_name AS generated_by_name,
    pr.generated_at,
    au.full_name AS approved_by_name,
    pr.approved_at,
    pu.full_name AS processed_by_name,
    pr.processed_at,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - pr.generated_at) AS days_since_generation
FROM pay_runs pr
LEFT JOIN users gu ON pr.generated_by_user_id = gu.id
LEFT JOIN users au ON pr.approved_by = au.id
LEFT JOIN users pu ON pr.processed_by = pu.id
ORDER BY pr.generated_at DESC;

COMMENT ON TABLE pay_runs IS 'Monthly payroll execution records with approval workflow';
COMMENT ON COLUMN pay_runs.id IS 'Format: PR{timestamp}';
COMMENT ON COLUMN pay_runs.status IS 'draft→approved→processed or cancelled';
```

---

### Table: `pay_run_employee_records`

```sql
CREATE TABLE pay_run_employee_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pay_run_id VARCHAR(50) NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    employee_name VARCHAR(255) NOT NULL,
    
    -- Earnings
    basic_salary DECIMAL(12,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    conveyance DECIMAL(12,2) NOT NULL,
    telephone DECIMAL(12,2) NOT NULL,
    medical_allowance DECIMAL(12,2) NOT NULL,
    special_allowance DECIMAL(12,2) NOT NULL,
    total_allowances DECIMAL(12,2) NOT NULL,
    gross_salary DECIMAL(12,2) NOT NULL,
    
    -- Attendance
    total_working_days INT NOT NULL,
    payable_days DECIMAL(5,2) NOT NULL,
    loss_of_pay_days DECIMAL(5,2) NOT NULL,
    loss_of_pay_amount DECIMAL(12,2) NOT NULL,
    
    -- Deductions
    advance_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    loan_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    pf_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    esi_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    professional_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    tds DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(12,2) NOT NULL,
    
    -- Net Pay
    net_pay DECIMAL(12,2) NOT NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_pay_run_employee UNIQUE (pay_run_id, employee_id),
    CONSTRAINT chk_net_pay_calculation CHECK (ABS(net_pay - (gross_salary - total_deductions)) < 0.01)
);

CREATE INDEX idx_pay_run_records_pay_run ON pay_run_employee_records(pay_run_id);
CREATE INDEX idx_pay_run_records_employee ON pay_run_employee_records(employee_id);
CREATE INDEX idx_pay_run_records_lop ON pay_run_employee_records(loss_of_pay_days) WHERE loss_of_pay_days > 0;

-- View: Pay run employee details with comparisons
CREATE OR REPLACE VIEW v_pay_run_employee_details AS
SELECT 
    pre.pay_run_id,
    pr.month,
    pr.year,
    pr.status AS pay_run_status,
    pre.employee_id,
    pre.employee_name,
    e.department_id,
    d.name AS department,
    des.title AS designation,
    pre.gross_salary,
    pre.loss_of_pay_amount,
    pre.total_deductions,
    pre.net_pay,
    e.basic AS current_basic,
    e.gross AS current_gross,
    pre.gross_salary - e.gross AS gross_difference,
    pre.payable_days,
    pre.loss_of_pay_days
FROM pay_run_employee_records pre
JOIN pay_runs pr ON pre.pay_run_id = pr.id
JOIN employees e ON pre.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.id
JOIN designations des ON e.designation_id = des.id;

COMMENT ON TABLE pay_run_employee_records IS 'Individual employee payroll details within a pay run';
COMMENT ON COLUMN pay_run_employee_records.gross_salary IS 'After LOP adjustment';
COMMENT ON COLUMN pay_run_employee_records.loss_of_pay_amount IS 'Salary deduction for unpaid absences';
```

---

### Table: `payslips`

```sql
CREATE TABLE payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    pay_run_employee_record_id UUID REFERENCES pay_run_employee_records(id) ON DELETE SET NULL,
    
    -- Period Information
    salary_month VARCHAR(20) NOT NULL,
    salary_year VARCHAR(4) NOT NULL,
    salary_date DATE NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    
    -- Employee Info (Denormalized for historical accuracy)
    employee_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(255) NOT NULL,
    grade VARCHAR(10),
    date_of_joining DATE,
    bank_account_number VARCHAR(50),
    
    -- Attendance
    total_working_days INT NOT NULL,
    present_days INT NOT NULL,
    leaves INT NOT NULL,
    absents INT NOT NULL,
    paid_leaves INT NOT NULL,
    unpaid_leaves INT NOT NULL,
    week_offs INT NOT NULL DEFAULT 0,
    holidays INT NOT NULL DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    
    -- Earnings
    basic_salary DECIMAL(12,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    conveyance DECIMAL(12,2) NOT NULL,
    medical DECIMAL(12,2) NOT NULL,
    special_allowance DECIMAL(12,2) NOT NULL,
    telephone DECIMAL(12,2) DEFAULT 0,
    overtime_amount DECIMAL(12,2) DEFAULT 0,
    incentives DECIMAL(12,2) DEFAULT 0,
    bonus DECIMAL(12,2) DEFAULT 0,
    arrears DECIMAL(12,2) DEFAULT 0,
    other_earnings DECIMAL(12,2) DEFAULT 0,
    gross_salary DECIMAL(12,2) NOT NULL,
    
    -- Deductions
    lop_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    pf DECIMAL(12,2) NOT NULL DEFAULT 0,
    esi DECIMAL(12,2) NOT NULL DEFAULT 0,
    professional_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    tds DECIMAL(12,2) NOT NULL DEFAULT 0,
    advance_paid DECIMAL(12,2) DEFAULT 0,
    advance_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    loan_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_deduction DECIMAL(12,2) DEFAULT 0,
    total_deductions DECIMAL(12,2) NOT NULL,
    
    -- Employer Contributions (for information)
    employer_pf DECIMAL(12,2) DEFAULT 0,
    employer_esi DECIMAL(12,2) DEFAULT 0,
    
    -- Net Pay
    net_pay DECIMAL(12,2) NOT NULL,
    net_pay_words VARCHAR(500),
    
    -- Delivery Status
    is_sent BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP NULL,
    sent_to_email VARCHAR(255) NULL,
    download_count INT NOT NULL DEFAULT 0,
    last_downloaded_at TIMESTAMP NULL,
    
    -- PDF Generation
    pdf_generated BOOLEAN NOT NULL DEFAULT false,
    pdf_data TEXT NULL,
    pdf_generated_at TIMESTAMP NULL,
    
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_employee_salary_month_year UNIQUE (employee_id, salary_month, salary_year),
    CONSTRAINT chk_payslip_net_calculation CHECK (ABS(net_pay - (gross_salary - total_deductions)) < 0.01)
);

CREATE INDEX idx_payslips_employee ON payslips(employee_id);
CREATE INDEX idx_payslips_month_year ON payslips(salary_month, salary_year);
CREATE INDEX idx_payslips_date ON payslips(salary_date DESC);
CREATE INDEX idx_payslips_number ON payslips(payslip_number);
CREATE INDEX idx_payslips_unsent ON payslips(is_sent, created_at) WHERE is_sent = false;
CREATE INDEX idx_payslips_pay_run_record ON payslips(pay_run_employee_record_id);

-- Trigger: Generate payslip number
CREATE OR REPLACE FUNCTION generate_payslip_number()
RETURNS TRIGGER AS $$
DECLARE
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(payslip_number FROM '[0-9]+$') AS INT)), 0) + 1
    INTO v_seq
    FROM payslips
    WHERE payslip_number ~ ('^PS/' || NEW.salary_year || '/' || NEW.salary_month);
    
    NEW.payslip_number := 'PS/' || NEW.salary_year || '/' || NEW.salary_month || '/' || LPAD(v_seq::TEXT, 6, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_payslip_number
BEFORE INSERT ON payslips
FOR EACH ROW
WHEN (NEW.payslip_number IS NULL)
EXECUTE FUNCTION generate_payslip_number();

-- Trigger: Convert net pay to words
CREATE OR REPLACE FUNCTION convert_amount_to_words(amount DECIMAL)
RETURNS VARCHAR AS $$
DECLARE
    ones TEXT[] := ARRAY['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    teens TEXT[] := ARRAY['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    tens TEXT[] := ARRAY['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    v_rupees INT := FLOOR(amount);
    v_paise INT := ROUND((amount - v_rupees) * 100);
    v_words TEXT := '';
    v_lakhs INT;
    v_thousands INT;
    v_hundreds INT;
    v_remainder INT;
BEGIN
    IF v_rupees = 0 THEN
        RETURN 'Zero Rupees Only';
    END IF;
    
    -- Simplified conversion (full implementation would be more comprehensive)
    v_words := 'Rupees ' || v_rupees::TEXT;
    
    IF v_paise > 0 THEN
        v_words := v_words || ' and ' || v_paise::TEXT || ' Paise';
    END IF;
    
    v_words := v_words || ' Only';
    
    RETURN v_words;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_net_pay_words()
RETURNS TRIGGER AS $$
BEGIN
    NEW.net_pay_words := convert_amount_to_words(NEW.net_pay);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_net_pay_words
BEFORE INSERT OR UPDATE OF net_pay ON payslips
FOR EACH ROW
EXECUTE FUNCTION set_net_pay_words();

-- Procedure: Generate PDF for payslip
CREATE OR REPLACE PROCEDURE generate_payslip_pdf(
    p_payslip_id UUID,
    OUT p_pdf_generated BOOLEAN
)
LANGUAGE plpgsql AS $$
DECLARE
    v_payslip RECORD;
    v_pdf_content TEXT;
BEGIN
    SELECT * INTO v_payslip FROM payslips WHERE id = p_payslip_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payslip % not found', p_payslip_id;
    END IF;
    
    -- Generate PDF content (simplified - actual implementation would use proper PDF library)
    v_pdf_content := 'Payslip for ' || v_payslip.employee_name || ' - ' || 
                     v_payslip.salary_month || ' ' || v_payslip.salary_year;
    
    UPDATE payslips
    SET pdf_data = v_pdf_content,
        pdf_generated = true,
        pdf_generated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_payslip_id;
    
    p_pdf_generated := true;
    RAISE NOTICE 'PDF generated for payslip %', v_payslip.payslip_number;
END;
$$;

-- Procedure: Send payslip via email
CREATE OR REPLACE PROCEDURE send_payslip_email(
    p_payslip_id UUID,
    p_recipient_email VARCHAR(255)
)
LANGUAGE plpgsql AS $$
DECLARE
    v_payslip RECORD;
BEGIN
    SELECT * INTO v_payslip FROM payslips WHERE id = p_payslip_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payslip % not found', p_payslip_id;
    END IF;
    
    IF NOT v_payslip.pdf_generated THEN
        RAISE EXCEPTION 'PDF not generated for payslip %. Generate PDF first.', v_payslip.payslip_number;
    END IF;
    
    -- Send email logic would go here
    RAISE NOTICE 'Sending payslip % to %', v_payslip.payslip_number, p_recipient_email;
    
    -- Mark as sent
    UPDATE payslips
    SET is_sent = true,
        sent_at = CURRENT_TIMESTAMP,
        sent_to_email = p_recipient_email,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_payslip_id;
END;
$$;

-- Procedure: Bulk send payslips for month
CREATE OR REPLACE PROCEDURE bulk_send_payslips_for_month(
    p_month VARCHAR(20),
    p_year VARCHAR(4),
    OUT p_sent_count INT,
    OUT p_failed_count INT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_payslip RECORD;
    v_employee_email VARCHAR(255);
BEGIN
    p_sent_count := 0;
    p_failed_count := 0;
    
    FOR v_payslip IN 
        SELECT * FROM payslips 
        WHERE salary_month = p_month 
          AND salary_year = p_year
          AND is_sent = false
          AND pdf_generated = true
    LOOP
        BEGIN
            -- Get employee email
            SELECT official_email INTO v_employee_email
            FROM employees WHERE employee_id = v_payslip.employee_id;
            
            IF v_employee_email IS NULL THEN
                RAISE EXCEPTION 'No email found for employee %', v_payslip.employee_id;
            END IF;
            
            -- Send email
            CALL send_payslip_email(v_payslip.id, v_employee_email);
            
            p_sent_count := p_sent_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            p_failed_count := p_failed_count + 1;
            RAISE NOTICE 'Failed to send payslip % for %: %', 
                v_payslip.payslip_number, v_payslip.employee_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Sent % payslips, % failed for %/%', p_sent_count, p_failed_count, p_month, p_year;
END;
$$;

-- View: Payslip summary
CREATE OR REPLACE VIEW v_payslip_summary AS
SELECT 
    p.payslip_number,
    p.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    p.department,
    p.designation,
    p.salary_month,
    p.salary_year,
    p.salary_date,
    p.gross_salary,
    p.total_deductions,
    p.net_pay,
    p.is_sent,
    p.sent_at,
    p.download_count,
    p.pdf_generated,
    p.created_at
FROM payslips p
JOIN employees e ON p.employee_id = e.employee_id
ORDER BY p.created_at DESC;

-- View: Pending payslips (not sent)
CREATE OR REPLACE VIEW v_pending_payslips AS
SELECT 
    p.id,
    p.payslip_number,
    p.employee_id,
    p.employee_name,
    e.official_email,
    p.department,
    p.salary_month,
    p.salary_year,
    p.net_pay,
    p.pdf_generated,
    p.created_at,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - p.created_at) AS days_pending
FROM payslips p
JOIN employees e ON p.employee_id = e.employee_id
WHERE p.is_sent = false
ORDER BY p.created_at ASC;

-- View: Monthly payslip statistics
CREATE OR REPLACE VIEW v_monthly_payslip_statistics AS
SELECT 
    p.salary_month,
    p.salary_year,
    COUNT(*) AS total_payslips,
    SUM(p.gross_salary) AS total_gross,
    SUM(p.total_deductions) AS total_deductions,
    SUM(p.net_pay) AS total_net_pay,
    AVG(p.net_pay) AS avg_net_pay,
    COUNT(*) FILTER (WHERE p.is_sent = true) AS sent_count,
    COUNT(*) FILTER (WHERE p.is_sent = false) AS unsent_count,
    COUNT(*) FILTER (WHERE p.pdf_generated = true) AS pdf_generated_count
FROM payslips p
GROUP BY p.salary_month, p.salary_year
ORDER BY p.salary_year DESC, p.salary_month;

COMMENT ON TABLE payslips IS 'Detailed payslip records for employees with PDF generation and email delivery';
COMMENT ON COLUMN payslips.payslip_number IS 'Format: PS/YYYY/Month/NNNNNN';
COMMENT ON COLUMN payslips.lop_deduction IS 'Loss of Pay deduction for unpaid absences';
COMMENT ON COLUMN payslips.net_pay_words IS 'Net pay amount in words for printing';
```

---

## 6. Advance and Loan Management

### Table: `advance_records`

```sql
CREATE TABLE advance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advance_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    
    -- Advance Details
    advance_month VARCHAR(20) NOT NULL,
    advance_year VARCHAR(4) NOT NULL,
    advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    advance_paid_amount DECIMAL(12,2) NOT NULL CHECK (advance_paid_amount > 0),
    reason TEXT,
    
    -- Recovery Details
    advance_deduction_month VARCHAR(20) NOT NULL,
    advance_deduction_year VARCHAR(4) NOT NULL,
    installments INT NOT NULL DEFAULT 1 CHECK (installments > 0),
    installment_amount DECIMAL(12,2) NOT NULL CHECK (installment_amount > 0),
    
    -- Status Tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'deducted', 'cancelled')),
    amount_deducted DECIMAL(12,2) NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(12,2) NOT NULL,
    deductions_made INT NOT NULL DEFAULT 0,
    
    -- Approval
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP NULL,
    
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_advance_remaining_amount CHECK (remaining_amount >= 0 AND remaining_amount <= advance_paid_amount),
    CONSTRAINT chk_advance_deductions CHECK (amount_deducted + remaining_amount = advance_paid_amount)
);

CREATE INDEX idx_advance_records_employee ON advance_records(employee_id);
CREATE INDEX idx_advance_records_status ON advance_records(status);
CREATE INDEX idx_advance_records_deduction_month ON advance_records(advance_deduction_month, advance_deduction_year);
CREATE INDEX idx_advance_records_created ON advance_records(created_at DESC);
CREATE INDEX idx_advance_records_number ON advance_records(advance_number);
CREATE INDEX idx_advance_records_pending ON advance_records(status, advance_deduction_month, advance_deduction_year) 
    WHERE status IN ('pending', 'partial');

-- Trigger: Generate advance number
CREATE OR REPLACE FUNCTION generate_advance_number()
RETURNS TRIGGER AS $$
DECLARE
    v_seq INT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(advance_number FROM '[0-9]+$') AS INT)), 0) + 1
    INTO v_seq
    FROM advance_records
    WHERE advance_number ~ ('^ADV/' || NEW.advance_year);
    
    NEW.advance_number := 'ADV/' || NEW.advance_year || '/' || LPAD(v_seq::TEXT, 6, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_advance_number
BEFORE INSERT ON advance_records
FOR EACH ROW
WHEN (NEW.advance_number IS NULL)
EXECUTE FUNCTION generate_advance_number();

-- Trigger: Calculate installment amount
CREATE OR REPLACE FUNCTION calculate_advance_installment()
RETURNS TRIGGER AS $$
BEGIN
    NEW.installment_amount := ROUND(NEW.advance_paid_amount / NEW.installments, 2);
    NEW.remaining_amount := NEW.advance_paid_amount;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_advance_installment
BEFORE INSERT ON advance_records
FOR EACH ROW
EXECUTE FUNCTION calculate_advance_installment();

-- Trigger: Update timestamps
CREATE OR REPLACE FUNCTION update_advance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_advance_timestamp
BEFORE UPDATE ON advance_records
FOR EACH ROW
EXECUTE FUNCTION update_advance_timestamp();

-- Procedure: Process advance deduction
CREATE OR REPLACE PROCEDURE process_advance_deduction(
    p_advance_id UUID,
    p_deduction_amount DECIMAL(12,2)
)
LANGUAGE plpgsql AS $$
DECLARE
    v_advance RECORD;
    v_new_remaining DECIMAL(12,2);
    v_new_status VARCHAR(20);
BEGIN
    SELECT * INTO v_advance FROM advance_records WHERE id = p_advance_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Advance record % not found', p_advance_id;
    END IF;
    
    IF v_advance.status = 'deducted' THEN
        RAISE EXCEPTION 'Advance % already fully deducted', v_advance.advance_number;
    END IF;
    
    IF v_advance.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot deduct from cancelled advance %', v_advance.advance_number;
    END IF;
    
    IF p_deduction_amount > v_advance.remaining_amount THEN
        RAISE EXCEPTION 'Deduction amount % exceeds remaining amount %', 
            p_deduction_amount, v_advance.remaining_amount;
    END IF;
    
    -- Calculate new values
    v_new_remaining := v_advance.remaining_amount - p_deduction_amount;
    
    IF v_new_remaining = 0 THEN
        v_new_status := 'deducted';
    ELSE
        v_new_status := 'partial';
    END IF;
    
    -- Update advance record
    UPDATE advance_records
    SET amount_deducted = amount_deducted + p_deduction_amount,
        remaining_amount = v_new_remaining,
        deductions_made = deductions_made + 1,
        status = v_new_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_advance_id;
    
    RAISE NOTICE 'Deducted % from advance %, remaining: %', 
        p_deduction_amount, v_advance.advance_number, v_new_remaining;
END;
$$;

-- Procedure: Get pending advances for employee for month
CREATE OR REPLACE FUNCTION get_pending_advances_for_month(
    p_employee_id VARCHAR(20),
    p_month VARCHAR(20),
    p_year VARCHAR(4)
)
RETURNS TABLE (
    advance_id UUID,
    advance_number VARCHAR(50),
    advance_paid_amount DECIMAL(12,2),
    installment_amount DECIMAL(12,2),
    remaining_amount DECIMAL(12,2),
    deductions_made INT,
    installments INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ar.id,
        ar.advance_number,
        ar.advance_paid_amount,
        ar.installment_amount,
        ar.remaining_amount,
        ar.deductions_made,
        ar.installments
    FROM advance_records ar
    WHERE ar.employee_id = p_employee_id
      AND ar.advance_deduction_month = p_month
      AND ar.advance_deduction_year = p_year
      AND ar.status IN ('pending', 'partial')
    ORDER BY ar.advance_date;
END;
$$ LANGUAGE plpgsql;

-- View: Advance summary by employee
CREATE OR REPLACE VIEW v_employee_advance_summary AS
SELECT 
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    d.name AS department,
    COUNT(*) AS total_advances,
    SUM(ar.advance_paid_amount) AS total_advance_amount,
    SUM(ar.amount_deducted) AS total_deducted,
    SUM(ar.remaining_amount) AS total_remaining,
    COUNT(*) FILTER (WHERE ar.status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE ar.status = 'partial') AS partial_count,
    COUNT(*) FILTER (WHERE ar.status = 'deducted') AS completed_count
FROM employees e
LEFT JOIN advance_records ar ON e.employee_id = ar.employee_id
LEFT JOIN departments d ON e.department_id = d.id
GROUP BY e.employee_id, e.first_name, e.last_name, d.name
HAVING COUNT(*) > 0
ORDER BY total_remaining DESC;

-- View: Pending advances for current month
CREATE OR REPLACE VIEW v_pending_advances_current_month AS
SELECT 
    ar.id,
    ar.advance_number,
    ar.employee_id,
    ar.employee_name,
    e.department_id,
    d.name AS department,
    ar.advance_paid_amount,
    ar.installment_amount,
    ar.remaining_amount,
    ar.deductions_made,
    ar.installments,
    ar.advance_deduction_month,
    ar.advance_deduction_year,
    ar.status
FROM advance_records ar
JOIN employees e ON ar.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.id
WHERE ar.status IN ('pending', 'partial')
  AND ar.advance_deduction_month = TO_CHAR(CURRENT_DATE, 'Month')
  AND ar.advance_deduction_year = TO_CHAR(CURRENT_DATE, 'YYYY')
ORDER BY ar.employee_name;

COMMENT ON TABLE advance_records IS 'Employee salary advances with installment-based recovery';
COMMENT ON COLUMN advance_records.advance_number IS 'Format: ADV/YYYY/NNNNNN';
COMMENT ON COLUMN advance_records.remaining_amount IS 'Tracks remaining balance for installment deductions';
COMMENT ON COLUMN advance_records.installments IS 'Number of monthly installments for recovery';
```

---

### Table: `loan_records`

```sql
CREATE TABLE loan_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    
    -- Loan Details
    loan_type VARCHAR(50) NOT NULL DEFAULT 'personal' CHECK (loan_type IN ('personal', 'emergency', 'education', 'housing', 'vehicle', 'medical')),
    loan_amount DECIMAL(12,2) NOT NULL CHECK (loan_amount > 0),
    interest_rate DECIMAL(5,2) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 100),
    interest_amount DECIMAL(12,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    processing_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- EMI Schedule
    number_of_emis INT NOT NULL CHECK (number_of_emis > 0 AND number_of_emis <= 120),
    emi_amount DECIMAL(12,2) NOT NULL CHECK (emi_amount > 0),
    start_month VARCHAR(20) NOT NULL,
    start_year VARCHAR(4) NOT NULL,
    start_date DATE NOT NULL,
    
    -- Payment Status
    total_paid_emis INT NOT NULL DEFAULT 0 CHECK (total_paid_emis >= 0),
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
    remaining_emis INT NOT NULL,
    remaining_balance DECIMAL(12,2) NOT NULL,
    last_emi_month VARCHAR(20) NULL,
    last_emi_year VARCHAR(4) NULL,
    last_emi_date DATE NULL,
    
    -- Loan Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'cancelled', 'defaulted')),
    
    -- Approval
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP NULL,
    disbursed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    
    -- Guarantor
    guarantor_employee_id VARCHAR(20) REFERENCES employees(id) ON DELETE SET NULL,
    guarantor_name VARCHAR(255),
    
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_loan_total_amount CHECK (ABS(total_amount - (loan_amount + interest_amount)) < 0.01),
    CONSTRAINT chk_loan_remaining CHECK (remaining_balance >= 0 AND remaining_balance <= total_amount),
    CONSTRAINT chk_loan_emis CHECK (total_paid_emis <= number_of_emis),
    CONSTRAINT chk_loan_remaining_emis CHECK (remaining_emis = number_of_emis - total_paid_emis)
);

CREATE INDEX idx_loan_records_employee ON loan_records(employee_id);
CREATE INDEX idx_loan_records_status ON loan_records(status);
CREATE INDEX idx_loan_records_created ON loan_records(created_at DESC);
CREATE INDEX idx_loan_records_number ON loan_records(loan_number);
CREATE INDEX idx_loan_records_active ON loan_records(status, remaining_balance) WHERE status = 'active';
CREATE INDEX idx_loan_records_type ON loan_records(loan_type, status);

-- Trigger: Generate loan number
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TRIGGER AS $$
DECLARE
    v_seq INT;
    v_prefix VARCHAR(10);
BEGIN
    v_prefix := CASE NEW.loan_type
        WHEN 'personal' THEN 'LNP'
        WHEN 'emergency' THEN 'LNE'
        WHEN 'education' THEN 'LNED'
        WHEN 'housing' THEN 'LNH'
        WHEN 'vehicle' THEN 'LNV'
        WHEN 'medical' THEN 'LNM'
        ELSE 'LN'
    END;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(loan_number FROM '[0-9]+$') AS INT)), 0) + 1
    INTO v_seq
    FROM loan_records
    WHERE loan_number ~ ('^' || v_prefix || '/' || NEW.start_year);
    
    NEW.loan_number := v_prefix || '/' || NEW.start_year || '/' || LPAD(v_seq::TEXT, 6, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_loan_number
BEFORE INSERT ON loan_records
FOR EACH ROW
WHEN (NEW.loan_number IS NULL)
EXECUTE FUNCTION generate_loan_number();

-- Trigger: Calculate loan details
CREATE OR REPLACE FUNCTION calculate_loan_details()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate interest amount
    NEW.interest_amount := ROUND((NEW.loan_amount * NEW.interest_rate / 100), 2);
    
    -- Calculate total amount
    NEW.total_amount := NEW.loan_amount + NEW.interest_amount;
    
    -- Calculate EMI amount (simple division)
    NEW.emi_amount := ROUND(NEW.total_amount / NEW.number_of_emis, 2);
    
    -- Set initial remaining values
    NEW.remaining_emis := NEW.number_of_emis;
    NEW.remaining_balance := NEW.total_amount;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_loan_details
BEFORE INSERT ON loan_records
FOR EACH ROW
EXECUTE FUNCTION calculate_loan_details();

-- Trigger: Update timestamps
CREATE OR REPLACE FUNCTION update_loan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_loan_timestamp
BEFORE UPDATE ON loan_records
FOR EACH ROW
EXECUTE FUNCTION update_loan_timestamp();

-- Procedure: Process EMI payment
CREATE OR REPLACE PROCEDURE process_loan_emi(
    p_loan_id UUID,
    p_emi_month VARCHAR(20),
    p_emi_year VARCHAR(4)
)
LANGUAGE plpgsql AS $$
DECLARE
    v_loan RECORD;
    v_new_remaining_balance DECIMAL(12,2);
    v_new_status VARCHAR(20);
BEGIN
    SELECT * INTO v_loan FROM loan_records WHERE id = p_loan_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan record % not found', p_loan_id;
    END IF;
    
    IF v_loan.status != 'active' THEN
        RAISE EXCEPTION 'Cannot process EMI for loan % with status %', v_loan.loan_number, v_loan.status;
    END IF;
    
    IF v_loan.remaining_emis <= 0 THEN
        RAISE EXCEPTION 'No remaining EMIs for loan %', v_loan.loan_number;
    END IF;
    
    -- Calculate new values
    v_new_remaining_balance := GREATEST(v_loan.remaining_balance - v_loan.emi_amount, 0);
    
    IF v_new_remaining_balance = 0 OR v_loan.total_paid_emis + 1 = v_loan.number_of_emis THEN
        v_new_status := 'completed';
    ELSE
        v_new_status := 'active';
    END IF;
    
    -- Update loan record
    UPDATE loan_records
    SET total_paid_emis = total_paid_emis + 1,
        amount_paid = amount_paid + v_loan.emi_amount,
        remaining_emis = remaining_emis - 1,
        remaining_balance = v_new_remaining_balance,
        last_emi_month = p_emi_month,
        last_emi_year = p_emi_year,
        last_emi_date = CURRENT_DATE,
        status = v_new_status,
        completed_at = CASE WHEN v_new_status = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_loan_id;
    
    RAISE NOTICE 'EMI processed for loan %, remaining EMIs: %, balance: %', 
        v_loan.loan_number, v_loan.remaining_emis - 1, v_new_remaining_balance;
END;
$$;

-- Procedure: Approve loan
CREATE OR REPLACE PROCEDURE approve_loan(
    p_loan_id UUID,
    p_approved_by UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT status INTO v_status FROM loan_records WHERE id = p_loan_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan % not found', p_loan_id;
    END IF;
    
    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'Can only approve pending loans, current status: %', v_status;
    END IF;
    
    UPDATE loan_records
    SET status = 'approved',
        approved_by = p_approved_by,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_loan_id;
    
    RAISE NOTICE 'Loan % approved', p_loan_id;
END;
$$;

-- Procedure: Disburse loan
CREATE OR REPLACE PROCEDURE disburse_loan(p_loan_id UUID)
LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT status INTO v_status FROM loan_records WHERE id = p_loan_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan % not found', p_loan_id;
    END IF;
    
    IF v_status != 'approved' THEN
        RAISE EXCEPTION 'Can only disburse approved loans, current status: %', v_status;
    END IF;
    
    UPDATE loan_records
    SET status = 'active',
        disbursed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_loan_id;
    
    RAISE NOTICE 'Loan % disbursed and activated', p_loan_id;
END;
$$;

-- Function: Get active loans for employee for month
CREATE OR REPLACE FUNCTION get_active_loans_for_month(
    p_employee_id VARCHAR(20),
    p_month VARCHAR(20),
    p_year VARCHAR(4)
)
RETURNS TABLE (
    loan_id UUID,
    loan_number VARCHAR(50),
    loan_type VARCHAR(50),
    emi_amount DECIMAL(12,2),
    total_paid_emis INT,
    remaining_emis INT,
    remaining_balance DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lr.id,
        lr.loan_number,
        lr.loan_type,
        lr.emi_amount,
        lr.total_paid_emis,
        lr.remaining_emis,
        lr.remaining_balance
    FROM loan_records lr
    WHERE lr.employee_id = p_employee_id
      AND lr.status = 'active'
      -- Check if loan start date is before or equal to the given month
      AND (lr.start_year || lr.start_month) <= (p_year || p_month)
    ORDER BY lr.start_date;
END;
$$ LANGUAGE plpgsql;

-- View: Loan summary by employee
CREATE OR REPLACE VIEW v_employee_loan_summary AS
SELECT 
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    d.name AS department,
    COUNT(*) AS total_loans,
    SUM(lr.loan_amount) AS total_loan_amount,
    SUM(lr.total_amount) AS total_amount_with_interest,
    SUM(lr.amount_paid) AS total_paid,
    SUM(lr.remaining_balance) AS total_outstanding,
    COUNT(*) FILTER (WHERE lr.status = 'active') AS active_loans,
    COUNT(*) FILTER (WHERE lr.status = 'completed') AS completed_loans,
    SUM(lr.emi_amount) FILTER (WHERE lr.status = 'active') AS monthly_emi_total
FROM employees e
LEFT JOIN loan_records lr ON e.employee_id = lr.employee_id
LEFT JOIN departments d ON e.department_id = d.id
GROUP BY e.employee_id, e.first_name, e.last_name, d.name
HAVING COUNT(*) > 0
ORDER BY total_outstanding DESC;

-- View: Active loans
CREATE OR REPLACE VIEW v_active_loans AS
SELECT 
    lr.id,
    lr.loan_number,
    lr.loan_type,
    lr.employee_id,
    lr.employee_name,
    e.department_id,
    d.name AS department,
    lr.loan_amount,
    lr.interest_rate,
    lr.total_amount,
    lr.emi_amount,
    lr.number_of_emis,
    lr.total_paid_emis,
    lr.remaining_emis,
    lr.remaining_balance,
    lr.start_date,
    lr.last_emi_date,
    ROUND((lr.total_paid_emis::DECIMAL / lr.number_of_emis * 100), 2) AS completion_percentage
FROM loan_records lr
JOIN employees e ON lr.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.id
WHERE lr.status = 'active'
ORDER BY lr.remaining_balance DESC;

-- View: Loans nearing completion (less than 3 EMIs remaining)
CREATE OR REPLACE VIEW v_loans_nearing_completion AS
SELECT 
    lr.id,
    lr.loan_number,
    lr.loan_type,
    lr.employee_id,
    lr.employee_name,
    lr.remaining_emis,
    lr.remaining_balance,
    lr.emi_amount,
    lr.last_emi_date
FROM loan_records lr
WHERE lr.status = 'active'
  AND lr.remaining_emis <= 3
  AND lr.remaining_emis > 0
ORDER BY lr.remaining_emis, lr.employee_name;

COMMENT ON TABLE loan_records IS 'Employee loans with EMI-based repayment and approval workflow';
COMMENT ON COLUMN loan_records.loan_number IS 'Format: LN{TYPE}/YYYY/NNNNNN (e.g., LNP/2024/000001 for personal)';
COMMENT ON COLUMN loan_records.total_amount IS 'Loan amount + Interest';
COMMENT ON COLUMN loan_records.interest_amount IS 'Calculated as loan_amount * (interest_rate/100)';
COMMENT ON COLUMN loan_records.status IS 'pending→approved→active→completed or cancelled/defaulted';
COMMENT ON COLUMN loan_records.emi_amount IS 'Total amount / Number of EMIs';
```

---

### Table: `loan_emis`

```sql
CREATE TABLE loan_emis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loan_records(id) ON DELETE CASCADE,
    emi_number INT NOT NULL CHECK (emi_number > 0),
    month VARCHAR(20) NOT NULL,
    year VARCHAR(4) NOT NULL,
    emi_amount DECIMAL(12,2) NOT NULL CHECK (emi_amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_loan_emi_number UNIQUE (loan_id, emi_number)
);

CREATE INDEX idx_loan_emis_loan ON loan_emis(loan_id);
CREATE INDEX idx_loan_emis_status ON loan_emis(status);
CREATE INDEX idx_loan_emis_month_year ON loan_emis(month, year);

COMMENT ON TABLE loan_emis IS 'Individual EMI schedule entries for loans';
COMMENT ON COLUMN loan_emis.emi_number IS 'Sequential EMI number (1, 2, 3...)';
```

---

## 7. Letter and Document Generation

### Table: `letter_templates`

```sql
CREATE TABLE letter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(50) UNIQUE NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN (
        'offer_letter', 'appointment_letter', 'confirmation_letter', 
        'promotion_letter', 'transfer_letter', 'increment_letter',
        'relieving_letter', 'experience_letter', 'resignation_acceptance',
        'warning_letter', 'termination_letter', 'noc_letter',
        'salary_certificate', 'employment_certificate', 'bonus_letter'
    )),
    template_category VARCHAR(50) NOT NULL DEFAULT 'employment' CHECK (template_category IN (
        'employment', 'compensation', 'separation', 'disciplinary', 'certificates'
    )),
    template_content TEXT NOT NULL,
    template_subject VARCHAR(500),
    template_format VARCHAR(20) NOT NULL DEFAULT 'html' CHECK (template_format IN ('html', 'plain_text', 'markdown')),
    available_placeholders JSONB,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadata
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    letterhead_required BOOLEAN NOT NULL DEFAULT true,
    signature_required BOOLEAN NOT NULL DEFAULT true,
    company_seal_required BOOLEAN NOT NULL DEFAULT false,
    
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_single_default_per_type UNIQUE NULLS NOT DISTINCT (template_type, is_default) 
        DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_letter_templates_type ON letter_templates(template_type);
CREATE INDEX idx_letter_templates_category ON letter_templates(template_category);
CREATE INDEX idx_letter_templates_active ON letter_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_letter_templates_default ON letter_templates(template_type, is_default) WHERE is_default = true;
CREATE INDEX idx_letter_templates_code ON letter_templates(template_code);
CREATE INDEX idx_letter_templates_placeholders ON letter_templates USING GIN(available_placeholders);

-- Trigger: Update timestamp
CREATE OR REPLACE FUNCTION update_letter_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_letter_template_timestamp
BEFORE UPDATE ON letter_templates
FOR EACH ROW
EXECUTE FUNCTION update_letter_template_timestamp();

-- Trigger: Ensure only one default per type
CREATE OR REPLACE FUNCTION validate_default_letter_template()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE letter_templates
        SET is_default = false
        WHERE template_type = NEW.template_type
          AND id != NEW.id
          AND is_default = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_default_letter_template
BEFORE INSERT OR UPDATE ON letter_templates
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION validate_default_letter_template();

-- Procedure: Create template version
CREATE OR REPLACE PROCEDURE create_template_version(
    p_template_id UUID,
    p_updated_by UUID,
    OUT p_new_template_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_template RECORD;
    v_new_version INT;
BEGIN
    SELECT * INTO v_template FROM letter_templates WHERE id = p_template_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found', p_template_id;
    END IF;
    
    v_new_version := v_template.version + 1;
    
    -- Create new version (copy existing template)
    INSERT INTO letter_templates (
        template_code, template_name, template_type, template_category,
        template_content, template_subject, template_format,
        available_placeholders, version, is_active, is_default,
        requires_approval, language, letterhead_required,
        signature_required, company_seal_required, created_by, updated_by
    )
    SELECT 
        template_code, template_name, template_type, template_category,
        template_content, template_subject, template_format,
        available_placeholders, v_new_version, false, false,
        requires_approval, language, letterhead_required,
        signature_required, company_seal_required, created_by, p_updated_by
    FROM letter_templates
    WHERE id = p_template_id
    RETURNING id INTO p_new_template_id;
    
    RAISE NOTICE 'Created new version % for template %', v_new_version, v_template.template_code;
END;
$$;

-- Function: Get active template by type
CREATE OR REPLACE FUNCTION get_active_template_by_type(p_template_type VARCHAR(50))
RETURNS TABLE (
    template_id UUID,
    template_code VARCHAR(50),
    template_name VARCHAR(255),
    template_content TEXT,
    available_placeholders JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lt.id,
        lt.template_code,
        lt.template_name,
        lt.template_content,
        lt.available_placeholders
    FROM letter_templates lt
    WHERE lt.template_type = p_template_type
      AND lt.is_active = true
      AND lt.is_default = true
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Return first active template if no default
        RETURN QUERY
        SELECT 
            lt.id,
            lt.template_code,
            lt.template_name,
            lt.template_content,
            lt.available_placeholders
        FROM letter_templates lt
        WHERE lt.template_type = p_template_type
          AND lt.is_active = true
        ORDER BY lt.created_at DESC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- View: Active templates summary
CREATE OR REPLACE VIEW v_active_letter_templates AS
SELECT 
    lt.id,
    lt.template_code,
    lt.template_name,
    lt.template_type,
    lt.template_category,
    lt.version,
    lt.is_default,
    lt.requires_approval,
    lt.language,
    uc.full_name AS created_by_name,
    lt.created_at,
    uu.full_name AS updated_by_name,
    lt.updated_at,
    COUNT(gl.id) AS usage_count
FROM letter_templates lt
LEFT JOIN users uc ON lt.created_by = uc.id
LEFT JOIN users uu ON lt.updated_by = uu.id
LEFT JOIN generated_letters gl ON lt.id = gl.template_id
WHERE lt.is_active = true
GROUP BY lt.id, lt.template_code, lt.template_name, lt.template_type, 
         lt.template_category, lt.version, lt.is_default, lt.requires_approval,
         lt.language, uc.full_name, lt.created_at, uu.full_name, lt.updated_at
ORDER BY lt.template_type, lt.is_default DESC, lt.created_at DESC;

-- View: Template versions
CREATE OR REPLACE VIEW v_letter_template_versions AS
SELECT 
    lt.template_code,
    lt.template_name,
    lt.template_type,
    lt.version,
    lt.is_active,
    lt.is_default,
    lt.created_at,
    u.full_name AS created_by_name,
    COUNT(gl.id) AS usage_count
FROM letter_templates lt
LEFT JOIN users u ON lt.created_by = u.id
LEFT JOIN generated_letters gl ON lt.id = gl.template_id
GROUP BY lt.id, lt.template_code, lt.template_name, lt.template_type,
         lt.version, lt.is_active, lt.is_default, lt.created_at, u.full_name
ORDER BY lt.template_code, lt.version DESC;

COMMENT ON TABLE letter_templates IS 'Templates for generating employee letters with version control';
COMMENT ON COLUMN letter_templates.template_code IS 'Unique code like "OFFER_V1", "APPOINT_V2"';
COMMENT ON COLUMN letter_templates.template_content IS 'Template with placeholders like {{employee_name}}, {{designation}}, {{join_date}}';
COMMENT ON COLUMN letter_templates.available_placeholders IS 'JSON array of placeholder names available in this template';
COMMENT ON COLUMN letter_templates.version IS 'Version number for template history';
COMMENT ON COLUMN letter_templates.is_default IS 'Only one default template per type';
```

---

### Table: `generated_letters`

```sql
CREATE TABLE generated_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id VARCHAR(20) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    
    -- Letter Details
    letter_type VARCHAR(50) NOT NULL CHECK (letter_type IN (
        'offer_letter', 'appointment_letter', 'confirmation_letter', 
        'promotion_letter', 'transfer_letter', 'increment_letter',
        'relieving_letter', 'experience_letter', 'resignation_acceptance',
        'warning_letter', 'termination_letter', 'noc_letter',
        'salary_certificate', 'employment_certificate', 'bonus_letter'
    )),
    letter_subject VARCHAR(500),
    template_id UUID REFERENCES letter_templates(id) ON DELETE SET NULL,
    template_version INT,
    
    -- Content
    letter_content TEXT NOT NULL,
    letter_content_html TEXT,
    placeholder_values JSONB,
    
    -- File Management
    file_format VARCHAR(10) NOT NULL DEFAULT 'pdf' CHECK (file_format IN ('pdf', 'docx', 'html', 'txt')),
    file_data TEXT,
    file_size INT,
    file_name VARCHAR(255),
    
    -- Status and Workflow
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'cancelled')),
    
    -- Approval (if required)
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approval_requested_at TIMESTAMP NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP NULL,
    approval_remarks TEXT,
    
    -- Delivery
    is_sent BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMP NULL,
    sent_to_email VARCHAR(255) NULL,
    sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
    delivery_status VARCHAR(50),
    
    -- Tracking
    download_count INT NOT NULL DEFAULT 0,
    last_downloaded_at TIMESTAMP NULL,
    view_count INT NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMP NULL,
    
    -- Signing
    is_digitally_signed BOOLEAN NOT NULL DEFAULT false,
    signed_by VARCHAR(255),
    signed_at TIMESTAMP NULL,
    signature_data TEXT,
    
    -- Reference Data (denormalized for historical accuracy)
    reference_id VARCHAR(50),
    reference_date DATE,
    effective_date DATE,
    expiry_date DATE,
    
    remarks TEXT,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_generated_letters_employee ON generated_letters(employee_id);
CREATE INDEX idx_generated_letters_type ON generated_letters(letter_type);
CREATE INDEX idx_generated_letters_date ON generated_letters(generated_at DESC);
CREATE INDEX idx_generated_letters_number ON generated_letters(letter_number);
CREATE INDEX idx_generated_letters_status ON generated_letters(status);
CREATE INDEX idx_generated_letters_template ON generated_letters(template_id);
CREATE INDEX idx_generated_letters_approval ON generated_letters(status, approval_requested_at) 
    WHERE status = 'pending_approval';
CREATE INDEX idx_generated_letters_unsent ON generated_letters(is_sent, generated_at) 
    WHERE is_sent = false AND status = 'approved';
CREATE INDEX idx_generated_letters_placeholders ON generated_letters USING GIN(placeholder_values);

-- Trigger: Generate letter number
CREATE OR REPLACE FUNCTION generate_letter_number()
RETURNS TRIGGER AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_seq INT;
    v_year VARCHAR(4);
BEGIN
    v_year := TO_CHAR(NEW.generated_at, 'YYYY');
    
    v_prefix := CASE NEW.letter_type
        WHEN 'offer_letter' THEN 'OFR'
        WHEN 'appointment_letter' THEN 'APT'
        WHEN 'confirmation_letter' THEN 'CNF'
        WHEN 'promotion_letter' THEN 'PRM'
        WHEN 'transfer_letter' THEN 'TRN'
        WHEN 'increment_letter' THEN 'INC'
        WHEN 'relieving_letter' THEN 'RLV'
        WHEN 'experience_letter' THEN 'EXP'
        WHEN 'resignation_acceptance' THEN 'RSG'
        WHEN 'warning_letter' THEN 'WRN'
        WHEN 'termination_letter' THEN 'TRM'
        WHEN 'noc_letter' THEN 'NOC'
        WHEN 'salary_certificate' THEN 'SAL'
        WHEN 'employment_certificate' THEN 'EMP'
        WHEN 'bonus_letter' THEN 'BNS'
        ELSE 'LTR'
    END;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(letter_number FROM '[0-9]+$') AS INT)), 0) + 1
    INTO v_seq
    FROM generated_letters
    WHERE letter_number ~ ('^' || v_prefix || '/' || v_year);
    
    NEW.letter_number := v_prefix || '/' || v_year || '/' || LPAD(v_seq::TEXT, 6, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_letter_number
BEFORE INSERT ON generated_letters
FOR EACH ROW
WHEN (NEW.letter_number IS NULL)
EXECUTE FUNCTION generate_letter_number();

-- Trigger: Calculate file size
CREATE OR REPLACE FUNCTION calculate_letter_file_size()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.file_data IS NOT NULL THEN
        NEW.file_size := LENGTH(NEW.file_data);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_letter_file_size
BEFORE INSERT OR UPDATE OF file_data ON generated_letters
FOR EACH ROW
EXECUTE FUNCTION calculate_letter_file_size();

-- Trigger: Validate status transitions
CREATE OR REPLACE FUNCTION validate_letter_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Approval workflow
    IF NEW.status = 'approved' AND OLD.status = 'pending_approval' THEN
        IF NEW.approved_by IS NULL THEN
            RAISE EXCEPTION 'Approver must be specified when approving letter';
        END IF;
        NEW.approved_at := CURRENT_TIMESTAMP;
    END IF;
    
    -- Prevent status changes after sent
    IF OLD.status = 'sent' AND NEW.status != 'sent' THEN
        RAISE EXCEPTION 'Cannot change status of sent letter';
    END IF;
    
    -- Auto-approve if approval not required
    IF NEW.status = 'draft' AND NEW.requires_approval = false AND OLD.status IS NULL THEN
        NEW.status := 'approved';
    END IF;
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_letter_status_transition
BEFORE UPDATE ON generated_letters
FOR EACH ROW
EXECUTE FUNCTION validate_letter_status_transition();

-- Procedure: Generate letter from template
CREATE OR REPLACE PROCEDURE generate_letter_from_template(
    p_employee_id VARCHAR(20),
    p_letter_type VARCHAR(50),
    p_template_id UUID,
    p_placeholder_values JSONB,
    p_generated_by UUID,
    OUT p_letter_id UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_template RECORD;
    v_employee RECORD;
    v_letter_content TEXT;
    v_placeholder_key TEXT;
    v_placeholder_value TEXT;
BEGIN
    -- Get template
    SELECT * INTO v_template FROM letter_templates WHERE id = p_template_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found', p_template_id;
    END IF;
    
    IF v_template.is_active = false THEN
        RAISE EXCEPTION 'Template % is not active', v_template.template_name;
    END IF;
    
    -- Get employee details
    SELECT * INTO v_employee FROM employees WHERE employee_id = p_employee_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % not found', p_employee_id;
    END IF;
    
    -- Start with template content
    v_letter_content := v_template.template_content;
    
    -- Replace placeholders
    FOR v_placeholder_key, v_placeholder_value IN 
        SELECT key, value FROM jsonb_each_text(p_placeholder_values)
    LOOP
        v_letter_content := REPLACE(
            v_letter_content, 
            '{{' || v_placeholder_key || '}}', 
            v_placeholder_value
        );
    END LOOP;
    
    -- Insert generated letter
    INSERT INTO generated_letters (
        employee_id, employee_name, letter_type, letter_subject,
        template_id, template_version, letter_content,
        placeholder_values, requires_approval, status,
        generated_by
    )
    VALUES (
        p_employee_id,
        v_employee.first_name || ' ' || v_employee.last_name,
        p_letter_type,
        v_template.template_subject,
        p_template_id,
        v_template.version,
        v_letter_content,
        p_placeholder_values,
        v_template.requires_approval,
        CASE WHEN v_template.requires_approval THEN 'pending_approval' ELSE 'approved' END,
        p_generated_by
    )
    RETURNING id INTO p_letter_id;
    
    RAISE NOTICE 'Generated letter % for employee %', p_letter_type, p_employee_id;
END;
$$;

-- Procedure: Approve letter
CREATE OR REPLACE PROCEDURE approve_letter(
    p_letter_id UUID,
    p_approved_by UUID,
    p_remarks TEXT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT status INTO v_status FROM generated_letters WHERE id = p_letter_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Letter % not found', p_letter_id;
    END IF;
    
    IF v_status != 'pending_approval' THEN
        RAISE EXCEPTION 'Can only approve letters pending approval, current status: %', v_status;
    END IF;
    
    UPDATE generated_letters
    SET status = 'approved',
        approved_by = p_approved_by,
        approved_at = CURRENT_TIMESTAMP,
        approval_remarks = p_remarks,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_letter_id;
    
    RAISE NOTICE 'Letter % approved', p_letter_id;
END;
$$;

-- Procedure: Send letter via email
CREATE OR REPLACE PROCEDURE send_letter_email(
    p_letter_id UUID,
    p_recipient_email VARCHAR(255),
    p_sent_by UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_letter RECORD;
BEGIN
    SELECT * INTO v_letter FROM generated_letters WHERE id = p_letter_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Letter % not found', p_letter_id;
    END IF;
    
    IF v_letter.status != 'approved' THEN
        RAISE EXCEPTION 'Can only send approved letters, current status: %', v_letter.status;
    END IF;
    
    IF v_letter.file_data IS NULL THEN
        RAISE EXCEPTION 'Letter % has no file data to send', v_letter.letter_number;
    END IF;
    
    -- Send email logic would go here
    RAISE NOTICE 'Sending letter % (%s) to %', v_letter.letter_number, v_letter.letter_subject, p_recipient_email;
    
    -- Mark as sent
    UPDATE generated_letters
    SET is_sent = true,
        sent_at = CURRENT_TIMESTAMP,
        sent_to_email = p_recipient_email,
        sent_by = p_sent_by,
        status = 'sent',
        delivery_status = 'sent',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_letter_id;
END;
$$;

-- Procedure: Track letter download
CREATE OR REPLACE PROCEDURE track_letter_download(p_letter_id UUID)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE generated_letters
    SET download_count = download_count + 1,
        last_downloaded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_letter_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Letter % not found', p_letter_id;
    END IF;
END;
$$;

-- View: Letter generation summary by employee
CREATE OR REPLACE VIEW v_employee_letters_summary AS
SELECT 
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    d.name AS department,
    COUNT(*) AS total_letters,
    COUNT(*) FILTER (WHERE gl.letter_type IN ('offer_letter', 'appointment_letter')) AS employment_letters,
    COUNT(*) FILTER (WHERE gl.letter_type IN ('promotion_letter', 'increment_letter')) AS compensation_letters,
    COUNT(*) FILTER (WHERE gl.letter_type IN ('relieving_letter', 'experience_letter')) AS separation_letters,
    COUNT(*) FILTER (WHERE gl.letter_type LIKE '%certificate%') AS certificates,
    COUNT(*) FILTER (WHERE gl.status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE gl.is_sent = true) AS sent_count,
    MAX(gl.generated_at) AS latest_letter_date
FROM employees e
LEFT JOIN generated_letters gl ON e.employee_id = gl.employee_id
LEFT JOIN departments d ON e.department_id = d.id
GROUP BY e.employee_id, e.first_name, e.last_name, d.name
HAVING COUNT(*) > 0
ORDER BY latest_letter_date DESC;

-- View: Pending approval letters
CREATE OR REPLACE VIEW v_pending_approval_letters AS
SELECT 
    gl.id,
    gl.letter_number,
    gl.employee_id,
    gl.employee_name,
    e.department_id,
    d.name AS department,
    gl.letter_type,
    gl.letter_subject,
    gl.generated_at,
    gu.full_name AS generated_by_name,
    gl.approval_requested_at,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - gl.approval_requested_at) AS days_pending_approval
FROM generated_letters gl
JOIN employees e ON gl.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.id
LEFT JOIN users gu ON gl.generated_by = gu.id
WHERE gl.status = 'pending_approval'
ORDER BY gl.approval_requested_at ASC;

-- View: Recent letters
CREATE OR REPLACE VIEW v_recent_generated_letters AS
SELECT 
    gl.id,
    gl.letter_number,
    gl.employee_id,
    gl.employee_name,
    e.official_email,
    d.name AS department,
    gl.letter_type,
    gl.letter_subject,
    gl.status,
    gl.is_sent,
    gl.sent_at,
    gl.download_count,
    gl.generated_at,
    gu.full_name AS generated_by_name,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - gl.generated_at) AS days_ago
FROM generated_letters gl
JOIN employees e ON gl.employee_id = e.employee_id
JOIN departments d ON e.department_id = d.id
LEFT JOIN users gu ON gl.generated_by = gu.id
WHERE gl.generated_at >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY gl.generated_at DESC;

-- View: Letter statistics by type
CREATE OR REPLACE VIEW v_letter_statistics_by_type AS
SELECT 
    gl.letter_type,
    COUNT(*) AS total_generated,
    COUNT(*) FILTER (WHERE gl.status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE gl.status = 'pending_approval') AS pending_approval_count,
    COUNT(*) FILTER (WHERE gl.is_sent = true) AS sent_count,
    COUNT(*) FILTER (WHERE gl.is_digitally_signed = true) AS signed_count,
    AVG(gl.download_count) AS avg_downloads,
    MAX(gl.generated_at) AS last_generated_at
FROM generated_letters gl
GROUP BY gl.letter_type
ORDER BY total_generated DESC;

COMMENT ON TABLE generated_letters IS 'Generated letters for employees with approval workflow and delivery tracking';
COMMENT ON COLUMN generated_letters.letter_number IS 'Format: {TYPE}/YYYY/NNNNNN (e.g., OFR/2024/000001)';
COMMENT ON COLUMN generated_letters.file_data IS 'Base64 encoded PDF or file content';
COMMENT ON COLUMN generated_letters.placeholder_values IS 'JSON object with actual values used to fill template placeholders';
COMMENT ON COLUMN generated_letters.status IS 'draft→pending_approval→approved→sent or cancelled';
```

---

## 8. System Configuration

### Table: `system_settings`

```sql
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) NOT NULL CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'date', 'email')),
    setting_category VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (setting_category IN (
        'general', 'payroll', 'statutory', 'attendance', 'leave', 
        'email', 'notification', 'security', 'compliance', 'company'
    )),
    description TEXT NOT NULL,
    display_name VARCHAR(255),
    validation_regex VARCHAR(500),
    min_value DECIMAL(15,2),
    max_value DECIMAL(15,2),
    allowed_values TEXT[],
    is_editable BOOLEAN NOT NULL DEFAULT true,
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    is_system BOOLEAN NOT NULL DEFAULT false,
    requires_restart BOOLEAN NOT NULL DEFAULT false,
    effective_from DATE,
    effective_until DATE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX idx_system_settings_category ON system_settings(setting_category);
CREATE INDEX idx_system_settings_editable ON system_settings(is_editable);
CREATE INDEX idx_system_settings_effective ON system_settings(effective_from, effective_until);

-- Trigger: Validate setting value based on type
CREATE OR REPLACE FUNCTION validate_setting_value()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate based on setting_type
    CASE NEW.setting_type
        WHEN 'number' THEN
            BEGIN
                -- Try to cast to numeric
                PERFORM NEW.setting_value::NUMERIC;
                
                -- Check min/max constraints
                IF NEW.min_value IS NOT NULL AND NEW.setting_value::NUMERIC < NEW.min_value THEN
                    RAISE EXCEPTION 'Value % is below minimum %', NEW.setting_value, NEW.min_value;
                END IF;
                
                IF NEW.max_value IS NOT NULL AND NEW.setting_value::NUMERIC > NEW.max_value THEN
                    RAISE EXCEPTION 'Value % is above maximum %', NEW.setting_value, NEW.max_value;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid numeric value: %', NEW.setting_value;
            END;
            
        WHEN 'boolean' THEN
            IF NEW.setting_value NOT IN ('true', 'false', '1', '0', 'yes', 'no') THEN
                RAISE EXCEPTION 'Invalid boolean value: %. Must be true/false, 1/0, or yes/no', NEW.setting_value;
            END IF;
            
        WHEN 'json' THEN
            BEGIN
                PERFORM NEW.setting_value::JSONB;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid JSON value: %', NEW.setting_value;
            END;
            
        WHEN 'date' THEN
            BEGIN
                PERFORM NEW.setting_value::DATE;
            EXCEPTION WHEN OTHERS THEN
                RAISE EXCEPTION 'Invalid date value: %', NEW.setting_value;
            END;
            
        WHEN 'email' THEN
            IF NEW.setting_value !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
                RAISE EXCEPTION 'Invalid email value: %', NEW.setting_value;
            END IF;
    END CASE;
    
    -- Validate against allowed_values if specified
    IF NEW.allowed_values IS NOT NULL AND array_length(NEW.allowed_values, 1) > 0 THEN
        IF NOT (NEW.setting_value = ANY(NEW.allowed_values)) THEN
            RAISE EXCEPTION 'Value % not in allowed values: %', NEW.setting_value, array_to_string(NEW.allowed_values, ', ');
        END IF;
    END IF;
    
    -- Validate against regex if specified
    IF NEW.validation_regex IS NOT NULL AND NEW.setting_value !~ NEW.validation_regex THEN
        RAISE EXCEPTION 'Value % does not match required pattern', NEW.setting_value;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_setting_value
BEFORE INSERT OR UPDATE OF setting_value ON system_settings
FOR EACH ROW
EXECUTE FUNCTION validate_setting_value();

-- Trigger: Prevent editing non-editable settings
CREATE OR REPLACE FUNCTION prevent_non_editable_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_editable = false AND NEW.setting_value != OLD.setting_value THEN
        RAISE EXCEPTION 'Setting % is not editable', OLD.setting_key;
    END IF;
    
    IF OLD.is_system = true AND NEW.setting_key != OLD.setting_key THEN
        RAISE EXCEPTION 'Cannot modify key of system setting %', OLD.setting_key;
    END IF;
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_non_editable_changes
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION prevent_non_editable_changes();

-- Procedure: Get setting value with type conversion
CREATE OR REPLACE FUNCTION get_setting_value(
    p_setting_key VARCHAR(100),
    p_default_value TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    v_value TEXT;
    v_effective_from DATE;
    v_effective_until DATE;
BEGIN
    SELECT setting_value, effective_from, effective_until
    INTO v_value, v_effective_from, v_effective_until
    FROM system_settings
    WHERE setting_key = p_setting_key;
    
    IF NOT FOUND THEN
        RETURN p_default_value;
    END IF;
    
    -- Check if setting is currently effective
    IF v_effective_from IS NOT NULL AND CURRENT_DATE < v_effective_from THEN
        RETURN p_default_value;
    END IF;
    
    IF v_effective_until IS NOT NULL AND CURRENT_DATE > v_effective_until THEN
        RETURN p_default_value;
    END IF;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- Procedure: Update setting value
CREATE OR REPLACE PROCEDURE update_setting_value(
    p_setting_key VARCHAR(100),
    p_setting_value TEXT,
    p_updated_by UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_is_editable BOOLEAN;
BEGIN
    SELECT is_editable INTO v_is_editable
    FROM system_settings
    WHERE setting_key = p_setting_key;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Setting % not found', p_setting_key;
    END IF;
    
    IF v_is_editable = false THEN
        RAISE EXCEPTION 'Setting % is not editable', p_setting_key;
    END IF;
    
    UPDATE system_settings
    SET setting_value = p_setting_value,
        updated_by = p_updated_by,
        updated_at = CURRENT_TIMESTAMP
    WHERE setting_key = p_setting_key;
    
    RAISE NOTICE 'Setting % updated to %', p_setting_key, p_setting_value;
END;
$$;

-- Procedure: Bulk update settings
CREATE OR REPLACE PROCEDURE bulk_update_settings(
    p_settings JSONB,
    p_updated_by UUID
)
LANGUAGE plpgsql AS $$
DECLARE
    v_setting RECORD;
BEGIN
    FOR v_setting IN 
        SELECT key AS setting_key, value AS setting_value 
        FROM jsonb_each_text(p_settings)
    LOOP
        BEGIN
            CALL update_setting_value(v_setting.setting_key, v_setting.setting_value, p_updated_by);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to update setting %: %', v_setting.setting_key, SQLERRM;
        END;
    END LOOP;
END;
$$;

-- View: Settings by category
CREATE OR REPLACE VIEW v_settings_by_category AS
SELECT 
    ss.setting_category,
    COUNT(*) AS total_settings,
    COUNT(*) FILTER (WHERE ss.is_editable = true) AS editable_settings,
    COUNT(*) FILTER (WHERE ss.is_sensitive = true) AS sensitive_settings,
    COUNT(*) FILTER (WHERE ss.is_system = true) AS system_settings
FROM system_settings ss
GROUP BY ss.setting_category
ORDER BY ss.setting_category;

-- View: Recent setting changes
CREATE OR REPLACE VIEW v_recent_setting_changes AS
SELECT 
    ss.setting_key,
    ss.display_name,
    ss.setting_category,
    ss.setting_value,
    ss.updated_at,
    u.full_name AS updated_by_name,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - ss.updated_at) AS days_ago
FROM system_settings ss
LEFT JOIN users u ON ss.updated_by = u.id
WHERE ss.updated_at >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY ss.updated_at DESC;

COMMENT ON TABLE system_settings IS 'Application-wide configuration settings with validation and audit trail';
COMMENT ON COLUMN system_settings.setting_value IS 'Stored as text, parse based on setting_type';
COMMENT ON COLUMN system_settings.setting_type IS 'Type for validation: string, number, boolean, json, date, email';
COMMENT ON COLUMN system_settings.validation_regex IS 'Optional regex pattern for string validation';
COMMENT ON COLUMN system_settings.allowed_values IS 'Optional array of allowed values for enum-like settings';
COMMENT ON COLUMN system_settings.is_sensitive IS 'Mask value in UI (e.g., API keys, passwords)';
COMMENT ON COLUMN system_settings.is_system IS 'System-managed setting, key cannot be changed';
COMMENT ON COLUMN system_settings.requires_restart IS 'Application restart required after change';
COMMENT ON COLUMN system_settings.effective_from IS 'Setting becomes active from this date';
COMMENT ON COLUMN system_settings.effective_until IS 'Setting expires after this date';
```

**Pre-seeded Configuration**:
```sql
-- Payroll Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable) VALUES
    ('PF_WAGE_CEILING_MONTHLY', '15000', 'number', 'payroll', 'PF wage ceiling per month as per statutory limits', 'PF Wage Ceiling', true),
    ('PF_EMPLOYEE_RATE', '0.12', 'number', 'payroll', 'Employee PF contribution rate (12%)', 'Employee PF Rate', true),
    ('PF_EMPLOYER_RATE', '0.12', 'number', 'payroll', 'Employer PF contribution rate (12%)', 'Employer PF Rate', true),
    ('ESI_EMPLOYEE_RATE', '0.0075', 'number', 'payroll', 'Employee ESI rate (0.75%)', 'Employee ESI Rate', true),
    ('ESI_EMPLOYER_RATE', '0.0325', 'number', 'payroll', 'Employer ESI rate (3.25%)', 'Employer ESI Rate', true),
    ('ESI_WAGE_CEILING_MONTHLY', '21000', 'number', 'payroll', 'ESI wage ceiling per month as per statutory limits', 'ESI Wage Ceiling', true),
    ('BASIC_PCT_OF_CTC', '0.50', 'number', 'payroll', 'Basic salary as percentage of CTC (50%)', 'Basic % of CTC', true),
    ('GRATUITY_RATE_ANNUAL', '0.0481', 'number', 'payroll', 'Gratuity provision rate (~4.81%)', 'Gratuity Rate', true),
    ('PROFESSIONAL_TAX_MONTHLY', '200', 'number', 'payroll', 'Monthly professional tax amount', 'Professional Tax', true);

-- Company Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable) VALUES
    ('COMPANY_NAME', 'EcoVale Solutions Pvt Ltd', 'string', 'company', 'Official company name', 'Company Name', true),
    ('COMPANY_ADDRESS', '123 Business Park, Bangalore, Karnataka 560001', 'string', 'company', 'Company registered address', 'Company Address', true),
    ('COMPANY_PAN', 'AAACE1234F', 'string', 'company', 'Company PAN number', 'Company PAN', true),
    ('COMPANY_TAN', 'BLRE12345F', 'string', 'company', 'Company TAN number', 'Company TAN', true),
    ('COMPANY_GST', '29AAACE1234F1Z5', 'string', 'company', 'Company GSTIN', 'Company GST', true),
    ('COMPANY_PF_NUMBER', 'KRBLR1234567890', 'string', 'company', 'Company PF registration number', 'PF Number', true),
    ('COMPANY_ESI_NUMBER', 'ESI1234567890', 'string', 'company', 'Company ESI registration number', 'ESI Number', true),
    ('COMPANY_LOGO_URL', '/assets/ecovale-logo.png', 'string', 'company', 'Company logo file path or URL', 'Company Logo', true),
    ('FINANCIAL_YEAR_START', '04-01', 'string', 'company', 'Financial year start date (MM-DD)', 'FY Start Date', false),
    ('COMPANY_EMAIL', 'hr@ecovale.com', 'email', 'company', 'Company HR email address', 'HR Email', true),
    ('COMPANY_PHONE', '+91-80-12345678', 'string', 'company', 'Company phone number', 'Phone', true);

-- Attendance Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable) VALUES
    ('WORKING_DAYS_PER_WEEK', '5', 'number', 'attendance', 'Standard working days per week', 'Working Days/Week', true),
    ('WORKING_HOURS_PER_DAY', '9', 'number', 'attendance', 'Standard working hours per day', 'Working Hours/Day', true),
    ('GRACE_PERIOD_MINUTES', '10', 'number', 'attendance', 'Grace period for late arrival (minutes)', 'Grace Period', true),
    ('HALF_DAY_HOURS', '4.5', 'number', 'attendance', 'Minimum hours for half day attendance', 'Half Day Hours', true),
    ('OVERTIME_ENABLED', 'true', 'boolean', 'attendance', 'Enable overtime tracking', 'Overtime Enabled', true),
    ('OVERTIME_MULTIPLIER', '1.5', 'number', 'attendance', 'Overtime pay multiplier', 'Overtime Multiplier', true);

-- Leave Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable) VALUES
    ('ANNUAL_LEAVE_DAYS', '21', 'number', 'leave', 'Annual paid leave entitlement (days)', 'Annual Leave Days', true),
    ('CASUAL_LEAVE_DAYS', '7', 'number', 'leave', 'Casual leave days per year', 'Casual Leave Days', true),
    ('SICK_LEAVE_DAYS', '7', 'number', 'leave', 'Sick leave days per year', 'Sick Leave Days', true),
    ('LEAVE_ACCRUAL_MONTHLY', 'true', 'boolean', 'leave', 'Accrue leave monthly vs. annual', 'Monthly Accrual', true),
    ('LEAVE_CARRY_FORWARD_DAYS', '5', 'number', 'leave', 'Maximum leave days to carry forward', 'Carry Forward Days', true),
    ('PROBATION_LEAVE_ENABLED', 'false', 'boolean', 'leave', 'Allow leave during probation period', 'Probation Leave', true);

-- Email Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable, is_sensitive) VALUES
    ('SMTP_HOST', 'smtp.gmail.com', 'string', 'email', 'SMTP server hostname', 'SMTP Host', true, false),
    ('SMTP_PORT', '587', 'number', 'email', 'SMTP server port', 'SMTP Port', true, false),
    ('SMTP_USERNAME', 'hr@ecovale.com', 'email', 'email', 'SMTP username', 'SMTP Username', true, false),
    ('SMTP_PASSWORD', '********', 'string', 'email', 'SMTP password', 'SMTP Password', true, true),
    ('SMTP_USE_TLS', 'true', 'boolean', 'email', 'Use TLS for SMTP connection', 'Use TLS', true, false),
    ('EMAIL_FROM_NAME', 'EcoVale HR', 'string', 'email', 'Default sender name for emails', 'From Name', true, false),
    ('EMAIL_FROM_ADDRESS', 'hr@ecovale.com', 'email', 'email', 'Default sender email address', 'From Address', true, false);

-- Notification Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable) VALUES
    ('NOTIFY_PAYSLIP_GENERATION', 'true', 'boolean', 'notification', 'Send email on payslip generation', 'Payslip Notification', true),
    ('NOTIFY_LEAVE_APPROVAL', 'true', 'boolean', 'notification', 'Send email on leave approval/rejection', 'Leave Approval Notification', true),
    ('NOTIFY_DOCUMENT_EXPIRY_DAYS', '30', 'number', 'notification', 'Days before expiry to send notification', 'Document Expiry Alert Days', true),
    ('NOTIFY_PROBATION_END_DAYS', '15', 'number', 'notification', 'Days before probation end to send notification', 'Probation Alert Days', true),
    ('NOTIFY_BIRTHDAY', 'true', 'boolean', 'notification', 'Send birthday wishes to employees', 'Birthday Notification', true),
    ('NOTIFY_WORK_ANNIVERSARY', 'true', 'boolean', 'notification', 'Send work anniversary wishes', 'Anniversary Notification', true);

-- Security Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable, requires_restart) VALUES
    ('SESSION_TIMEOUT_MINUTES', '60', 'number', 'security', 'User session timeout in minutes', 'Session Timeout', true, true),
    ('PASSWORD_MIN_LENGTH', '8', 'number', 'security', 'Minimum password length', 'Min Password Length', true, false),
    ('PASSWORD_REQUIRE_UPPERCASE', 'true', 'boolean', 'security', 'Require uppercase letter in password', 'Require Uppercase', true, false),
    ('PASSWORD_REQUIRE_NUMBER', 'true', 'boolean', 'security', 'Require number in password', 'Require Number', true, false),
    ('PASSWORD_REQUIRE_SPECIAL', 'true', 'boolean', 'security', 'Require special character in password', 'Require Special Char', true, false),
    ('PASSWORD_EXPIRY_DAYS', '90', 'number', 'security', 'Password expiry period in days', 'Password Expiry', true, false),
    ('MAX_LOGIN_ATTEMPTS', '5', 'number', 'security', 'Maximum login attempts before lockout', 'Max Login Attempts', true, false),
    ('ACCOUNT_LOCKOUT_MINUTES', '30', 'number', 'security', 'Account lockout duration in minutes', 'Lockout Duration', true, false);

-- Compliance Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable) VALUES
    ('DATA_RETENTION_YEARS', '7', 'number', 'compliance', 'Data retention period in years', 'Data Retention', true),
    ('AUDIT_LOG_ENABLED', 'true', 'boolean', 'compliance', 'Enable detailed audit logging', 'Audit Logging', true),
    ('GDPR_COMPLIANCE_MODE', 'false', 'boolean', 'compliance', 'Enable GDPR compliance features', 'GDPR Mode', true),
    ('BACKUP_FREQUENCY_HOURS', '24', 'number', 'compliance', 'Database backup frequency in hours', 'Backup Frequency', true);

-- General Settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, setting_category, description, display_name, is_editable, is_system) VALUES
    ('APP_VERSION', '1.0.0', 'string', 'general', 'Application version', 'App Version', false, true),
    ('APP_ENVIRONMENT', 'production', 'string', 'general', 'Application environment', 'Environment', false, true),
    ('MAINTENANCE_MODE', 'false', 'boolean', 'general', 'Enable maintenance mode', 'Maintenance Mode', true, false),
    ('DEFAULT_LANGUAGE', 'en', 'string', 'general', 'Default application language', 'Default Language', true, false),
    ('DEFAULT_TIMEZONE', 'Asia/Kolkata', 'string', 'general', 'Default timezone', 'Timezone', true, false),
    ('DEFAULT_CURRENCY', 'INR', 'string', 'general', 'Default currency code', 'Currency', true, false),
    ('DATE_FORMAT', 'DD-MM-YYYY', 'string', 'general', 'Default date format', 'Date Format', true, false),
    ('RECORDS_PER_PAGE', '50', 'number', 'general', 'Default records per page in listings', 'Records Per Page', true, false);
```

---

### Table: `setting_change_history`

```sql
CREATE TABLE setting_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT,
    ip_address VARCHAR(45)
);

CREATE INDEX idx_setting_history_key ON setting_change_history(setting_key);
CREATE INDEX idx_setting_history_date ON setting_change_history(changed_at DESC);
CREATE INDEX idx_setting_history_user ON setting_change_history(changed_by);

-- Trigger: Log setting changes
CREATE OR REPLACE FUNCTION log_setting_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.setting_value IS DISTINCT FROM NEW.setting_value THEN
        INSERT INTO setting_change_history (
            setting_key, old_value, new_value, changed_by
        )
        VALUES (
            OLD.setting_key, OLD.setting_value, NEW.setting_value, NEW.updated_by
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_setting_change
AFTER UPDATE ON system_settings
FOR EACH ROW
WHEN (OLD.setting_value IS DISTINCT FROM NEW.setting_value)
EXECUTE FUNCTION log_setting_change();

-- View: Setting change history
CREATE OR REPLACE VIEW v_setting_change_history AS
SELECT 
    sch.setting_key,
    ss.display_name,
    ss.setting_category,
    sch.old_value,
    sch.new_value,
    sch.changed_at,
    u.full_name AS changed_by_name,
    sch.change_reason
FROM setting_change_history sch
LEFT JOIN system_settings ss ON sch.setting_key = ss.setting_key
LEFT JOIN users u ON sch.changed_by = u.id
ORDER BY sch.changed_at DESC;

COMMENT ON TABLE setting_change_history IS 'Audit trail for all system setting changes';
COMMENT ON COLUMN setting_change_history.ip_address IS 'IP address of user who made the change';
```

---

## 9. Schema Relationships Summary

### Entity Relationship Overview

The EcoVale HR System database consists of **20 core tables** organized into 8 functional domains, with **78+ foreign key relationships** ensuring referential integrity.

---

### 9.1. Core Domain Relationships

#### **Authentication & User Management Domain**

```
users (1) ─────────────────┐
    │                      │
    │ (1:N)                │ (1:N)
    ↓                      ↓
sessions (N)          audit_logs (N)
    └─ User sessions      └─ All user actions logged
       with JWT tokens       with before/after snapshots
```

**Relationships**:
- `users` → `sessions` (1:N) - One user can have multiple active sessions
- `users` → `audit_logs` (1:N) - All actions tracked per user
- `sessions.user_id` → `users.id` (ON DELETE CASCADE)
- `audit_logs.user_id` → `users.id` (ON DELETE SET NULL)

---

#### **Organizational Structure Domain**

```
departments (1) ─────────────────┬──────────────────┐
    │                            │                  │
    │ (1:N)                      │ (1:N)            │
    ↓                            ↓                  │
designations (N)            employees (N)          │
    │                            │                  │
    │ (self-referential)         │ (M:1)            │
    └─ reporting_to ────────────→│                  │
         (hierarchy)              │                  │
                                  │                  │
                                  └──────────────────┘
                                     department_id
```

**Relationships**:
- `departments` → `employees` (1:N) - Department contains many employees
- `departments` → `designations` (1:N) - Department has multiple job roles
- `designations` → `employees` (1:N) - Designation assigned to employees
- `designations` → `designations` (self-referential) - Reporting hierarchy
- `employees` → `employees` (self-referential) - Manager-subordinate chain
- `designations.department_id` → `departments.id` (ON DELETE RESTRICT)
- `employees.department_id` → `departments.id` (ON DELETE RESTRICT)
- `employees.designation_id` → `designations.id` (ON DELETE RESTRICT)
- `employees.reporting_manager_id` → `employees.id` (ON DELETE SET NULL)

**Circular Reference Prevention**: Triggers prevent circular reporting in both designation and employee hierarchies.

---

#### **Employee Core Data Domain**

```
employees (1) ──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
    │                       │              │              │              │              │
    │ (1:N)                 │ (1:N)        │ (1:N)        │ (1:N)        │ (1:N)        │
    ↓                       ↓              ↓              ↓              ↓              ↓
bank_details (N)    documents (N)  career_history (N)  salary_       employees (N)
    │                   │              │              annexures (N)   (guarantor)
    │                   │              │              │              │
    │ Primary bank      │ Versioned    │ Promotions,  │ CTC          │ Loan
    │ enforcement       │ documents    │ transfers,   │ breakdown    │ guarantor
    │ (1 primary max)   │ with expiry  │ exits with   │ documents    │ relationship
    │                   │ tracking     │ approval     │ generated    │
    │                   │              │              │              │
    │                   │              ↓              │              │
    │                   │        designations (2)     │              │
    │                   │              │              │              │
    │                   │              └─ old/new ────┘              │
    │                   │                 designation                │
    └───────────────────┴──────────────────────────────────────────┘
```

**Relationships**:
- `employees` → `bank_details` (1:N) - Multiple bank accounts per employee
- `employees` → `documents` (1:N) - Multiple documents (PAN, Aadhaar, certificates)
- `employees` → `career_history` (1:N) - Career progression tracking
- `employees` → `salary_annexures` (1:N) - Generated salary documents
- `career_history` → `designations` (M:2) - Links old and new designations
- `loan_records` → `employees` (M:1) - Guarantor relationship
- `bank_details.employee_id` → `employees.id` (ON DELETE CASCADE)
- `documents.employee_id` → `employees.id` (ON DELETE CASCADE)
- `salary_annexures.employee_id` → `employees.id` (ON DELETE CASCADE)

**Business Rules**:
- Only one primary bank account per employee (enforced by trigger)
- Documents support versioning with `parent_document_id`
- Career history auto-applies changes to employee record on approval

---

#### **Attendance Management Domain**

```
employees (1)
    │
    │ (1:N)
    ↓
attendance_records (N)
    │
    │ Monthly summary
    │ (unique per employee per month/year)
    │
    └─ Used by payroll generation
```

**Relationships**:
- `employees` → `attendance_records` (1:N) - Monthly attendance per employee
- `attendance_records.employee_id` → `employees.id` (ON DELETE CASCADE)
- Unique constraint: (employee_id, month, year)

**Business Rules**:
- Approval workflow required before payroll processing
- Auto-calculated: payable_days, loss_of_pay_days, attendance_percentage
- LOP deduction automatically applied during payroll generation

---

#### **Payroll Management Domain**

```
pay_runs (1) ────────────┐
    │                    │
    │ (1:N)              │ (workflow)
    ↓                    │
pay_run_employee_    users (N)
records (N)              │
    │                    └─ generated_by, approved_by, processed_by
    │ (1:1)              
    ↓                    
payslips (1)             
    │                    
    │ References:        
    │ - attendance_records (LOP calculation)
    │ - advance_records (deductions)
    │ - loan_records (EMI deductions)
    │                    
    └─ Sent to employees via email
```

**Relationships**:
- `pay_runs` → `pay_run_employee_records` (1:N) - One pay run contains N employee records
- `pay_run_employee_records` → `payslips` (1:1) - Each record generates one payslip
- `pay_runs.generated_by_user_id` → `users.id` (ON DELETE SET NULL)
- `pay_runs.approved_by` → `users.id` (ON DELETE SET NULL)
- `pay_runs.processed_by` → `users.id` (ON DELETE SET NULL)
- `pay_run_employee_records.employee_id` → `employees.id` (ON DELETE RESTRICT)
- `payslips.employee_id` → `employees.id` (ON DELETE RESTRICT)

**Workflow**: draft → approved → processed (with triggers enforcing state transitions)

**Integration Points**:
- Reads from `attendance_records` for LOP calculation
- Reads from `advance_records` for advance deductions
- Reads from `loan_records` for EMI deductions
- Generates `payslips` with complete salary breakdown

---

#### **Advance and Loan Management Domain**

```
employees (1) ──────────┬──────────────┐
    │                   │              │
    │ (1:N)             │ (1:N)        │
    ↓                   ↓              │
advance_records (N) loan_records (N)  │
    │                   │              │ (M:1 guarantor)
    │ Installment-      │ EMI-based    └─────────┐
    │ based recovery    │ repayment              │
    │                   │                        │
    │ Status:           │ Lifecycle:             │
    │ pending→partial   │ pending→approved       │
    │ →deducted         │ →active→completed      │
    │                   │                        │
    └─ Deducted from   └─ EMI auto-deducted    │
       monthly payroll    from monthly payroll   │
                                                 │
                        employees (guarantor) ───┘
```

**Relationships**:
- `employees` → `advance_records` (1:N) - Multiple advances per employee
- `employees` → `loan_records` (1:N) - Multiple loans per employee
- `loan_records` → `employees` (M:1) - Guarantor relationship
- `advance_records.employee_id` → `employees.id` (ON DELETE CASCADE)
- `loan_records.employee_id` → `employees.id` (ON DELETE CASCADE)
- `loan_records.guarantor_employee_id` → `employees.id` (ON DELETE SET NULL)

**Business Rules**:
- Advances support multi-installment recovery
- Loans require approval workflow (pending→approved→active)
- Both automatically deducted during payroll generation
- Loan EMI and advance installments tracked separately

---

#### **Letter and Document Generation Domain**

```
letter_templates (1) ────────────┐
    │                            │
    │ (1:N)                      │ Template versioning
    ↓                            │ (same template_code,
generated_letters (N)            │  different versions)
    │                            │
    │ References:                │
    │ - employees (1:N)          │
    │ - users (approval/send)    │
    │                            │
    │ Workflow:                  │
    │ draft → pending_approval   │
    │ → approved → sent          │
    │                            │
    └─ 15 letter types supported
       (offer, appointment, relieving, etc.)
```

**Relationships**:
- `letter_templates` → `generated_letters` (1:N) - Template used for multiple letters
- `employees` → `generated_letters` (1:N) - Letters generated per employee
- `generated_letters.template_id` → `letter_templates.id` (ON DELETE SET NULL)
- `generated_letters.employee_id` → `employees.id` (ON DELETE CASCADE)
- `generated_letters.generated_by` → `users.id` (ON DELETE SET NULL)
- `generated_letters.approved_by` → `users.id` (ON DELETE SET NULL)
- `generated_letters.sent_by` → `users.id` (ON DELETE SET NULL)

**Features**:
- Template versioning support
- Placeholder replacement with JSONB tracking
- Optional approval workflow
- Email delivery tracking
- Digital signature support

---

#### **System Configuration Domain**

```
system_settings (1)
    │
    │ (1:N)
    ↓
setting_change_history (N)
    │
    │ Audit trail for all changes
    │
    └─ Tracks: old_value, new_value, changed_by, timestamp
```

**Relationships**:
- `system_settings` → `setting_change_history` (1:N) - History per setting
- `setting_change_history.changed_by` → `users.id` (ON DELETE SET NULL)
- Automatic history logging via trigger

**80+ Pre-configured Settings** across 9 categories:
- Payroll (PF, ESI, gratuity rates)
- Company (PAN, TAN, GST, addresses)
- Attendance (working hours, grace period)
- Leave (annual, casual, sick leave policies)
- Email (SMTP configuration)
- Notification (alerts and reminders)
- Security (password policies, session timeout)
- Compliance (data retention, audit logging)
- General (app settings, localization)

---

### 9.2. Complete Foreign Key Reference Table

| Child Table | Parent Table | Foreign Key Column(s) | ON DELETE | Cardinality | Description |
|------------|--------------|----------------------|-----------|-------------|-------------|
| **Authentication Domain** |
| sessions | users | user_id | CASCADE | N:1 | User login sessions |
| audit_logs | users | user_id | SET NULL | N:1 | Action audit trail |
| **Organizational Domain** |
| employees | departments | department_id | RESTRICT | N:1 | Employee's department |
| employees | designations | designation_id | RESTRICT | N:1 | Employee's job role |
| employees | employees | reporting_manager_id | SET NULL | N:1 | Manager-subordinate |
| designations | departments | department_id | RESTRICT | N:1 | Designation belongs to dept |
| designations | designations | reporting_to_designation_id | SET NULL | N:1 | Designation hierarchy |
| **Employee Core Data** |
| bank_details | employees | employee_id | CASCADE | N:1 | Employee bank accounts |
| documents | employees | employee_id | CASCADE | N:1 | Employee documents |
| documents | documents | parent_document_id | SET NULL | N:1 | Document versioning |
| career_history | employees | employee_id | CASCADE | N:1 | Career progression |
| career_history | designations | old_designation_id | RESTRICT | N:1 | Previous designation |
| career_history | designations | new_designation_id | RESTRICT | N:1 | New designation |
| salary_annexures | employees | employee_id | CASCADE | N:1 | Salary documents |
| salary_annexures | users | generated_by | SET NULL | N:1 | Document creator |
| **Attendance** |
| attendance_records | employees | employee_id | CASCADE | N:1 | Monthly attendance |
| attendance_records | users | created_by | SET NULL | N:1 | Record creator |
| attendance_records | users | updated_by | SET NULL | N:1 | Record updater |
| attendance_records | users | approved_by | SET NULL | N:1 | Attendance approver |
| **Payroll** |
| pay_runs | users | generated_by_user_id | SET NULL | N:1 | Payrun generator |
| pay_runs | users | approved_by | SET NULL | N:1 | Payrun approver |
| pay_runs | users | processed_by | SET NULL | N:1 | Payrun processor |
| pay_run_employee_records | pay_runs | pay_run_id | CASCADE | N:1 | Employee in payrun |
| pay_run_employee_records | employees | employee_id | RESTRICT | N:1 | Employee reference |
| payslips | employees | employee_id | RESTRICT | N:1 | Payslip owner |
| payslips | pay_run_employee_records | pay_run_employee_record_id | SET NULL | 1:1 | Link to payrun record |
| **Advance/Loan** |
| advance_records | employees | employee_id | CASCADE | N:1 | Employee advances |
| advance_records | users | requested_by | SET NULL | N:1 | Advance requester |
| advance_records | users | approved_by | SET NULL | N:1 | Advance approver |
| loan_records | employees | employee_id | CASCADE | N:1 | Employee loans |
| loan_records | employees | guarantor_employee_id | SET NULL | N:1 | Loan guarantor |
| loan_records | users | requested_by | SET NULL | N:1 | Loan requester |
| loan_records | users | approved_by | SET NULL | N:1 | Loan approver |
| loan_emis | loan_records | loan_id | CASCADE | N:1 | EMI schedule |
| **Letters** |
| letter_templates | users | created_by | SET NULL | N:1 | Template creator |
| letter_templates | users | updated_by | SET NULL | N:1 | Template updater |
| generated_letters | employees | employee_id | CASCADE | N:1 | Letter recipient |
| generated_letters | letter_templates | template_id | SET NULL | N:1 | Template used |
| generated_letters | users | generated_by | SET NULL | N:1 | Letter generator |
| generated_letters | users | approved_by | SET NULL | N:1 | Letter approver |
| generated_letters | users | sent_by | SET NULL | N:1 | Letter sender |
| **Configuration** |
| system_settings | users | updated_by | SET NULL | N:1 | Setting updater |
| setting_change_history | users | changed_by | SET NULL | N:1 | Change actor |

**Total Foreign Keys**: 47 explicit relationships across 20 tables

---

### 9.3. Self-Referential Relationships

| Table | Self-Reference Column | Purpose | Depth Limit |
|-------|----------------------|---------|-------------|
| employees | reporting_manager_id | Organizational hierarchy (manager-subordinate chain) | Unlimited (CEO has NULL) |
| designations | reporting_to_designation_id | Designation reporting structure | 20 levels (trigger enforced) |
| documents | parent_document_id | Document version history | Unlimited |

**Circular Reference Prevention**: Triggers on both `employees` and `designations` prevent circular reporting chains.

---

### 9.4. Many-to-Many Relationships

While the schema is primarily normalized with direct relationships, these logical M:N relationships exist through junction or linking patterns:

| Entity A | Entity B | Via | Relationship Type |
|----------|----------|-----|-------------------|
| employees | departments | career_history | Historical: Employee can work in multiple departments over time |
| employees | designations | career_history | Historical: Employee can hold multiple designations over time |
| letter_templates | employees | generated_letters | Usage: One template generates letters for many employees |
| pay_runs | employees | pay_run_employee_records | Monthly: Employee appears in multiple pay runs over time |

---

### 9.5. Relationship Summary by ON DELETE Action

**CASCADE (24 relationships)** - Child data automatically deleted:
- All employee-owned data: bank_details, documents, career_history, salary_annexures, attendance, advances, loans, letters
- Session cleanup on user deletion
- Payrun cascade to employee records and payslips
- Loan cascade to EMI records

**RESTRICT (8 relationships)** - Prevents deletion if children exist:
- departments → employees, designations (cannot delete department with employees)
- designations → employees, career_history (cannot delete designation in use)
- employees → pay_run_employee_records, payslips (cannot delete employee with processed payroll)

**SET NULL (15 relationships)** - Optional references become NULL:
- All `created_by`, `updated_by`, `generated_by`, `approved_by` user references
- Optional employee references: reporting_manager_id, guarantor_employee_id
- Template and parent document references

---

### 9.6. Data Flow: Key Business Processes

#### **Monthly Payroll Processing Flow**:
```
1. attendance_records (approved) ────────┐
2. advance_records (pending) ────────────┤
3. loan_records (active EMIs) ───────────┤
4. employees (salary components) ────────┤
                                         ↓
5. pay_runs (generate) ──────→ pay_run_employee_records
                                         ↓
6. pay_runs (approve) ───────────────────┤
7. pay_runs (process) ───────────────────┤
                                         ↓
8. payslips (generated) ─────→ Email delivery
                                         ↓
9. advance_records (status updated: partial/deducted)
10. loan_records (EMI paid, remaining_emis decremented)
```

#### **Employee Onboarding Flow**:
```
1. employees (create) ───────────────────┐
                                         ↓
2. bank_details (add) ───────────────────┤
3. documents (upload) ───────────────────┤
                                         ↓
4. letter_templates (offer/appointment) ─┤
                                         ↓
5. generated_letters (create) ───────────┤
                                         ↓
6. generated_letters (approve & send) ───┘
```

#### **Career Progression Flow**:
```
1. career_history (create promotion/transfer) ──→ Status: pending
                                                   ↓
2. career_history (approve) ────────────────────→ Status: approved
                                                   ↓
3. employees (auto-update via trigger) ─────────→ Updated: designation, salary, department
                                                   ↓
4. generated_letters (promotion letter) ────────→ Notification sent
```

---

### 9.7. Indexing Strategy for Relationships

All foreign key columns are indexed for optimal join performance:

**Primary Indexes** (on all foreign keys):
- `idx_{table}_{parent}` - Standard FK indexes
- `idx_{table}_{status}` - Status-based filtering
- `idx_{table}_{date}` - Temporal queries

**Composite Indexes** (for common query patterns):
- `(employee_id, month, year)` - Time-based employee data
- `(status, created_at)` - Workflow + temporal
- `(is_active, department_id)` - Active employees per department

**Partial Indexes** (for specific conditions):
- `WHERE is_active = true` - Active records only
- `WHERE status = 'pending_approval'` - Pending workflows
- `WHERE is_primary = true` - Primary bank accounts

**GIN Indexes** (for JSONB columns):
- `placeholder_values` in generated_letters
- `available_placeholders` in letter_templates
- `salary_snapshot` in salary_annexures
- `changes` in audit_logs

---

### 9.8. Denormalization for Performance

Strategic denormalization applied for read-heavy queries:

| Table | Denormalized Field | Reason |
|-------|-------------------|--------|
| attendance_records | employee_name | Avoid join for attendance reports |
| pay_run_employee_records | employee_name | Payroll reports without employee join |
| payslips | department, designation, employee_name | Historical accuracy, report performance |
| advance_records | employee_name | Quick advance reports |
| loan_records | employee_name | Quick loan reports |
| generated_letters | employee_name | Letter listings without joins |
| salary_annexures | salary_snapshot (JSONB) | Complete historical salary data |

**Trade-off**: Slight data duplication for significant read performance improvement and historical accuracy.

---

## 10. Data Integrity Constraints

The EcoVale HR System database implements multiple layers of data integrity constraints to ensure data accuracy, consistency, and reliability. This section documents all constraint types with examples and rationale.

---

### 10.1. Referential Integrity Constraints

All **47 foreign key relationships** enforce referential integrity with carefully chosen ON DELETE actions based on business requirements.

#### **CASCADE (24 relationships)** - Automatic Deletion of Dependent Data

When parent record is deleted, all child records are automatically removed. Used for truly dependent data that has no meaning without the parent.

| Child Table | Parent Table | Foreign Key | Rationale |
|------------|--------------|-------------|-----------|
| **Session Management** |
| sessions | users | user_id | User sessions have no meaning without user |
| **Employee Owned Data** |
| bank_details | employees | employee_id | Bank details belong exclusively to employee |
| documents | employees | employee_id | Employee documents are employee-specific |
| career_history | employees | employee_id | Career history tied to specific employee |
| salary_annexures | employees | employee_id | Salary documents are employee-specific |
| attendance_records | employees | employee_id | Attendance belongs to employee |
| advance_records | employees | employee_id | Advances are employee-specific debts |
| loan_records | employees | employee_id | Loans are employee-specific obligations |
| generated_letters | employees | employee_id | Letters issued to specific employee |
| **Payroll Structure** |
| pay_run_employee_records | pay_runs | pay_run_id | Employee records part of pay run |
| loan_emis | loan_records | loan_id | EMI schedule belongs to loan |

**Business Rule**: Employee termination workflow should handle data archival before actual deletion.

---

#### **RESTRICT (8 relationships)** - Prevent Deletion with Dependencies

Deletion prevented if child records exist. Used for critical master data that must remain intact while in use.

| Child Table | Parent Table | Foreign Key | Rationale | Resolution |
|------------|--------------|-------------|-----------|-----------|
| employees | departments | department_id | Cannot delete department with employees | Reassign employees first |
| employees | designations | designation_id | Cannot delete designation in use | Reassign employees first |
| designations | departments | department_id | Cannot delete department with designations | Reassign/delete designations first |
| pay_run_employee_records | employees | employee_id | Cannot delete employee with payroll history | Archive employee instead |
| payslips | employees | employee_id | Cannot delete employee with payment records | Maintain for audit/compliance |
| career_history | designations | old_designation_id, new_designation_id | Cannot delete designation with history | Maintain for audit trail |

**Business Rule**: These constraints enforce data retention policies and prevent accidental deletion of critical master data.

---

#### **SET NULL (15 relationships)** - Optional Reference Cleanup

Parent deletion sets foreign key to NULL. Used for optional relationships where child record remains meaningful without parent.

| Child Table | Parent Table | Foreign Key | Rationale |
|------------|--------------|-------------|-----------|
| **User Audit Trail** |
| audit_logs | users | user_id | Keep audit log even if user deleted |
| pay_runs | users | generated_by, approved_by, processed_by | Keep payroll history with NULL creator |
| generated_letters | users | generated_by, approved_by, sent_by | Keep letter history with NULL creator |
| system_settings | users | updated_by | Keep setting changes with NULL updater |
| **Employee Hierarchies** |
| employees | employees | reporting_manager_id | Manager departure doesn't cascade |
| designations | designations | reporting_to_designation_id | Maintain flat hierarchy if parent removed |
| **Optional References** |
| documents | documents | parent_document_id | Version chain can have gaps |
| loan_records | employees | guarantor_employee_id | Loan valid even if guarantor leaves |
| generated_letters | letter_templates | template_id | Keep letter if template deleted |
| payslips | pay_run_employee_records | pay_run_employee_record_id | Keep payslip if pay run data purged |

**Business Rule**: NULL indicates "no longer tracked" or "no longer available" rather than "never existed".

---

### 10.2. Check Constraints

**63+ CHECK constraints** enforce business rules and valid data ranges at the database level.

#### **Positive Amount Validations**

Ensures monetary values and quantities are positive where required.

```sql
-- employees
CHECK (ctc > 0)
CHECK (basic > 0)
CHECK (gross > 0)
CHECK (net > 0)

-- advance_records
CHECK (advance_paid_amount > 0)
CHECK (installment_amount > 0)
CHECK (remaining_amount >= 0 AND remaining_amount <= advance_paid_amount)

-- loan_records
CHECK (loan_amount > 0)
CHECK (emi_amount > 0)
CHECK (remaining_balance >= 0 AND remaining_balance <= total_amount)
CHECK (number_of_emis > 0 AND number_of_emis <= 120)
CHECK (interest_rate >= 0 AND interest_rate <= 100)

-- payslips
CHECK (gross_salary >= 0)
CHECK (net_pay >= 0)
CHECK (total_deductions >= 0)

-- system_settings (validated via trigger)
CHECK (min_value IS NULL OR setting_value::NUMERIC >= min_value)
CHECK (max_value IS NULL OR setting_value::NUMERIC <= max_value)
```

---

#### **Date and Range Validations**

Ensures temporal data is logically consistent.

```sql
-- employees
CHECK (join_date <= CURRENT_DATE)
CHECK (exit_date IS NULL OR exit_date >= join_date)
CHECK (date_of_birth < join_date)

-- career_history
CHECK (effective_date >= old_effective_date)
CHECK (exit_date IS NULL OR exit_date > join_date)

-- loan_records
CHECK (disbursed_at IS NULL OR disbursed_at >= approved_at)
CHECK (completed_at IS NULL OR completed_at >= disbursed_at)

-- attendance_records
CHECK (total_working_days > 0 AND total_working_days <= 31)
CHECK (present_days >= 0 AND present_days <= total_working_days)
CHECK (absent_days >= 0)
CHECK (paid_leave >= 0)
CHECK (unpaid_leave >= 0)

-- system_settings
CHECK (effective_from IS NULL OR effective_until IS NULL OR effective_until >= effective_from)
```

---

#### **Enum/Status Validations**

Restricts columns to predefined valid values.

```sql
-- employees
CHECK (status IN ('active', 'inactive', 'terminated', 'on_leave', 'probation'))
CHECK (gender IN ('male', 'female', 'other'))
CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed'))
CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern'))

-- attendance_records
-- No enum check, but status managed via is_approved boolean

-- pay_runs
CHECK (status IN ('draft', 'approved', 'processed', 'cancelled'))

-- payslips
-- Status implicit through workflow

-- advance_records
CHECK (status IN ('pending', 'partial', 'deducted', 'cancelled'))

-- loan_records
CHECK (status IN ('pending', 'approved', 'active', 'completed', 'cancelled', 'defaulted'))
CHECK (loan_type IN ('personal', 'emergency', 'education', 'housing', 'vehicle', 'medical'))

-- generated_letters
CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'cancelled'))
CHECK (letter_type IN ('offer_letter', 'appointment_letter', 'confirmation_letter', ...)) -- 15 types

-- documents
CHECK (document_type IN ('pan_card', 'aadhaar_card', 'passport', ...)) -- 20+ types
CHECK (verification_status IN ('pending', 'verified', 'rejected'))

-- bank_details
CHECK (account_type IN ('savings', 'current'))

-- system_settings
CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'date', 'email'))
CHECK (setting_category IN ('general', 'payroll', 'statutory', 'attendance', ...)) -- 9 categories
```

---

#### **Calculation Validations**

Ensures calculated values are mathematically correct.

```sql
-- employees (salary calculations)
CHECK (ABS(basic - (ctc * 0.5 / 12)) < 1) -- Basic = 50% of CTC / 12
CHECK (ABS(gross - (basic + hra + conveyance + telephone + medical_allowance + special_allowance)) < 1)
CHECK (ABS(net - (gross - (pf_deduction + esi_deduction + professional_tax + tds_monthly))) < 1)

-- attendance_records
CHECK (present_days + absent_days + paid_leave + unpaid_leave + week_offs + holidays <= total_working_days + half_days)

-- pay_run_employee_records
CHECK (ABS(net_pay - (gross_salary - total_deductions)) < 0.01)

-- payslips
CHECK (ABS(net_pay - (gross_salary - total_deductions)) < 0.01)

-- loan_records
CHECK (ABS(total_amount - (loan_amount + interest_amount)) < 0.01)
CHECK (remaining_emis = number_of_emis - total_paid_emis)
CHECK (total_paid_emis <= number_of_emis)

-- advance_records
CHECK (amount_deducted + remaining_amount = advance_paid_amount)
```

---

#### **Conditional Validations**

Ensures related fields are consistent.

```sql
-- employees
CHECK (NOT is_pf_applicable OR (pf_number IS NOT NULL AND pf_uan IS NOT NULL))
CHECK (NOT is_esi_applicable OR esi_number IS NOT NULL)

-- bank_details
CHECK (NOT is_verified OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
CHECK (NOT is_primary OR is_active = true) -- Primary bank must be active

-- documents
CHECK (expiry_date IS NULL OR expiry_date > issue_date)
CHECK (NOT requires_verification OR verification_status IS NOT NULL)

-- attendance_records
CHECK (NOT is_approved OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))

-- generated_letters
CHECK (NOT is_sent OR (sent_at IS NOT NULL AND sent_to_email IS NOT NULL))
CHECK (NOT is_digitally_signed OR (signed_by IS NOT NULL AND signed_at IS NOT NULL))

-- salary_annexures
CHECK (NOT is_sent OR (sent_at IS NOT NULL AND sent_to_email IS NOT NULL))

-- loan_records
CHECK (approved_at IS NULL OR approved_by IS NOT NULL)
CHECK (disbursed_at IS NULL OR approved_at IS NOT NULL) -- Can't disburse before approval
```

---

### 10.3. Unique Constraints

**31+ UNIQUE constraints** prevent duplicate records and enforce business rules.

#### **Natural Keys and Identifiers**

```sql
-- employees
UNIQUE (employee_id) -- Sequential number (1, 2, 3...)
UNIQUE (official_email)
UNIQUE (pan_number)
UNIQUE (aadhaar_number)
UNIQUE (pf_uan)
UNIQUE (esi_number)

-- departments
UNIQUE (name) -- Only one IT, HR, Finance, etc.

-- designations
UNIQUE (title, department_id) -- Title unique within department

-- bank_details
UNIQUE (employee_id, account_number, ifsc_code) -- Prevent duplicate accounts

-- users
UNIQUE (email)
UNIQUE (username)
```

---

#### **Composite Unique Constraints (Time-Series Data)**

Prevents duplicate records for the same entity in the same time period.

```sql
-- attendance_records
UNIQUE (employee_id, month, year) -- One attendance record per employee per month

-- payslips
UNIQUE (employee_id, salary_month, salary_year) -- One payslip per employee per month

-- pay_runs
UNIQUE (month, year) -- One pay run per month

-- Generated identifiers
UNIQUE (payslip_number) -- PS/2024/January/000001
UNIQUE (letter_number) -- OFR/2024/000001
UNIQUE (advance_number) -- ADV/2024/000001
UNIQUE (loan_number) -- LNP/2024/000001
UNIQUE (annexure_number) -- CTCB/2024/000001
```

---

#### **Business Rule Constraints**

```sql
-- bank_details
-- Only one primary bank account per employee (enforced via trigger)
-- Constraint: UNIQUE (employee_id, is_primary) WHERE is_primary = true (partial unique index)

-- letter_templates
UNIQUE (template_code) -- Template code must be unique
-- Only one default template per type (enforced via trigger and partial unique index)

-- system_settings
UNIQUE (setting_key) -- One setting per key

-- documents
-- Prevent duplicate SHA-256 hashes for same document type
UNIQUE (employee_id, document_type, document_hash) -- Deduplication
```

---

### 10.4. NOT NULL Constraints

**280+ NOT NULL constraints** ensure required data is always present.

#### **Critical Master Data**

```sql
-- employees
NOT NULL: employee_id, first_name, last_name, official_email, join_date, status,
          department_id, designation_id, ctc, basic, gross, net,
          employment_type, gender, date_of_birth

-- departments
NOT NULL: id, name, is_active

-- designations
NOT NULL: id, title, department_id, level

-- users
NOT NULL: id, email, username, password_hash, role, full_name, is_active
```

---

#### **Transactional Data**

```sql
-- attendance_records
NOT NULL: id, employee_id, employee_name, month, year, total_working_days,
          present_days, absent_days, paid_leave, unpaid_leave, is_approved

-- pay_runs
NOT NULL: id, month, year, status, total_employees, total_gross,
          total_deductions, total_net_pay

-- payslips
NOT NULL: id, payslip_number, employee_id, salary_month, salary_year,
          gross_salary, total_deductions, net_pay

-- advance_records
NOT NULL: advance_number, employee_id, advance_paid_amount, status,
          remaining_amount

-- loan_records
NOT NULL: loan_number, employee_id, loan_amount, emi_amount, number_of_emis,
          status, remaining_balance
```

---

#### **Audit Fields**

```sql
-- All tables include
NOT NULL: created_at
NOT NULL: updated_at (where applicable)

-- Optional audit fields (can be NULL)
NULLABLE: created_by, updated_by, approved_by, generated_by
```

---

### 10.5. Domain Constraints (via Triggers)

Complex business rules enforced through triggers that CHECK constraints cannot handle.

#### **Circular Reference Prevention**

```sql
-- Trigger: check_circular_reporting() on employees
-- Prevents: Employee A → Manager B → Manager C → Manager A
-- Implementation: Recursive CTE check, max depth 20 levels

-- Trigger: check_circular_designation_hierarchy() on designations
-- Prevents: Designation A → Reports to B → Reports to C → Reports to A
-- Implementation: Recursive traversal, max depth 20 levels
```

---

#### **Single Primary Enforcement**

```sql
-- Trigger: ensure_single_primary_bank_account() on bank_details
-- Rule: Only one bank account can be marked as primary per employee
-- Action: Sets other accounts to is_primary = false when new primary added

-- Trigger: validate_default_letter_template() on letter_templates
-- Rule: Only one default template per template_type
-- Action: Sets other templates to is_default = false when new default added
```

---

#### **Automatic Calculations**

```sql
-- Trigger: validate_salary_calculations() on employees
-- Validates: basic = CTC * 0.5 / 12
-- Validates: gross = sum of allowances
-- Validates: net = gross - deductions

-- Trigger: calculate_advance_installment() on advance_records
-- Calculates: installment_amount = advance_paid_amount / installments

-- Trigger: calculate_loan_details() on loan_records
-- Calculates: interest_amount = loan_amount * interest_rate / 100
-- Calculates: total_amount = loan_amount + interest_amount
-- Calculates: emi_amount = total_amount / number_of_emis
```

---

#### **Status Transition Validation**

```sql
-- Trigger: validate_pay_run_status_transition() on pay_runs
-- Enforces: draft → approved → processed (no backward transitions)
-- Prevents: Changing status of cancelled/processed pay runs

-- Trigger: validate_letter_status_transition() on generated_letters
-- Enforces: draft → pending_approval → approved → sent
-- Prevents: Changing status after letter sent

-- Trigger: validate_attendance_approval() on attendance_records
-- Enforces: approved_by must be set when is_approved = true
-- Auto-sets: approved_at timestamp on approval
```

---

#### **Cross-Table Validation**

```sql
-- Trigger: apply_career_event_to_employee() on career_history
-- Action: Auto-updates employees table when career_history approved
-- Updates: designation_id, department_id, salary fields

-- Trigger: validate_department_head() on departments
-- Validates: head_employee_id actually belongs to the department
-- Prevents: Department head from different department

-- Trigger: prevent_department_deletion_with_employees() on departments
-- Prevents: Deleting department if active employees exist
-- Alternative: Use ON DELETE RESTRICT in FK
```

---

#### **Data Deduplication**

```sql
-- Trigger: manage_document_versions() on documents
-- Action: Sets is_latest_version = false for old versions
-- Maintains: Version chain via parent_document_id

-- Procedure: upload_document() checks SHA-256 hash
-- Action: Prevents duplicate document uploads
-- Returns: Existing document_id if duplicate found
```

---

### 10.6. Index-Based Constraints

**Partial unique indexes** enforce conditional uniqueness.

```sql
-- Only one primary bank account per employee
CREATE UNIQUE INDEX idx_bank_primary_unique 
ON bank_details(employee_id) 
WHERE is_primary = true;

-- Only one default template per type
CREATE UNIQUE INDEX idx_template_default_unique 
ON letter_templates(template_type) 
WHERE is_default = true;

-- Only one latest document version
CREATE UNIQUE INDEX idx_document_latest_unique 
ON documents(employee_id, document_type) 
WHERE is_latest_version = true;

-- Unique approval per month (prevent duplicate approvals)
CREATE UNIQUE INDEX idx_attendance_approved_unique
ON attendance_records(employee_id, month, year)
WHERE is_approved = true;
```

---

### 10.7. Data Type Constraints

PostgreSQL data types provide built-in constraints:

```sql
-- Numeric precision
DECIMAL(12,2) -- 12 digits total, 2 after decimal (salary amounts)
DECIMAL(15,2) -- 15 digits total, 2 after decimal (payroll totals)
DECIMAL(5,2) -- 5 digits total, 2 after decimal (rates, percentages)

-- String length limits
VARCHAR(20) -- Employee ID, reference numbers
VARCHAR(50) -- Codes, short identifiers
VARCHAR(100) -- Keys, short text
VARCHAR(255) -- Names, titles, emails
VARCHAR(500) -- Subjects, longer text
TEXT -- Unlimited length (content, remarks)

-- Date/time precision
DATE -- Date only (YYYY-MM-DD)
TIMESTAMP -- Date and time with timezone
TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP -- Auto-timestamp

-- Boolean (true/false)
BOOLEAN NOT NULL DEFAULT false

-- JSON
JSONB -- Validated JSON with indexing support

-- Arrays
TEXT[] -- String arrays for tags, allowed_values
```

---

### 10.8. Constraint Violation Handling

#### **Common Violations and Resolutions**

| Constraint Type | Common Violation | Error Message Example | Resolution |
|----------------|------------------|----------------------|------------|
| Foreign Key | Parent not found | "violates foreign key constraint" | Create parent first |
| Foreign Key (RESTRICT) | Children exist | "update or delete on table violates FK" | Delete children first or use SET NULL |
| Unique | Duplicate value | "duplicate key value violates unique constraint" | Use different value or update existing |
| Check | Invalid value | "new row violates check constraint" | Provide valid value within range |
| Not NULL | Missing required field | "null value in column violates not-null constraint" | Provide required value |
| Trigger | Business rule violation | Custom exception message | Fix data to meet business rule |

---

### 10.9. Constraint Naming Conventions

Consistent naming for easy identification:

```sql
-- Foreign Keys
fk_{child_table}_{parent_table}
Example: fk_employees_departments

-- Check Constraints
chk_{table}_{description}
Example: chk_employees_positive_salary
Example: chk_loan_total_amount

-- Unique Constraints
uq_{table}_{columns}
Example: uq_employees_official_email
Example: uq_attendance_employee_month_year

-- Indexes
idx_{table}_{columns}
Example: idx_employees_department_id
Example: idx_payslips_employee_month_year

-- Partial Indexes
idx_{table}_{columns}_{condition}
Example: idx_bank_primary_unique
Example: idx_attendance_unapproved
```

---

### 10.10. Performance Impact of Constraints

#### **Constraint Evaluation Costs**

| Constraint Type | Performance Impact | When Evaluated | Optimization |
|----------------|-------------------|----------------|--------------|
| NOT NULL | Negligible | INSERT, UPDATE | None needed |
| CHECK | Low | INSERT, UPDATE | Keep expressions simple |
| UNIQUE | Low-Medium | INSERT, UPDATE | Automatic index created |
| Foreign Key | Medium | INSERT, UPDATE, DELETE | Indexed automatically |
| Trigger | Medium-High | Per trigger definition | Minimize complexity |

#### **Best Practices**

1. **Index all foreign keys** (done automatically by PostgreSQL)
2. **Keep CHECK constraints simple** - complex logic in triggers
3. **Use partial indexes** for conditional uniqueness
4. **Batch operations** to reduce per-row trigger overhead
5. **Defer constraint checks** for bulk operations when possible

```sql
-- Example: Defer constraints during bulk load
SET CONSTRAINTS ALL DEFERRED;
-- Bulk insert operations
COMMIT; -- Constraints checked at commit
```

---

### 10.11. Constraint Summary by Table

| Table | Foreign Keys | Check Constraints | Unique Constraints | Triggers | Total |
|-------|-------------|-------------------|-------------------|----------|-------|
| users | 0 | 2 | 2 | 3 | 7 |
| sessions | 1 | 0 | 0 | 2 | 3 |
| audit_logs | 1 | 0 | 0 | 0 | 1 |
| departments | 0 | 0 | 1 | 4 | 5 |
| designations | 2 | 1 | 1 | 5 | 9 |
| employees | 3 | 8 | 6 | 6 | 23 |
| bank_details | 1 | 2 | 1 | 4 | 8 |
| documents | 2 | 3 | 2 | 3 | 10 |
| career_history | 3 | 2 | 0 | 2 | 7 |
| salary_annexures | 2 | 1 | 1 | 3 | 7 |
| attendance_records | 4 | 5 | 1 | 3 | 13 |
| pay_runs | 3 | 1 | 1 | 2 | 7 |
| pay_run_employee_records | 2 | 1 | 1 | 0 | 4 |
| payslips | 2 | 1 | 2 | 3 | 8 |
| advance_records | 3 | 3 | 1 | 3 | 10 |
| loan_records | 4 | 7 | 1 | 3 | 15 |
| letter_templates | 2 | 2 | 2 | 2 | 8 |
| generated_letters | 5 | 3 | 1 | 3 | 12 |
| system_settings | 1 | 1 | 1 | 2 | 5 |
| setting_change_history | 1 | 0 | 0 | 1 | 2 |
| **TOTAL** | **47** | **63** | **31** | **53** | **194** |

**Total Data Integrity Constraints: 194+** (including NOT NULL constraints on 280+ columns)

---

### 10.12. Constraint Testing Checklist

#### **Pre-Deployment Validation**

✅ **Foreign Key Tests**:
- [ ] Verify CASCADE deletes remove dependent records
- [ ] Verify RESTRICT prevents deletion with children
- [ ] Verify SET NULL updates references correctly

✅ **Check Constraint Tests**:
- [ ] Test boundary values (min, max)
- [ ] Test negative amounts rejected
- [ ] Test invalid enum values rejected
- [ ] Test calculation validations

✅ **Unique Constraint Tests**:
- [ ] Test duplicate inserts rejected
- [ ] Test composite unique keys
- [ ] Test partial unique indexes

✅ **Trigger Tests**:
- [ ] Test circular reference prevention
- [ ] Test status transition enforcement
- [ ] Test automatic calculations
- [ ] Test cross-table validations

✅ **Performance Tests**:
- [ ] Measure constraint check overhead
- [ ] Test bulk insert with constraints
- [ ] Test deferred constraint checking

---

## 11. Computed/Generated Columns

The EcoVale HR System uses a combination of **PostgreSQL GENERATED columns** (stored in database), **trigger-calculated columns** (computed on INSERT/UPDATE), and **view-calculated columns** (computed at query time) to maintain data consistency and improve performance.

---

### 11.1. PostgreSQL GENERATED Columns (STORED)

**23 GENERATED columns** across 7 tables provide automatic calculation with zero maintenance overhead. Values are computed once on INSERT/UPDATE and stored physically.

#### **Syntax Pattern**
```sql
column_name DECIMAL(12,2) GENERATED ALWAYS AS (expression) STORED
```

**Characteristics**:
- ✅ Computed automatically on INSERT/UPDATE
- ✅ Stored physically (no runtime calculation overhead)
- ✅ Indexed like regular columns
- ✅ Guaranteed consistency with source columns
- ❌ Cannot be set manually in INSERT/UPDATE statements
- ❌ Expression cannot reference other tables (must be self-contained)

---

#### **attendance_records (4 generated columns)**

```sql
CREATE TABLE attendance_records (
    -- ... other columns ...
    
    -- Source columns
    present_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    absent_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    paid_leave DECIMAL(5,2) NOT NULL DEFAULT 0,
    unpaid_leave DECIMAL(5,2) NOT NULL DEFAULT 0,
    half_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- GENERATED columns (auto-calculated)
    payable_days DECIMAL(5,2) 
        GENERATED ALWAYS AS (present_days + paid_leave) STORED,
    
    loss_of_pay_days DECIMAL(5,2) 
        GENERATED ALWAYS AS (unpaid_leave + absent_days) STORED,
    
    total_paid_days DECIMAL(5,2) 
        GENERATED ALWAYS AS (present_days + paid_leave - (half_days * 0.5)) STORED,
    
    total_unpaid_days DECIMAL(5,2) 
        GENERATED ALWAYS AS (unpaid_leave + absent_days + (half_days * 0.5)) STORED
);
```

**Business Logic**:
- `payable_days`: Days eligible for salary payment (present + paid leave)
- `loss_of_pay_days`: Days with no pay (unpaid leave + absences)
- `total_paid_days`: Actual paid days accounting for half days (half day = 0.5 deduction)
- `total_unpaid_days`: Actual unpaid days accounting for half days (half day = 0.5 addition)

**Usage in Payroll**:
```sql
-- Calculate pro-rated salary based on payable days
SELECT 
    employee_id,
    (gross_salary / total_working_days) * payable_days AS pro_rated_salary,
    (gross_salary / total_working_days) * loss_of_pay_days AS lop_deduction
FROM attendance_records;
```

---

#### **loan_records (6 generated columns)**

```sql
CREATE TABLE loan_records (
    -- ... other columns ...
    
    -- Source columns
    loan_amount DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    number_of_emis INTEGER NOT NULL,
    
    -- GENERATED columns
    interest_amount DECIMAL(12,2) 
        GENERATED ALWAYS AS (loan_amount * interest_rate / 100) STORED,
    
    total_amount DECIMAL(12,2) 
        GENERATED ALWAYS AS (loan_amount + (loan_amount * interest_rate / 100)) STORED,
    
    emi_amount DECIMAL(12,2) 
        GENERATED ALWAYS AS ((loan_amount + (loan_amount * interest_rate / 100)) / number_of_emis) STORED,
    
    total_paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    remaining_balance DECIMAL(12,2) 
        GENERATED ALWAYS AS (
            (loan_amount + (loan_amount * interest_rate / 100)) - total_paid_amount
        ) STORED,
    
    total_paid_emis INTEGER NOT NULL DEFAULT 0,
    
    remaining_emis INTEGER 
        GENERATED ALWAYS AS (number_of_emis - total_paid_emis) STORED,
    
    completion_percentage DECIMAL(5,2)
        GENERATED ALWAYS AS (
            CASE 
                WHEN number_of_emis > 0 
                THEN (total_paid_emis::DECIMAL / number_of_emis) * 100 
                ELSE 0 
            END
        ) STORED
);
```

**Business Logic**:
- `interest_amount`: Simple interest calculation
- `total_amount`: Principal + interest (total repayment amount)
- `emi_amount`: Equal monthly installment (total / number of months)
- `remaining_balance`: Outstanding amount to be paid
- `remaining_emis`: Installments left
- `completion_percentage`: Loan repayment progress (0-100%)

**Usage Example**:
```sql
-- View loan status with auto-calculated fields
SELECT 
    loan_number,
    employee_name,
    loan_amount,
    interest_rate,
    total_amount, -- Auto-calculated
    emi_amount,   -- Auto-calculated
    remaining_balance, -- Auto-calculated
    completion_percentage -- Auto-calculated
FROM loan_records
WHERE status = 'active';
```

---

#### **advance_records (2 generated columns)**

```sql
CREATE TABLE advance_records (
    -- ... other columns ...
    
    -- Source columns
    advance_paid_amount DECIMAL(12,2) NOT NULL,
    amount_deducted DECIMAL(12,2) NOT NULL DEFAULT 0,
    installments INTEGER,
    
    -- GENERATED columns
    remaining_amount DECIMAL(12,2) 
        GENERATED ALWAYS AS (advance_paid_amount - amount_deducted) STORED,
    
    installment_amount DECIMAL(12,2) 
        GENERATED ALWAYS AS (
            CASE 
                WHEN installments > 0 
                THEN advance_paid_amount / installments 
                ELSE advance_paid_amount 
            END
        ) STORED
);
```

**Business Logic**:
- `remaining_amount`: Balance to be recovered from salary
- `installment_amount`: Monthly deduction amount

---

#### **pay_run_employee_records (3 generated columns)**

```sql
CREATE TABLE pay_run_employee_records (
    -- ... other columns ...
    
    -- Earnings components
    gross_salary DECIMAL(12,2) NOT NULL,
    
    -- Deduction components
    pf_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    esi_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    professional_tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    tds DECIMAL(12,2) NOT NULL DEFAULT 0,
    advance_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    loan_emi_deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
    other_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- GENERATED columns
    total_deductions DECIMAL(12,2) 
        GENERATED ALWAYS AS (
            pf_deduction + esi_deduction + professional_tax + tds + 
            advance_deduction + loan_emi_deduction + other_deductions
        ) STORED,
    
    net_pay DECIMAL(12,2) 
        GENERATED ALWAYS AS (gross_salary - (
            pf_deduction + esi_deduction + professional_tax + tds + 
            advance_deduction + loan_emi_deduction + other_deductions
        )) STORED,
    
    take_home_percentage DECIMAL(5,2)
        GENERATED ALWAYS AS (
            CASE 
                WHEN gross_salary > 0 
                THEN ((gross_salary - (pf_deduction + esi_deduction + professional_tax + 
                       tds + advance_deduction + loan_emi_deduction + other_deductions)) 
                       / gross_salary) * 100
                ELSE 0 
            END
        ) STORED
);
```

**Business Logic**:
- `total_deductions`: Sum of all deduction components
- `net_pay`: Final take-home salary (gross - deductions)
- `take_home_percentage`: Percentage of gross retained after deductions

---

#### **payslips (3 generated columns)**

Same pattern as `pay_run_employee_records` for consistency:

```sql
CREATE TABLE payslips (
    -- ... other columns ...
    
    gross_salary DECIMAL(12,2) NOT NULL,
    
    -- All deduction fields...
    
    total_deductions DECIMAL(12,2) 
        GENERATED ALWAYS AS (
            pf_deduction + esi_deduction + professional_tax + tds + 
            advance_deduction + loan_emi_deduction + other_deductions
        ) STORED,
    
    net_pay DECIMAL(12,2) 
        GENERATED ALWAYS AS (gross_salary - (/* sum of deductions */)) STORED,
    
    take_home_percentage DECIMAL(5,2)
        GENERATED ALWAYS AS (/* (net_pay / gross_salary) * 100 */) STORED
);
```

---

#### **employees (3 generated columns)**

```sql
CREATE TABLE employees (
    -- ... other columns ...
    
    -- Source columns
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    join_date DATE NOT NULL,
    exit_date DATE,
    
    -- GENERATED columns
    full_name VARCHAR(255) 
        GENERATED ALWAYS AS (
            CASE 
                WHEN middle_name IS NOT NULL AND middle_name != '' 
                THEN first_name || ' ' || middle_name || ' ' || last_name
                ELSE first_name || ' ' || last_name
            END
        ) STORED,
    
    tenure_months INTEGER
        GENERATED ALWAYS AS (
            CASE 
                WHEN exit_date IS NOT NULL 
                THEN EXTRACT(YEAR FROM AGE(exit_date, join_date)) * 12 + 
                     EXTRACT(MONTH FROM AGE(exit_date, join_date))
                ELSE EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date)) * 12 + 
                     EXTRACT(MONTH FROM AGE(CURRENT_DATE, join_date))
            END
        ) STORED,
    
    is_active BOOLEAN
        GENERATED ALWAYS AS (
            status = 'active' AND exit_date IS NULL
        ) STORED
);
```

**Business Logic**:
- `full_name`: Formatted name with optional middle name
- `tenure_months`: Employment duration in months (up to exit date or current date)
- `is_active`: Quick boolean check for active employment status

---

#### **documents (2 generated columns)**

```sql
CREATE TABLE documents (
    -- ... other columns ...
    
    issue_date DATE,
    expiry_date DATE,
    file_size_bytes BIGINT,
    
    -- GENERATED columns
    is_expired BOOLEAN
        GENERATED ALWAYS AS (
            expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE
        ) STORED,
    
    file_size_mb DECIMAL(10,2)
        GENERATED ALWAYS AS (file_size_bytes::DECIMAL / 1048576) STORED
);
```

**Business Logic**:
- `is_expired`: Document validity check
- `file_size_mb`: Human-readable file size

---

### 11.2. Trigger-Calculated Columns (Computed on INSERT/UPDATE)

**15+ trigger-calculated columns** handle complex business logic that cannot be expressed as GENERATED columns (requires external data or complex conditions).

#### **employees - Salary Breakdown (via trigger)**

```sql
-- Trigger: calculate_employee_salary_components
-- Fires: BEFORE INSERT OR UPDATE OF ctc

CREATE TRIGGER calculate_employee_salary_components
BEFORE INSERT OR UPDATE OF ctc ON employees
FOR EACH ROW
EXECUTE FUNCTION calculate_salary_breakdown();

-- Function sets:
NEW.basic := NEW.ctc * 0.5 / 12;
NEW.hra := NEW.basic * 0.5;
NEW.conveyance := 1600.00; -- Fixed
NEW.medical_allowance := 1250.00; -- Fixed
NEW.special_allowance := /* remaining to reach desired gross */
NEW.gross := NEW.basic + NEW.hra + NEW.conveyance + NEW.telephone + 
             NEW.medical_allowance + NEW.special_allowance;

-- Statutory deductions (based on system settings and thresholds)
NEW.pf_deduction := calculate_pf(NEW.basic);
NEW.esi_deduction := calculate_esi(NEW.gross);
NEW.professional_tax := get_professional_tax_slab(NEW.gross);
NEW.tds_monthly := calculate_tds_monthly(NEW.ctc);

NEW.net := NEW.gross - (NEW.pf_deduction + NEW.esi_deduction + 
                        NEW.professional_tax + NEW.tds_monthly);
```

**Why Not GENERATED?**:
- Requires system settings lookup (PF/ESI rates)
- Complex conditional logic based on thresholds
- Tax slab calculations requiring external data

---

#### **attendance_records - Month Metadata (via trigger)**

```sql
-- Trigger: set_attendance_metadata
-- Fires: BEFORE INSERT OR UPDATE

NEW.month_start_date := DATE_TRUNC('month', 
    MAKE_DATE(NEW.year, NEW.month, 1));
NEW.month_end_date := (DATE_TRUNC('month', 
    MAKE_DATE(NEW.year, NEW.month, 1)) + INTERVAL '1 month - 1 day')::DATE;
NEW.total_working_days := calculate_working_days(NEW.month, NEW.year);
```

**Why Not GENERATED?**:
- Requires date calculation functions
- Working days calculation depends on company calendar/holidays

---

#### **career_history - Denormalized Names (via trigger)**

```sql
-- Trigger: populate_career_history_denormalized_fields
-- Fires: BEFORE INSERT

-- Lookup and store static copies for performance
NEW.employee_name := (SELECT full_name FROM employees WHERE id = NEW.employee_id);
NEW.old_designation_name := (SELECT title FROM designations WHERE id = NEW.old_designation_id);
NEW.new_designation_name := (SELECT title FROM designations WHERE id = NEW.new_designation_id);
NEW.old_department_name := (SELECT name FROM departments WHERE id = NEW.old_department_id);
NEW.new_department_name := (SELECT name FROM departments WHERE id = NEW.new_department_id);
```

**Why Not GENERATED?**:
- Requires lookups from other tables (not allowed in GENERATED expressions)
- Intentional denormalization for historical accuracy

---

#### **pay_runs - Aggregated Totals (via trigger)**

```sql
-- Trigger: update_pay_run_totals
-- Fires: AFTER INSERT OR UPDATE OR DELETE ON pay_run_employee_records

-- Recalculate pay run aggregates
UPDATE pay_runs 
SET 
    total_employees = (SELECT COUNT(*) FROM pay_run_employee_records WHERE pay_run_id = NEW.pay_run_id),
    total_gross = (SELECT SUM(gross_salary) FROM pay_run_employee_records WHERE pay_run_id = NEW.pay_run_id),
    total_deductions = (SELECT SUM(total_deductions) FROM pay_run_employee_records WHERE pay_run_id = NEW.pay_run_id),
    total_net_pay = (SELECT SUM(net_pay) FROM pay_run_employee_records WHERE pay_run_id = NEW.pay_run_id)
WHERE id = NEW.pay_run_id;
```

**Why Not GENERATED?**:
- Aggregates data from child table (pay_run_employee_records)
- Cross-table calculations not supported in GENERATED columns

---

#### **generated_letters - Unique Numbering (via trigger)**

```sql
-- Trigger: generate_letter_number
-- Fires: BEFORE INSERT

-- Generate sequential number by letter type
NEW.letter_number := generate_unique_letter_number(NEW.letter_type);
-- Example: 'OFR/2024/000042', 'APT/2024/000125'
```

**Why Not GENERATED?**:
- Requires sequence lookup and format logic
- Must guarantee uniqueness across concurrent inserts

---

### 11.3. View-Calculated Columns (Computed at Query Time)

**40+ view-calculated columns** in materialized and regular views provide computed metrics without storing redundant data.

#### **v_employee_dashboard (analytical view)**

```sql
CREATE VIEW v_employee_dashboard AS
SELECT 
    e.id,
    e.employee_id,
    e.full_name,
    e.official_email,
    e.department_name,
    e.designation_name,
    
    -- Computed columns
    e.ctc,
    e.net AS monthly_net_salary,
    e.ctc / 12 AS monthly_ctc,
    (e.net / (e.ctc / 12)) * 100 AS take_home_percentage,
    
    -- Tenure calculations
    e.join_date,
    e.exit_date,
    CURRENT_DATE - e.join_date AS days_employed,
    EXTRACT(YEAR FROM AGE(COALESCE(e.exit_date, CURRENT_DATE), e.join_date)) AS years_of_service,
    EXTRACT(MONTH FROM AGE(COALESCE(e.exit_date, CURRENT_DATE), e.join_date)) AS additional_months,
    
    -- Active loans and advances
    (SELECT COUNT(*) FROM loan_records WHERE employee_id = e.id AND status = 'active') AS active_loans_count,
    (SELECT SUM(remaining_balance) FROM loan_records WHERE employee_id = e.id AND status = 'active') AS total_loan_balance,
    (SELECT COUNT(*) FROM advance_records WHERE employee_id = e.id AND status IN ('pending', 'partial')) AS active_advances_count,
    (SELECT SUM(remaining_amount) FROM advance_records WHERE employee_id = e.id AND status IN ('pending', 'partial')) AS total_advance_balance,
    
    -- Recent attendance
    (SELECT payable_days FROM attendance_records 
     WHERE employee_id = e.id AND month = EXTRACT(MONTH FROM CURRENT_DATE) 
     AND year = EXTRACT(YEAR FROM CURRENT_DATE)) AS current_month_payable_days,
    
    -- Document status
    (SELECT COUNT(*) FROM documents WHERE employee_id = e.id AND verification_status = 'verified') AS verified_documents_count,
    (SELECT COUNT(*) FROM documents WHERE employee_id = e.id AND is_expired = true) AS expired_documents_count
    
FROM employees e
WHERE e.status != 'terminated';
```

**Benefits**:
- No storage overhead (computed at runtime)
- Always reflects current state
- Complex aggregations across multiple tables

---

#### **v_payroll_summary (reporting view)**

```sql
CREATE VIEW v_payroll_summary AS
SELECT 
    pr.id,
    pr.month,
    pr.year,
    pr.status,
    
    -- Aggregate metrics
    pr.total_employees,
    pr.total_gross,
    pr.total_deductions,
    pr.total_net_pay,
    
    -- Computed percentages
    (pr.total_deductions / pr.total_gross) * 100 AS deduction_percentage,
    (pr.total_net_pay / pr.total_gross) * 100 AS net_percentage,
    pr.total_gross / pr.total_employees AS avg_gross_per_employee,
    pr.total_net_pay / pr.total_employees AS avg_net_per_employee,
    
    -- Statutory breakdown
    (SELECT SUM(pf_deduction) FROM pay_run_employee_records WHERE pay_run_id = pr.id) AS total_pf,
    (SELECT SUM(esi_deduction) FROM pay_run_employee_records WHERE pay_run_id = pr.id) AS total_esi,
    (SELECT SUM(professional_tax) FROM pay_run_employee_records WHERE pay_run_id = pr.id) AS total_pt,
    (SELECT SUM(tds) FROM pay_run_employee_records WHERE pay_run_id = pr.id) AS total_tds,
    
    -- Recovery breakdown
    (SELECT SUM(advance_deduction) FROM pay_run_employee_records WHERE pay_run_id = pr.id) AS total_advance_recovery,
    (SELECT SUM(loan_emi_deduction) FROM pay_run_employee_records WHERE pay_run_id = pr.id) AS total_loan_recovery
    
FROM pay_runs pr;
```

---

#### **v_loan_aging_analysis (analytical view)**

```sql
CREATE VIEW v_loan_aging_analysis AS
SELECT 
    lr.id,
    lr.loan_number,
    lr.employee_name,
    lr.loan_amount,
    lr.total_amount,
    lr.remaining_balance,
    lr.completion_percentage, -- GENERATED column
    
    -- Time-based calculations
    lr.approved_at,
    lr.disbursed_at,
    lr.expected_completion_date,
    CURRENT_DATE - lr.disbursed_at::DATE AS days_since_disbursement,
    lr.expected_completion_date - CURRENT_DATE AS days_to_completion,
    
    -- Repayment analysis
    lr.number_of_emis,
    lr.total_paid_emis,
    lr.remaining_emis, -- GENERATED column
    lr.emi_amount,
    
    -- Aging buckets (computed)
    CASE 
        WHEN lr.expected_completion_date < CURRENT_DATE THEN 'Overdue'
        WHEN lr.expected_completion_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due in 30 days'
        WHEN lr.expected_completion_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'Due in 90 days'
        ELSE 'Due after 90 days'
    END AS aging_bucket,
    
    -- Risk assessment (computed)
    CASE 
        WHEN lr.total_paid_emis = 0 THEN 'No payment yet'
        WHEN lr.completion_percentage < 25 THEN 'Early stage'
        WHEN lr.completion_percentage < 75 THEN 'Mid stage'
        ELSE 'Near completion'
    END AS repayment_stage
    
FROM loan_records lr
WHERE lr.status IN ('approved', 'active');
```

---

### 11.4. Materialized View Calculations (Pre-Computed for Performance)

**3 materialized views** store complex aggregations for fast querying.

#### **mv_employee_attendance_ytd (Year-to-Date Attendance)**

```sql
CREATE MATERIALIZED VIEW mv_employee_attendance_ytd AS
SELECT 
    e.id AS employee_id,
    e.employee_id AS employee_number,
    e.full_name AS employee_name,
    EXTRACT(YEAR FROM CURRENT_DATE) AS year,
    
    -- Aggregated attendance metrics
    SUM(ar.present_days) AS total_present_days,
    SUM(ar.absent_days) AS total_absent_days,
    SUM(ar.paid_leave) AS total_paid_leave,
    SUM(ar.unpaid_leave) AS total_unpaid_leave,
    SUM(ar.payable_days) AS total_payable_days,
    SUM(ar.loss_of_pay_days) AS total_lop_days,
    
    -- Computed metrics
    SUM(ar.total_working_days) AS total_working_days_ytd,
    (SUM(ar.present_days)::DECIMAL / NULLIF(SUM(ar.total_working_days), 0)) * 100 AS attendance_percentage,
    COUNT(*) AS months_recorded,
    
    -- Last refresh timestamp
    CURRENT_TIMESTAMP AS last_refreshed_at
    
FROM employees e
LEFT JOIN attendance_records ar ON e.id = ar.employee_id 
    AND ar.year = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE e.status IN ('active', 'on_leave')
GROUP BY e.id, e.employee_id, e.full_name;

-- Refresh monthly after attendance approval
CREATE INDEX idx_mv_attendance_ytd_employee ON mv_employee_attendance_ytd(employee_id);
```

**Refresh Strategy**: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_attendance_ytd;` (monthly)

---

#### **mv_department_payroll_stats (Department-wise Payroll Analytics)**

```sql
CREATE MATERIALIZED VIEW mv_department_payroll_stats AS
SELECT 
    d.id AS department_id,
    d.name AS department_name,
    
    -- Employee counts
    COUNT(e.id) AS total_employees,
    COUNT(CASE WHEN e.status = 'active' THEN 1 END) AS active_employees,
    
    -- Salary aggregations
    SUM(e.ctc) AS total_annual_ctc,
    SUM(e.gross) AS total_monthly_gross,
    SUM(e.net) AS total_monthly_net,
    AVG(e.ctc) AS avg_annual_ctc,
    AVG(e.gross) AS avg_monthly_gross,
    AVG(e.net) AS avg_monthly_net,
    
    -- Computed metrics
    (SUM(e.net)::DECIMAL / NULLIF(SUM(e.gross), 0)) * 100 AS avg_take_home_percentage,
    SUM(e.ctc) / 12 AS monthly_ctc_cost,
    
    -- Statutory deductions
    SUM(e.pf_deduction) AS total_pf_monthly,
    SUM(e.esi_deduction) AS total_esi_monthly,
    SUM(e.professional_tax) AS total_pt_monthly,
    
    CURRENT_TIMESTAMP AS last_refreshed_at
    
FROM departments d
LEFT JOIN employees e ON d.id = e.department_id
WHERE d.is_active = true
GROUP BY d.id, d.name;
```

**Refresh Strategy**: After pay run processing or on-demand

---

### 11.5. Application-Level Calculations (Not Stored in DB)

**Frontend/API calculations** performed in application layer for dynamic data.

#### **Real-Time Calculations**

```typescript
// Age calculation (not stored - privacy concern)
const calculateAge = (dateOfBirth: Date): number => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

// Gratuity calculation (5 years+ tenure)
const calculateGratuity = (basicSalary: number, tenureMonths: number): number => {
    if (tenureMonths < 60) return 0; // Less than 5 years
    const years = Math.floor(tenureMonths / 12);
    return (basicSalary * 15 * years) / 26;
};

// Notice period remaining days
const calculateNoticePeriodRemaining = (resignationDate: Date, noticePeriodDays: number): number => {
    const today = new Date();
    const noticeEndDate = new Date(resignationDate);
    noticeEndDate.setDate(noticeEndDate.getDate() + noticePeriodDays);
    const diffTime = noticeEndDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};

// Probation completion percentage
const calculateProbationProgress = (joinDate: Date, probationMonths: number): number => {
    const today = new Date();
    const probationEndDate = new Date(joinDate);
    probationEndDate.setMonth(probationEndDate.getMonth() + probationMonths);
    
    const totalDays = (probationEndDate.getTime() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (today.getTime() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24);
    
    return Math.min(100, (elapsedDays / totalDays) * 100);
};
```

---

### 11.6. Summary: Computed Column Strategy

| Calculation Type | Count | Storage | Performance | Use Case | Consistency |
|-----------------|-------|---------|-------------|----------|-------------|
| **GENERATED (STORED)** | 23 | Physical | ⚡ Fastest | Simple expressions, self-contained | ✅ Always consistent |
| **Trigger-Calculated** | 15+ | Physical | ⚡ Fast | Complex logic, external data | ✅ Consistent on write |
| **View-Calculated** | 40+ | None | 🔄 Dynamic | Aggregations, cross-table | ✅ Always current |
| **Materialized View** | 3 | Physical (cached) | ⚡ Very fast | Heavy aggregations, reports | ⚠️ Refresh required |
| **Application-Level** | Many | None | 🔄 Runtime | User-specific, privacy, dynamic | ✅ Always current |

---

### 11.7. Performance Optimization Guidelines

#### **When to Use GENERATED Columns**

✅ **Good candidates**:
- Simple arithmetic (addition, subtraction, multiplication, division)
- String concatenation (full name from first + last)
- Boolean flags derived from status fields
- Percentage calculations using same-row data
- Self-contained expressions with no external lookups

❌ **Bad candidates**:
- Aggregations from child tables (use triggers)
- Lookups from other tables (use triggers or views)
- Complex conditional logic requiring functions
- Time-dependent calculations (age, tenure) - consider triggers

#### **When to Use Triggers**

✅ **Good candidates**:
- Salary calculations requiring system settings
- Denormalized fields for performance (employee_name copies)
- Sequential number generation
- Cross-table validations and updates
- Complex business rules

❌ **Bad candidates**:
- Simple arithmetic (use GENERATED)
- Read-only calculations (use views)
- Frequently changing values (use application layer)

#### **When to Use Views**

✅ **Good candidates**:
- Reporting and analytics
- Joining multiple tables
- Real-time aggregations
- User-specific data filtering
- Complex calculations not needed for writes

❌ **Bad candidates**:
- Heavy aggregations queried frequently (use materialized views)
- Calculations needed in WHERE clauses (use GENERATED or triggers)

#### **When to Use Materialized Views**

✅ **Good candidates**:
- Dashboard statistics
- Monthly/yearly aggregations
- Reports run frequently with same data
- Complex joins with large tables

❌ **Bad candidates**:
- Real-time data requirements
- Rapidly changing data
- User-specific calculations

---

### 11.8. Maintenance Considerations

#### **GENERATED Column Limitations**

```sql
-- ❌ Cannot do this (references other table)
NEW.department_name TEXT GENERATED ALWAYS AS (
    SELECT name FROM departments WHERE id = department_id
) STORED;

-- ✅ Use trigger instead
CREATE TRIGGER update_department_name_denormalized
BEFORE INSERT OR UPDATE OF department_id ON employees
FOR EACH ROW
EXECUTE FUNCTION sync_department_name();

-- ❌ Cannot do this (uses function)
NEW.age INTEGER GENERATED ALWAYS AS (
    calculate_age(date_of_birth)
) STORED;

-- ✅ Calculate in application or use trigger
```

#### **Index Strategy for Computed Columns**

```sql
-- Index GENERATED columns for query performance
CREATE INDEX idx_employees_full_name ON employees(full_name);
CREATE INDEX idx_employees_is_active ON employees(is_active) WHERE is_active = true;
CREATE INDEX idx_attendance_payable_days ON attendance_records(payable_days);
CREATE INDEX idx_loans_remaining_balance ON loan_records(remaining_balance) WHERE status = 'active';
```

#### **Materialized View Refresh Schedule**

```sql
-- Monthly (after attendance approval)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_attendance_ytd;

-- Monthly (after pay run processing)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_department_payroll_stats;

-- Weekly (for analytics)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_loan_aging_analysis;
```

---

**Total Computed Columns: 80+** across all calculation strategies, ensuring data consistency, performance optimization, and maintainability

---

## 12. Audit and Timestamps

The EcoVale HR System implements comprehensive audit and timestamp tracking across all tables to ensure data traceability, compliance, and accountability. This section documents the audit trail strategy, timestamp patterns, and change tracking mechanisms.

---

### 12.1. Standard Timestamp Columns

**All 20 tables** include standardized timestamp columns with automatic management.

#### **Universal Pattern**

```sql
-- Every table includes these audit fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
created_by UUID REFERENCES users(id) ON DELETE SET NULL,
updated_by UUID REFERENCES users(id) ON DELETE SET NULL
```

**Characteristics**:
- `created_at`: Set once at INSERT, never modified
- `updated_at`: Automatically updated on every UPDATE via trigger
- `created_by`: User who created the record (NULL if system-generated)
- `updated_by`: User who last modified the record (NULL after user deletion)

---

#### **Automatic Timestamp Update Trigger**

**Applied to all 20 tables** to maintain `updated_at` accuracy:

```sql
-- Universal trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each table
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ... repeated for all 20 tables
```

**Benefit**: Guarantees accurate timestamp even if application layer fails to set it.

---

### 12.2. Table-Specific Timestamp Columns

Beyond standard timestamps, many tables include workflow-specific timestamp fields:

#### **Approval Timestamps**

Tables with approval workflows track when records were approved:

```sql
-- attendance_records
approved_at TIMESTAMP,
approved_by UUID REFERENCES users(id) ON DELETE SET NULL,

-- pay_runs
approved_at TIMESTAMP,
approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
processed_at TIMESTAMP,
processed_by UUID REFERENCES users(id) ON DELETE SET NULL,

-- loan_records
approved_at TIMESTAMP,
approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
disbursed_at TIMESTAMP,
completed_at TIMESTAMP,

-- generated_letters
approved_at TIMESTAMP,
approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
sent_at TIMESTAMP,
sent_by UUID REFERENCES users(id) ON DELETE SET NULL,

-- bank_details
verified_at TIMESTAMP,
verified_by UUID REFERENCES users(id) ON DELETE SET NULL,

-- documents
verified_at TIMESTAMP,
verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

-- salary_annexures
sent_at TIMESTAMP,
sent_by UUID REFERENCES users(id) ON DELETE SET NULL
```

**Pattern**: `{action}_at` + `{action}_by` for full auditability

---

#### **Temporal Range Columns**

Tables tracking effective dates or validity periods:

```sql
-- career_history
effective_date DATE NOT NULL,
exit_date DATE,

-- employees
join_date DATE NOT NULL,
exit_date DATE,
date_of_birth DATE NOT NULL,
confirmation_date DATE,

-- documents
issue_date DATE,
expiry_date DATE,

-- system_settings
effective_from DATE,
effective_until DATE,

-- salary_annexures
issued_date DATE NOT NULL DEFAULT CURRENT_DATE,

-- sessions
expires_at TIMESTAMP NOT NULL
```

**Purpose**: Track when data is valid or when events occurred

---

### 12.3. Dedicated Audit Trail Table

The **audit_logs** table provides centralized change tracking for critical operations:

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id VARCHAR(255) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partitioned by month for performance
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

#### **Logged Actions**

| Action Type | Tables Logged | Trigger Event | Retention |
|-------------|---------------|---------------|-----------|
| `INSERT` | All sensitive tables | AFTER INSERT | 7 years |
| `UPDATE` | employees, pay_runs, loan_records, etc. | AFTER UPDATE | 7 years |
| `DELETE` | All tables except logs | AFTER DELETE | Permanent |
| `LOGIN` | users | Application level | 2 years |
| `LOGOUT` | users | Application level | 2 years |
| `APPROVE_PAYRUN` | pay_runs | Application level | Permanent |
| `DISBURSE_LOAN` | loan_records | Application level | Permanent |
| `SALARY_CHANGE` | employees | AFTER UPDATE OF ctc | Permanent |

---

#### **Audit Trigger Implementation**

```sql
-- Generic audit trigger function
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[];
BEGIN
    -- For DELETE operations
    IF (TG_OP = 'DELETE') THEN
        old_data := to_jsonb(OLD);
        INSERT INTO audit_logs (
            user_id,
            action,
            table_name,
            record_id,
            old_values,
            changed_fields
        ) VALUES (
            NULLIF(current_setting('app.current_user_id', true), '')::UUID,
            'DELETE',
            TG_TABLE_NAME,
            COALESCE(OLD.id::TEXT, OLD.employee_id::TEXT),
            old_data,
            ARRAY['*'] -- All fields
        );
        RETURN OLD;
    END IF;

    -- For INSERT operations
    IF (TG_OP = 'INSERT') THEN
        new_data := to_jsonb(NEW);
        INSERT INTO audit_logs (
            user_id,
            action,
            table_name,
            record_id,
            new_values,
            changed_fields
        ) VALUES (
            NULLIF(current_setting('app.current_user_id', true), '')::UUID,
            'INSERT',
            TG_TABLE_NAME,
            COALESCE(NEW.id::TEXT, NEW.employee_id::TEXT),
            new_data,
            ARRAY['*'] -- All fields
        );
        RETURN NEW;
    END IF;

    -- For UPDATE operations
    IF (TG_OP = 'UPDATE') THEN
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        
        -- Detect changed fields
        SELECT ARRAY_AGG(key)
        INTO changed_fields
        FROM jsonb_each(old_data)
        WHERE old_data->key IS DISTINCT FROM new_data->key;
        
        -- Only log if something actually changed
        IF array_length(changed_fields, 1) > 0 THEN
            INSERT INTO audit_logs (
                user_id,
                action,
                table_name,
                record_id,
                old_values,
                new_values,
                changed_fields
            ) VALUES (
                NULLIF(current_setting('app.current_user_id', true), '')::UUID,
                'UPDATE',
                TG_TABLE_NAME,
                COALESCE(NEW.id::TEXT, NEW.employee_id::TEXT),
                old_data,
                new_data,
                changed_fields
            );
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to sensitive tables
CREATE TRIGGER audit_employees_changes
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW
EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_pay_runs_changes
AFTER INSERT OR UPDATE OR DELETE ON pay_runs
FOR EACH ROW
EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_loan_records_changes
AFTER INSERT OR UPDATE OR DELETE ON loan_records
FOR EACH ROW
EXECUTE FUNCTION log_audit_trail();

-- ... applied to 15+ critical tables
```

---

### 12.4. Specialized Change Tracking Tables

Some domains require dedicated change history beyond the generic audit log:

#### **setting_change_history (System Configuration Audit)**

```sql
CREATE TABLE setting_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_id UUID NOT NULL REFERENCES system_settings(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT,
    ip_address VARCHAR(45),
    requires_restart BOOLEAN DEFAULT false
);

-- Automatically populated via trigger
CREATE TRIGGER log_setting_change
AFTER UPDATE OF setting_value ON system_settings
FOR EACH ROW
EXECUTE FUNCTION log_setting_change_to_history();
```

**Purpose**: Track every configuration change with reason and impact

---

#### **career_history (Employee Career Progression)**

```sql
CREATE TABLE career_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    
    -- Change tracking
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
        'promotion', 'transfer', 'demotion', 'designation_change', 'salary_increment'
    )),
    
    -- Old state
    old_designation_id UUID REFERENCES designations(id),
    old_designation_name VARCHAR(255),
    old_department_id UUID REFERENCES departments(id),
    old_department_name VARCHAR(255),
    old_ctc DECIMAL(12,2),
    old_effective_date DATE,
    
    -- New state
    new_designation_id UUID REFERENCES designations(id),
    new_designation_name VARCHAR(255),
    new_department_id UUID REFERENCES departments(id),
    new_department_name VARCHAR(255),
    new_ctc DECIMAL(12,2),
    
    -- Change metadata
    effective_date DATE NOT NULL,
    reason TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for employee history lookup
CREATE INDEX idx_career_history_employee ON career_history(employee_id, effective_date DESC);
```

**Purpose**: Full audit trail of all career movements and salary changes

---

### 12.5. Session and Authentication Tracking

#### **sessions (Login Activity)**

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Session lifecycle timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    invalidated_at TIMESTAMP,
    
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Track last activity
CREATE TRIGGER update_session_activity
BEFORE UPDATE ON sessions
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION update_last_activity();
```

**Purpose**: Track user authentication and session management

---

#### **users - Authentication Timestamps**

```sql
CREATE TABLE users (
    -- ... other columns ...
    
    -- Authentication tracking
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    password_changed_at TIMESTAMP,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Account lifecycle
    email_verified_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Update last login on successful authentication
CREATE OR REPLACE FUNCTION update_user_last_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users
    SET 
        last_login_at = CURRENT_TIMESTAMP,
        last_login_ip = NEW.ip_address,
        failed_login_attempts = 0,
        locked_until = NULL
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_successful_login
AFTER INSERT ON sessions
FOR EACH ROW
EXECUTE FUNCTION update_user_last_login();
```

---

### 12.6. Document Version Tracking

#### **documents (Version Chain)**

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Version tracking
    parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_latest_version BOOLEAN NOT NULL DEFAULT true,
    
    -- Lifecycle timestamps
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    issue_date DATE,
    expiry_date DATE,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Maintain version chain
CREATE TRIGGER manage_document_versions
BEFORE INSERT ON documents
FOR EACH ROW
WHEN (NEW.parent_document_id IS NOT NULL)
EXECUTE FUNCTION update_document_version_chain();

-- Function sets is_latest_version = false for old versions
```

**Purpose**: Track document revisions with full version history

---

### 12.7. Timestamp-Based Queries and Views

#### **Recent Activity View**

```sql
CREATE VIEW v_recent_activity AS
SELECT 
    'employee_created' AS activity_type,
    id AS record_id,
    full_name AS description,
    created_at AS activity_timestamp,
    created_by AS user_id
FROM employees
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'

UNION ALL

SELECT 
    'pay_run_processed' AS activity_type,
    id AS record_id,
    'Pay Run: ' || TO_CHAR(TO_DATE(year || '-' || month || '-01', 'YYYY-MM-DD'), 'Mon YYYY') AS description,
    processed_at AS activity_timestamp,
    processed_by AS user_id
FROM pay_runs
WHERE processed_at > CURRENT_TIMESTAMP - INTERVAL '30 days'

UNION ALL

SELECT 
    'loan_approved' AS activity_type,
    id AS record_id,
    'Loan: ' || loan_number || ' - ' || employee_name AS description,
    approved_at AS activity_timestamp,
    approved_by AS user_id
FROM loan_records
WHERE approved_at > CURRENT_TIMESTAMP - INTERVAL '30 days'

ORDER BY activity_timestamp DESC;
```

---

#### **User Activity Timeline**

```sql
CREATE VIEW v_user_activity_timeline AS
SELECT 
    al.user_id,
    u.full_name AS user_name,
    al.action,
    al.table_name,
    al.record_id,
    al.changed_fields,
    al.created_at,
    al.ip_address
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC;
```

---

#### **Salary Change History**

```sql
CREATE VIEW v_salary_change_history AS
SELECT 
    al.user_id AS changed_by_user_id,
    u.full_name AS changed_by_name,
    e.employee_id,
    e.full_name AS employee_name,
    (al.old_values->>'ctc')::DECIMAL AS old_ctc,
    (al.new_values->>'ctc')::DECIMAL AS new_ctc,
    (al.new_values->>'ctc')::DECIMAL - (al.old_values->>'ctc')::DECIMAL AS ctc_change,
    al.created_at AS changed_at,
    al.ip_address
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN employees e ON al.record_id = e.id::TEXT
WHERE al.table_name = 'employees'
  AND al.action = 'UPDATE'
  AND 'ctc' = ANY(al.changed_fields)
ORDER BY al.created_at DESC;
```

---

### 12.8. Data Retention and Archival Strategy

#### **Retention Policies by Table**

| Table | Retention Period | Archival Strategy | Compliance Requirement |
|-------|-----------------|-------------------|------------------------|
| **audit_logs** | 7 years | Monthly partitions, archive to cold storage | Legal/Tax |
| **sessions** | 90 days | Auto-delete expired sessions | Security best practice |
| **pay_runs** | Permanent | Never delete | Financial records |
| **payslips** | Permanent | Never delete | Labor law compliance |
| **employees** | Permanent (soft delete) | Mark as terminated, retain data | GDPR right to be forgotten after 7 years |
| **attendance_records** | 7 years | Archive old years | Labor law |
| **loan_records** | 7 years after completion | Archive completed loans | Financial records |
| **advance_records** | 7 years after recovery | Archive deducted advances | Financial records |
| **documents** | Until employee exit + 7 years | Archive with employee data | Document retention policy |
| **generated_letters** | Permanent | Keep for reference | Legal documents |
| **setting_change_history** | 5 years | Archive old changes | Audit compliance |
| **career_history** | Permanent | Keep for employee history | HR records |

---

#### **Automated Cleanup Jobs**

```sql
-- Job 1: Delete expired sessions (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM sessions
    WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    RAISE NOTICE 'Deleted % expired sessions', SQL%ROWCOUNT;
END;
$$ LANGUAGE plpgsql;

-- Job 2: Archive old audit logs (runs monthly)
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS void AS $$
BEGIN
    -- Move logs older than 2 years to archive table
    INSERT INTO audit_logs_archive
    SELECT * FROM audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '2 years';
    
    DELETE FROM audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '2 years';
    
    RAISE NOTICE 'Archived % audit log records', SQL%ROWCOUNT;
END;
$$ LANGUAGE plpgsql;

-- Job 3: Anonymize old employee data (GDPR compliance)
CREATE OR REPLACE FUNCTION anonymize_old_terminated_employees()
RETURNS void AS $$
BEGIN
    -- Anonymize employees terminated > 7 years ago
    UPDATE employees
    SET 
        personal_email = 'anonymized@gdpr.local',
        phone_number = 'ANONYMIZED',
        emergency_contact_name = 'ANONYMIZED',
        emergency_contact_phone = 'ANONYMIZED',
        current_address = 'ANONYMIZED',
        permanent_address = 'ANONYMIZED',
        date_of_birth = NULL,
        aadhaar_number = NULL,
        pan_number = NULL
    WHERE status = 'terminated'
      AND exit_date < CURRENT_DATE - INTERVAL '7 years'
      AND personal_email != 'anonymized@gdpr.local';
    
    RAISE NOTICE 'Anonymized % employee records', SQL%ROWCOUNT;
END;
$$ LANGUAGE plpgsql;
```

---

### 12.9. Audit Compliance Features

#### **Tamper-Proof Audit Logs**

```sql
-- Prevent modification or deletion of audit logs
CREATE POLICY audit_logs_immutable ON audit_logs
FOR UPDATE
USING (false); -- No updates allowed

CREATE POLICY audit_logs_no_delete ON audit_logs
FOR DELETE
USING (false); -- No deletes allowed (except by superuser)

-- Only allow INSERT
CREATE POLICY audit_logs_insert_only ON audit_logs
FOR INSERT
WITH CHECK (true);
```

---

#### **Critical Operation Logging**

Stored procedures for sensitive operations include automatic audit logging:

```sql
CREATE OR REPLACE FUNCTION approve_pay_run(
    p_pay_run_id UUID,
    p_approved_by UUID
)
RETURNS void AS $$
BEGIN
    -- Update pay run status
    UPDATE pay_runs
    SET 
        status = 'approved',
        approved_at = CURRENT_TIMESTAMP,
        approved_by = p_approved_by
    WHERE id = p_pay_run_id;
    
    -- Explicit audit log entry
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        new_values
    ) VALUES (
        p_approved_by,
        'APPROVE_PAYRUN',
        'pay_runs',
        p_pay_run_id::TEXT,
        jsonb_build_object(
            'approved_at', CURRENT_TIMESTAMP,
            'approved_by', p_approved_by
        )
    );
    
    RAISE NOTICE 'Pay run % approved by user %', p_pay_run_id, p_approved_by;
END;
$$ LANGUAGE plpgsql;
```

---

### 12.10. Timestamp Validation and Constraints

#### **Logical Timestamp Ordering**

```sql
-- Ensure approval happens after creation
ALTER TABLE pay_runs
ADD CONSTRAINT chk_pay_runs_approval_after_creation
CHECK (approved_at IS NULL OR approved_at >= created_at);

ALTER TABLE pay_runs
ADD CONSTRAINT chk_pay_runs_processing_after_approval
CHECK (processed_at IS NULL OR processed_at >= approved_at);

-- Ensure loan disbursement after approval
ALTER TABLE loan_records
ADD CONSTRAINT chk_loan_disbursement_after_approval
CHECK (disbursed_at IS NULL OR disbursed_at >= approved_at);

ALTER TABLE loan_records
ADD CONSTRAINT chk_loan_completion_after_disbursement
CHECK (completed_at IS NULL OR completed_at >= disbursed_at);

-- Document verification after upload
ALTER TABLE documents
ADD CONSTRAINT chk_document_verification_after_upload
CHECK (verified_at IS NULL OR verified_at >= uploaded_at);

-- Letter approval after generation
ALTER TABLE generated_letters
ADD CONSTRAINT chk_letter_approval_after_generation
CHECK (approved_at IS NULL OR approved_at >= created_at);

ALTER TABLE generated_letters
ADD CONSTRAINT chk_letter_sent_after_approval
CHECK (sent_at IS NULL OR sent_at >= approved_at);
```

---

### 12.11. Audit and Timestamp Summary

| Feature | Implementation | Tables Affected | Compliance Benefit |
|---------|---------------|-----------------|-------------------|
| **Standard Timestamps** | created_at, updated_at | All 20 tables | Change tracking |
| **User Attribution** | created_by, updated_by | All 20 tables | Accountability |
| **Approval Tracking** | approved_at, approved_by | 8 tables | Workflow audit |
| **Generic Audit Log** | audit_logs table | 15+ sensitive tables | Comprehensive change history |
| **Specialized History** | career_history, setting_change_history | 2 domains | Domain-specific audit |
| **Session Tracking** | sessions table | Authentication | Security monitoring |
| **Version Control** | documents versioning | documents | Change management |
| **Retention Policies** | Automated cleanup | All tables | GDPR, compliance |
| **Tamper Protection** | Row-level security | audit_logs | Audit integrity |
| **Timestamp Validation** | CHECK constraints | 10+ tables | Data integrity |

---

### 12.12. Best Practices and Recommendations

#### **Application-Level Integration**

```typescript
// Set current user context for audit triggers
await db.query("SET LOCAL app.current_user_id = $1", [userId]);

// Then perform operations - audit logs will capture user_id
await db.query("UPDATE employees SET ctc = $1 WHERE id = $2", [newCtc, employeeId]);

// Capture IP address in application
await db.query(
    "UPDATE users SET last_login_ip = $1 WHERE id = $2",
    [req.ip, userId]
);
```

#### **Query Audit Logs Efficiently**

```sql
-- Get recent changes by user
SELECT * FROM audit_logs
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC
LIMIT 100;

-- Get all changes to specific employee
SELECT * FROM audit_logs
WHERE table_name = 'employees'
  AND record_id = 'employee-uuid'
ORDER BY created_at DESC;

-- Get salary change history
SELECT 
    created_at,
    (old_values->>'ctc')::DECIMAL AS old_salary,
    (new_values->>'ctc')::DECIMAL AS new_salary
FROM audit_logs
WHERE table_name = 'employees'
  AND record_id = 'employee-uuid'
  AND 'ctc' = ANY(changed_fields)
ORDER BY created_at DESC;
```

#### **Performance Considerations**

- Partition `audit_logs` by month for large datasets
- Archive old audit data to separate tables
- Use asynchronous logging for high-volume operations
- Index frequently queried columns (user_id, table_name, created_at)

---

**Total Audit Coverage**: 20 tables with comprehensive timestamp tracking, 15+ tables with full audit logging, tamper-proof audit trail, GDPR-compliant data retention

---

## 13. Entity Relationships - EcoVale HR System

This section provides a comprehensive reference for all entity relationships in the EcoVale HR System, documenting cardinality, relationship types, referential actions, and business rules.

---

### 13.1. Relationship Types

The EcoVale HR System implements **four primary relationship patterns** to model business entities and their interactions.

---

#### **13.1.1. One-to-One (1:1) Relationships**

**Definition**: Each record in Table A is associated with exactly one record in Table B, and vice versa.

**Implementation**: Foreign key with UNIQUE constraint on the referencing column.

---

##### **Relationship 1: users ← → employees**

**Cardinality**: 1:1 (optional)

**Schema**:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    employee_id UUID UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
    -- ... other columns
);

-- Alternative implementation:
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    -- ... other columns
);
```

**Business Rules**:
- Not all employees have user accounts (e.g., contract workers, interns)
- Each user account is optionally linked to one employee record
- User can exist without employee (system admin, external auditor)
- Employee can exist without user (awaiting account creation)

**Use Cases**:
- Authenticate employee for HR portal access
- Link audit logs to employee records
- Determine user permissions based on employee designation/department

**Referential Action**: `ON DELETE SET NULL` - Deleting user doesn't delete employee, vice versa

---

##### **Relationship 2: employees → bank_details (Primary Account)**

**Cardinality**: 1:1 (mandatory for active employees)

**Schema**:
```sql
-- Enforced via partial unique index
CREATE UNIQUE INDEX idx_bank_primary_unique 
ON bank_details(employee_id) 
WHERE is_primary = true;
```

**Business Rules**:
- Each employee must have exactly one primary bank account for salary transfer
- Employee can have multiple bank accounts, but only one marked as primary
- Enforced through partial unique index + application validation
- Trigger ensures no duplicate primary accounts

**Use Cases**:
- Direct salary transfer via NEFT/RTGS
- Payslip bank details display
- PF/ESI account linking

**Referential Action**: `ON DELETE CASCADE` - Delete bank details when employee deleted

---

#### **13.1.2. One-to-Many (1:N) Relationships**

**Definition**: Each record in Table A (parent) can be associated with multiple records in Table B (child), but each record in B is associated with exactly one record in A.

**Implementation**: Foreign key in the "many" side table referencing the "one" side table.

---

##### **Domain: Organizational Structure**

**Relationship 3: departments → employees**

**Cardinality**: 1:N (mandatory)

```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    -- ... other columns
);
```

**Business Rules**:
- Each employee must belong to exactly one department
- A department can have zero to many employees
- Cannot delete department if employees exist (RESTRICT)
- Department head must be an employee of that department

**Statistics**: 1 department → 10-100 employees (typical)

**Use Cases**:
- Department-wise salary reports
- Organization chart generation
- Access control based on department
- Performance appraisal by department

---

**Relationship 4: departments → designations**

**Cardinality**: 1:N (mandatory)

```sql
CREATE TABLE designations (
    id UUID PRIMARY KEY,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    UNIQUE(title, department_id)
);
```

**Business Rules**:
- Each designation belongs to exactly one department
- Same title can exist in different departments (e.g., "Manager" in IT and HR)
- Cannot delete department with active designations
- Designation hierarchy maintained within department

**Statistics**: 1 department → 5-15 designations

---

**Relationship 5: designations → employees**

**Cardinality**: 1:N (mandatory)

```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    designation_id UUID NOT NULL REFERENCES designations(id) ON DELETE RESTRICT,
    -- ... other columns
);
```

**Business Rules**:
- Each employee has exactly one current designation
- A designation can be assigned to multiple employees
- Cannot delete designation if employees hold it
- Designation changes tracked in career_history

**Statistics**: 1 designation → 1-20 employees

---

##### **Domain: Employee Management**

**Relationship 6: employees → bank_details**

**Cardinality**: 1:N (at least 1 required)

```sql
CREATE TABLE bank_details (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false
);
```

**Business Rules**:
- Employee can have multiple bank accounts (salary, savings)
- Exactly one must be marked as primary (enforced by trigger + partial index)
- All bank details deleted when employee deleted

**Statistics**: 1 employee → 1-3 bank accounts

---

**Relationship 7: employees → documents**

**Cardinality**: 1:N (mandatory for onboarding)

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    verification_status VARCHAR(50) DEFAULT 'pending'
);
```

**Business Rules**:
- Each employee must upload mandatory documents (PAN, Aadhaar, etc.)
- Same document type can have multiple versions (tracked via parent_document_id)
- All documents deleted when employee deleted (CASCADE)
- Document verification required before confirmation

**Statistics**: 1 employee → 10-20 documents (average)

---

**Relationship 8: employees → career_history**

**Cardinality**: 1:N (0 for new joiners)

```sql
CREATE TABLE career_history (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    effective_date DATE NOT NULL
);
```

**Business Rules**:
- Tracks all promotions, transfers, salary increments
- New employees have no history initially
- Career events auto-update employee table when approved
- Complete audit trail of employee progression

**Statistics**: 1 employee → 0-20 career events (over tenure)

---

**Relationship 9: employees → salary_annexures**

**Cardinality**: 1:N (generated periodically)

```sql
CREATE TABLE salary_annexures (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    annexure_number VARCHAR(50) NOT NULL UNIQUE,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE
);
```

**Business Rules**:
- Generated when CTC changes or on annual basis
- Each employee can have multiple annexures (historical)
- Annexure deleted when employee deleted

**Statistics**: 1 employee → 2-5 annexures (over tenure)

---

##### **Domain: Attendance & Payroll**

**Relationship 10: employees → attendance_records**

**Cardinality**: 1:N (12 per year)

```sql
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    UNIQUE(employee_id, month, year)
);
```

**Business Rules**:
- One attendance record per employee per month
- Composite unique constraint prevents duplicates
- Approved attendance used for payroll calculation
- Deleted when employee deleted

**Statistics**: 1 employee → 12 records/year

---

**Relationship 11: pay_runs → pay_run_employee_records**

**Cardinality**: 1:N (employees in pay run)

```sql
CREATE TABLE pay_run_employee_records (
    id UUID PRIMARY KEY,
    pay_run_id UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT
);
```

**Business Rules**:
- One pay run contains records for all active employees
- Each record represents one employee's salary calculation
- Cannot delete employee if payroll history exists (RESTRICT)
- Pay run aggregates (total_gross, total_net) calculated from records

**Statistics**: 1 pay run → 50-500 employee records

**Referential Actions**:
- `ON DELETE CASCADE` for pay_run_id: Delete all records when pay run deleted
- `ON DELETE RESTRICT` for employee_id: Prevent employee deletion with payroll history

---

**Relationship 12: employees → payslips**

**Cardinality**: 1:N (12 per year)

```sql
CREATE TABLE payslips (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    salary_month INTEGER NOT NULL,
    salary_year INTEGER NOT NULL,
    payslip_number VARCHAR(100) NOT NULL UNIQUE,
    UNIQUE(employee_id, salary_month, salary_year)
);
```

**Business Rules**:
- One payslip per employee per month (unique constraint)
- Cannot delete employee with payslip history (RESTRICT - compliance)
- Payslips retained for 7+ years for tax/audit purposes
- Generated after pay run approval

**Statistics**: 1 employee → 12 payslips/year

---

##### **Domain: Advances & Loans**

**Relationship 13: employees → advance_records**

**Cardinality**: 1:N (as needed)

```sql
CREATE TABLE advance_records (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    advance_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL
);
```

**Business Rules**:
- Employee can take multiple advances (max 3 active simultaneously)
- Advance amount deducted from monthly salary
- Status: pending → partial → deducted
- All advances deleted when employee deleted

**Statistics**: 1 employee → 0-5 advances/year

---

**Relationship 14: employees → loan_records**

**Cardinality**: 1:N (as needed)

```sql
CREATE TABLE loan_records (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    guarantor_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    loan_number VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL
);
```

**Business Rules**:
- Employee can have multiple loans (max 2 active)
- Loan requires approval before disbursement
- EMI deducted monthly from salary
- Guarantor optional but recommended for large loans

**Statistics**: 1 employee → 0-3 loans (over tenure)

**Note**: Loan also has optional self-referencing relationship (guarantor)

---

**Relationship 15: loan_records → loan_emis**

**Cardinality**: 1:N (EMI schedule)

```sql
CREATE TABLE loan_emis (
    id UUID PRIMARY KEY,
    loan_id UUID NOT NULL REFERENCES loan_records(id) ON DELETE CASCADE,
    emi_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    UNIQUE(loan_id, emi_number)
);
```

**Business Rules**:
- One loan has N EMIs (number_of_emis)
- EMIs numbered sequentially (1, 2, 3, ...)
- EMI marked as paid when deducted from salary
- All EMIs deleted when loan deleted

**Statistics**: 1 loan → 6-120 EMIs

---

##### **Domain: Letter & Document Generation**

**Relationship 16: letter_templates → generated_letters**

**Cardinality**: 1:N (template usage)

```sql
CREATE TABLE generated_letters (
    id UUID PRIMARY KEY,
    template_id UUID REFERENCES letter_templates(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE
);
```

**Business Rules**:
- Each letter generated from a template
- Template can be used for multiple letters
- Letter retained even if template deleted (SET NULL)
- Letter number unique per type

**Statistics**: 1 template → 100-1000 letters generated

---

**Relationship 17: employees → generated_letters**

**Cardinality**: 1:N (letters issued)

```sql
CREATE TABLE generated_letters (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    letter_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL
);
```

**Business Rules**:
- Each letter issued to one employee
- Employee can receive multiple letters (offer, appointment, increment, etc.)
- Letters deleted when employee deleted
- Letter approval workflow: draft → pending_approval → approved → sent

**Statistics**: 1 employee → 5-15 letters (over tenure)

---

##### **Domain: User & Authentication**

**Relationship 18: users → sessions**

**Cardinality**: 1:N (active sessions)

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL
);
```

**Business Rules**:
- User can have multiple active sessions (web, mobile)
- Session auto-expires after 24 hours of inactivity
- All sessions deleted when user deleted
- Last activity tracked for session timeout

**Statistics**: 1 user → 1-3 concurrent sessions

---

**Relationship 19: users → audit_logs**

**Cardinality**: 1:N (activity tracking)

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL
);
```

**Business Rules**:
- All user actions logged
- Audit logs retained even if user deleted (SET NULL)
- Partitioned by month for performance
- Immutable records (no UPDATE/DELETE allowed)

**Statistics**: 1 user → 1000+ audit entries

---

##### **Domain: System Configuration**

**Relationship 20: system_settings → setting_change_history**

**Cardinality**: 1:N (change tracking)

```sql
CREATE TABLE setting_change_history (
    id UUID PRIMARY KEY,
    setting_id UUID NOT NULL REFERENCES system_settings(id) ON DELETE CASCADE,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Business Rules**:
- Every setting change logged automatically via trigger
- Complete audit trail of configuration changes
- Change history deleted when setting deleted
- Includes reason and changed_by user

**Statistics**: 1 setting → 10-50 changes (over time)

---

#### **13.1.3. Many-to-Many (M:N) Relationships**

**Definition**: Records in Table A can be associated with multiple records in Table B, and vice versa.

**Implementation**: Junction/bridge table with foreign keys to both tables.

---

##### **Relationship 21: employees ↔ departments (Historical via career_history)**

**Cardinality**: M:N (through career_history)

**Schema**:
```sql
-- Junction table: career_history
CREATE TABLE career_history (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    old_department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    new_department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    change_type VARCHAR(50) NOT NULL,
    effective_date DATE NOT NULL
);
```

**Business Rules**:
- Employee currently in one department (1:1 current relationship)
- Employee can move across departments over tenure (M:N historical)
- Career history tracks all department transfers
- Both old and new department references maintained

**Use Cases**:
- Track employee's complete department history
- Analyze inter-department mobility
- Report on departmental changes over time

**Statistics**: 1 employee → 2-5 departments (over 10-year tenure)

---

##### **Relationship 22: employees ↔ designations (Historical via career_history)**

**Cardinality**: M:N (through career_history)

**Schema**:
```sql
CREATE TABLE career_history (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    old_designation_id UUID REFERENCES designations(id) ON DELETE RESTRICT,
    new_designation_id UUID REFERENCES designations(id) ON DELETE RESTRICT,
    change_type VARCHAR(50) NOT NULL
);
```

**Business Rules**:
- Employee currently holds one designation (1:1 current)
- Employee can progress through multiple designations (M:N historical)
- Tracks promotions, demotions, lateral moves
- Cannot delete designation with historical references

**Use Cases**:
- Career progression analysis
- Promotion timeline tracking
- Succession planning

**Statistics**: 1 employee → 3-8 designations (over 10-year tenure)

---

##### **Relationship 23: employees ↔ pay_runs (via pay_run_employee_records)**

**Cardinality**: M:N (through pay_run_employee_records)

**Schema**:
```sql
-- Junction table: pay_run_employee_records
CREATE TABLE pay_run_employee_records (
    id UUID PRIMARY KEY,
    pay_run_id UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    gross_salary DECIMAL(12,2) NOT NULL,
    net_pay DECIMAL(12,2) NOT NULL
);
```

**Business Rules**:
- Each pay run includes many employees
- Each employee participates in multiple pay runs (monthly)
- Junction table stores employee-specific payroll data
- Cannot delete employee with payroll history (RESTRICT)

**Use Cases**:
- Monthly payroll processing
- Employee payroll history
- Department-wise salary rollup

**Statistics**: 1 pay run → 50-500 employees, 1 employee → 12 pay runs/year

---

##### **Relationship 24: letter_templates ↔ employees (via generated_letters)**

**Cardinality**: M:N (through generated_letters)

**Schema**:
```sql
-- Junction table: generated_letters
CREATE TABLE generated_letters (
    id UUID PRIMARY KEY,
    template_id UUID REFERENCES letter_templates(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    letter_number VARCHAR(100) NOT NULL UNIQUE,
    placeholders_data JSONB
);
```

**Business Rules**:
- One template used to generate letters for many employees
- One employee receives letters from multiple templates
- Template reference optional (SET NULL if template deleted)
- Each generated letter is unique with sequential number

**Use Cases**:
- Bulk letter generation (offer letters to multiple candidates)
- Employee-specific letter history
- Template usage analytics

**Statistics**: 1 template → 100-1000 letters, 1 employee → 5-15 letters

---

#### **13.1.4. Self-Referencing (Recursive) Relationships**

**Definition**: Table relates to itself, creating hierarchical or network structures.

**Implementation**: Foreign key referencing the same table's primary key.

---

##### **Relationship 25: employees → employees (Reporting Hierarchy)**

**Cardinality**: 1:N (manager-subordinate)

**Schema**:
```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    -- ... other columns
);

-- Prevent circular references
CREATE TRIGGER check_circular_reporting
BEFORE INSERT OR UPDATE OF reporting_manager_id ON employees
FOR EACH ROW
EXECUTE FUNCTION prevent_circular_manager_chain();
```

**Business Rules**:
- Each employee reports to at most one manager
- A manager can have multiple direct reports
- Manager departure sets reporting_manager_id to NULL
- Circular references prevented (A → B → C → A)
- Maximum hierarchy depth: 20 levels

**Use Cases**:
- Organization chart generation
- Approval workflow routing
- Manager-based access control
- Team hierarchy reports

**Query Example**:
```sql
-- Get all subordinates of a manager (recursive CTE)
WITH RECURSIVE subordinates AS (
    SELECT id, full_name, reporting_manager_id, 1 AS level
    FROM employees
    WHERE id = 'manager-uuid'
    
    UNION ALL
    
    SELECT e.id, e.full_name, e.reporting_manager_id, s.level + 1
    FROM employees e
    INNER JOIN subordinates s ON e.reporting_manager_id = s.id
    WHERE s.level < 20
)
SELECT * FROM subordinates;
```

**Statistics**: 1 manager → 5-15 direct reports

---

##### **Relationship 26: designations → designations (Designation Hierarchy)**

**Cardinality**: 1:N (reporting structure)

**Schema**:
```sql
CREATE TABLE designations (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    reporting_to_designation_id UUID REFERENCES designations(id) ON DELETE SET NULL,
    level INTEGER NOT NULL,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT
);

-- Prevent circular references
CREATE TRIGGER check_circular_designation_hierarchy
BEFORE INSERT OR UPDATE OF reporting_to_designation_id ON designations
FOR EACH ROW
EXECUTE FUNCTION prevent_circular_designation_chain();
```

**Business Rules**:
- Designation can report to another designation within same department
- Example: "Jr. Developer" → "Sr. Developer" → "Tech Lead" → "Engineering Manager"
- Level field indicates hierarchy depth (1 = top, increasing downward)
- Circular hierarchy prevented
- NULL reporting_to means top-level designation

**Use Cases**:
- Career path definition
- Promotion eligibility determination
- Organizational structure design
- Designation-based approval chains

**Query Example**:
```sql
-- Get complete designation hierarchy for a department
WITH RECURSIVE designation_tree AS (
    SELECT id, title, reporting_to_designation_id, level, 1 AS depth
    FROM designations
    WHERE reporting_to_designation_id IS NULL AND department_id = 'dept-uuid'
    
    UNION ALL
    
    SELECT d.id, d.title, d.reporting_to_designation_id, d.level, dt.depth + 1
    FROM designations d
    INNER JOIN designation_tree dt ON d.reporting_to_designation_id = dt.id
    WHERE dt.depth < 20
)
SELECT * FROM designation_tree ORDER BY depth, title;
```

**Statistics**: 5-7 levels in typical hierarchy

---

##### **Relationship 27: documents → documents (Version Control)**

**Cardinality**: 1:N (parent-child versions)

**Schema**:
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_latest_version BOOLEAN NOT NULL DEFAULT true
);

-- Automatic version management
CREATE TRIGGER manage_document_versions
BEFORE INSERT ON documents
FOR EACH ROW
WHEN (NEW.parent_document_id IS NOT NULL)
EXECUTE FUNCTION update_version_chain();
```

**Business Rules**:
- Document can have multiple versions (updated Aadhaar, renewed passport)
- parent_document_id links to previous version
- Only latest version marked with is_latest_version = true
- Version numbers increment automatically
- Old versions retained for audit

**Use Cases**:
- Document update history
- Compliance with document retention policies
- Audit trail for verification changes
- Rollback to previous document version

**Query Example**:
```sql
-- Get complete version history of a document
WITH RECURSIVE version_chain AS (
    SELECT id, parent_document_id, version, document_type, uploaded_at
    FROM documents
    WHERE id = 'document-uuid'
    
    UNION ALL
    
    SELECT d.id, d.parent_document_id, d.version, d.document_type, d.uploaded_at
    FROM documents d
    INNER JOIN version_chain vc ON vc.parent_document_id = d.id
)
SELECT * FROM version_chain ORDER BY version DESC;
```

**Statistics**: 1 document → 1-5 versions (over time)

---

##### **Relationship 28: loan_records → employees (Guarantor Relationship)**

**Cardinality**: N:1 (optional guarantor)

**Schema**:
```sql
CREATE TABLE loan_records (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    guarantor_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    loan_amount DECIMAL(12,2) NOT NULL
);
```

**Business Rules**:
- Loan borrower is an employee (employee_id)
- Guarantor is optionally another employee (guarantor_employee_id)
- One employee can be guarantor for multiple loans
- Guarantor departure doesn't invalidate loan (SET NULL)
- Guarantor cannot be same as borrower (CHECK constraint)

**Use Cases**:
- Risk assessment for large loans
- Guarantor notification for defaulted loans
- Loan approval workflow

**Query Example**:
```sql
-- Get all loans where employee is guarantor
SELECT 
    lr.loan_number,
    e.full_name AS borrower_name,
    lr.loan_amount,
    lr.status
FROM loan_records lr
INNER JOIN employees e ON lr.employee_id = e.id
WHERE lr.guarantor_employee_id = 'guarantor-employee-uuid';
```

**Statistics**: 1 employee → 0-5 loans guaranteed

---

### 13.1.5. Relationship Summary Table

| # | Parent Entity | Child Entity | Type | Cardinality | ON DELETE | Business Context |
|---|--------------|--------------|------|-------------|-----------|------------------|
| 1 | users | employees | 1:1 | Optional | SET NULL | Account linking |
| 2 | employees | bank_details (primary) | 1:1 | Mandatory | CASCADE | Salary transfer |
| 3 | departments | employees | 1:N | Mandatory | RESTRICT | Org structure |
| 4 | departments | designations | 1:N | Mandatory | RESTRICT | Role definition |
| 5 | designations | employees | 1:N | Mandatory | RESTRICT | Job assignment |
| 6 | employees | bank_details | 1:N | 1+ required | CASCADE | Banking info |
| 7 | employees | documents | 1:N | Mandatory | CASCADE | Verification |
| 8 | employees | career_history | 1:N | Optional | CASCADE | Progression tracking |
| 9 | employees | salary_annexures | 1:N | As needed | CASCADE | CTC documentation |
| 10 | employees | attendance_records | 1:N | Monthly | CASCADE | Attendance tracking |
| 11 | pay_runs | pay_run_employee_records | 1:N | Many | CASCADE | Payroll details |
| 12 | employees | payslips | 1:N | Monthly | RESTRICT | Payment records |
| 13 | employees | advance_records | 1:N | As needed | CASCADE | Advance management |
| 14 | employees | loan_records | 1:N | As needed | CASCADE | Loan management |
| 15 | loan_records | loan_emis | 1:N | Fixed | CASCADE | EMI schedule |
| 16 | letter_templates | generated_letters | 1:N | Usage | SET NULL | Letter generation |
| 17 | employees | generated_letters | 1:N | As needed | CASCADE | Letter issuance |
| 18 | users | sessions | 1:N | Concurrent | CASCADE | Authentication |
| 19 | users | audit_logs | 1:N | Activity | SET NULL | Audit trail |
| 20 | system_settings | setting_change_history | 1:N | Changes | CASCADE | Config audit |
| 21 | employees ↔ departments | career_history | M:N | Historical | CASCADE/RESTRICT | Transfer history |
| 22 | employees ↔ designations | career_history | M:N | Historical | CASCADE/RESTRICT | Promotion history |
| 23 | pay_runs ↔ employees | pay_run_employee_records | M:N | Monthly | CASCADE/RESTRICT | Payroll processing |
| 24 | letter_templates ↔ employees | generated_letters | M:N | Generated | SET NULL/CASCADE | Bulk letters |
| 25 | employees → employees | (self) | 1:N | Recursive | SET NULL | Reporting hierarchy |
| 26 | designations → designations | (self) | 1:N | Recursive | SET NULL | Career ladder |
| 27 | documents → documents | (self) | 1:N | Recursive | SET NULL | Version control |
| 28 | employees → employees (guarantor) | loan_records | N:1 | Optional | SET NULL | Loan guarantee |

**Total Relationships: 28 explicit relationships** across 20 tables

---

### 13.2. Core Entity Relationships

This section provides detailed relationship diagrams and flow charts for the core entities in the EcoVale HR System, organized by functional domain.

---

#### **13.2.1. Authentication & Authorization Domain**

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION DOMAIN                            │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │    users     │
    │──────────────│
    │ id (PK)      │───┐
    │ email        │   │ 1:1 (optional)
    │ username     │   │ ON DELETE SET NULL
    │ password     │   │
    │ role         │   │
    │ employee_id  │───┤
    └──────────────┘   │
           │           │
           │ 1:N       │
           │ CASCADE   │
           │           │
           ▼           │
    ┌──────────────┐  │
    │   sessions   │  │
    │──────────────│  │
    │ id (PK)      │  │
    │ user_id (FK) │  │
    │ token        │  │
    │ expires_at   │  │
    └──────────────┘  │
           │          │
           │ 1:N      │
           │ SET NULL │
           ▼          │
    ┌──────────────┐ │
    │ audit_logs   │ │
    │──────────────│ │
    │ id (PK)      │ │
    │ user_id (FK) │ │
    │ action       │ │
    │ table_name   │ │
    │ old_values   │ │
    │ new_values   │ │
    └──────────────┘ │
                     │
                     ▼
              ┌──────────────┐
              │  employees   │
              │──────────────│
              │ id (PK)      │
              │ full_name    │
              │ ...          │
              └──────────────┘
```

**Key Relationships**:
1. **users → sessions** (1:N, CASCADE): User can have multiple active sessions
2. **users → audit_logs** (1:N, SET NULL): All actions logged, retained after user deletion
3. **users ← → employees** (1:1, SET NULL): Optional account linking

**Authentication Flow**:
```
1. User login → Create session record
2. Session token validation → Check expires_at
3. User action → Log to audit_logs with user_id
4. User logout → Invalidate session (set is_active = false)
5. Session expiry → Auto-cleanup job deletes expired sessions
```

**Data Flow Example**:
```sql
-- Login creates session
INSERT INTO sessions (user_id, token, expires_at)
VALUES ('user-uuid', 'jwt-token', NOW() + INTERVAL '24 hours');

-- Update last login timestamp
UPDATE users SET last_login_at = NOW() WHERE id = 'user-uuid';

-- Log authentication event
INSERT INTO audit_logs (user_id, action, table_name)
VALUES ('user-uuid', 'LOGIN', 'users');
```

---

#### **13.2.2. Organizational Structure Domain**

```
┌─────────────────────────────────────────────────────────────────────┐
│                 ORGANIZATIONAL STRUCTURE                             │
└─────────────────────────────────────────────────────────────────────┘

                        ┌──────────────────┐
                        │   departments    │
                        │──────────────────│
                        │ id (PK)          │
                        │ name (UNIQUE)    │
                        │ head_employee_id │
                        │ is_active        │
                        └──────────────────┘
                             │      │
                   ┌─────────┘      └─────────┐
                   │ 1:N                  1:N │
                   │ RESTRICT          RESTRICT│
                   ▼                           ▼
        ┌──────────────────┐       ┌──────────────────┐
        │  designations    │       │   employees      │
        │──────────────────│       │──────────────────│
        │ id (PK)          │◄──────│ id (PK)          │
        │ title            │  1:N  │ full_name        │
        │ department_id(FK)│ RESTRICT│ department_id(FK)│
        │ level            │       │ designation_id(FK)│
        │ reporting_to (FK)│──┐    │ reporting_mgr(FK)│──┐
        └──────────────────┘  │    └──────────────────┘  │
               │              │           │               │
               └──────────────┘           └───────────────┘
               Self-reference             Self-reference
               (Designation Hierarchy)    (Manager Hierarchy)

                   Designation Example:
                   CEO (level 1)
                     └─ CTO (level 2)
                         ├─ Engineering Manager (level 3)
                         │   ├─ Tech Lead (level 4)
                         │   │   ├─ Senior Developer (level 5)
                         │   │   └─ Junior Developer (level 6)
                         │   └─ QA Lead (level 4)
                         └─ Product Manager (level 3)
```

**Key Relationships**:
1. **departments → designations** (1:N, RESTRICT): Department defines job roles
2. **departments → employees** (1:N, RESTRICT): Department contains employees
3. **designations → employees** (1:N, RESTRICT): Designation assigned to employees
4. **designations → designations** (self, 1:N, SET NULL): Career progression ladder
5. **employees → employees** (self, 1:N, SET NULL): Reporting structure

**Business Rules**:
- Department head must be an employee of that department
- Designation unique per department (composite unique: title + department_id)
- Designation hierarchy max 20 levels
- Employee reporting hierarchy max 20 levels
- Circular references prevented via triggers

**Hierarchy Traversal Query**:
```sql
-- Get complete reporting chain for an employee
WITH RECURSIVE reporting_chain AS (
    -- Start with the employee
    SELECT id, full_name, reporting_manager_id, 1 AS level
    FROM employees
    WHERE id = 'employee-uuid'
    
    UNION ALL
    
    -- Recursively get managers
    SELECT e.id, e.full_name, e.reporting_manager_id, rc.level + 1
    FROM employees e
    INNER JOIN reporting_chain rc ON e.id = rc.reporting_manager_id
    WHERE rc.level < 20
)
SELECT * FROM reporting_chain ORDER BY level DESC;
```

---

#### **13.2.3. Employee Core Data Domain**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      EMPLOYEE CORE DATA                              │
└─────────────────────────────────────────────────────────────────────┘

                    ┌────────────────────┐
                    │    employees       │
                    │────────────────────│
                    │ id (PK)            │
                    │ employee_id        │
                    │ full_name          │
                    │ department_id (FK) │
                    │ designation_id(FK) │
                    │ ctc, gross, net    │
                    │ status             │
                    └────────────────────┘
                         │    │    │
        ┌────────────────┼────┼────┼──────────────────┐
        │                │    │    │                  │
        │ 1:N            │    │    │                  │
        │ CASCADE        │    │    │                  │
        ▼                │    │    │                  │
┌────────────────┐       │    │    │          ┌──────────────────┐
│ bank_details   │       │    │    │          │ salary_annexures │
│────────────────│       │    │    │          │──────────────────│
│ id (PK)        │       │    │    │          │ id (PK)          │
│ employee_id(FK)│       │    │    │          │ employee_id (FK) │
│ account_number │       │    │    │          │ annexure_number  │
│ ifsc_code      │       │    │    │          │ ctc_amount       │
│ is_primary ⚡   │       │    │    │          │ issued_date      │
└────────────────┘       │    │    │          └──────────────────┘
  (Partial UNIQUE:       │    │    │
   one primary per emp)  │    │    │
                         │    │    └──────────────────┐
                    1:N  │    │ 1:N                   │ 1:N
                  CASCADE│    │ CASCADE           CASCADE
                         ▼    ▼                       ▼
                 ┌──────────────────┐       ┌──────────────────┐
                 │   documents      │       │ career_history   │
                 │──────────────────│       │──────────────────│
                 │ id (PK)          │       │ id (PK)          │
                 │ employee_id (FK) │       │ employee_id (FK) │
                 │ document_type    │       │ change_type      │
                 │ parent_doc_id(FK)│──┐    │ old_dept_id (FK) │
                 │ version          │  │    │ new_dept_id (FK) │
                 │ is_latest ⚡      │  │    │ old_desig_id(FK) │
                 └──────────────────┘  │    │ new_desig_id(FK) │
                        │              │    │ effective_date   │
                        └──────────────┘    └──────────────────┘
                        Self-reference
                        (Version Chain)

             Document Version Chain Example:
             Aadhaar v1 (2020) ──parent──► Aadhaar v2 (2023)
                                              └──► is_latest = true
```

**Key Relationships**:
1. **employees → bank_details** (1:N, CASCADE): Multiple bank accounts
   - Constraint: Exactly one primary account (partial unique index)
2. **employees → documents** (1:N, CASCADE): Employee verification documents
   - Self-referencing: Document version control
3. **employees → career_history** (1:N, CASCADE): Complete career progression
   - Links to old and new departments/designations
4. **employees → salary_annexures** (1:N, CASCADE): CTC breakdown documents

**Data Integrity Rules**:
```sql
-- Ensure only one primary bank account
CREATE UNIQUE INDEX idx_bank_primary_unique 
ON bank_details(employee_id) 
WHERE is_primary = true;

-- Trigger: Auto-update employees table when career event approved
CREATE TRIGGER apply_career_event_to_employee
AFTER UPDATE ON career_history
FOR EACH ROW
WHEN (NEW.approved_at IS NOT NULL AND OLD.approved_at IS NULL)
EXECUTE FUNCTION sync_career_change_to_employee();
```

**Career Change Flow**:
```
1. Create career_history record (status: pending)
2. Manager/HR approves → Set approved_at
3. Trigger fires → Update employees table:
   - designation_id = new_designation_id
   - department_id = new_department_id
   - ctc = new_ctc (if salary change)
4. Generate salary annexure if CTC changed
5. Create offer/promotion letter
```

---

#### **13.2.4. Attendance Management Domain**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ATTENDANCE MANAGEMENT                             │
└─────────────────────────────────────────────────────────────────────┘

         ┌────────────────────┐
         │    employees       │
         │────────────────────│
         │ id (PK)            │
         │ employee_id        │
         │ full_name          │
         └────────────────────┘
                  │
                  │ 1:N
                  │ CASCADE
                  ▼
         ┌────────────────────┐
         │ attendance_records │
         │────────────────────│
         │ id (PK)            │
         │ employee_id (FK)   │◄─────── UNIQUE(employee_id, month, year)
         │ month, year        │         One record per employee per month
         │ present_days       │
         │ absent_days        │
         │ paid_leave         │
         │ unpaid_leave       │
         │ ────────────────── │
         │ payable_days ⚡     │◄─────── GENERATED: present_days + paid_leave
         │ lop_days ⚡         │◄─────── GENERATED: absent_days + unpaid_leave
         │ ────────────────── │
         │ is_approved        │
         │ approved_by (FK)   │───┐
         │ approved_at        │   │ N:1 (optional)
         └────────────────────┘   │ SET NULL
                  │               │
                  │ Used by       │
                  ▼               ▼
         ┌────────────────────┐  ┌────────────┐
         │ pay_run_employee_  │  │   users    │
         │ records            │  │────────────│
         │────────────────────│  │ id (PK)    │
         │ id (PK)            │  │ full_name  │
         │ employee_id (FK)   │  └────────────┘
         │ payable_days       │   (Approver)
         │ lop_deduction      │
         └────────────────────┘

Monthly Attendance Flow:
┌─────────────────────────────────────────────────────────────────┐
│ 1. HR/Manager enters attendance for month                       │
│ 2. System auto-calculates:                                      │
│    - payable_days = present_days + paid_leave                   │
│    - lop_days = absent_days + unpaid_leave                      │
│ 3. Manager approves → is_approved = true, approved_at = NOW()   │
│ 4. Payroll processing:                                          │
│    - Fetch approved attendance                                  │
│    - Calculate: pro_rated_salary = (gross/30) * payable_days   │
│    - Calculate: lop_deduction = (gross/30) * lop_days          │
│ 5. Generate payslip with attendance breakdown                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Relationships**:
1. **employees → attendance_records** (1:N, CASCADE): Monthly attendance tracking
2. **users → attendance_records** (N:1, SET NULL): Approval tracking
3. **attendance_records → pay_run_employee_records**: Indirect (data flow)

**Business Rules**:
- Composite unique: (employee_id, month, year)
- Approval required before payroll processing
- GENERATED columns: payable_days, lop_days (auto-calculated)
- Attendance locked after payroll approval

**Validation Constraints**:
```sql
CHECK (present_days >= 0 AND present_days <= total_working_days)
CHECK (absent_days >= 0)
CHECK (paid_leave >= 0)
CHECK (unpaid_leave >= 0)
CHECK (is_approved = false OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
```

---

#### **13.2.5. Payroll Management Domain**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PAYROLL MANAGEMENT                              │
└─────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │    pay_runs      │
                         │──────────────────│
                         │ id (PK)          │
                         │ month, year      │◄───── UNIQUE(month, year)
                         │ status           │       One pay run per month
                         │ total_employees  │
                         │ total_gross      │
                         │ total_net_pay    │
                         │ ──────────────── │
                         │ generated_by(FK) │───┐
                         │ approved_by (FK) │───┤ N:1
                         │ processed_by(FK) │───┤ users
                         └──────────────────┘   │
                                 │              │
                           1:N   │              │
                         CASCADE │              │
                                 ▼              │
                    ┌──────────────────────┐   │
                    │pay_run_employee_     │   │
                    │records               │   │
                    │──────────────────────│   │
                    │ id (PK)              │   │
                    │ pay_run_id (FK)      │   │
                    │ employee_id (FK)     │───┤
                    │ ──────────────────── │   │
                    │ gross_salary         │   │
                    │ pf_deduction         │   │
                    │ esi_deduction        │   │
                    │ professional_tax     │   │
                    │ tds                  │   │
                    │ advance_deduction    │   │
                    │ loan_emi_deduction   │   │
                    │ ──────────────────── │   │
                    │ total_deductions ⚡   │   │◄── GENERATED
                    │ net_pay ⚡            │   │◄── GENERATED
                    └──────────────────────┘   │
                         │      │              │
                    1:1  │      │ 1:1          │
                 SET NULL│      │ CASCADE      │
                         │      │              │
                         ▼      ▼              ▼
              ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
              │   payslips   │ │  employees   │ │    users     │
              │──────────────│ │──────────────│ │──────────────│
              │ id (PK)      │ │ id (PK)      │ │ id (PK)      │
              │ payslip_num  │ │ full_name    │ │ full_name    │
              │ employee_id  │ │ department   │ │ role         │
              │ salary_month │ │ designation  │ └──────────────┘
              │ salary_year  │ │ gross, net   │
              │ gross_salary │ └──────────────┘
              │ net_pay      │
              └──────────────┘

Payroll Processing Workflow:
┌────────────────────────────────────────────────────────────────────┐
│ Status: draft → approved → processed                               │
├────────────────────────────────────────────────────────────────────┤
│ 1. DRAFT: Create pay_run for month/year                           │
│    - Fetch all active employees                                    │
│    - Fetch approved attendance records                             │
│    - Calculate gross, deductions, net for each employee            │
│    - Create pay_run_employee_records                               │
│    - Aggregate totals in pay_runs table                            │
│                                                                     │
│ 2. APPROVED: Finance/HR approves                                   │
│    - Set status = 'approved', approved_by, approved_at             │
│    - Lock attendance records for the month                         │
│    - Prevent further modifications                                 │
│                                                                     │
│ 3. PROCESSED: Generate payslips                                    │
│    - Create payslip record for each employee                       │
│    - Generate PDF payslip documents                                │
│    - Send email notifications                                      │
│    - Mark advance/loan installments as paid                        │
│    - Set status = 'processed', processed_by, processed_at          │
│                                                                     │
│ 4. POST-PROCESSING:                                                │
│    - Bank transfer file generation (NEFT/RTGS)                     │
│    - Statutory reports (PF/ESI challan, TDS returns)               │
│    - Accounting entries                                            │
└────────────────────────────────────────────────────────────────────┘
```

**Key Relationships**:
1. **pay_runs → pay_run_employee_records** (1:N, CASCADE): Detailed salary breakdown
2. **employees → pay_run_employee_records** (1:N, RESTRICT): Employee payroll history
3. **pay_run_employee_records → payslips** (1:1, SET NULL): Payslip generation
4. **employees → payslips** (1:N, RESTRICT): Employee payslip archive

**Business Rules**:
- One pay run per month (UNIQUE: month, year)
- One payslip per employee per month (UNIQUE: employee_id, salary_month, salary_year)
- Status workflow enforced: draft → approved → processed (no backward transitions)
- Cannot delete employees with payroll history (RESTRICT)
- Aggregated totals in pay_runs auto-updated via triggers

**Calculation Logic**:
```sql
-- GENERATED columns in pay_run_employee_records
total_deductions = pf + esi + pt + tds + advance + loan_emi + other
net_pay = gross_salary - total_deductions

-- Trigger: Update pay_runs aggregates when records change
CREATE TRIGGER update_pay_run_totals
AFTER INSERT OR UPDATE OR DELETE ON pay_run_employee_records
FOR EACH ROW
EXECUTE FUNCTION recalculate_pay_run_aggregates();
```

---

#### **13.2.6. Advance & Loan Management Domain**

```
┌─────────────────────────────────────────────────────────────────────┐
│               ADVANCE & LOAN MANAGEMENT                              │
└─────────────────────────────────────────────────────────────────────┘

                   ┌────────────────────┐
                   │    employees       │
                   │────────────────────│
                   │ id (PK)            │
                   │ full_name          │
                   │ monthly_gross      │
                   └────────────────────┘
                      │             │
            ┌─────────┘             └─────────┐
            │ 1:N                          1:N│
            │ CASCADE                   CASCADE│
            ▼                                  ▼
   ┌─────────────────────┐       ┌─────────────────────────┐
   │ advance_records     │       │   loan_records          │
   │─────────────────────│       │─────────────────────────│
   │ id (PK)             │       │ id (PK)                 │
   │ employee_id (FK)    │       │ employee_id (FK)        │
   │ advance_number      │       │ guarantor_emp_id (FK)   │◄─┐
   │ advance_paid_amt    │       │ loan_number             │  │
   │ installments        │       │ loan_amount             │  │
   │ ─────────────────── │       │ interest_rate           │  │
   │ installment_amt ⚡   │       │ number_of_emis          │  │
   │ amount_deducted     │       │ ─────────────────────── │  │
   │ remaining_amount ⚡  │       │ interest_amount ⚡       │  │
   │ ─────────────────── │       │ total_amount ⚡          │  │
   │ status              │       │ emi_amount ⚡            │  │
   │ approved_by (FK)    │──┐    │ total_paid_emis         │  │
   └─────────────────────┘  │    │ remaining_emis ⚡        │  │
                            │    │ remaining_balance ⚡      │  │
     Status Flow:           │    │ ─────────────────────── │  │
     pending → partial →    │    │ status                  │  │
     deducted               │    │ approved_by (FK)        │──┤
                            │    │ disbursed_at            │  │
                            │    └─────────────────────────┘  │
                            │              │                  │
                            │              │ 1:N              │
                            │              │ CASCADE          │
                            │              ▼                  │
                            │    ┌─────────────────────┐     │
                            │    │    loan_emis        │     │
                            │    │─────────────────────│     │
                            │    │ id (PK)             │     │
                            │    │ loan_id (FK)        │     │
                            │    │ emi_number          │     │
                            │    │ emi_amount          │     │
                            │    │ due_date            │     │
                            │    │ paid_date           │     │
                            │    │ is_paid             │     │
                            │    └─────────────────────┘     │
                            │                                │
                            └────────────────┬───────────────┘
                                             │ N:1
                                             │ SET NULL
                                             ▼
                                    ┌────────────────┐
                                    │     users      │
                                    │────────────────│
                                    │ id (PK)        │
                                    │ full_name      │
                                    │ role           │
                                    └────────────────┘
                                      (Approver)

Loan Processing Flow:
┌────────────────────────────────────────────────────────────────────┐
│ 1. PENDING: Employee applies for loan                              │
│    - Enter loan_amount, number_of_emis, interest_rate              │
│    - System calculates:                                            │
│      * interest_amount = loan_amount * interest_rate / 100         │
│      * total_amount = loan_amount + interest_amount                │
│      * emi_amount = total_amount / number_of_emis                  │
│    - Status = 'pending'                                            │
│                                                                     │
│ 2. APPROVED: Manager/HR approves                                   │
│    - Set approved_by, approved_at                                  │
│    - Status = 'approved'                                           │
│                                                                     │
│ 3. DISBURSED: Finance disburses amount                             │
│    - Generate EMI schedule (loan_emis records)                     │
│    - For each EMI:                                                 │
│      * emi_number = 1 to number_of_emis                            │
│      * due_date = disbursed_at + (emi_number * 1 month)            │
│      * is_paid = false                                             │
│    - Set disbursed_at                                              │
│    - Status = 'active'                                             │
│                                                                     │
│ 4. ACTIVE: Monthly EMI deduction                                   │
│    - During payroll processing:                                    │
│      * Fetch unpaid EMIs with due_date <= current_month            │
│      * Deduct emi_amount from salary                               │
│      * Mark EMI as paid (is_paid = true, paid_date = NOW())        │
│      * Update total_paid_emis++                                    │
│      * Update remaining_balance (auto via GENERATED column)        │
│    - Continue until all EMIs paid                                  │
│                                                                     │
│ 5. COMPLETED: All EMIs paid                                        │
│    - When total_paid_emis = number_of_emis                         │
│    - Set completed_at, status = 'completed'                        │
└────────────────────────────────────────────────────────────────────┘

Advance Processing (Simpler):
┌────────────────────────────────────────────────────────────────────┐
│ - No interest calculation                                          │
│ - installment_amount = advance_paid_amount / installments          │
│ - Deducted monthly during payroll                                  │
│ - remaining_amount = advance_paid_amount - amount_deducted         │
│ - Status: pending → partial → deducted                             │
└────────────────────────────────────────────────────────────────────┘
```

**Key Relationships**:
1. **employees → advance_records** (1:N, CASCADE): Employee advance requests
2. **employees → loan_records** (1:N, CASCADE): Employee loan applications
3. **employees → loan_records** (N:1, SET NULL): Guarantor relationship (self-reference)
4. **loan_records → loan_emis** (1:N, CASCADE): EMI schedule breakdown
5. **users → advance_records/loan_records** (N:1, SET NULL): Approval tracking

**Business Rules**:
- Max 3 active advances per employee
- Max 2 active loans per employee
- Loan guarantor must be a different employee
- Advance limit: 3x monthly gross
- Loan limit: 10x monthly gross (for large loans)
- EMI deduction priority: PF > ESI > PT > Advance > Loan > TDS

**GENERATED Column Calculations**:
```sql
-- advance_records
installment_amount = advance_paid_amount / installments
remaining_amount = advance_paid_amount - amount_deducted

-- loan_records
interest_amount = loan_amount * interest_rate / 100
total_amount = loan_amount + interest_amount
emi_amount = total_amount / number_of_emis
remaining_balance = total_amount - total_paid_amount
remaining_emis = number_of_emis - total_paid_emis
completion_percentage = (total_paid_emis / number_of_emis) * 100
```

---

#### **13.2.7. Letter & Document Generation Domain**

```
┌─────────────────────────────────────────────────────────────────────┐
│             LETTER & DOCUMENT GENERATION                             │
└─────────────────────────────────────────────────────────────────────┘

        ┌────────────────────────┐
        │  letter_templates      │
        │────────────────────────│
        │ id (PK)                │
        │ template_code (UNIQUE) │
        │ template_type          │◄──── 15 types: offer_letter,
        │ template_name          │      appointment_letter, etc.
        │ version                │
        │ content                │
        │ placeholders JSONB     │
        │ is_default             │◄──── Only one default per type
        └────────────────────────┘      (partial unique index)
                  │
                  │ 1:N
                  │ SET NULL
                  ▼
        ┌────────────────────────┐
        │  generated_letters     │
        │────────────────────────│         ┌────────────────────┐
        │ id (PK)                │◄────────│    employees       │
        │ template_id (FK)       │   1:N   │────────────────────│
        │ employee_id (FK)       │─────────│ id (PK)            │
        │ letter_number (UNIQUE) │ CASCADE │ full_name          │
        │ letter_type            │         └────────────────────┘
        │ placeholders_data JSONB│
        │ ────────────────────── │
        │ status                 │◄──── Status Flow:
        │ generated_by (FK)      │───┐   draft → pending_approval →
        │ approved_by (FK)       │───┤   approved → sent
        │ sent_by (FK)           │───┤
        │ ────────────────────── │   │ N:1
        │ is_sent                │   │ SET NULL
        │ sent_at                │   │
        │ sent_to_email          │   ▼
        │ file_path              │  ┌────────────┐
        │ file_format            │  │   users    │
        │ is_digitally_signed    │  │────────────│
        └────────────────────────┘  │ id (PK)    │
                                    │ full_name  │
                                    └────────────┘

Letter Number Format (auto-generated):
OFR/2024/000001  → Offer Letter
APT/2024/000042  → Appointment Letter
CNF/2024/000123  → Confirmation Letter
PRO/2024/000015  → Promotion Letter
INC/2024/000089  → Increment Letter
REL/2024/000003  → Relieving Letter
EXP/2024/000007  → Experience Certificate

Letter Generation Workflow:
┌────────────────────────────────────────────────────────────────────┐
│ 1. DRAFT: Create letter from template                             │
│    - Select template (or use default for type)                     │
│    - Select employee                                               │
│    - Generate letter_number (type/year/sequence)                   │
│    - Populate placeholders_data from employee record:              │
│      {                                                             │
│        "employee_name": "John Doe",                                │
│        "designation": "Senior Developer",                          │
│        "department": "Engineering",                                │
│        "ctc": "1200000",                                           │
│        "join_date": "2024-02-01",                                  │
│        ...                                                         │
│      }                                                             │
│    - Render template with placeholders                             │
│    - Status = 'draft'                                              │
│                                                                     │
│ 2. PENDING_APPROVAL: Submit for approval                           │
│    - HR/Manager reviews letter content                             │
│    - Status = 'pending_approval'                                   │
│                                                                     │
│ 3. APPROVED: Approve letter                                        │
│    - Set approved_by, approved_at                                  │
│    - Generate PDF with letterhead                                  │
│    - Add digital signature (if enabled)                            │
│    - Status = 'approved'                                           │
│                                                                     │
│ 4. SENT: Send to employee                                          │
│    - Email PDF to employee                                         │
│    - Record: sent_at, sent_to_email, sent_by                       │
│    - Track: email_opened_count, download_count                     │
│    - Status = 'sent'                                               │
└────────────────────────────────────────────────────────────────────┘

Bulk Letter Generation:
┌────────────────────────────────────────────────────────────────────┐
│ Use Case: Generate offer letters for 50 selected candidates       │
│                                                                     │
│ 1. Select template: "Offer Letter (Standard)"                     │
│ 2. Select employees: Bulk select 50 candidates                    │
│ 3. System generates:                                               │
│    - 50 generated_letters records                                  │
│    - Unique letter_number for each (OFR/2024/000100 - 000149)     │
│    - Each with employee-specific placeholders_data                 │
│    - All with status = 'draft'                                     │
│ 4. Batch review and approve                                        │
│ 5. Bulk send via email                                             │
└────────────────────────────────────────────────────────────────────┘
```

**Key Relationships**:
1. **letter_templates → generated_letters** (1:N, SET NULL): Template reuse
2. **employees → generated_letters** (1:N, CASCADE): Employee letters archive
3. **users → generated_letters** (N:1, SET NULL): Workflow tracking (generated_by, approved_by, sent_by)

**Business Rules**:
- One default template per letter type (partial unique index)
- Unique letter_number across all types
- Letter cannot be edited after approval
- Letter retained even if template deleted (SET NULL)
- Placeholders validated against employee data
- Status transitions: draft → pending_approval → approved → sent (no backward)

---

#### **13.2.8. System Configuration Domain**

```
┌─────────────────────────────────────────────────────────────────────┐
│                  SYSTEM CONFIGURATION                                │
└─────────────────────────────────────────────────────────────────────┘

        ┌─────────────────────────┐
        │   system_settings       │
        │─────────────────────────│
        │ id (PK)                 │
        │ setting_key (UNIQUE)    │
        │ setting_value           │
        │ setting_type            │◄──── string, number, boolean,
        │ setting_category        │      json, date, email
        │ default_value           │
        │ validation_regex        │
        │ min_value, max_value    │
        │ allowed_values TEXT[]   │
        │ is_editable             │
        │ is_sensitive            │◄──── Hide password, API keys
        │ updated_by (FK)         │───┐
        └─────────────────────────┘   │ N:1
                  │                   │ SET NULL
                  │ 1:N               │
                  │ CASCADE           │
                  ▼                   ▼
        ┌─────────────────────────┐  ┌────────────┐
        │ setting_change_history  │  │   users    │
        │─────────────────────────│  │────────────│
        │ id (PK)                 │  │ id (PK)    │
        │ setting_id (FK)         │  │ full_name  │
        │ setting_key             │  │ role       │
        │ old_value               │  └────────────┘
        │ new_value               │
        │ changed_by (FK)         │───┘
        │ changed_at              │
        │ change_reason           │
        │ ip_address              │
        └─────────────────────────┘

System Settings Categories (80+ settings):
┌────────────────────────────────────────────────────────────────────┐
│ PAYROLL (9 settings)                                               │
│ ├─ pf_employee_rate: 12%                                           │
│ ├─ pf_employer_rate: 12%                                           │
│ ├─ esi_employee_rate: 0.75%                                        │
│ ├─ esi_employer_rate: 3.25%                                        │
│ ├─ basic_percentage: 50%                                           │
│ ├─ professional_tax_monthly: 200                                   │
│ └─ ...                                                             │
│                                                                     │
│ COMPANY (11 settings)                                              │
│ ├─ company_name: "EcoVale Pvt Ltd"                                 │
│ ├─ company_pan: "AAAAA1111A"                                       │
│ ├─ pf_establishment_code: "GJ/AHD/12345"                           │
│ └─ ...                                                             │
│                                                                     │
│ ATTENDANCE (6 settings)                                            │
│ ├─ working_hours_per_day: 8                                        │
│ ├─ grace_period_minutes: 15                                        │
│ └─ ...                                                             │
│                                                                     │
│ ... (9 total categories, 80+ settings)                             │
└────────────────────────────────────────────────────────────────────┘

Setting Change Flow:
┌────────────────────────────────────────────────────────────────────┐
│ 1. User updates setting value                                      │
│    - Validate against setting_type, min/max, regex, allowed_values │
│    - Check is_editable = true                                      │
│                                                                     │
│ 2. Trigger fires: log_setting_change                               │
│    - Insert into setting_change_history:                           │
│      * old_value, new_value                                        │
│      * changed_by, changed_at                                      │
│      * change_reason (if provided)                                 │
│      * ip_address                                                  │
│                                                                     │
│ 3. Update system_settings:                                         │
│    - setting_value = new_value                                     │
│    - updated_by, updated_at                                        │
│                                                                     │
│ 4. If requires_restart = true:                                     │
│    - Show notification: "System restart required"                  │
│    - Cache invalidation                                            │
└────────────────────────────────────────────────────────────────────┘
```

**Key Relationships**:
1. **system_settings → setting_change_history** (1:N, CASCADE): Complete audit trail
2. **users → system_settings** (N:1, SET NULL): Last updater tracking
3. **users → setting_change_history** (N:1, SET NULL): Change attribution

**Business Rules**:
- Unique setting_key across all categories
- Validation enforced: regex, min/max, allowed_values, data type
- Non-editable settings (is_editable = false) protected from updates
- Sensitive settings (is_sensitive = true) hidden in UI
- All changes automatically logged via trigger
- Temporal settings: effective_from, effective_until for scheduled changes

---

**Total Core Relationships Documented**: 8 functional domains, 28 explicit relationships, covering all 20 tables with complete data flow diagrams and business rules.

---

### 13.3. Relationship Matrix

Comprehensive matrix showing all foreign key relationships, cardinality, referential actions, and implementation details.

---

#### **13.3.1. Complete Foreign Key Matrix**

| # | Child Table | Child Column | Parent Table | Parent Column | Cardinality | ON DELETE | ON UPDATE | Index | Business Purpose |
|---|-------------|--------------|--------------|---------------|-------------|-----------|-----------|-------|------------------|
| **Authentication Domain** |
| 1 | sessions | user_id | users | id | N:1 | CASCADE | CASCADE | ✓ | User session tracking |
| 2 | audit_logs | user_id | users | id | N:1 | SET NULL | CASCADE | ✓ | Action attribution |
| 3 | users | employee_id | employees | id | 1:1 | SET NULL | CASCADE | ✓ | Account-employee link |
| **Organizational Structure** |
| 4 | departments | head_employee_id | employees | id | N:1 | SET NULL | CASCADE | ✓ | Department leadership |
| 5 | designations | department_id | departments | id | N:1 | RESTRICT | CASCADE | ✓ | Role department assignment |
| 6 | designations | reporting_to_designation_id | designations | id | N:1 | SET NULL | CASCADE | ✓ | Designation hierarchy |
| 7 | employees | department_id | departments | id | N:1 | RESTRICT | CASCADE | ✓ | Employee department |
| 8 | employees | designation_id | designations | id | N:1 | RESTRICT | CASCADE | ✓ | Employee role |
| 9 | employees | reporting_manager_id | employees | id | N:1 | SET NULL | CASCADE | ✓ | Reporting structure |
| **Employee Core Data** |
| 10 | bank_details | employee_id | employees | id | N:1 | CASCADE | CASCADE | ✓ | Bank account ownership |
| 11 | documents | employee_id | employees | id | N:1 | CASCADE | CASCADE | ✓ | Document ownership |
| 12 | documents | parent_document_id | documents | id | N:1 | SET NULL | CASCADE | ✓ | Version control |
| 13 | career_history | employee_id | employees | id | N:1 | CASCADE | CASCADE | ✓ | Career tracking |
| 14 | career_history | old_designation_id | designations | id | N:1 | RESTRICT | CASCADE | ✓ | Previous designation |
| 15 | career_history | new_designation_id | designations | id | N:1 | RESTRICT | CASCADE | ✓ | New designation |
| 16 | career_history | old_department_id | departments | id | N:1 | RESTRICT | CASCADE | ✓ | Previous department |
| 17 | career_history | new_department_id | departments | id | N:1 | RESTRICT | CASCADE | ✓ | New department |
| 18 | salary_annexures | employee_id | employees | id | N:1 | CASCADE | CASCADE | ✓ | Annexure ownership |
| 19 | salary_annexures | generated_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Generator tracking |
| **Attendance Management** |
| 20 | attendance_records | employee_id | employees | id | N:1 | CASCADE | CASCADE | ✓ | Attendance ownership |
| 21 | attendance_records | approved_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Approval tracking |
| **Payroll Management** |
| 22 | pay_runs | generated_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Pay run creator |
| 23 | pay_runs | approved_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Pay run approver |
| 24 | pay_runs | processed_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Pay run processor |
| 25 | pay_run_employee_records | pay_run_id | pay_runs | id | N:1 | CASCADE | CASCADE | ✓ | Pay run detail |
| 26 | pay_run_employee_records | employee_id | employees | id | N:1 | RESTRICT | CASCADE | ✓ | Employee payroll record |
| 27 | payslips | employee_id | employees | id | N:1 | RESTRICT | CASCADE | ✓ | Payslip ownership |
| 28 | payslips | pay_run_employee_record_id | pay_run_employee_records | id | 1:1 | SET NULL | CASCADE | ✓ | Source record link |
| **Advance & Loan Management** |
| 29 | advance_records | employee_id | employees | id | N:1 | CASCADE | CASCADE | ✓ | Advance ownership |
| 30 | advance_records | approved_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Advance approver |
| 31 | advance_records | deducted_from_pay_run_id | pay_runs | id | N:1 | SET NULL | CASCADE | ✓ | Deduction tracking |
| 32 | loan_records | employee_id | employees | id | N:1 | CASCADE | CASCADE | ✓ | Loan ownership |
| 33 | loan_records | guarantor_employee_id | employees | id | N:1 | SET NULL | CASCADE | ✓ | Loan guarantor |
| 34 | loan_records | approved_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Loan approver |
| 35 | loan_records | disbursed_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Disbursement tracking |
| 36 | loan_emis | loan_id | loan_records | id | N:1 | CASCADE | CASCADE | ✓ | EMI schedule |
| **Letter & Document Generation** |
| 37 | letter_templates | created_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Template creator |
| 38 | letter_templates | updated_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Template updater |
| 39 | generated_letters | template_id | letter_templates | id | N:1 | SET NULL | CASCADE | ✓ | Template source |
| 40 | generated_letters | employee_id | employees | id | N:1 | CASCADE | CASCADE | ✓ | Letter recipient |
| 41 | generated_letters | generated_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Letter generator |
| 42 | generated_letters | approved_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Letter approver |
| 43 | generated_letters | sent_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Letter sender |
| **System Configuration** |
| 44 | system_settings | updated_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Setting updater |
| 45 | setting_change_history | setting_id | system_settings | id | N:1 | CASCADE | CASCADE | ✓ | Change tracking |
| 46 | setting_change_history | changed_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Change attribution |
| 47 | bank_details | verified_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Verification tracking |
| 48 | documents | verified_by | users | id | N:1 | SET NULL | CASCADE | ✓ | Document verification |

**Total Foreign Keys**: 48 relationships across 20 tables

---

#### **13.3.2. Cardinality Distribution**

| Cardinality Type | Count | Percentage | Tables Involved |
|-----------------|-------|------------|-----------------|
| **Many-to-One (N:1)** | 46 | 95.8% | Most relationships |
| **One-to-One (1:1)** | 2 | 4.2% | users↔employees, payslips↔pay_run_employee_records |
| **Many-to-Many (M:N)** | 4* | - | Via junction tables (career_history, pay_run_employee_records, generated_letters) |

*M:N relationships implemented through junction tables with two N:1 relationships each

---

#### **13.3.3. ON DELETE Action Distribution**

| Action | Count | Percentage | Use Case |
|--------|-------|------------|----------|
| **SET NULL** | 24 | 50.0% | Optional references, audit trail preservation |
| **CASCADE** | 17 | 35.4% | Dependent data deletion |
| **RESTRICT** | 7 | 14.6% | Critical master data protection |

**SET NULL Examples**: User actions retained after user deletion, manager hierarchy preserved after manager leaves

**CASCADE Examples**: Employee documents deleted with employee, session deleted with user

**RESTRICT Examples**: Cannot delete department with employees, cannot delete designation in use

---

#### **13.3.4. Self-Referencing Relationships**

| Table | Column | Purpose | Max Depth | Circular Prevention |
|-------|--------|---------|-----------|---------------------|
| employees | reporting_manager_id | Manager hierarchy | 20 levels | Trigger: check_circular_reporting() |
| designations | reporting_to_designation_id | Career ladder | 20 levels | Trigger: check_circular_designation_hierarchy() |
| documents | parent_document_id | Version control | Unlimited | Natural: Version chain is linear |
| loan_records | guarantor_employee_id | Loan guarantee | N/A | Check: guarantor ≠ borrower |

**Circular Reference Prevention Example**:
```sql
CREATE OR REPLACE FUNCTION check_circular_reporting()
RETURNS TRIGGER AS $$
DECLARE
    current_manager_id UUID;
    depth INTEGER := 0;
BEGIN
    IF NEW.reporting_manager_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Check if new manager is the employee itself
    IF NEW.reporting_manager_id = NEW.id THEN
        RAISE EXCEPTION 'Employee cannot report to themselves';
    END IF;
    
    -- Traverse reporting chain
    current_manager_id := NEW.reporting_manager_id;
    WHILE current_manager_id IS NOT NULL AND depth < 20 LOOP
        -- Check if we've looped back to the employee
        IF current_manager_id = NEW.id THEN
            RAISE EXCEPTION 'Circular reporting chain detected';
        END IF;
        
        SELECT reporting_manager_id INTO current_manager_id
        FROM employees
        WHERE id = current_manager_id;
        
        depth := depth + 1;
    END LOOP;
    
    IF depth >= 20 THEN
        RAISE EXCEPTION 'Reporting hierarchy exceeds maximum depth of 20';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

#### **13.3.5. Junction Table Analysis**

| Junction Table | Left Entity | Right Entity | Additional Columns | Business Purpose |
|----------------|-------------|--------------|-------------------|------------------|
| career_history | employees | designations | change_type, effective_date, salary fields | Tracks employee career progression with complete history |
| career_history | employees | departments | change_type, effective_date | Tracks department transfers |
| pay_run_employee_records | pay_runs | employees | gross_salary, deductions, net_pay | Monthly payroll detail with calculations |
| generated_letters | letter_templates | employees | letter_number, status, content | Letter generation with tracking |

**Junction Table Pattern**:
```sql
-- career_history: Tracks M:N relationship between employees and designations over time
CREATE TABLE career_history (
    id UUID PRIMARY KEY,
    
    -- Left side: Employee
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,  -- Denormalized
    
    -- Right side: Old state
    old_designation_id UUID REFERENCES designations(id) ON DELETE RESTRICT,
    old_designation_name VARCHAR(255),  -- Denormalized
    old_department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    old_department_name VARCHAR(255),  -- Denormalized
    
    -- Right side: New state
    new_designation_id UUID REFERENCES designations(id) ON DELETE RESTRICT,
    new_designation_name VARCHAR(255),  -- Denormalized
    new_department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
    new_department_name VARCHAR(255),  -- Denormalized
    
    -- Junction-specific data
    change_type VARCHAR(50) NOT NULL,
    effective_date DATE NOT NULL,
    reason TEXT,
    
    -- Audit fields
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 13.4. Cross-Domain Data Flows

Documentation of how data flows across different functional domains during key business processes.

---

#### **13.4.1. Employee Onboarding Flow**

Complete data flow from candidate to active employee:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EMPLOYEE ONBOARDING FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Offer Generation
┌─────────────────┐
│ letter_templates│ ──────┐
└─────────────────┘       │ SELECT template
                          ▼
                 ┌──────────────────┐
                 │ generated_letters│ ← CREATE offer letter
                 └──────────────────┘   (status: draft → approved → sent)

Step 2: Employee Record Creation
┌─────────────────┐
│   employees     │ ← INSERT new employee
└─────────────────┘   (status: probation)
         │
         ├──→ ┌─────────────────┐
         │    │   bank_details  │ ← INSERT primary account
         │    └─────────────────┘
         │
         └──→ ┌─────────────────┐
              │   documents     │ ← INSERT (PAN, Aadhaar, etc.)
              └─────────────────┘   (verification_status: pending)

Step 3: Document Verification
┌─────────────────┐
│   documents     │ ← UPDATE verification_status = 'verified'
└─────────────────┘   verified_by = user_id, verified_at = NOW()

Step 4: User Account Creation
┌─────────────────┐
│     users       │ ← INSERT user account
└─────────────────┘   employee_id = new employee
         │               role = 'employee'
         │
         └──→ ┌─────────────────┐
              │   audit_logs    │ ← LOG 'CREATE_USER'
              └─────────────────┘

Step 5: Salary Annexure Generation
┌─────────────────┐
│ salary_annexures│ ← INSERT CTC breakdown
└─────────────────┘   annexure_number = 'CTCB/2024/000001'
                      issued_date = join_date

Step 6: Appointment Letter
┌─────────────────┐
│ generated_letters│ ← CREATE appointment letter
└─────────────────┘   letter_type = 'appointment_letter'
                      status: draft → approved → sent

Step 7: Initial Attendance Setup
┌─────────────────┐
│attendance_records│ ← INSERT (from join month onwards)
└─────────────────┘   Auto-created on first payroll run

Data Flow Dependencies:
employees ─┬─→ bank_details (mandatory)
           ├─→ documents (mandatory: PAN, Aadhaar)
           ├─→ salary_annexures (auto-generated)
           ├─→ generated_letters (offer + appointment)
           └─→ users (optional, if portal access needed)
```

**Tables Involved**: 8 tables (employees, bank_details, documents, users, salary_annexures, generated_letters, letter_templates, audit_logs)

**Transactions Required**: 3-4 transactions (employee creation, document upload, verification, user account)

**Validation Points**: 
- Department and designation must exist and be active
- Bank account validation (IFSC, account number format)
- Document verification required for confirmation
- Salary calculations validated against system settings

---

#### **13.4.2. Monthly Payroll Processing Flow**

Complete data flow for monthly salary processing:

```
┌─────────────────────────────────────────────────────────────────────┐
│                  MONTHLY PAYROLL PROCESSING                          │
└─────────────────────────────────────────────────────────────────────┘

INPUT SOURCES:
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   employees     │  │attendance_records│  │ advance_records │
│  (salary data)  │  │ (payable_days)   │  │ (installments)  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                     │
         │                    │                     │
         └────────────────────┼─────────────────────┘
                              │
                              ▼
                   ┌────────────────────┐
                   │ system_settings    │ ← Fetch PF/ESI rates
                   └────────────────────┘
                              │
                              ▼
              ╔═══════════════════════════════╗
              ║  PAYROLL CALCULATION ENGINE   ║
              ╚═══════════════════════════════╝
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
        ┌─────────────────┐      ┌─────────────────┐
        │   pay_runs      │      │ loan_records    │
        │                 │      │ (EMI deductions) │
        │ CREATE          │      └─────────────────┘
        │ status = draft  │                │
        └─────────────────┘                │
                 │                         │
                 │ 1:N                     │
                 ▼                         │
        ┌──────────────────────┐          │
        │pay_run_employee_     │◄─────────┘
        │records               │
        │                      │
        │ For each employee:   │
        │ • Gross salary       │
        │ • Pro-rata (LOP)     │
        │ • PF deduction       │
        │ • ESI deduction      │
        │ • Professional tax   │
        │ • TDS                │
        │ • Advance deduction  │◄─── FROM advance_records
        │ • Loan EMI deduction │◄─── FROM loan_records
        │ • Net pay ⚡         │
        └──────────────────────┘
                 │
                 │ Approval
                 ▼
        ┌─────────────────┐
        │   pay_runs      │
        │ UPDATE          │
        │ status=approved │
        │ approved_by     │
        └─────────────────┘
                 │
                 │ Processing
                 ▼
        ┌─────────────────┐
        │   payslips      │ ← CREATE one per employee
        │                 │   payslip_number = 'PS/2024/Jan/0001'
        │ Copy data from  │
        │ pay_run_employee│
        │ _records        │
        └─────────────────┘
                 │
                 ├──→ Generate PDF
                 ├──→ Send email
                 └──→ Update loan EMI status
                      Update advance status

SIDE EFFECTS:
┌─────────────────┐
│ loan_emis       │ ← UPDATE is_paid = true, paid_date = NOW()
└─────────────────┘
         │
         └──→ ┌─────────────────┐
              │ loan_records    │ ← UPDATE total_paid_emis++
              └─────────────────┘   remaining_balance ⚡ (auto)

┌─────────────────┐
│ advance_records │ ← UPDATE amount_deducted += installment_amount
└─────────────────┘   remaining_amount ⚡ (auto), status

┌─────────────────┐
│   audit_logs    │ ← LOG all approvals and status changes
└─────────────────┘
```

**Tables Involved**: 11 tables (employees, attendance_records, pay_runs, pay_run_employee_records, payslips, advance_records, loan_records, loan_emis, system_settings, users, audit_logs)

**Data Dependencies**:
1. Attendance must be approved before payroll
2. System settings (PF/ESI rates) must be configured
3. Active advances and loans fetched for deductions
4. Employee salary data must be current

**Calculation Order**:
```
1. Gross Salary = employee.gross (from employee table)
2. LOP Deduction = (gross / 30) * attendance.lop_days
3. Adjusted Gross = gross - lop_deduction
4. PF Deduction = adjusted_gross * pf_rate (if applicable)
5. ESI Deduction = adjusted_gross * esi_rate (if applicable)
6. Professional Tax = system_setting (PT slab based on gross)
7. TDS = employee.tds_monthly
8. Advance Deduction = advance_records.installment_amount
9. Loan EMI Deduction = loan_records.emi_amount
10. Total Deductions = PF + ESI + PT + TDS + Advance + Loan
11. Net Pay = adjusted_gross - total_deductions
```

**Atomicity**: Entire payroll run processed in transaction - if any employee fails, rollback all

---

#### **13.4.3. Employee Career Progression Flow**

Data flow for promotions, transfers, and salary increments:

```
┌─────────────────────────────────────────────────────────────────────┐
│               CAREER PROGRESSION WORKFLOW                            │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Career Change Request
┌─────────────────┐     ┌─────────���───────┐     ┌─────────────────┐
│   employees     │     │  designations   │     │  departments    │
│ (current state) │     │ (target role)   │     │ (target dept)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ career_history  │ ← INSERT
                        │                 │   change_type = 'promotion'
                        │ old_designation │   status = 'pending'
                        │ new_designation │
                        │ old_department  │
                        │ new_department  │
                        │ old_ctc         │
                        │ new_ctc         │
                        └─────────────────┘

Step 2: Approval
┌─────────────────┐
│ career_history  │ ← UPDATE approved_at = NOW()
└─────────────────┘   approved_by = manager_user_id
         │
         │ Trigger: apply_career_event_to_employee()
         ▼
┌─────────────────┐
│   employees     │ ← UPDATE (auto via trigger)
│                 │   designation_id = new_designation_id
│                 │   department_id = new_department_id
│                 │   ctc = new_ctc (if changed)
│                 │   gross, net (recalculated)
└─────────────────┘

Step 3: Salary Annexure (if CTC changed)
┌─────────────────┐
│ salary_annexures│ ← INSERT new annexure
└─────────────────┘   annexure_number = 'CTCB/2024/000042'
                      ctc_amount = new_ctc
                      effective_from = career_history.effective_date

Step 4: Letter Generation
┌─────────────────┐
│ generated_letters│ ← CREATE promotion/transfer letter
└─────────────────┘   letter_type = 'promotion_letter' or 'transfer_letter'
                      placeholders_data = {old_designation, new_designation, ...}
                      status: draft → approved → sent

Step 5: Audit Trail
┌─────────────────┐
│   audit_logs    │ ← LOG 'EMPLOYEE_PROMOTION'
└─────────────────┘   old_values = {...}
                      new_values = {...}
                      changed_fields = ['designation_id', 'department_id', 'ctc']

SIDE EFFECTS:
- If designation level increased: Update reporting_manager (possibly)
- If department changed: Update department statistics (trigger)
- If salary increased: Recalculate PF/ESI eligibility
- Future payroll: Use new salary and deductions
```

**Tables Involved**: 8 tables (employees, career_history, designations, departments, salary_annexures, generated_letters, letter_templates, audit_logs)

**Business Rules Enforced**:
- New designation must be in target department
- Effective date cannot be in past (for future-dated changes)
- Salary cannot decrease without approval reason
- All changes tracked in career_history for audit
- Denormalized fields (names) captured for historical accuracy

---

#### **13.4.4. Loan Lifecycle Flow**

Complete loan processing from application to completion:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LOAN LIFECYCLE FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Loan Application
┌─────────────────┐
│   employees     │ ─────────┐
│ (borrower)      │          │ Fetch employee details
└─────────────────┘          │ Check eligibility
         │                   │ (tenure, active loans)
         │                   ▼
         │          ┌─────────────────┐
         └────────→ │  loan_records   │ ← INSERT
                    │                 │   loan_amount = 100000
                    │ GENERATED       │   interest_rate = 12%
                    │ interest_amount │   number_of_emis = 12
                    │ total_amount    │   status = 'pending'
                    │ emi_amount      │
                    └─────────────────┘

Step 2: Approval
┌─────────────────┐
│  loan_records   │ ← UPDATE status = 'approved'
└─────────────────┘   approved_by = manager_user_id
                      approved_at = NOW()

Step 3: Disbursement
┌─────────────────┐
│  loan_records   │ ← UPDATE status = 'active'
└─────────────────┘   disbursed_at = NOW()
         │              disbursed_by = finance_user_id
         │
         │ Generate EMI Schedule
         ▼
┌─────────────────┐
│   loan_emis     │ ← INSERT 12 records (one per month)
│                 │   emi_number = 1, 2, 3, ... 12
│ For each EMI:   │   emi_amount = total_amount / 12
│ • emi_number    │   due_date = disbursed_at + (n * 1 month)
│ • emi_amount    │   is_paid = false
│ • due_date      │
│ • is_paid=false │
└─────────────────┘

Step 4: Monthly Payroll Deduction (repeated 12 times)
┌─────────────────┐
│   pay_runs      │ (monthly payroll)
└─────────────────┘
         │
         ▼
┌──────────────────────┐
│pay_run_employee_     │ ← SET loan_emi_deduction = emi_amount
│records               │   (for this employee)
└──────────────────────┘
         │
         │ After payroll approval
         ▼
┌─────────────────┐
│   loan_emis     │ ← UPDATE is_paid = true
└─────────────────┘   paid_date = NOW()
         │              WHERE emi_number = current_month
         │
         ▼
┌─────────────────┐
│  loan_records   │ ← UPDATE total_paid_emis++
└─────────────────┘   GENERATED: remaining_balance ⚡
                      GENERATED: remaining_emis ⚡
                      GENERATED: completion_percentage ⚡

Step 5: Completion (after 12 months)
┌─────────────────┐
│  loan_records   │ ← UPDATE status = 'completed'
└─────────────────┘   completed_at = NOW()
                      (when total_paid_emis = number_of_emis)

NOTIFICATIONS:
- Loan approved: Email to employee
- Loan disbursed: Email to employee + SMS
- EMI deducted: Show in payslip
- Loan completed: Completion certificate email

AUDIT TRAIL:
┌─────────────────┐
│   audit_logs    │ ← LOG all status changes
└─────────────────┘   APPROVE_LOAN, DISBURSE_LOAN, EMI_PAID, LOAN_COMPLETED
```

**Tables Involved**: 6 tables (employees, loan_records, loan_emis, pay_runs, pay_run_employee_records, audit_logs)

**State Transitions**: pending → approved → active → completed (or defaulted)

**Calculation Validation**:
```sql
-- Validate total_amount calculation
CHECK (ABS(total_amount - (loan_amount + interest_amount)) < 0.01)

-- Validate EMI calculation
CHECK (ABS(emi_amount - (total_amount / number_of_emis)) < 0.01)

-- Validate paid tracking
CHECK (total_paid_emis <= number_of_emis)
CHECK (remaining_emis = number_of_emis - total_paid_emis)
```

---

#### **13.4.5. Document Verification Flow**

Document upload, verification, and version management:

```
┌─────────────────────────────────────────────────────────────────────┐
│                  DOCUMENT VERIFICATION FLOW                          │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Initial Upload
┌─────────────────┐
│   employees     │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   documents     │ ← INSERT
│                 │   document_type = 'aadhaar_card'
│                 │   file_path = '/uploads/...'
│                 │   document_hash = SHA256(file)
│                 │   verification_status = 'pending'
│                 │   is_latest_version = true
│                 │   version = 1
└─────────────────┘

Step 2: Verification
┌─────────────────┐
│   documents     │ ← UPDATE verification_status = 'verified'
└─────────────────┘   verified_by = hr_user_id
                      verified_at = NOW()

Step 3: Document Update (new version)
┌─────────────────┐
│   documents     │ ← UPDATE is_latest_version = false
│ (old version)   │   (for previous version)
└─────────────────┘
         │
         │ parent_document_id
         ▼
┌─────────────────┐
│   documents     │ ← INSERT new version
│ (new version)   │   parent_document_id = old_document_id
│                 │   version = 2
│                 │   is_latest_version = true
│                 │   verification_status = 'pending'
└─────────────────┘

Version Chain Example:
Aadhaar v1 (2020) ────► Aadhaar v2 (2023) ────► Aadhaar v3 (2024)
is_latest = false       is_latest = false       is_latest = true
verified = true         verified = true         verified = pending

DUPLICATE DETECTION:
┌─────────────────┐
│   documents     │ ← Check document_hash before insert
└─────────────────┘   If hash exists for same employee + type:
                      → Return existing document_id
                      → Do not create duplicate

EXPIRY TRACKING:
┌─────────────────┐
│   documents     │ ← GENERATED: is_expired
└─────────────────┘   = (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE)

                  ┌─────────────────┐
                  │ Expiry Alert Job│ (runs daily)
                  └─────────────────┘
                           │
                           │ Find documents expiring in 30 days
                           ▼
                  Send email notification to HR + Employee
```

**Tables Involved**: 3 tables (employees, documents, users)

**Business Rules**:
- Only latest version shown in employee profile
- All versions retained for audit
- Expiry alerts sent 30 days before expiry
- Duplicate detection by SHA-256 hash
- Verification required for critical documents (PAN, Aadhaar)

---

### 13.5. Referential Action Strategy

Detailed rationale for choosing CASCADE, RESTRICT, or SET NULL for each relationship type.

---

#### **13.5.1. CASCADE Strategy (17 relationships)**

**Purpose**: Automatically delete dependent records when parent is deleted. Used for truly dependent data.

**Use Cases**:

1. **User Session Management**
   ```sql
   sessions.user_id → users.id (ON DELETE CASCADE)
   ```
   **Rationale**: Sessions are meaningless without user; auto-cleanup on user deletion

2. **Employee-Owned Data**
   ```sql
   bank_details.employee_id → employees.id (ON DELETE CASCADE)
   documents.employee_id → employees.id (ON DELETE CASCADE)
   career_history.employee_id → employees.id (ON DELETE CASCADE)
   salary_annexures.employee_id → employees.id (ON DELETE CASCADE)
   attendance_records.employee_id → employees.id (ON DELETE CASCADE)
   advance_records.employee_id → employees.id (ON DELETE CASCADE)
   loan_records.employee_id → employees.id (ON DELETE CASCADE)
   generated_letters.employee_id → employees.id (ON DELETE CASCADE)
   ```
   **Rationale**: All these records exist solely for the employee; no value retaining orphaned records

3. **Payroll Detail Records**
   ```sql
   pay_run_employee_records.pay_run_id → pay_runs.id (ON DELETE CASCADE)
   ```
   **Rationale**: Employee records are part of pay run; deleting pay run removes all details

4. **Loan EMI Schedule**
   ```sql
   loan_emis.loan_id → loan_records.id (ON DELETE CASCADE)
   ```
   **Rationale**: EMI schedule is integral part of loan; no loan = no EMI schedule

5. **Setting Change Audit**
   ```sql
   setting_change_history.setting_id → system_settings.id (ON DELETE CASCADE)
   ```
   **Rationale**: Change history tied to specific setting; if setting deleted, history irrelevant

**Guidelines for Using CASCADE**:
- ✅ Use when: Child record has no meaning without parent
- ✅ Use when: Child record is "owned" by parent
- ✅ Use when: Child record is part of parent's lifecycle
- ❌ Avoid when: Child record has independent business value
- ❌ Avoid when: Deletion might violate compliance/audit requirements

---

#### **13.5.2. RESTRICT Strategy (7 relationships)**

**Purpose**: Prevent parent deletion if child records exist. Used for critical master data.

**Use Cases**:

1. **Organizational Structure Protection**
   ```sql
   employees.department_id → departments.id (ON DELETE RESTRICT)
   employees.designation_id → designations.id (ON DELETE RESTRICT)
   designations.department_id → departments.id (ON DELETE RESTRICT)
   ```
   **Rationale**: Cannot delete department/designation while employees are assigned; must reassign first

2. **Payroll History Protection**
   ```sql
   pay_run_employee_records.employee_id → employees.id (ON DELETE RESTRICT)
   payslips.employee_id → employees.id (ON DELETE RESTRICT)
   ```
   **Rationale**: Payroll records must be retained for audit/compliance; cannot delete employee with payment history

3. **Career History Protection**
   ```sql
   career_history.old_designation_id → designations.id (ON DELETE RESTRICT)
   career_history.new_designation_id → designations.id (ON DELETE RESTRICT)
   career_history.old_department_id → departments.id (ON DELETE RESTRICT)
   career_history.new_department_id → departments.id (ON DELETE RESTRICT)
   ```
   **Rationale**: Career history is permanent audit trail; referenced designations/departments must remain

**Deletion Workflow with RESTRICT**:
```sql
-- Attempting to delete department with employees
DELETE FROM departments WHERE id = 'dept-uuid';
-- ERROR: update or delete on table "departments" violates foreign key constraint

-- Correct workflow
-- 1. Reassign employees to different department
UPDATE employees SET department_id = 'other-dept-uuid' WHERE department_id = 'dept-uuid';

-- 2. Now safe to delete
DELETE FROM departments WHERE id = 'dept-uuid';
```

**Guidelines for Using RESTRICT**:
- ✅ Use when: Parent is master data referenced by many
- ✅ Use when: Accidental deletion would cause major issues
- ✅ Use when: Compliance requires retaining relationships
- ✅ Use when: Deletion requires explicit business workflow
- ❌ Avoid when: It creates too much friction in normal operations

---

#### **13.5.3. SET NULL Strategy (24 relationships)**

**Purpose**: Preserve child records but remove parent reference. Used for optional relationships and audit trail preservation.

**Use Cases**:

1. **Audit Trail Preservation**
   ```sql
   audit_logs.user_id → users.id (ON DELETE SET NULL)
   salary_annexures.generated_by → users.id (ON DELETE SET NULL)
   generated_letters.generated_by → users.id (ON DELETE SET NULL)
   ```
   **Rationale**: Actions/records remain valid even if user leaves; user_id set to NULL indicates "no longer tracked"

2. **Optional References**
   ```sql
   employees.reporting_manager_id → employees.id (ON DELETE SET NULL)
   designations.reporting_to_designation_id → designations.id (ON DELETE SET NULL)
   loan_records.guarantor_employee_id → employees.id (ON DELETE SET NULL)
   generated_letters.template_id → letter_templates.id (ON DELETE SET NULL)
   ```
   **Rationale**: Child record remains meaningful without parent; NULL indicates "not applicable" or "no longer available"

3. **Workflow Tracking**
   ```sql
   pay_runs.generated_by → users.id (ON DELETE SET NULL)
   pay_runs.approved_by → users.id (ON DELETE SET NULL)
   pay_runs.processed_by → users.id (ON DELETE SET NULL)
   attendance_records.approved_by → users.id (ON DELETE SET NULL)
   loan_records.approved_by → users.id (ON DELETE SET NULL)
   ```
   **Rationale**: Workflow completion tracked; approver identity preserved in history but not critical if user deleted

4. **Cross-References**
   ```sql
   payslips.pay_run_employee_record_id → pay_run_employee_records.id (ON DELETE SET NULL)
   documents.parent_document_id → documents.id (ON DELETE SET NULL)
   ```
   **Rationale**: Cross-reference is informational; record valid without it

**NULL Semantics**:
- NULL in `user_id`: "User no longer in system" or "System-generated"
- NULL in `reporting_manager_id`: "Top-level manager" or "No manager assigned"
- NULL in `guarantor_employee_id`: "No guarantor" or "Guarantor left company"
- NULL in `template_id`: "Template deleted" or "Custom letter"

**Guidelines for Using SET NULL**:
- ✅ Use when: Child record has independent business value
- ✅ Use when: Parent reference is optional or informational
- ✅ Use when: Audit trail must be preserved
- ✅ Use when: NULL has clear business meaning
- ❌ Avoid when: Parent reference is mandatory for business logic
- ❌ Avoid when: NULL would break application logic

**Column Requirements**:
```sql
-- Column must be nullable for SET NULL to work
reporting_manager_id UUID REFERENCES employees(id) ON DELETE SET NULL  -- ✅ Nullable
department_id UUID NOT NULL REFERENCES departments(id)  -- ❌ Cannot use SET NULL with NOT NULL
```

---

#### **13.5.4. Decision Matrix for Referential Actions**

| Question | CASCADE | RESTRICT | SET NULL |
|----------|---------|----------|----------|
| Is child record meaningful without parent? | No | Yes | Yes |
| Should parent deletion be blocked? | No | Yes | No |
| Is this an audit/compliance relationship? | No | Yes | Maybe |
| Is parent reference optional? | No | No | Yes |
| Are there many child records? | Maybe | Maybe | Maybe |
| Is parent frequently deleted? | Maybe | No | Yes |
| Must child record survive parent? | No | Yes | Yes |
| Is NULL acceptable for this column? | N/A | N/A | Yes |

**Decision Tree**:
```
Is child record dependent on parent (no value without parent)?
├─ YES → CASCADE
└─ NO → Is parent master data that should not be easily deleted?
    ├─ YES → RESTRICT
    └─ NO → Is parent reference optional/informational?
        ├─ YES → SET NULL
        └─ NO → RESTRICT (require explicit cleanup)
```

---

### 13.6. Circular Reference Prevention

Comprehensive strategies for preventing circular references in self-referencing relationships.

---

#### **13.6.1. Manager Hierarchy Circular Prevention**

**Problem**: Preventing circular manager chains (A → B → C → A)

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION check_circular_reporting()
RETURNS TRIGGER AS $$
DECLARE
    current_manager_id UUID;
    visited_managers UUID[] := ARRAY[]::UUID[];
    depth INTEGER := 0;
    max_depth CONSTANT INTEGER := 20;
BEGIN
    -- Allow NULL manager (top-level employee)
    IF NEW.reporting_manager_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Self-reference check
    IF NEW.reporting_manager_id = NEW.id THEN
        RAISE EXCEPTION 'Employee cannot report to themselves (id: %)', NEW.id;
    END IF;
    
    -- Traverse reporting chain upward
    current_manager_id := NEW.reporting_manager_id;
    visited_managers := array_append(visited_managers, NEW.id);
    
    WHILE current_manager_id IS NOT NULL AND depth < max_depth LOOP
        -- Circular reference check
        IF current_manager_id = NEW.id THEN
            RAISE EXCEPTION 'Circular reporting chain detected: Employee % would report to themselves through manager chain', 
                NEW.id;
        END IF;
        
        -- Check if we've visited this manager before (circular loop)
        IF current_manager_id = ANY(visited_managers) THEN
            RAISE EXCEPTION 'Circular loop detected in reporting chain at manager %', 
                current_manager_id;
        END IF;
        
        visited_managers := array_append(visited_managers, current_manager_id);
        
        -- Move up the chain
        SELECT reporting_manager_id INTO current_manager_id
        FROM employees
        WHERE id = current_manager_id;
        
        depth := depth + 1;
    END LOOP;
    
    -- Depth check
    IF depth >= max_depth THEN
        RAISE EXCEPTION 'Reporting hierarchy exceeds maximum depth of % levels', max_depth;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER prevent_circular_reporting
BEFORE INSERT OR UPDATE OF reporting_manager_id ON employees
FOR EACH ROW
EXECUTE FUNCTION check_circular_reporting();
```

**Test Cases**:
```sql
-- Test 1: Self-reference (should fail)
UPDATE employees SET reporting_manager_id = id WHERE id = 'emp-1';
-- ERROR: Employee cannot report to themselves

-- Test 2: Direct circular (A → B, B → A) (should fail)
-- Assume: emp-1 reports to emp-2
UPDATE employees SET reporting_manager_id = 'emp-1' WHERE id = 'emp-2';
-- ERROR: Circular reporting chain detected

-- Test 3: Indirect circular (A → B → C → A) (should fail)
-- Assume: emp-1 → emp-2 → emp-3
UPDATE employees SET reporting_manager_id = 'emp-1' WHERE id = 'emp-3';
-- ERROR: Circular loop detected

-- Test 4: Deep hierarchy (21 levels) (should fail)
-- Create chain with 21 levels
-- ERROR: Reporting hierarchy exceeds maximum depth of 20 levels

-- Test 5: Valid hierarchy (should succeed)
UPDATE employees SET reporting_manager_id = 'manager-uuid' WHERE id = 'emp-1';
-- SUCCESS
```

---

#### **13.6.2. Designation Hierarchy Circular Prevention**

**Problem**: Preventing circular designation reporting (Jr Dev → Sr Dev → Jr Dev)

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION check_circular_designation_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    current_designation_id UUID;
    visited_designations UUID[] := ARRAY[]::UUID[];
    depth INTEGER := 0;
    max_depth CONSTANT INTEGER := 20;
BEGIN
    -- Allow NULL (top-level designation)
    IF NEW.reporting_to_designation_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Self-reference check
    IF NEW.reporting_to_designation_id = NEW.id THEN
        RAISE EXCEPTION 'Designation cannot report to itself (id: %)', NEW.id;
    END IF;
    
    -- Must be within same department
    IF EXISTS (
        SELECT 1 FROM designations 
        WHERE id = NEW.reporting_to_designation_id 
        AND department_id != NEW.department_id
    ) THEN
        RAISE EXCEPTION 'Designation can only report to another designation in the same department';
    END IF;
    
    -- Traverse hierarchy upward
    current_designation_id := NEW.reporting_to_designation_id;
    visited_designations := array_append(visited_designations, NEW.id);
    
    WHILE current_designation_id IS NOT NULL AND depth < max_depth LOOP
        -- Circular check
        IF current_designation_id = NEW.id THEN
            RAISE EXCEPTION 'Circular designation hierarchy detected: Designation % would report to itself', 
                NEW.id;
        END IF;
        
        IF current_designation_id = ANY(visited_designations) THEN
            RAISE EXCEPTION 'Circular loop in designation hierarchy at designation %', 
                current_designation_id;
        END IF;
        
        visited_designations := array_append(visited_designations, current_designation_id);
        
        -- Move up
        SELECT reporting_to_designation_id INTO current_designation_id
        FROM designations
        WHERE id = current_designation_id;
        
        depth := depth + 1;
    END LOOP;
    
    -- Depth check
    IF depth >= max_depth THEN
        RAISE EXCEPTION 'Designation hierarchy exceeds maximum depth of % levels', max_depth;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER prevent_circular_designation_hierarchy
BEFORE INSERT OR UPDATE OF reporting_to_designation_id ON designations
FOR EACH ROW
EXECUTE FUNCTION check_circular_designation_hierarchy();
```

**Valid Designation Hierarchy Example**:
```
Engineering Department:
CEO (level 1) ────────────────────────┐
  └─ CTO (level 2)                    │ NULL parent
      ├─ Engineering Manager (level 3)│
      │   ├─ Tech Lead (level 4)      │
      │   │   ├─ Senior Developer (5) │
      │   │   └─ Junior Developer (6) │
      │   └─ QA Lead (level 4)        │
      └─ Product Manager (level 3)    │
```

---

#### **13.6.3. Document Version Chain Management**

**Problem**: Ensuring version chain remains linear (no cycles, no branches)

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION manage_document_version_chain()
RETURNS TRIGGER AS $$
DECLARE
    current_doc_id UUID;
    version_count INTEGER := 0;
    max_versions CONSTANT INTEGER := 50;
BEGIN
    -- New document with no parent (version 1)
    IF NEW.parent_document_id IS NULL THEN
        NEW.version := 1;
        NEW.is_latest_version := true;
        RETURN NEW;
    END IF;
    
    -- Cannot be parent of itself
    IF NEW.parent_document_id = NEW.id THEN
        RAISE EXCEPTION 'Document cannot be its own parent';
    END IF;
    
    -- Validate parent exists and belongs to same employee + document type
    IF NOT EXISTS (
        SELECT 1 FROM documents
        WHERE id = NEW.parent_document_id
        AND employee_id = NEW.employee_id
        AND document_type = NEW.document_type
    ) THEN
        RAISE EXCEPTION 'Parent document must exist and match employee and document type';
    END IF;
    
    -- Check chain length
    current_doc_id := NEW.parent_document_id;
    WHILE current_doc_id IS NOT NULL AND version_count < max_versions LOOP
        SELECT parent_document_id INTO current_doc_id
        FROM documents
        WHERE id = current_doc_id;
        
        version_count := version_count + 1;
    END LOOP;
    
    IF version_count >= max_versions THEN
        RAISE EXCEPTION 'Document version chain exceeds maximum of % versions', max_versions;
    END IF;
    
    -- Set version number (parent version + 1)
    SELECT version + 1 INTO NEW.version
    FROM documents
    WHERE id = NEW.parent_document_id;
    
    -- Mark parent as not latest
    UPDATE documents
    SET is_latest_version = false
    WHERE id = NEW.parent_document_id;
    
    -- New document is latest
    NEW.is_latest_version := true;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER manage_document_versions
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION manage_document_version_chain();
```

**Version Chain Visualization**:
```
Employee: John Doe, Document: Aadhaar Card

v1 (2020-01-01) ─────► v2 (2023-05-15) ─────► v3 (2024-11-20)
is_latest = false      is_latest = false      is_latest = true
parent = NULL          parent = v1            parent = v2
```

**Business Rules**:
- Linear chain only (no branching: v2 can't have two children)
- Latest version always marked with is_latest_version = true
- Old versions retained for audit
- Query latest: `WHERE document_type = 'aadhaar' AND is_latest_version = true`

---

#### **13.6.4. Loan Guarantor Self-Reference**

**Problem**: Preventing employee from being their own guarantor

**Implementation**:
```sql
-- Check constraint on loan_records
ALTER TABLE loan_records
ADD CONSTRAINT chk_guarantor_not_self
CHECK (guarantor_employee_id IS NULL OR guarantor_employee_id != employee_id);

-- Additional validation in application/trigger
CREATE OR REPLACE FUNCTION validate_loan_guarantor()
RETURNS TRIGGER AS $$
BEGIN
    -- Optional guarantor
    IF NEW.guarantor_employee_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Cannot be self
    IF NEW.guarantor_employee_id = NEW.employee_id THEN
        RAISE EXCEPTION 'Employee cannot be their own loan guarantor';
    END IF;
    
    -- Guarantor must be active employee
    IF NOT EXISTS (
        SELECT 1 FROM employees
        WHERE id = NEW.guarantor_employee_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Loan guarantor must be an active employee';
    END IF;
    
    -- Optional: Check guarantor's tenure (e.g., minimum 2 years)
    IF EXISTS (
        SELECT 1 FROM employees
        WHERE id = NEW.guarantor_employee_id
        AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, join_date)) < 2
    ) THEN
        RAISE WARNING 'Guarantor has less than 2 years tenure';
    END IF;
    
    -- Optional: Limit number of loans a person can guarantee
    IF (SELECT COUNT(*) FROM loan_records 
        WHERE guarantor_employee_id = NEW.guarantor_employee_id 
        AND status IN ('approved', 'active')) >= 3 THEN
        RAISE EXCEPTION 'Guarantor has already guaranteed 3 active loans (maximum)';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_loan_guarantor_trigger
BEFORE INSERT OR UPDATE OF guarantor_employee_id ON loan_records
FOR EACH ROW
EXECUTE FUNCTION validate_loan_guarantor();
```

**Note**: This is NOT a circular reference issue (no chain traversal) but a self-reference validation.

---

#### **13.6.5. Circular Reference Testing Checklist**

**For Each Self-Referencing Relationship**:

- [ ] **Self-reference test**: Record cannot reference itself
- [ ] **Direct circular test**: A → B, B → A
- [ ] **Indirect circular test**: A → B → C → A
- [ ] **Deep chain test**: Exceeds maximum depth
- [ ] **NULL test**: NULL reference allowed (if applicable)
- [ ] **Update test**: Changing reference creates circular chain
- [ ] **Delete test**: Deleting referenced record doesn't break chain
- [ ] **Performance test**: Trigger performance with deep hierarchies

**Test SQL Template**:
```sql
-- Test circular reference prevention
DO $$
DECLARE
    emp1_id UUID := gen_random_uuid();
    emp2_id UUID := gen_random_uuid();
    emp3_id UUID := gen_random_uuid();
BEGIN
    -- Create employees
    INSERT INTO employees (id, employee_id, first_name, last_name, ...)
    VALUES 
        (emp1_id, '001', 'Alice', 'Smith', ...),
        (emp2_id, '002', 'Bob', 'Jones', ...),
        (emp3_id, '003', 'Carol', 'White', ...);
    
    -- Test 1: Create valid chain (should succeed)
    UPDATE employees SET reporting_manager_id = emp3_id WHERE id = emp2_id;
    UPDATE employees SET reporting_manager_id = emp2_id WHERE id = emp1_id;
    RAISE NOTICE 'Test 1 PASSED: Valid chain created';
    
    -- Test 2: Create circular (should fail)
    BEGIN
        UPDATE employees SET reporting_manager_id = emp1_id WHERE id = emp3_id;
        RAISE EXCEPTION 'Test 2 FAILED: Circular reference not prevented';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Test 2 PASSED: Circular reference prevented: %', SQLERRM;
    END;
    
    -- Cleanup
    DELETE FROM employees WHERE id IN (emp1_id, emp2_id, emp3_id);
END $$;
```

---

### 13.7. Traversal Patterns

Common SQL query patterns for navigating relationships and fetching related data efficiently.

---

#### **13.7.1. Get Employee's Full Information**

**Use Case**: Fetch complete employee profile with all related data for employee detail page.

**Tables Involved**: employees, departments, designations, bank_details, documents, users

---

**Pattern 1: Basic Employee Profile with Current Assignment**

```sql
-- Fetch employee with current department and designation
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.join_date,
    e.status,
    e.gross,
    e.net,
    e.ctc,
    
    -- Current department
    d.id AS department_id,
    d.name AS department_name,
    d.code AS department_code,
    
    -- Current designation
    des.id AS designation_id,
    des.name AS designation_name,
    des.level AS designation_level,
    
    -- Reporting manager
    mgr.id AS manager_id,
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    mgr.designation_id AS manager_designation_id,
    
    -- User account (if exists)
    u.id AS user_id,
    u.username,
    u.role AS user_role,
    u.is_active AS account_active
    
FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
LEFT JOIN users u ON u.employee_id = e.id

WHERE e.id = $1;  -- Employee UUID parameter
```

**Returns**: Single row with employee, department, designation, manager, and user account details.

---

**Pattern 2: Employee Profile with Primary Bank Account**

```sql
-- Fetch employee with primary bank account
SELECT 
    e.*,
    
    -- Primary bank account
    bd.id AS bank_account_id,
    bd.account_holder_name,
    bd.account_number,
    bd.ifsc_code,
    bd.bank_name,
    bd.branch_name,
    bd.account_type,
    bd.is_verified AS bank_verified,
    bd.verified_at AS bank_verified_at
    
FROM employees e
LEFT JOIN bank_details bd ON bd.employee_id = e.id 
    AND bd.is_primary = true
    
WHERE e.id = $1;
```

**Note**: Uses partial unique index `idx_bank_details_primary_unique` to ensure only one primary account.

---

**Pattern 3: Employee with All Documents (Latest Versions Only)**

```sql
-- Fetch employee with latest version of each document type
SELECT 
    e.id AS employee_id,
    e.first_name,
    e.last_name,
    
    -- Document aggregation
    json_agg(
        json_build_object(
            'document_id', doc.id,
            'document_type', doc.document_type,
            'document_number', doc.document_number,
            'file_path', doc.file_path,
            'version', doc.version,
            'verification_status', doc.verification_status,
            'is_expired', doc.is_expired,  -- GENERATED column
            'expiry_date', doc.expiry_date,
            'issued_date', doc.issued_date,
            'uploaded_at', doc.created_at
        ) ORDER BY doc.document_type
    ) FILTER (WHERE doc.id IS NOT NULL) AS documents
    
FROM employees e
LEFT JOIN documents doc ON doc.employee_id = e.id 
    AND doc.is_latest_version = true
    
WHERE e.id = $1
GROUP BY e.id, e.first_name, e.last_name;
```

**Returns**: Single row with JSON array of latest documents.

**Result Example**:
```json
{
  "employee_id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "documents": [
    {
      "document_id": "uuid",
      "document_type": "aadhaar_card",
      "document_number": "1234 5678 9012",
      "file_path": "/uploads/aadhaar_uuid.pdf",
      "version": 2,
      "verification_status": "verified",
      "is_expired": false,
      "expiry_date": null,
      "issued_date": "2020-01-15"
    },
    {
      "document_type": "pan_card",
      ...
    }
  ]
}
```

---

**Pattern 4: Complete Employee Profile (Single Query)**

```sql
-- Comprehensive employee profile with all related data
WITH employee_base AS (
    SELECT 
        e.*,
        d.name AS department_name,
        des.name AS designation_name,
        des.level AS designation_level,
        mgr.first_name || ' ' || mgr.last_name AS manager_name,
        u.username AS user_account,
        u.role AS user_role
    FROM employees e
    INNER JOIN departments d ON e.department_id = d.id
    INNER JOIN designations des ON e.designation_id = des.id
    LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
    LEFT JOIN users u ON u.employee_id = e.id
    WHERE e.id = $1
),
bank_accounts AS (
    SELECT 
        employee_id,
        json_agg(
            json_build_object(
                'account_id', id,
                'account_number', account_number,
                'ifsc_code', ifsc_code,
                'bank_name', bank_name,
                'is_primary', is_primary,
                'is_verified', is_verified
            ) ORDER BY is_primary DESC, created_at
        ) AS accounts
    FROM bank_details
    WHERE employee_id = $1
    GROUP BY employee_id
),
employee_documents AS (
    SELECT 
        employee_id,
        json_agg(
            json_build_object(
                'document_type', document_type,
                'document_number', document_number,
                'verification_status', verification_status,
                'is_expired', is_expired,
                'file_path', file_path,
                'version', version
            ) ORDER BY document_type
        ) FILTER (WHERE is_latest_version = true) AS documents
    FROM documents
    WHERE employee_id = $1
    GROUP BY employee_id
),
recent_career_changes AS (
    SELECT 
        employee_id,
        json_agg(
            json_build_object(
                'change_type', change_type,
                'effective_date', effective_date,
                'old_designation', old_designation_name,
                'new_designation', new_designation_name,
                'old_ctc', old_ctc,
                'new_ctc', new_ctc
            ) ORDER BY effective_date DESC
        ) AS career_history
    FROM career_history
    WHERE employee_id = $1
    LIMIT 5  -- Last 5 changes
)
SELECT 
    eb.*,
    ba.accounts AS bank_accounts,
    ed.documents,
    cc.career_history
FROM employee_base eb
LEFT JOIN bank_accounts ba ON ba.employee_id = eb.id
LEFT JOIN employee_documents ed ON ed.employee_id = eb.id
LEFT JOIN recent_career_changes cc ON cc.employee_id = eb.id;
```

**Returns**: Single comprehensive JSON row with all employee data.

**Performance Notes**:
- Uses CTEs for readability and query planning
- All JOINs use indexed foreign keys
- JSON aggregation done at database level (efficient)
- LIMIT on career history prevents excessive data

**Use in Application**:
```typescript
interface EmployeeFullProfile {
  // Base employee fields
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  // ... all employee fields
  
  // Related data
  department_name: string;
  designation_name: string;
  manager_name: string | null;
  user_account: string | null;
  
  // JSON aggregations
  bank_accounts: Array<{
    account_id: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    is_primary: boolean;
    is_verified: boolean;
  }>;
  
  documents: Array<{
    document_type: string;
    document_number: string;
    verification_status: string;
    is_expired: boolean;
    file_path: string;
    version: number;
  }>;
  
  career_history: Array<{
    change_type: string;
    effective_date: string;
    old_designation: string;
    new_designation: string;
    old_ctc: number;
    new_ctc: number;
  }>;
}

// Usage
const profile = await db.query<EmployeeFullProfile>(
  COMPLETE_EMPLOYEE_PROFILE_QUERY,
  [employeeId]
);
```

---

**Pattern 5: Employee with Active Financial Records**

```sql
-- Fetch employee with active advances and loans
SELECT 
    e.id,
    e.first_name,
    e.last_name,
    e.gross,
    
    -- Active advances
    json_agg(
        DISTINCT jsonb_build_object(
            'advance_id', adv.id,
            'amount', adv.amount,
            'remaining_amount', adv.remaining_amount,  -- GENERATED
            'installment_amount', adv.installment_amount,  -- GENERATED
            'reason', adv.reason,
            'status', adv.status,
            'approved_at', adv.approved_at
        )
    ) FILTER (WHERE adv.id IS NOT NULL AND adv.status IN ('approved', 'active')) AS active_advances,
    
    -- Active loans
    json_agg(
        DISTINCT jsonb_build_object(
            'loan_id', ln.id,
            'loan_amount', ln.loan_amount,
            'total_amount', ln.total_amount,  -- GENERATED
            'emi_amount', ln.emi_amount,  -- GENERATED
            'remaining_balance', ln.remaining_balance,  -- GENERATED
            'remaining_emis', ln.remaining_emis,  -- GENERATED
            'completion_percentage', ln.completion_percentage,  -- GENERATED
            'interest_rate', ln.interest_rate,
            'status', ln.status,
            'disbursed_at', ln.disbursed_at
        )
    ) FILTER (WHERE ln.id IS NOT NULL AND ln.status IN ('approved', 'active')) AS active_loans,
    
    -- Calculate total monthly deductions
    COALESCE(SUM(adv.installment_amount), 0) + 
    COALESCE(SUM(ln.emi_amount), 0) AS total_monthly_deductions
    
FROM employees e
LEFT JOIN advance_records adv ON adv.employee_id = e.id 
    AND adv.status IN ('approved', 'active')
LEFT JOIN loan_records ln ON ln.employee_id = e.id 
    AND ln.status IN ('approved', 'active')
    
WHERE e.id = $1
GROUP BY e.id, e.first_name, e.last_name, e.gross;
```

**Returns**: Employee with active financial obligations and total deduction amount.

**Business Value**: 
- Shows employee's financial commitments
- Calculates available salary after deductions
- Used in: Loan approval checks, payroll processing, advance eligibility

---

**Pattern 6: Employee Dashboard Query (Performance Optimized)**

```sql
-- Optimized query for employee dashboard (minimal data)
SELECT 
    e.id,
    e.employee_id,
    e.first_name || ' ' || e.last_name AS full_name,
    e.email,
    e.phone,
    e.status,
    
    -- Current assignment (denormalized for performance)
    d.name AS department,
    des.name AS designation,
    
    -- Computed values
    e.tenure_months,  -- GENERATED column
    e.is_active,      -- GENERATED column
    
    -- Counts (from separate queries or materialized views)
    (SELECT COUNT(*) FROM documents WHERE employee_id = e.id AND is_latest_version = true) AS document_count,
    (SELECT COUNT(*) FROM loan_records WHERE employee_id = e.id AND status = 'active') AS active_loans,
    (SELECT COUNT(*) FROM advance_records WHERE employee_id = e.id AND status = 'active') AS active_advances,
    
    -- Latest attendance
    (
        SELECT json_build_object(
            'month', month,
            'year', year,
            'payable_days', payable_days,
            'lop_days', lop_days,
            'status', status
        )
        FROM attendance_records
        WHERE employee_id = e.id
        ORDER BY year DESC, month DESC
        LIMIT 1
    ) AS latest_attendance
    
FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id

WHERE e.id = $1;
```

**Optimization Strategy**:
- Uses GENERATED columns (pre-computed)
- Subqueries only fetch counts (fast with indexes)
- No JSON aggregation of large datasets
- Single row return (no GROUP BY overhead)

---

**Query Performance Comparison**:

| Pattern | Rows Returned | Tables Joined | JSON Aggregation | Use Case | Avg Query Time* |
|---------|---------------|---------------|------------------|----------|-----------------|
| Pattern 1 | 1 | 5 | No | Basic profile display | 2-5ms |
| Pattern 2 | 1 | 2 | No | Salary payment | 1-3ms |
| Pattern 3 | 1 | 2 | Yes (documents) | Document verification | 5-10ms |
| Pattern 4 | 1 | 7 | Yes (3 arrays) | Complete profile page | 15-30ms |
| Pattern 5 | 1 | 3 | Yes (2 arrays) | Financial dashboard | 8-15ms |
| Pattern 6 | 1 | 3 | Yes (1 object) | Quick dashboard | 3-8ms |

*Query times estimated for database with 1000 employees, 50 docs/employee average

---

**Best Practices for Employee Queries**:

1. **Choose the right pattern**: Don't fetch more data than needed
2. **Use indexes**: All foreign keys and commonly filtered columns indexed
3. **Leverage GENERATED columns**: Pre-computed values (tenure_months, is_active, etc.)
4. **JSON aggregation**: Use for 1:N relationships instead of multiple queries
5. **Filter latest versions**: Documents use `is_latest_version = true`
6. **Limit historical data**: Career history limited to recent changes
7. **Cache frequently accessed data**: Employee basic info rarely changes

**Anti-Patterns to Avoid**:
- ❌ N+1 queries: Fetching employee then looping through related records
- ❌ SELECT *: Always specify needed columns
- ❌ Missing WHERE on is_latest_version: Returns all document versions
- ❌ No LIMIT on historical tables: Career history, audit logs grow indefinitely
- ❌ Client-side joins: Always join in database

---

**Section 13 Complete**: All relationship documentation including types, matrix, data flows, referential actions, circular prevention strategies, and traversal patterns documented comprehensively.

---

## 14. Indexing and Performance Optimization - EcoVale HR System

Comprehensive indexing strategy and performance optimization guidelines for all 20 tables in the EcoVale HR database schema.

---

### 14.1. Indexing Strategy

Strategic index design to optimize query performance while minimizing storage overhead and write penalties.

---

#### **14.1.1. Primary Key Indexes**

All tables use UUID primary keys with automatic index creation. PostgreSQL automatically creates a unique B-tree index on PRIMARY KEY constraints.

**Implementation**:

```sql
-- users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Automatic index: users_pkey on (id)
    ...
);

-- employees table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Automatic index: employees_pkey on (id)
    ...
);

-- All 20 tables follow this pattern
```

---

**Primary Key Index Characteristics**:

| Table | PK Column | Index Type | Index Size* | Uniqueness | Clustering** |
|-------|-----------|------------|-------------|------------|--------------|
| users | id | B-tree | ~1.5 MB | Unique | No |
| sessions | id | B-tree | ~500 KB | Unique | No |
| audit_logs | id | B-tree | ~5 MB | Unique | No |
| departments | id | B-tree | ~100 KB | Unique | No |
| designations | id | B-tree | ~200 KB | Unique | No |
| employees | id | B-tree | ~2 MB | Unique | No |
| bank_details | id | B-tree | ~800 KB | Unique | No |
| documents | id | B-tree | ~3 MB | Unique | No |
| career_history | id | B-tree | ~1.5 MB | Unique | No |
| salary_annexures | id | B-tree | ~1 MB | Unique | No |
| attendance_records | id | B-tree | ~4 MB | Unique | No |
| pay_runs | id | B-tree | ~500 KB | Unique | No |
| pay_run_employee_records | id | B-tree | ~3 MB | Unique | No |
| payslips | id | B-tree | ~3 MB | Unique | No |
| advance_records | id | B-tree | ~800 KB | Unique | No |
| loan_records | id | B-tree | ~1 MB | Unique | No |
| loan_emis | id | B-tree | ~2 MB | Unique | No |
| letter_templates | id | B-tree | ~100 KB | Unique | No |
| generated_letters | id | B-tree | ~2 MB | Unique | No |
| system_settings | id | B-tree | ~50 KB | Unique | No |
| setting_change_history | id | B-tree | ~200 KB | Unique | No |

*Estimated for database with 1000 employees, 3 years of transactional data  
**PostgreSQL does not support clustered indexes like SQL Server; physical ordering is not maintained

---

**Primary Key Index Usage Patterns**:

1. **Direct Lookups** (most common):
   ```sql
   -- Single row fetch by PK (fastest operation)
   SELECT * FROM employees WHERE id = 'uuid-value';
   -- Uses: Index Scan on employees_pkey
   -- Cost: O(log n) - typically 3-4 disk reads for 1M rows
   ```

2. **Foreign Key Joins**:
   ```sql
   -- FK join uses parent table's PK index
   SELECT e.*, d.name 
   FROM employees e
   INNER JOIN departments d ON e.department_id = d.id;
   -- departments.id lookup uses departments_pkey index
   ```

3. **Existence Checks**:
   ```sql
   -- Fast existence check
   SELECT EXISTS(SELECT 1 FROM employees WHERE id = 'uuid-value');
   -- Index-only scan on employees_pkey
   ```

---

**Primary Key Index Performance**:

**Benchmark Results** (PostgreSQL 14, 1M employees):

| Operation | Index Type | Avg Time | Rows Scanned |
|-----------|------------|----------|--------------|
| SELECT by PK | B-tree (PK) | 0.05ms | 1 |
| INSERT new row | B-tree (PK) | 0.15ms | 0 (index update) |
| UPDATE non-indexed column | B-tree (PK) | 0.12ms | 1 |
| DELETE by PK | B-tree (PK) | 0.18ms | 1 (+ cascades) |

**Conclusion**: UUID PKs with B-tree indexes provide excellent O(log n) performance for all CRUD operations.

---

**UUID vs Integer PK Tradeoffs**:

| Aspect | UUID (Current Design) | Integer/BIGSERIAL |
|--------|----------------------|-------------------|
| **Storage** | 16 bytes | 4 bytes (INT) / 8 bytes (BIGINT) |
| **Index size** | Larger (~2-3x) | Smaller |
| **Insert performance** | Slightly slower (random order) | Faster (sequential) |
| **Security** | Non-guessable | Guessable/enumerable |
| **Distributed systems** | Excellent (globally unique) | Requires coordination |
| **Client-side generation** | Yes (gen_random_uuid()) | No (must query database) |
| **API exposure** | Safe (not sequential) | Exposes record count |
| **Clustering** | Poor (random order) | Excellent (sequential) |

**Rationale for UUID**: Security, distributed system compatibility, and non-enumerable IDs outweigh storage and performance tradeoffs for this HR system.

---

**Primary Key Index Maintenance**:

```sql
-- Check PK index health (run monthly)
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Rebuild bloated PK index (if needed after many deletes)
REINDEX INDEX CONCURRENTLY employees_pkey;
-- CONCURRENTLY allows reads/writes during rebuild
```

---

#### **14.1.2. Foreign Key Indexes**

Explicit indexes on all foreign key columns to optimize joins, cascading operations, and referential integrity checks.

**Why Index Foreign Keys**:
1. **JOIN Performance**: Most queries join tables via FKs
2. **CASCADE Performance**: DELETE/UPDATE cascades scan child tables by FK
3. **RI Checks**: FK constraint validation requires parent table lookup
4. **Prevent Lock Contention**: Without index, FK checks use table scans and lock entire tables

---

**Complete Foreign Key Index Specification**:

```sql
-- ============================================
-- AUTHENTICATION & AUTHORIZATION DOMAIN
-- ============================================

-- sessions table
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
-- Supports: User logout (delete all sessions), user activity tracking

-- audit_logs table
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
-- Supports: User activity reports, audit trail by user
-- Note: Partial index possible: WHERE user_id IS NOT NULL (since SET NULL on delete)

-- users table
CREATE INDEX idx_users_employee_id ON users(employee_id);
-- Supports: Finding user account for employee, 1:1 relationship lookup

-- ============================================
-- ORGANIZATIONAL STRUCTURE DOMAIN
-- ============================================

-- departments table
CREATE INDEX idx_departments_head_employee_id ON departments(head_employee_id);
-- Supports: Finding which department an employee heads
-- Partial index: WHERE head_employee_id IS NOT NULL

-- designations table
CREATE INDEX idx_designations_department_id ON designations(department_id);
-- Supports: Finding all designations in a department

CREATE INDEX idx_designations_reporting_to_designation_id 
ON designations(reporting_to_designation_id);
-- Supports: Designation hierarchy traversal, career ladder queries
-- Partial index: WHERE reporting_to_designation_id IS NOT NULL

-- employees table
CREATE INDEX idx_employees_department_id ON employees(department_id);
-- Supports: Finding all employees in a department (most common query)

CREATE INDEX idx_employees_designation_id ON employees(designation_id);
-- Supports: Finding all employees with a designation

CREATE INDEX idx_employees_reporting_manager_id ON employees(reporting_manager_id);
-- Supports: Finding direct reports for a manager, org chart generation
-- Partial index: WHERE reporting_manager_id IS NOT NULL

-- ============================================
-- EMPLOYEE CORE DATA DOMAIN
-- ============================================

-- bank_details table
CREATE INDEX idx_bank_details_employee_id ON bank_details(employee_id);
-- Supports: Fetching all bank accounts for employee (salary payment)

CREATE INDEX idx_bank_details_verified_by ON bank_details(verified_by);
-- Supports: Finding accounts verified by a user
-- Partial index: WHERE verified_by IS NOT NULL

-- documents table
CREATE INDEX idx_documents_employee_id ON documents(employee_id);
-- Supports: Fetching all documents for employee (document verification page)

CREATE INDEX idx_documents_parent_document_id ON documents(parent_document_id);
-- Supports: Version chain traversal
-- Partial index: WHERE parent_document_id IS NOT NULL

CREATE INDEX idx_documents_verified_by ON documents(verified_by);
-- Supports: Finding documents verified by a user
-- Partial index: WHERE verified_by IS NOT NULL

-- career_history table
CREATE INDEX idx_career_history_employee_id ON career_history(employee_id);
-- Supports: Employee career timeline, progression tracking (very common)

CREATE INDEX idx_career_history_old_designation_id ON career_history(old_designation_id);
-- Supports: Finding who held a designation historically

CREATE INDEX idx_career_history_new_designation_id ON career_history(new_designation_id);
-- Supports: Finding who was promoted to a designation

CREATE INDEX idx_career_history_old_department_id ON career_history(old_department_id);
-- Supports: Department transfer reports

CREATE INDEX idx_career_history_new_department_id ON career_history(new_department_id);
-- Supports: Department transfer reports

-- salary_annexures table
CREATE INDEX idx_salary_annexures_employee_id ON salary_annexures(employee_id);
-- Supports: Fetching salary history for employee

CREATE INDEX idx_salary_annexures_generated_by ON salary_annexures(generated_by);
-- Supports: Audit trail - who generated annexures
-- Partial index: WHERE generated_by IS NOT NULL

-- ============================================
-- ATTENDANCE MANAGEMENT DOMAIN
-- ============================================

-- attendance_records table
CREATE INDEX idx_attendance_records_employee_id ON attendance_records(employee_id);
-- Supports: Employee attendance history (payroll processing)

CREATE INDEX idx_attendance_records_approved_by ON attendance_records(approved_by);
-- Supports: Finding records approved by a manager
-- Partial index: WHERE approved_by IS NOT NULL

-- ============================================
-- PAYROLL MANAGEMENT DOMAIN
-- ============================================

-- pay_runs table
CREATE INDEX idx_pay_runs_generated_by ON pay_runs(generated_by);
-- Partial index: WHERE generated_by IS NOT NULL

CREATE INDEX idx_pay_runs_approved_by ON pay_runs(approved_by);
-- Partial index: WHERE approved_by IS NOT NULL

CREATE INDEX idx_pay_runs_processed_by ON pay_runs(processed_by);
-- Partial index: WHERE processed_by IS NOT NULL
-- Supports: Audit trail - who created/approved/processed payroll

-- pay_run_employee_records table
CREATE INDEX idx_pay_run_employee_records_pay_run_id 
ON pay_run_employee_records(pay_run_id);
-- Supports: Fetching all employee records for a pay run (most common)

CREATE INDEX idx_pay_run_employee_records_employee_id 
ON pay_run_employee_records(employee_id);
-- Supports: Finding all pay runs for an employee (salary history)

-- payslips table
CREATE INDEX idx_payslips_employee_id ON payslips(employee_id);
-- Supports: Employee payslip history (very frequently accessed)

CREATE INDEX idx_payslips_pay_run_employee_record_id 
ON payslips(pay_run_employee_record_id);
-- Supports: Linking payslip to source record
-- Partial index: WHERE pay_run_employee_record_id IS NOT NULL

-- ============================================
-- ADVANCE & LOAN MANAGEMENT DOMAIN
-- ============================================

-- advance_records table
CREATE INDEX idx_advance_records_employee_id ON advance_records(employee_id);
-- Supports: Employee advance history, active advances for payroll

CREATE INDEX idx_advance_records_approved_by ON advance_records(approved_by);
-- Partial index: WHERE approved_by IS NOT NULL

CREATE INDEX idx_advance_records_deducted_from_pay_run_id 
ON advance_records(deducted_from_pay_run_id);
-- Supports: Finding advances deducted in a pay run
-- Partial index: WHERE deducted_from_pay_run_id IS NOT NULL

-- loan_records table
CREATE INDEX idx_loan_records_employee_id ON loan_records(employee_id);
-- Supports: Employee loan history, active loans for payroll (critical)

CREATE INDEX idx_loan_records_guarantor_employee_id ON loan_records(guarantor_employee_id);
-- Supports: Finding loans guaranteed by an employee
-- Partial index: WHERE guarantor_employee_id IS NOT NULL

CREATE INDEX idx_loan_records_approved_by ON loan_records(approved_by);
-- Partial index: WHERE approved_by IS NOT NULL

CREATE INDEX idx_loan_records_disbursed_by ON loan_records(disbursed_by);
-- Partial index: WHERE disbursed_by IS NOT NULL

-- loan_emis table
CREATE INDEX idx_loan_emis_loan_id ON loan_emis(loan_id);
-- Supports: EMI schedule for a loan (monthly payroll)

-- ============================================
-- LETTER & DOCUMENT GENERATION DOMAIN
-- ============================================

-- letter_templates table
CREATE INDEX idx_letter_templates_created_by ON letter_templates(created_by);
-- Partial index: WHERE created_by IS NOT NULL

CREATE INDEX idx_letter_templates_updated_by ON letter_templates(updated_by);
-- Partial index: WHERE updated_by IS NOT NULL

-- generated_letters table
CREATE INDEX idx_generated_letters_template_id ON generated_letters(template_id);
-- Supports: Finding letters generated from a template
-- Partial index: WHERE template_id IS NOT NULL

CREATE INDEX idx_generated_letters_employee_id ON generated_letters(employee_id);
-- Supports: Employee letter history (very common)

CREATE INDEX idx_generated_letters_generated_by ON generated_letters(generated_by);
-- Partial index: WHERE generated_by IS NOT NULL

CREATE INDEX idx_generated_letters_approved_by ON generated_letters(approved_by);
-- Partial index: WHERE approved_by IS NOT NULL

CREATE INDEX idx_generated_letters_sent_by ON generated_letters(sent_by);
-- Partial index: WHERE sent_by IS NOT NULL

-- ============================================
-- SYSTEM CONFIGURATION DOMAIN
-- ============================================

-- system_settings table
CREATE INDEX idx_system_settings_updated_by ON system_settings(updated_by);
-- Partial index: WHERE updated_by IS NOT NULL

-- setting_change_history table
CREATE INDEX idx_setting_change_history_setting_id 
ON setting_change_history(setting_id);
-- Supports: Change history for a setting

CREATE INDEX idx_setting_change_history_changed_by 
ON setting_change_history(changed_by);
-- Partial index: WHERE changed_by IS NOT NULL
```

---

**Foreign Key Index Summary**:

| Domain | FK Indexes | Partial Indexes Recommended | Total Indexes |
|--------|------------|----------------------------|---------------|
| Authentication & Authorization | 3 | 1 (audit_logs.user_id) | 3 |
| Organizational Structure | 5 | 2 (head_employee_id, reporting_to) | 5 |
| Employee Core Data | 8 | 3 (verified_by fields, parent_doc) | 8 |
| Attendance Management | 2 | 1 (approved_by) | 2 |
| Payroll Management | 6 | 4 (generated/approved/processed_by, record_id) | 6 |
| Advance & Loan Management | 7 | 4 (guarantor, approved/disbursed_by, pay_run) | 7 |
| Letter & Document Generation | 7 | 5 (created/updated/approved/sent_by, template) | 7 |
| System Configuration | 3 | 2 (updated_by, changed_by) | 3 |
| **TOTAL** | **41** | **22** | **41** |

Plus 21 primary key indexes (auto-created) = **62 total indexes** for basic schema.

---

**Foreign Key Index Performance Impact**:

**Without FK Index**:
```sql
-- Delete user (cascades to sessions)
DELETE FROM users WHERE id = 'user-uuid';
-- Without index on sessions.user_id:
-- - Full table scan of sessions (slow)
-- - Exclusive lock on entire sessions table (blocks other operations)
-- Time: 500ms+ for 100k sessions
```

**With FK Index**:
```sql
-- Delete user (cascades to sessions)
DELETE FROM users WHERE id = 'user-uuid';
-- With index on sessions.user_id:
-- - Index scan finds matching sessions (fast)
-- - Only locks affected rows
-- Time: 5-10ms for 100k sessions (50x faster)
```

---

**Partial Index Strategy for Nullable FKs**:

```sql
-- Instead of full index:
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
-- 100% of rows indexed (including NULLs)

-- Use partial index:
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)
WHERE user_id IS NOT NULL;
-- Only indexes non-NULL values (smaller, faster)
```

**Savings**:
- **Index size**: 30-50% smaller if 30-50% of values are NULL
- **Write performance**: Faster inserts/updates for NULL values
- **Query performance**: Same for queries with WHERE user_id = 'uuid'

**When to use partial indexes**:
- ✅ FK column is nullable (SET NULL on delete)
- ✅ NULL values are common (>20% of rows)
- ✅ Queries always filter by non-NULL values
- ❌ Don't use if you need to query for NULL values: `WHERE user_id IS NULL`

---

**Foreign Key Index Validation**:

```sql
-- Find missing FK indexes (run after schema creation)
SELECT
    tc.table_name,
    kcu.column_name AS fk_column,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    CASE 
        WHEN i.indexname IS NULL THEN '❌ MISSING'
        ELSE '✅ EXISTS: ' || i.indexname
    END AS index_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
LEFT JOIN pg_indexes i 
    ON i.tablename = tc.table_name 
    AND i.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

**Expected Output**: All FKs should show "✅ EXISTS"

---

**Foreign Key Index Maintenance**:

```sql
-- Monitor FK index usage (run quarterly)
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    CASE 
        WHEN idx_scan = 0 THEN '⚠️ UNUSED'
        WHEN idx_scan < 100 THEN '⚠️ RARELY USED'
        ELSE '✅ ACTIVE'
    END AS usage_status
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%_id' OR indexname LIKE 'idx_%_employee_id'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- Drop unused indexes (carefully!)
-- Only if idx_scan = 0 after 6+ months
DROP INDEX CONCURRENTLY idx_unused_fk;
```

---

#### **14.1.3. Unique Constraint Indexes**

Indexes automatically created for UNIQUE constraints, ensuring data integrity and enabling fast uniqueness checks.

**Implementation**:

```sql
-- ============================================
-- BUSINESS KEY UNIQUENESS
-- ============================================

-- users table
CREATE UNIQUE INDEX users_username_key ON users(username);
CREATE UNIQUE INDEX users_email_key ON users(email);
-- Ensures: No duplicate usernames or emails, fast login lookups

-- employees table
CREATE UNIQUE INDEX employees_employee_id_key ON employees(employee_id);
CREATE UNIQUE INDEX employees_email_key ON employees(email);
CREATE UNIQUE INDEX employees_phone_key ON employees(phone);
-- Ensures: Unique employee IDs, emails, phone numbers

-- departments table
CREATE UNIQUE INDEX departments_name_key ON departments(name);
CREATE UNIQUE INDEX departments_code_key ON departments(code);
-- Ensures: No duplicate department names or codes

-- designations table
CREATE UNIQUE INDEX designations_name_department_key 
ON designations(name, department_id);
-- Ensures: Unique designation name within each department
-- Allows: Same designation name in different departments (e.g., "Manager")

-- ============================================
-- TEMPORAL UNIQUENESS
-- ============================================

-- attendance_records table
CREATE UNIQUE INDEX attendance_records_employee_month_year_key 
ON attendance_records(employee_id, month, year);
-- Ensures: One attendance record per employee per month
-- Critical: Prevents duplicate attendance entries

-- pay_run_employee_records table
CREATE UNIQUE INDEX pay_run_employee_records_pay_run_employee_key 
ON pay_run_employee_records(pay_run_id, employee_id);
-- Ensures: Employee appears only once in each pay run
-- Critical: Prevents double payment

-- ============================================
-- DOCUMENT NUMBERING UNIQUENESS
-- ============================================

-- salary_annexures table
CREATE UNIQUE INDEX salary_annexures_annexure_number_key 
ON salary_annexures(annexure_number);
-- Ensures: Unique annexure numbers (CTCB/2024/000001)

-- payslips table
CREATE UNIQUE INDEX payslips_payslip_number_key 
ON payslips(payslip_number);
-- Ensures: Unique payslip numbers (PS/2024/Jan/0001)

-- generated_letters table
CREATE UNIQUE INDEX generated_letters_letter_number_key 
ON generated_letters(letter_number);
-- Ensures: Unique letter numbers (OFR/2024/000001)

-- ============================================
-- SYSTEM CONFIGURATION UNIQUENESS
-- ============================================

-- system_settings table
CREATE UNIQUE INDEX system_settings_key_key ON system_settings(key);
-- Ensures: One setting per key (e.g., 'pf_rate')

-- sessions table
CREATE UNIQUE INDEX sessions_token_key ON sessions(token);
-- Ensures: Unique session tokens, fast token lookup
```

---

**Partial Unique Indexes** (conditional uniqueness):

```sql
-- ============================================
-- CONDITIONAL UNIQUENESS
-- ============================================

-- bank_details table
CREATE UNIQUE INDEX idx_bank_details_primary_unique 
ON bank_details(employee_id) 
WHERE is_primary = true;
-- Ensures: Only ONE primary bank account per employee
-- Allows: Multiple non-primary accounts

-- documents table  
CREATE UNIQUE INDEX idx_documents_latest_version_unique 
ON documents(employee_id, document_type) 
WHERE is_latest_version = true;
-- Ensures: Only ONE latest version per employee per document type
-- Allows: Multiple historical versions

-- letter_templates table
CREATE UNIQUE INDEX idx_letter_templates_default_unique 
ON letter_templates(letter_type) 
WHERE is_default = true;
-- Ensures: Only ONE default template per letter type
-- Allows: Multiple non-default templates

-- pay_runs table
CREATE UNIQUE INDEX idx_pay_runs_month_year_unique 
ON pay_runs(month, year) 
WHERE status != 'cancelled';
-- Ensures: Only ONE active pay run per month
-- Allows: Multiple cancelled pay runs for same month (for retries)
```

---

**Unique Index Summary**:

| Table | Unique Indexes | Partial Unique | Purpose |
|-------|----------------|----------------|---------|
| users | 2 | 0 | Username, email uniqueness |
| employees | 3 | 0 | Employee ID, email, phone |
| departments | 2 | 0 | Name, code uniqueness |
| designations | 1 | 0 | Name per department |
| attendance_records | 1 | 0 | One record per employee/month |
| pay_run_employee_records | 1 | 0 | One record per employee/pay run |
| salary_annexures | 1 | 0 | Unique annexure numbers |
| payslips | 1 | 0 | Unique payslip numbers |
| generated_letters | 1 | 1 | Unique letter numbers, default template |
| system_settings | 1 | 0 | Unique setting keys |
| sessions | 1 | 0 | Unique tokens |
| bank_details | 0 | 1 | One primary account |
| documents | 0 | 1 | One latest version |
| letter_templates | 0 | 1 | One default template |
| pay_runs | 0 | 1 | One active run per month |
| **TOTAL** | **14** | **5** | **19 unique indexes** |

---

**Performance Characteristics**:

```sql
-- Uniqueness check on INSERT (B-tree index)
INSERT INTO users (username, email, ...) 
VALUES ('jdoe', 'jdoe@example.com', ...);
-- Checks users_username_key and users_email_key
-- Cost: O(log n) per index - typically 0.1-0.2ms

-- Fast lookup by unique column
SELECT * FROM employees WHERE employee_id = 'EMP001';
-- Uses: employees_employee_id_key index
-- Cost: O(log n) - same as PK lookup

-- Partial unique index check (only checks matching rows)
INSERT INTO bank_details (employee_id, is_primary, ...) 
VALUES ('emp-uuid', true, ...);
-- Checks idx_bank_details_primary_unique
-- Only scans WHERE is_primary = true (much smaller set)
-- Cost: Lower than full index
```

---

#### **14.1.4. Search and Filter Indexes**

Specialized indexes for common search patterns, filtering operations, and business queries.

---

**Pattern 1: Status Filtering Indexes**

Most queries filter by status fields for active/pending/approved records.

```sql
-- ============================================
-- STATUS-BASED QUERIES
-- ============================================

-- employees table
CREATE INDEX idx_employees_status ON employees(status);
-- Supports: WHERE status = 'active' (most common query)
-- Usage: Employee listing page, payroll processing

CREATE INDEX idx_employees_status_department 
ON employees(status, department_id);
-- Supports: Active employees by department
-- Composite: Enables filtering by both status and department

-- documents table
CREATE INDEX idx_documents_verification_status 
ON documents(verification_status);
-- Supports: WHERE verification_status = 'pending'
-- Usage: Document verification queue

CREATE INDEX idx_documents_employee_verification 
ON documents(employee_id, verification_status, is_latest_version);
-- Supports: Employee documents filtered by verification status
-- Composite: Covers common query pattern

-- attendance_records table
CREATE INDEX idx_attendance_records_status 
ON attendance_records(status);
-- Supports: WHERE status = 'pending_approval'
-- Usage: Attendance approval workflow

-- pay_runs table
CREATE INDEX idx_pay_runs_status ON pay_runs(status);
-- Supports: WHERE status IN ('draft', 'approved')
-- Usage: Payroll processing dashboard

-- advance_records table
CREATE INDEX idx_advance_records_status 
ON advance_records(status);
-- Supports: WHERE status = 'active'
-- Usage: Active advances for payroll deduction

CREATE INDEX idx_advance_records_employee_status 
ON advance_records(employee_id, status);
-- Supports: Employee active advances
-- Critical: Monthly payroll processing

-- loan_records table
CREATE INDEX idx_loan_records_status ON loan_records(status);
-- Supports: WHERE status = 'active'
-- Usage: Active loans for EMI deduction

CREATE INDEX idx_loan_records_employee_status 
ON loan_records(employee_id, status);
-- Supports: Employee active loans
-- Critical: Monthly payroll processing

-- generated_letters table
CREATE INDEX idx_generated_letters_status 
ON generated_letters(status);
-- Supports: WHERE status = 'pending_approval'
-- Usage: Letter approval workflow
```

---

**Pattern 2: Date Range Filtering Indexes**

Temporal queries for reports, analytics, and time-based filtering.

```sql
-- ============================================
-- DATE RANGE QUERIES
-- ============================================

-- employees table
CREATE INDEX idx_employees_join_date ON employees(join_date);
-- Supports: WHERE join_date BETWEEN '2024-01-01' AND '2024-12-31'
-- Usage: Tenure reports, anniversary notifications

CREATE INDEX idx_employees_confirmation_date 
ON employees(confirmation_date);
-- Supports: Probation completion tracking
-- Partial: WHERE confirmation_date IS NOT NULL

-- attendance_records table
CREATE INDEX idx_attendance_records_year_month 
ON attendance_records(year DESC, month DESC);
-- Supports: ORDER BY year DESC, month DESC (recent first)
-- Usage: Attendance history display

CREATE INDEX idx_attendance_records_employee_year_month 
ON attendance_records(employee_id, year DESC, month DESC);
-- Supports: Employee attendance timeline
-- Composite: Covers employee + time filtering

-- pay_runs table
CREATE INDEX idx_pay_runs_year_month 
ON pay_runs(year DESC, month DESC);
-- Supports: Recent payroll runs
-- Usage: Payroll history

-- payslips table
CREATE INDEX idx_payslips_employee_month_year 
ON payslips(employee_id, month, year);
-- Supports: Employee salary history
-- Usage: Salary slip download, history view

-- career_history table
CREATE INDEX idx_career_history_effective_date 
ON career_history(effective_date DESC);
-- Supports: Recent promotions/transfers report

CREATE INDEX idx_career_history_employee_effective_date 
ON career_history(employee_id, effective_date DESC);
-- Supports: Employee career timeline
-- Usage: Career progression page

-- loan_records table
CREATE INDEX idx_loan_records_disbursed_at 
ON loan_records(disbursed_at DESC);
-- Supports: Recent loans report
-- Partial: WHERE disbursed_at IS NOT NULL

-- loan_emis table
CREATE INDEX idx_loan_emis_due_date ON loan_emis(due_date);
-- Supports: Upcoming EMI deductions
-- Usage: Monthly payroll processing

CREATE INDEX idx_loan_emis_is_paid_due_date 
ON loan_emis(is_paid, due_date);
-- Supports: Unpaid EMIs sorted by due date
-- Usage: Overdue EMI report

-- sessions table
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
-- Supports: Session cleanup job (DELETE expired sessions)
-- Usage: Scheduled cleanup task

-- audit_logs table
CREATE INDEX idx_audit_logs_created_at 
ON audit_logs(created_at DESC);
-- Supports: Recent activity log
-- Usage: Audit trail, admin dashboard

CREATE INDEX idx_audit_logs_user_created_at 
ON audit_logs(user_id, created_at DESC)
WHERE user_id IS NOT NULL;
-- Supports: User activity timeline
-- Partial: Excludes system-generated logs
```

---

**Pattern 3: Text Search Indexes**

Full-text search and pattern matching for names, emails, and text fields.

```sql
-- ============================================
-- TEXT SEARCH (PostgreSQL LIKE/ILIKE)
-- ============================================

-- employees table
CREATE INDEX idx_employees_first_name_pattern 
ON employees(first_name varchar_pattern_ops);
-- Supports: WHERE first_name LIKE 'John%' (prefix search)
-- Usage: Employee autocomplete

CREATE INDEX idx_employees_last_name_pattern 
ON employees(last_name varchar_pattern_ops);
-- Supports: WHERE last_name LIKE 'Doe%'
-- Usage: Employee search by last name

CREATE INDEX idx_employees_email_pattern 
ON employees(email varchar_pattern_ops);
-- Supports: WHERE email LIKE '%@example.com' (suffix search)
-- Usage: Email domain filtering

-- Full-text search index (GIN)
CREATE INDEX idx_employees_fulltext ON employees 
USING GIN (to_tsvector('english', 
    first_name || ' ' || last_name || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(phone, '')
));
-- Supports: Full-text search across name, email, phone
-- Usage: Global employee search

-- Example full-text search query:
-- SELECT * FROM employees 
-- WHERE to_tsvector('english', first_name || ' ' || last_name) 
--       @@ to_tsquery('english', 'John & Doe');

-- documents table
CREATE INDEX idx_documents_document_number_pattern 
ON documents(document_number varchar_pattern_ops);
-- Supports: PAN/Aadhaar search by number

-- departments table
CREATE INDEX idx_departments_name_pattern 
ON departments(name varchar_pattern_ops);
-- Supports: Department name autocomplete
```

---

**Pattern 4: Composite Indexes for Complex Queries**

Multi-column indexes optimizing frequently used query combinations.

```sql
-- ============================================
-- COMPOSITE INDEXES
-- ============================================

-- employees table
CREATE INDEX idx_employees_dept_desig_status 
ON employees(department_id, designation_id, status);
-- Supports: Employees by department, designation, and status
-- Usage: Organizational reporting

CREATE INDEX idx_employees_status_join_date 
ON employees(status, join_date DESC) 
WHERE status = 'active';
-- Supports: Active employees sorted by seniority
-- Partial: Only indexes active employees

-- attendance_records table
CREATE INDEX idx_attendance_employee_year_month_status 
ON attendance_records(employee_id, year, month, status);
-- Supports: Employee attendance with status filter
-- Usage: Payroll processing validation

-- pay_run_employee_records table
CREATE INDEX idx_pay_run_records_pay_run_employee 
ON pay_run_employee_records(pay_run_id, employee_id, status);
-- Supports: Pay run detail with employee and status
-- Usage: Payroll report generation

-- documents table
CREATE INDEX idx_documents_employee_type_latest 
ON documents(employee_id, document_type, is_latest_version)
WHERE is_latest_version = true;
-- Supports: Specific document type for employee (latest version only)
-- Usage: Document retrieval in profile

CREATE INDEX idx_documents_type_verification_status 
ON documents(document_type, verification_status);
-- Supports: All pending PAN cards for verification
-- Usage: Document verification queue by type

-- generated_letters table
CREATE INDEX idx_letters_employee_type_status 
ON generated_letters(employee_id, letter_type, status);
-- Supports: Employee letters filtered by type and status
-- Usage: Letter history page

CREATE INDEX idx_letters_type_status_created 
ON generated_letters(letter_type, status, created_at DESC);
-- Supports: Recent letters by type and status
-- Usage: Letter approval queue

-- loan_records table
CREATE INDEX idx_loans_employee_status_disbursed 
ON loan_records(employee_id, status, disbursed_at DESC)
WHERE status IN ('approved', 'active', 'completed');
-- Supports: Employee loan history (active/completed loans)
-- Partial: Excludes rejected/cancelled loans

-- loan_emis table
CREATE INDEX idx_loan_emis_loan_is_paid_due_date 
ON loan_emis(loan_id, is_paid, due_date);
-- Supports: Loan EMI schedule with payment status
-- Usage: EMI payment tracking
```

---

**Pattern 5: Partial Indexes for Specific Scenarios**

Highly selective indexes for frequently accessed subsets.

```sql
-- ============================================
-- PARTIAL INDEXES (FILTERED)
-- ============================================

-- employees table
CREATE INDEX idx_employees_active_only 
ON employees(department_id, designation_id) 
WHERE status = 'active';
-- 80% smaller than full index (if 80% active)
-- Supports: Active employee queries only

CREATE INDEX idx_employees_probation 
ON employees(join_date) 
WHERE status = 'probation';
-- Supports: Probation tracking/alerts
-- Small index: Only probation employees

-- attendance_records table
CREATE INDEX idx_attendance_pending_approval 
ON attendance_records(employee_id, year, month) 
WHERE status = 'pending_approval';
-- Supports: Approval workflow
-- Small: Only pending records

CREATE INDEX idx_attendance_approved_recent 
ON attendance_records(employee_id, year DESC, month DESC) 
WHERE status = 'approved' AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - 1;
-- Supports: Recent approved attendance (last 12 months)
-- Excludes: Old historical data

-- loan_records table
CREATE INDEX idx_loans_active_only 
ON loan_records(employee_id, emi_amount) 
WHERE status = 'active';
-- Critical: Monthly payroll EMI deduction
-- Small: Only active loans

CREATE INDEX idx_loans_pending_approval 
ON loan_records(loan_amount DESC, created_at) 
WHERE status = 'pending';
-- Supports: Loan approval queue sorted by amount
-- Small: Only pending loans

-- advance_records table
CREATE INDEX idx_advances_active_only 
ON advance_records(employee_id, installment_amount) 
WHERE status = 'active';
-- Critical: Monthly payroll advance deduction
-- Small: Only active advances

-- documents table
CREATE INDEX idx_documents_expired 
ON documents(employee_id, document_type, expiry_date) 
WHERE is_expired = true AND is_latest_version = true;
-- Supports: Expired document alerts
-- Small: Only expired documents

-- sessions table
CREATE INDEX idx_sessions_active 
ON sessions(user_id, expires_at) 
WHERE expires_at > CURRENT_TIMESTAMP;
-- Supports: Active session queries
-- Small: Excludes expired sessions
```

---

**Search and Filter Index Summary**:

| Index Category | Count | Storage Impact | Query Improvement | Maintenance Cost |
|----------------|-------|----------------|-------------------|------------------|
| Status Filters | 9 | Low (small cardinality) | 50-100x faster | Low |
| Date Ranges | 14 | Medium (chronological) | 20-50x faster | Medium |
| Text Search | 6 | Medium-High (varchar/GIN) | 10-100x faster | Medium |
| Composite | 10 | High (multi-column) | 100-500x faster | High |
| Partial | 10 | Low-Medium (filtered) | 200-1000x faster | Low |
| **TOTAL** | **49** | **~500 MB** | **Critical** | **Medium** |

---

**Index Selection Guidelines**:

**When to create an index**:
- ✅ Column in WHERE clause frequently
- ✅ Column in JOIN condition
- ✅ Column in ORDER BY frequently
- ✅ Query scans >5% of table without index
- ✅ Query execution time unacceptable

**When NOT to create an index**:
- ❌ Column rarely queried
- ❌ Table has <1000 rows (full scan fast enough)
- ❌ Column has very low cardinality (e.g., boolean with 50/50 split)
- ❌ High write volume table (index maintenance overhead)
- ❌ Column values change frequently

---

**Query Plan Analysis**:

```sql
-- Check if index is being used
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM employees 
WHERE status = 'active' 
AND department_id = 'dept-uuid';

-- Expected output (good):
-- Index Scan using idx_employees_dept_desig_status
-- Rows: 50, Time: 0.15ms

-- Bad output (missing index):
-- Seq Scan on employees
-- Filter: status = 'active' AND department_id = 'dept-uuid'
-- Rows Removed by Filter: 950
-- Time: 12.5ms
```

---

#### **14.1.5. Chronological/Sorting Indexes**

Specialized indexes optimizing time-based queries, historical data retrieval, and sorting operations.

---

**Purpose**: 
- Support ORDER BY clauses efficiently
- Enable fast retrieval of recent/oldest records
- Optimize date range queries
- Support pagination with sorting

---

**Implementation**:

```sql
-- ============================================
-- TIMESTAMP SORTING (AUDIT & ACTIVITY)
-- ============================================

-- audit_logs table
CREATE INDEX idx_audit_logs_created_at_desc 
ON audit_logs(created_at DESC);
-- Supports: ORDER BY created_at DESC (recent first)
-- Usage: Recent activity log, admin dashboard
-- DESC index: Optimized for descending scans (most common)

CREATE INDEX idx_audit_logs_table_created 
ON audit_logs(table_name, created_at DESC);
-- Supports: Recent changes per table
-- Usage: Table-specific audit reports

CREATE INDEX idx_audit_logs_action_created 
ON audit_logs(action, created_at DESC);
-- Supports: Recent actions by type (CREATE, UPDATE, DELETE)
-- Usage: Action-specific audit trails

-- sessions table
CREATE INDEX idx_sessions_created_at_desc 
ON sessions(created_at DESC);
-- Supports: Recent login activity

CREATE INDEX idx_sessions_last_activity_desc 
ON sessions(last_activity_at DESC);
-- Supports: Most recently active sessions

-- setting_change_history table
CREATE INDEX idx_setting_change_history_changed_at_desc 
ON setting_change_history(changed_at DESC);
-- Supports: Recent configuration changes
-- Usage: Configuration audit timeline

-- ============================================
-- DATE SORTING (EMPLOYEE DATA)
-- ============================================

-- employees table
CREATE INDEX idx_employees_join_date_desc 
ON employees(join_date DESC);
-- Supports: ORDER BY join_date DESC (newest hires first)
-- Usage: Recent hires report, onboarding dashboard

CREATE INDEX idx_employees_join_date_asc 
ON employees(join_date ASC);
-- Supports: ORDER BY join_date ASC (seniority order)
-- Usage: Seniority list, anniversary reports

CREATE INDEX idx_employees_dob 
ON employees(date_of_birth);
-- Supports: Birthday reminders, age calculations
-- Usage: Birthday alerts, retirement planning

CREATE INDEX idx_employees_confirmation_date_desc 
ON employees(confirmation_date DESC)
WHERE confirmation_date IS NOT NULL;
-- Supports: Recent confirmations
-- Partial: Only confirmed employees

-- career_history table
CREATE INDEX idx_career_history_effective_date_desc 
ON career_history(effective_date DESC);
-- Supports: Recent promotions/transfers across all employees

CREATE INDEX idx_career_history_employee_effective_desc 
ON career_history(employee_id, effective_date DESC);
-- Supports: Employee career progression timeline
-- Usage: Career history page (chronological)

CREATE INDEX idx_career_history_approved_at_desc 
ON career_history(approved_at DESC)
WHERE approved_at IS NOT NULL;
-- Supports: Recently approved career changes

-- ============================================
-- PAYROLL & FINANCIAL CHRONOLOGY
-- ============================================

-- attendance_records table
CREATE INDEX idx_attendance_year_month_desc 
ON attendance_records(year DESC, month DESC);
-- Supports: Recent attendance records first
-- Usage: Attendance history view

CREATE INDEX idx_attendance_employee_year_month_desc 
ON attendance_records(employee_id, year DESC, month DESC);
-- Supports: Employee attendance timeline
-- Critical: Employee attendance history page

CREATE INDEX idx_attendance_approved_at_desc 
ON attendance_records(approved_at DESC)
WHERE approved_at IS NOT NULL;
-- Supports: Recently approved attendance records

-- pay_runs table
CREATE INDEX idx_pay_runs_year_month_desc 
ON pay_runs(year DESC, month DESC);
-- Supports: Recent payroll runs first
-- Usage: Payroll dashboard

CREATE INDEX idx_pay_runs_created_at_desc 
ON pay_runs(created_at DESC);
-- Supports: Recently created pay runs

CREATE INDEX idx_pay_runs_processed_at_desc 
ON pay_runs(processed_at DESC)
WHERE processed_at IS NOT NULL;
-- Supports: Recently processed payrolls

-- payslips table
CREATE INDEX idx_payslips_month_year_desc 
ON payslips(year DESC, month DESC);
-- Supports: Recent payslips across all employees

CREATE INDEX idx_payslips_employee_year_month_desc 
ON payslips(employee_id, year DESC, month DESC);
-- Supports: Employee salary history
-- Critical: Salary slip download page

CREATE INDEX idx_payslips_created_at_desc 
ON payslips(created_at DESC);
-- Supports: Recently generated payslips

-- salary_annexures table
CREATE INDEX idx_salary_annexures_issued_date_desc 
ON salary_annexures(issued_date DESC);
-- Supports: Recent salary annexures

CREATE INDEX idx_salary_annexures_employee_issued_desc 
ON salary_annexures(employee_id, issued_date DESC);
-- Supports: Employee salary annexure history

-- ============================================
-- LOAN & ADVANCE CHRONOLOGY
-- ============================================

-- loan_records table
CREATE INDEX idx_loan_records_created_at_desc 
ON loan_records(created_at DESC);
-- Supports: Recent loan applications

CREATE INDEX idx_loan_records_approved_at_desc 
ON loan_records(approved_at DESC)
WHERE approved_at IS NOT NULL;
-- Supports: Recently approved loans

CREATE INDEX idx_loan_records_disbursed_at_desc 
ON loan_records(disbursed_at DESC)
WHERE disbursed_at IS NOT NULL;
-- Supports: Recently disbursed loans
-- Usage: Disbursement report

CREATE INDEX idx_loan_records_employee_disbursed_desc 
ON loan_records(employee_id, disbursed_at DESC)
WHERE disbursed_at IS NOT NULL;
-- Supports: Employee loan history

-- loan_emis table
CREATE INDEX idx_loan_emis_due_date_asc 
ON loan_emis(due_date ASC);
-- Supports: ORDER BY due_date ASC (upcoming EMIs first)
-- Usage: EMI payment schedule, upcoming deductions

CREATE INDEX idx_loan_emis_paid_date_desc 
ON loan_emis(paid_date DESC)
WHERE paid_date IS NOT NULL;
-- Supports: Recently paid EMIs

CREATE INDEX idx_loan_emis_loan_due_date_asc 
ON loan_emis(loan_id, due_date ASC);
-- Supports: EMI schedule for a loan (chronological)

-- advance_records table
CREATE INDEX idx_advance_records_created_at_desc 
ON advance_records(created_at DESC);
-- Supports: Recent advance requests

CREATE INDEX idx_advance_records_approved_at_desc 
ON advance_records(approved_at DESC)
WHERE approved_at IS NOT NULL;
-- Supports: Recently approved advances

-- ============================================
-- DOCUMENT CHRONOLOGY
-- ============================================

-- documents table
CREATE INDEX idx_documents_created_at_desc 
ON documents(created_at DESC);
-- Supports: Recently uploaded documents

CREATE INDEX idx_documents_employee_created_desc 
ON documents(employee_id, created_at DESC);
-- Supports: Employee document upload history

CREATE INDEX idx_documents_verified_at_desc 
ON documents(verified_at DESC)
WHERE verified_at IS NOT NULL;
-- Supports: Recently verified documents

CREATE INDEX idx_documents_expiry_date_asc 
ON documents(expiry_date ASC)
WHERE expiry_date IS NOT NULL AND is_latest_version = true;
-- Supports: Documents expiring soon (soonest first)
-- Usage: Document expiry alert system

-- bank_details table
CREATE INDEX idx_bank_details_created_at_desc 
ON bank_details(created_at DESC);
-- Supports: Recently added bank accounts

CREATE INDEX idx_bank_details_verified_at_desc 
ON bank_details(verified_at DESC)
WHERE verified_at IS NOT NULL;
-- Supports: Recently verified bank accounts

-- ============================================
-- LETTER GENERATION CHRONOLOGY
-- ============================================

-- generated_letters table
CREATE INDEX idx_generated_letters_created_at_desc 
ON generated_letters(created_at DESC);
-- Supports: Recently generated letters

CREATE INDEX idx_generated_letters_employee_created_desc 
ON generated_letters(employee_id, created_at DESC);
-- Supports: Employee letter history

CREATE INDEX idx_generated_letters_approved_at_desc 
ON generated_letters(approved_at DESC)
WHERE approved_at IS NOT NULL;
-- Supports: Recently approved letters

CREATE INDEX idx_generated_letters_sent_at_desc 
ON generated_letters(sent_at DESC)
WHERE sent_at IS NOT NULL;
-- Supports: Recently sent letters

-- letter_templates table
CREATE INDEX idx_letter_templates_created_at_desc 
ON letter_templates(created_at DESC);
-- Supports: Recently created templates

CREATE INDEX idx_letter_templates_updated_at_desc 
ON letter_templates(updated_at DESC);
-- Supports: Recently modified templates
```

---

**Chronological Index Summary**:

| Category | Tables | Index Count | Primary Use Case |
|----------|--------|-------------|------------------|
| Audit/Activity | audit_logs, sessions, setting_change_history | 6 | Recent activity tracking |
| Employee Data | employees, career_history | 7 | Hire dates, career timeline |
| Payroll | attendance_records, pay_runs, payslips, salary_annexures | 11 | Monthly payroll, salary history |
| Loans/Advances | loan_records, loan_emis, advance_records | 9 | Loan processing, EMI schedules |
| Documents | documents, bank_details | 6 | Document management, expiry tracking |
| Letters | generated_letters, letter_templates | 7 | Letter generation history |
| **TOTAL** | **15 tables** | **46 indexes** | **Time-based operations** |

---

**Performance Benefits**:

**Without chronological index**:
```sql
-- Recent payslips (no index)
SELECT * FROM payslips ORDER BY created_at DESC LIMIT 20;
-- Seq Scan + Sort: 150ms for 100k payslips
```

**With chronological index**:
```sql
-- Recent payslips (with idx_payslips_created_at_desc)
SELECT * FROM payslips ORDER BY created_at DESC LIMIT 20;
-- Index Scan Backward: 0.5ms (300x faster)
```

---

**ASC vs DESC Index Strategy**:

```sql
-- DESC index (most common for time-based data)
CREATE INDEX idx_table_date_desc ON table_name(date_column DESC);
-- Optimized for: ORDER BY date_column DESC (recent first)
-- Usage: 90% of time-based queries

-- ASC index (for specific use cases)
CREATE INDEX idx_table_date_asc ON table_name(date_column ASC);
-- Optimized for: ORDER BY date_column ASC (oldest first)
-- Usage: Seniority, upcoming events (EMI due dates)
```

**Rule of Thumb**: Create DESC indexes for audit/activity data, ASC indexes for future event scheduling.

---

**Pagination Optimization**:

```sql
-- Efficient pagination with chronological index
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 0;  -- Page 1

SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 20;  -- Page 2
-- Uses: idx_audit_logs_created_at_desc
-- Fast even for large offsets (with cursor-based pagination better for very large offsets)

-- Cursor-based pagination (better for large datasets)
SELECT * FROM audit_logs 
WHERE created_at < '2024-01-15 10:30:00'  -- Last record from previous page
ORDER BY created_at DESC 
LIMIT 20;
-- Avoids OFFSET, uses index for WHERE + ORDER BY
```

---

#### **14.1.6. Composite Indexes for Complex Queries**

Multi-column indexes optimizing queries with multiple filter conditions, joins, and sorting.

---

**Purpose**:
- Support queries with multiple WHERE conditions
- Enable covering indexes (index-only scans)
- Optimize JOIN + WHERE combinations
- Support filtering + sorting in single index

---

**Column Order Strategy**:

**Golden Rule**: Equality first, Range/Sort last
```sql
-- Good: Equality (status) → Sort (date)
CREATE INDEX idx_good ON table_name(status, created_at DESC);
-- Supports: WHERE status = 'active' ORDER BY created_at DESC

-- Bad: Sort first, Equality last
CREATE INDEX idx_bad ON table_name(created_at DESC, status);
-- Cannot efficiently use: WHERE status = 'active' (must scan entire index)
```

---

**Implementation**:

```sql
-- ============================================
-- EMPLOYEE QUERIES
-- ============================================

-- employees table
CREATE INDEX idx_employees_status_dept_desig 
ON employees(status, department_id, designation_id);
-- Supports: WHERE status = 'active' AND department_id = X AND designation_id = Y
-- Usage: Organizational reports, employee filtering

CREATE INDEX idx_employees_status_join_date_desc 
ON employees(status, join_date DESC);
-- Supports: WHERE status = 'active' ORDER BY join_date DESC
-- Usage: Recent active hires

CREATE INDEX idx_employees_dept_status_join 
ON employees(department_id, status, join_date DESC);
-- Supports: Department employees filtered by status, sorted by seniority
-- Usage: Department roster

CREATE INDEX idx_employees_desig_status_join 
ON employees(designation_id, status, join_date DESC);
-- Supports: Employees by designation, active only, sorted by seniority
-- Usage: Designation-wise reports

CREATE INDEX idx_employees_status_ctc 
ON employees(status, ctc DESC) 
WHERE status = 'active';
-- Supports: Active employees sorted by salary (highest first)
-- Partial: Only active employees
-- Usage: Salary benchmarking, compensation analysis

-- ============================================
-- ATTENDANCE QUERIES
-- ============================================

-- attendance_records table
CREATE INDEX idx_attendance_employee_year_month_status 
ON attendance_records(employee_id, year DESC, month DESC, status);
-- Supports: Employee attendance with status filter, sorted by recent first
-- Usage: Employee attendance history with approval status
-- Covering index: Can return status without table access

CREATE INDEX idx_attendance_status_year_month 
ON attendance_records(status, year DESC, month DESC);
-- Supports: Pending attendance records for a month
-- Usage: Approval workflow queue

CREATE INDEX idx_attendance_year_month_employee 
ON attendance_records(year DESC, month DESC, employee_id);
-- Supports: Monthly attendance report across all employees
-- Usage: Payroll processing month-by-month

-- ============================================
-- PAYROLL QUERIES
-- ============================================

-- pay_runs table
CREATE INDEX idx_pay_runs_status_year_month 
ON pay_runs(status, year DESC, month DESC);
-- Supports: Pay runs by status, sorted by recent first
-- Usage: Draft/Approved pay runs

CREATE INDEX idx_pay_runs_year_month_status 
ON pay_runs(year DESC, month DESC, status);
-- Supports: Recent pay runs with status
-- Usage: Payroll dashboard

-- pay_run_employee_records table
CREATE INDEX idx_pay_run_records_pay_run_employee_status 
ON pay_run_employee_records(pay_run_id, employee_id, status);
-- Supports: Pay run detail with employee and status
-- Covering index: Returns status without table lookup

CREATE INDEX idx_pay_run_records_employee_pay_run 
ON pay_run_employee_records(employee_id, pay_run_id);
-- Supports: Employee payroll history
-- Usage: Salary history by employee

-- payslips table
CREATE INDEX idx_payslips_employee_year_month 
ON payslips(employee_id, year DESC, month DESC);
-- Supports: Employee payslip history (critical query)
-- Usage: Employee salary slip download

CREATE INDEX idx_payslips_year_month_employee 
ON payslips(year DESC, month DESC, employee_id);
-- Supports: Monthly payslips across all employees
-- Usage: Month-wise payslip generation report

-- ============================================
-- DOCUMENT QUERIES
-- ============================================

-- documents table
CREATE INDEX idx_documents_employee_type_latest_verification 
ON documents(employee_id, document_type, is_latest_version, verification_status);
-- Supports: Specific document for employee, latest version, verification status
-- Covering index: Returns verification_status without table access
-- Usage: Document verification page

CREATE INDEX idx_documents_type_verification_latest 
ON documents(document_type, verification_status, is_latest_version)
WHERE is_latest_version = true;
-- Supports: All latest PAN cards pending verification
-- Partial: Only latest versions
-- Usage: Document verification queue by type

CREATE INDEX idx_documents_employee_latest_created 
ON documents(employee_id, is_latest_version, created_at DESC)
WHERE is_latest_version = true;
-- Supports: Employee's latest documents sorted by upload date
-- Usage: Employee document list

CREATE INDEX idx_documents_verification_expiry 
ON documents(verification_status, expiry_date ASC, is_latest_version)
WHERE expiry_date IS NOT NULL AND is_latest_version = true;
-- Supports: Verified documents expiring soon
-- Usage: Document renewal reminders

-- ============================================
-- LOAN QUERIES
-- ============================================

-- loan_records table
CREATE INDEX idx_loans_employee_status_disbursed 
ON loan_records(employee_id, status, disbursed_at DESC);
-- Supports: Employee loans filtered by status, sorted by disbursement date
-- Usage: Employee loan history

CREATE INDEX idx_loans_status_amount_created 
ON loan_records(status, loan_amount DESC, created_at DESC);
-- Supports: Loans by status, sorted by amount (high to low)
-- Usage: Loan approval queue (large loans first)

CREATE INDEX idx_loans_status_disbursed_employee 
ON loan_records(status, disbursed_at DESC, employee_id)
WHERE status IN ('active', 'completed');
-- Supports: Active/completed loans sorted by recent first
-- Partial: Excludes pending/rejected
-- Usage: Active loan report

-- loan_emis table
CREATE INDEX idx_loan_emis_is_paid_due_date_loan 
ON loan_emis(is_paid, due_date ASC, loan_id);
-- Supports: Unpaid EMIs sorted by due date (upcoming first)
-- Usage: Upcoming EMI deductions for payroll

CREATE INDEX idx_loan_emis_loan_due_date_is_paid 
ON loan_emis(loan_id, due_date ASC, is_paid);
-- Supports: EMI schedule for a loan with payment status
-- Covering index: Returns is_paid without table access

-- ============================================
-- ADVANCE QUERIES
-- ============================================

-- advance_records table
CREATE INDEX idx_advances_employee_status_amount 
ON advance_records(employee_id, status, amount DESC);
-- Supports: Employee advances by status, sorted by amount
-- Usage: Employee advance history

CREATE INDEX idx_advances_status_created_employee 
ON advance_records(status, created_at DESC, employee_id);
-- Supports: Advances by status, sorted by recent first
-- Usage: Advance approval queue

CREATE INDEX idx_advances_status_employee_installment 
ON advance_records(status, employee_id, installment_amount)
WHERE status = 'active';
-- Supports: Active advances with installment amounts for payroll
-- Covering index: Returns installment_amount without table access
-- Critical: Monthly payroll deduction calculation

-- ============================================
-- LETTER QUERIES
-- ============================================

-- generated_letters table
CREATE INDEX idx_letters_employee_type_status_created 
ON generated_letters(employee_id, letter_type, status, created_at DESC);
-- Supports: Employee letters filtered by type and status, sorted by date
-- Usage: Employee letter history page

CREATE INDEX idx_letters_type_status_created 
ON generated_letters(letter_type, status, created_at DESC);
-- Supports: Letters by type and status, sorted by recent first
-- Usage: Letter approval queue by type

CREATE INDEX idx_letters_status_created_employee 
ON generated_letters(status, created_at DESC, employee_id);
-- Supports: Letters by status, sorted by recent first
-- Usage: Pending approval letters

-- ============================================
-- CAREER HISTORY QUERIES
-- ============================================

-- career_history table
CREATE INDEX idx_career_history_employee_effective_type 
ON career_history(employee_id, effective_date DESC, change_type);
-- Supports: Employee career events sorted by date
-- Covering index: Returns change_type without table access

CREATE INDEX idx_career_history_type_effective_employee 
ON career_history(change_type, effective_date DESC, employee_id);
-- Supports: All promotions/transfers sorted by date
-- Usage: Promotion report, transfer report

CREATE INDEX idx_career_history_new_desig_effective 
ON career_history(new_designation_id, effective_date DESC);
-- Supports: Who was promoted to a designation, sorted by recent first
-- Usage: Designation promotion history

CREATE INDEX idx_career_history_new_dept_effective 
ON career_history(new_department_id, effective_date DESC);
-- Supports: Who transferred to a department, sorted by recent first
-- Usage: Department transfer history
```

---

**Composite Index Summary**:

| Domain | Composite Indexes | Covering Indexes | Total Columns Indexed |
|--------|-------------------|------------------|----------------------|
| Employees | 5 | 1 | 15 |
| Attendance | 3 | 1 | 11 |
| Payroll | 6 | 2 | 18 |
| Documents | 4 | 2 | 15 |
| Loans | 5 | 2 | 15 |
| Advances | 3 | 1 | 10 |
| Letters | 3 | 1 | 12 |
| Career | 4 | 2 | 11 |
| **TOTAL** | **33** | **12** | **107** |

---

**Covering Index Benefits**:

```sql
-- Query with covering index
SELECT employee_id, status FROM attendance_records 
WHERE employee_id = 'emp-uuid' AND year = 2024;

-- Uses: idx_attendance_employee_year_month_status
-- Index contains: employee_id, year, month, status
-- Result: Index-only scan (no table access needed)
-- Performance: 0.1ms vs 0.5ms with table lookup

-- Query NOT covered by index
SELECT employee_id, status, payable_days FROM attendance_records 
WHERE employee_id = 'emp-uuid' AND year = 2024;

-- Uses: idx_attendance_employee_year_month_status for filtering
-- Must access table for: payable_days (not in index)
-- Result: Index scan + table lookup
-- Performance: 0.5ms
```

---

**Index Column Order Optimization**:

**Example**: Employee search by department, status, sorted by join date

**Option 1** (Optimal):
```sql
CREATE INDEX idx_optimal 
ON employees(department_id, status, join_date DESC);

-- Query:
SELECT * FROM employees 
WHERE department_id = 'dept-uuid' AND status = 'active' 
ORDER BY join_date DESC;
-- Index usage: Perfect (all columns used efficiently)
```

**Option 2** (Suboptimal):
```sql
CREATE INDEX idx_suboptimal 
ON employees(status, join_date DESC, department_id);

-- Query:
SELECT * FROM employees 
WHERE department_id = 'dept-uuid' AND status = 'active' 
ORDER BY join_date DESC;
-- Index usage: Partial (must filter department_id after index scan)
```

**Rule**: Most selective equality filter first → Less selective filters → Sort columns last

---

#### **14.1.7. Partial Indexes**

Filtered indexes that index only a subset of rows, reducing storage and improving performance for targeted queries.

---

**Purpose**:
- Reduce index size (30-90% smaller)
- Faster index scans (fewer rows to scan)
- Lower maintenance cost (fewer rows to update)
- Support highly selective queries

---

**When to Use Partial Indexes**:
- ✅ Column has clear subset used in 80%+ queries (e.g., status = 'active')
- ✅ Subset is 20-80% of total rows (not too small, not too large)
- ✅ Queries always filter by the subset condition
- ❌ Don't use if you need to query excluded rows

---

**Implementation**:

```sql
-- ============================================
-- STATUS-BASED PARTIAL INDEXES
-- ============================================

-- employees table
CREATE INDEX idx_employees_active_dept_desig 
ON employees(department_id, designation_id) 
WHERE status = 'active';
-- Size: 80% smaller if 80% employees are active
-- Supports: WHERE status = 'active' AND department_id = X
-- Usage: Active employee filtering (most common)

CREATE INDEX idx_employees_probation_join_date 
ON employees(join_date, department_id) 
WHERE status = 'probation';
-- Size: 95% smaller (only 5% on probation)
-- Supports: Probation employee tracking
-- Usage: Probation completion alerts

CREATE INDEX idx_employees_inactive_exit_date 
ON employees(exit_date DESC) 
WHERE status IN ('resigned', 'terminated');
-- Size: 90% smaller (only 10% inactive)
-- Supports: Recent exits
-- Usage: Exit reports

-- attendance_records table
CREATE INDEX idx_attendance_pending_employee_date 
ON attendance_records(employee_id, year DESC, month DESC) 
WHERE status = 'pending_approval';
-- Size: 95% smaller (only 5% pending at any time)
-- Supports: Pending approval workflow
-- Critical: Manager approval queue

CREATE INDEX idx_attendance_approved_recent 
ON attendance_records(employee_id, year DESC, month DESC, payable_days) 
WHERE status = 'approved' 
  AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - 1;
-- Size: 92% smaller (only last 12 months)
-- Supports: Recent approved attendance with payable days
-- Covering index for payroll

-- loan_records table
CREATE INDEX idx_loans_active_employee_emi 
ON loan_records(employee_id, emi_amount, remaining_emis) 
WHERE status = 'active';
-- Size: 70% smaller (only 30% active)
-- Covering index: Returns emi_amount without table lookup
-- Critical: Monthly payroll EMI deduction

CREATE INDEX idx_loans_pending_amount_created 
ON loan_records(loan_amount DESC, created_at DESC, employee_id) 
WHERE status = 'pending';
-- Size: 95% smaller (only 5% pending)
-- Supports: Loan approval queue sorted by amount
-- Usage: Approve high-value loans first

CREATE INDEX idx_loans_defaulted_employee_amount 
ON loan_records(employee_id, loan_amount, disbursed_at) 
WHERE status = 'defaulted';
-- Size: 99% smaller (rare defaults)
-- Supports: Defaulted loan tracking
-- Usage: Collections department

-- advance_records table
CREATE INDEX idx_advances_active_employee_installment 
ON advance_records(employee_id, installment_amount, remaining_amount) 
WHERE status = 'active';
-- Size: 75% smaller (only 25% active)
-- Covering index: Returns installment_amount
-- Critical: Monthly payroll deduction

CREATE INDEX idx_advances_pending_amount 
ON advance_records(amount DESC, created_at DESC) 
WHERE status = 'pending';
-- Size: 95% smaller
-- Supports: Advance approval queue

-- pay_runs table
CREATE INDEX idx_pay_runs_active_year_month 
ON pay_runs(year DESC, month DESC, status) 
WHERE status IN ('draft', 'approved', 'processed');
-- Size: 90% smaller (excludes cancelled)
-- Supports: Active pay run history
-- Usage: Payroll dashboard

CREATE INDEX idx_pay_runs_draft_year_month 
ON pay_runs(year DESC, month DESC) 
WHERE status = 'draft';
-- Size: 98% smaller (only current draft)
-- Supports: Current draft pay run
-- Usage: Payroll editing

-- ============================================
-- NULLABLE FOREIGN KEY PARTIAL INDEXES
-- ============================================

-- audit_logs table
CREATE INDEX idx_audit_logs_user_created 
ON audit_logs(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;
-- Size: 20-50% smaller (excludes system actions)
-- Supports: User activity timeline
-- Usage: User audit trail

-- employees table
CREATE INDEX idx_employees_manager_hierarchy 
ON employees(reporting_manager_id, department_id) 
WHERE reporting_manager_id IS NOT NULL;
-- Size: 20% smaller (excludes top-level)
-- Supports: Manager-subordinate queries
-- Usage: Org chart generation

-- documents table
CREATE INDEX idx_documents_verified_by_date 
ON documents(verified_by, verified_at DESC) 
WHERE verified_by IS NOT NULL;
-- Size: 30% smaller (excludes unverified)
-- Supports: Documents verified by user
-- Usage: Verifier performance reports

-- loan_records table
CREATE INDEX idx_loans_guarantor_status 
ON loan_records(guarantor_employee_id, status) 
WHERE guarantor_employee_id IS NOT NULL;
-- Size: 40% smaller (not all loans have guarantors)
-- Supports: Loans guaranteed by employee
-- Usage: Guarantor liability report

-- ============================================
-- TEMPORAL PARTIAL INDEXES
-- ============================================

-- documents table
CREATE INDEX idx_documents_expiring_soon 
ON documents(expiry_date ASC, employee_id, document_type) 
WHERE expiry_date IS NOT NULL 
  AND expiry_date >= CURRENT_DATE 
  AND expiry_date <= CURRENT_DATE + INTERVAL '90 days'
  AND is_latest_version = true;
-- Size: 95% smaller (only expiring in next 90 days)
-- Supports: Document renewal alerts
-- Usage: Automated expiry notifications

CREATE INDEX idx_documents_expired 
ON documents(employee_id, document_type, expiry_date) 
WHERE is_expired = true AND is_latest_version = true;
-- Size: 98% smaller (only expired documents)
-- Supports: Expired document report
-- Usage: Compliance tracking

-- sessions table
CREATE INDEX idx_sessions_active 
ON sessions(user_id, last_activity_at DESC) 
WHERE expires_at > CURRENT_TIMESTAMP;
-- Size: 80% smaller (excludes expired)
-- Supports: Active session queries
-- Usage: Current active users

-- employees table
CREATE INDEX idx_employees_anniversary_upcoming 
ON employees(join_date, employee_id) 
WHERE status = 'active' 
  AND EXTRACT(MONTH FROM join_date) >= EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(MONTH FROM join_date) <= EXTRACT(MONTH FROM CURRENT_DATE) + 3;
-- Size: 75% smaller (only next 3 months)
-- Supports: Upcoming work anniversaries
-- Usage: Anniversary notification system

-- ============================================
-- COVERING PARTIAL INDEXES
-- ============================================

-- pay_run_employee_records table
CREATE INDEX idx_pay_run_records_active_covering 
ON pay_run_employee_records(
    pay_run_id, 
    employee_id, 
    gross_salary, 
    total_deductions, 
    net_pay
) 
WHERE status = 'processed';
-- Size: 60% smaller (only processed records)
-- Covering: Returns salary fields without table access
-- Usage: Payroll reports (no table lookup needed)

-- loan_emis table
CREATE INDEX idx_loan_emis_unpaid_due 
ON loan_emis(loan_id, due_date ASC, emi_amount) 
WHERE is_paid = false;
-- Size: 60% smaller (only unpaid EMIs)
-- Covering: Returns emi_amount without table lookup
-- Critical: Monthly payroll deduction calculation

-- attendance_records table
CREATE INDEX idx_attendance_approved_payroll_covering 
ON attendance_records(
    employee_id, 
    year, 
    month, 
    payable_days, 
    lop_days, 
    total_paid_days
) 
WHERE status = 'approved';
-- Size: 90% smaller (only approved)
-- Covering: Returns all payroll-needed fields
-- Critical: Payroll processing (fastest possible)
```

---

**Partial Index Summary**:

| Category | Index Count | Avg Size Reduction | Primary Benefit |
|----------|-------------|-------------------|-----------------|
| Status-based | 10 | 70-95% | Active/pending record queries |
| Nullable FK | 4 | 20-50% | Non-null foreign key queries |
| Temporal | 4 | 75-98% | Time-based subsets |
| Covering | 3 | 60-90% | Index-only scans |
| **TOTAL** | **21** | **65% avg** | **Storage + performance** |

---

**Storage Savings**:

**Example**: `employees` table (1000 rows, 800 active)

**Full index**:
```sql
CREATE INDEX idx_employees_dept ON employees(department_id);
-- Index size: 50 MB (all 1000 employees)
```

**Partial index**:
```sql
CREATE INDEX idx_employees_active_dept 
ON employees(department_id) 
WHERE status = 'active';
-- Index size: 40 MB (only 800 employees)
-- Savings: 10 MB (20% reduction)
-- Write performance: 20% faster inserts/updates
```

---

**Maintenance Considerations**:

```sql
-- Monitor partial index effectiveness
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    pg_get_indexdef(indexrelid) AS index_definition
FROM pg_stat_user_indexes
WHERE indexname LIKE '%active%' OR indexname LIKE '%pending%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Compare partial vs full index size
SELECT 
    'Full Index' AS type,
    pg_size_pretty(pg_relation_size('idx_employees_dept'::regclass)) AS size
UNION ALL
SELECT 
    'Partial Index',
    pg_size_pretty(pg_relation_size('idx_employees_active_dept'::regclass));
```

---

**Best Practices**:

1. **Combine with composite**: Partial + composite = maximum efficiency
   ```sql
   CREATE INDEX idx_optimal 
   ON table_name(col1, col2, col3) 
   WHERE status = 'active';
   ```

2. **Use for workflow queues**: pending, draft, for_approval states
   ```sql
   CREATE INDEX idx_approval_queue 
   ON records(priority DESC, created_at ASC) 
   WHERE status = 'pending_approval';
   ```

3. **Exclude old data**: Keep indexes small for recent data
   ```sql
   CREATE INDEX idx_recent_only 
   ON records(date_column DESC) 
   WHERE date_column >= CURRENT_DATE - INTERVAL '1 year';
   ```

4. **Test query compatibility**: Ensure queries match WHERE clause
   ```sql
   -- This will NOT use partial index:
   SELECT * FROM employees WHERE department_id = 'X';
   
   -- This WILL use partial index:
   SELECT * FROM employees 
   WHERE department_id = 'X' AND status = 'active';
   ```

---

### 14.2. Query Optimization Patterns

Optimized SQL patterns for common business queries in the EcoVale HR system, demonstrating best practices for performance.

---

#### **14.2.1. Employee List with Details**

**Use Case**: Display employee list page with department, designation, and manager information.

---

**Anti-Pattern: N+1 Queries**

```sql
-- ❌ BAD: N+1 Query Problem
-- Step 1: Fetch employees
SELECT * FROM employees WHERE status = 'active';
-- Returns: 800 employees

-- Step 2: For EACH employee, fetch department (800 queries!)
SELECT name FROM departments WHERE id = 'dept-uuid-1';
SELECT name FROM departments WHERE id = 'dept-uuid-2';
-- ... 800 times

-- Step 3: For EACH employee, fetch designation (800 queries!)
SELECT name FROM designations WHERE id = 'desig-uuid-1';
SELECT name FROM designations WHERE id = 'desig-uuid-2';
-- ... 800 times

-- Step 4: For EACH employee, fetch manager (800 queries!)
SELECT first_name, last_name FROM employees WHERE id = 'mgr-uuid-1';
-- ... 800 times

-- Total queries: 1 + 800 + 800 + 800 = 2,401 queries
-- Total time: ~2.4 seconds (1ms per query)
-- Database connections: 2,401 connections used
```

**This is the WORST possible approach**: Never use in production!

---

**Pattern 1: Simple JOINs (Good)**

```sql
-- ✅ GOOD: Single query with JOINs
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.join_date,
    e.status,
    
    -- Department info
    d.name AS department_name,
    d.code AS department_code,
    
    -- Designation info
    des.name AS designation_name,
    des.level AS designation_level,
    
    -- Manager info
    mgr.first_name AS manager_first_name,
    mgr.last_name AS manager_last_name,
    mgr.employee_id AS manager_employee_id

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id

WHERE e.status = 'active'
ORDER BY e.join_date DESC;

-- Total queries: 1
-- Total time: ~5-10ms
-- Result: 800 rows with all data
-- Performance: 240x faster than N+1
```

**Indexes Used**:
- `employees_pkey` (if filtering by id)
- `idx_employees_status` for WHERE clause
- `departments_pkey` for department JOIN
- `designations_pkey` for designation JOIN
- `employees_pkey` for manager JOIN

---

**Pattern 2: Pagination with Window Functions (Best for Large Lists)**

```sql
-- ✅ BEST: Pagination with total count (single query)
WITH employee_list AS (
    SELECT 
        e.id,
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        e.join_date,
        e.status,
        e.gross,
        
        d.name AS department_name,
        d.code AS department_code,
        
        des.name AS designation_name,
        des.level AS designation_level,
        
        mgr.first_name || ' ' || mgr.last_name AS manager_name,
        
        -- Total count for pagination
        COUNT(*) OVER() AS total_count,
        
        -- Row number for page position
        ROW_NUMBER() OVER(ORDER BY e.join_date DESC) AS row_num
        
    FROM employees e
    INNER JOIN departments d ON e.department_id = d.id
    INNER JOIN designations des ON e.designation_id = des.id
    LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id
    
    WHERE e.status = 'active'
)
SELECT *
FROM employee_list
WHERE row_num BETWEEN 1 AND 20;  -- Page 1: rows 1-20
-- WHERE row_num BETWEEN 21 AND 40;  -- Page 2: rows 21-40

-- Returns: 20 employees + total_count for pagination UI
-- Total time: ~8-12ms
-- Benefits: Single query, includes total count, efficient pagination
```

**Benefits**:
- ✅ Single query (no separate COUNT query needed)
- ✅ `total_count` available for "Showing 1-20 of 800"
- ✅ Efficient pagination without OFFSET
- ✅ Consistent results (window function uses snapshot)

---

**Pattern 3: Filtered List with Search (Production-Ready)**

```sql
-- ✅ PRODUCTION: Employee search with filters
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.join_date,
    e.status,
    e.ctc,
    
    d.id AS department_id,
    d.name AS department_name,
    d.code AS department_code,
    
    des.id AS designation_id,
    des.name AS designation_name,
    des.level AS designation_level,
    
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    
    -- Computed columns (GENERATED)
    e.tenure_months,
    e.is_active,
    
    -- Counts via subqueries
    (SELECT COUNT(*) FROM documents 
     WHERE employee_id = e.id AND is_latest_version = true) AS document_count,
    
    (SELECT COUNT(*) FROM loan_records 
     WHERE employee_id = e.id AND status = 'active') AS active_loans,
    
    COUNT(*) OVER() AS total_count

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id

WHERE 
    e.status = $1  -- Parameter: 'active', 'probation', etc.
    
    -- Department filter (optional)
    AND ($2::UUID IS NULL OR e.department_id = $2)
    
    -- Designation filter (optional)
    AND ($3::UUID IS NULL OR e.designation_id = $3)
    
    -- Search by name or employee ID
    AND (
        $4::TEXT IS NULL 
        OR e.first_name ILIKE '%' || $4 || '%'
        OR e.last_name ILIKE '%' || $4 || '%'
        OR e.email ILIKE '%' || $4 || '%'
        OR e.employee_id ILIKE '%' || $4 || '%'
    )
    
ORDER BY 
    CASE WHEN $5 = 'name' THEN e.first_name END ASC,
    CASE WHEN $5 = 'join_date_desc' THEN e.join_date END DESC,
    CASE WHEN $5 = 'join_date_asc' THEN e.join_date END ASC,
    CASE WHEN $5 = 'salary_desc' THEN e.ctc END DESC,
    e.employee_id  -- Default sort

LIMIT $6 OFFSET $7;  -- Pagination parameters

-- Parameters:
-- $1: status ('active')
-- $2: department_id (NULL for all)
-- $3: designation_id (NULL for all)
-- $4: search_term (NULL for no search)
-- $5: sort_by ('name', 'join_date_desc', 'join_date_asc', 'salary_desc')
-- $6: limit (20)
-- $7: offset (0 for page 1, 20 for page 2, etc.)

-- Indexes used:
-- - idx_employees_status (WHERE status)
-- - idx_employees_status_dept_desig (composite for status + dept + desig)
-- - idx_employees_first_name_pattern (for ILIKE search)
-- - idx_employees_status_join_date_desc (for sort)
-- - idx_employees_status_ctc (for salary sort)
```

**Performance**:
- **Without filters/search**: 8-15ms (800 active employees)
- **With department filter**: 5-10ms (200 employees)
- **With search term**: 10-20ms (depends on pattern)
- **Subquery counts**: +2-3ms per subquery

---

**Pattern 4: Optimized with Materialized View (For Heavy Traffic)**

```sql
-- Create materialized view (refresh daily or on-demand)
CREATE MATERIALIZED VIEW mv_employee_list AS
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.join_date,
    e.status,
    e.ctc,
    e.gross,
    e.net,
    
    d.id AS department_id,
    d.name AS department_name,
    d.code AS department_code,
    
    des.id AS designation_id,
    des.name AS designation_name,
    des.level AS designation_level,
    
    mgr.id AS manager_id,
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    
    e.tenure_months,
    e.is_active,
    
    -- Pre-computed counts
    (SELECT COUNT(*) FROM documents 
     WHERE employee_id = e.id AND is_latest_version = true) AS document_count,
    
    (SELECT COUNT(*) FROM loan_records 
     WHERE employee_id = e.id AND status = 'active') AS active_loans,
    
    (SELECT COUNT(*) FROM advance_records 
     WHERE employee_id = e.id AND status = 'active') AS active_advances,
    
    e.created_at,
    e.updated_at

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id;

-- Create indexes on materialized view
CREATE INDEX idx_mv_employee_list_status ON mv_employee_list(status);
CREATE INDEX idx_mv_employee_list_dept ON mv_employee_list(department_id);
CREATE INDEX idx_mv_employee_list_desig ON mv_employee_list(designation_id);
CREATE INDEX idx_mv_employee_list_name ON mv_employee_list(first_name, last_name);
CREATE UNIQUE INDEX idx_mv_employee_list_id ON mv_employee_list(id);

-- Query the materialized view (super fast)
SELECT * FROM mv_employee_list
WHERE status = 'active'
ORDER BY join_date DESC
LIMIT 20 OFFSET 0;

-- Performance: 0.5-2ms (vs 8-15ms from live query)
-- Tradeoff: Data is stale until refresh

-- Refresh strategy (choose one):

-- Option 1: Scheduled refresh (daily at midnight)
-- In cron job or scheduler:
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_list;

-- Option 2: On-demand refresh (after employee changes)
-- In application after INSERT/UPDATE/DELETE on employees:
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_list;

-- Option 3: Automatic refresh with trigger (real-time)
CREATE OR REPLACE FUNCTION refresh_employee_list_mv()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_list;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_employee_list
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_employee_list_mv();
```

**When to Use Materialized View**:
- ✅ Query executed 1000+ times per day
- ✅ Data doesn't change frequently (employee list stable)
- ✅ Acceptable staleness (5-60 minutes old data is fine)
- ✅ Complex joins and aggregations
- ❌ Don't use if real-time data critical

---

**Pattern 5: JSON Aggregation for API Response**

```sql
-- ✅ API-FRIENDLY: Return JSON for REST API
SELECT json_build_object(
    'data', json_agg(
        json_build_object(
            'id', e.id,
            'employeeId', e.employee_id,
            'firstName', e.first_name,
            'lastName', e.last_name,
            'fullName', e.first_name || ' ' || e.last_name,
            'email', e.email,
            'phone', e.phone,
            'joinDate', e.join_date,
            'status', e.status,
            'ctc', e.ctc,
            'tenureMonths', e.tenure_months,
            'department', json_build_object(
                'id', d.id,
                'name', d.name,
                'code', d.code
            ),
            'designation', json_build_object(
                'id', des.id,
                'name', des.name,
                'level', des.level
            ),
            'manager', CASE 
                WHEN mgr.id IS NOT NULL THEN json_build_object(
                    'id', mgr.id,
                    'name', mgr.first_name || ' ' || mgr.last_name,
                    'employeeId', mgr.employee_id
                )
                ELSE NULL
            END
        ) ORDER BY e.join_date DESC
    ),
    'pagination', json_build_object(
        'total', COUNT(*) OVER(),
        'page', 1,
        'limit', 20,
        'totalPages', CEIL(COUNT(*) OVER() / 20.0)
    )
) AS response

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id

WHERE e.status = 'active'
LIMIT 20 OFFSET 0;

-- Returns single row with complete JSON:
-- {
--   "data": [
--     {
--       "id": "uuid",
--       "employeeId": "EMP001",
--       "firstName": "John",
--       "lastName": "Doe",
--       "fullName": "John Doe",
--       "email": "john.doe@example.com",
--       "department": {
--         "id": "uuid",
--         "name": "Engineering",
--         "code": "ENG"
--       },
--       ...
--     }
--   ],
--   "pagination": {
--     "total": 800,
--     "page": 1,
--     "limit": 20,
--     "totalPages": 40
--   }
-- }

-- Benefits:
-- - Single database query
-- - Perfect for REST/GraphQL APIs
-- - No JSON parsing in application code
-- - Reduced network overhead
```

---

**Pattern 6: Cursor-Based Pagination (Best for Infinite Scroll)**

```sql
-- ✅ CURSOR PAGINATION: Better than OFFSET for large datasets
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.join_date,
    
    d.name AS department_name,
    des.name AS designation_name,
    mgr.first_name || ' ' || mgr.last_name AS manager_name

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id

WHERE 
    e.status = 'active'
    
    -- Cursor: Get records after this join_date
    AND (
        $1::TIMESTAMP IS NULL  -- First page
        OR e.join_date < $1    -- Subsequent pages
    )

ORDER BY e.join_date DESC, e.id DESC  -- Tie-breaker with id
LIMIT 20;

-- Usage:
-- Page 1: Pass cursor = NULL
-- Returns: 20 employees with most recent join_date
-- Last employee: join_date = '2024-05-15', id = 'uuid-20'

-- Page 2: Pass cursor = '2024-05-15'
-- Returns: Next 20 employees with join_date < '2024-05-15'

-- Benefits:
-- - Consistent results (no duplicates/skips with OFFSET)
-- - Performance doesn't degrade with page number
-- - Perfect for infinite scroll UIs
-- - Works with 1M+ rows efficiently
```

**Performance Comparison**:

| Method | Page 1 | Page 10 | Page 100 | Use Case |
|--------|--------|---------|----------|----------|
| **OFFSET** | 5ms | 8ms | 50ms | Small datasets (<10k rows) |
| **Window Function** | 8ms | 8ms | 12ms | Fixed-page navigation |
| **Cursor** | 5ms | 5ms | 5ms | Infinite scroll, large datasets |
| **Materialized View** | 1ms | 1ms | 1ms | High traffic, stale data OK |

---

**Application Integration (TypeScript)**:

```typescript
interface EmployeeListParams {
  status?: 'active' | 'probation' | 'resigned' | 'terminated';
  departmentId?: string;
  designationId?: string;
  searchTerm?: string;
  sortBy?: 'name' | 'join_date_desc' | 'join_date_asc' | 'salary_desc';
  page?: number;
  limit?: number;
}

interface EmployeeListItem {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  joinDate: string;
  status: string;
  ctc: number;
  departmentName: string;
  departmentCode: string;
  designationName: string;
  designationLevel: number;
  managerName: string | null;
  tenureMonths: number;
  isActive: boolean;
  documentCount: number;
  activeLoans: number;
}

interface EmployeeListResponse {
  data: EmployeeListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

async function getEmployeeList(params: EmployeeListParams): Promise<EmployeeListResponse> {
  const {
    status = 'active',
    departmentId = null,
    designationId = null,
    searchTerm = null,
    sortBy = 'join_date_desc',
    page = 1,
    limit = 20,
  } = params;

  const offset = (page - 1) * limit;

  // Use Pattern 3: Filtered List with Search
  const result = await db.query<EmployeeListItem & { total_count: number }>(
    EMPLOYEE_LIST_QUERY,
    [status, departmentId, designationId, searchTerm, sortBy, limit, offset]
  );

  if (result.rows.length === 0) {
    return {
      data: [],
      pagination: { total: 0, page, limit, totalPages: 0 },
    };
  }

  const total = result.rows[0].total_count;

  return {
    data: result.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Usage in API endpoint:
app.get('/api/employees', async (req, res) => {
  try {
    const response = await getEmployeeList({
      status: req.query.status as any,
      departmentId: req.query.departmentId as string,
      designationId: req.query.designationId as string,
      searchTerm: req.query.search as string,
      sortBy: req.query.sortBy as any,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    });

    res.json(response);
  } catch (error) {
    console.error('Error fetching employee list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

---

**Query Optimization Checklist for Employee List**:

- [x] Use JOINs instead of N+1 queries
- [x] Use appropriate indexes (status, department, designation)
- [x] Include total count in single query (window function)
- [x] Parameterized queries (prevent SQL injection)
- [x] Implement pagination (LIMIT/OFFSET or cursor)
- [x] Leverage GENERATED columns (tenure_months, is_active)
- [x] Use ILIKE with pattern indexes for search
- [x] Consider materialized view for high traffic
- [x] Profile with EXPLAIN ANALYZE
- [x] Monitor slow query log (queries >50ms)

---

#### **14.2.2. Monthly Payroll Report**

**Use Case**: Generate comprehensive payroll report for a specific month with all deductions, aggregations, and summaries.

---

**Pattern 1: Complete Payroll Report (Single Query)**

```sql
-- ✅ OPTIMIZED: Complete payroll report for a month
WITH payroll_data AS (
    SELECT 
        pr.id AS pay_run_id,
        pr.month,
        pr.year,
        pr.status AS pay_run_status,
        pr.generated_at,
        pr.processed_at,
        
        pre.id AS record_id,
        pre.employee_id,
        e.employee_id AS employee_code,
        e.first_name,
        e.last_name,
        e.email,
        
        d.name AS department_name,
        d.code AS department_code,
        des.name AS designation_name,
        
        -- Salary components
        pre.gross_salary,
        
        -- Attendance
        att.payable_days,
        att.lop_days,
        att.total_paid_days,
        att.total_unpaid_days,
        
        -- Deductions
        pre.pf_deduction,
        pre.esi_deduction,
        pre.professional_tax,
        pre.tds,
        pre.advance_deduction,
        pre.loan_emi_deduction,
        
        -- GENERATED column
        pre.total_deductions,
        pre.net_pay,
        pre.take_home_percentage,
        
        pre.status AS record_status,
        pre.processed_at AS employee_processed_at

    FROM pay_runs pr
    INNER JOIN pay_run_employee_records pre ON pre.pay_run_id = pr.id
    INNER JOIN employees e ON pre.employee_id = e.id
    INNER JOIN departments d ON e.department_id = d.id
    INNER JOIN designations des ON e.designation_id = des.id
    LEFT JOIN attendance_records att 
        ON att.employee_id = e.id 
        AND att.year = pr.year 
        AND att.month = pr.month
    
    WHERE pr.year = $1 AND pr.month = $2  -- Parameters: 2024, 11
)
SELECT 
    -- Individual records
    pd.*,
    
    -- Departmental aggregations
    SUM(pd.gross_salary) OVER(PARTITION BY pd.department_name) AS dept_total_gross,
    SUM(pd.net_pay) OVER(PARTITION BY pd.department_name) AS dept_total_net,
    COUNT(*) OVER(PARTITION BY pd.department_name) AS dept_employee_count,
    
    -- Overall aggregations
    SUM(pd.gross_salary) OVER() AS total_gross,
    SUM(pd.total_deductions) OVER() AS total_deductions,
    SUM(pd.net_pay) OVER() AS total_net_pay,
    COUNT(*) OVER() AS total_employees,
    
    -- Statistics
    AVG(pd.net_pay) OVER() AS avg_net_pay,
    MAX(pd.net_pay) OVER() AS max_net_pay,
    MIN(pd.net_pay) OVER() AS min_net_pay

FROM payroll_data pd
ORDER BY pd.department_name, pd.designation_name, pd.employee_code;

-- Performance: 15-25ms for 800 employees
-- Returns: All employee payroll + department totals + overall totals in single query
```

**Indexes Used**:
- `idx_pay_runs_year_month` for WHERE clause
- `idx_pay_run_employee_records_pay_run_id` for JOIN
- `idx_attendance_records_employee_year_month` for attendance JOIN

---

**Pattern 2: Aggregated Payroll Summary (Department-wise)**

```sql
-- ✅ DEPARTMENT SUMMARY: Aggregated payroll by department
SELECT 
    d.name AS department_name,
    d.code AS department_code,
    
    COUNT(pre.id) AS employee_count,
    
    -- Salary aggregations
    SUM(pre.gross_salary) AS total_gross_salary,
    SUM(pre.pf_deduction) AS total_pf,
    SUM(pre.esi_deduction) AS total_esi,
    SUM(pre.professional_tax) AS total_pt,
    SUM(pre.tds) AS total_tds,
    SUM(pre.advance_deduction) AS total_advance_deductions,
    SUM(pre.loan_emi_deduction) AS total_loan_deductions,
    SUM(pre.total_deductions) AS total_all_deductions,
    SUM(pre.net_pay) AS total_net_pay,
    
    -- Averages
    AVG(pre.gross_salary) AS avg_gross_salary,
    AVG(pre.net_pay) AS avg_net_pay,
    AVG(pre.take_home_percentage) AS avg_take_home_percentage,
    
    -- Min/Max
    MIN(pre.net_pay) AS min_net_pay,
    MAX(pre.net_pay) AS max_net_pay,
    
    -- Attendance statistics
    AVG(att.payable_days) AS avg_payable_days,
    SUM(att.lop_days) AS total_lop_days

FROM pay_runs pr
INNER JOIN pay_run_employee_records pre ON pre.pay_run_id = pr.id
INNER JOIN employees e ON pre.employee_id = e.id
INNER JOIN departments d ON e.department_id = d.id
LEFT JOIN attendance_records att 
    ON att.employee_id = e.id 
    AND att.year = pr.year 
    AND att.month = pr.month

WHERE pr.year = $1 AND pr.month = $2

GROUP BY d.id, d.name, d.code
ORDER BY total_net_pay DESC;

-- Performance: 10-15ms
-- Returns: Department-wise payroll summary
```

---

**Pattern 3: Payroll with Statutory Compliance Report**

```sql
-- ✅ STATUTORY REPORT: PF, ESI, PT breakdown
WITH payroll_statutory AS (
    SELECT 
        pr.month,
        pr.year,
        
        -- Employee counts
        COUNT(DISTINCT pre.employee_id) AS total_employees,
        COUNT(DISTINCT CASE WHEN pre.pf_deduction > 0 THEN pre.employee_id END) AS pf_applicable_employees,
        COUNT(DISTINCT CASE WHEN pre.esi_deduction > 0 THEN pre.employee_id END) AS esi_applicable_employees,
        COUNT(DISTINCT CASE WHEN pre.professional_tax > 0 THEN pre.employee_id END) AS pt_applicable_employees,
        
        -- PF calculations
        SUM(pre.pf_deduction) AS employee_pf_contribution,
        SUM(pre.pf_deduction) AS employer_pf_contribution,  -- Assuming equal contribution
        SUM(pre.pf_deduction * 2) AS total_pf_to_deposit,
        
        -- ESI calculations
        SUM(pre.esi_deduction) AS employee_esi_contribution,
        SUM(pre.esi_deduction * 3.25 / 0.75) AS employer_esi_contribution,  -- Employer pays 3.25%, employee 0.75%
        SUM(pre.esi_deduction * (1 + 3.25/0.75)) AS total_esi_to_deposit,
        
        -- Professional Tax
        SUM(pre.professional_tax) AS total_pt_to_deposit,
        
        -- TDS
        SUM(pre.tds) AS total_tds_to_deposit,
        
        -- Total statutory deductions
        SUM(pre.pf_deduction + pre.esi_deduction + pre.professional_tax + pre.tds) AS total_statutory_deductions,
        
        -- Non-statutory deductions
        SUM(pre.advance_deduction + pre.loan_emi_deduction) AS total_non_statutory_deductions,
        
        -- Total payout
        SUM(pre.net_pay) AS total_net_payout

    FROM pay_runs pr
    INNER JOIN pay_run_employee_records pre ON pre.pay_run_id = pr.id
    
    WHERE pr.year = $1 AND pr.month = $2
    
    GROUP BY pr.month, pr.year
)
SELECT 
    *,
    
    -- Employer total liability
    employee_pf_contribution + employer_pf_contribution + 
    employee_esi_contribution + employer_esi_contribution AS total_employer_statutory_liability,
    
    -- Total company payout (salary + employer contributions)
    total_net_payout + employer_pf_contribution + employer_esi_contribution AS total_company_cost

FROM payroll_statutory;

-- Performance: 8-12ms
-- Returns: Complete statutory compliance summary for month
```

---

**Pattern 4: Payroll Exception Report (Issues to Review)**

```sql
-- ✅ EXCEPTION REPORT: Find payroll anomalies
SELECT 
    e.employee_id,
    e.first_name,
    e.last_name,
    d.name AS department_name,
    
    pre.gross_salary,
    pre.net_pay,
    pre.total_deductions,
    pre.take_home_percentage,
    
    att.payable_days,
    att.lop_days,
    
    -- Exception flags
    CASE 
        WHEN att.id IS NULL THEN 'Missing attendance record'
        WHEN att.status != 'approved' THEN 'Attendance not approved'
        WHEN pre.net_pay <= 0 THEN 'Zero or negative net pay'
        WHEN pre.take_home_percentage < 50 THEN 'Take-home less than 50%'
        WHEN pre.total_deductions > pre.gross_salary THEN 'Deductions exceed gross'
        WHEN att.lop_days > 15 THEN 'High LOP days (>15)'
        ELSE 'OK'
    END AS exception_type,
    
    pre.advance_deduction,
    pre.loan_emi_deduction,
    
    pre.status AS record_status

FROM pay_runs pr
INNER JOIN pay_run_employee_records pre ON pre.pay_run_id = pr.id
INNER JOIN employees e ON pre.employee_id = e.id
INNER JOIN departments d ON e.department_id = d.id
LEFT JOIN attendance_records att 
    ON att.employee_id = e.id 
    AND att.year = pr.year 
    AND att.month = pr.month

WHERE 
    pr.year = $1 
    AND pr.month = $2
    AND (
        att.id IS NULL  -- Missing attendance
        OR att.status != 'approved'  -- Not approved
        OR pre.net_pay <= 0  -- Zero/negative pay
        OR pre.take_home_percentage < 50  -- Low take-home
        OR pre.total_deductions > pre.gross_salary  -- Excess deductions
        OR att.lop_days > 15  -- High LOP
    )

ORDER BY 
    CASE 
        WHEN att.id IS NULL THEN 1
        WHEN att.status != 'approved' THEN 2
        WHEN pre.net_pay <= 0 THEN 3
        WHEN pre.take_home_percentage < 50 THEN 4
        ELSE 5
    END,
    e.employee_id;

-- Performance: 5-10ms (fewer rows due to WHERE filters)
-- Returns: Only problematic payroll records requiring attention
```

---

**Pattern 5: Payroll Comparison (Month-over-Month)**

```sql
-- ✅ MoM COMPARISON: Compare current vs previous month
WITH current_month AS (
    SELECT 
        pre.employee_id,
        SUM(pre.gross_salary) AS current_gross,
        SUM(pre.net_pay) AS current_net,
        SUM(pre.total_deductions) AS current_deductions
    FROM pay_runs pr
    INNER JOIN pay_run_employee_records pre ON pre.pay_run_id = pr.id
    WHERE pr.year = $1 AND pr.month = $2  -- 2024, 11
    GROUP BY pre.employee_id
),
previous_month AS (
    SELECT 
        pre.employee_id,
        SUM(pre.gross_salary) AS previous_gross,
        SUM(pre.net_pay) AS previous_net,
        SUM(pre.total_deductions) AS previous_deductions
    FROM pay_runs pr
    INNER JOIN pay_run_employee_records pre ON pre.pay_run_id = pr.id
    WHERE pr.year = $3 AND pr.month = $4  -- 2024, 10 (or handle year rollover)
    GROUP BY pre.employee_id
)
SELECT 
    e.employee_id,
    e.first_name,
    e.last_name,
    d.name AS department_name,
    
    cm.current_gross,
    pm.previous_gross,
    cm.current_gross - COALESCE(pm.previous_gross, 0) AS gross_change,
    ROUND(((cm.current_gross - COALESCE(pm.previous_gross, 0)) / NULLIF(pm.previous_gross, 0) * 100), 2) AS gross_change_percent,
    
    cm.current_net,
    pm.previous_net,
    cm.current_net - COALESCE(pm.previous_net, 0) AS net_change,
    ROUND(((cm.current_net - COALESCE(pm.previous_net, 0)) / NULLIF(pm.previous_net, 0) * 100), 2) AS net_change_percent,
    
    cm.current_deductions,
    pm.previous_deductions,
    cm.current_deductions - COALESCE(pm.previous_deductions, 0) AS deductions_change,
    
    -- Flag significant changes
    CASE 
        WHEN pm.previous_gross IS NULL THEN 'New employee'
        WHEN ABS(cm.current_net - pm.previous_net) / NULLIF(pm.previous_net, 0) > 0.1 THEN 'Significant change (>10%)'
        ELSE 'Normal'
    END AS change_flag

FROM current_month cm
LEFT JOIN previous_month pm ON cm.employee_id = pm.employee_id
INNER JOIN employees e ON cm.employee_id = e.id
INNER JOIN departments d ON e.department_id = d.id

WHERE 
    pm.previous_gross IS NULL  -- New employees
    OR ABS(cm.current_net - pm.previous_net) / NULLIF(pm.previous_net, 0) > 0.05  -- >5% change

ORDER BY ABS(cm.current_net - COALESCE(pm.previous_net, 0)) DESC;

-- Performance: 12-20ms
-- Returns: Employees with salary changes >5%
```

---

#### **14.2.3. Employee Reporting Chain (Recursive)**

**Use Case**: Generate organizational hierarchy, find all subordinates of a manager, or traverse reporting chain upward.

---

**Pattern 1: Direct Reports (Non-Recursive)**

```sql
-- ✅ SIMPLE: Direct reports only (one level)
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    d.name AS department_name,
    des.name AS designation_name,
    e.join_date
    
FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id

WHERE 
    e.reporting_manager_id = $1  -- Manager UUID
    AND e.status = 'active'
    
ORDER BY des.level DESC, e.join_date;

-- Performance: 2-5ms
-- Index used: idx_employees_reporting_manager_id
```

---

**Pattern 2: All Subordinates (Recursive CTE)**

```sql
-- ✅ RECURSIVE: All subordinates at all levels
WITH RECURSIVE reporting_chain AS (
    -- Base case: Start with the manager
    SELECT 
        id,
        employee_id,
        first_name,
        last_name,
        email,
        department_id,
        designation_id,
        reporting_manager_id,
        status,
        1 AS level,  -- Depth in hierarchy
        ARRAY[id] AS path  -- Path from root to current node
        
    FROM employees
    WHERE id = $1  -- Starting manager UUID
    
    UNION ALL
    
    -- Recursive case: Find direct reports
    SELECT 
        e.id,
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.department_id,
        e.designation_id,
        e.reporting_manager_id,
        e.status,
        rc.level + 1,
        rc.path || e.id  -- Append to path
        
    FROM employees e
    INNER JOIN reporting_chain rc ON e.reporting_manager_id = rc.id
    
    WHERE 
        e.status = 'active'
        AND rc.level < 20  -- Prevent infinite loops (max depth)
        AND NOT (e.id = ANY(rc.path))  -- Prevent circular references
)
SELECT 
    rc.level,
    rc.employee_id,
    rc.first_name,
    rc.last_name,
    rc.email,
    
    d.name AS department_name,
    des.name AS designation_name,
    des.level AS designation_level,
    
    -- Show indentation based on level
    REPEAT('  ', rc.level - 1) || rc.first_name || ' ' || rc.last_name AS hierarchy_display,
    
    -- Count subordinates
    (SELECT COUNT(*) FROM reporting_chain WHERE reporting_manager_id = rc.id) AS direct_reports_count

FROM reporting_chain rc
INNER JOIN departments d ON rc.department_id = d.id
INNER JOIN designations des ON rc.designation_id = des.id

ORDER BY rc.path;  -- Maintains hierarchical order

-- Performance: 10-30ms (depends on org size)
-- Returns: Manager + all subordinates at all levels
```

**Result Example**:
```
level | employee_id | hierarchy_display           | direct_reports_count
------+-------------+-----------------------------+---------------------
1     | EMP001      | John CEO                    | 3
2     | EMP002      |   Jane CTO                  | 2
3     | EMP003      |     Bob Engineering Manager | 5
4     | EMP004      |       Alice Tech Lead       | 3
5     | EMP005      |         Charlie Sr Dev      | 0
```

---

**Pattern 3: Upward Reporting Chain (Employee to CEO)**

```sql
-- ✅ RECURSIVE: Find reporting chain upward (employee to top)
WITH RECURSIVE manager_chain AS (
    -- Base case: Start with employee
    SELECT 
        id,
        employee_id,
        first_name,
        last_name,
        email,
        designation_id,
        reporting_manager_id,
        1 AS level,
        ARRAY[id] AS path
        
    FROM employees
    WHERE id = $1  -- Employee UUID
    
    UNION ALL
    
    -- Recursive case: Find manager
    SELECT 
        e.id,
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.designation_id,
        e.reporting_manager_id,
        mc.level + 1,
        mc.path || e.id
        
    FROM employees e
    INNER JOIN manager_chain mc ON e.id = mc.reporting_manager_id
    
    WHERE 
        mc.level < 20
        AND NOT (e.id = ANY(mc.path))
)
SELECT 
    mc.level,
    mc.employee_id,
    mc.first_name,
    mc.last_name,
    mc.email,
    
    des.name AS designation_name,
    des.level AS designation_level,
    
    -- Show chain with arrows
    STRING_AGG(
        mc.first_name || ' ' || mc.last_name || ' (' || mc.employee_id || ')',
        ' → '
        ORDER BY mc.level
    ) OVER() AS reporting_chain

FROM manager_chain mc
INNER JOIN designations des ON mc.designation_id = des.id

ORDER BY mc.level;

-- Performance: 5-15ms
-- Returns: Employee → Manager → Senior Manager → ... → CEO
```

---

**Pattern 4: Organization Chart (Complete Hierarchy)**

```sql
-- ✅ COMPLETE ORG CHART: All employees with hierarchy
WITH RECURSIVE org_tree AS (
    -- Base case: Top-level employees (CEO, etc.)
    SELECT 
        id,
        employee_id,
        first_name,
        last_name,
        email,
        department_id,
        designation_id,
        reporting_manager_id,
        1 AS level,
        ARRAY[id] AS path,
        employee_id::TEXT AS sort_path  -- For sorting
        
    FROM employees
    WHERE reporting_manager_id IS NULL AND status = 'active'
    
    UNION ALL
    
    -- Recursive case: All subordinates
    SELECT 
        e.id,
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.department_id,
        e.designation_id,
        e.reporting_manager_id,
        ot.level + 1,
        ot.path || e.id,
        ot.sort_path || '/' || e.employee_id
        
    FROM employees e
    INNER JOIN org_tree ot ON e.reporting_manager_id = ot.id
    
    WHERE 
        e.status = 'active'
        AND ot.level < 20
        AND NOT (e.id = ANY(ot.path))
)
SELECT 
    ot.level,
    ot.employee_id,
    ot.first_name,
    ot.last_name,
    ot.email,
    
    d.name AS department_name,
    des.name AS designation_name,
    des.level AS designation_level,
    
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    mgr.employee_id AS manager_employee_id,
    
    -- Hierarchical display with indentation
    REPEAT('  ', ot.level - 1) || '└─ ' || ot.first_name || ' ' || ot.last_name AS tree_display,
    
    -- Subordinate count
    (SELECT COUNT(*) FROM org_tree WHERE reporting_manager_id = ot.id) AS direct_reports

FROM org_tree ot
INNER JOIN departments d ON ot.department_id = d.id
INNER JOIN designations des ON ot.designation_id = des.id
LEFT JOIN employees mgr ON ot.reporting_manager_id = mgr.id

ORDER BY ot.sort_path;  -- Maintains tree order

-- Performance: 30-50ms for 1000 employees
-- Returns: Complete organization structure
```

---

**Pattern 5: Team Size Calculation (Manager with Counts)**

```sql
-- ✅ TEAM SIZE: Count all subordinates (direct + indirect)
WITH RECURSIVE team_size AS (
    SELECT 
        id AS manager_id,
        id AS employee_id,
        1 AS is_manager
    FROM employees
    WHERE id = $1
    
    UNION ALL
    
    SELECT 
        ts.manager_id,
        e.id,
        0
    FROM employees e
    INNER JOIN team_size ts ON e.reporting_manager_id = ts.employee_id
    WHERE e.status = 'active'
)
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    
    d.name AS department_name,
    des.name AS designation_name,
    
    -- Total team size (including manager)
    (SELECT COUNT(*) FROM team_size) AS total_team_size,
    
    -- Direct reports only
    (SELECT COUNT(*) FROM employees WHERE reporting_manager_id = e.id AND status = 'active') AS direct_reports,
    
    -- Indirect reports (total - direct - 1 for manager)
    (SELECT COUNT(*) FROM team_size) - 
    (SELECT COUNT(*) FROM employees WHERE reporting_manager_id = e.id AND status = 'active') - 1 AS indirect_reports

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id

WHERE e.id = $1;

-- Performance: 10-20ms
-- Returns: Single row with team size breakdown
```

---

#### **14.2.4. Employee Search with Filters**

**Use Case**: Global employee search with multiple filter combinations and full-text search.

---

**Pattern 1: Basic Multi-Field Search**

```sql
-- ✅ BASIC SEARCH: Search across multiple fields
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.status,
    
    d.name AS department_name,
    des.name AS designation_name,
    
    -- Highlight matching field
    CASE 
        WHEN e.first_name ILIKE '%' || $1 || '%' THEN 'First Name'
        WHEN e.last_name ILIKE '%' || $1 || '%' THEN 'Last Name'
        WHEN e.email ILIKE '%' || $1 || '%' THEN 'Email'
        WHEN e.employee_id ILIKE '%' || $1 || '%' THEN 'Employee ID'
        WHEN e.phone ILIKE '%' || $1 || '%' THEN 'Phone'
    END AS matched_field

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id

WHERE 
    (
        e.first_name ILIKE '%' || $1 || '%'
        OR e.last_name ILIKE '%' || $1 || '%'
        OR e.email ILIKE '%' || $1 || '%'
        OR e.employee_id ILIKE '%' || $1 || '%'
        OR e.phone ILIKE '%' || $1 || '%'
    )
    AND e.status = 'active'

ORDER BY 
    -- Exact matches first
    CASE WHEN e.employee_id = $1 THEN 1 ELSE 2 END,
    -- Then by relevance
    CASE 
        WHEN e.first_name ILIKE $1 || '%' THEN 1  -- Starts with
        WHEN e.last_name ILIKE $1 || '%' THEN 1
        ELSE 2  -- Contains
    END,
    e.first_name, e.last_name

LIMIT 20;

-- Performance: 10-20ms with pattern indexes
-- Indexes: idx_employees_first_name_pattern, idx_employees_last_name_pattern, etc.
```

---

**Pattern 2: Full-Text Search (PostgreSQL GIN)**

```sql
-- ✅ FULL-TEXT SEARCH: Using GIN index
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    
    d.name AS department_name,
    des.name AS designation_name,
    
    -- Relevance ranking
    ts_rank(
        to_tsvector('english', 
            e.first_name || ' ' || e.last_name || ' ' || 
            COALESCE(e.email, '') || ' ' || 
            COALESCE(e.phone, '')
        ),
        to_tsquery('english', $1)
    ) AS rank

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id

WHERE 
    to_tsvector('english', 
        e.first_name || ' ' || e.last_name || ' ' || 
        COALESCE(e.email, '') || ' ' || 
        COALESCE(e.phone, '')
    ) @@ to_tsquery('english', $1)
    AND e.status = 'active'

ORDER BY rank DESC, e.first_name

LIMIT 20;

-- Usage: Pass search term like 'john & doe' or 'john | jane'
-- Performance: 5-10ms with GIN index (idx_employees_fulltext)
-- Index: CREATE INDEX idx_employees_fulltext ON employees USING GIN (to_tsvector(...))
```

---

**Pattern 3: Advanced Filters with Dynamic SQL**

```sql
-- ✅ DYNAMIC FILTERS: Multiple optional filters
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.join_date,
    e.status,
    e.ctc,
    
    d.id AS department_id,
    d.name AS department_name,
    
    des.id AS designation_id,
    des.name AS designation_name,
    des.level AS designation_level,
    
    mgr.first_name || ' ' || mgr.last_name AS manager_name

FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id

WHERE 
    -- Status filter (required)
    e.status = ANY($1::TEXT[])  -- ['active', 'probation']
    
    -- Department filter (optional)
    AND ($2::UUID[] IS NULL OR e.department_id = ANY($2))
    
    -- Designation filter (optional)
    AND ($3::UUID[] IS NULL OR e.designation_id = ANY($3))
    
    -- Manager filter (optional)
    AND ($4::UUID IS NULL OR e.reporting_manager_id = $4)
    
    -- Join date range (optional)
    AND ($5::DATE IS NULL OR e.join_date >= $5)
    AND ($6::DATE IS NULL OR e.join_date <= $6)
    
    -- Salary range (optional)
    AND ($7::NUMERIC IS NULL OR e.ctc >= $7)
    AND ($8::NUMERIC IS NULL OR e.ctc <= $8)
    
    -- Search term (optional)
    AND (
        $9::TEXT IS NULL 
        OR e.first_name ILIKE '%' || $9 || '%'
        OR e.last_name ILIKE '%' || $9 || '%'
        OR e.email ILIKE '%' || $9 || '%'
        OR e.employee_id ILIKE '%' || $9 || '%'
    )

ORDER BY 
    CASE WHEN $10 = 'name_asc' THEN e.first_name END ASC,
    CASE WHEN $10 = 'name_desc' THEN e.first_name END DESC,
    CASE WHEN $10 = 'join_date_asc' THEN e.join_date END ASC,
    CASE WHEN $10 = 'join_date_desc' THEN e.join_date END DESC,
    CASE WHEN $10 = 'salary_asc' THEN e.ctc END ASC,
    CASE WHEN $10 = 'salary_desc' THEN e.ctc END DESC,
    e.employee_id

LIMIT $11 OFFSET $12;

-- Parameters:
-- $1: status[] - ['active', 'probation']
-- $2: department_ids[] - [uuid, uuid] or NULL
-- $3: designation_ids[] - [uuid, uuid] or NULL
-- $4: manager_id - uuid or NULL
-- $5: join_date_from - date or NULL
-- $6: join_date_to - date or NULL
-- $7: ctc_min - numeric or NULL
-- $8: ctc_max - numeric or NULL
-- $9: search_term - text or NULL
-- $10: sort_by - 'name_asc', 'join_date_desc', etc.
-- $11: limit
-- $12: offset

-- Performance: 15-30ms depending on filters
```

---

#### **14.2.5. Active Loans with Pending EMIs**

**Use Case**: Monthly payroll processing - find all active loans and calculate EMI deductions.

---

**Pattern 1: Active Loans with Next EMI**

```sql
-- ✅ PAYROLL: Active loans with upcoming EMI for current month
SELECT 
    e.id AS employee_id,
    e.employee_id AS employee_code,
    e.first_name,
    e.last_name,
    
    lr.id AS loan_id,
    lr.loan_number,
    lr.loan_amount,
    lr.interest_rate,
    
    -- GENERATED columns
    lr.total_amount,
    lr.emi_amount,
    lr.remaining_balance,
    lr.remaining_emis,
    lr.completion_percentage,
    
    lr.number_of_emis,
    lr.total_paid_emis,
    lr.disbursed_at,
    lr.status AS loan_status,
    
    -- Next unpaid EMI
    (
        SELECT json_build_object(
            'emi_id', le.id,
            'emi_number', le.emi_number,
            'emi_amount', le.emi_amount,
            'due_date', le.due_date,
            'is_paid', le.is_paid
        )
        FROM loan_emis le
        WHERE le.loan_id = lr.id 
        AND le.is_paid = false
        ORDER BY le.due_date ASC
        LIMIT 1
    ) AS next_emi

FROM employees e
INNER JOIN loan_records lr ON lr.employee_id = e.id

WHERE 
    e.status = 'active'
    AND lr.status = 'active'
    AND lr.remaining_emis > 0

ORDER BY e.employee_id;

-- Performance: 8-15ms
-- Index: idx_loan_records_employee_status (partial index WHERE status = 'active')
-- Returns: All employees with active loans + next EMI details
```

---

**Pattern 2: EMI Deduction for Payroll Month**

```sql
-- ✅ PAYROLL DEDUCTION: EMIs due for specific month
SELECT 
    e.id AS employee_id,
    e.employee_id AS employee_code,
    e.first_name,
    e.last_name,
    e.gross AS employee_gross_salary,
    
    -- Loan details
    json_agg(
        json_build_object(
            'loan_id', lr.id,
            'loan_number', lr.loan_number,
            'loan_amount', lr.loan_amount,
            'emi_id', le.id,
            'emi_number', le.emi_number,
            'emi_amount', le.emi_amount,
            'due_date', le.due_date
        ) ORDER BY le.due_date
    ) AS emis_to_deduct,
    
    -- Total EMI deduction for this month
    SUM(le.emi_amount) AS total_emi_deduction,
    
    -- Remaining salary after EMI
    e.gross - SUM(le.emi_amount) AS salary_after_emi_deduction,
    
    -- Check if deduction is feasible
    CASE 
        WHEN SUM(le.emi_amount) > e.gross * 0.5 THEN 'Warning: EMI exceeds 50% of gross'
        WHEN SUM(le.emi_amount) > e.gross THEN 'Error: EMI exceeds gross salary'
        ELSE 'OK'
    END AS deduction_status

FROM employees e
INNER JOIN loan_records lr ON lr.employee_id = e.id
INNER JOIN loan_emis le ON le.loan_id = lr.id

WHERE 
    e.status = 'active'
    AND lr.status = 'active'
    AND le.is_paid = false
    AND EXTRACT(YEAR FROM le.due_date) = $1  -- Payroll year
    AND EXTRACT(MONTH FROM le.due_date) = $2  -- Payroll month

GROUP BY e.id, e.employee_id, e.first_name, e.last_name, e.gross
ORDER BY total_emi_deduction DESC;

-- Performance: 10-20ms
-- Critical for: Monthly payroll processing
-- Returns: Employees with EMI deductions for the month + validation
```

---

**Pattern 3: Overdue EMIs Report**

```sql
-- ✅ OVERDUE: EMIs past due date
SELECT 
    e.id AS employee_id,
    e.employee_id AS employee_code,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.status AS employee_status,
    
    d.name AS department_name,
    mgr.first_name || ' ' || mgr.last_name AS manager_name,
    
    lr.id AS loan_id,
    lr.loan_number,
    lr.loan_amount,
    lr.total_amount,
    lr.status AS loan_status,
    lr.disbursed_at,
    
    le.id AS emi_id,
    le.emi_number,
    le.emi_amount,
    le.due_date,
    le.is_paid,
    
    -- Days overdue
    CURRENT_DATE - le.due_date AS days_overdue,
    
    -- Overdue severity
    CASE 
        WHEN CURRENT_DATE - le.due_date <= 7 THEN 'Recent (1 week)'
        WHEN CURRENT_DATE - le.due_date <= 30 THEN 'Medium (1 month)'
        WHEN CURRENT_DATE - le.due_date <= 90 THEN 'High (3 months)'
        ELSE 'Critical (>3 months)'
    END AS overdue_severity

FROM employees e
INNER JOIN loan_records lr ON lr.employee_id = e.id
INNER JOIN loan_emis le ON le.loan_id = lr.id
INNER JOIN departments d ON e.department_id = d.id
LEFT JOIN employees mgr ON e.reporting_manager_id = mgr.id

WHERE 
    le.is_paid = false
    AND le.due_date < CURRENT_DATE
    AND lr.status IN ('active', 'defaulted')

ORDER BY 
    le.due_date ASC,  -- Oldest overdue first
    le.emi_amount DESC;

-- Performance: 5-10ms (usually few overdue EMIs)
-- Usage: Collections/recovery report
-- Trigger alerts for overdue EMIs
```

---

**Pattern 4: Loan Aging Analysis**

```sql
-- ✅ AGING: Loan aging buckets
WITH loan_aging AS (
    SELECT 
        lr.id AS loan_id,
        lr.employee_id,
        lr.loan_number,
        lr.loan_amount,
        lr.disbursed_at,
        lr.remaining_balance,
        lr.remaining_emis,
        lr.status,
        
        -- Age in months
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, lr.disbursed_at)) * 12 + 
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, lr.disbursed_at)) AS age_months,
        
        -- Aging bucket
        CASE 
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, lr.disbursed_at)) * 12 + 
                 EXTRACT(MONTH FROM AGE(CURRENT_DATE, lr.disbursed_at)) <= 6 THEN '0-6 months'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, lr.disbursed_at)) * 12 + 
                 EXTRACT(MONTH FROM AGE(CURRENT_DATE, lr.disbursed_at)) <= 12 THEN '7-12 months'
            WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, lr.disbursed_at)) * 12 + 
                 EXTRACT(MONTH FROM AGE(CURRENT_DATE, lr.disbursed_at)) <= 24 THEN '13-24 months'
            ELSE '>24 months'
        END AS aging_bucket
        
    FROM loan_records lr
    WHERE lr.status IN ('active', 'completed')
    AND lr.disbursed_at IS NOT NULL
)
SELECT 
    aging_bucket,
    
    COUNT(*) AS loan_count,
    COUNT(DISTINCT employee_id) AS employee_count,
    
    SUM(loan_amount) AS total_loan_amount,
    SUM(remaining_balance) AS total_remaining_balance,
    
    AVG(loan_amount) AS avg_loan_amount,
    AVG(remaining_balance) AS avg_remaining_balance,
    AVG(age_months) AS avg_age_months,
    
    MIN(loan_amount) AS min_loan_amount,
    MAX(loan_amount) AS max_loan_amount

FROM loan_aging

GROUP BY aging_bucket
ORDER BY 
    CASE aging_bucket
        WHEN '0-6 months' THEN 1
        WHEN '7-12 months' THEN 2
        WHEN '13-24 months' THEN 3
        ELSE 4
    END;

-- Performance: 8-12ms
-- Returns: Loan portfolio analysis by age
```

---

### 14.3. Performance Considerations

Comprehensive performance planning, monitoring, and optimization strategies for the EcoVale HR database.

---

#### **14.3.1. Table Size Estimates**

Projected storage requirements and growth patterns for all 20 tables based on business assumptions.

---

**Business Assumptions**:
- **Employee count**: 1,000 employees (current), growing 15% annually
- **Retention period**: 7 years for compliance (GDPR, labor laws)
- **Monthly transactions**: Attendance, payroll, documents
- **Archive strategy**: Soft deletes with status changes

---

**Storage Calculations**:

```sql
-- Query to check actual table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**Table Size Projections** (1000 employees, 3 years data):

| Table | Rows (Current) | Row Size (avg) | Table Size | Indexes Size | Total Size | Growth Rate | Size (7 years) |
|-------|----------------|----------------|------------|--------------|------------|-------------|----------------|
| **Authentication & Authorization** |
| users | 1,050 | 350 bytes | 350 KB | 180 KB | 530 KB | 15%/year | 1.2 MB |
| sessions | 5,000 | 250 bytes | 1.2 MB | 800 KB | 2 MB | High churn | 2 MB (stable) |
| audit_logs | 500,000 | 400 bytes | 200 MB | 100 MB | 300 MB | 150k/month | 13 GB |
| **Organizational Structure** |
| departments | 50 | 200 bytes | 10 KB | 8 KB | 18 KB | 5%/year | 25 KB |
| designations | 120 | 250 bytes | 30 KB | 20 KB | 50 KB | 10%/year | 85 KB |
| employees | 1,000 | 800 bytes | 800 KB | 500 KB | 1.3 MB | 15%/year | 2.8 MB |
| **Employee Core Data** |
| bank_details | 1,200 | 350 bytes | 420 KB | 250 KB | 670 KB | 15%/year | 1.5 MB |
| documents | 15,000 | 500 bytes | 7.5 MB | 4 MB | 11.5 MB | 1k/month | 80 MB |
| career_history | 3,000 | 450 bytes | 1.4 MB | 900 KB | 2.3 MB | 500/year | 6 MB |
| salary_annexures | 2,000 | 400 bytes | 800 KB | 500 KB | 1.3 MB | 500/year | 3.5 MB |
| **Attendance Management** |
| attendance_records | 36,000 | 350 bytes | 12.6 MB | 8 MB | 20.6 MB | 12k/year | 95 MB |
| **Payroll Management** |
| pay_runs | 36 | 300 bytes | 11 KB | 10 KB | 21 KB | 12/year | 90 KB |
| pay_run_employee_records | 36,000 | 450 bytes | 16.2 MB | 10 MB | 26.2 MB | 12k/year | 120 MB |
| payslips | 36,000 | 500 bytes | 18 MB | 12 MB | 30 MB | 12k/year | 138 MB |
| **Advance & Loan Management** |
| advance_records | 600 | 350 bytes | 210 KB | 150 KB | 360 KB | 200/year | 1.2 MB |
| loan_records | 400 | 450 bytes | 180 KB | 120 KB | 300 KB | 100/year | 850 KB |
| loan_emis | 4,800 | 300 bytes | 1.4 MB | 900 KB | 2.3 MB | Depends on loans | 7 MB |
| **Letter & Document Generation** |
| letter_templates | 30 | 2,000 bytes | 60 KB | 30 KB | 90 KB | Stable | 95 KB |
| generated_letters | 8,000 | 1,500 bytes | 12 MB | 6 MB | 18 MB | 2k/year | 50 MB |
| **System Configuration** |
| system_settings | 100 | 400 bytes | 40 KB | 25 KB | 65 KB | Stable | 70 KB |
| setting_change_history | 500 | 350 bytes | 175 KB | 100 KB | 275 KB | 100/year | 900 KB |
| **TOTALS** | **650,726** | - | **271 MB** | **144 MB** | **415 MB** | - | **14.5 GB** |

---

**Storage Growth Projections**:

| Year | Employees | Total Rows | Database Size | Indexes Size | Total Storage | Notes |
|------|-----------|------------|---------------|--------------|---------------|-------|
| **Year 1** (Current) | 1,000 | 650k | 271 MB | 144 MB | 415 MB | Baseline |
| **Year 2** | 1,150 | 950k | 450 MB | 240 MB | 690 MB | 15% employee growth |
| **Year 3** | 1,320 | 1.3M | 680 MB | 360 MB | 1.04 GB | Audit logs growing |
| **Year 5** | 1,750 | 2.2M | 1.5 GB | 800 MB | 2.3 GB | Normal operation |
| **Year 7** | 2,300 | 3.5M | 10 GB | 4.5 GB | 14.5 GB | Includes all history |

**Key Insights**:
- **Audit logs dominate** after 3+ years (80% of total size)
- **Payroll tables** grow predictably (12k records/year)
- **Document storage** uses file system (only metadata in DB)
- **Partitioning recommended** for audit_logs after year 3

---

**Partition Strategy for Large Tables**:

```sql
-- Partition audit_logs by month (after 1M+ rows)
CREATE TABLE audit_logs_partitioned (
    id UUID DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    action VARCHAR(50) NOT NULL,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_logs_2024_02 PARTITION OF audit_logs_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Auto-create partitions with pg_partman extension
-- Or use application/cron job to create future partitions

-- Benefits:
-- - Faster queries (scan only relevant partitions)
-- - Easier archival (drop old partitions)
-- - Better index performance (smaller indexes per partition)
```

---

**Archival Strategy**:

```sql
-- Archive old audit logs (older than 7 years)
CREATE TABLE audit_logs_archive (LIKE audit_logs INCLUDING ALL);

-- Move old data (run annually)
WITH archived_rows AS (
    DELETE FROM audit_logs
    WHERE created_at < CURRENT_DATE - INTERVAL '7 years'
    RETURNING *
)
INSERT INTO audit_logs_archive SELECT * FROM archived_rows;

-- Compress archive table
VACUUM FULL audit_logs_archive;

-- Or export to cold storage
COPY (
    SELECT * FROM audit_logs 
    WHERE created_at < CURRENT_DATE - INTERVAL '7 years'
) TO '/archive/audit_logs_2018.csv' WITH CSV HEADER;
```

---

#### **14.3.2. Query Performance Targets**

Service Level Objectives (SLOs) for different query types to ensure responsive user experience.

---

**Performance Tiers**:

| Query Type | Target (p50) | Target (p95) | Target (p99) | Max Acceptable | Priority | Examples |
|------------|--------------|--------------|--------------|----------------|----------|----------|
| **Primary Key Lookup** | <5ms | <10ms | <20ms | 50ms | Critical | `SELECT * FROM employees WHERE id = ?` |
| **Simple List Queries** | <15ms | <30ms | <50ms | 100ms | High | Employee list, department list |
| **Complex Joins (2-3 tables)** | <25ms | <50ms | <100ms | 200ms | High | Employee with dept/designation |
| **Aggregations** | <50ms | <100ms | <200ms | 500ms | Medium | Department totals, payroll summary |
| **Recursive Queries** | <100ms | <200ms | <500ms | 1000ms | Medium | Org chart, reporting chain |
| **Reports (Heavy)** | <500ms | <1000ms | <2000ms | 5000ms | Low | Annual reports, analytics |
| **Bulk Operations** | <2000ms | <5000ms | <10000ms | 30000ms | Low | Batch payroll processing |

**p50 = median, p95 = 95th percentile, p99 = 99th percentile**

---

**Critical Query Performance Targets**:

```sql
-- 1. Login (Primary Key + JOIN) - Target: <10ms
SELECT u.*, e.first_name, e.last_name 
FROM users u 
LEFT JOIN employees e ON u.employee_id = e.id 
WHERE u.username = $1;
-- Expected: 2-5ms with index

-- 2. Employee List Page - Target: <30ms
SELECT e.*, d.name, des.name 
FROM employees e 
JOIN departments d ON e.department_id = d.id 
JOIN designations des ON e.designation_id = des.id 
WHERE e.status = 'active' 
LIMIT 20 OFFSET 0;
-- Expected: 10-20ms with indexes

-- 3. Payroll Processing (per employee) - Target: <50ms
SELECT e.*, att.*, advances.*, loans.* 
FROM employees e 
JOIN attendance_records att ON ... 
LEFT JOIN advance_records advances ON ... 
LEFT JOIN loan_records loans ON ... 
WHERE e.id = $1;
-- Expected: 15-30ms with proper indexes

-- 4. Dashboard Metrics - Target: <100ms
SELECT 
    COUNT(*) FILTER (WHERE status = 'active') as active,
    COUNT(*) FILTER (WHERE status = 'probation') as probation,
    AVG(ctc) as avg_salary
FROM employees;
-- Expected: 30-60ms with partial indexes
```

---

**Performance Monitoring Query**:

```sql
-- Track actual query performance
CREATE TABLE query_performance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_name VARCHAR(100) NOT NULL,
    query_text TEXT,
    execution_time_ms NUMERIC(10,2) NOT NULL,
    rows_returned INTEGER,
    user_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_query_perf_name_time ON query_performance_log(query_name, execution_time_ms);
CREATE INDEX idx_query_perf_created ON query_performance_log(created_at DESC);

-- Application middleware logs query times
INSERT INTO query_performance_log (query_name, execution_time_ms, rows_returned)
VALUES ('employee_list', 23.5, 20);

-- Daily performance report
SELECT 
    query_name,
    COUNT(*) as execution_count,
    ROUND(AVG(execution_time_ms), 2) as avg_time_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms), 2) as p50_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms), 2) as p95_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms), 2) as p99_ms,
    MAX(execution_time_ms) as max_time_ms
FROM query_performance_log
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
GROUP BY query_name
ORDER BY p95_ms DESC;
```

---

#### **14.3.3. Slow Query Identification**

Techniques for identifying, analyzing, and resolving slow queries.

---

**Enable PostgreSQL Slow Query Logging**:

```sql
-- In postgresql.conf or via ALTER SYSTEM
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries >100ms
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
ALTER SYSTEM SET log_statement = 'none';  -- Don't log all statements
ALTER SYSTEM SET log_duration = 'off';  -- Duration in slow query log
ALTER SYSTEM SET log_lock_waits = 'on';  -- Log lock waits
ALTER SYSTEM SET deadlock_timeout = '1s';

-- Reload configuration
SELECT pg_reload_conf();

-- Check current settings
SHOW log_min_duration_statement;
SHOW log_line_prefix;
```

**Slow query log location**: `/var/log/postgresql/postgresql-14-main.log`

---

**Real-Time Slow Query Detection**:

```sql
-- View currently running queries
SELECT 
    pid,
    now() - query_start AS duration,
    state,
    query,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;

-- Kill long-running query (if needed)
SELECT pg_cancel_backend(12345);  -- Gentle cancel
SELECT pg_terminate_backend(12345);  -- Force kill
```

---

**pg_stat_statements Extension** (Best Practice):

```sql
-- Enable extension (requires postgresql.conf change)
-- shared_preload_libraries = 'pg_stat_statements'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slowest queries by total time
SELECT 
    queryid,
    LEFT(query, 80) AS short_query,
    calls,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND(max_exec_time::numeric, 2) AS max_time_ms,
    ROUND(stddev_exec_time::numeric, 2) AS stddev_time_ms,
    ROUND((total_exec_time / sum(total_exec_time) OVER()) * 100, 2) AS pct_total_time,
    rows AS total_rows,
    ROUND((rows::numeric / calls), 2) AS avg_rows_per_call
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- View queries with highest average time
SELECT 
    queryid,
    LEFT(query, 100) AS query_text,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND(max_exec_time::numeric, 2) AS max_time_ms,
    rows
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_%'
  AND calls > 10  -- Exclude rarely called queries
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Reset statistics (after optimization)
SELECT pg_stat_statements_reset();
```

---

**EXPLAIN ANALYZE for Query Optimization**:

```sql
-- Analyze query execution plan
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, TIMING)
SELECT e.*, d.name, des.name
FROM employees e
INNER JOIN departments d ON e.department_id = d.id
INNER JOIN designations des ON e.designation_id = des.id
WHERE e.status = 'active'
ORDER BY e.join_date DESC
LIMIT 20;

-- Key metrics to review:
-- 1. Execution Time: Actual time spent
-- 2. Planning Time: Time to create execution plan
-- 3. Node Types: Seq Scan (bad) vs Index Scan (good)
-- 4. Rows: Estimated vs actual (large variance = bad stats)
-- 5. Buffers: Shared hit (cache) vs read (disk I/O)
```

**Example Output Analysis**:

```
-- BAD (Sequential Scan):
Seq Scan on employees e  (cost=0.00..25.00 rows=500 width=100) (actual time=0.050..12.500 rows=800)
  Filter: (status = 'active')
  Rows Removed by Filter: 200
  Buffers: shared hit=15 read=10
-- Problem: Full table scan, no index used
-- Solution: CREATE INDEX idx_employees_status ON employees(status);

-- GOOD (Index Scan):
Index Scan using idx_employees_status on employees e  (cost=0.28..85.36 rows=500 width=100) (actual time=0.025..2.150 rows=800)
  Index Cond: (status = 'active')
  Buffers: shared hit=5
-- Optimization: Index used, 6x faster, fewer buffer reads
```

---

**Common Slow Query Patterns & Solutions**:

| Problem Pattern | Symptom | Solution |
|----------------|---------|----------|
| **Missing Index** | Seq Scan on filtered column | Add index on WHERE/JOIN columns |
| **Full Table Scan** | High buffer reads, slow | Add covering index, use partial index |
| **Table Bloat** | Large table size, slow scans | VACUUM FULL, REINDEX |
| **N+1 Queries** | Many small queries | Use JOINs or batch fetching |
| **Large OFFSET** | Pagination slow on high pages | Use cursor-based pagination |
| **Unbounded Results** | No LIMIT clause | Always add LIMIT for lists |
| **Complex Subqueries** | Subquery executed per row | Rewrite as JOIN or CTE |
| **Lock Contention** | wait_event_type = 'Lock' | Reduce transaction time, use FOR UPDATE SKIP LOCKED |
| **Outdated Statistics** | Bad row estimates | Run ANALYZE |
| **Cartesian Product** | Huge rows returned | Fix JOIN conditions |

---

#### **14.3.4. Index Usage Analysis**

Monitor which indexes are used, identify unused indexes, and optimize index strategy.

---

**Index Usage Statistics**:

```sql
-- View index usage for all tables
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    
    -- Usage classification
    CASE 
        WHEN idx_scan = 0 THEN '🔴 UNUSED'
        WHEN idx_scan < 100 THEN '🟡 RARELY USED'
        WHEN idx_scan < 1000 THEN '🟢 MODERATE'
        ELSE '🟢 HEAVILY USED'
    END AS usage_status,
    
    -- Index efficiency
    CASE 
        WHEN idx_scan > 0 THEN ROUND(idx_tup_fetch::numeric / idx_scan, 2)
        ELSE 0
    END AS avg_tuples_per_scan

FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- Unused indexes (candidates for removal)
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey'  -- Keep primary keys
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

**Index Size vs Usage Efficiency**:

```sql
-- Large indexes with low usage (optimization candidates)
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_relation_size(indexrelid) AS size_bytes,
    idx_scan,
    
    -- Cost-benefit ratio
    CASE 
        WHEN idx_scan > 0 THEN 
            ROUND(pg_relation_size(indexrelid)::numeric / idx_scan / 1024, 2)
        ELSE 999999
    END AS kb_per_scan,
    
    -- Recommendation
    CASE 
        WHEN idx_scan = 0 THEN 'Consider dropping'
        WHEN idx_scan < 10 AND pg_relation_size(indexrelid) > 10485760 THEN 'Review necessity (>10MB, <10 scans)'
        WHEN pg_relation_size(indexrelid)::numeric / NULLIF(idx_scan, 0) > 1048576 THEN 'Poor ROI (>1MB per scan)'
        ELSE 'OK'
    END AS recommendation

FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 1048576  -- >1MB
ORDER BY size_bytes / NULLIF(idx_scan, 0) DESC NULLS FIRST;
```

---

**Cache Hit Ratio**:

```sql
-- Overall cache hit ratio (should be >95%)
SELECT 
    'Cache Hit Ratio' AS metric,
    ROUND(
        SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0) * 100,
        2
    ) AS percentage
FROM pg_statio_user_tables
UNION ALL
SELECT 
    'Index Cache Hit Ratio',
    ROUND(
        SUM(idx_blks_hit) / NULLIF(SUM(idx_blks_hit + idx_blks_read), 0) * 100,
        2
    )
FROM pg_statio_user_tables;

-- Per-table cache hit ratio
SELECT 
    schemaname,
    tablename,
    
    -- Table cache hit ratio
    ROUND(
        heap_blks_hit::numeric / NULLIF(heap_blks_hit + heap_blks_read, 0) * 100,
        2
    ) AS table_cache_hit_pct,
    
    -- Index cache hit ratio
    ROUND(
        idx_blks_hit::numeric / NULLIF(idx_blks_hit + idx_blks_read, 0) * 100,
        2
    ) AS index_cache_hit_pct,
    
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size

FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY (heap_blks_hit + heap_blks_read + idx_blks_hit + idx_blks_read) DESC;

-- If cache hit ratio <95%, consider increasing shared_buffers
```

---

**Duplicate/Overlapping Indexes**:

```sql
-- Find duplicate indexes (same columns)
WITH index_columns AS (
    SELECT 
        i.indexrelid::regclass AS index_name,
        t.relname AS table_name,
        ARRAY_AGG(a.attname ORDER BY a.attnum) AS columns
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
    WHERE t.relkind = 'r'
      AND t.relnamespace = 'public'::regnamespace
    GROUP BY i.indexrelid, t.relname
)
SELECT 
    ic1.table_name,
    ic1.index_name AS index_1,
    ic2.index_name AS index_2,
    ic1.columns,
    pg_size_pretty(pg_relation_size(ic1.index_name)) AS index_1_size,
    pg_size_pretty(pg_relation_size(ic2.index_name)) AS index_2_size
FROM index_columns ic1
JOIN index_columns ic2 
    ON ic1.table_name = ic2.table_name 
    AND ic1.columns = ic2.columns 
    AND ic1.index_name < ic2.index_name
ORDER BY ic1.table_name, ic1.index_name;

-- Consider dropping one of the duplicate indexes
```

---

**Index Bloat Detection**:

```sql
-- Check index bloat (requires pgstattuple extension)
CREATE EXTENSION IF NOT EXISTS pgstattuple;

-- Check specific index bloat
SELECT 
    indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    ROUND(100 * (1 - avg_leaf_density / 100), 2) AS bloat_pct,
    CASE 
        WHEN (1 - avg_leaf_density / 100) > 0.3 THEN 'REINDEX recommended'
        WHEN (1 - avg_leaf_density / 100) > 0.2 THEN 'Monitor'
        ELSE 'OK'
    END AS recommendation
FROM pg_stat_user_indexes
JOIN LATERAL pgstatindex(indexrelid::regclass::text) ON true
WHERE pg_relation_size(indexrelid) > 1048576  -- >1MB
ORDER BY (1 - avg_leaf_density / 100) DESC;

-- Rebuild bloated index
REINDEX INDEX CONCURRENTLY idx_employees_status;
```

---

#### **14.3.5. VACUUM and ANALYZE**

Maintenance operations to reclaim space and update statistics for optimal query planning.

---

**Understanding VACUUM**:

```sql
-- VACUUM: Reclaims dead tuple space (from UPDATEs/DELETEs)
-- ANALYZE: Updates table statistics for query planner

-- Manual vacuum (non-blocking)
VACUUM employees;

-- Vacuum with analyze
VACUUM ANALYZE employees;

-- Aggressive vacuum (more thorough, blocking)
VACUUM FULL employees;  -- Requires exclusive lock, rewrites table

-- Vacuum all tables
VACUUM ANALYZE;
```

---

**Auto-Vacuum Configuration** (Recommended):

```sql
-- Check current auto-vacuum settings
SHOW autovacuum;
SHOW autovacuum_naptime;
SHOW autovacuum_vacuum_scale_factor;
SHOW autovacuum_analyze_scale_factor;

-- Recommended settings for HR system (in postgresql.conf)
-- autovacuum = on
-- autovacuum_naptime = 1min  (default: 1min)
-- autovacuum_vacuum_scale_factor = 0.1  (vacuum when 10% of rows change)
-- autovacuum_analyze_scale_factor = 0.05  (analyze when 5% of rows change)
-- autovacuum_vacuum_cost_limit = 200  (speed, higher = faster)
-- autovacuum_max_workers = 3

-- Per-table auto-vacuum tuning (for high-churn tables)
ALTER TABLE audit_logs SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- More frequent (5% threshold)
    autovacuum_analyze_scale_factor = 0.02  -- More frequent analysis
);

ALTER TABLE sessions SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_vacuum_cost_delay = 10  -- Faster vacuum
);
```

---

**Monitor Auto-Vacuum Activity**:

```sql
-- Check last vacuum/analyze times
SELECT 
    schemaname,
    relname AS table_name,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    
    -- Dead tuple ratio
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_tuple_pct,
    
    -- Vacuum recommendation
    CASE 
        WHEN n_dead_tup::numeric / NULLIF(n_live_tup, 0) > 0.1 THEN '⚠️ VACUUM needed'
        WHEN n_dead_tup::numeric / NULLIF(n_live_tup, 0) > 0.05 THEN '⚠️ Monitor'
        ELSE '✅ OK'
    END AS status

FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC, last_autovacuum ASC NULLS FIRST;

-- Currently running vacuum operations
SELECT 
    pid,
    now() - query_start AS duration,
    query
FROM pg_stat_activity
WHERE query LIKE '%VACUUM%' OR query LIKE '%autovacuum%';
```

---

**Table Bloat Detection**:

```sql
-- Detect table bloat (requires pgstattuple)
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    
    -- Bloat percentage
    ROUND(
        100 * (pg_total_relation_size(schemaname||'.'||tablename)::numeric - 
               pg_relation_size(schemaname||'.'||tablename)::numeric) / 
        NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0),
        2
    ) AS bloat_pct,
    
    -- Recommendation
    CASE 
        WHEN pg_total_relation_size(schemaname||'.'||tablename) > 107374182  -- >100MB
             AND (pg_total_relation_size(schemaname||'.'||tablename)::numeric - 
                  pg_relation_size(schemaname||'.'||tablename)::numeric) / 
                 NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0) > 0.3
        THEN 'VACUUM FULL recommended'
        ELSE 'OK'
    END AS recommendation

FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**Maintenance Schedule** (Recommended):

```bash
# Cron job: Daily ANALYZE for frequently changing tables
0 2 * * * psql -d ecovale_hr -c "ANALYZE employees, attendance_records, pay_run_employee_records;"

# Weekly VACUUM ANALYZE for all tables
0 3 * * 0 psql -d ecovale_hr -c "VACUUM ANALYZE;"

# Monthly REINDEX for high-churn indexes
0 4 1 * * psql -d ecovale_hr -c "REINDEX INDEX CONCURRENTLY idx_audit_logs_created_at;"

# Quarterly VACUUM FULL (maintenance window required)
# Run manually during low-traffic period
```

---

#### **14.3.6. Connection Pooling**

Optimize database connections for concurrent users and application scalability.

---

**Why Connection Pooling?**

- ✅ PostgreSQL connection overhead: 1-3ms per connection
- ✅ Limited max_connections (typically 100-200)
- ✅ Connection pooling reuses connections: 10-100x more concurrent users
- ✅ Reduces context switching and memory usage

---

**PgBouncer Setup** (Recommended):

```bash
# Install PgBouncer
sudo apt-get install pgbouncer

# Configuration: /etc/pgbouncer/pgbouncer.ini
[databases]
ecovale_hr = host=localhost port=5432 dbname=ecovale_hr

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool mode
pool_mode = transaction  # transaction | session | statement

# Connection limits
max_client_conn = 1000  # Max client connections
default_pool_size = 25  # Connections per database
reserve_pool_size = 5   # Reserve connections
reserve_pool_timeout = 3

# Timeouts
server_idle_timeout = 600  # Close idle server connections after 10min
query_timeout = 30  # Kill queries running >30s

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

**Pool Modes**:
- **Transaction** (Recommended): Connection released after transaction commit
- **Session**: Connection held for entire client session
- **Statement**: Connection released after each statement (fastest, but breaks some features)

---

**Application Configuration** (Node.js example):

```typescript
// Using pg (node-postgres) with PgBouncer
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 6432,  // PgBouncer port
  database: 'ecovale_hr',
  user: 'app_user',
  password: process.env.DB_PASSWORD,
  
  // Application-side pool settings
  max: 20,  // Max connections in app pool
  min: 5,   // Min idle connections
  idleTimeoutMillis: 30000,  // Close idle clients after 30s
  connectionTimeoutMillis: 5000,  // Timeout if no connection available
  
  // Keep connections alive (important for PgBouncer transaction mode)
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Query with automatic connection management
async function getEmployee(id: string) {
  const result = await pool.query(
    'SELECT * FROM employees WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

// Explicit transaction (important for transaction pool mode)
async function transferEmployee(employeeId: string, newDeptId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update employee
    await client.query(
      'UPDATE employees SET department_id = $1 WHERE id = $2',
      [newDeptId, employeeId]
    );
    
    // Log change
    await client.query(
      'INSERT INTO career_history (...) VALUES (...)'
    );
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();  // Return connection to pool
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  console.log('Database pool closed');
});
```

---

**Monitor Connection Pool**:

```sql
-- Check active connections
SELECT 
    datname AS database,
    usename AS user,
    application_name,
    state,
    COUNT(*) AS connection_count
FROM pg_stat_activity
WHERE datname = 'ecovale_hr'
GROUP BY datname, usename, application_name, state
ORDER BY connection_count DESC;

-- Connection pool statistics
SELECT 
    COUNT(*) AS total_connections,
    COUNT(*) FILTER (WHERE state = 'active') AS active,
    COUNT(*) FILTER (WHERE state = 'idle') AS idle,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
    COUNT(*) FILTER (WHERE state = 'idle in transaction (aborted)') AS aborted,
    MAX(now() - state_change) AS longest_idle_duration
FROM pg_stat_activity
WHERE datname = 'ecovale_hr';

-- PgBouncer statistics (via SHOW commands)
-- Connect to pgbouncer admin console: psql -p 6432 -U pgbouncer pgbouncer
SHOW POOLS;  -- Pool statistics
SHOW CLIENTS;  -- Client connections
SHOW SERVERS;  -- Server connections
SHOW STATS;  -- Query statistics
```

---

**Connection Limits**:

```sql
-- Check max connections
SHOW max_connections;  -- Default: 100

-- Recommended settings (in postgresql.conf)
-- max_connections = 200  (for direct connections)
-- shared_buffers = 4GB   (25% of RAM)
-- effective_cache_size = 12GB  (75% of RAM)

-- With PgBouncer:
-- max_connections = 100  (actual PostgreSQL connections)
-- PgBouncer handles 1000+ client connections
```

---

**Performance Comparison**:

| Metric | Without Pooling | With PgBouncer | Improvement |
|--------|----------------|----------------|-------------|
| **Connection Time** | 2-5ms | 0.1-0.3ms | 10-20x faster |
| **Concurrent Users** | 100 (max_connections) | 1000+ | 10x more |
| **Memory Usage** | ~10MB per connection | ~1MB per client | 10x less |
| **Query Latency** | +2-5ms (connection) | +0.1ms (pool) | Negligible overhead |

---

**Best Practices**:

1. **Use transaction pool mode** for most applications
2. **Set application pool max < PgBouncer default_pool_size * databases**
3. **Monitor idle connections**: Kill connections idle >10 minutes
4. **Use prepared statements**: Improves performance, works with PgBouncer
5. **Graceful shutdown**: Always close pools on application exit
6. **Health checks**: Monitor connection pool exhaustion alerts

---

**Connection Pool Sizing Formula**:

```
Application Pool Size = (CPU cores * 2) + Disk Spindles
For 4-core server with SSD: 4 * 2 + 1 = 9 connections

PgBouncer Pool Size = Application Pool Size * 1.5
Example: 9 * 1.5 = ~15 connections per database

Total Client Connections = Application Instances * Application Pool Size
Example: 5 instances * 20 = 100 client connections (PgBouncer handles)
```

---

**Section 14.3 Complete**: Performance considerations including table size projections, query targets, slow query analysis, index monitoring, VACUUM/ANALYZE strategies, and connection pooling configuration documented.

---

### 14.4. Caching Strategies

Comprehensive caching approaches to reduce database load and improve application response times.

---

#### **14.4.1. Application-Level Caching**

Implement caching in the application layer to reduce repeated database queries.

---

**Redis Cache Strategy**:

```typescript
// Redis client setup
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Key naming convention
const CACHE_KEYS = {
  employee: (id: string) => `employee:${id}`,
  employeeList: (filters: string) => `employees:list:${filters}`,
  department: (id: string) => `department:${id}`,
  departmentList: () => `departments:list`,
  designation: (id: string) => `designation:${id}`,
  designationList: () => `designations:list`,
  userByUsername: (username: string) => `user:username:${username}`,
  employeeReportingChain: (id: string) => `employee:${id}:chain`,
  payroll: (month: string) => `payroll:${month}`,
};

// TTL (Time To Live) strategy
const CACHE_TTL = {
  SHORT: 60,           // 1 minute - frequently changing data
  MEDIUM: 300,         // 5 minutes - moderate changes
  LONG: 1800,          // 30 minutes - rarely changing
  VERY_LONG: 86400,    // 24 hours - static data
};
```

---

**Cache-Aside Pattern** (Most Common):

```typescript
// Get employee with cache-aside pattern
async function getEmployeeById(id: string): Promise<Employee> {
  const cacheKey = CACHE_KEYS.employee(id);
  
  // 1. Try to get from cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('Cache HIT:', cacheKey);
    return JSON.parse(cached);
  }
  
  console.log('Cache MISS:', cacheKey);
  
  // 2. Query database
  const result = await pool.query(
    `SELECT e.*, d.name as department_name, des.name as designation_name
     FROM employees e
     JOIN departments d ON e.department_id = d.id
     JOIN designations des ON e.designation_id = des.id
     WHERE e.id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const employee = result.rows[0];
  
  // 3. Store in cache
  await redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(employee));
  
  return employee;
}

// Performance:
// - Cache HIT: 1-3ms (vs 10-20ms database)
// - Cache MISS: 11-23ms (query + cache write)
// - 80% cache hit rate = 7-14ms average (vs 10-20ms without cache)
```

---

**Read-Through Cache** (Automatic):

```typescript
// Wrapper function for automatic caching
async function cachedQuery<T>(
  cacheKey: string,
  ttl: number,
  queryFn: () => Promise<T>
): Promise<T> {
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Execute query
  const result = await queryFn();
  
  // Cache result
  if (result !== null && result !== undefined) {
    await redis.setex(cacheKey, ttl, JSON.stringify(result));
  }
  
  return result;
}

// Usage examples
const employee = await cachedQuery(
  CACHE_KEYS.employee(id),
  CACHE_TTL.MEDIUM,
  () => db.getEmployee(id)
);

const departments = await cachedQuery(
  CACHE_KEYS.departmentList(),
  CACHE_TTL.VERY_LONG,
  () => db.getDepartments()
);
```

---

**Write-Through Cache** (Immediate Consistency):

```typescript
// Update employee and cache simultaneously
async function updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Update database
    const result = await client.query(
      `UPDATE employees SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        department_id = COALESCE($3, department_id),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [updates.first_name, updates.last_name, updates.department_id, id]
    );
    
    await client.query('COMMIT');
    
    // 2. Update cache immediately
    const employee = result.rows[0];
    const cacheKey = CACHE_KEYS.employee(id);
    await redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(employee));
    
    // 3. Invalidate related caches
    await invalidateRelatedCaches('employee', id);
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

**Cache Invalidation Strategies**:

```typescript
// Strategy 1: TTL-based (Automatic Expiration)
// - Simplest approach
// - May serve stale data until expiry
// - Use for data that changes predictably

// Strategy 2: Event-based Invalidation
async function invalidateRelatedCaches(entity: string, id: string): Promise<void> {
  const patterns = {
    employee: [
      CACHE_KEYS.employee(id),
      `employees:list:*`,  // All employee list caches
      CACHE_KEYS.employeeReportingChain(id),
      `employee:${id}:*`,  // All employee-related caches
    ],
    department: [
      CACHE_KEYS.department(id),
      CACHE_KEYS.departmentList(),
      `employees:list:*`,  // Employee lists include department
    ],
    designation: [
      CACHE_KEYS.designation(id),
      CACHE_KEYS.designationList(),
      `employees:list:*`,
    ],
  };
  
  const keysToDelete = patterns[entity] || [];
  
  for (const pattern of keysToDelete) {
    if (pattern.includes('*')) {
      // Delete by pattern (requires SCAN, careful in production)
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      await redis.del(pattern);
    }
  }
  
  console.log(`Invalidated ${keysToDelete.length} cache patterns for ${entity}:${id}`);
}

// Strategy 3: Version-based Caching
// Include version in cache key: `employee:${id}:v${version}`
// Increment version on update, old cache keys ignored
```

---

**Caching Lookup Tables** (Departments, Designations):

```typescript
// Cache all departments (rarely change)
async function getAllDepartments(): Promise<Department[]> {
  const cacheKey = CACHE_KEYS.departmentList();
  
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await pool.query(
    'SELECT * FROM departments ORDER BY name'
  );
  
  const departments = result.rows;
  
  // Cache for 24 hours (very stable data)
  await redis.setex(cacheKey, CACHE_TTL.VERY_LONG, JSON.stringify(departments));
  
  return departments;
}

// Pre-warm cache on application startup
async function warmupCache(): Promise<void> {
  console.log('Warming up cache...');
  
  await getAllDepartments();
  await getAllDesignations();
  await getSystemSettings();
  
  console.log('Cache warmed up successfully');
}

// Call on application start
warmupCache().catch(console.error);
```

---

**Session Caching**:

```sql
-- Store sessions in Redis instead of database
-- Key: session:{sessionId}
-- Value: JSON with user data

-- Before (database):
SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW();
-- Performance: 5-10ms per request

-- After (Redis):
const session = await redis.get(`session:${token}`);
-- Performance: 0.5-2ms per request (3-10x faster)
```

```typescript
// Session management with Redis
interface Session {
  userId: string;
  employeeId: string;
  username: string;
  role: string;
  expiresAt: Date;
}

async function createSession(userId: string, userData: Session): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const cacheKey = `session:${token}`;
  
  // Store in Redis with auto-expiry
  await redis.setex(
    cacheKey,
    7 * 24 * 60 * 60,  // 7 days
    JSON.stringify(userData)
  );
  
  return token;
}

async function getSession(token: string): Promise<Session | null> {
  const cacheKey = `session:${token}`;
  const cached = await redis.get(cacheKey);
  
  return cached ? JSON.parse(cached) : null;
}

async function deleteSession(token: string): Promise<void> {
  await redis.del(`session:${token}`);
}

// Extend session TTL on activity
async function refreshSession(token: string): Promise<void> {
  const cacheKey = `session:${token}`;
  await redis.expire(cacheKey, 7 * 24 * 60 * 60);
}
```

---

**Cache Metrics & Monitoring**:

```typescript
// Track cache performance
interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgHitTime: number;
  avgMissTime: number;
}

class CacheMonitor {
  private hits = 0;
  private misses = 0;
  private hitTimes: number[] = [];
  private missTimes: number[] = [];
  
  recordHit(duration: number): void {
    this.hits++;
    this.hitTimes.push(duration);
  }
  
  recordMiss(duration: number): void {
    this.misses++;
    this.missTimes.push(duration);
  }
  
  getMetrics(): CacheMetrics {
    const totalRequests = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      avgHitTime: this.average(this.hitTimes),
      avgMissTime: this.average(this.missTimes),
    };
  }
  
  private average(arr: number[]): number {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
  
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.hitTimes = [];
    this.missTimes = [];
  }
}

// Usage
const cacheMonitor = new CacheMonitor();

async function getCachedData(key: string): Promise<any> {
  const start = Date.now();
  const data = await redis.get(key);
  const duration = Date.now() - start;
  
  if (data) {
    cacheMonitor.recordHit(duration);
  } else {
    cacheMonitor.recordMiss(duration);
  }
  
  return data;
}

// Report metrics every hour
setInterval(() => {
  const metrics = cacheMonitor.getMetrics();
  console.log('Cache Metrics:', {
    hitRate: `${(metrics.hitRate * 100).toFixed(2)}%`,
    avgHitTime: `${metrics.avgHitTime.toFixed(2)}ms`,
    avgMissTime: `${metrics.avgMissTime.toFixed(2)}ms`,
  });
  cacheMonitor.reset();
}, 60 * 60 * 1000);
```

---

**Redis Memory Management**:

```bash
# redis.conf settings
maxmemory 2gb
maxmemory-policy allkeys-lru  # Evict least recently used keys

# Monitor Redis memory
redis-cli INFO memory

# Common policies:
# - allkeys-lru: Evict any key, LRU (good for cache)
# - volatile-lru: Evict keys with TTL, LRU (good for mixed use)
# - allkeys-lfu: Evict least frequently used (Redis 4+)
# - noeviction: Return errors when memory full
```

---

#### **14.4.2. Materialized Views**

Pre-computed database views that store query results for fast access.

---

**When to Use Materialized Views**:

- ✅ Complex aggregations run frequently (dashboard metrics)
- ✅ Reports with expensive JOINs (employee with all details)
- ✅ Data changes infrequently compared to reads (lookup tables)
- ✅ Acceptable staleness (5-60 minutes)
- ❌ Real-time data requirements
- ❌ Frequently updated source tables

---

**Example 1: Employee Details View**:

```sql
-- Complex query executed 100+ times per minute
SELECT 
    e.*,
    d.name as department_name,
    d.code as department_code,
    des.name as designation_name,
    des.level as designation_level,
    m.first_name || ' ' || m.last_name as manager_name,
    b.bank_name,
    b.account_number,
    COUNT(DISTINCT doc.id) as document_count,
    MAX(pr.pay_period_end) as last_payroll_date
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees m ON e.manager_id = m.id
LEFT JOIN bank_details b ON e.id = b.employee_id AND b.is_primary = true
LEFT JOIN documents doc ON e.id = doc.employee_id
LEFT JOIN pay_run_employee_records pr ON e.id = pr.employee_id
GROUP BY e.id, d.id, des.id, m.id, b.id;

-- Performance without materialized view: 50-150ms per query
-- Total load: 100 queries/min * 100ms = 10 seconds of DB time per minute

-- Create materialized view
CREATE MATERIALIZED VIEW mv_employee_details AS
SELECT 
    e.id,
    e.employee_id,
    e.first_name,
    e.last_name,
    e.first_name || ' ' || e.last_name as full_name,
    e.email,
    e.phone,
    e.date_of_birth,
    e.gender,
    e.join_date,
    e.ctc,
    e.gross_salary,
    e.status,
    
    -- Department info
    d.id as department_id,
    d.name as department_name,
    d.code as department_code,
    
    -- Designation info
    des.id as designation_id,
    des.name as designation_name,
    des.level as designation_level,
    
    -- Manager info
    m.id as manager_id,
    m.first_name || ' ' || m.last_name as manager_name,
    
    -- Bank info
    b.bank_name,
    b.account_number,
    b.ifsc_code,
    
    -- Aggregated stats
    COUNT(DISTINCT doc.id) as document_count,
    MAX(pr.pay_period_end) as last_payroll_date,
    
    -- Metadata
    CURRENT_TIMESTAMP as refreshed_at
    
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN designations des ON e.designation_id = des.id
LEFT JOIN employees m ON e.manager_id = m.id
LEFT JOIN bank_details b ON e.id = b.employee_id AND b.is_primary = true
LEFT JOIN documents doc ON e.id = doc.employee_id
LEFT JOIN pay_run_employee_records pr ON e.id = pr.employee_id
GROUP BY e.id, d.id, des.id, m.id, b.id;

-- Create indexes on materialized view
CREATE UNIQUE INDEX idx_mv_employee_details_id ON mv_employee_details(id);
CREATE INDEX idx_mv_employee_details_employee_id ON mv_employee_details(employee_id);
CREATE INDEX idx_mv_employee_details_status ON mv_employee_details(status);
CREATE INDEX idx_mv_employee_details_department ON mv_employee_details(department_id);
CREATE INDEX idx_mv_employee_details_name ON mv_employee_details(full_name);

-- Query the materialized view (fast!)
SELECT * FROM mv_employee_details WHERE status = 'active';
-- Performance: 3-8ms (vs 50-150ms)
-- Improvement: 6-20x faster
```

---

**Refresh Strategies**:

```sql
-- Strategy 1: Manual Refresh (Full)
REFRESH MATERIALIZED VIEW mv_employee_details;
-- Duration: 500-2000ms (depends on data size)
-- Locks view during refresh (readers blocked)

-- Strategy 2: Concurrent Refresh (Non-Blocking)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_details;
-- Duration: 800-3000ms (slower but non-blocking)
-- Requires unique index on materialized view
-- Readers can query stale data during refresh

-- Strategy 3: Scheduled Refresh (Cron)
-- Refresh every 15 minutes during business hours
*/15 6-20 * * * psql -d ecovale_hr -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_employee_details;"

-- Strategy 4: Trigger-Based Refresh (Event-Driven)
-- Refresh when source data changes
CREATE OR REPLACE FUNCTION refresh_employee_details_mv()
RETURNS TRIGGER AS $$
BEGIN
    -- Use pg_notify to signal application to refresh
    PERFORM pg_notify('refresh_mv', 'employee_details');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_employee_mv
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_employee_details_mv();

-- Application listens for notification
-- await client.query('LISTEN refresh_mv');
-- client.on('notification', (msg) => {
--   if (msg.payload === 'employee_details') {
--     refreshMaterializedView('mv_employee_details');
--   }
-- });
```

---

**Example 2: Dashboard Metrics View**:

```sql
-- Dashboard query (expensive aggregations)
CREATE MATERIALIZED VIEW mv_dashboard_metrics AS
SELECT 
    -- Employee metrics
    COUNT(*) FILTER (WHERE e.status = 'active') as active_employees,
    COUNT(*) FILTER (WHERE e.status = 'probation') as probation_employees,
    COUNT(*) FILTER (WHERE e.status = 'inactive') as inactive_employees,
    
    -- Department breakdown
    json_object_agg(
        d.name,
        COUNT(e.id)
    ) FILTER (WHERE e.status = 'active') as employees_by_department,
    
    -- Salary metrics
    ROUND(AVG(e.ctc) FILTER (WHERE e.status = 'active'), 2) as avg_ctc,
    ROUND(AVG(e.gross_salary) FILTER (WHERE e.status = 'active'), 2) as avg_gross,
    SUM(e.ctc) FILTER (WHERE e.status = 'active') as total_ctc,
    
    -- New hires (last 30 days)
    COUNT(*) FILTER (WHERE e.join_date >= CURRENT_DATE - INTERVAL '30 days') as new_hires_30d,
    
    -- Attendance (current month)
    COUNT(DISTINCT att.employee_id) FILTER (
        WHERE att.date >= DATE_TRUNC('month', CURRENT_DATE)
    ) as employees_with_attendance_this_month,
    
    -- Payroll (last month)
    COUNT(DISTINCT pr.employee_id) FILTER (
        WHERE pr.pay_period_start >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND pr.pay_period_end < DATE_TRUNC('month', CURRENT_DATE)
    ) as employees_paid_last_month,
    
    SUM(pr.net_pay) FILTER (
        WHERE pr.pay_period_start >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND pr.pay_period_end < DATE_TRUNC('month', CURRENT_DATE)
    ) as total_payout_last_month,
    
    -- Metadata
    CURRENT_TIMESTAMP as refreshed_at

FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN attendance_records att ON e.id = att.employee_id
LEFT JOIN pay_run_employee_records pr ON e.id = pr.employee_id;

-- Query dashboard (instant!)
SELECT * FROM mv_dashboard_metrics;
-- Performance: 1-3ms (vs 200-500ms for raw query)
-- Refresh: Every 5-15 minutes

-- Refresh schedule (every 10 minutes)
*/10 * * * * psql -d ecovale_hr -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_metrics;"
```

---

**Example 3: Payroll Summary View**:

```sql
-- Monthly payroll summary (for reports)
CREATE MATERIALIZED VIEW mv_payroll_monthly_summary AS
SELECT 
    TO_CHAR(pr.pay_period_start, 'YYYY-MM') as month,
    pr.pay_period_start,
    pr.pay_period_end,
    
    -- Employee counts
    COUNT(DISTINCT pr.employee_id) as employee_count,
    
    -- Salary components
    SUM(pr.basic_salary) as total_basic,
    SUM(pr.hra) as total_hra,
    SUM(pr.special_allowance) as total_special_allowance,
    SUM(pr.gross_salary) as total_gross,
    
    -- Deductions
    SUM(pr.pf_employee) as total_pf_employee,
    SUM(pr.pf_employer) as total_pf_employer,
    SUM(pr.esi_employee) as total_esi_employee,
    SUM(pr.esi_employer) as total_esi_employer,
    SUM(pr.professional_tax) as total_pt,
    SUM(pr.tds) as total_tds,
    SUM(pr.advance_deduction) as total_advance_deduction,
    SUM(pr.loan_deduction) as total_loan_deduction,
    SUM(pr.other_deductions) as total_other_deductions,
    SUM(pr.total_deductions) as total_deductions,
    
    -- Net pay
    SUM(pr.net_pay) as total_net_pay,
    
    -- Department breakdown
    json_object_agg(
        d.name,
        json_build_object(
            'employee_count', COUNT(DISTINCT pr.employee_id),
            'gross_salary', SUM(pr.gross_salary),
            'net_pay', SUM(pr.net_pay)
        )
    ) as department_summary,
    
    -- Metadata
    CURRENT_TIMESTAMP as refreshed_at

FROM pay_run_employee_records pr
JOIN employees e ON pr.employee_id = e.id
JOIN departments d ON e.department_id = d.id
GROUP BY TO_CHAR(pr.pay_period_start, 'YYYY-MM'), pr.pay_period_start, pr.pay_period_end;

CREATE INDEX idx_mv_payroll_summary_month ON mv_payroll_monthly_summary(month DESC);

-- Query payroll report (instant)
SELECT * FROM mv_payroll_monthly_summary 
WHERE month >= TO_CHAR(CURRENT_DATE - INTERVAL '12 months', 'YYYY-MM')
ORDER BY month DESC;

-- Performance: 2-5ms (vs 100-300ms)
-- Refresh: After payroll processing completes
```

---

**Materialized View Management**:

```sql
-- Check materialized view sizes
SELECT 
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) AS size
FROM pg_matviews
ORDER BY pg_total_relation_size(schemaname||'.'||matviewname) DESC;

-- Check last refresh time
SELECT 
    schemaname,
    matviewname,
    last_refresh
FROM pg_matviews
ORDER BY last_refresh DESC NULLS LAST;

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_employee_details;

-- Recreate with new definition
CREATE MATERIALIZED VIEW mv_employee_details AS ...
```

---

**Best Practices**:

1. **Always use CONCURRENTLY** for refresh in production (requires unique index)
2. **Monitor refresh duration**: Should be <5% of refresh interval
3. **Add indexes** on materialized views (they're regular tables)
4. **Document staleness**: Users should know data may be 5-15 minutes old
5. **Schedule refreshes** during low-traffic periods when possible
6. **Monitor disk usage**: Materialized views consume storage

---

#### **14.4.3. Query Result Caching**

Database-level and application-level caching of query results.

---

**PostgreSQL Shared Buffers** (Built-in Cache):

```sql
-- Check shared_buffers setting
SHOW shared_buffers;  -- Default: 128MB, Recommended: 25% of RAM

-- Recommended: 4GB for 16GB RAM server
-- postgresql.conf:
-- shared_buffers = 4GB

-- Query cache hit ratio (should be >95%)
SELECT 
    'Cache Hit Ratio' as metric,
    ROUND(
        SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0) * 100,
        2
    ) || '%' as value
FROM pg_statio_user_tables;

-- If cache hit ratio <95%:
-- 1. Increase shared_buffers (requires restart)
-- 2. Optimize queries to reduce data scanned
-- 3. Add indexes to reduce I/O
```

---

**Application Query Result Cache** (with Redis):

```typescript
// Cache query results with automatic key generation
interface QueryCacheOptions {
  ttl: number;  // Seconds
  invalidateOn?: string[];  // Events that invalidate this cache
}

async function cachedDatabaseQuery<T>(
  queryKey: string,
  query: string,
  params: any[],
  options: QueryCacheOptions
): Promise<T[]> {
  // Generate cache key from query + params
  const cacheKey = `query:${queryKey}:${crypto
    .createHash('md5')
    .update(JSON.stringify({ query, params }))
    .digest('hex')}`;
  
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('Query cache HIT:', queryKey);
    return JSON.parse(cached);
  }
  
  console.log('Query cache MISS:', queryKey);
  
  // Execute query
  const result = await pool.query(query, params);
  const data = result.rows;
  
  // Cache result
  await redis.setex(cacheKey, options.ttl, JSON.stringify(data));
  
  // Register for invalidation
  if (options.invalidateOn) {
    for (const event of options.invalidateOn) {
      await redis.sadd(`invalidate:${event}`, cacheKey);
    }
  }
  
  return data;
}

// Usage
const employees = await cachedDatabaseQuery(
  'active_employees',
  'SELECT * FROM employees WHERE status = $1 ORDER BY join_date DESC LIMIT $2',
  ['active', 50],
  {
    ttl: 300,  // 5 minutes
    invalidateOn: ['employee_update', 'employee_create'],
  }
);

// Invalidate all caches for an event
async function invalidateCachesByEvent(event: string): Promise<void> {
  const cacheKeys = await redis.smembers(`invalidate:${event}`);
  
  if (cacheKeys.length > 0) {
    await redis.del(...cacheKeys);
    await redis.del(`invalidate:${event}`);
    console.log(`Invalidated ${cacheKeys.length} caches for event: ${event}`);
  }
}

// Trigger invalidation after updates
async function updateEmployee(id: string, updates: any): Promise<void> {
  await pool.query('UPDATE employees SET ... WHERE id = $1', [id]);
  await invalidateCachesByEvent('employee_update');
}
```

---

**Pagination Cache Strategy**:

```typescript
// Cache individual pages separately
async function getEmployeesPage(
  page: number,
  limit: number,
  filters: any
): Promise<{ data: Employee[]; total: number }> {
  const offset = (page - 1) * limit;
  const filterHash = crypto
    .createHash('md5')
    .update(JSON.stringify(filters))
    .digest('hex');
  
  const pageCacheKey = `employees:page:${page}:${limit}:${filterHash}`;
  const totalCacheKey = `employees:total:${filterHash}`;
  
  // Try to get page from cache
  const cachedPage = await redis.get(pageCacheKey);
  const cachedTotal = await redis.get(totalCacheKey);
  
  if (cachedPage && cachedTotal) {
    return {
      data: JSON.parse(cachedPage),
      total: parseInt(cachedTotal),
    };
  }
  
  // Query database
  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT * FROM mv_employee_details 
       WHERE status = $1 
       ORDER BY join_date DESC 
       LIMIT $2 OFFSET $3`,
      [filters.status, limit, offset]
    ),
    pool.query(
      'SELECT COUNT(*) FROM employees WHERE status = $1',
      [filters.status]
    ),
  ]);
  
  const data = dataResult.rows;
  const total = parseInt(countResult.rows[0].count);
  
  // Cache page and total separately
  await redis.setex(pageCacheKey, CACHE_TTL.MEDIUM, JSON.stringify(data));
  await redis.setex(totalCacheKey, CACHE_TTL.MEDIUM, total.toString());
  
  return { data, total };
}

// Invalidate all pages when data changes
async function invalidateEmployeeListCache(): Promise<void> {
  const keys = await redis.keys('employees:page:*');
  const totalKeys = await redis.keys('employees:total:*');
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  if (totalKeys.length > 0) {
    await redis.del(...totalKeys);
  }
}
```

---

**Prepared Statement Caching** (PostgreSQL):

```typescript
// PostgreSQL caches execution plans for prepared statements
// Use parameterized queries for better performance

// BAD: String interpolation (no plan caching, SQL injection risk)
const query = `SELECT * FROM employees WHERE id = '${id}'`;
await pool.query(query);

// GOOD: Parameterized query (plan cached, safe)
await pool.query('SELECT * FROM employees WHERE id = $1', [id]);

// ADVANCED: Named prepared statements (explicit caching)
import { Client } from 'pg';

const client = new Client({ /* config */ });
await client.connect();

// Prepare statement once
await client.query({
  name: 'get_employee_by_id',
  text: 'SELECT * FROM employees WHERE id = $1',
});

// Execute multiple times (uses cached plan)
const result1 = await client.query({
  name: 'get_employee_by_id',
  values: ['employee-1'],
});

const result2 = await client.query({
  name: 'get_employee_by_id',
  values: ['employee-2'],
});

// Performance: 5-10% faster for simple queries, 20-30% for complex queries
```

---

**Cache Warming Strategy**:

```typescript
// Pre-populate cache on application startup or deployment
async function warmupApplicationCache(): Promise<void> {
  console.log('Starting cache warmup...');
  
  const warmupTasks = [
    // Frequently accessed data
    cachedQuery(
      CACHE_KEYS.departmentList(),
      CACHE_TTL.VERY_LONG,
      () => pool.query('SELECT * FROM departments').then(r => r.rows)
    ),
    
    cachedQuery(
      CACHE_KEYS.designationList(),
      CACHE_TTL.VERY_LONG,
      () => pool.query('SELECT * FROM designations').then(r => r.rows)
    ),
    
    // First page of active employees (most common view)
    cachedDatabaseQuery(
      'active_employees_page1',
      'SELECT * FROM mv_employee_details WHERE status = $1 LIMIT 20',
      ['active'],
      { ttl: CACHE_TTL.MEDIUM }
    ),
    
    // Dashboard metrics
    cachedQuery(
      'dashboard_metrics',
      CACHE_TTL.MEDIUM,
      () => pool.query('SELECT * FROM mv_dashboard_metrics').then(r => r.rows[0])
    ),
  ];
  
  await Promise.all(warmupTasks);
  
  console.log('Cache warmup completed');
}

// Call on app start
await warmupApplicationCache();

// Schedule periodic warmup (e.g., after cache flush)
setInterval(warmupApplicationCache, 4 * 60 * 60 * 1000);  // Every 4 hours
```

---

**Multi-Level Caching Architecture**:

```
┌─────────────┐
│  Browser    │  L1 Cache: 5-60 seconds (HTTP cache headers)
└──────┬──────┘
       │
┌──────▼──────┐
│  CDN/Proxy  │  L2 Cache: 1-5 minutes (reverse proxy like Nginx)
└──────┬──────┘
       │
┌──────▼──────┐
│Application  │  L3 Cache: 5-30 minutes (Redis, in-memory)
└──────┬──────┘
       │
┌──────▼──────┐
│PostgreSQL   │  L4 Cache: Shared buffers, OS cache
└─────────────┘
```

```typescript
// HTTP cache headers for static lookup data
app.get('/api/departments', async (req, res) => {
  const departments = await getAllDepartments();
  
  res.set({
    'Cache-Control': 'public, max-age=1800',  // 30 minutes
    'ETag': crypto.createHash('md5').update(JSON.stringify(departments)).digest('hex'),
  });
  
  res.json(departments);
});

// Conditional request handling
app.get('/api/employees/:id', async (req, res) => {
  const employee = await getEmployeeById(req.params.id);
  const etag = crypto.createHash('md5').update(JSON.stringify(employee)).digest('hex');
  
  // Check If-None-Match header
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();  // Not Modified
  }
  
  res.set({
    'Cache-Control': 'private, max-age=300',  // 5 minutes
    'ETag': etag,
  });
  
  res.json(employee);
});
```

---

**Cache Performance Comparison**:

| Cache Layer | Latency | TTL Recommendation | Use Case |
|-------------|---------|-------------------|----------|
| **Browser** | 0ms (instant) | 30-300s | Static assets, lookup tables |
| **CDN/Proxy** | 1-5ms | 60-300s | API responses, public data |
| **Redis** | 1-3ms | 60-1800s | Session data, query results |
| **PostgreSQL Shared Buffers** | 0.5-2ms | Automatic | Hot data, indexes |
| **Disk** | 5-50ms | N/A | Cold data, full table scans |

---

**Section 14.4 Complete**: Caching strategies including application-level Redis caching, PostgreSQL materialized views, and multi-level query result caching documented.

---
