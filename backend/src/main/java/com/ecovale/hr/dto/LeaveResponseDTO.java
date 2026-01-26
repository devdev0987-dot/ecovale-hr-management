package com.ecovale.hr.dto;

import com.ecovale.hr.entity.LeaveRequest;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO for leave request responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaveResponseDTO {
    
    private Long id;
    private String employeeId;
    private String employeeName;
    private String employeeEmail;
    private String leaveType;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer numberOfDays;
    private String reason;
    private String status;
    
    // Approval workflow fields
    private String managerApprovedBy;
    private LocalDateTime managerApprovedAt;
    private String managerComments;
    
    private String adminApprovedBy;
    private LocalDateTime adminApprovedAt;
    private String adminComments;
    
    private String rejectedBy;
    private LocalDateTime rejectedAt;
    private String rejectionReason;
    
    private String reportingManager;
    private String department;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    
    /**
     * Convert entity to DTO
     */
    public static LeaveResponseDTO fromEntity(LeaveRequest leaveRequest) {
        LeaveResponseDTO dto = new LeaveResponseDTO();
        dto.setId(leaveRequest.getId());
        dto.setEmployeeId(leaveRequest.getEmployeeId());
        dto.setEmployeeName(leaveRequest.getEmployeeName());
        dto.setEmployeeEmail(leaveRequest.getEmployeeEmail());
        dto.setLeaveType(leaveRequest.getLeaveType().name());
        dto.setStartDate(leaveRequest.getStartDate());
        dto.setEndDate(leaveRequest.getEndDate());
        dto.setNumberOfDays(leaveRequest.getNumberOfDays());
        dto.setReason(leaveRequest.getReason());
        dto.setStatus(leaveRequest.getStatus().name());
        
        dto.setManagerApprovedBy(leaveRequest.getManagerApprovedBy());
        dto.setManagerApprovedAt(leaveRequest.getManagerApprovedAt());
        dto.setManagerComments(leaveRequest.getManagerComments());
        
        dto.setAdminApprovedBy(leaveRequest.getAdminApprovedBy());
        dto.setAdminApprovedAt(leaveRequest.getAdminApprovedAt());
        dto.setAdminComments(leaveRequest.getAdminComments());
        
        dto.setRejectedBy(leaveRequest.getRejectedBy());
        dto.setRejectedAt(leaveRequest.getRejectedAt());
        dto.setRejectionReason(leaveRequest.getRejectionReason());
        
        dto.setReportingManager(leaveRequest.getReportingManager());
        dto.setDepartment(leaveRequest.getDepartment());
        
        dto.setCreatedAt(leaveRequest.getCreatedAt());
        dto.setUpdatedAt(leaveRequest.getUpdatedAt());
        
        return dto;
    }
}
