import React, { useEffect, useState } from 'react';
import { isAuthenticated, hasRole, hasAnyRole } from '../services/authService';

/**
 * ProtectedRoute Component
 * Wraps content that requires authentication and/or specific roles
 * 
 * Usage:
 * <ProtectedRoute>
 *   <EmployeesPage />
 * </ProtectedRoute>
 * 
 * <ProtectedRoute requireRole="ROLE_ADMIN">
 *   <AdminPanel />
 * </ProtectedRoute>
 * 
 * <ProtectedRoute requireAnyRole={['ROLE_ADMIN', 'ROLE_USER']}>
 *   <Dashboard />
 * </ProtectedRoute>
 */
const ProtectedRoute = ({ 
  children, 
  requireRole = null, 
  requireAnyRole = null,
  fallback = null,
  redirectTo = '/'
}) => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthorization();
  }, [requireRole, requireAnyRole]);

  const checkAuthorization = () => {
    setIsLoading(true);

    // Check authentication
    if (!isAuthenticated()) {
      console.log('User not authenticated, redirecting to login');
      setIsAuthorized(false);
      setIsLoading(false);
      // Redirect to login
      window.location.href = redirectTo;
      return;
    }

    // Check specific role requirement
    if (requireRole && !hasRole(requireRole)) {
      console.log(`User does not have required role: ${requireRole}`);
      setIsAuthorized(false);
      setIsLoading(false);
      return;
    }

    // Check any role requirement
    if (requireAnyRole && !hasAnyRole(requireAnyRole)) {
      console.log(`User does not have any of required roles: ${requireAnyRole.join(', ')}`);
      setIsAuthorized(false);
      setIsLoading(false);
      return;
    }

    // All checks passed
    setIsAuthorized(true);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    // Show fallback or unauthorized message
    if (fallback) {
      return fallback;
    }

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <div className="text-red-500 text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
