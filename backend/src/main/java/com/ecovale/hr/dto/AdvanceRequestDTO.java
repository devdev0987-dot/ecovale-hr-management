package com.ecovale.hr.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for Advance Record requests
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdvanceRequestDTO {

    @NotBlank(message = "Employee ID is required")
    private String employeeId;

    @NotBlank(message = "Employee name is required")
    private String employeeName;

    @NotBlank(message = "Advance month is required")
    private String advanceMonth;

    @NotBlank(message = "Advance year is required")
    private String advanceYear;

    @NotNull(message = "Advance paid amount is required")
    @Positive(message = "Advance paid amount must be positive")
    private Double advancePaidAmount;

    @NotBlank(message = "Advance deduction month is required")
    private String advanceDeductionMonth;

    @NotBlank(message = "Advance deduction year is required")
    private String advanceDeductionYear;

    private String remarks;

    @NotBlank(message = "Status is required")
    private String status;

    @NotNull(message = "Remaining amount is required")
    private Double remainingAmount;
}
