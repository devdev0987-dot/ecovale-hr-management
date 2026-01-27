/**
 * Role-Based Access Control Utilities
 * 
 * This file provides helper functions for role-based UI logic.
 * All functions work with JWT roles decoded from the backend.
 * 
 * Roles used in the system:
 * - ROLE_ADMIN: Full access to all features
 * - ROLE_USER: Limited access to user-facing features
 */

import { hasRole, hasAnyRole, isAdmin, getUser } from '../services/authService';

// Role constants for type safety
export const ROLES = {
  ADMIN: 'ROLE_ADMIN',
  USER: 'ROLE_USER',
} as const;

/**
 * Check if user has admin role
 */
export const isUserAdmin = (): boolean => {
  return isAdmin();
};

/**
 * Check if user has user role
 */
export const isUserRole = (): boolean => {
  return hasRole(ROLES.USER);
};

/**
 * Check if user can perform CRUD operations
 */
export const canCreate = (): boolean => {
  return isAdmin(); // Only admins can create
};

export const canEdit = (): boolean => {
  return isAdmin(); // Only admins can edit
};

export const canDelete = (): boolean => {
  return isAdmin(); // Only admins can delete
};

export const canView = (): boolean => {
  return hasAnyRole([ROLES.USER, ROLES.ADMIN]); // Both can view
};

/**
 * Page-specific access checks
 */
export const canAccessEmployeesPage = (): boolean => {
  return isAdmin(); // Admin only
};

export const canAccessNewEmployeePage = (): boolean => {
  return isAdmin(); // Admin only
};

export const canAccessDesignationsPage = (): boolean => {
  return isAdmin(); // Admin only
};

export const canAccessPayrollPage = (): boolean => {
  return isAdmin(); // Admin only
};

export const canAccessLoansPage = (): boolean => {
  return isAdmin(); // Admin only
};

export const canAccessAdvancesPage = (): boolean => {
  return isAdmin(); // Admin only
};

export const canAccessPayRunPage = (): boolean => {
  return isAdmin(); // Admin only
};

export const canAccessSettingsPage = (): boolean => {
  return isAdmin(); // Admin only
};

export const canAccessDashboard = (): boolean => {
  return hasAnyRole([ROLES.USER, ROLES.ADMIN]); // All authenticated users
};

export const canAccessAttendance = (): boolean => {
  return hasAnyRole([ROLES.USER, ROLES.ADMIN]); // All authenticated users
};

export const canAccessDocuments = (): boolean => {
  return hasAnyRole([ROLES.USER, ROLES.ADMIN]); // All authenticated users
};

export const canAccessLetters = (): boolean => {
  return hasAnyRole([ROLES.USER, ROLES.ADMIN]); // All authenticated users
};

/**
 * Feature-specific access checks
 */
export const canApproveLoans = (): boolean => {
  return isAdmin();
};

export const canProcessPayroll = (): boolean => {
  return isAdmin();
};

export const canManageUsers = (): boolean => {
  return isAdmin();
};

export const canViewSalaries = (): boolean => {
  return isAdmin();
};

export const canEditSalaries = (): boolean => {
  return isAdmin();
};

export const canGenerateReports = (): boolean => {
  return isAdmin();
};

export const canExportData = (): boolean => {
  return isAdmin();
};

/**
 * Get user's role display names
 */
export const getUserRoleNames = (): string[] => {
  const user = getUser();
  if (!user || !user.roles) return [];
  
  return user.roles.map(role => {
    switch (role) {
      case ROLES.ADMIN:
        return 'Administrator';
      case ROLES.USER:
        return 'User';
      default:
        return role;
    }
  });
};

/**
 * Get primary role (highest permission level)
 */
export const getPrimaryRole = (): string => {
  if (isAdmin()) return ROLES.ADMIN;
  if (isUserRole()) return ROLES.USER;
  return 'Unknown';
};

/**
 * Get primary role display name
 */
export const getPrimaryRoleDisplayName = (): string => {
  const primaryRole = getPrimaryRole();
  switch (primaryRole) {
    case ROLES.ADMIN:
      return 'Administrator';
    case ROLES.USER:
      return 'User';
    default:
      return 'Unknown';
  }
};

/**
 * Check if user has any roles at all
 */
export const hasAnyRoles = (): boolean => {
  const user = getUser();
  return user?.roles && user.roles.length > 0;
};

/**
 * Get role badge color
 */
export const getRoleBadgeColor = (role: string): { bg: string; text: string } => {
  switch (role) {
    case ROLES.ADMIN:
      return { bg: 'bg-red-100', text: 'text-red-700' };
    case ROLES.USER:
      return { bg: 'bg-blue-100', text: 'text-blue-700' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700' };
  }
};

/**
 * Filter array of items based on required role
 * Useful for filtering menu items, buttons, etc.
 */
export const filterByRole = <T extends { requiredRole?: string; requiredAnyRole?: string[] }>(
  items: T[]
): T[] => {
  return items.filter(item => {
    if (item.requiredRole) {
      return hasRole(item.requiredRole);
    }
    if (item.requiredAnyRole) {
      return hasAnyRole(item.requiredAnyRole);
    }
    return true; // No role requirement
  });
};

/**
 * Check if action is allowed based on role
 */
export const isActionAllowed = (action: string): boolean => {
  const actionPermissions: Record<string, () => boolean> = {
    'create-employee': canCreate,
    'edit-employee': canEdit,
    'delete-employee': canDelete,
    'view-employee': canView,
    'approve-loan': canApproveLoans,
    'process-payroll': canProcessPayroll,
    'manage-users': canManageUsers,
    'view-salaries': canViewSalaries,
    'edit-salaries': canEditSalaries,
    'generate-reports': canGenerateReports,
    'export-data': canExportData,
  };

  const checkFn = actionPermissions[action];
  return checkFn ? checkFn() : false;
};

/**
 * Get all permissions for current user
 */
export const getUserPermissions = (): string[] => {
  const permissions: string[] = [];
  
  if (canView()) permissions.push('view');
  if (canCreate()) permissions.push('create');
  if (canEdit()) permissions.push('edit');
  if (canDelete()) permissions.push('delete');
  if (canApproveLoans()) permissions.push('approve-loans');
  if (canProcessPayroll()) permissions.push('process-payroll');
  if (canManageUsers()) permissions.push('manage-users');
  if (canGenerateReports()) permissions.push('generate-reports');
  if (canExportData()) permissions.push('export-data');
  
  return permissions;
};

/**
 * Check if user has permission
 */
export const hasPermission = (permission: string): boolean => {
  const permissions = getUserPermissions();
  return permissions.includes(permission);
};

export default {
  ROLES,
  isUserAdmin,
  isUserRole,
  canCreate,
  canEdit,
  canDelete,
  canView,
  canAccessEmployeesPage,
  canAccessNewEmployeePage,
  canAccessDesignationsPage,
  canAccessPayrollPage,
  canAccessLoansPage,
  canAccessAdvancesPage,
  canAccessPayRunPage,
  canAccessSettingsPage,
  canAccessDashboard,
  canAccessAttendance,
  canAccessDocuments,
  canAccessLetters,
  canApproveLoans,
  canProcessPayroll,
  canManageUsers,
  canViewSalaries,
  canEditSalaries,
  canGenerateReports,
  canExportData,
  getUserRoleNames,
  getPrimaryRole,
  getPrimaryRoleDisplayName,
  hasAnyRoles,
  getRoleBadgeColor,
  filterByRole,
  isActionAllowed,
  getUserPermissions,
  hasPermission,
};
