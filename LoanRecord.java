package com.ecovale.hr.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entity class representing a Loan Record
 * Maps to 'loan_records' table in the database
 */
@Entity
@Table(name = "loan_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoanRecord {

    @Id
    @Column(length = 50, nullable = false)
    private String id;

    @Column(nullable = false, length = 50)
    private String employeeId;

    @Column(nullable = false, length = 150)
    private String employeeName;

    @Column(nullable = false)
    private Double loanAmount;

    @Column(nullable = false)
    private Double interestRate;

    @Column(nullable = false)
    private Integer numberOfEMIs;

    @Column(nullable = false)
    private Double emiAmount;

    @Column(nullable = false)
    private Double totalAmount;

    @Column(nullable = false, length = 30)
    private String startMonth;

    @Column(nullable = false, length = 10)
    private String startYear;

    @Column(nullable = false)
    private Integer totalPaidEMIs = 0;

    @Column(nullable = false)
    private Double remainingBalance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LoanStatus status;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public enum LoanStatus {
        ACTIVE, COMPLETED, CANCELLED
    }
}
