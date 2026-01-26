package com.ecovale.hr.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for Loan Record requests
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoanRequestDTO {

    @NotBlank(message = "Employee ID is required")
    private String employeeId;

    @NotBlank(message = "Employee name is required")
    private String employeeName;

    @NotNull(message = "Loan amount is required")
    @Positive(message = "Loan amount must be positive")
    private Double loanAmount;

    @NotNull(message = "Interest rate is required")
    private Double interestRate;

    @NotNull(message = "Number of EMIs is required")
    @Positive(message = "Number of EMIs must be positive")
    private Integer numberOfEMIs;

    @NotNull(message = "EMI amount is required")
    @Positive(message = "EMI amount must be positive")
    private Double emiAmount;

    @NotNull(message = "Total amount is required")
    @Positive(message = "Total amount must be positive")
    private Double totalAmount;

    @NotBlank(message = "Start month is required")
    private String startMonth;

    @NotBlank(message = "Start year is required")
    private String startYear;

    private Integer totalPaidEMIs = 0;

    @NotNull(message = "Remaining balance is required")
    private Double remainingBalance;

    @NotBlank(message = "Status is required")
    private String status;

    private String remarks;
}
