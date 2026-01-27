package com.ecovale.hr.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for Designation responses
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DesignationResponseDTO {

    private String id;
    private String title;
    private String department;
    private String description;
    private String reportingTo;
    private Integer level;
}
