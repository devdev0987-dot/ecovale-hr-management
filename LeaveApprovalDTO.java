package com.ecovale.hr.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for leave approval/rejection
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaveApprovalDTO {
    
    @NotBlank(message = "Comments are required")
    @Size(min = 5, max = 500, message = "Comments must be between 5 and 500 characters")
    private String comments;
}
