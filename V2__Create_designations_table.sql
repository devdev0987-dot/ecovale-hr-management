-- =================================================================
-- Flyway Migration V2: Create Designations Table
-- Author: Ecovale HR Team
-- Date: 2026-01-26
-- Description: Table for employee designations and job titles
-- =================================================================

CREATE TABLE IF NOT EXISTS designations (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL UNIQUE,
    department VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    reporting_to VARCHAR(50),
    level INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_department (department),
    INDEX idx_title (title),
    INDEX idx_level (level),
    CONSTRAINT chk_department CHECK (department IN ('IT', 'HR', 'Finance', 'Sales', 'Marketing'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample designations
INSERT INTO designations (id, title, department, description, reporting_to, level) VALUES
    ('DES001', 'Software Engineer', 'IT', 'Develops and maintains software applications', 'DES002', 2),
    ('DES002', 'Senior Software Engineer', 'IT', 'Leads development projects and mentors junior developers', 'DES003', 3),
    ('DES003', 'Engineering Manager', 'IT', 'Manages engineering team and technical strategy', NULL, 4),
    ('DES004', 'HR Executive', 'HR', 'Handles recruitment and employee relations', 'DES005', 2),
    ('DES005', 'HR Manager', 'HR', 'Oversees HR operations and policies', NULL, 4),
    ('DES006', 'Accountant', 'Finance', 'Manages financial records and transactions', 'DES007', 2),
    ('DES007', 'Finance Manager', 'Finance', 'Oversees financial planning and reporting', NULL, 4),
    ('DES008', 'Sales Executive', 'Sales', 'Handles customer acquisition and sales', 'DES009', 2),
    ('DES009', 'Sales Manager', 'Sales', 'Manages sales team and revenue targets', NULL, 4)
ON DUPLICATE KEY UPDATE title = VALUES(title);
