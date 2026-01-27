package com.ecovale.hr.service;

import com.ecovale.hr.dto.AttendanceRequestDTO;
import com.ecovale.hr.dto.AttendanceResponseDTO;
import com.ecovale.hr.entity.AttendanceRecord;
import com.ecovale.hr.exception.ResourceNotFoundException;
import com.ecovale.hr.repository.AttendanceRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service class for AttendanceRecord business logic
 */
@Service
@RequiredArgsConstructor
@Transactional
public class AttendanceService {

    private final AttendanceRecordRepository attendanceRepository;

    /**
     * Create a new attendance record
     */
    public AttendanceResponseDTO createAttendanceRecord(AttendanceRequestDTO requestDTO) {
        AttendanceRecord record = mapToEntity(requestDTO);
        record.setId("ATT" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());

        AttendanceRecord savedRecord = attendanceRepository.save(record);
        return mapToResponseDTO(savedRecord);
    }

    /**
     * Get attendance record by ID
     */
    @Transactional(readOnly = true)
    public AttendanceResponseDTO getAttendanceById(String id) {
        AttendanceRecord record = attendanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attendance record not found with ID: " + id));
        return mapToResponseDTO(record);
    }

    /**
     * Get all attendance records
     */
    @Transactional(readOnly = true)
    public List<AttendanceResponseDTO> getAllAttendanceRecords() {
        return attendanceRepository.findAll().stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get attendance records by employee ID
     */
    @Transactional(readOnly = true)
    public List<AttendanceResponseDTO> getAttendanceByEmployeeId(String employeeId) {
        return attendanceRepository.findByEmployeeId(employeeId).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get attendance records by month and year
     */
    @Transactional(readOnly = true)
    public List<AttendanceResponseDTO> getAttendanceByMonthAndYear(String month, String year) {
        return attendanceRepository.findByMonthAndYear(month, year).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Update attendance record
     */
    public AttendanceResponseDTO updateAttendanceRecord(String id, AttendanceRequestDTO requestDTO) {
        AttendanceRecord record = attendanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attendance record not found with ID: " + id));

        updateEntityFromDTO(record, requestDTO);
        AttendanceRecord updatedRecord = attendanceRepository.save(record);
        return mapToResponseDTO(updatedRecord);
    }

    /**
     * Delete attendance record
     */
    public void deleteAttendanceRecord(String id) {
        if (!attendanceRepository.existsById(id)) {
            throw new ResourceNotFoundException("Attendance record not found with ID: " + id);
        }
        attendanceRepository.deleteById(id);
    }

    /**
     * Map DTO to Entity
     */
    private AttendanceRecord mapToEntity(AttendanceRequestDTO dto) {
        AttendanceRecord record = new AttendanceRecord();
        updateEntityFromDTO(record, dto);
        return record;
    }

    /**
     * Update entity from DTO
     */
    private void updateEntityFromDTO(AttendanceRecord record, AttendanceRequestDTO dto) {
        record.setEmployeeId(dto.getEmployeeId());
        record.setEmployeeName(dto.getEmployeeName());
        record.setMonth(dto.getMonth());
        record.setYear(dto.getYear());
        record.setTotalWorkingDays(dto.getTotalWorkingDays());
        record.setPresentDays(dto.getPresentDays());
        record.setAbsentDays(dto.getAbsentDays());
        record.setPaidLeave(dto.getPaidLeave());
        record.setUnpaidLeave(dto.getUnpaidLeave());
        record.setPayableDays(dto.getPayableDays());
        record.setLossOfPayDays(dto.getLossOfPayDays());
        record.setRemarks(dto.getRemarks());
    }

    /**
     * Map Entity to Response DTO
     */
    private AttendanceResponseDTO mapToResponseDTO(AttendanceRecord record) {
        AttendanceResponseDTO dto = new AttendanceResponseDTO();
        dto.setId(record.getId());
        dto.setEmployeeId(record.getEmployeeId());
        dto.setEmployeeName(record.getEmployeeName());
        dto.setMonth(record.getMonth());
        dto.setYear(record.getYear());
        dto.setTotalWorkingDays(record.getTotalWorkingDays());
        dto.setPresentDays(record.getPresentDays());
        dto.setAbsentDays(record.getAbsentDays());
        dto.setPaidLeave(record.getPaidLeave());
        dto.setUnpaidLeave(record.getUnpaidLeave());
        dto.setPayableDays(record.getPayableDays());
        dto.setLossOfPayDays(record.getLossOfPayDays());
        dto.setRemarks(record.getRemarks());
        dto.setCreatedAt(record.getCreatedAt());
        dto.setUpdatedAt(record.getUpdatedAt());
        return dto;
    }
}
