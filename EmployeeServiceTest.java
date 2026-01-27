package com.ecovale.hr.service;

import com.ecovale.hr.dto.EmployeeRequestDTO;
import com.ecovale.hr.dto.EmployeeResponseDTO;
import com.ecovale.hr.entity.Employee;
import com.ecovale.hr.exception.DuplicateResourceException;
import com.ecovale.hr.exception.ResourceNotFoundException;
import com.ecovale.hr.repository.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for EmployeeService
 */
@ExtendWith(MockitoExtension.class)
class EmployeeServiceTest {

    @Mock
    private EmployeeRepository employeeRepository;

    @InjectMocks
    private EmployeeService employeeService;

    private EmployeeRequestDTO requestDTO;
    private Employee employee;

    @BeforeEach
    void setUp() {
        // Setup test data
        requestDTO = new EmployeeRequestDTO();
        requestDTO.setFirstName("John");
        requestDTO.setLastName("Doe");
        requestDTO.setGender("Male");
        requestDTO.setContactNumber("9876543210");
        requestDTO.setPersonalEmail("john@example.com");
        requestDTO.setCurrentAddress("Test Address");
        requestDTO.setType("FULL_TIME");
        requestDTO.setDepartment("IT");
        requestDTO.setDesignation("Developer");
        requestDTO.setOfficialEmail("john@ecovale.com");
        requestDTO.setWorkLocation("Bangalore");
        requestDTO.setCtc(500000.0);
        requestDTO.setBasic(20000.0);
        requestDTO.setNet(18000.0);
        requestDTO.setPaymentMode("Bank");
        requestDTO.setStatus("ACTIVE");

        employee = new Employee();
        employee.setId("EMP001");
        employee.setFirstName("John");
        employee.setLastName("Doe");
        employee.setOfficialEmail("john@ecovale.com");
    }

    @Test
    void testCreateEmployee_Success() {
        // Arrange
        when(employeeRepository.existsByOfficialEmail(anyString())).thenReturn(false);
        when(employeeRepository.save(any(Employee.class))).thenReturn(employee);

        // Act
        EmployeeResponseDTO response = employeeService.createEmployee(requestDTO);

        // Assert
        assertNotNull(response);
        assertEquals("John", response.getFirstName());
        verify(employeeRepository, times(1)).save(any(Employee.class));
    }

    @Test
    void testCreateEmployee_DuplicateEmail() {
        // Arrange
        when(employeeRepository.existsByOfficialEmail(anyString())).thenReturn(true);

        // Act & Assert
        assertThrows(DuplicateResourceException.class, () -> {
            employeeService.createEmployee(requestDTO);
        });
    }

    @Test
    void testGetEmployeeById_Success() {
        // Arrange
        when(employeeRepository.findById("EMP001")).thenReturn(Optional.of(employee));

        // Act
        EmployeeResponseDTO response = employeeService.getEmployeeById("EMP001");

        // Assert
        assertNotNull(response);
        assertEquals("EMP001", response.getId());
    }

    @Test
    void testGetEmployeeById_NotFound() {
        // Arrange
        when(employeeRepository.findById("EMP999")).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(ResourceNotFoundException.class, () -> {
            employeeService.getEmployeeById("EMP999");
        });
    }

    @Test
    void testGetAllEmployees() {
        // Arrange
        List<Employee> employees = Arrays.asList(employee);
        when(employeeRepository.findAll()).thenReturn(employees);

        // Act
        List<EmployeeResponseDTO> response = employeeService.getAllEmployees();

        // Assert
        assertNotNull(response);
        assertEquals(1, response.size());
    }

    @Test
    void testDeleteEmployee_Success() {
        // Arrange
        when(employeeRepository.existsById("EMP001")).thenReturn(true);

        // Act
        employeeService.deleteEmployee("EMP001");

        // Assert
        verify(employeeRepository, times(1)).deleteById("EMP001");
    }

    @Test
    void testDeleteEmployee_NotFound() {
        // Arrange
        when(employeeRepository.existsById("EMP999")).thenReturn(false);

        // Act & Assert
        assertThrows(ResourceNotFoundException.class, () -> {
            employeeService.deleteEmployee("EMP999");
        });
    }
}
