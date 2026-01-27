package com.ecovale.hr.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object for Attendance Record responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceResponseDTO {

    private String id;
    private String employeeId;
    private String employeeName;
    private String month;
    private String year;
    private Integer totalWorkingDays;
    private Integer presentDays;
    private Integer absentDays;
    private Integer paidLeave;
    private Integer unpaidLeave;
    private Integer payableDays;
    private Integer lossOfPayDays;
    private String remarks;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
