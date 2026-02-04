package com.ecovale.hr.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate Limiting Filter for Authentication Endpoints
 * Prevents brute force attacks by limiting login attempts
 * Uses Token Bucket algorithm (Bucket4j)
 */
@Slf4j
@Component
public class RateLimitingFilter extends OncePerRequestFilter {
    
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // Rate limit configuration
    private static final int LOGIN_CAPACITY = 5;           // 5 requests
    private static final Duration LOGIN_REFILL_DURATION = Duration.ofMinutes(1);  // per minute
    
    private static final int REGISTER_CAPACITY = 3;        // 3 requests
    private static final Duration REGISTER_REFILL_DURATION = Duration.ofMinutes(5); // per 5 minutes
    
    private static final int GENERAL_CAPACITY = 20;        // 20 requests
    private static final Duration GENERAL_REFILL_DURATION = Duration.ofMinutes(1); // per minute
    
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        
        String path = request.getRequestURI();
        String clientIP = getClientIP(request);
        
        // Only apply rate limiting to authentication endpoints
        if (!path.startsWith("/api/auth")) {
            filterChain.doFilter(request, response);
            return;
        }
        
        // Get or create bucket for this client
        String bucketKey = clientIP + ":" + path;
        Bucket bucket = buckets.computeIfAbsent(bucketKey, k -> createBucket(path));
        
        // Try to consume a token
        if (bucket.tryConsume(1)) {
            // Token available - allow request
            filterChain.doFilter(request, response);
        } else {
            // Rate limit exceeded
            log.warn("Rate limit exceeded for IP: {} on path: {}", clientIP, path);
            sendRateLimitResponse(response, path);
        }
    }
    
    /**
     * Create rate limit bucket based on endpoint
     */
    private Bucket createBucket(String path) {
        Bandwidth limit;
        
        if (path.contains("/login")) {
            // Stricter limit for login endpoint
            limit = Bandwidth.builder()
                    .capacity(LOGIN_CAPACITY)
                    .refillIntervally(LOGIN_CAPACITY, LOGIN_REFILL_DURATION)
                    .build();
        } else if (path.contains("/register")) {
            // Moderate limit for registration
            limit = Bandwidth.builder()
                    .capacity(REGISTER_CAPACITY)
                    .refillIntervally(REGISTER_CAPACITY, REGISTER_REFILL_DURATION)
                    .build();
        } else {
            // General limit for other auth endpoints
            limit = Bandwidth.builder()
                    .capacity(GENERAL_CAPACITY)
                    .refillIntervally(GENERAL_CAPACITY, GENERAL_REFILL_DURATION)
                    .build();
        }
        
        return Bucket.builder()
                .addLimit(limit)
                .build();
    }
    
    /**
     * Send rate limit exceeded response
     */
    private void sendRateLimitResponse(HttpServletResponse response, String path) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        
        Map<String, Object> errorDetails = new HashMap<>();
        errorDetails.put("timestamp", LocalDateTime.now().toString());
        errorDetails.put("status", HttpStatus.TOO_MANY_REQUESTS.value());
        errorDetails.put("error", "Too Many Requests");
        errorDetails.put("message", getRateLimitMessage(path));
        errorDetails.put("path", path);
        
        // Add retry-after header
        if (path.contains("/login")) {
            response.setHeader("Retry-After", "60"); // 1 minute
        } else if (path.contains("/register")) {
            response.setHeader("Retry-After", "300"); // 5 minutes
        } else {
            response.setHeader("Retry-After", "60"); // 1 minute
        }
        
        response.getOutputStream().write(objectMapper.writeValueAsBytes(errorDetails));
    }
    
    /**
     * Get appropriate rate limit message
     */
    private String getRateLimitMessage(String path) {
        if (path.contains("/login")) {
            return "Too many login attempts. Please try again in 1 minute.";
        } else if (path.contains("/register")) {
            return "Too many registration attempts. Please try again in 5 minutes.";
        }
        return "Rate limit exceeded. Please try again later.";
    }
    
    /**
     * Get client IP address considering proxy headers
     */
    private String getClientIP(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // Handle multiple IPs in X-Forwarded-For
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
