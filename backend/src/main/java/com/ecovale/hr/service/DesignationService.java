package com.ecovale.hr.service;

import com.ecovale.hr.dto.DesignationRequestDTO;
import com.ecovale.hr.dto.DesignationResponseDTO;
import com.ecovale.hr.entity.Designation;
import com.ecovale.hr.exception.DuplicateResourceException;
import com.ecovale.hr.exception.ResourceNotFoundException;
import com.ecovale.hr.repository.DesignationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service class for Designation business logic
 */
@Service
@RequiredArgsConstructor
@Transactional
public class DesignationService {

    private final DesignationRepository designationRepository;

    /**
     * Create a new designation
     */
    public DesignationResponseDTO createDesignation(DesignationRequestDTO requestDTO) {
        if (designationRepository.existsByTitle(requestDTO.getTitle())) {
            throw new DuplicateResourceException("Designation with title " + requestDTO.getTitle() + " already exists");
        }

        Designation designation = mapToEntity(requestDTO);
        designation.setId("DES" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());

        Designation savedDesignation = designationRepository.save(designation);
        return mapToResponseDTO(savedDesignation);
    }

    /**
     * Get designation by ID
     */
    @Transactional(readOnly = true)
    public DesignationResponseDTO getDesignationById(String id) {
        Designation designation = designationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Designation not found with ID: " + id));
        return mapToResponseDTO(designation);
    }

    /**
     * Get all designations
     */
    @Transactional(readOnly = true)
    public List<DesignationResponseDTO> getAllDesignations() {
        return designationRepository.findAll().stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get designations by department
     */
    @Transactional(readOnly = true)
    public List<DesignationResponseDTO> getDesignationsByDepartment(String department) {
        Designation.Department dept = Designation.Department.valueOf(department);
        return designationRepository.findByDepartment(dept).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Update designation
     */
    public DesignationResponseDTO updateDesignation(String id, DesignationRequestDTO requestDTO) {
        Designation designation = designationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Designation not found with ID: " + id));

        if (!designation.getTitle().equals(requestDTO.getTitle()) &&
                designationRepository.existsByTitle(requestDTO.getTitle())) {
            throw new DuplicateResourceException("Designation with title " + requestDTO.getTitle() + " already exists");
        }

        updateEntityFromDTO(designation, requestDTO);
        Designation updatedDesignation = designationRepository.save(designation);
        return mapToResponseDTO(updatedDesignation);
    }

    /**
     * Delete designation
     */
    public void deleteDesignation(String id) {
        if (!designationRepository.existsById(id)) {
            throw new ResourceNotFoundException("Designation not found with ID: " + id);
        }
        designationRepository.deleteById(id);
    }

    /**
     * Map DTO to Entity
     */
    private Designation mapToEntity(DesignationRequestDTO dto) {
        Designation designation = new Designation();
        updateEntityFromDTO(designation, dto);
        return designation;
    }

    /**
     * Update entity from DTO
     */
    private void updateEntityFromDTO(Designation designation, DesignationRequestDTO dto) {
        designation.setTitle(dto.getTitle());
        designation.setDepartment(Designation.Department.valueOf(dto.getDepartment()));
        designation.setDescription(dto.getDescription());
        designation.setReportingTo(dto.getReportingTo());
        designation.setLevel(dto.getLevel());
    }

    /**
     * Map Entity to Response DTO
     */
    private DesignationResponseDTO mapToResponseDTO(Designation designation) {
        DesignationResponseDTO dto = new DesignationResponseDTO();
        dto.setId(designation.getId());
        dto.setTitle(designation.getTitle());
        dto.setDepartment(designation.getDepartment().toString());
        dto.setDescription(designation.getDescription());
        dto.setReportingTo(designation.getReportingTo());
        dto.setLevel(designation.getLevel());
        return dto;
    }
}
