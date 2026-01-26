package com.ecovale.hr.service;

import com.ecovale.hr.entity.AuditLog;
import com.ecovale.hr.entity.AuditLog.AuditAction;
import com.ecovale.hr.repository.AuditLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for managing audit logs
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {
    
    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;
    
    /**
     * Log an action asynchronously
     */
    @Async
    @Transactional
    public void logAction(AuditAction action, String entityName, Long entityId, Object details) {
        try {
            String username = getCurrentUsername();
            String detailsJson = convertDetailsToJson(details);
            HttpServletRequest request = getCurrentRequest();
            
            AuditLog auditLog = new AuditLog();
            auditLog.setUsername(username);
            auditLog.setAction(action);
            auditLog.setEntityName(entityName);
            auditLog.setEntityId(entityId);
            auditLog.setDetails(detailsJson);
            auditLog.setTimestamp(LocalDateTime.now());
            
            if (request != null) {
                auditLog.setIpAddress(getClientIP(request));
                auditLog.setUserAgent(request.getHeader("User-Agent"));
            }
            
            auditLogRepository.save(auditLog);
            log.debug("Audit log created: {} {} on {} #{}", username, action, entityName, entityId);
            
        } catch (Exception e) {
            log.error("Failed to create audit log", e);
        }
    }
    
    /**
     * Log CREATE action
     */
    public void logCreate(String entityName, Long entityId, Object entity) {
        logAction(AuditAction.CREATE, entityName, entityId, entity);
    }
    
    /**
     * Log UPDATE action
     */
    public void logUpdate(String entityName, Long entityId, Object oldEntity, Object newEntity) {
        Map<String, Object> details = new HashMap<>();
        details.put("old", oldEntity);
        details.put("new", newEntity);
        logAction(AuditAction.UPDATE, entityName, entityId, details);
    }
    
    /**
     * Log DELETE action
     */
    public void logDelete(String entityName, Long entityId, Object entity) {
        logAction(AuditAction.DELETE, entityName, entityId, entity);
    }
    
    /**
     * Log LOGIN action
     */
    public void logLogin(String username) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUsername(username);
        auditLog.setAction(AuditAction.LOGIN);
        auditLog.setEntityName("User");
        auditLog.setEntityId(0L);
        auditLog.setDetails("User logged in");
        auditLog.setTimestamp(LocalDateTime.now());
        
        HttpServletRequest request = getCurrentRequest();
        if (request != null) {
            auditLog.setIpAddress(getClientIP(request));
            auditLog.setUserAgent(request.getHeader("User-Agent"));
        }
        
        auditLogRepository.save(auditLog);
    }
    
    /**
     * Log LOGOUT action
     */
    public void logLogout(String username) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUsername(username);
        auditLog.setAction(AuditAction.LOGOUT);
        auditLog.setEntityName("User");
        auditLog.setEntityId(0L);
        auditLog.setDetails("User logged out");
        auditLog.setTimestamp(LocalDateTime.now());
        
        HttpServletRequest request = getCurrentRequest();
        if (request != null) {
            auditLog.setIpAddress(getClientIP(request));
            auditLog.setUserAgent(request.getHeader("User-Agent"));
        }
        
        auditLogRepository.save(auditLog);
    }
    
    /**
     * Log ACCESS_DENIED action
     */
    public void logAccessDenied(String resource) {
        String username = getCurrentUsername();
        AuditLog auditLog = new AuditLog();
        auditLog.setUsername(username);
        auditLog.setAction(AuditAction.ACCESS_DENIED);
        auditLog.setEntityName(resource);
        auditLog.setEntityId(0L);
        auditLog.setDetails("Access denied to resource");
        auditLog.setTimestamp(LocalDateTime.now());
        
        HttpServletRequest request = getCurrentRequest();
        if (request != null) {
            auditLog.setIpAddress(getClientIP(request));
            auditLog.setUserAgent(request.getHeader("User-Agent"));
        }
        
        auditLogRepository.save(auditLog);
    }
    
    /**
     * Get all audit logs with pagination
     */
    @Transactional(readOnly = true)
    public Page<AuditLog> getAllLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByTimestampDesc(pageable);
    }
    
    /**
     * Get logs by username
     */
    @Transactional(readOnly = true)
    public Page<AuditLog> getLogsByUsername(String username, Pageable pageable) {
        return auditLogRepository.findByUsernameOrderByTimestampDesc(username, pageable);
    }
    
    /**
     * Get logs by action
     */
    @Transactional(readOnly = true)
    public Page<AuditLog> getLogsByAction(AuditAction action, Pageable pageable) {
        return auditLogRepository.findByActionOrderByTimestampDesc(action, pageable);
    }
    
    /**
     * Get logs by entity
     */
    @Transactional(readOnly = true)
    public Page<AuditLog> getLogsByEntity(String entityName, Pageable pageable) {
        return auditLogRepository.findByEntityNameOrderByTimestampDesc(entityName, pageable);
    }
    
    /**
     * Get logs for specific entity instance
     */
    @Transactional(readOnly = true)
    public List<AuditLog> getLogsForEntityInstance(String entityName, Long entityId) {
        return auditLogRepository.findByEntityNameAndEntityIdOrderByTimestampDesc(entityName, entityId);
    }
    
    /**
     * Search logs with filters
     */
    @Transactional(readOnly = true)
    public Page<AuditLog> searchLogs(
            String username,
            AuditAction action,
            String entityName,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Pageable pageable
    ) {
        return auditLogRepository.searchLogs(username, action, entityName, startDate, endDate, pageable);
    }
    
    /**
     * Get audit statistics
     */
    @Transactional(readOnly = true)
    public Map<String, Long> getAuditStatistics() {
        Map<String, Long> stats = new HashMap<>();
        stats.put("total", auditLogRepository.count());
        stats.put("today", auditLogRepository.countTodayLogs());
        stats.put("creates", auditLogRepository.countByAction(AuditAction.CREATE));
        stats.put("updates", auditLogRepository.countByAction(AuditAction.UPDATE));
        stats.put("deletes", auditLogRepository.countByAction(AuditAction.DELETE));
        stats.put("logins", auditLogRepository.countByAction(AuditAction.LOGIN));
        return stats;
    }
    
    /**
     * Get current authenticated username
     */
    private String getCurrentUsername() {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                return authentication.getName();
            }
        } catch (Exception e) {
            log.debug("Could not get authenticated username", e);
        }
        return "system";
    }
    
    /**
     * Get current HTTP request
     */
    private HttpServletRequest getCurrentRequest() {
        try {
            ServletRequestAttributes attributes = 
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attributes != null ? attributes.getRequest() : null;
        } catch (Exception e) {
            return null;
        }
    }
    
    /**
     * Get client IP address
     */
    private String getClientIP(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
    
    /**
     * Convert details object to JSON string
     */
    private String convertDetailsToJson(Object details) {
        if (details == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException e) {
            log.error("Failed to convert details to JSON", e);
            return details.toString();
        }
    }
}
