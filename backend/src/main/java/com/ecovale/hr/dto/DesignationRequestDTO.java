package com.ecovale.hr.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for Designation requests
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DesignationRequestDTO {

    @NotBlank(message = "Title is required")
    @Size(max = 100, message = "Title cannot exceed 100 characters")
    private String title;

    @NotBlank(message = "Department is required")
    private String department;

    @NotBlank(message = "Description is required")
    private String description;

    private String reportingTo;

    @NotNull(message = "Level is required")
    @Positive(message = "Level must be positive")
    private Integer level;
}
