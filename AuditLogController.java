package com.ecovale.hr.controller;

import com.ecovale.hr.dto.AuditLogResponseDTO;
import com.ecovale.hr.entity.AuditLog;
import com.ecovale.hr.entity.AuditLog.AuditAction;
import com.ecovale.hr.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST Controller for Audit Logs
 * Admin-only endpoints for viewing audit logs
 */
@RestController
@RequestMapping("/api/v1/admin/audit-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AuditLogController {
    
    private final AuditLogService auditLogService;
    
    /**
     * Get all audit logs with pagination
     * 
     * GET /api/admin/audit-logs?page=0&size=20
     */
    @GetMapping
    public ResponseEntity<Page<AuditLogResponseDTO>> getAllLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AuditLog> logs = auditLogService.getAllLogs(pageable);
        Page<AuditLogResponseDTO> response = logs.map(AuditLogResponseDTO::fromEntity);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get logs by username
     * 
     * GET /api/admin/audit-logs/user/{username}?page=0&size=20
     */
    @GetMapping("/user/{username}")
    public ResponseEntity<Page<AuditLogResponseDTO>> getLogsByUsername(
            @PathVariable String username,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AuditLog> logs = auditLogService.getLogsByUsername(username, pageable);
        Page<AuditLogResponseDTO> response = logs.map(AuditLogResponseDTO::fromEntity);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get logs by action
     * 
     * GET /api/admin/audit-logs/action/{action}?page=0&size=20
     */
    @GetMapping("/action/{action}")
    public ResponseEntity<Page<AuditLogResponseDTO>> getLogsByAction(
            @PathVariable AuditAction action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AuditLog> logs = auditLogService.getLogsByAction(action, pageable);
        Page<AuditLogResponseDTO> response = logs.map(AuditLogResponseDTO::fromEntity);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get logs by entity
     * 
     * GET /api/admin/audit-logs/entity/{entityName}?page=0&size=20
     */
    @GetMapping("/entity/{entityName}")
    public ResponseEntity<Page<AuditLogResponseDTO>> getLogsByEntity(
            @PathVariable String entityName,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AuditLog> logs = auditLogService.getLogsByEntity(entityName, pageable);
        Page<AuditLogResponseDTO> response = logs.map(AuditLogResponseDTO::fromEntity);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get logs for specific entity instance
     * 
     * GET /api/admin/audit-logs/entity/{entityName}/{entityId}
     */
    @GetMapping("/entity/{entityName}/{entityId}")
    public ResponseEntity<List<AuditLogResponseDTO>> getLogsForEntityInstance(
            @PathVariable String entityName,
            @PathVariable Long entityId
    ) {
        List<AuditLog> logs = auditLogService.getLogsForEntityInstance(entityName, entityId);
        List<AuditLogResponseDTO> response = logs.stream()
                .map(AuditLogResponseDTO::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }
    
    /**
     * Search logs with multiple filters
     * 
     * GET /api/admin/audit-logs/search?username=admin&action=CREATE&entityName=Employee&startDate=2026-01-01T00:00:00&endDate=2026-01-31T23:59:59
     */
    @GetMapping("/search")
    public ResponseEntity<Page<AuditLogResponseDTO>> searchLogs(
            @RequestParam(required = false) String username,
            @RequestParam(required = false) AuditAction action,
            @RequestParam(required = false) String entityName,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<AuditLog> logs = auditLogService.searchLogs(
                username, action, entityName, startDate, endDate, pageable
        );
        Page<AuditLogResponseDTO> response = logs.map(AuditLogResponseDTO::fromEntity);
        return ResponseEntity.ok(response);
    }
    
    /**
     * Get audit statistics
     * 
     * GET /api/admin/audit-logs/statistics
     */
    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Long>> getStatistics() {
        Map<String, Long> stats = auditLogService.getAuditStatistics();
        return ResponseEntity.ok(stats);
    }
    
    /**
     * Get available actions
     * 
     * GET /api/admin/audit-logs/actions
     */
    @GetMapping("/actions")
    public ResponseEntity<List<String>> getAvailableActions() {
        List<String> actions = List.of(
                AuditAction.CREATE.name(),
                AuditAction.UPDATE.name(),
                AuditAction.DELETE.name(),
                AuditAction.LOGIN.name(),
                AuditAction.LOGOUT.name(),
                AuditAction.ACCESS_DENIED.name()
        );
        return ResponseEntity.ok(actions);
    }
}
