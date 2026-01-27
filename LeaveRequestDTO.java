package com.ecovale.hr.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * DTO for creating leave requests
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Leave request creation payload")
public class LeaveRequestDTO {
    
    @NotBlank(message = "Employee ID is required")
    @Schema(description = "Unique employee identifier", example = "EMP001", required = true)
    private String employeeId;
    
    @NotBlank(message = "Employee name is required")
    @Schema(description = "Full name of the employee", example = "John Doe", required = true)
    private String employeeName;
    
    @NotBlank(message = "Employee email is required")
    @Email(message = "Invalid email format")
    @Schema(description = "Employee email address", example = "john.doe@ecovale.com", required = true)
    private String employeeEmail;
    
    @NotNull(message = "Leave type is required")
    @Schema(description = "Type of leave", 
            example = "CASUAL_LEAVE",
            allowableValues = {"CASUAL_LEAVE", "SICK_LEAVE", "EARNED_LEAVE", "MATERNITY_LEAVE", 
                              "PATERNITY_LEAVE", "UNPAID_LEAVE", "COMPENSATORY_OFF", 
                              "BEREAVEMENT_LEAVE", "MARRIAGE_LEAVE"},
            required = true)
    private String leaveType;
    
    @NotNull(message = "Start date is required")
    @Future(message = "Start date must be in the future")
    @Schema(description = "Leave start date (must be future date)", example = "2026-02-15", required = true)
    private LocalDate startDate;
    
    @NotNull(message = "End date is required")
    @Future(message = "End date must be in the future")
    @Schema(description = "Leave end date (must be >= start date)", example = "2026-02-17", required = true)
    private LocalDate endDate;
    
    @NotBlank(message = "Reason is required")
    @Size(min = 10, max = 1000, message = "Reason must be between 10 and 1000 characters")
    @Schema(description = "Reason for leave request", example = "Personal work and family commitment", 
            minLength = 10, maxLength = 1000, required = true)
    private String reason;
    
    @Schema(description = "Reporting manager username for approval routing", example = "manager1")
    private String reportingManager;
    
    @Schema(description = "Employee's department", example = "IT")
    private String department;
}
