package com.ecovale.hr.util;

import org.springframework.http.HttpHeaders;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Utility class for API deprecation management
 * 
 * Provides helper methods to add deprecation headers to API responses
 * following RFC 8594 (Sunset HTTP Header) and best practices.
 * 
 * @author Ecovale HR Team
 * @version 1.0.0
 * @since 2026-01-26
 */
public class DeprecationUtil {
    
    // RFC 1123 date format for HTTP headers
    private static final DateTimeFormatter HTTP_DATE_FORMAT = 
        DateTimeFormatter.RFC_1123_DATE_TIME;
    
    /**
     * Add deprecation headers to response
     * 
     * @param headers HttpHeaders to add deprecation info to
     * @param sunsetDate Date when endpoint will be removed
     * @param alternativeUrl URL of replacement endpoint
     * @param message Custom deprecation message
     */
    public static void addDeprecationHeaders(
            HttpHeaders headers,
            ZonedDateTime sunsetDate,
            String alternativeUrl,
            String message) {
        
        // RFC 8594 Sunset header
        headers.add("Sunset", sunsetDate.format(HTTP_DATE_FORMAT));
        
        // Deprecation header (draft RFC)
        headers.add("Deprecation", "true");
        
        // Link header pointing to alternative (RFC 8288)
        if (alternativeUrl != null && !alternativeUrl.isEmpty()) {
            headers.add("Link", String.format("<%s>; rel=\"alternate\"", alternativeUrl));
        }
        
        // Custom deprecation message
        if (message != null && !message.isEmpty()) {
            headers.add("X-API-Deprecation-Message", message);
        }
        
        // API version that introduced deprecation
        headers.add("X-API-Deprecation-Version", "v1");
        
        // Warning header (RFC 7234)
        String warningMessage = message != null ? message : "This endpoint is deprecated";
        headers.add("Warning", String.format("299 - \"%s\"", warningMessage));
    }
    
    /**
     * Add deprecation headers with default message
     */
    public static void addDeprecationHeaders(
            HttpHeaders headers,
            ZonedDateTime sunsetDate,
            String alternativeUrl) {
        
        String message = String.format(
            "This endpoint is deprecated and will be removed on %s. Use %s instead.",
            sunsetDate.format(DateTimeFormatter.ISO_LOCAL_DATE),
            alternativeUrl != null ? alternativeUrl : "the new version"
        );
        
        addDeprecationHeaders(headers, sunsetDate, alternativeUrl, message);
    }
    
    /**
     * Check if sunset date has passed
     */
    public static boolean isSunsetPassed(ZonedDateTime sunsetDate) {
        return ZonedDateTime.now().isAfter(sunsetDate);
    }
    
    /**
     * Calculate days until sunset
     */
    public static long daysUntilSunset(ZonedDateTime sunsetDate) {
        return java.time.temporal.ChronoUnit.DAYS.between(
            ZonedDateTime.now().toLocalDate(),
            sunsetDate.toLocalDate()
        );
    }
}
