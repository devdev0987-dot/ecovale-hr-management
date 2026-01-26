package com.ecovale.hr.dto;

import com.ecovale.hr.entity.AuditLog;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for AuditLog response
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponseDTO {
    
    private Long id;
    private String username;
    private String action;
    private String entityName;
    private Long entityId;
    private String details;
    private LocalDateTime timestamp;
    private String ipAddress;
    private String userAgent;
    
    /**
     * Convert entity to DTO
     */
    public static AuditLogResponseDTO fromEntity(AuditLog auditLog) {
        AuditLogResponseDTO dto = new AuditLogResponseDTO();
        dto.setId(auditLog.getId());
        dto.setUsername(auditLog.getUsername());
        dto.setAction(auditLog.getAction().name());
        dto.setEntityName(auditLog.getEntityName());
        dto.setEntityId(auditLog.getEntityId());
        dto.setDetails(auditLog.getDetails());
        dto.setTimestamp(auditLog.getTimestamp());
        dto.setIpAddress(auditLog.getIpAddress());
        dto.setUserAgent(auditLog.getUserAgent());
        return dto;
    }
}
