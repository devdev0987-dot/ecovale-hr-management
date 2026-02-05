package com.ecovale.hr.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Root Controller for Railway health checks
 * Provides simple health check at root path "/"
 */
@RestController
public class RootController {
    
    /**
     * Root health check endpoint for Railway
     * Returns 200 OK immediately - no dependencies
     */
    @GetMapping("/")
    public String rootHealthCheck() {
        return "OK";
    }
    
    /**
     * Status endpoint with more details
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, String>> status() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "OK");
        response.put("service", "Ecovale HR Backend");
        response.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(response);
    }
}
