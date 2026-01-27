package com.ecovale.hr.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for Employee creation and update requests
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeRequestDTO {

    // Personal Information
    @NotBlank(message = "First name is required")
    @Size(max = 100, message = "First name cannot exceed 100 characters")
    private String firstName;

    @Size(max = 100, message = "Middle name cannot exceed 100 characters")
    private String middleName;

    @NotBlank(message = "Last name is required")
    @Size(max = 100, message = "Last name cannot exceed 100 characters")
    private String lastName;

    private String dob;

    @NotNull(message = "Gender is required")
    private String gender;

    private String photo;

    @NotBlank(message = "Contact number is required")
    @Pattern(regexp = "^[0-9]{10}$", message = "Contact number must be 10 digits")
    private String contactNumber;

    @Pattern(regexp = "^[0-9]{10}$", message = "Alternate contact must be 10 digits")
    private String alternateContact;

    @Pattern(regexp = "^[0-9]{10}$", message = "Emergency contact must be 10 digits")
    private String emergencyContact;

    @NotBlank(message = "Personal email is required")
    @Email(message = "Invalid email format")
    private String personalEmail;

    private String permanentAddress;

    @NotBlank(message = "Current address is required")
    private String currentAddress;

    private String pfNumber;
    private String esiNumber;
    private String bloodGroup;
    private String fatherName;
    private String motherName;

    // Employment Details
    @NotBlank(message = "Employment type is required")
    private String type;

    @NotBlank(message = "Department is required")
    private String department;

    @NotBlank(message = "Designation is required")
    private String designation;

    private String reportingManager;
    private String joinDate;

    @NotBlank(message = "Official email is required")
    @Email(message = "Invalid email format")
    private String officialEmail;

    @NotBlank(message = "Work location is required")
    private String workLocation;

    private Integer probationPeriod;
    private String grade;

    // Salary Information
    @NotNull(message = "CTC is required")
    @Positive(message = "CTC must be positive")
    private Double ctc;

    @NotNull(message = "Basic salary is required")
    @Positive(message = "Basic salary must be positive")
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

    @NotBlank(message = "Payment mode is required")
    private String paymentMode;

    // Bank Details
    private String bankName;
    private String accountHolder;
    private String accountNumber;
    private String ifscCode;
    private String branch;

    @NotBlank(message = "Employee status is required")
    private String status;
}
