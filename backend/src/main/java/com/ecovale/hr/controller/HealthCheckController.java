package com.ecovale.hr.controller;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;

/**
 * Health Check Controller for monitoring and uptime tracking
 * Provides custom health endpoints beyond Spring Boot Actuator
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthCheckController {
    
    private final LocalDateTime startupTime = LocalDateTime.now();
    
    /**
     * Root health check endpoint for Railway
     * Returns 200 OK with simple "OK" response
     */
    @GetMapping("/")
    public ResponseEntity<String> rootHealthCheck() {
        return ResponseEntity.ok("OK");
    }
    
    /**
     * Basic health check endpoint
     * Returns 200 OK if the application is running
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", LocalDateTime.now().toString());
        health.put("uptime", getUptime());
        health.put("timezone", ZoneId.systemDefault().toString());
        
        return ResponseEntity.ok(health);
    }
    
    /**
     * Readiness probe for Kubernetes/Cloud platforms
     * Returns 200 when the application is ready to accept traffic
     */
    @GetMapping("/ready")
    public ResponseEntity<Map<String, String>> readinessProbe() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "READY");
        response.put("message", "Application is ready to accept requests");
        return ResponseEntity.ok(response);
    }
    
    /**
     * Liveness probe for Kubernetes/Cloud platforms
     * Returns 200 when the application is alive
     */
    @GetMapping("/live")
    public ResponseEntity<Map<String, String>> livenessProbe() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "ALIVE");
        response.put("message", "Application is running");
        return ResponseEntity.ok(response);
    }
    
    /**
     * Version and build info endpoint
     */
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> info() {
        Map<String, Object> info = new HashMap<>();
        info.put("application", "Ecovale HR Management System");
        info.put("version", "1.0.0");
        info.put("build", "2026-01-26");
        info.put("java", System.getProperty("java.version"));
        info.put("startupTime", startupTime.toString());
        info.put("uptime", getUptime());
        
        return ResponseEntity.ok(info);
    }
    
    /**
     * Calculate uptime since application started
     */
    private String getUptime() {
        long seconds = java.time.Duration.between(startupTime, LocalDateTime.now()).getSeconds();
        long days = seconds / 86400;
        long hours = (seconds % 86400) / 3600;
        long minutes = (seconds % 3600) / 60;
        long secs = seconds % 60;
        
        return String.format("%dd %dh %dm %ds", days, hours, minutes, secs);
    }
}
