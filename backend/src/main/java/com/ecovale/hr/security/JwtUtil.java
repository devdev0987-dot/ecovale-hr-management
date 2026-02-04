package com.ecovale.hr.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * JWT Utility for token generation and validation
 * Enhanced with expiration handling and security features
 */
@Slf4j
@Component
public class JwtUtil {
    
    @Value("${jwt.secret:ecovale-hr-secret-key-change-in-production-minimum-32-characters}")
    private String secret;
    
    @Value("${jwt.expiration:86400000}") // 24 hours in milliseconds
    private Long expiration;
    
    @Value("${jwt.refresh.expiration:604800000}") // 7 days in milliseconds
    private Long refreshExpiration;
    
    /**
     * Generate JWT token for user
     */
    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        return createToken(claims, userDetails.getUsername(), expiration);
    }
    
    /**
     * Generate token with custom claims
     */
    public String generateToken(UserDetails userDetails, Map<String, Object> extraClaims) {
        Map<String, Object> claims = new HashMap<>(extraClaims);
        return createToken(claims, userDetails.getUsername(), expiration);
    }
    
    /**
     * Generate refresh token with longer expiration
     */
    public String generateRefreshToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("type", "refresh");
        return createToken(claims, userDetails.getUsername(), refreshExpiration);
    }
    
    /**
     * Create JWT token
     */
    private String createToken(Map<String, Object> claims, String subject, Long expirationTime) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationTime);
        
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(now)
                .setExpiration(expiryDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }
    
    /**
     * Extract username from token
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }
    
    /**
     * Extract expiration date from token
     */
    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }
    
    /**
     * Extract issued at date from token
     */
    public Date extractIssuedAt(String token) {
        return extractClaim(token, Claims::getIssuedAt);
    }
    
    /**
     * Get time until token expiration in milliseconds
     */
    public Long getTimeUntilExpiration(String token) {
        try {
            Date expiration = extractExpiration(token);
            return expiration.getTime() - System.currentTimeMillis();
        } catch (ExpiredJwtException ex) {
            return 0L;
        }
    }
    
    /**
     * Get time until token expiration in seconds
     */
    public Long getSecondsUntilExpiration(String token) {
        return getTimeUntilExpiration(token) / 1000;
    }
    
    /**
     * Check if token will expire within specified minutes
     */
    public Boolean willExpireSoon(String token, int minutes) {
        Long timeUntilExpiration = getTimeUntilExpiration(token);
        Long thresholdMillis = (long) minutes * 60 * 1000;
        return timeUntilExpiration < thresholdMillis;
    }
    
    /**
     * Extract specific claim from token
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }
    
    /**
     * Extract all claims from token
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
    
    /**
     * Check if token is expired
     */
    public Boolean isTokenExpired(String token) {
        try {
            return extractExpiration(token).before(new Date());
        } catch (ExpiredJwtException ex) {
            log.warn("Token is expired: {}", ex.getMessage());
            return true;
        }
    }
    
    /**
     * Validate token against user details
     */
    public Boolean validateToken(String token, UserDetails userDetails) {
        try {
            final String username = extractUsername(token);
            return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
        } catch (ExpiredJwtException ex) {
            log.error("Token validation failed - token expired: {}", ex.getMessage());
            throw ex; // Re-throw to be caught by filter
        } catch (Exception ex) {
            log.error("Token validation failed: {}", ex.getMessage());
            return false;
        }
    }
    
    /**
     * Validate refresh token
     */
    public Boolean validateRefreshToken(String token) {
        try {
            Claims claims = extractAllClaims(token);
            return "refresh".equals(claims.get("type")) && !isTokenExpired(token);
        } catch (Exception ex) {
            log.error("Refresh token validation failed: {}", ex.getMessage());
            return false;
        }
    }
    
    /**
     * Get signing key from secret
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
    
    /**
     * Get token expiration time in milliseconds
     */
    public Long getExpirationTime() {
        return expiration;
    }
    
    /**
     * Get refresh token expiration time in milliseconds
     */
    public Long getRefreshExpirationTime() {
        return refreshExpiration;
    }
}
