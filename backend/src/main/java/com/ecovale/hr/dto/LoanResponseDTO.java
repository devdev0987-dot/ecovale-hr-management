package com.ecovale.hr.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object for Loan Record responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoanResponseDTO {

    private String id;
    private String employeeId;
    private String employeeName;
    private Double loanAmount;
    private Double interestRate;
    private Integer numberOfEMIs;
    private Double emiAmount;
    private Double totalAmount;
    private String startMonth;
    private String startYear;
    private Integer totalPaidEMIs;
    private Double remainingBalance;
    private String status;
    private String remarks;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
