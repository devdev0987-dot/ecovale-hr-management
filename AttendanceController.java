package com.ecovale.hr.controller;

import com.ecovale.hr.dto.ApiResponse;
import com.ecovale.hr.dto.AttendanceRequestDTO;
import com.ecovale.hr.dto.AttendanceResponseDTO;
import com.ecovale.hr.service.AttendanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for Attendance Record management
 * Base URL: /api/attendance
 */
@RestController
@RequestMapping("/api/v1/attendance")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AttendanceController {

    private final AttendanceService attendanceService;

    /**
     * Create a new attendance record
     * POST /api/attendance
     */
    @PostMapping
    public ResponseEntity<ApiResponse<AttendanceResponseDTO>> createAttendanceRecord(@Valid @RequestBody AttendanceRequestDTO requestDTO) {
        AttendanceResponseDTO attendance = attendanceService.createAttendanceRecord(requestDTO);
        ApiResponse<AttendanceResponseDTO> response = ApiResponse.success("Attendance record created successfully", attendance);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    /**
     * Get attendance record by ID
     * GET /api/attendance/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AttendanceResponseDTO>> getAttendanceById(@PathVariable String id) {
        AttendanceResponseDTO attendance = attendanceService.getAttendanceById(id);
        ApiResponse<AttendanceResponseDTO> response = ApiResponse.success(attendance);
        return ResponseEntity.ok(response);
    }

    /**
     * Get all attendance records
     * GET /api/attendance
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<AttendanceResponseDTO>>> getAllAttendanceRecords() {
        List<AttendanceResponseDTO> attendanceList = attendanceService.getAllAttendanceRecords();
        ApiResponse<List<AttendanceResponseDTO>> response = ApiResponse.success(attendanceList);
        return ResponseEntity.ok(response);
    }

    /**
     * Get attendance records by employee ID
     * GET /api/attendance/employee/{employeeId}
     */
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<ApiResponse<List<AttendanceResponseDTO>>> getAttendanceByEmployeeId(@PathVariable String employeeId) {
        List<AttendanceResponseDTO> attendanceList = attendanceService.getAttendanceByEmployeeId(employeeId);
        ApiResponse<List<AttendanceResponseDTO>> response = ApiResponse.success(attendanceList);
        return ResponseEntity.ok(response);
    }

    /**
     * Get attendance records by month and year
     * GET /api/attendance/period?month=January&year=2026
     */
    @GetMapping("/period")
    public ResponseEntity<ApiResponse<List<AttendanceResponseDTO>>> getAttendanceByMonthAndYear(
            @RequestParam String month,
            @RequestParam String year) {
        List<AttendanceResponseDTO> attendanceList = attendanceService.getAttendanceByMonthAndYear(month, year);
        ApiResponse<List<AttendanceResponseDTO>> response = ApiResponse.success(attendanceList);
        return ResponseEntity.ok(response);
    }

    /**
     * Update attendance record
     * PUT /api/attendance/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AttendanceResponseDTO>> updateAttendanceRecord(
            @PathVariable String id,
            @Valid @RequestBody AttendanceRequestDTO requestDTO) {
        AttendanceResponseDTO attendance = attendanceService.updateAttendanceRecord(id, requestDTO);
        ApiResponse<AttendanceResponseDTO> response = ApiResponse.success("Attendance record updated successfully", attendance);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete attendance record
     * DELETE /api/attendance/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> deleteAttendanceRecord(@PathVariable String id) {
        attendanceService.deleteAttendanceRecord(id);
        ApiResponse<Object> response = ApiResponse.success("Attendance record deleted successfully", null);
        return ResponseEntity.ok(response);
    }
}
