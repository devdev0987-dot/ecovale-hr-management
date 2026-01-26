package com.ecovale.hr.repository;

import com.ecovale.hr.entity.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository interface for AttendanceRecord entity
 */
@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, String> {

    /**
     * Find attendance records by employee ID
     */
    List<AttendanceRecord> findByEmployeeId(String employeeId);

    /**
     * Find attendance record by employee ID, month, and year
     */
    Optional<AttendanceRecord> findByEmployeeIdAndMonthAndYear(String employeeId, String month, String year);

    /**
     * Find all attendance records for a specific month and year
     */
    List<AttendanceRecord> findByMonthAndYear(String month, String year);

    /**
     * Find attendance records by year
     */
    List<AttendanceRecord> findByYear(String year);
}
