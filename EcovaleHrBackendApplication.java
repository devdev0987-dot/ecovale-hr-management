package com.ecovale.hr;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Main Application class for Ecovale HR Backend
 * 
 * Spring Boot application entry point
 * 
 * @author Ecovale Development Team
 * @version 1.0.0
 */
@SpringBootApplication
public class EcovaleHrBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(EcovaleHrBackendApplication.class, args);
        System.out.println("\n===========================================");
        System.out.println("🚀 Ecovale HR Backend Server Started!");
        System.out.println("📍 API Base URL: http://localhost:8080/api");
        System.out.println("📊 Health Check: http://localhost:8080/actuator/health");
        System.out.println("===========================================\n");
    }
}
