package com.ecovale.hr.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for Attendance Record requests
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceRequestDTO {

    @NotBlank(message = "Employee ID is required")
    private String employeeId;

    @NotBlank(message = "Employee name is required")
    private String employeeName;

    @NotBlank(message = "Month is required")
    private String month;

    @NotBlank(message = "Year is required")
    private String year;

    @NotNull(message = "Total working days is required")
    @PositiveOrZero(message = "Total working days must be zero or positive")
    private Integer totalWorkingDays;

    @NotNull(message = "Present days is required")
    @PositiveOrZero(message = "Present days must be zero or positive")
    private Integer presentDays;

    @NotNull(message = "Absent days is required")
    @PositiveOrZero(message = "Absent days must be zero or positive")
    private Integer absentDays;

    @NotNull(message = "Paid leave is required")
    @PositiveOrZero(message = "Paid leave must be zero or positive")
    private Integer paidLeave;

    @NotNull(message = "Unpaid leave is required")
    @PositiveOrZero(message = "Unpaid leave must be zero or positive")
    private Integer unpaidLeave;

    @NotNull(message = "Payable days is required")
    @PositiveOrZero(message = "Payable days must be zero or positive")
    private Integer payableDays;

    @NotNull(message = "Loss of pay days is required")
    @PositiveOrZero(message = "Loss of pay days must be zero or positive")
    private Integer lossOfPayDays;

    private String remarks;
}
