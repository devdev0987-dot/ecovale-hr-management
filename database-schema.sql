-- =============================================
-- Ecovale HR Database Schema
-- =============================================
-- This file is for reference only.
-- Spring Boot will auto-create tables using JPA.
-- =============================================

-- Database Creation
CREATE DATABASE IF NOT EXISTS ecovale_hr;
USE ecovale_hr;

-- =============================================
-- TABLE: employees
-- =============================================
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(50) PRIMARY KEY,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    dob VARCHAR(50),
    gender VARCHAR(20) NOT NULL,
    photo LONGTEXT,
    contact_number VARCHAR(15) NOT NULL,
    alternate_contact VARCHAR(15),
    emergency_contact VARCHAR(15),
    personal_email VARCHAR(150) NOT NULL,
    permanent_address TEXT,
    current_address TEXT NOT NULL,
    pf_number VARCHAR(50),
    esi_number VARCHAR(50),
    blood_group VARCHAR(10),
    father_name VARCHAR(100),
    mother_name VARCHAR(100),
    
    -- Employment Details
    type VARCHAR(20) NOT NULL,
    department VARCHAR(50) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    reporting_manager VARCHAR(100),
    join_date VARCHAR(50),
    official_email VARCHAR(150) UNIQUE NOT NULL,
    work_location VARCHAR(50) NOT NULL,
    probation_period INT,
    grade VARCHAR(1),
    
    -- Salary Information
    ctc DOUBLE NOT NULL,
    basic DOUBLE NOT NULL,
    hra_percentage DOUBLE,
    hra DOUBLE,
    conveyance DOUBLE,
    telephone DOUBLE,
    medical_allowance DOUBLE,
    special_allowance DOUBLE,
    employee_health_insurance_annual DOUBLE,
    gross DOUBLE,
    include_pf BOOLEAN DEFAULT FALSE,
    include_esi BOOLEAN DEFAULT FALSE,
    pf_deduction DOUBLE,
    esi_deduction DOUBLE,
    employer_esi DOUBLE,
    employer_pf DOUBLE,
    professional_tax DOUBLE,
    tds DOUBLE,
    tds_monthly DOUBLE,
    gst_monthly DOUBLE,
    gst_annual DOUBLE,
    professional_fees_monthly DOUBLE,
    professional_fees_inclusive BOOLEAN,
    professional_fees_base_monthly DOUBLE,
    professional_fees_total_monthly DOUBLE,
    professional_fees_base_annual DOUBLE,
    professional_fees_total_annual DOUBLE,
    net DOUBLE,
    payment_mode VARCHAR(20) NOT NULL,
    
    -- Bank Details
    bank_name VARCHAR(100),
    account_holder VARCHAR(100),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(20),
    branch VARCHAR(100),
    
    -- Status and Timestamps
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_department (department),
    INDEX idx_status (status),
    INDEX idx_work_location (work_location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- TABLE: designations
-- =============================================
CREATE TABLE IF NOT EXISTS designations (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) UNIQUE NOT NULL,
    department VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    reporting_to VARCHAR(50),
    level INT NOT NULL,
    
    INDEX idx_department (department),
    INDEX idx_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- TABLE: attendance_records
-- =============================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    month VARCHAR(20) NOT NULL,
    year VARCHAR(10) NOT NULL,
    total_working_days INT NOT NULL,
    present_days INT NOT NULL,
    absent_days INT NOT NULL,
    paid_leave INT NOT NULL,
    unpaid_leave INT NOT NULL,
    payable_days INT NOT NULL,
    loss_of_pay_days INT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_employee_id (employee_id),
    INDEX idx_month_year (month, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- TABLE: advance_records
-- =============================================
CREATE TABLE IF NOT EXISTS advance_records (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    advance_month VARCHAR(30) NOT NULL,
    advance_year VARCHAR(10) NOT NULL,
    advance_paid_amount DOUBLE NOT NULL,
    advance_deduction_month VARCHAR(30) NOT NULL,
    advance_deduction_year VARCHAR(10) NOT NULL,
    remarks TEXT,
    status VARCHAR(20) NOT NULL,
    remaining_amount DOUBLE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_employee_id (employee_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- TABLE: loan_records
-- =============================================
CREATE TABLE IF NOT EXISTS loan_records (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    loan_amount DOUBLE NOT NULL,
    interest_rate DOUBLE NOT NULL,
    number_of_emis INT NOT NULL,
    emi_amount DOUBLE NOT NULL,
    total_amount DOUBLE NOT NULL,
    start_month VARCHAR(30) NOT NULL,
    start_year VARCHAR(10) NOT NULL,
    total_paid_emis INT DEFAULT 0,
    remaining_balance DOUBLE NOT NULL,
    status VARCHAR(20) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_employee_id (employee_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================
-- Sample Data (Optional)
-- =============================================

-- Insert sample designations
INSERT INTO designations (id, title, department, description, reporting_to, level) VALUES
('DES001', 'Software Engineer', 'IT', 'Develops software applications', 'Tech Lead', 3),
('DES002', 'HR Manager', 'HR', 'Manages HR operations and policies', 'Director HR', 5),
('DES003', 'Accountant', 'Finance', 'Handles accounting and financial records', 'Finance Manager', 3),
('DES004', 'Sales Executive', 'Sales', 'Drives sales and revenue', 'Sales Manager', 2);

-- =============================================
-- Useful Queries
-- =============================================

-- Get all active employees
-- SELECT * FROM employees WHERE status = 'ACTIVE';

-- Get employees by department
-- SELECT * FROM employees WHERE department = 'IT';

-- Get attendance for a specific month
-- SELECT * FROM attendance_records WHERE month = 'January' AND year = '2026';

-- Get pending advances
-- SELECT * FROM advance_records WHERE status = 'PENDING';

-- Get active loans
-- SELECT * FROM loan_records WHERE status = 'ACTIVE';
