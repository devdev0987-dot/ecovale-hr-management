-- =================================================================
-- Flyway Migration V8: Create Leave Requests Table
-- Author: Ecovale HR Team
-- Date: 2026-01-26
-- Description: Leave management with approval workflow (MANAGER → ADMIN)
-- =================================================================

CREATE TABLE IF NOT EXISTS leave_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    
    -- Employee information
    employee_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    employee_email VARCHAR(150) NOT NULL,
    
    -- Leave details
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    number_of_days INT NOT NULL,
    reason TEXT,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    
    -- Manager approval fields
    manager_approved_by VARCHAR(100),
    manager_approved_at TIMESTAMP NULL,
    manager_comments TEXT,
    
    -- Admin approval fields
    admin_approved_by VARCHAR(100),
    admin_approved_at TIMESTAMP NULL,
    admin_comments TEXT,
    
    -- Rejection fields
    rejected_by VARCHAR(100),
    rejected_at TIMESTAMP NULL,
    rejection_reason TEXT,
    
    -- Additional fields
    reporting_manager VARCHAR(100),
    department VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_employee_id (employee_id),
    INDEX idx_status (status),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date),
    INDEX idx_reporting_manager (reporting_manager),
    INDEX idx_department (department),
    INDEX idx_created_at (created_at),
    INDEX idx_employee_status (employee_id, status),
    INDEX idx_date_range (start_date, end_date),
    
    -- Foreign key constraint
    CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_leave_type CHECK (leave_type IN (
        'CASUAL_LEAVE', 'SICK_LEAVE', 'EARNED_LEAVE', 
        'MATERNITY_LEAVE', 'PATERNITY_LEAVE', 'UNPAID_LEAVE', 
        'COMPENSATORY_OFF', 'BEREAVEMENT_LEAVE', 'MARRIAGE_LEAVE'
    )),
    CONSTRAINT chk_leave_status CHECK (status IN (
        'PENDING', 'MANAGER_APPROVED', 'ADMIN_APPROVED', 'REJECTED', 'CANCELLED'
    )),
    CONSTRAINT chk_date_range CHECK (end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
