package com.ecovale.hr.repository;

import com.ecovale.hr.entity.LoanRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository interface for LoanRecord entity
 */
@Repository
public interface LoanRecordRepository extends JpaRepository<LoanRecord, String> {

    /**
     * Find loan records by employee ID
     */
    List<LoanRecord> findByEmployeeId(String employeeId);

    /**
     * Find loan records by status
     */
    List<LoanRecord> findByStatus(LoanRecord.LoanStatus status);

    /**
     * Find active loans for an employee
     */
    List<LoanRecord> findByEmployeeIdAndStatus(String employeeId, LoanRecord.LoanStatus status);
}
