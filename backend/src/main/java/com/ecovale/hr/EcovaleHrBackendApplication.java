package com.ecovale.hr;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import java.util.HashMap;
import java.util.Map;

/**
 * Main Application class for Ecovale HR Backend
 * 
 * Spring Boot application entry point with basic health endpoints for Railway
 * CRITICAL: Excludes DataSource/JPA/Security auto-configuration and excludes packages requiring DB
 * 
 * @author Ecovale Development Team
 * @version 1.0.0
 */
@SpringBootApplication(exclude = {
    DataSourceAutoConfiguration.class,
    HibernateJpaAutoConfiguration.class,
    DataSourceTransactionManagerAutoConfiguration.class,
    SecurityAutoConfiguration.class
})
@ComponentScan(
    basePackages = "com.ecovale.hr",
    excludeFilters = {
        @ComponentScan.Filter(
            type = FilterType.REGEX,
            pattern = "com\\.ecovale\\.hr\\.(security|repository|service|controller|aspect).*"
        ),
        @ComponentScan.Filter(
            type = FilterType.REGEX,
            pattern = "com\\.ecovale\\.hr\\.config\\.(?!MinimalSecurityConfig).*"
        )
    }
)
@RestController
public class EcovaleHrBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(EcovaleHrBackendApplication.class, args);
    }
    
    /**
     * Simple root endpoint for Railway healthcheck
     * Returns 200 OK without requiring database connection
     */
    @GetMapping("/")
    public ResponseEntity<String> root() {
        return ResponseEntity.ok("Ecovale HR Backend is running");
    }
    
    /**
     * Status endpoint for Railway healthcheck
     * Returns JSON status without database dependency
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        Map<String, Object> status = new HashMap<>();
        status.put("status", "UP");
        status.put("application", "Ecovale HR Backend");
        status.put("version", "1.0.0");
        status.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(status);
    }
}
