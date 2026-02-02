package com.ecovale.hr.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS Configuration - Production Ready
 * Allows frontend (GitHub Pages, Vercel, Netlify) to access backend APIs
 * Configure via CORS_ALLOWED_ORIGINS environment variable
 */
@Configuration
public class CorsConfig {

    @Value("${cors.allowed.origins:http://localhost:3000,http://localhost:5173}")
    private String allowedOrigins;

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                String[] origins = allowedOrigins.split(",");
                
                registry.addMapping("/api/**")
                        .allowedOrigins(origins)
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                        .allowedHeaders("*")
                        .exposedHeaders("Authorization", "X-Total-Count")
                        .allowCredentials(true)
                        .maxAge(3600);
                        
                // Public endpoints (health check, swagger)
                registry.addMapping("/actuator/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET")
                        .allowCredentials(false);
                        
                registry.addMapping("/swagger-ui/**", "/v3/api-docs/**")
                        .allowedOrigins("*")
                        .allowedMethods("GET")
                        .allowCredentials(false);
            }
        };
    }
}
