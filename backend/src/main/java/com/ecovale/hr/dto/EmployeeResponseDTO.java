package com.ecovale.hr.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object for Employee responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeResponseDTO {

    private String id;
    private String firstName;
    private String middleName;
    private String lastName;
    private String dob;
    private String gender;
    private String photo;
    private String contactNumber;
    private String alternateContact;
    private String emergencyContact;
    private String personalEmail;
    private String permanentAddress;
    private String currentAddress;
    private String pfNumber;
    private String esiNumber;
    private String bloodGroup;
    private String fatherName;
    private String motherName;

    private String type;
    private String department;
    private String designation;
    private String reportingManager;
    private String joinDate;
    private String officialEmail;
    private String workLocation;
    private Integer probationPeriod;
    private String grade;

    private Double ctc;
    private Double basic;
    private Double hraPercentage;
    private Double hra;
    private Double conveyance;
    private Double telephone;
    private Double medicalAllowance;
    private Double specialAllowance;
    private Double employeeHealthInsuranceAnnual;
    private Double gross;
    private Boolean includePF;
    private Boolean includeESI;
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
    private String paymentMode;

    private String bankName;
    private String accountHolder;
    private String accountNumber;
    private String ifscCode;
    private String branch;

    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
