import React from 'react';
import { hasRole, hasAnyRole, isAdmin, getUser } from '../services/authService';

/**
 * RoleBasedRender Component
 * Conditionally renders children based on user roles
 * 
 * Usage:
 * <RoleBasedRender requiredRole="ROLE_ADMIN">
 *   <AdminButton />
 * </RoleBasedRender>
 * 
 * <RoleBasedRender requiredAnyRole={['ROLE_ADMIN', 'ROLE_USER']}>
 *   <ViewButton />
 * </RoleBasedRender>
 */
export const RoleBasedRender = ({ 
  children, 
  requiredRole = null, 
  requiredAnyRole = null,
  requireAdmin = false,
  fallback = null 
}) => {
  // Check admin requirement
  if (requireAdmin && !isAdmin()) {
    return fallback;
  }

  // Check specific role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return fallback;
  }

  // Check any role requirement
  if (requiredAnyRole && !hasAnyRole(requiredAnyRole)) {
    return fallback;
  }

  // All checks passed
  return <>{children}</>;
};

/**
 * AdminOnly Component
 * Shorthand for admin-only content
 */
export const AdminOnly = ({ children, fallback = null }) => {
  return (
    <RoleBasedRender requireAdmin={true} fallback={fallback}>
      {children}
    </RoleBasedRender>
  );
};

/**
 * UserOrAdmin Component
 * Shows content for both USER and ADMIN roles
 */
export const UserOrAdmin = ({ children, fallback = null }) => {
  return (
    <RoleBasedRender 
      requiredAnyRole={['ROLE_USER', 'ROLE_ADMIN']} 
      fallback={fallback}
    >
      {children}
    </RoleBasedRender>
  );
};

/**
 * Custom hook for role-based logic
 * @returns {Object} Role checking utilities
 */
export const useRoles = () => {
  const user = getUser();
  
  return {
    user,
    roles: user?.roles || [],
    hasRole: (role) => hasRole(role),
    hasAnyRole: (roles) => hasAnyRole(roles),
    isAdmin: () => isAdmin(),
    isUser: () => hasRole('ROLE_USER'),
    canCreate: () => isAdmin(),
    canEdit: () => isAdmin(),
    canDelete: () => isAdmin(),
    canView: () => hasAnyRole(['ROLE_USER', 'ROLE_ADMIN']),
  };
};

/**
 * Role-based button component
 */
export const RoleButton = ({ 
  requiredRole = null,
  requiredAnyRole = null,
  requireAdmin = false,
  onClick,
  disabled = false,
  className = '',
  children,
  ...props
}) => {
  const { hasRole, hasAnyRole, isAdmin } = useRoles();

  // Check if user has permission
  const hasPermission = () => {
    if (requireAdmin) return isAdmin();
    if (requiredRole) return hasRole(requiredRole);
    if (requiredAnyRole) return hasAnyRole(requiredAnyRole);
    return true;
  };

  if (!hasPermission()) {
    return null; // Hide button if no permission
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
};

/**
 * Role-based link/navigation component
 */
export const RoleLink = ({ 
  to,
  requiredRole = null,
  requiredAnyRole = null,
  requireAdmin = false,
  className = '',
  children,
  ...props
}) => {
  const { hasRole, hasAnyRole, isAdmin } = useRoles();

  // Check if user has permission
  const hasPermission = () => {
    if (requireAdmin) return isAdmin();
    if (requiredRole) return hasRole(requiredRole);
    if (requiredAnyRole) return hasAnyRole(requiredAnyRole);
    return true;
  };

  if (!hasPermission()) {
    return null; // Hide link if no permission
  }

  return (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  );
};

/**
 * Utility function to get user role display name
 */
export const getRoleDisplayName = (role) => {
  const roleNames = {
    'ROLE_ADMIN': 'Administrator',
    'ROLE_USER': 'User',
  };
  return roleNames[role] || role;
};

/**
 * Component to display user roles as badges
 */
export const RoleBadges = ({ className = '' }) => {
  const { roles } = useRoles();

  if (!roles || roles.length === 0) {
    return null;
  }

  return (
    <div className={`flex gap-2 ${className}`}>
      {roles.map((role) => (
        <span
          key={role}
          className={`px-2 py-1 text-xs font-semibold rounded ${
            role === 'ROLE_ADMIN'
              ? 'bg-red-100 text-red-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {getRoleDisplayName(role)}
        </span>
      ))}
    </div>
  );
};

export default {
  RoleBasedRender,
  AdminOnly,
  UserOrAdmin,
  useRoles,
  RoleButton,
  RoleLink,
  getRoleDisplayName,
  RoleBadges,
};
