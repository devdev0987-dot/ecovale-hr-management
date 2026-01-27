package com.ecovale.hr.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entity class representing an Attendance Record
 * Maps to 'attendance_records' table in the database
 */
@Entity
@Table(name = "attendance_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceRecord {

    @Id
    @Column(length = 50, nullable = false)
    private String id;

    @Column(nullable = false, length = 50)
    private String employeeId;

    @Column(nullable = false, length = 150)
    private String employeeName;

    @Column(nullable = false, length = 20)
    private String month;

    @Column(nullable = false, length = 10)
    private String year;

    @Column(nullable = false)
    private Integer totalWorkingDays;

    @Column(nullable = false)
    private Integer presentDays;

    @Column(nullable = false)
    private Integer absentDays;

    @Column(nullable = false)
    private Integer paidLeave;

    @Column(nullable = false)
    private Integer unpaidLeave;

    @Column(nullable = false)
    private Integer payableDays;

    @Column(nullable = false)
    private Integer lossOfPayDays;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
