import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  login as loginService, 
  logout as logoutService,
  isAuthenticated as checkAuth,
  getUser as getUserData,
  hasRole,
  hasAnyRole,
  isAdmin,
  getUserDisplayName,
  refreshAuthState
} from '../services/authService';

/**
 * Authentication Context
 * Provides global authentication state and methods
 */
const AuthContext = createContext(null);

/**
 * Custom hook to use auth context
 * @returns {Object} Auth context value
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * AuthProvider Component
 * Wraps the app to provide authentication state
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    setIsLoading(true);
    try {
      if (checkAuth()) {
        const userData = getUserData();
        setUser(userData);
        setIsAuthenticated(true);
        
        // Optionally refresh from server
        try {
          await refreshAuthState();
        } catch (error) {
          // If refresh fails, user will be logged out by interceptor
          console.error('Failed to refresh auth state:', error);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login user
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<Object>} User data
   */
  const login = async (username, password) => {
    try {
      const response = await loginService(username, password);
      setUser(response);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      throw error;
    }
  };

  /**
   * Logout user
   */
  const logout = () => {
    logoutService();
    setUser(null);
    setIsAuthenticated(false);
  };

  /**
   * Check if user has specific role
   * @param {string} role 
   * @returns {boolean}
   */
  const userHasRole = (role) => {
    return hasRole(role);
  };

  /**
   * Check if user has any of specified roles
   * @param {Array<string>} roles 
   * @returns {boolean}
   */
  const userHasAnyRole = (roles) => {
    return hasAnyRole(roles);
  };

  /**
   * Check if user is admin
   * @returns {boolean}
   */
  const userIsAdmin = () => {
    return isAdmin();
  };

  /**
   * Get user display name
   * @returns {string}
   */
  const getDisplayName = () => {
    return getUserDisplayName();
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasRole: userHasRole,
    hasAnyRole: userHasAnyRole,
    isAdmin: userIsAdmin,
    getDisplayName,
    refreshAuth: initializeAuth,
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
