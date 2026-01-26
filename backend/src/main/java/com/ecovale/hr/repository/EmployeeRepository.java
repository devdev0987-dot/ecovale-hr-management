package com.ecovale.hr.repository;

import com.ecovale.hr.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository interface for Employee entity
 * Provides database operations for Employee management
 */
@Repository
public interface EmployeeRepository extends JpaRepository<Employee, String> {

    /**
     * Find employee by official email
     */
    Optional<Employee> findByOfficialEmail(String officialEmail);

    /**
     * Find all employees by department
     */
    List<Employee> findByDepartment(Employee.Department department);

    /**
     * Find all employees by status
     */
    List<Employee> findByStatus(Employee.EmployeeStatus status);

    /**
     * Find employees by designation
     */
    List<Employee> findByDesignation(String designation);

    /**
     * Find employees by work location
     */
    List<Employee> findByWorkLocation(Employee.WorkLocation workLocation);

    /**
     * Search employees by name (first, middle, or last name)
     */
    @Query("SELECT e FROM Employee e WHERE " +
           "LOWER(e.firstName) LIKE LOWER(CONCAT('%', :name, '%')) OR " +
           "LOWER(e.middleName) LIKE LOWER(CONCAT('%', :name, '%')) OR " +
           "LOWER(e.lastName) LIKE LOWER(CONCAT('%', :name, '%'))")
    List<Employee> searchByName(@Param("name") String name);

    /**
     * Check if official email already exists
     */
    boolean existsByOfficialEmail(String officialEmail);

    /**
     * Find all active employees
     */
    @Query("SELECT e FROM Employee e WHERE e.status = 'ACTIVE'")
    List<Employee> findAllActiveEmployees();
}
