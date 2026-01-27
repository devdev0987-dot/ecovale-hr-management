package com.ecovale.hr.controller;

import com.ecovale.hr.dto.ApiResponse;
import com.ecovale.hr.dto.EmployeeRequestDTO;
import com.ecovale.hr.dto.EmployeeResponseDTO;
import com.ecovale.hr.service.EmployeeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Employee management
 * Base URL: /api/employees
 */
@RestController
@RequestMapping("/api/v1/employees")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class EmployeeController {

    private final EmployeeService employeeService;

    /**
     * Create a new employee
     * POST /api/employees
     * Requires ADMIN role
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmployeeResponseDTO>> createEmployee(@Valid @RequestBody EmployeeRequestDTO requestDTO) {
        EmployeeResponseDTO employee = employeeService.createEmployee(requestDTO);
        ApiResponse<EmployeeResponseDTO> response = ApiResponse.success("Employee created successfully", employee);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Get employee by ID
     * GET /api/employees/{id}
     * Requires USER or ADMIN role
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<ApiResponse<EmployeeResponseDTO>> getEmployeeById(@PathVariable String id) {
        EmployeeResponseDTO employee = employeeService.getEmployeeById(id);
        ApiResponse<EmployeeResponseDTO> response = ApiResponse.success(employee);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all employees
     * GET /api/employees
     * Requires USER or ADMIN role
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<EmployeeResponseDTO>>> getAllEmployees() {
        List<EmployeeResponseDTO> employees = employeeService.getAllEmployees();
        ApiResponse<List<EmployeeResponseDTO>> response = ApiResponse.success(employees);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all active employees
     * GET /api/employees/active
     * Requires USER or ADMIN role
     */
    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<EmployeeResponseDTO>>> getActiveEmployees() {
        List<EmployeeResponseDTO> employees = employeeService.getActiveEmployees();
        ApiResponse<List<EmployeeResponseDTO>> response = ApiResponse.success(employees);
        return ResponseEntity.ok(response);
    }

    /**
     * Get employees by department
     * GET /api/employees/department/{department}
     * Requires USER or ADMIN role
     */
    @GetMapping("/department/{department}")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<EmployeeResponseDTO>>> getEmployeesByDepartment(@PathVariable String department) {
        List<EmployeeResponseDTO> employees = employeeService.getEmployeesByDepartment(department);
        ApiResponse<List<EmployeeResponseDTO>> response = ApiResponse.success(employees);
        return ResponseEntity.ok(response);
    }

    /**
     * Search employees by name
     * GET /api/employees/search?name=John
     * Requires USER or ADMIN role
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('USER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<EmployeeResponseDTO>>> searchEmployees(@RequestParam String name) {
        List<EmployeeResponseDTO> employees = employeeService.searchEmployeesByName(name);
        ApiResponse<List<EmployeeResponseDTO>> response = ApiResponse.success(employees);
        return ResponseEntity.ok(response);
    }

    /**
     * Update employee
     * PUT /api/employees/{id}
     * Requires ADMIN role
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmployeeResponseDTO>> updateEmployee(
            @PathVariable String id,
            @Valid @RequestBody EmployeeRequestDTO requestDTO) {
        EmployeeResponseDTO employee = employeeService.updateEmployee(id, requestDTO);
        ApiResponse<EmployeeResponseDTO> response = ApiResponse.success("Employee updated successfully", employee);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete employee
     * DELETE /api/employees/{id}
     * Requires ADMIN role
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Object>> deleteEmployee(@PathVariable String id) {
        employeeService.deleteEmployee(id);
        ApiResponse<Object> response = ApiResponse.success("Employee deleted successfully", null);
        return ResponseEntity.ok(response);
    }
}
