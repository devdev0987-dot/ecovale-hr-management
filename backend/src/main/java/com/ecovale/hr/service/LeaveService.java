package com.ecovale.hr.service;

import com.ecovale.hr.entity.LeaveRequest;
import com.ecovale.hr.dto.LeaveRequestDTO;
import com.ecovale.hr.dto.LeaveResponseDTO;
import com.ecovale.hr.dto.LeaveApprovalDTO;
import com.ecovale.hr.repository.LeaveRequestRepository;
import com.ecovale.hr.exception.ResourceNotFoundException;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for Leave Request Management
 * Implements approval workflow: PENDING → MANAGER_APPROVED → ADMIN_APPROVED
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LeaveService {
    
    private final LeaveRequestRepository leaveRequestRepository;
    private final AuditLogService auditLogService;
    
    /**
     * Create a new leave request
     */
    @Transactional
    public LeaveResponseDTO createLeaveRequest(LeaveRequestDTO dto) {
        log.info("Creating leave request for employee: {}", dto.getEmployeeId());
        
        // Validate dates
        if (dto.getEndDate().isBefore(dto.getStartDate())) {
            throw new IllegalArgumentException("End date cannot be before start date");
        }
        
        // Check for overlapping approved leaves
        List<LeaveRequest> overlappingLeaves = leaveRequestRepository
            .findApprovedLeavesByEmployeeAndDateRange(
                dto.getEmployeeId(),
                dto.getStartDate(),
                dto.getEndDate()
            );
        
        if (!overlappingLeaves.isEmpty()) {
            throw new IllegalArgumentException("You already have approved leave during this period");
        }
        
        LeaveRequest leaveRequest = new LeaveRequest();
        leaveRequest.setEmployeeId(dto.getEmployeeId());
        leaveRequest.setEmployeeName(dto.getEmployeeName());
        leaveRequest.setEmployeeEmail(dto.getEmployeeEmail());
        leaveRequest.setLeaveType(LeaveRequest.LeaveType.valueOf(dto.getLeaveType()));
        leaveRequest.setStartDate(dto.getStartDate());
        leaveRequest.setEndDate(dto.getEndDate());
        leaveRequest.setReason(dto.getReason());
        leaveRequest.setReportingManager(dto.getReportingManager());
        leaveRequest.setDepartment(dto.getDepartment());
        leaveRequest.setStatus(LeaveRequest.LeaveStatus.PENDING);
        
        LeaveRequest savedLeave = leaveRequestRepository.save(leaveRequest);
        
        // Audit log
        auditLogService.logAsync(
            getCurrentUsername(),
            "CREATE",
            "LeaveRequest",
            savedLeave.getId(),
            String.format("Leave request created for %s (%d days)",
                dto.getEmployeeName(), savedLeave.getNumberOfDays())
        );
        
        log.info("Leave request created with ID: {}", savedLeave.getId());
        return LeaveResponseDTO.fromEntity(savedLeave);
    }
    
    /**
     * Get leave request by ID
     */
    public LeaveResponseDTO getLeaveRequestById(Long id) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Leave request not found with ID: " + id));
        return LeaveResponseDTO.fromEntity(leaveRequest);
    }
    
    /**
     * Get all leave requests
     */
    public List<LeaveResponseDTO> getAllLeaveRequests() {
        return leaveRequestRepository.findAll().stream()
            .map(LeaveResponseDTO::fromEntity)
            .collect(Collectors.toList());
    }
    
    /**
     * Get leave requests by employee ID
     */
    public List<LeaveResponseDTO> getLeaveRequestsByEmployee(String employeeId) {
        return leaveRequestRepository.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream()
            .map(LeaveResponseDTO::fromEntity)
            .collect(Collectors.toList());
    }
    
    /**
     * Get leave requests by status
     */
    public List<LeaveResponseDTO> getLeaveRequestsByStatus(String status) {
        LeaveRequest.LeaveStatus leaveStatus = LeaveRequest.LeaveStatus.valueOf(status);
        return leaveRequestRepository.findByStatusOrderByCreatedAtDesc(leaveStatus).stream()
            .map(LeaveResponseDTO::fromEntity)
            .collect(Collectors.toList());
    }
    
    /**
     * Get pending leave requests for a manager
     */
    public List<LeaveResponseDTO> getPendingLeavesForManager(String managerUsername) {
        return leaveRequestRepository.findPendingLeavesForManager(managerUsername).stream()
            .map(LeaveResponseDTO::fromEntity)
            .collect(Collectors.toList());
    }
    
    /**
     * Get manager-approved leaves (pending admin approval)
     */
    public List<LeaveResponseDTO> getManagerApprovedLeaves() {
        return leaveRequestRepository.findManagerApprovedLeaves().stream()
            .map(LeaveResponseDTO::fromEntity)
            .collect(Collectors.toList());
    }
    
    /**
     * Manager approves leave request (first level approval)
     */
    @Transactional
    public LeaveResponseDTO managerApproveLeave(Long id, LeaveApprovalDTO approvalDTO) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Leave request not found with ID: " + id));
        
        if (!leaveRequest.canBeApprovedByManager()) {
            throw new IllegalStateException("Leave request cannot be approved by manager in current status: " 
                + leaveRequest.getStatus());
        }
        
        String managerUsername = getCurrentUsername();
        
        leaveRequest.setStatus(LeaveRequest.LeaveStatus.MANAGER_APPROVED);
        leaveRequest.setManagerApprovedBy(managerUsername);
        leaveRequest.setManagerApprovedAt(LocalDateTime.now());
        leaveRequest.setManagerComments(approvalDTO.getComments());
        
        LeaveRequest updated = leaveRequestRepository.save(leaveRequest);
        
        // Audit log
        auditLogService.logAsync(
            managerUsername,
            "UPDATE",
            "LeaveRequest",
            id,
            String.format("Manager approved leave request for %s (%d days). Comments: %s",
                updated.getEmployeeName(), updated.getNumberOfDays(), approvalDTO.getComments())
        );
        
        log.info("Leave request {} approved by manager {}", id, managerUsername);
        return LeaveResponseDTO.fromEntity(updated);
    }
    
    /**
     * Admin approves leave request (final approval)
     */
    @Transactional
    public LeaveResponseDTO adminApproveLeave(Long id, LeaveApprovalDTO approvalDTO) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Leave request not found with ID: " + id));
        
        if (!leaveRequest.canBeApprovedByAdmin()) {
            throw new IllegalStateException("Leave request cannot be approved by admin in current status: " 
                + leaveRequest.getStatus());
        }
        
        String adminUsername = getCurrentUsername();
        
        leaveRequest.setStatus(LeaveRequest.LeaveStatus.ADMIN_APPROVED);
        leaveRequest.setAdminApprovedBy(adminUsername);
        leaveRequest.setAdminApprovedAt(LocalDateTime.now());
        leaveRequest.setAdminComments(approvalDTO.getComments());
        
        LeaveRequest updated = leaveRequestRepository.save(leaveRequest);
        
        // Audit log
        auditLogService.logAsync(
            adminUsername,
            "UPDATE",
            "LeaveRequest",
            id,
            String.format("Admin approved leave request for %s (%d days). Comments: %s",
                updated.getEmployeeName(), updated.getNumberOfDays(), approvalDTO.getComments())
        );
        
        log.info("Leave request {} finally approved by admin {}", id, adminUsername);
        return LeaveResponseDTO.fromEntity(updated);
    }
    
    /**
     * Reject leave request (can be done by manager or admin)
     */
    @Transactional
    public LeaveResponseDTO rejectLeave(Long id, LeaveApprovalDTO rejectionDTO) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Leave request not found with ID: " + id));
        
        if (!leaveRequest.canBeRejected()) {
            throw new IllegalStateException("Leave request cannot be rejected in current status: " 
                + leaveRequest.getStatus());
        }
        
        String username = getCurrentUsername();
        
        leaveRequest.setStatus(LeaveRequest.LeaveStatus.REJECTED);
        leaveRequest.setRejectedBy(username);
        leaveRequest.setRejectedAt(LocalDateTime.now());
        leaveRequest.setRejectionReason(rejectionDTO.getComments());
        
        LeaveRequest updated = leaveRequestRepository.save(leaveRequest);
        
        // Audit log
        auditLogService.logAsync(
            username,
            "UPDATE",
            "LeaveRequest",
            id,
            String.format("Rejected leave request for %s. Reason: %s",
                updated.getEmployeeName(), rejectionDTO.getComments())
        );
        
        log.info("Leave request {} rejected by {}", id, username);
        return LeaveResponseDTO.fromEntity(updated);
    }
    
    /**
     * Cancel leave request (by employee)
     */
    @Transactional
    public LeaveResponseDTO cancelLeave(Long id) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Leave request not found with ID: " + id));
        
        if (!leaveRequest.canBeCancelled()) {
            throw new IllegalStateException("Leave request cannot be cancelled in current status: " 
                + leaveRequest.getStatus());
        }
        
        String username = getCurrentUsername();
        
        leaveRequest.setStatus(LeaveRequest.LeaveStatus.CANCELLED);
        LeaveRequest updated = leaveRequestRepository.save(leaveRequest);
        
        // Audit log
        auditLogService.logAsync(
            username,
            "UPDATE",
            "LeaveRequest",
            id,
            String.format("Cancelled leave request for %s", updated.getEmployeeName())
        );
        
        log.info("Leave request {} cancelled by employee", id);
        return LeaveResponseDTO.fromEntity(updated);
    }
    
    /**
     * Delete leave request (admin only)
     */
    @Transactional
    public void deleteLeaveRequest(Long id) {
        LeaveRequest leaveRequest = leaveRequestRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Leave request not found with ID: " + id));
        
        String username = getCurrentUsername();
        
        leaveRequestRepository.delete(leaveRequest);
        
        // Audit log
        auditLogService.logAsync(
            username,
            "DELETE",
            "LeaveRequest",
            id,
            String.format("Deleted leave request for %s", leaveRequest.getEmployeeName())
        );
        
        log.info("Leave request {} deleted by {}", id, username);
    }
    
    /**
     * Get leave statistics for an employee
     */
    public LeaveStatistics getLeaveStatistics(String employeeId, int year) {
        Integer approvedDays = leaveRequestRepository.countApprovedDaysInYear(employeeId, year);
        long pendingCount = leaveRequestRepository
            .findByEmployeeIdAndStatus(employeeId, LeaveRequest.LeaveStatus.PENDING).size();
        
        return new LeaveStatistics(approvedDays, pendingCount);
    }
    
    /**
     * Get current authenticated username
     */
    private String getCurrentUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }
    
    /**
     * Leave statistics inner class
     */
    @Data
    @AllArgsConstructor
    public static class LeaveStatistics {
        private Integer approvedDaysThisYear;
        private Long pendingRequests;
    }
}
