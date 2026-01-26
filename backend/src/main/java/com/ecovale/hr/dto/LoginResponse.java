package com.ecovale.hr.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

/**
 * Login Response DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Authentication response with JWT token and user details")
public class LoginResponse {
    
    @Schema(description = "JWT access token", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
    private String token;
    
    @Schema(description = "Token type", example = "Bearer", defaultValue = "Bearer")
    private String type = "Bearer";
    
    @Schema(description = "User ID", example = "1")
    private Long id;
    
    @Schema(description = "Username", example = "admin")
    private String username;
    
    @Schema(description = "User email", example = "admin@ecovale.com")
    private String email;
    
    @Schema(description = "User full name", example = "Admin User")
    private String fullName;
    
    @Schema(description = "User roles", example = "[\"ROLE_ADMIN\", \"ROLE_HR\"]")
    private Set<String> roles;
    
    public LoginResponse(String token, Long id, String username, String email, String fullName, Set<String> roles) {
        this.token = token;
        this.id = id;
        this.username = username;
        this.email = email;
        this.fullName = fullName;
        this.roles = roles;
    }
}
