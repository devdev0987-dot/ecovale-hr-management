package com.ecovale.hr.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * LeaveRequest Entity
 * Manages employee leave requests with approval workflow
 */
@Entity
@Table(name = "leave_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaveRequest {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 50)
    private String employeeId;
    
    @Column(nullable = false, length = 100)
    private String employeeName;
    
    @Column(nullable = false, length = 150)
    private String employeeEmail;
    
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private LeaveType leaveType;
    
    @Column(nullable = false)
    private LocalDate startDate;
    
    @Column(nullable = false)
    private LocalDate endDate;
    
    @Column(nullable = false)
    private Integer numberOfDays;
    
    @Column(columnDefinition = "TEXT")
    private String reason;
    
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private LeaveStatus status;
    
    // Approval workflow fields
    @Column(length = 100)
    private String managerApprovedBy;
    
    @Column
    private LocalDateTime managerApprovedAt;
    
    @Column(columnDefinition = "TEXT")
    private String managerComments;
    
    @Column(length = 100)
    private String adminApprovedBy;
    
    @Column
    private LocalDateTime adminApprovedAt;
    
    @Column(columnDefinition = "TEXT")
    private String adminComments;
    
    @Column(length = 100)
    private String rejectedBy;
    
    @Column
    private LocalDateTime rejectedAt;
    
    @Column(columnDefinition = "TEXT")
    private String rejectionReason;
    
    @Column(length = 100)
    private String reportingManager;
    
    @Column(length = 100)
    private String department;
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    /**
     * Leave Types
     */
    public enum LeaveType {
        CASUAL_LEAVE,
        SICK_LEAVE,
        EARNED_LEAVE,
        MATERNITY_LEAVE,
        PATERNITY_LEAVE,
        UNPAID_LEAVE,
        COMPENSATORY_OFF,
        BEREAVEMENT_LEAVE,
        MARRIAGE_LEAVE
    }
    
    /**
     * Leave Status with approval workflow
     * PENDING → MANAGER_APPROVED → ADMIN_APPROVED (final)
     * PENDING → REJECTED (by manager or admin)
     */
    public enum LeaveStatus {
        PENDING,              // Initial state
        MANAGER_APPROVED,     // Approved by manager, waiting for admin
        ADMIN_APPROVED,       // Final approval (fully approved)
        REJECTED,             // Rejected by manager or admin
        CANCELLED             // Cancelled by employee
    }
    
    /**
     * Calculate number of days between start and end date
     */
    @PrePersist
    @PreUpdate
    protected void calculateDays() {
        if (startDate != null && endDate != null) {
            this.numberOfDays = (int) java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) + 1;
        }
    }
    
    /**
     * Check if leave can be approved by manager
     */
    public boolean canBeApprovedByManager() {
        return status == LeaveStatus.PENDING;
    }
    
    /**
     * Check if leave can be approved by admin
     */
    public boolean canBeApprovedByAdmin() {
        return status == LeaveStatus.MANAGER_APPROVED;
    }
    
    /**
     * Check if leave can be rejected
     */
    public boolean canBeRejected() {
        return status == LeaveStatus.PENDING || status == LeaveStatus.MANAGER_APPROVED;
    }
    
    /**
     * Check if leave can be cancelled by employee
     */
    public boolean canBeCancelled() {
        return status == LeaveStatus.PENDING || status == LeaveStatus.MANAGER_APPROVED;
    }
}
