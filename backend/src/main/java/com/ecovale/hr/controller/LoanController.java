package com.ecovale.hr.controller;

import com.ecovale.hr.dto.ApiResponse;
import com.ecovale.hr.dto.LoanRequestDTO;
import com.ecovale.hr.dto.LoanResponseDTO;
import com.ecovale.hr.service.LoanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Loan Record management
 * Base URL: /api/loans
 */
@RestController
@RequestMapping("/api/v1/loans")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class LoanController {

    private final LoanService loanService;

    /**
     * Create a new loan record
     * POST /api/loans
     */
    @PostMapping
    public ResponseEntity<ApiResponse<LoanResponseDTO>> createLoanRecord(@Valid @RequestBody LoanRequestDTO requestDTO) {
        LoanResponseDTO loan = loanService.createLoanRecord(requestDTO);
        ApiResponse<LoanResponseDTO> response = ApiResponse.success("Loan record created successfully", loan);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Get loan record by ID
     * GET /api/loans/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LoanResponseDTO>> getLoanById(@PathVariable String id) {
        LoanResponseDTO loan = loanService.getLoanById(id);
        ApiResponse<LoanResponseDTO> response = ApiResponse.success(loan);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all loan records
     * GET /api/loans
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<LoanResponseDTO>>> getAllLoanRecords() {
        List<LoanResponseDTO> loanList = loanService.getAllLoanRecords();
        ApiResponse<List<LoanResponseDTO>> response = ApiResponse.success(loanList);
        return ResponseEntity.ok(response);
    }

    /**
     * Get loan records by employee ID
     * GET /api/loans/employee/{employeeId}
     */
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<ApiResponse<List<LoanResponseDTO>>> getLoansByEmployeeId(@PathVariable String employeeId) {
        List<LoanResponseDTO> loanList = loanService.getLoansByEmployeeId(employeeId);
        ApiResponse<List<LoanResponseDTO>> response = ApiResponse.success(loanList);
        return ResponseEntity.ok(response);
    }

    /**
     * Get loan records by status
     * GET /api/loans/status/{status}
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<ApiResponse<List<LoanResponseDTO>>> getLoansByStatus(@PathVariable String status) {
        List<LoanResponseDTO> loanList = loanService.getLoansByStatus(status);
        ApiResponse<List<LoanResponseDTO>> response = ApiResponse.success(loanList);
        return ResponseEntity.ok(response);
    }

    /**
     * Update loan record
     * PUT /api/loans/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<LoanResponseDTO>> updateLoanRecord(
            @PathVariable String id,
            @Valid @RequestBody LoanRequestDTO requestDTO) {
        LoanResponseDTO loan = loanService.updateLoanRecord(id, requestDTO);
        ApiResponse<LoanResponseDTO> response = ApiResponse.success("Loan record updated successfully", loan);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete loan record
     * DELETE /api/loans/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> deleteLoanRecord(@PathVariable String id) {
        loanService.deleteLoanRecord(id);
        ApiResponse<Object> response = ApiResponse.success("Loan record deleted successfully", null);
        return ResponseEntity.ok(response);
    }
}
