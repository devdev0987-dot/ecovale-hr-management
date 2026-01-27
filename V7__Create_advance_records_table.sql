-- =================================================================
-- Flyway Migration V7: Create Advance Records Table
-- Author: Ecovale HR Team
-- Date: 2026-01-26
-- Description: Employee salary advance/payment requests
-- =================================================================

CREATE TABLE IF NOT EXISTS advance_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    advance_type VARCHAR(50) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    request_date DATE NOT NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    approved_by VARCHAR(100),
    approval_date DATE,
    deduction_start_month VARCHAR(7),
    installments INT NOT NULL DEFAULT 1,
    installment_amount DECIMAL(12,2) NOT NULL,
    paid_installments INT NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(12,2) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_employee_advance (employee_id, approval_status),
    INDEX idx_advance_type (advance_type),
    INDEX idx_approval_status (approval_status),
    INDEX idx_request_date (request_date),
    
    CONSTRAINT chk_advance_type CHECK (advance_type IN ('SALARY_ADVANCE', 'TRAVEL_ADVANCE', 'MEDICAL', 'EMERGENCY', 'FESTIVAL', 'OTHER')),
    CONSTRAINT chk_approval_status CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT fk_advance_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
