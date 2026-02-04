package com.ecovale.hr.service;

import com.ecovale.hr.dto.LeaveApprovalDTO;
import com.ecovale.hr.dto.LeaveRequestDTO;
import com.ecovale.hr.dto.LeaveResponseDTO;
import com.ecovale.hr.entity.LeaveRequest;
import com.ecovale.hr.repository.LeaveRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for LeaveService
 */
@ExtendWith(MockitoExtension.class)
class LeaveServiceTest {
    
    @Mock
    private LeaveRequestRepository leaveRequestRepository;
    
    @Mock
    private AuditLogService auditLogService;
    
    @InjectMocks
    private LeaveService leaveService;
    
    private LeaveRequest testLeaveRequest;
    private LeaveRequestDTO testRequestDTO;
    
    @BeforeEach
    void setUp() {
        // Set up authentication context
        Authentication auth = new UsernamePasswordAuthenticationToken(
            "testuser",
            "password",
            Collections.singletonList(new SimpleGrantedAuthority("ROLE_EMPLOYEE"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
        
        // Create test leave request entity
        testLeaveRequest = new LeaveRequest();
        testLeaveRequest.setId(1L);
        testLeaveRequest.setEmployeeId("EMP001");
        testLeaveRequest.setEmployeeName("John Doe");
        testLeaveRequest.setEmployeeEmail("john@ecovale.com");
        testLeaveRequest.setLeaveType(LeaveRequest.LeaveType.CASUAL_LEAVE);
        testLeaveRequest.setStartDate(LocalDate.now().plusDays(10));
        testLeaveRequest.setEndDate(LocalDate.now().plusDays(12));
        testLeaveRequest.setNumberOfDays(3);
        testLeaveRequest.setReason("Personal work");
        testLeaveRequest.setStatus(LeaveRequest.LeaveStatus.PENDING);
        testLeaveRequest.setReportingManager("manager1");
        testLeaveRequest.setDepartment("IT");
        testLeaveRequest.setCreatedAt(LocalDateTime.now());
        testLeaveRequest.setUpdatedAt(LocalDateTime.now());
        
        // Create test request DTO
        testRequestDTO = new LeaveRequestDTO();
        testRequestDTO.setEmployeeId("EMP001");
        testRequestDTO.setEmployeeName("John Doe");
        testRequestDTO.setEmployeeEmail("john@ecovale.com");
        testRequestDTO.setLeaveType("CASUAL_LEAVE");
        testRequestDTO.setStartDate(LocalDate.now().plusDays(10));
        testRequestDTO.setEndDate(LocalDate.now().plusDays(12));
        testRequestDTO.setReason("Personal work");
        testRequestDTO.setReportingManager("manager1");
        testRequestDTO.setDepartment("IT");
    }
    
    @Test
    void testCreateLeaveRequest_Success() {
        // Arrange
        when(leaveRequestRepository.findApprovedLeavesByEmployeeAndDateRange(
            any(), any(), any())).thenReturn(Collections.emptyList());
        when(leaveRequestRepository.save(any(LeaveRequest.class))).thenReturn(testLeaveRequest);
        
        // Act
        LeaveResponseDTO result = leaveService.createLeaveRequest(testRequestDTO);
        
        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getEmployeeId()).isEqualTo("EMP001");
        assertThat(result.getStatus()).isEqualTo("PENDING");
        assertThat(result.getNumberOfDays()).isEqualTo(3);
        
        verify(leaveRequestRepository).save(any(LeaveRequest.class));
        verify(auditLogService).logCreate(eq("LeaveRequest"), anyLong(), any());
    }
    
    @Test
    void testCreateLeaveRequest_OverlappingLeaves_ThrowsException() {
        // Arrange
        when(leaveRequestRepository.findApprovedLeavesByEmployeeAndDateRange(
            any(), any(), any())).thenReturn(List.of(testLeaveRequest));
        
        // Act & Assert
        assertThatThrownBy(() -> leaveService.createLeaveRequest(testRequestDTO))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("already have approved leave");
    }
    
    @Test
    void testCreateLeaveRequest_InvalidDates_ThrowsException() {
        // Arrange
        testRequestDTO.setEndDate(LocalDate.now().plusDays(5)); // Before start date
        
        // Act & Assert
        assertThatThrownBy(() -> leaveService.createLeaveRequest(testRequestDTO))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("End date cannot be before start date");
    }
    
    @Test
    void testGetLeaveRequestById_Success() {
        // Arrange
        when(leaveRequestRepository.findById(1L)).thenReturn(Optional.of(testLeaveRequest));
        
        // Act
        LeaveResponseDTO result = leaveService.getLeaveRequestById(1L);
        
        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getEmployeeName()).isEqualTo("John Doe");
    }
    
    @Test
    void testManagerApproveLeave_Success() {
        // Arrange
        when(leaveRequestRepository.findById(1L)).thenReturn(Optional.of(testLeaveRequest));
        when(leaveRequestRepository.save(any(LeaveRequest.class))).thenReturn(testLeaveRequest);
        
        LeaveApprovalDTO approvalDTO = new LeaveApprovalDTO("Approved by manager");
        
        // Act
        LeaveResponseDTO result = leaveService.managerApproveLeave(1L, approvalDTO);
        
        // Assert
        assertThat(result).isNotNull();
        verify(leaveRequestRepository).save(any(LeaveRequest.class));
        verify(auditLogService).logUpdate(eq("LeaveRequest"), eq(1L), any(), any());
    }
    
    @Test
    void testManagerApproveLeave_InvalidStatus_ThrowsException() {
        // Arrange
        testLeaveRequest.setStatus(LeaveRequest.LeaveStatus.ADMIN_APPROVED);
        when(leaveRequestRepository.findById(1L)).thenReturn(Optional.of(testLeaveRequest));
        
        LeaveApprovalDTO approvalDTO = new LeaveApprovalDTO("Approved");
        
        // Act & Assert
        assertThatThrownBy(() -> leaveService.managerApproveLeave(1L, approvalDTO))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("cannot be approved by manager");
    }
    
    @Test
    void testAdminApproveLeave_Success() {
        // Arrange
        testLeaveRequest.setStatus(LeaveRequest.LeaveStatus.MANAGER_APPROVED);
        when(leaveRequestRepository.findById(1L)).thenReturn(Optional.of(testLeaveRequest));
        when(leaveRequestRepository.save(any(LeaveRequest.class))).thenReturn(testLeaveRequest);
        
        LeaveApprovalDTO approvalDTO = new LeaveApprovalDTO("Final approval granted");
        
        // Act
        LeaveResponseDTO result = leaveService.adminApproveLeave(1L, approvalDTO);
        
        // Assert
        assertThat(result).isNotNull();
        verify(leaveRequestRepository).save(any(LeaveRequest.class));
        verify(auditLogService).logUpdate(eq("LeaveRequest"), eq(1L), any(), any());
    }
    
    @Test
    void testRejectLeave_Success() {
        // Arrange
        when(leaveRequestRepository.findById(1L)).thenReturn(Optional.of(testLeaveRequest));
        when(leaveRequestRepository.save(any(LeaveRequest.class))).thenReturn(testLeaveRequest);
        
        LeaveApprovalDTO rejectionDTO = new LeaveApprovalDTO("Insufficient coverage");
        
        // Act
        LeaveResponseDTO result = leaveService.rejectLeave(1L, rejectionDTO);
        
        // Assert
        assertThat(result).isNotNull();
        verify(leaveRequestRepository).save(any(LeaveRequest.class));
        verify(auditLogService).logUpdate(eq("LeaveRequest"), eq(1L), any(), any());
    }
    
    @Test
    void testCancelLeave_Success() {
        // Arrange
        when(leaveRequestRepository.findById(1L)).thenReturn(Optional.of(testLeaveRequest));
        when(leaveRequestRepository.save(any(LeaveRequest.class))).thenReturn(testLeaveRequest);
        
        // Act
        LeaveResponseDTO result = leaveService.cancelLeave(1L);
        
        // Assert
        assertThat(result).isNotNull();
        verify(leaveRequestRepository).save(any(LeaveRequest.class));
        verify(auditLogService).logUpdate(eq("LeaveRequest"), eq(1L), any(), any());
    }
    
    @Test
    void testGetLeaveRequestsByEmployee_Success() {
        // Arrange
        when(leaveRequestRepository.findByEmployeeIdOrderByCreatedAtDesc("EMP001"))
            .thenReturn(List.of(testLeaveRequest));
        
        // Act
        List<LeaveResponseDTO> results = leaveService.getLeaveRequestsByEmployee("EMP001");
        
        // Assert
        assertThat(results).hasSize(1);
        assertThat(results.get(0).getEmployeeId()).isEqualTo("EMP001");
    }
    
    @Test
    void testGetPendingLeavesForManager_Success() {
        // Arrange
        when(leaveRequestRepository.findPendingLeavesForManager("manager1"))
            .thenReturn(List.of(testLeaveRequest));
        
        // Act
        List<LeaveResponseDTO> results = leaveService.getPendingLeavesForManager("manager1");
        
        // Assert
        assertThat(results).hasSize(1);
        assertThat(results.get(0).getReportingManager()).isEqualTo("manager1");
    }
    
    @Test
    void testGetLeaveStatistics_Success() {
        // Arrange
        when(leaveRequestRepository.countApprovedDaysInYear("EMP001", 2026)).thenReturn(12);
        when(leaveRequestRepository.findByEmployeeIdAndStatus("EMP001", LeaveRequest.LeaveStatus.PENDING))
            .thenReturn(List.of(testLeaveRequest));
        
        // Act
        LeaveService.LeaveStatistics stats = leaveService.getLeaveStatistics("EMP001", 2026);
        
        // Assert
        assertThat(stats).isNotNull();
        assertThat(stats.getApprovedDaysThisYear()).isEqualTo(12);
        assertThat(stats.getPendingRequests()).isEqualTo(1);
    }
    
    @Test
    void testDeleteLeaveRequest_Success() {
        // Arrange
        when(leaveRequestRepository.findById(1L)).thenReturn(Optional.of(testLeaveRequest));
        doNothing().when(leaveRequestRepository).delete(any(LeaveRequest.class));
        
        // Act
        leaveService.deleteLeaveRequest(1L);
        
        // Assert
        verify(leaveRequestRepository).delete(testLeaveRequest);
        verify(auditLogService).logDelete(eq("LeaveRequest"), eq(1L), any());
    }
}
