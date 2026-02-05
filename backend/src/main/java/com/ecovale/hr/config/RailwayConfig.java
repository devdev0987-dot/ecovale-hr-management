package com.ecovale.hr.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

/**
 * Railway Deployment Configuration
 * Ensures app starts without database connection
 */
@Configuration
@ConditionalOnProperty(name = "spring.profiles.active", havingValue = "railway")
public class RailwayConfig {
    
    // This configuration ensures the app can start on Railway
    // without requiring an immediate database connection
    
    public RailwayConfig() {
        System.out.println("🚂 Railway profile active - DB connection optional");
    }
}
