package com.ecovale.hr.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * OpenAPI 3.0 Configuration for API Documentation
 * 
 * Provides Swagger UI at: /swagger-ui.html
 * OpenAPI JSON at: /v3/api-docs
 * 
 * @author Ecovale HR Team
 * @version 1.0.0
 * @since 2026-01-26
 */
@Configuration
public class OpenApiConfig {
    
    @Value("${app.version:1.0.0}")
    private String appVersion;
    
    @Value("${server.port:8080}")
    private String serverPort;
    
    private static final String SECURITY_SCHEME_NAME = "Bearer Authentication";
    
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(apiInfo())
            .servers(apiServers())
            .components(securityComponents())
            .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME));
    }
    
    /**
     * API Information
     */
    private Info apiInfo() {
        return new Info()
            .title("Ecovale HR Management System API")
            .version("v1")
            .description("""
                # Ecovale HR Management REST API Documentation
                
                ## Overview
                This is the REST API for Ecovale HR Management System providing comprehensive 
                employee management, payroll, attendance, leave management, and audit capabilities.
                
                ## API Versioning
                All endpoints are versioned under `/api/v1` prefix. This allows us to:
                - Maintain backward compatibility
                - Introduce breaking changes in new versions without affecting existing clients
                - Provide clear migration paths for API consumers
                
                ## Authentication
                This API uses JWT (JSON Web Token) for authentication:
                1. Obtain token from `/api/v1/auth/login` endpoint
                2. Include token in Authorization header: `Authorization: Bearer <token>`
                3. Access tokens expire after 24 hours
                4. Refresh tokens valid for 7 days
                
                ## Rate Limiting
                - 100 requests per minute per IP address
                - 429 Too Many Requests response when limit exceeded
                
                ## Response Format
                All responses follow standard format:
                ```json
                {
                  "success": true,
                  "message": "Operation successful",
                  "data": { ... }
                }
                ```
                
                ## Error Handling
                Error responses include:
                - HTTP status code
                - Error message
                - Timestamp
                - Path that caused error
                
                ## Deprecation Policy
                - Deprecated endpoints marked with `@Deprecated` annotation
                - Sunset header indicates removal date
                - Migration guide provided in documentation
                - Minimum 6 months notice before endpoint removal
                """)
            .contact(new Contact()
                .name("Ecovale HR Support")
                .email("hr-support@ecovale.com")
                .url("https://ecovale.com/support"))
            .license(new License()
                .name("Proprietary")
                .url("https://ecovale.com/license"));
    }
    
    /**
     * API Servers Configuration
     */
    private List<Server> apiServers() {
        return List.of(
            new Server()
                .url("http://localhost:" + serverPort)
                .description("Local Development Server"),
            new Server()
                .url("https://api-dev.ecovale.com")
                .description("Development Environment"),
            new Server()
                .url("https://api-staging.ecovale.com")
                .description("Staging Environment"),
            new Server()
                .url("https://api.ecovale.com")
                .description("Production Environment")
        );
    }
    
    /**
     * Security Components (JWT Authentication)
     */
    private Components securityComponents() {
        return new Components()
            .addSecuritySchemes(SECURITY_SCHEME_NAME,
                new SecurityScheme()
                    .name(SECURITY_SCHEME_NAME)
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("""
                        JWT Authorization header using Bearer scheme.
                        
                        Enter your JWT token in the text input below.
                        
                        Example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                        """));
    }
}
