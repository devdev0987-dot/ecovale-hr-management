package com.ecovale.hr.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object for Advance Record responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdvanceResponseDTO {

    private String id;
    private String employeeId;
    private String employeeName;
    private String advanceMonth;
    private String advanceYear;
    private Double advancePaidAmount;
    private String advanceDeductionMonth;
    private String advanceDeductionYear;
    private String remarks;
    private String status;
    private Double remainingAmount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
