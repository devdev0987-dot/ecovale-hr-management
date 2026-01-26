package com.ecovale.hr.service;

import com.ecovale.hr.dto.LoanRequestDTO;
import com.ecovale.hr.dto.LoanResponseDTO;
import com.ecovale.hr.entity.LoanRecord;
import com.ecovale.hr.exception.ResourceNotFoundException;
import com.ecovale.hr.repository.LoanRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service class for LoanRecord business logic
 */
@Service
@RequiredArgsConstructor
@Transactional
public class LoanService {

    private final LoanRecordRepository loanRepository;

    /**
     * Create a new loan record
     */
    public LoanResponseDTO createLoanRecord(LoanRequestDTO requestDTO) {
        LoanRecord record = mapToEntity(requestDTO);
        record.setId("LOAN" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());

        LoanRecord savedRecord = loanRepository.save(record);
        return mapToResponseDTO(savedRecord);
    }

    /**
     * Get loan record by ID
     */
    @Transactional(readOnly = true)
    public LoanResponseDTO getLoanById(String id) {
        LoanRecord record = loanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Loan record not found with ID: " + id));
        return mapToResponseDTO(record);
    }

    /**
     * Get all loan records
     */
    @Transactional(readOnly = true)
    public List<LoanResponseDTO> getAllLoanRecords() {
        return loanRepository.findAll().stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get loan records by employee ID
     */
    @Transactional(readOnly = true)
    public List<LoanResponseDTO> getLoansByEmployeeId(String employeeId) {
        return loanRepository.findByEmployeeId(employeeId).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get loan records by status
     */
    @Transactional(readOnly = true)
    public List<LoanResponseDTO> getLoansByStatus(String status) {
        LoanRecord.LoanStatus loanStatus = LoanRecord.LoanStatus.valueOf(status.toUpperCase());
        return loanRepository.findByStatus(loanStatus).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Update loan record
     */
    public LoanResponseDTO updateLoanRecord(String id, LoanRequestDTO requestDTO) {
        LoanRecord record = loanRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Loan record not found with ID: " + id));

        updateEntityFromDTO(record, requestDTO);
        LoanRecord updatedRecord = loanRepository.save(record);
        return mapToResponseDTO(updatedRecord);
    }

    /**
     * Delete loan record
     */
    public void deleteLoanRecord(String id) {
        if (!loanRepository.existsById(id)) {
            throw new ResourceNotFoundException("Loan record not found with ID: " + id);
        }
        loanRepository.deleteById(id);
    }

    /**
     * Map DTO to Entity
     */
    private LoanRecord mapToEntity(LoanRequestDTO dto) {
        LoanRecord record = new LoanRecord();
        updateEntityFromDTO(record, dto);
        return record;
    }

    /**
     * Update entity from DTO
     */
    private void updateEntityFromDTO(LoanRecord record, LoanRequestDTO dto) {
        record.setEmployeeId(dto.getEmployeeId());
        record.setEmployeeName(dto.getEmployeeName());
        record.setLoanAmount(dto.getLoanAmount());
        record.setInterestRate(dto.getInterestRate());
        record.setNumberOfEMIs(dto.getNumberOfEMIs());
        record.setEmiAmount(dto.getEmiAmount());
        record.setTotalAmount(dto.getTotalAmount());
        record.setStartMonth(dto.getStartMonth());
        record.setStartYear(dto.getStartYear());
        record.setTotalPaidEMIs(dto.getTotalPaidEMIs());
        record.setRemainingBalance(dto.getRemainingBalance());
        record.setStatus(LoanRecord.LoanStatus.valueOf(dto.getStatus().toUpperCase()));
        record.setRemarks(dto.getRemarks());
    }

    /**
     * Map Entity to Response DTO
     */
    private LoanResponseDTO mapToResponseDTO(LoanRecord record) {
        LoanResponseDTO dto = new LoanResponseDTO();
        dto.setId(record.getId());
        dto.setEmployeeId(record.getEmployeeId());
        dto.setEmployeeName(record.getEmployeeName());
        dto.setLoanAmount(record.getLoanAmount());
        dto.setInterestRate(record.getInterestRate());
        dto.setNumberOfEMIs(record.getNumberOfEMIs());
        dto.setEmiAmount(record.getEmiAmount());
        dto.setTotalAmount(record.getTotalAmount());
        dto.setStartMonth(record.getStartMonth());
        dto.setStartYear(record.getStartYear());
        dto.setTotalPaidEMIs(record.getTotalPaidEMIs());
        dto.setRemainingBalance(record.getRemainingBalance());
        dto.setStatus(record.getStatus().toString());
        dto.setRemarks(record.getRemarks());
        dto.setCreatedAt(record.getCreatedAt());
        dto.setUpdatedAt(record.getUpdatedAt());
        return dto;
    }
}
