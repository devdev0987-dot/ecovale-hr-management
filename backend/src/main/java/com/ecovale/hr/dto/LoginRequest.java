package com.ecovale.hr.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Login Request DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Login credentials")
public class LoginRequest {
    
    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 100, message = "Username must be between 3 and 100 characters")
    @Schema(description = "Username for authentication", example = "admin", minLength = 3, maxLength = 100, requiredMode = Schema.RequiredMode.REQUIRED)
    private String username;
    
    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
    @Schema(description = "User password", example = "password123", minLength = 6, maxLength = 100, format = "password", requiredMode = Schema.RequiredMode.REQUIRED)
    private String password;
}
