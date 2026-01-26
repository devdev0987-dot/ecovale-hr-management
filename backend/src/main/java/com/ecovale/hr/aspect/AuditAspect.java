package com.ecovale.hr.aspect;

import com.ecovale.hr.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

/**
 * AOP Aspect for automatic audit logging
 * Captures CREATE, UPDATE, DELETE operations on service layer
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {
    
    private final AuditLogService auditLogService;
    
    /**
     * Pointcut for all service methods
     */
    @Pointcut("execution(* com.ecovale.hr.service.*.save*(..)) || " +
              "execution(* com.ecovale.hr.service.*.create*(..)) || " +
              "execution(* com.ecovale.hr.service.*.add*(..))")
    public void createOperations() {}
    
    @Pointcut("execution(* com.ecovale.hr.service.*.update*(..)) || " +
              "execution(* com.ecovale.hr.service.*.modify*(..))")
    public void updateOperations() {}
    
    @Pointcut("execution(* com.ecovale.hr.service.*.delete*(..)) || " +
              "execution(* com.ecovale.hr.service.*.remove*(..))")
    public void deleteOperations() {}
    
    /**
     * Log CREATE operations
     */
    @AfterReturning(pointcut = "createOperations()", returning = "result")
    public void logCreateOperation(JoinPoint joinPoint, Object result) {
        try {
            String entityName = extractEntityName(joinPoint);
            Long entityId = extractEntityId(result);
            
            if (entityId != null) {
                auditLogService.logCreate(entityName, entityId, result);
                log.debug("Logged CREATE operation for {} #{}", entityName, entityId);
            }
        } catch (Exception e) {
            log.error("Error logging CREATE operation", e);
        }
    }
    
    /**
     * Log UPDATE operations
     */
    @AfterReturning(pointcut = "updateOperations()", returning = "result")
    public void logUpdateOperation(JoinPoint joinPoint, Object result) {
        try {
            String entityName = extractEntityName(joinPoint);
            Long entityId = extractEntityId(result);
            Object oldEntity = joinPoint.getArgs().length > 0 ? joinPoint.getArgs()[0] : null;
            
            if (entityId != null) {
                auditLogService.logUpdate(entityName, entityId, oldEntity, result);
                log.debug("Logged UPDATE operation for {} #{}", entityName, entityId);
            }
        } catch (Exception e) {
            log.error("Error logging UPDATE operation", e);
        }
    }
    
    /**
     * Log DELETE operations
     */
    @AfterReturning(pointcut = "deleteOperations()")
    public void logDeleteOperation(JoinPoint joinPoint) {
        try {
            String entityName = extractEntityName(joinPoint);
            Long entityId = extractEntityIdFromArgs(joinPoint.getArgs());
            
            if (entityId != null) {
                auditLogService.logDelete(entityName, entityId, "Deleted");
                log.debug("Logged DELETE operation for {} #{}", entityName, entityId);
            }
        } catch (Exception e) {
            log.error("Error logging DELETE operation", e);
        }
    }
    
    /**
     * Extract entity name from service class name
     */
    private String extractEntityName(JoinPoint joinPoint) {
        String className = joinPoint.getTarget().getClass().getSimpleName();
        // Remove "Service" suffix and "Impl" suffix if present
        className = className.replace("Service", "").replace("Impl", "");
        return className;
    }
    
    /**
     * Extract entity ID from result object
     */
    private Long extractEntityId(Object result) {
        if (result == null) {
            return null;
        }
        
        // Handle ResponseEntity wrapper
        if (result instanceof ResponseEntity) {
            result = ((ResponseEntity<?>) result).getBody();
        }
        
        // Try to get ID using reflection
        try {
            Method getIdMethod = result.getClass().getMethod("getId");
            Object id = getIdMethod.invoke(result);
            if (id instanceof Long) {
                return (Long) id;
            } else if (id instanceof Integer) {
                return ((Integer) id).longValue();
            } else if (id instanceof String) {
                return Long.parseLong((String) id);
            }
        } catch (Exception e) {
            log.debug("Could not extract ID from result", e);
        }
        
        return null;
    }
    
    /**
     * Extract entity ID from method arguments (for delete operations)
     */
    private Long extractEntityIdFromArgs(Object[] args) {
        if (args == null || args.length == 0) {
            return null;
        }
        
        // First argument is usually the ID
        Object firstArg = args[0];
        if (firstArg instanceof Long) {
            return (Long) firstArg;
        } else if (firstArg instanceof Integer) {
            return ((Integer) firstArg).longValue();
        } else if (firstArg instanceof String) {
            try {
                return Long.parseLong((String) firstArg);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        
        return null;
    }
}
