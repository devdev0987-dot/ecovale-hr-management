package com.ecovale.hr.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Minimal Security Configuration for Railway deployment
 * Used when database is unavailable - allows healthcheck endpoints only
 * 
 * Activated by: spring.profiles.active=railway or railway.minimal-security=true
 */
@Configuration
@EnableWebSecurity
@ConditionalOnProperty(
    name = "railway.minimal-security",
    havingValue = "true",
    matchIfMissing = false
)
public class MinimalSecurityConfig {
    
    /**
     * Minimal security filter chain - permits healthcheck endpoints only
     */
    @Bean
    public SecurityFilterChain minimalFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> 
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/status", "/actuator/**").permitAll()
                        .anyRequest().denyAll()
                );
        
        return http.build();
    }
}
