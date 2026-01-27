-- =================================================================
-- Flyway Migration V3: Create Employees Table
-- Author: Ecovale HR Team
-- Date: 2026-01-26
-- Description: Main employee information table with personal and employment details
-- =================================================================

CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(50) PRIMARY KEY,
    
    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    dob VARCHAR(20),
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
    company_name VARCHAR(20) NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    work_location VARCHAR(100) NOT NULL,
    date_of_joining VARCHAR(20) NOT NULL,
    employment_type VARCHAR(20) NOT NULL,
    official_email VARCHAR(150),
    reporting_manager VARCHAR(50),
    probation_period INT,
    probation_end_date VARCHAR(20),
    
    -- Salary Details
    ctc DECIMAL(12,2) NOT NULL,
    basic_salary DECIMAL(12,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    other_allowances DECIMAL(12,2) NOT NULL,
    pf_contribution DECIMAL(12,2) NOT NULL,
    esi_contribution DECIMAL(12,2) NOT NULL,
    professional_tax DECIMAL(12,2) NOT NULL,
    income_tax DECIMAL(12,2) NOT NULL,
    
    -- Bank Details
    bank_name VARCHAR(100),
    account_number VARCHAR(30),
    ifsc_code VARCHAR(20),
    branch_name VARCHAR(100),
    
    -- Document Details
    aadhar_number VARCHAR(12),
    pan_number VARCHAR(10),
    passport_number VARCHAR(20),
    driving_license VARCHAR(20),
    
    -- Status and metadata
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_employee_name (first_name, last_name),
    INDEX idx_department (department),
    INDEX idx_designation (designation),
    INDEX idx_status (status),
    INDEX idx_work_location (work_location),
    INDEX idx_company (company_name),
    INDEX idx_email (personal_email),
    INDEX idx_official_email (official_email),
    
    -- Constraints
    CONSTRAINT chk_gender CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    CONSTRAINT chk_company CHECK (company_name IN ('ECOVALE', 'SUBSIDIARY_1', 'SUBSIDIARY_2')),
    CONSTRAINT chk_employment_type CHECK (employment_type IN ('PERMANENT', 'CONTRACT', 'INTERN', 'CONSULTANT')),
    CONSTRAINT chk_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'TERMINATED', 'RESIGNED', 'ON_LEAVE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
