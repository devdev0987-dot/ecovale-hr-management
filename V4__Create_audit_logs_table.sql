-- =================================================================
-- Flyway Migration V4: Create Audit Logs Table
-- Author: Ecovale HR Team
-- Date: 2026-01-26
-- Description: Audit logging for tracking all system changes
-- =================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id BIGINT NOT NULL,
    details TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    
    INDEX idx_username (username),
    INDEX idx_action (action),
    INDEX idx_entity (entity_name, entity_id),
    INDEX idx_timestamp (timestamp),
    
    CONSTRAINT chk_action CHECK (action IN ('CREATE', 'UPDATE', 'DELETE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
