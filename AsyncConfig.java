package com.ecovale.hr.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Configuration for async operations
 * Enables async audit logging
 */
@Configuration
@EnableAsync
public class AsyncConfig {
    // Spring Boot auto-configures a default task executor
}
