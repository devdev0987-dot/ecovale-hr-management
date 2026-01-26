package com.ecovale.hr.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entity class representing an Advance Record
 * Maps to 'advance_records' table in the database
 */
@Entity
@Table(name = "advance_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdvanceRecord {

    @Id
    @Column(length = 50, nullable = false)
    private String id;

    @Column(nullable = false, length = 50)
    private String employeeId;

    @Column(nullable = false, length = 150)
    private String employeeName;

    @Column(nullable = false, length = 30)
    private String advanceMonth;

    @Column(nullable = false, length = 10)
    private String advanceYear;

    @Column(nullable = false)
    private Double advancePaidAmount;

    @Column(nullable = false, length = 30)
    private String advanceDeductionMonth;

    @Column(nullable = false, length = 10)
    private String advanceDeductionYear;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AdvanceStatus status;

    @Column(nullable = false)
    private Double remainingAmount;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public enum AdvanceStatus {
        PENDING, DEDUCTED, PARTIAL
    }
}
