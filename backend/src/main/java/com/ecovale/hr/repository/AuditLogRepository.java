package com.ecovale.hr.repository;

import com.ecovale.hr.entity.AuditLog;
import com.ecovale.hr.entity.AuditLog.AuditAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for AuditLog entity
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    
    /**
     * Find all audit logs with pagination
     */
    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);
    
    /**
     * Find logs by username
     */
    Page<AuditLog> findByUsernameOrderByTimestampDesc(String username, Pageable pageable);
    
    /**
     * Find logs by action
     */
    Page<AuditLog> findByActionOrderByTimestampDesc(AuditAction action, Pageable pageable);
    
    /**
     * Find logs by entity name
     */
    Page<AuditLog> findByEntityNameOrderByTimestampDesc(String entityName, Pageable pageable);
    
    /**
     * Find logs by entity and entity ID
     */
    List<AuditLog> findByEntityNameAndEntityIdOrderByTimestampDesc(String entityName, Long entityId);
    
    /**
     * Find logs between dates
     */
    Page<AuditLog> findByTimestampBetweenOrderByTimestampDesc(
            LocalDateTime startDate, 
            LocalDateTime endDate, 
            Pageable pageable
    );
    
    /**
     * Find logs by username and action
     */
    Page<AuditLog> findByUsernameAndActionOrderByTimestampDesc(
            String username, 
            AuditAction action, 
            Pageable pageable
    );
    
    /**
     * Search logs with multiple filters
     */
    @Query("SELECT a FROM AuditLog a WHERE " +
           "(:username IS NULL OR a.username = :username) AND " +
           "(:action IS NULL OR a.action = :action) AND " +
           "(:entityName IS NULL OR a.entityName = :entityName) AND " +
           "(:startDate IS NULL OR a.timestamp >= :startDate) AND " +
           "(:endDate IS NULL OR a.timestamp <= :endDate) " +
           "ORDER BY a.timestamp DESC")
    Page<AuditLog> searchLogs(
            @Param("username") String username,
            @Param("action") AuditAction action,
            @Param("entityName") String entityName,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable
    );
    
    /**
     * Count logs by action
     */
    Long countByAction(AuditAction action);
    
    /**
     * Count logs by username
     */
    Long countByUsername(String username);
    
    /**
     * Count logs created today
     */
    @Query("SELECT COUNT(a) FROM AuditLog a WHERE DATE(a.timestamp) = CURRENT_DATE")
    Long countTodayLogs();
}
