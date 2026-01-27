package com.ecovale.hr.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * JWT Authentication Entry Point
 * Handles authentication errors and returns proper JSON responses
 */
@Slf4j
@Component
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException, ServletException {
        
        log.error("Unauthorized access attempt: {}", authException.getMessage());
        
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        
        Map<String, Object> errorDetails = new HashMap<>();
        errorDetails.put("timestamp", LocalDateTime.now().toString());
        errorDetails.put("status", HttpStatus.UNAUTHORIZED.value());
        errorDetails.put("error", "Unauthorized");
        errorDetails.put("message", determineErrorMessage(request, authException));
        errorDetails.put("path", request.getRequestURI());
        
        response.getOutputStream().write(objectMapper.writeValueAsBytes(errorDetails));
    }
    
    /**
     * Determine appropriate error message based on the exception
     */
    private String determineErrorMessage(HttpServletRequest request, AuthenticationException authException) {
        String expiredAttribute = (String) request.getAttribute("expired");
        String invalidAttribute = (String) request.getAttribute("invalid");
        
        if ("true".equals(expiredAttribute)) {
            return "JWT token has expired. Please login again.";
        } else if ("true".equals(invalidAttribute)) {
            return "Invalid JWT token. Please login again.";
        } else if (request.getHeader("Authorization") == null) {
            return "Authentication required. Please provide a valid JWT token.";
        }
        
        return "Authentication failed: " + authException.getMessage();
    }
}
