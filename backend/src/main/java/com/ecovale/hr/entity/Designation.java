package com.ecovale.hr.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entity class representing a Designation in the organization
 * Maps to 'designations' table in the database
 */
@Entity
@Table(name = "designations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Designation {

    @Id
    @Column(length = 50, nullable = false)
    private String id;

    @Column(nullable = false, unique = true, length = 100)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private Department department;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    private String reportingTo;

    @Column(nullable = false)
    private Integer level;

    public enum Department {
        IT, HR, Finance, Sales, Marketing
    }
}
