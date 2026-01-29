-- ============================================================
-- EcoVale HR System - MySQL Database Schema
-- Version: 1.0.0
-- MySQL Version: 8.0+
-- Engine: InnoDB
-- Charset: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- ============================================================

-- Create Database
DROP DATABASE IF EXISTS ecovale_hr;
CREATE DATABASE ecovale_hr 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE ecovale_hr;

-- ============================================================
-- 1. AUTHENTICATION & USER MANAGEMENT TABLES
-- ============================================================

-- Table: users
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'manager', 'hr', 'employee') NOT NULL DEFAULT 'admin',
    employee_id VARCHAR(20) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    account_locked_until TIMESTAMP NULL,
    password_reset_token VARCHAR(255) NULL,
    password_reset_expires TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    last_login_ip VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active),
    INDEX idx_users_employee_id (employee_id),
    INDEX idx_users_password_reset_token (password_reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: sessions
CREATE TABLE sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    refresh_token_hash VARCHAR(255) UNIQUE NULL,
    access_token_jti VARCHAR(255) NULL,
    device_name VARCHAR(255) NULL,
    device_fingerprint VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    location VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL,
    revoked_reason VARCHAR(255) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_sessions_user_id (user_id),
    INDEX idx_sessions_refresh_token_hash (refresh_token_hash),
    INDEX idx_sessions_user_active (user_id, is_active),
    INDEX idx_sessions_active_expires (is_active, expires_at),
    INDEX idx_sessions_created_at (created_at DESC),
    INDEX idx_sessions_last_activity (last_activity DESC),
    INDEX idx_sessions_ip_address (ip_address),
    CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: audit_logs
CREATE TABLE audit_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NULL,
    session_id CHAR(36) NULL,
    action VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50) NULL,
    resource_name VARCHAR(255) NULL,
    method VARCHAR(10) NULL,
    endpoint VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    location VARCHAR(255) NULL,
    changes JSON NULL,
    metadata JSON NULL,
    status VARCHAR(20) NOT NULL,
    status_code INT NULL,
    error_message TEXT NULL,
    error_stack TEXT NULL,
    duration_ms INT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    tags JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    INDEX idx_audit_user_id (user_id),
    INDEX idx_audit_session_id (session_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_action_category (action_category),
    INDEX idx_audit_resource (resource_type, resource_id),
    INDEX idx_audit_created_at (created_at DESC),
    INDEX idx_audit_status (status),
    INDEX idx_audit_severity (severity),
    INDEX idx_audit_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. ORGANIZATION STRUCTURE TABLES
-- ============================================================

-- Table: departments
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT NULL,
    head_employee_id VARCHAR(20) NULL,
    cost_center VARCHAR(50) NULL,
    budget DECIMAL(15,2) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_departments_name (name),
    INDEX idx_departments_code (code),
    INDEX idx_departments_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: designations
CREATE TABLE designations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    level VARCHAR(20) NULL,
    grade VARCHAR(10) NULL,
    min_salary DECIMAL(12,2) NULL,
    max_salary DECIMAL(12,2) NULL,
    reporting_to_designation_id CHAR(36) NULL,
    job_description TEXT NULL,
    required_qualifications TEXT NULL,
    required_experience_years INT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY (reporting_to_designation_id) REFERENCES designations(id) ON DELETE SET NULL,
    UNIQUE KEY unique_designation_dept (title, department_id),
    INDEX idx_designations_department (department_id),
    INDEX idx_designations_title (title),
    INDEX idx_designations_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. EMPLOYEE MANAGEMENT TABLES
-- ============================================================

-- Table: employees
CREATE TABLE employees (
    id VARCHAR(20) PRIMARY KEY,
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) GENERATED ALWAYS AS (CONCAT(first_name, ' ', IFNULL(CONCAT(middle_name, ' '), ''), last_name)) STORED,
    display_name VARCHAR(255) NULL,
    date_of_birth DATE NULL,
    gender ENUM('Male', 'Female', 'Other', 'Prefer not to say') NOT NULL,
    marital_status ENUM('Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say') NULL,
    nationality VARCHAR(100) NULL DEFAULT 'Indian',
    blood_group VARCHAR(10) NULL,
    photo TEXT NULL,
    photo_url VARCHAR(500) NULL,
    -- Contact Information
    contact_number VARCHAR(20) NOT NULL,
    alternate_contact VARCHAR(20) NULL,
    personal_email VARCHAR(255) NOT NULL UNIQUE,
    official_email VARCHAR(255) UNIQUE NOT NULL,
    -- Emergency Contact
    emergency_contact_name VARCHAR(255) NULL,
    emergency_contact_relationship VARCHAR(100) NULL,
    emergency_contact_number VARCHAR(20) NULL,
    -- Address - Current
    current_address_line1 VARCHAR(255) NOT NULL,
    current_address_line2 VARCHAR(255) NULL,
    current_city VARCHAR(100) NOT NULL,
    current_state VARCHAR(100) NOT NULL,
    current_pincode VARCHAR(10) NOT NULL,
    current_country VARCHAR(100) NOT NULL DEFAULT 'India',
    -- Address - Permanent
    permanent_address_line1 VARCHAR(255) NULL,
    permanent_address_line2 VARCHAR(255) NULL,
    permanent_city VARCHAR(100) NULL,
    permanent_state VARCHAR(100) NULL,
    permanent_pincode VARCHAR(10) NULL,
    permanent_country VARCHAR(100) NULL DEFAULT 'India',
    same_as_permanent BOOLEAN NOT NULL DEFAULT FALSE,
    -- Statutory Numbers
    pf_number VARCHAR(50) NULL UNIQUE,
    pf_joining_date DATE NULL,
    esi_number VARCHAR(50) NULL UNIQUE,
    pan_number VARCHAR(10) NULL UNIQUE,
    aadhar_number VARCHAR(12) NULL,
    passport_number VARCHAR(20) NULL,
    passport_expiry DATE NULL,
    driving_license_number VARCHAR(20) NULL,
    driving_license_expiry DATE NULL,
    -- Family Details
    father_name VARCHAR(255) NULL,
    mother_name VARCHAR(255) NULL,
    spouse_name VARCHAR(255) NULL,
    number_of_children INT NULL DEFAULT 0,
    -- Employment Details
    employment_type ENUM('full-time', 'part-time', 'contract', 'intern', 'consultant') NOT NULL DEFAULT 'full-time',
    department_id INT NOT NULL,
    designation_id CHAR(36) NOT NULL,
    reporting_manager_id VARCHAR(20) NULL,
    join_date DATE NOT NULL,
    confirmation_date DATE NULL,
    probation_period_months INT NOT NULL DEFAULT 6,
    work_location VARCHAR(100) NOT NULL,
    work_arrangement ENUM('office', 'remote', 'hybrid', 'field') NOT NULL DEFAULT 'office',
    -- Salary Information
    ctc DECIMAL(12,2) NOT NULL,
    basic DECIMAL(10,2) GENERATED ALWAYS AS (ROUND(ctc * 0.5 / 12, 2)) STORED,
    hra DECIMAL(10,2) NULL,
    special_allowance DECIMAL(10,2) NULL,
    transport_allowance DECIMAL(10,2) NULL,
    medical_allowance DECIMAL(10,2) NULL,
    other_allowances DECIMAL(10,2) NULL,
    gross DECIMAL(10,2) NULL,
    pf_employee DECIMAL(10,2) NULL,
    pf_employer DECIMAL(10,2) NULL,
    esi_employee DECIMAL(10,2) NULL,
    esi_employer DECIMAL(10,2) NULL,
    professional_tax DECIMAL(10,2) NULL,
    tds DECIMAL(10,2) NULL,
    other_deductions DECIMAL(10,2) NULL,
    total_deductions DECIMAL(10,2) NULL,
    net_salary DECIMAL(10,2) NULL,
    include_pf BOOLEAN NOT NULL DEFAULT TRUE,
    include_esi BOOLEAN NOT NULL DEFAULT FALSE,
    payment_mode ENUM('Bank', 'Cash', 'Cheque') NOT NULL DEFAULT 'Bank',
    -- Status
    status ENUM('active', 'inactive', 'on_leave', 'suspended', 'exited') NOT NULL DEFAULT 'active',
    separation_date DATE NULL,
    exit_type VARCHAR(50) NULL,
    exit_reason TEXT NULL,
    rehire_eligible BOOLEAN NULL DEFAULT TRUE,
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Foreign Keys
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE RESTRICT,
    FOREIGN KEY (reporting_manager_id) REFERENCES employees(id) ON DELETE SET NULL,
    -- Indexes
    INDEX idx_employees_status (status),
    INDEX idx_employees_department (department_id),
    INDEX idx_employees_designation (designation_id),
    INDEX idx_employees_manager (reporting_manager_id),
    INDEX idx_employees_join_date (join_date),
    INDEX idx_employees_name (first_name, last_name),
    INDEX idx_employees_email (official_email),
    INDEX idx_employees_personal_email (personal_email),
    -- Constraints
    CHECK (ctc > 0),
    CHECK (gross > 0),
    CHECK (net_salary > 0),
    CHECK (probation_period_months >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key for department head after employees table
ALTER TABLE departments 
ADD CONSTRAINT fk_dept_head_employee 
FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Add foreign key for user employee_id after employees table
ALTER TABLE users 
ADD CONSTRAINT fk_user_employee 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Table: bank_details
CREATE TABLE bank_details (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(30) NOT NULL,
    account_holder_name VARCHAR(255) NOT NULL,
    ifsc_code VARCHAR(11) NOT NULL,
    branch_name VARCHAR(255) NULL,
    account_type ENUM('Savings', 'Current', 'Salary') NOT NULL DEFAULT 'Savings',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_primary_bank (employee_id, is_primary),
    INDEX idx_bank_employee (employee_id),
    INDEX idx_bank_primary (employee_id, is_primary)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: documents
CREATE TABLE documents (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    document_number VARCHAR(100) NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NULL,
    file_type VARCHAR(50) NULL,
    file_path TEXT NULL,
    file_url TEXT NULL,
    file_base64 LONGTEXT NULL,
    issue_date DATE NULL,
    expiry_date DATE NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by CHAR(36) NULL,
    verified_at TIMESTAMP NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_doc_type (employee_id, document_type),
    INDEX idx_documents_employee (employee_id),
    INDEX idx_documents_type (document_type),
    INDEX idx_documents_verified (is_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: career_history
CREATE TABLE career_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    event_type ENUM('promotion', 'increment', 'demotion', 'transfer', 'designation_change', 'department_change') NOT NULL,
    event_date DATE NOT NULL,
    old_designation_id CHAR(36) NULL,
    new_designation_id CHAR(36) NULL,
    old_department_id INT NULL,
    new_department_id INT NULL,
    old_ctc DECIMAL(12,2) NULL,
    new_ctc DECIMAL(12,2) NULL,
    increment_percentage DECIMAL(5,2) NULL,
    increment_amount DECIMAL(12,2) NULL,
    reason TEXT NULL,
    notes TEXT NULL,
    approved_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (old_designation_id) REFERENCES designations(id) ON DELETE SET NULL,
    FOREIGN KEY (new_designation_id) REFERENCES designations(id) ON DELETE SET NULL,
    FOREIGN KEY (old_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (new_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_career_employee (employee_id),
    INDEX idx_career_event_date (event_date),
    INDEX idx_career_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. PAYROLL MANAGEMENT TABLES
-- ============================================================

-- Table: attendance_records
CREATE TABLE attendance_records (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    total_days INT NOT NULL,
    present_days INT NOT NULL DEFAULT 0,
    absent_days INT NOT NULL DEFAULT 0,
    paid_leave_days INT NOT NULL DEFAULT 0,
    unpaid_leave_days INT NOT NULL DEFAULT 0,
    half_days INT NOT NULL DEFAULT 0,
    week_offs INT NOT NULL DEFAULT 0,
    holidays INT NOT NULL DEFAULT 0,
    payable_days DECIMAL(5,2) GENERATED ALWAYS AS (present_days + paid_leave_days + (half_days * 0.5)) STORED,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY unique_attendance_month (employee_id, month, year),
    INDEX idx_attendance_employee (employee_id),
    INDEX idx_attendance_month_year (month, year),
    CHECK (month BETWEEN 1 AND 12),
    CHECK (year >= 2020),
    CHECK (present_days >= 0),
    CHECK (absent_days >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: pay_runs
CREATE TABLE pay_runs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    pay_run_name VARCHAR(255) NOT NULL,
    salary_month INT NOT NULL,
    salary_year INT NOT NULL,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    payment_date DATE NOT NULL,
    status ENUM('draft', 'in_progress', 'completed', 'approved', 'paid', 'cancelled') NOT NULL DEFAULT 'draft',
    total_employees INT NOT NULL DEFAULT 0,
    total_gross DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_net DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_by CHAR(36) NOT NULL,
    approved_by CHAR(36) NULL,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_payrun_month (salary_month, salary_year),
    INDEX idx_payrun_status (status),
    INDEX idx_payrun_month_year (salary_month, salary_year),
    INDEX idx_payrun_payment_date (payment_date),
    CHECK (salary_month BETWEEN 1 AND 12),
    CHECK (total_employees >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: pay_run_employee_records
CREATE TABLE pay_run_employee_records (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    pay_run_id CHAR(36) NOT NULL,
    employee_id VARCHAR(20) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    designation_name VARCHAR(100) NOT NULL,
    payable_days DECIMAL(5,2) NOT NULL,
    total_days INT NOT NULL,
    ctc DECIMAL(12,2) NOT NULL,
    basic DECIMAL(10,2) NOT NULL,
    hra DECIMAL(10,2) NOT NULL DEFAULT 0,
    special_allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
    transport_allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
    medical_allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_allowances DECIMAL(10,2) NOT NULL DEFAULT 0,
    gross DECIMAL(10,2) NOT NULL,
    pf_employee DECIMAL(10,2) NOT NULL DEFAULT 0,
    pf_employer DECIMAL(10,2) NOT NULL DEFAULT 0,
    esi_employee DECIMAL(10,2) NOT NULL DEFAULT 0,
    esi_employer DECIMAL(10,2) NOT NULL DEFAULT 0,
    professional_tax DECIMAL(10,2) NOT NULL DEFAULT 0,
    tds DECIMAL(10,2) NOT NULL DEFAULT 0,
    advance_deduction DECIMAL(10,2) NOT NULL DEFAULT 0,
    loan_emi DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(10,2) NOT NULL,
    net_salary DECIMAL(10,2) NOT NULL,
    payment_status ENUM('pending', 'processing', 'paid', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    payment_date DATE NULL,
    payment_reference VARCHAR(255) NULL,
    payment_mode ENUM('Bank', 'Cash', 'Cheque') NOT NULL DEFAULT 'Bank',
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pay_run_id) REFERENCES pay_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
    UNIQUE KEY unique_payrun_employee (pay_run_id, employee_id),
    INDEX idx_payrun_records_payrun (pay_run_id),
    INDEX idx_payrun_records_employee (employee_id),
    INDEX idx_payrun_records_status (payment_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: payslips
CREATE TABLE payslips (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    pay_run_employee_record_id CHAR(36) NULL,
    payslip_number VARCHAR(50) UNIQUE NOT NULL,
    salary_month INT NOT NULL,
    salary_year INT NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    employee_number VARCHAR(20) NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(30) NOT NULL,
    pan_number VARCHAR(10) NULL,
    pf_number VARCHAR(50) NULL,
    payable_days DECIMAL(5,2) NOT NULL,
    total_days INT NOT NULL,
    ctc DECIMAL(12,2) NOT NULL,
    basic DECIMAL(10,2) NOT NULL,
    hra DECIMAL(10,2) NOT NULL DEFAULT 0,
    special_allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
    transport_allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
    medical_allowance DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_allowances DECIMAL(10,2) NOT NULL DEFAULT 0,
    gross DECIMAL(10,2) NOT NULL,
    pf_employee DECIMAL(10,2) NOT NULL DEFAULT 0,
    pf_employer DECIMAL(10,2) NOT NULL DEFAULT 0,
    esi_employee DECIMAL(10,2) NOT NULL DEFAULT 0,
    esi_employer DECIMAL(10,2) NOT NULL DEFAULT 0,
    professional_tax DECIMAL(10,2) NOT NULL DEFAULT 0,
    tds DECIMAL(10,2) NOT NULL DEFAULT 0,
    advance_deduction DECIMAL(10,2) NOT NULL DEFAULT 0,
    loan_emi DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(10,2) NOT NULL,
    net_salary DECIMAL(10,2) NOT NULL,
    net_salary_words VARCHAR(500) NULL,
    payment_mode ENUM('Bank', 'Cash', 'Cheque') NOT NULL DEFAULT 'Bank',
    payment_date DATE NULL,
    payment_reference VARCHAR(255) NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by CHAR(36) NULL,
    file_path TEXT NULL,
    file_url TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
    FOREIGN KEY (pay_run_employee_record_id) REFERENCES pay_run_employee_records(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_payslip_month (employee_id, salary_month, salary_year),
    INDEX idx_payslips_employee (employee_id),
    INDEX idx_payslips_month_year (salary_month, salary_year),
    INDEX idx_payslips_number (payslip_number),
    CHECK (salary_month BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. ADVANCES & LOANS TABLES
-- ============================================================

-- Table: advance_records
CREATE TABLE advance_records (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    advance_amount DECIMAL(10,2) NOT NULL,
    advance_date DATE NOT NULL,
    reason TEXT NULL,
    recovery_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (advance_amount - recovery_amount) STORED,
    recovery_status ENUM('pending', 'partial', 'recovered') NOT NULL DEFAULT 'pending',
    recovery_start_month INT NULL,
    recovery_start_year INT NULL,
    notes TEXT NULL,
    approved_by CHAR(36) NULL,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_advance_employee (employee_id),
    INDEX idx_advance_status (recovery_status),
    INDEX idx_advance_date (advance_date),
    CHECK (advance_amount > 0),
    CHECK (recovery_amount >= 0),
    CHECK (recovery_amount <= advance_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_records
CREATE TABLE loan_records (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    loan_type VARCHAR(50) NOT NULL,
    loan_amount DECIMAL(10,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    number_of_emis INT NOT NULL,
    emi_amount DECIMAL(10,2) NOT NULL,
    loan_date DATE NOT NULL,
    emi_start_month INT NOT NULL,
    emi_start_year INT NOT NULL,
    total_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (loan_amount - total_paid) STORED,
    emis_paid INT NOT NULL DEFAULT 0,
    emis_remaining INT GENERATED ALWAYS AS (number_of_emis - emis_paid) STORED,
    loan_status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
    reason TEXT NULL,
    notes TEXT NULL,
    approved_by CHAR(36) NULL,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_loan_employee (employee_id),
    INDEX idx_loan_status (loan_status),
    INDEX idx_loan_date (loan_date),
    CHECK (loan_amount > 0),
    CHECK (interest_rate >= 0),
    CHECK (number_of_emis > 0),
    CHECK (emi_amount > 0),
    CHECK (total_paid >= 0),
    CHECK (emis_paid >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: loan_emis
CREATE TABLE loan_emis (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    loan_id CHAR(36) NOT NULL,
    emi_number INT NOT NULL,
    emi_amount DECIMAL(10,2) NOT NULL,
    emi_month INT NOT NULL,
    emi_year INT NOT NULL,
    status ENUM('pending', 'paid', 'skipped') NOT NULL DEFAULT 'pending',
    paid_date DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loan_records(id) ON DELETE CASCADE,
    UNIQUE KEY unique_loan_emi (loan_id, emi_number),
    INDEX idx_loan_emis_loan (loan_id),
    INDEX idx_loan_emis_status (status),
    INDEX idx_loan_emis_month_year (emi_month, emi_year),
    CHECK (emi_number > 0),
    CHECK (emi_amount > 0),
    CHECK (emi_month BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. LETTERS & DOCUMENTS TEMPLATES
-- ============================================================

-- Table: letter_templates
CREATE TABLE letter_templates (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    template_name VARCHAR(255) UNIQUE NOT NULL,
    template_type VARCHAR(50) NOT NULL,
    subject VARCHAR(500) NULL,
    content LONGTEXT NOT NULL,
    placeholders JSON NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_templates_type (template_type),
    INDEX idx_templates_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: generated_letters
CREATE TABLE generated_letters (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    template_id CHAR(36) NULL,
    letter_type VARCHAR(50) NOT NULL,
    letter_title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    generated_date DATE NOT NULL,
    file_path TEXT NULL,
    file_url TEXT NULL,
    file_base64 LONGTEXT NULL,
    metadata JSON NULL,
    generated_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES letter_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_letters_employee (employee_id),
    INDEX idx_letters_type (letter_type),
    INDEX idx_letters_date (generated_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: salary_annexures
CREATE TABLE salary_annexures (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    employee_id VARCHAR(20) NOT NULL,
    annexure_date DATE NOT NULL,
    annexure_content LONGTEXT NOT NULL,
    file_path TEXT NULL,
    file_base64 LONGTEXT NULL,
    generated_by CHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_annexures_employee (employee_id),
    INDEX idx_annexures_date (annexure_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SAMPLE INSERT STATEMENTS
-- ============================================================

-- Insert Sample Departments
INSERT INTO departments (name, code, description, is_active) VALUES
('Information Technology', 'IT', 'Software development and IT infrastructure', TRUE),
('Human Resources', 'HR', 'Employee management and recruitment', TRUE),
('Finance', 'FIN', 'Accounting and financial operations', TRUE),
('Operations', 'OPS', 'Business operations and support', TRUE),
('Sales & Marketing', 'SM', 'Sales and marketing activities', TRUE);

-- Insert Sample Designations
INSERT INTO designations (id, title, department_id, level, min_salary, max_salary, is_active) VALUES
(UUID(), 'Software Engineer', 1, 'Junior', 400000, 800000, TRUE),
(UUID(), 'Senior Software Engineer', 1, 'Senior', 800000, 1500000, TRUE),
(UUID(), 'HR Manager', 2, 'Manager', 600000, 1200000, TRUE),
(UUID(), 'Accountant', 3, 'Mid-Level', 400000, 700000, TRUE),
(UUID(), 'Sales Executive', 5, 'Junior', 300000, 600000, TRUE);

-- Insert Sample Admin User
INSERT INTO users (id, email, password_hash, full_name, role, is_active) VALUES
(UUID(), 'admin@ecovale.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYILr4Ry0qy', 'System Administrator', 'admin', TRUE);

-- Insert Sample Employee
INSERT INTO employees (
    id, first_name, last_name, date_of_birth, gender, contact_number, 
    personal_email, official_email, current_address_line1, current_city, 
    current_state, current_pincode, current_country, employment_type, 
    department_id, designation_id, join_date, work_location, ctc, 
    hra, special_allowance, gross, pf_employee, pf_employer, 
    professional_tax, total_deductions, net_salary, status
) VALUES (
    '1', 'John', 'Doe', '1990-01-15', 'Male', '+91-9876543210',
    'john.doe@personal.com', 'john.doe@ecovale.com', '123 Main Street', 'Bangalore',
    'Karnataka', '560001', 'India', 'full-time',
    1, (SELECT id FROM designations WHERE title = 'Software Engineer' LIMIT 1), 
    '2024-01-01', 'Bangalore', 600000,
    10000, 15000, 50000, 1800, 1800,
    200, 3800, 46200, 'active'
);

-- ============================================================
-- EXAMPLE QUERIES
-- ============================================================

-- SELECT: Get all active employees with department and designation
SELECT 
    e.id,
    e.full_name,
    e.official_email,
    e.contact_number,
    d.name AS department,
    des.title AS designation,
    e.join_date,
    e.ctc,
    e.status
FROM employees e
JOIN departments d ON e.department_id = d.id
JOIN designations des ON e.designation_id = des.id
WHERE e.status = 'active'
ORDER BY e.join_date DESC;

-- SELECT: Get employee with bank details
SELECT 
    e.id,
    e.full_name,
    e.official_email,
    b.bank_name,
    b.account_number,
    b.ifsc_code,
    b.is_primary
FROM employees e
LEFT JOIN bank_details b ON e.id = b.employee_id
WHERE e.id = '1';

-- SELECT: Get attendance summary for a month
SELECT 
    e.id,
    e.full_name,
    a.month,
    a.year,
    a.present_days,
    a.absent_days,
    a.paid_leave_days,
    a.payable_days
FROM attendance_records a
JOIN employees e ON a.employee_id = e.id
WHERE a.month = 1 AND a.year = 2026;

-- SELECT: Get pay run details with employee records
SELECT 
    pr.pay_run_name,
    pr.salary_month,
    pr.salary_year,
    pr.status,
    COUNT(pre.id) AS total_employees,
    SUM(pre.gross) AS total_gross,
    SUM(pre.total_deductions) AS total_deductions,
    SUM(pre.net_salary) AS total_net
FROM pay_runs pr
LEFT JOIN pay_run_employee_records pre ON pr.id = pre.pay_run_id
GROUP BY pr.id, pr.pay_run_name, pr.salary_month, pr.salary_year, pr.status;

-- SELECT: Get active loans with EMI details
SELECT 
    l.id,
    l.employee_name,
    l.loan_type,
    l.loan_amount,
    l.emi_amount,
    l.number_of_emis,
    l.emis_paid,
    l.emis_remaining,
    l.remaining_amount,
    l.loan_status
FROM loan_records l
WHERE l.loan_status = 'active'
ORDER BY l.loan_date DESC;

-- UPDATE: Update employee salary
UPDATE employees 
SET 
    ctc = 750000,
    basic = ROUND(750000 * 0.5 / 12, 2),
    hra = 12500,
    special_allowance = 20000,
    gross = 62500,
    updated_at = CURRENT_TIMESTAMP
WHERE id = '1';

-- UPDATE: Mark attendance for an employee
INSERT INTO attendance_records (
    id, employee_id, month, year, total_days, present_days, 
    absent_days, paid_leave_days, week_offs, holidays
) VALUES (
    UUID(), '1', 1, 2026, 31, 20, 1, 2, 8, 0
) ON DUPLICATE KEY UPDATE
    present_days = VALUES(present_days),
    absent_days = VALUES(absent_days),
    paid_leave_days = VALUES(paid_leave_days),
    updated_at = CURRENT_TIMESTAMP;

-- DELETE: Soft delete employee (set status to inactive)
UPDATE employees 
SET 
    status = 'inactive',
    separation_date = CURRENT_DATE,
    exit_type = 'Resignation',
    updated_at = CURRENT_TIMESTAMP
WHERE id = '1';

-- JOIN: Get employee hierarchy (reporting structure)
SELECT 
    e.id AS employee_id,
    e.full_name AS employee_name,
    e.official_email,
    des.title AS designation,
    m.full_name AS manager_name,
    m.official_email AS manager_email,
    d.name AS department
FROM employees e
JOIN designations des ON e.designation_id = des.id
JOIN departments d ON e.department_id = d.id
LEFT JOIN employees m ON e.reporting_manager_id = m.id
WHERE e.status = 'active'
ORDER BY d.name, des.title;

-- JOIN: Get payroll summary with employee details
SELECT 
    pr.pay_run_name,
    pr.salary_month,
    pr.salary_year,
    pre.employee_name,
    pre.department_name,
    pre.designation_name,
    pre.payable_days,
    pre.gross,
    pre.total_deductions,
    pre.net_salary,
    pre.payment_status
FROM pay_run_employee_records pre
JOIN pay_runs pr ON pre.pay_run_id = pr.id
WHERE pr.salary_month = 1 AND pr.salary_year = 2026
ORDER BY pre.department_name, pre.employee_name;

-- JOIN: Get career history with designation changes
SELECT 
    ch.event_date,
    e.full_name AS employee_name,
    ch.event_type,
    old_des.title AS old_designation,
    new_des.title AS new_designation,
    old_dept.name AS old_department,
    new_dept.name AS new_department,
    ch.old_ctc,
    ch.new_ctc,
    ch.increment_percentage,
    ch.reason
FROM career_history ch
JOIN employees e ON ch.employee_id = e.id
LEFT JOIN designations old_des ON ch.old_designation_id = old_des.id
LEFT JOIN designations new_des ON ch.new_designation_id = new_des.id
LEFT JOIN departments old_dept ON ch.old_department_id = old_dept.id
LEFT JOIN departments new_dept ON ch.new_department_id = new_dept.id
ORDER BY ch.event_date DESC;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
