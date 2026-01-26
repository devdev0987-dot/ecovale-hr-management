package com.ecovale.hr.repository;

import com.ecovale.hr.entity.AdvanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository interface for AdvanceRecord entity
 */
@Repository
public interface AdvanceRecordRepository extends JpaRepository<AdvanceRecord, String> {

    /**
     * Find advance records by employee ID
     */
    List<AdvanceRecord> findByEmployeeId(String employeeId);

    /**
     * Find advance records by status
     */
    List<AdvanceRecord> findByStatus(AdvanceRecord.AdvanceStatus status);

    /**
     * Find advance records for a specific deduction month and year
     */
    List<AdvanceRecord> findByAdvanceDeductionMonthAndAdvanceDeductionYear(String deductionMonth, String deductionYear);

    /**
     * Find advance records by employee and status
     */
    List<AdvanceRecord> findByEmployeeIdAndStatus(String employeeId, AdvanceRecord.AdvanceStatus status);
}
