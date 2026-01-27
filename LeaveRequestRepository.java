package com.ecovale.hr.repository;

import com.ecovale.hr.entity.LeaveRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * Repository for LeaveRequest entity
 */
@Repository
public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    
    /**
     * Find all leave requests by employee ID
     */
    List<LeaveRequest> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);
    
    /**
     * Find leave requests by status
     */
    List<LeaveRequest> findByStatusOrderByCreatedAtDesc(LeaveRequest.LeaveStatus status);
    
    /**
     * Find leave requests by employee and status
     */
    List<LeaveRequest> findByEmployeeIdAndStatus(String employeeId, LeaveRequest.LeaveStatus status);
    
    /**
     * Find leave requests by department
     */
    List<LeaveRequest> findByDepartmentOrderByCreatedAtDesc(String department);
    
    /**
     * Find leave requests by reporting manager
     */
    List<LeaveRequest> findByReportingManagerOrderByCreatedAtDesc(String reportingManager);
    
    /**
     * Find pending leave requests for a manager
     */
    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.reportingManager = :manager AND lr.status = 'PENDING' ORDER BY lr.createdAt ASC")
    List<LeaveRequest> findPendingLeavesForManager(@Param("manager") String manager);
    
    /**
     * Find manager-approved leaves (pending admin approval)
     */
    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.status = 'MANAGER_APPROVED' ORDER BY lr.managerApprovedAt ASC")
    List<LeaveRequest> findManagerApprovedLeaves();
    
    /**
     * Find leave requests by date range
     */
    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.startDate <= :endDate AND lr.endDate >= :startDate")
    List<LeaveRequest> findByDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
    
    /**
     * Find approved leaves for an employee in a date range
     */
    @Query("SELECT lr FROM LeaveRequest lr WHERE lr.employeeId = :employeeId " +
           "AND lr.status = 'ADMIN_APPROVED' " +
           "AND lr.startDate <= :endDate AND lr.endDate >= :startDate")
    List<LeaveRequest> findApprovedLeavesByEmployeeAndDateRange(
        @Param("employeeId") String employeeId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
    
    /**
     * Count pending leave requests
     */
    long countByStatus(LeaveRequest.LeaveStatus status);
    
    /**
     * Count pending leaves for a manager
     */
    @Query("SELECT COUNT(lr) FROM LeaveRequest lr WHERE lr.reportingManager = :manager AND lr.status = 'PENDING'")
    long countPendingLeavesForManager(@Param("manager") String manager);
    
    /**
     * Count approved leaves for an employee in a year
     */
    @Query("SELECT COALESCE(SUM(lr.numberOfDays), 0) FROM LeaveRequest lr " +
           "WHERE lr.employeeId = :employeeId " +
           "AND lr.status = 'ADMIN_APPROVED' " +
           "AND YEAR(lr.startDate) = :year")
    Integer countApprovedDaysInYear(@Param("employeeId") String employeeId, @Param("year") int year);
}
