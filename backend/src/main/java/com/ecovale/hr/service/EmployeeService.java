package com.ecovale.hr.service;

import com.ecovale.hr.dto.EmployeeRequestDTO;
import com.ecovale.hr.dto.EmployeeResponseDTO;
import com.ecovale.hr.entity.Employee;
import com.ecovale.hr.exception.ResourceNotFoundException;
import com.ecovale.hr.exception.DuplicateResourceException;
import com.ecovale.hr.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service class for Employee business logic
 */
@Service
@RequiredArgsConstructor
@Transactional
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    /**
     * Create a new employee
     */
    public EmployeeResponseDTO createEmployee(EmployeeRequestDTO requestDTO) {
        // Check if official email already exists
        if (employeeRepository.existsByOfficialEmail(requestDTO.getOfficialEmail())) {
            throw new DuplicateResourceException("Employee with official email " + requestDTO.getOfficialEmail() + " already exists");
        }

        Employee employee = mapToEntity(requestDTO);
        employee.setId(generateEmployeeId());

        Employee savedEmployee = employeeRepository.save(employee);
        return mapToResponseDTO(savedEmployee);
    }

    /**
     * Get employee by ID
     */
    @Transactional(readOnly = true)
    public EmployeeResponseDTO getEmployeeById(String id) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with ID: " + id));
        return mapToResponseDTO(employee);
    }

    /**
     * Get all employees
     */
    @Transactional(readOnly = true)
    public List<EmployeeResponseDTO> getAllEmployees() {
        return employeeRepository.findAll().stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get all active employees
     */
    @Transactional(readOnly = true)
    public List<EmployeeResponseDTO> getActiveEmployees() {
        return employeeRepository.findAllActiveEmployees().stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Get employees by department
     */
    @Transactional(readOnly = true)
    public List<EmployeeResponseDTO> getEmployeesByDepartment(String department) {
        Employee.Department dept = Employee.Department.valueOf(department);
        return employeeRepository.findByDepartment(dept).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Search employees by name
     */
    @Transactional(readOnly = true)
    public List<EmployeeResponseDTO> searchEmployeesByName(String name) {
        return employeeRepository.searchByName(name).stream()
                .map(this::mapToResponseDTO)
                .collect(Collectors.toList());
    }

    /**
     * Update employee
     */
    public EmployeeResponseDTO updateEmployee(String id, EmployeeRequestDTO requestDTO) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found with ID: " + id));

        // Check if official email is being changed and if it already exists
        if (!employee.getOfficialEmail().equals(requestDTO.getOfficialEmail()) &&
                employeeRepository.existsByOfficialEmail(requestDTO.getOfficialEmail())) {
            throw new DuplicateResourceException("Employee with official email " + requestDTO.getOfficialEmail() + " already exists");
        }

        updateEntityFromDTO(employee, requestDTO);
        Employee updatedEmployee = employeeRepository.save(employee);
        return mapToResponseDTO(updatedEmployee);
    }

    /**
     * Delete employee
     */
    public void deleteEmployee(String id) {
        if (!employeeRepository.existsById(id)) {
            throw new ResourceNotFoundException("Employee not found with ID: " + id);
        }
        employeeRepository.deleteById(id);
    }

    /**
     * Generate unique employee ID
     */
    private String generateEmployeeId() {
        return "EMP" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    /**
     * Map DTO to Entity
     */
    private Employee mapToEntity(EmployeeRequestDTO dto) {
        Employee employee = new Employee();
        updateEntityFromDTO(employee, dto);
        return employee;
    }

    /**
     * Update entity from DTO
     */
    private void updateEntityFromDTO(Employee employee, EmployeeRequestDTO dto) {
        // Personal Info
        employee.setFirstName(dto.getFirstName());
        employee.setMiddleName(dto.getMiddleName());
        employee.setLastName(dto.getLastName());
        employee.setDob(dto.getDob());
        employee.setGender(Employee.Gender.valueOf(dto.getGender()));
        employee.setPhoto(dto.getPhoto());
        employee.setContactNumber(dto.getContactNumber());
        employee.setAlternateContact(dto.getAlternateContact());
        employee.setEmergencyContact(dto.getEmergencyContact());
        employee.setPersonalEmail(dto.getPersonalEmail());
        employee.setPermanentAddress(dto.getPermanentAddress());
        employee.setCurrentAddress(dto.getCurrentAddress());
        employee.setPfNumber(dto.getPfNumber());
        employee.setEsiNumber(dto.getEsiNumber());
        employee.setBloodGroup(dto.getBloodGroup());
        employee.setFatherName(dto.getFatherName());
        employee.setMotherName(dto.getMotherName());

        // Employment Details
        employee.setType(Employee.EmploymentType.valueOf(dto.getType().toUpperCase().replace("-", "_")));
        employee.setDepartment(Employee.Department.valueOf(dto.getDepartment()));
        employee.setDesignation(dto.getDesignation());
        employee.setReportingManager(dto.getReportingManager());
        employee.setJoinDate(dto.getJoinDate());
        employee.setOfficialEmail(dto.getOfficialEmail());
        employee.setWorkLocation(Employee.WorkLocation.valueOf(dto.getWorkLocation()));
        employee.setProbationPeriod(dto.getProbationPeriod());
        if (dto.getGrade() != null && !dto.getGrade().isEmpty()) {
            employee.setGrade(Employee.Grade.valueOf(dto.getGrade()));
        }

        // Salary Info
        employee.setCtc(dto.getCtc());
        employee.setBasic(dto.getBasic());
        employee.setHraPercentage(dto.getHraPercentage());
        employee.setHra(dto.getHra());
        employee.setConveyance(dto.getConveyance());
        employee.setTelephone(dto.getTelephone());
        employee.setMedicalAllowance(dto.getMedicalAllowance());
        employee.setSpecialAllowance(dto.getSpecialAllowance());
        employee.setEmployeeHealthInsuranceAnnual(dto.getEmployeeHealthInsuranceAnnual());
        employee.setGross(dto.getGross());
        employee.setIncludePF(dto.getIncludePF());
        employee.setIncludeESI(dto.getIncludeESI());
        employee.setPfDeduction(dto.getPfDeduction());
        employee.setEsiDeduction(dto.getEsiDeduction());
        employee.setEmployerESI(dto.getEmployerESI());
        employee.setEmployerPF(dto.getEmployerPF());
        employee.setProfessionalTax(dto.getProfessionalTax());
        employee.setTds(dto.getTds());
        employee.setTdsMonthly(dto.getTdsMonthly());
        employee.setGstMonthly(dto.getGstMonthly());
        employee.setGstAnnual(dto.getGstAnnual());
        employee.setProfessionalFeesMonthly(dto.getProfessionalFeesMonthly());
        employee.setProfessionalFeesInclusive(dto.getProfessionalFeesInclusive());
        employee.setProfessionalFeesBaseMonthly(dto.getProfessionalFeesBaseMonthly());
        employee.setProfessionalFeesTotalMonthly(dto.getProfessionalFeesTotalMonthly());
        employee.setProfessionalFeesBaseAnnual(dto.getProfessionalFeesBaseAnnual());
        employee.setProfessionalFeesTotalAnnual(dto.getProfessionalFeesTotalAnnual());
        employee.setNet(dto.getNet());
        employee.setPaymentMode(Employee.PaymentMode.valueOf(dto.getPaymentMode()));

        // Bank Details
        employee.setBankName(dto.getBankName());
        employee.setAccountHolder(dto.getAccountHolder());
        employee.setAccountNumber(dto.getAccountNumber());
        employee.setIfscCode(dto.getIfscCode());
        employee.setBranch(dto.getBranch());

        employee.setStatus(Employee.EmployeeStatus.valueOf(dto.getStatus().toUpperCase()));
    }

    /**
     * Map Entity to Response DTO
     */
    private EmployeeResponseDTO mapToResponseDTO(Employee employee) {
        EmployeeResponseDTO dto = new EmployeeResponseDTO();
        dto.setId(employee.getId());
        dto.setFirstName(employee.getFirstName());
        dto.setMiddleName(employee.getMiddleName());
        dto.setLastName(employee.getLastName());
        dto.setDob(employee.getDob());
        dto.setGender(employee.getGender().toString());
        dto.setPhoto(employee.getPhoto());
        dto.setContactNumber(employee.getContactNumber());
        dto.setAlternateContact(employee.getAlternateContact());
        dto.setEmergencyContact(employee.getEmergencyContact());
        dto.setPersonalEmail(employee.getPersonalEmail());
        dto.setPermanentAddress(employee.getPermanentAddress());
        dto.setCurrentAddress(employee.getCurrentAddress());
        dto.setPfNumber(employee.getPfNumber());
        dto.setEsiNumber(employee.getEsiNumber());
        dto.setBloodGroup(employee.getBloodGroup());
        dto.setFatherName(employee.getFatherName());
        dto.setMotherName(employee.getMotherName());

        dto.setType(employee.getType().toString());
        dto.setDepartment(employee.getDepartment().toString());
        dto.setDesignation(employee.getDesignation());
        dto.setReportingManager(employee.getReportingManager());
        dto.setJoinDate(employee.getJoinDate());
        dto.setOfficialEmail(employee.getOfficialEmail());
        dto.setWorkLocation(employee.getWorkLocation().toString());
        dto.setProbationPeriod(employee.getProbationPeriod());
        dto.setGrade(employee.getGrade() != null ? employee.getGrade().toString() : null);

        dto.setCtc(employee.getCtc());
        dto.setBasic(employee.getBasic());
        dto.setHraPercentage(employee.getHraPercentage());
        dto.setHra(employee.getHra());
        dto.setConveyance(employee.getConveyance());
        dto.setTelephone(employee.getTelephone());
        dto.setMedicalAllowance(employee.getMedicalAllowance());
        dto.setSpecialAllowance(employee.getSpecialAllowance());
        dto.setEmployeeHealthInsuranceAnnual(employee.getEmployeeHealthInsuranceAnnual());
        dto.setGross(employee.getGross());
        dto.setIncludePF(employee.getIncludePF());
        dto.setIncludeESI(employee.getIncludeESI());
        dto.setPfDeduction(employee.getPfDeduction());
        dto.setEsiDeduction(employee.getEsiDeduction());
        dto.setEmployerESI(employee.getEmployerESI());
        dto.setEmployerPF(employee.getEmployerPF());
        dto.setProfessionalTax(employee.getProfessionalTax());
        dto.setTds(employee.getTds());
        dto.setTdsMonthly(employee.getTdsMonthly());
        dto.setGstMonthly(employee.getGstMonthly());
        dto.setGstAnnual(employee.getGstAnnual());
        dto.setProfessionalFeesMonthly(employee.getProfessionalFeesMonthly());
        dto.setProfessionalFeesInclusive(employee.getProfessionalFeesInclusive());
        dto.setProfessionalFeesBaseMonthly(employee.getProfessionalFeesBaseMonthly());
        dto.setProfessionalFeesTotalMonthly(employee.getProfessionalFeesTotalMonthly());
        dto.setProfessionalFeesBaseAnnual(employee.getProfessionalFeesBaseAnnual());
        dto.setProfessionalFeesTotalAnnual(employee.getProfessionalFeesTotalAnnual());
        dto.setNet(employee.getNet());
        dto.setPaymentMode(employee.getPaymentMode().toString());

        dto.setBankName(employee.getBankName());
        dto.setAccountHolder(employee.getAccountHolder());
        dto.setAccountNumber(employee.getAccountNumber());
        dto.setIfscCode(employee.getIfscCode());
        dto.setBranch(employee.getBranch());

        dto.setStatus(employee.getStatus().toString());
        dto.setCreatedAt(employee.getCreatedAt());
        dto.setUpdatedAt(employee.getUpdatedAt());

        return dto;
    }
}
