package com.ecovale.hr.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entity class representing an Employee in the system
 * Maps to 'employees' table in the database
 */
@Entity
@Table(name = "employees")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Employee {

    @Id
    @Column(length = 50, nullable = false)
    private String id;

    // Personal Information
    @Column(nullable = false, length = 100)
    private String firstName;

    @Column(length = 100)
    private String middleName;

    @Column(nullable = false, length = 100)
    private String lastName;

    private String dob;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Gender gender;

    @Column(columnDefinition = "LONGTEXT")
    private String photo; // base64 encoded

    @Column(nullable = false, length = 15)
    private String contactNumber;

    @Column(length = 15)
    private String alternateContact;

    @Column(length = 15)
    private String emergencyContact;

    @Column(nullable = false, length = 150)
    private String personalEmail;

    @Column(columnDefinition = "TEXT")
    private String permanentAddress;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String currentAddress;

    @Column(length = 50)
    private String pfNumber;

    @Column(length = 50)
    private String esiNumber;

    @Column(length = 10)
    private String bloodGroup;

    @Column(length = 100)
    private String fatherName;

    @Column(length = 100)
    private String motherName;

    // Employment Details
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmploymentType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private Department department;

    @Column(nullable = false, length = 100)
    private String designation;

    @Column(length = 100)
    private String reportingManager;

    private String joinDate;

    @Column(nullable = false, unique = true, length = 150)
    private String officialEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private WorkLocation workLocation;

    private Integer probationPeriod;

    @Enumerated(EnumType.STRING)
    @Column(length = 1)
    private Grade grade;

    // Salary Information
    @Column(nullable = false)
    private Double ctc;

    @Column(nullable = false)
    private Double basic;

    private Double hraPercentage;
    private Double hra;
    private Double conveyance;
    private Double telephone;
    private Double medicalAllowance;
    private Double specialAllowance;
    private Double employeeHealthInsuranceAnnual;
    private Double gross;

    private Boolean includePF = false;
    private Boolean includeESI = false;

    private Double pfDeduction;
    private Double esiDeduction;
    private Double employerESI;
    private Double employerPF;
    private Double professionalTax;
    private Double tds;
    private Double tdsMonthly;
    private Double gstMonthly;
    private Double gstAnnual;
    private Double professionalFeesMonthly;
    private Boolean professionalFeesInclusive;
    private Double professionalFeesBaseMonthly;
    private Double professionalFeesTotalMonthly;
    private Double professionalFeesBaseAnnual;
    private Double professionalFeesTotalAnnual;
    private Double net;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentMode paymentMode;

    // Bank Details (stored as JSON or separate fields)
    @Column(length = 100)
    private String bankName;

    @Column(length = 100)
    private String accountHolder;

    @Column(length = 50)
    private String accountNumber;

    @Column(length = 20)
    private String ifscCode;

    @Column(length = 100)
    private String branch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmployeeStatus status;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    // Enums
    public enum Gender {
        Male, Female, Other
    }

    public enum EmploymentType {
        FULL_TIME, PART_TIME
    }

    public enum Department {
        IT, HR, Finance, Sales, Marketing
    }

    public enum WorkLocation {
        Bangalore, Mangaluru, Mysore, Belagaum, Hubballi, Kolar, Tumkur, Shivamogga, Remote
    }

    public enum Grade {
        A, B, C, D
    }

    public enum PaymentMode {
        Bank, Cash, Cheque
    }

    public enum EmployeeStatus {
        ACTIVE, INACTIVE
    }
}
