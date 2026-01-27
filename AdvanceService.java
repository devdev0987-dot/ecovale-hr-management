package com.ecovale.hr.service;

import com.ecovale.hr.dto.AdvanceRequestDTO;
import com.ecovale.hr.dto.AdvanceResponseDTO;
import com.ecovale.hr.entity.AdvanceRecord;
import com.ecovale.hr.exception.ResourceNotFoundException;
import com.ecovale.hr.repository.AdvanceRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service class for AdvanceRecord business logic
 */
@Service
@RequiredArgsConstructor
@Transactional
public class AdvanceService {

    private final AdvanceRecordRepository advanceRepository;

    /**
     * Create a new advance record
     */
    public AdvanceResponseDTO createAdvanceRecord(AdvanceRequestDTO requestDTO) {
        AdvanceRecord record = mapToEntity(requestDTO);
        record.setId("ADV" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());

        AdvanceRecord savedRecord = advanceRepository.save(record);
        return mapToResponseDTO(savedRecord);
    }

    /**
     * Get advance record by ID
     */
    @Transactional(readOnly = true)
    public AdvanceResponseDTO getAdvanceById(String id) {
        AdvanceRecord record = advanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Advance record not found with ID: " + id));
        return mapToResponseDTO(record);
    }

    /**
     * Get all advance records
     */
    @Transactional(readOnly = true)
    public List<AdvanceResponseDTO> getAllAdvanceRecords() {
        return advanceRepository.findAll().stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get advance records by employee ID
     */
    @Transactional(readOnly = true)
    public List<AdvanceResponseDTO> getAdvanceByEmployeeId(String employeeId) {
        return advanceRepository.findByEmployeeId(employeeId).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get advance records by status
     */
    @Transactional(readOnly = true)
    public List<AdvanceResponseDTO> getAdvanceByStatus(String status) {
        AdvanceRecord.AdvanceStatus advanceStatus = AdvanceRecord.AdvanceStatus.valueOf(status.toUpperCase());
        return advanceRepository.findByStatus(advanceStatus).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Update advance record
     */
    public AdvanceResponseDTO updateAdvanceRecord(String id, AdvanceRequestDTO requestDTO) {
        AdvanceRecord record = advanceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Advance record not found with ID: " + id));

        updateEntityFromDTO(record, requestDTO);
        AdvanceRecord updatedRecord = advanceRepository.save(record);
        return mapToResponseDTO(updatedRecord);
    }

    /**
     * Delete advance record
     */
    public void deleteAdvanceRecord(String id) {
        if (!advanceRepository.existsById(id)) {
            throw new ResourceNotFoundException("Advance record not found with ID: " + id);
        }
        advanceRepository.deleteById(id);
    }

    /**
     * Map DTO to Entity
     */
    private AdvanceRecord mapToEntity(AdvanceRequestDTO dto) {
        AdvanceRecord record = new AdvanceRecord();
        updateEntityFromDTO(record, dto);
        return record;
    }

    /**
     * Update entity from DTO
     */
    private void updateEntityFromDTO(AdvanceRecord record, AdvanceRequestDTO dto) {
        record.setEmployeeId(dto.getEmployeeId());
        record.setEmployeeName(dto.getEmployeeName());
        record.setAdvanceMonth(dto.getAdvanceMonth());
        record.setAdvanceYear(dto.getAdvanceYear());
        record.setAdvancePaidAmount(dto.getAdvancePaidAmount());
        record.setAdvanceDeductionMonth(dto.getAdvanceDeductionMonth());
        record.setAdvanceDeductionYear(dto.getAdvanceDeductionYear());
        record.setRemarks(dto.getRemarks());
        record.setStatus(AdvanceRecord.AdvanceStatus.valueOf(dto.getStatus().toUpperCase()));
        record.setRemainingAmount(dto.getRemainingAmount());
    }

    /**
     * Map Entity to Response DTO
     */
    private AdvanceResponseDTO mapToResponseDTO(AdvanceRecord record) {
        AdvanceResponseDTO dto = new AdvanceResponseDTO();
        dto.setId(record.getId());
        dto.setEmployeeId(record.getEmployeeId());
        dto.setEmployeeName(record.getEmployeeName());
        dto.setAdvanceMonth(record.getAdvanceMonth());
        dto.setAdvanceYear(record.getAdvanceYear());
        dto.setAdvancePaidAmount(record.getAdvancePaidAmount());
        dto.setAdvanceDeductionMonth(record.getAdvanceDeductionMonth());
        dto.setAdvanceDeductionYear(record.getAdvanceDeductionYear());
        dto.setRemarks(record.getRemarks());
        dto.setStatus(record.getStatus().toString());
        dto.setRemainingAmount(record.getRemainingAmount());
        dto.setCreatedAt(record.getCreatedAt());
        dto.setUpdatedAt(record.getUpdatedAt());
        return dto;
    }
}
