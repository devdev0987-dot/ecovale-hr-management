package com.ecovale.hr.controller;

import com.ecovale.hr.dto.ApiResponse;
import com.ecovale.hr.dto.DesignationRequestDTO;
import com.ecovale.hr.dto.DesignationResponseDTO;
import com.ecovale.hr.service.DesignationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Designation management
 * Base URL: /api/designations
 */
@RestController
@RequestMapping("/api/v1/designations")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DesignationController {

    private final DesignationService designationService;

    /**
     * Create a new designation
     * POST /api/designations
     */
    @PostMapping
    public ResponseEntity<ApiResponse<DesignationResponseDTO>> createDesignation(@Valid @RequestBody DesignationRequestDTO requestDTO) {
        DesignationResponseDTO designation = designationService.createDesignation(requestDTO);
        ApiResponse<DesignationResponseDTO> response = ApiResponse.success("Designation created successfully", designation);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Get designation by ID
     * GET /api/designations/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DesignationResponseDTO>> getDesignationById(@PathVariable String id) {
        DesignationResponseDTO designation = designationService.getDesignationById(id);
        ApiResponse<DesignationResponseDTO> response = ApiResponse.success(designation);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all designations
     * GET /api/designations
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<DesignationResponseDTO>>> getAllDesignations() {
        List<DesignationResponseDTO> designations = designationService.getAllDesignations();
        ApiResponse<List<DesignationResponseDTO>> response = ApiResponse.success(designations);
        return ResponseEntity.ok(response);
    }

    /**
     * Get designations by department
     * GET /api/designations/department/{department}
     */
    @GetMapping("/department/{department}")
    public ResponseEntity<ApiResponse<List<DesignationResponseDTO>>> getDesignationsByDepartment(@PathVariable String department) {
        List<DesignationResponseDTO> designations = designationService.getDesignationsByDepartment(department);
        ApiResponse<List<DesignationResponseDTO>> response = ApiResponse.success(designations);
        return ResponseEntity.ok(response);
    }

    /**
     * Update designation
     * PUT /api/designations/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DesignationResponseDTO>> updateDesignation(
            @PathVariable String id,
            @Valid @RequestBody DesignationRequestDTO requestDTO) {
        DesignationResponseDTO designation = designationService.updateDesignation(id, requestDTO);
        ApiResponse<DesignationResponseDTO> response = ApiResponse.success("Designation updated successfully", designation);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete designation
     * DELETE /api/designations/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> deleteDesignation(@PathVariable String id) {
        designationService.deleteDesignation(id);
        ApiResponse<Object> response = ApiResponse.success("Designation deleted successfully", null);
        return ResponseEntity.ok(response);
    }
}
