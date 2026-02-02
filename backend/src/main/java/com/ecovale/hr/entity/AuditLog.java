package com.ecovale.hr.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * AuditLog Entity
 * Tracks all CREATE, UPDATE, DELETE operations in the system
 */
@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String username;
    
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private AuditAction action;
    
    @Column(nullable = false)
    private String entityName;
    
    @Column(nullable = false)
    private Long entityId;
    
    @Column(columnDefinition = "TEXT")
    private String details;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
    
    @Column
    private String ipAddress;
    
    @Column
    private String userAgent;
    
    /**
     * Audit action types
     */
    public enum AuditAction {
        CREATE,
        UPDATE,
        DELETE,
        LOGIN,
        LOGOUT,
        ACCESS_DENIED
    }
    
    /**
     * Pre-persist to set timestamp
     */
    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
