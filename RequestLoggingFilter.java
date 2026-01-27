package com.ecovale.hr.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.Set;

/**
 * Request Logging Filter
 * Logs HTTP requests and responses for debugging and audit
 * NEVER logs passwords or sensitive data
 */
@Slf4j
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {
    
    private static final Set<String> SENSITIVE_HEADERS = Set.of(
            "authorization", "cookie", "set-cookie", "x-api-key"
    );
    
    private static final Set<String> SENSITIVE_PARAMS = Set.of(
            "password", "token", "secret", "apiKey", "api_key"
    );
    
    private static final Set<String> EXCLUDED_PATHS = Set.of(
            "/actuator", "/health", "/swagger", "/v3/api-docs"
    );
    
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        
        // Skip logging for excluded paths
        if (shouldExclude(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }
        
        long startTime = System.currentTimeMillis();
        
        // Wrap request and response for body caching
        ContentCachingRequestWrapper requestWrapper = new ContentCachingRequestWrapper(request);
        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(response);
        
        try {
            // Log request
            logRequest(requestWrapper);
            
            // Continue filter chain
            filterChain.doFilter(requestWrapper, responseWrapper);
            
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            
            // Log response
            logResponse(responseWrapper, duration);
            
            // Copy response body to actual response
            responseWrapper.copyBodyToResponse();
        }
    }
    
    /**
     * Log HTTP request details
     */
    private void logRequest(HttpServletRequest request) {
        if (!log.isDebugEnabled()) {
            return;
        }
        
        StringBuilder logMessage = new StringBuilder();
        logMessage.append("\n=== Incoming Request ===\n");
        logMessage.append(String.format("%s %s\n", request.getMethod(), request.getRequestURI()));
        
        // Log query parameters (filter sensitive ones)
        String queryString = request.getQueryString();
        if (StringUtils.hasText(queryString)) {
            logMessage.append("Query: ").append(sanitizeQueryString(queryString)).append("\n");
        }
        
        // Log headers (filter sensitive ones)
        logMessage.append("Headers:\n");
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            if (!SENSITIVE_HEADERS.contains(headerName.toLowerCase())) {
                logMessage.append(String.format("  %s: %s\n", headerName, request.getHeader(headerName)));
            } else {
                logMessage.append(String.format("  %s: [REDACTED]\n", headerName));
            }
        }
        
        // Log client info
        logMessage.append(String.format("Client IP: %s\n", getClientIP(request)));
        logMessage.append(String.format("User-Agent: %s\n", request.getHeader("User-Agent")));
        
        log.debug(logMessage.toString());
    }
    
    /**
     * Log HTTP response details
     */
    private void logResponse(ContentCachingResponseWrapper response, long duration) {
        if (!log.isDebugEnabled()) {
            return;
        }
        
        StringBuilder logMessage = new StringBuilder();
        logMessage.append("\n=== Outgoing Response ===\n");
        logMessage.append(String.format("Status: %d\n", response.getStatus()));
        logMessage.append(String.format("Duration: %d ms\n", duration));
        
        // Log response headers (filter sensitive ones)
        logMessage.append("Headers:\n");
        response.getHeaderNames().forEach(headerName -> {
            if (!SENSITIVE_HEADERS.contains(headerName.toLowerCase())) {
                logMessage.append(String.format("  %s: %s\n", headerName, response.getHeader(headerName)));
            } else {
                logMessage.append(String.format("  %s: [REDACTED]\n", headerName));
            }
        });
        
        log.debug(logMessage.toString());
        
        // Log warning for slow requests
        if (duration > 3000) {
            log.warn("Slow request detected: {} ms", duration);
        }
    }
    
    /**
     * Sanitize query string to hide sensitive parameters
     */
    private String sanitizeQueryString(String queryString) {
        String[] params = queryString.split("&");
        StringBuilder sanitized = new StringBuilder();
        
        for (String param : params) {
            String[] keyValue = param.split("=");
            if (keyValue.length == 2) {
                String key = keyValue[0].toLowerCase();
                String value = keyValue[1];
                
                if (SENSITIVE_PARAMS.contains(key)) {
                    sanitized.append(keyValue[0]).append("=[REDACTED]&");
                } else {
                    sanitized.append(param).append("&");
                }
            }
        }
        
        return sanitized.length() > 0 ? sanitized.substring(0, sanitized.length() - 1) : "";
    }
    
    /**
     * Get client IP address considering proxy headers
     */
    private String getClientIP(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (!StringUtils.hasText(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (!StringUtils.hasText(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }
    
    /**
     * Check if path should be excluded from logging
     */
    private boolean shouldExclude(String path) {
        return EXCLUDED_PATHS.stream().anyMatch(path::startsWith);
    }
}
