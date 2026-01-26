-- =================================================================
-- Flyway Migration V6: Create Loan Records Table
-- Author: Ecovale HR Team
-- Date: 2026-01-26
-- Description: Employee loan management
-- =================================================================

CREATE TABLE IF NOT EXISTS loan_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    loan_type VARCHAR(50) NOT NULL,
    loan_amount DECIMAL(12,2) NOT NULL,
    interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    loan_date DATE NOT NULL,
    repayment_start_date DATE NOT NULL,
    installments INT NOT NULL,
    installment_amount DECIMAL(12,2) NOT NULL,
    paid_installments INT NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_employee_loan (employee_id, status),
    INDEX idx_loan_type (loan_type),
    INDEX idx_status (status),
    
    CONSTRAINT chk_loan_type CHECK (loan_type IN ('PERSONAL', 'VEHICLE', 'HOME', 'EDUCATION', 'EMERGENCY', 'OTHER')),
    CONSTRAINT chk_loan_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT fk_loan_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
