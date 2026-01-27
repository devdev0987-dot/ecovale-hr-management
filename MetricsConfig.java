package com.ecovale.hr.config;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.actuate.metrics.web.servlet.WebMvcTagsContributor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import io.micrometer.core.aop.TimedAspect;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Tag;
import io.micrometer.core.instrument.Tags;
import org.springframework.boot.actuate.autoconfigure.metrics.MeterRegistryCustomizer;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Metrics Configuration
 * Configures Micrometer metrics and Prometheus integration
 */
@Configuration
public class MetricsConfig {
    
    /**
     * Customize meter registry with common tags
     */
    @Bean
    public MeterRegistryCustomizer<MeterRegistry> metricsCommonTags() {
        return registry -> registry.config()
                .commonTags(
                        "application", "ecovale-hr",
                        "environment", System.getProperty("spring.profiles.active", "unknown")
                );
    }
    
    /**
     * Enable @Timed annotation support
     */
    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }
    
    /**
     * Custom business metrics
     */
    @Bean
    public CustomMetrics customMetrics(MeterRegistry registry) {
        return new CustomMetrics(registry);
    }
    
    /**
     * Custom business metrics class
     */
    public static class CustomMetrics {
        
        private final MeterRegistry registry;
        private final AtomicLong activeUsers;
        private final AtomicLong activeEmployees;
        
        public CustomMetrics(MeterRegistry registry) {
            this.registry = registry;
            
            // Register gauges
            this.activeUsers = registry.gauge("ecovale.users.active", new AtomicLong(0));
            this.activeEmployees = registry.gauge("ecovale.employees.active", new AtomicLong(0));
        }
        
        /**
         * Record authentication attempt
         */
        public void recordAuthAttempt(String status) {
            Metrics.counter("ecovale.auth.attempts", 
                    "status", status).increment();
        }
        
        /**
         * Record employee operation
         */
        public void recordEmployeeOperation(String operation) {
            Metrics.counter("ecovale.employees.operations",
                    "operation", operation).increment();
        }
        
        /**
         * Record database query time
         */
        public void recordDatabaseQuery(String entity, long durationMs) {
            Metrics.timer("ecovale.database.query",
                    "entity", entity)
                    .record(java.time.Duration.ofMillis(durationMs));
        }
        
        /**
         * Update active users count
         */
        public void setActiveUsers(long count) {
            activeUsers.set(count);
        }
        
        /**
         * Update active employees count
         */
        public void setActiveEmployees(long count) {
            activeEmployees.set(count);
        }
    }
}
