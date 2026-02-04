package com.ecovale.hr.controller;

import com.ecovale.hr.dto.LeaveRequestDTO;
import com.ecovale.hr.dto.LeaveResponseDTO;
import com.ecovale.hr.dto.LeaveApprovalDTO;
import com.ecovale.hr.dto.ApiResponse;
import com.ecovale.hr.service.LeaveService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Leave Request Management
 * 
 * Provides endpoints for leave request creation, approval workflow, and management.
 * Implements two-level approval: MANAGER → ADMIN with audit logging.
 */
@RestController
@RequestMapping("/api/v1/leaves")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Leave Management", description = "Leave request creation, approval workflow, and management APIs")
@SecurityRequirement(name = "Bearer Authentication")
public class LeaveController {
    
    private final LeaveService leaveService;
    
    /**
     * Create a new leave request
     */
    @Operation(
        summary = "Create leave request",
        description = "Submit a new leave request. Validates dates, checks for overlaps, sets status to PENDING. " +
                     "Requires future dates and non-overlapping with approved leaves."
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "Leave request created successfully",
            content = @Content(schema = @Schema(implementation = LeaveResponseDTO.class))),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Invalid request data or overlapping leave",
            content = @Content),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Unauthorized - JWT token missing or invalid",
            content = @Content),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Forbidden - Insufficient permissions",
            content = @Content)
    })
    @PostMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'MANAGER', 'ADMIN', 'HR')")
    public ResponseEntity<com.ecovale.hr.dto.ApiResponse<LeaveResponseDTO>> createLeaveRequest(
            @Valid @RequestBody LeaveRequestDTO requestDTO) {
        log.info("Creating leave request for employee: {}", requestDTO.getEmployeeId());
        LeaveResponseDTO response = leaveService.createLeaveRequest(requestDTO);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(com.ecovale.hr.dto.ApiResponse.success("Leave request created successfully", response));
    }
    
    /**
     * Get all leave requests
     */
    @Operation(
        summary = "Get all leave requests",
        description = "Retrieve all leave requests across the organization. Admin only."
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Leave requests retrieved successfully"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Unauthorized"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Forbidden - Admin role required")
    })
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<com.ecovale.hr.dto.ApiResponse<List<LeaveResponseDTO>>> getAllLeaveRequests() {
        log.info("Fetching all leave requests");
        List<LeaveResponseDTO> leaves = leaveService.getAllLeaveRequests();
        return ResponseEntity.ok(com.ecovale.hr.dto.ApiResponse.success(leaves));
    }
    
    /**
     * Get leave request by ID
     */
    @Operation(
        summary = "Get leave request by ID",
        description = "Retrieve a specific leave request by its ID"
    )
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Leave request found"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Leave request not found"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'MANAGER', 'ADMIN', 'HR')")
    public ResponseEntity<com.ecovale.hr.dto.ApiResponse<LeaveResponseDTO>> getLeaveRequestById(
            @Parameter(description = "Leave request ID", example = "1")
            @PathVariable Long id) {
        log.info("Fetching leave request with ID: {}", id);
        LeaveResponseDTO leave = leaveService.getLeaveRequestById(id);
        return ResponseEntity.ok(com.ecovale.hr.dto.ApiResponse.success(leave));
    }
    
    /**
     * Get leave requests by employee ID
     * Access: EMPLOYEE (own leaves), MANAGER, ADMIN
     */
    @GetMapping("/employee/{employeeId}")
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'MANAGER', 'ADMIN', 'HR')")
    public ResponseEntity<ApiResponse<List<LeaveResponseDTO>>> getLeaveRequestsByEmployee(
            @PathVariable String employeeId) {
        log.info("Fetching leave requests for employee: {}", employeeId);
        List<LeaveResponseDTO> leaves = leaveService.getLeaveRequestsByEmployee(employeeId);
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    /**
     * Get leave requests by status
     * Access: MANAGER, ADMIN
     */
    @GetMapping("/status/{status}")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'HR')")
    public ResponseEntity<ApiResponse<List<LeaveResponseDTO>>> getLeaveRequestsByStatus(
            @PathVariable String status) {
        log.info("Fetching leave requests with status: {}", status);
        List<LeaveResponseDTO> leaves = leaveService.getLeaveRequestsByStatus(status);
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    /**
     * Get pending leave requests for current manager
     * Access: MANAGER only
     */
    @GetMapping("/manager/pending")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<List<LeaveResponseDTO>>> getPendingLeavesForManager(
            @RequestParam String managerUsername) {
        log.info("Fetching pending leaves for manager: {}", managerUsername);
        List<LeaveResponseDTO> leaves = leaveService.getPendingLeavesForManager(managerUsername);
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    /**
     * Get manager-approved leaves (pending admin approval)
     * Access: ADMIN only
     */
    @GetMapping("/admin/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<LeaveResponseDTO>>> getManagerApprovedLeaves() {
        log.info("Fetching manager-approved leaves pending admin approval");
        List<LeaveResponseDTO> leaves = leaveService.getManagerApprovedLeaves();
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    /**
     * Manager approves leave request (first level)
     * Access: MANAGER only
     */
    @PutMapping("/{id}/manager-approve")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<LeaveResponseDTO>> managerApproveLeave(
            @PathVariable Long id,
            @Valid @RequestBody LeaveApprovalDTO approvalDTO) {
        log.info("Manager approving leave request: {}", id);
        LeaveResponseDTO response = leaveService.managerApproveLeave(id, approvalDTO);
        return ResponseEntity.ok(ApiResponse.success("Leave approved by manager", response));
    }
    
    /**
     * Admin approves leave request (final approval)
     * Access: ADMIN only
     */
    @PutMapping("/{id}/admin-approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<LeaveResponseDTO>> adminApproveLeave(
            @PathVariable Long id,
            @Valid @RequestBody LeaveApprovalDTO approvalDTO) {
        log.info("Admin approving leave request: {}", id);
        LeaveResponseDTO response = leaveService.adminApproveLeave(id, approvalDTO);
        return ResponseEntity.ok(ApiResponse.success("Leave finally approved by admin", response));
    }
    
    /**
     * Reject leave request
     * Access: MANAGER, ADMIN
     */
    @PutMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN')")
    public ResponseEntity<ApiResponse<LeaveResponseDTO>> rejectLeave(
            @PathVariable Long id,
            @Valid @RequestBody LeaveApprovalDTO rejectionDTO) {
        log.info("Rejecting leave request: {}", id);
        LeaveResponseDTO response = leaveService.rejectLeave(id, rejectionDTO);
        return ResponseEntity.ok(ApiResponse.success("Leave request rejected", response));
    }
    
    /**
     * Cancel leave request (by employee)
     * Access: EMPLOYEE
     */
    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'MANAGER', 'ADMIN', 'HR')")
    public ResponseEntity<ApiResponse<LeaveResponseDTO>> cancelLeave(@PathVariable Long id) {
        log.info("Cancelling leave request: {}", id);
        LeaveResponseDTO response = leaveService.cancelLeave(id);
        return ResponseEntity.ok(ApiResponse.success("Leave request cancelled", response));
    }
    
    /**
     * Delete leave request
     * Access: ADMIN only
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteLeaveRequest(@PathVariable Long id) {
        log.info("Deleting leave request: {}", id);
        leaveService.deleteLeaveRequest(id);
        return ResponseEntity.ok(ApiResponse.success("Leave request deleted", null));
    }
    
    /**
     * Get leave statistics for an employee
     * Access: EMPLOYEE, MANAGER, ADMIN
     */
    @GetMapping("/employee/{employeeId}/statistics")
    @PreAuthorize("hasAnyRole('EMPLOYEE', 'MANAGER', 'ADMIN', 'HR')")
    public ResponseEntity<ApiResponse<LeaveService.LeaveStatistics>> getLeaveStatistics(
            @PathVariable String employeeId,
            @RequestParam(defaultValue = "2026") int year) {
        log.info("Fetching leave statistics for employee: {} in year: {}", employeeId, year);
        LeaveService.LeaveStatistics stats = leaveService.getLeaveStatistics(employeeId, year);
        return ResponseEntity.ok(ApiResponse.success(stats));
    }
}
