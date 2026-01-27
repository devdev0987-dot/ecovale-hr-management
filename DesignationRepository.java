package com.ecovale.hr.repository;

import com.ecovale.hr.entity.Designation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository interface for Designation entity
 */
@Repository
public interface DesignationRepository extends JpaRepository<Designation, String> {

    /**
     * Find designation by title
     */
    Optional<Designation> findByTitle(String title);

    /**
     * Find all designations by department
     */
    List<Designation> findByDepartment(Designation.Department department);

    /**
     * Find designations by level
     */
    List<Designation> findByLevel(Integer level);

    /**
     * Check if title already exists
     */
    boolean existsByTitle(String title);
}
