package com.ecovale.hr.controller;

import com.ecovale.hr.dto.AdvanceRequestDTO;
import com.ecovale.hr.dto.AdvanceResponseDTO;
import com.ecovale.hr.dto.ApiResponse;
import com.ecovale.hr.service.AdvanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Advance Record management
 * Base URL: /api/advances
 */
@RestController
@RequestMapping("/api/v1/advances")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdvanceController {

    private final AdvanceService advanceService;

    /**
     * Create a new advance record
     * POST /api/advances
     */
    @PostMapping
    public ResponseEntity<ApiResponse<AdvanceResponseDTO>> createAdvanceRecord(@Valid @RequestBody AdvanceRequestDTO requestDTO) {
        AdvanceResponseDTO advance = advanceService.createAdvanceRecord(requestDTO);
        ApiResponse<AdvanceResponseDTO> response = ApiResponse.success("Advance record created successfully", advance);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Get advance record by ID
     * GET /api/advances/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AdvanceResponseDTO>> getAdvanceById(@PathVariable String id) {
        AdvanceResponseDTO advance = advanceService.getAdvanceById(id);
        ApiResponse<AdvanceResponseDTO> response = ApiResponse.success(advance);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all advance records
     * GET /api/advances
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<AdvanceResponseDTO>>> getAllAdvanceRecords() {
        List<AdvanceResponseDTO> advanceList = advanceService.getAllAdvanceRecords();
        ApiResponse<List<AdvanceResponseDTO>> response = ApiResponse.success(advanceList);
        return ResponseEntity.ok(response);
    }

    /**
     * Get advance records by employee ID
     * GET /api/advances/employee/{employeeId}
     */
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<ApiResponse<List<AdvanceResponseDTO>>> getAdvanceByEmployeeId(@PathVariable String employeeId) {
        List<AdvanceResponseDTO> advanceList = advanceService.getAdvanceByEmployeeId(employeeId);
        ApiResponse<List<AdvanceResponseDTO>> response = ApiResponse.success(advanceList);
        return ResponseEntity.ok(response);
    }

    /**
     * Get advance records by status
     * GET /api/advances/status/{status}
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<ApiResponse<List<AdvanceResponseDTO>>> getAdvanceByStatus(@PathVariable String status) {
        List<AdvanceResponseDTO> advanceList = advanceService.getAdvanceByStatus(status);
        ApiResponse<List<AdvanceResponseDTO>> response = ApiResponse.success(advanceList);
        return ResponseEntity.ok(response);
    }

    /**
     * Update advance record
     * PUT /api/advances/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AdvanceResponseDTO>> updateAdvanceRecord(
            @PathVariable String id,
            @Valid @RequestBody AdvanceRequestDTO requestDTO) {
        AdvanceResponseDTO advance = advanceService.updateAdvanceRecord(id, requestDTO);
        ApiResponse<AdvanceResponseDTO> response = ApiResponse.success("Advance record updated successfully", advance);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete advance record
     * DELETE /api/advances/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> deleteAdvanceRecord(@PathVariable String id) {
        advanceService.deleteAdvanceRecord(id);
        ApiResponse<Object> response = ApiResponse.success("Advance record deleted successfully", null);
        return ResponseEntity.ok(response);
    }
}
