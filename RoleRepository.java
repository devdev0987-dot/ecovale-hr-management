package com.ecovale.hr.repository;

import com.ecovale.hr.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for Role entity
 */
@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    
    /**
     * Find role by name
     */
    Optional<Role> findByName(Role.RoleName name);
    
    /**
     * Check if role exists
     */
    Boolean existsByName(Role.RoleName name);
}
