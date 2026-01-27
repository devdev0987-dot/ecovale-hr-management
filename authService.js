import apiClient from './apiClient';

/**
 * Authentication Service
 * Handles user authentication, token management, and session storage
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/**
 * Login user with credentials
 * @param {string} username - User's username
 * @param {string} password - User's password
 * @returns {Promise<Object>} User data and token
 */
export const login = async (username, password) => {
  try {
    const response = await apiClient.post('/auth/login', {
      username,
      password,
    });

    const { token, ...userData } = response.data;

    // Store token and user data
    if (token) {
      setToken(token);
      setUser(userData);
    }

    return response.data;
  } catch (error) {
    // Clear any existing auth data on login failure
    clearAuth();
    throw error;
  }
};

/**
 * Register new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Registration response
 */
export const register = async (userData) => {
  try {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Logout user and clear authentication data
 */
export const logout = () => {
  clearAuth();
  // Redirect to login page
  window.location.href = '/';
};

/**
 * Get current user info from backend
 * @returns {Promise<Object>} Current user data
 */
export const getCurrentUser = async () => {
  try {
    const response = await apiClient.get('/auth/me');
    const userData = response.data;
    setUser(userData);
    return userData;
  } catch (error) {
    clearAuth();
    throw error;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has valid token
 */
export const isAuthenticated = () => {
  const token = getToken();
  if (!token) return false;

  // Check if token is expired (basic client-side check)
  try {
    const payload = parseJwt(token);
    const currentTime = Date.now() / 1000;
    return payload.exp > currentTime;
  } catch (error) {
    return false;
  }
};

/**
 * Get stored authentication token
 * @returns {string|null} JWT token or null
 */
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Set authentication token
 * @param {string} token - JWT token to store
 */
export const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Get stored user data
 * @returns {Object|null} User data or null
 */
export const getUser = () => {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

/**
 * Set user data
 * @param {Object} userData - User data to store
 */
export const setUser = (userData) => {
  localStorage.setItem(USER_KEY, JSON.stringify(userData));
};

/**
 * Clear all authentication data
 */
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Check if user has specific role
 * @param {string} role - Role to check (e.g., 'ROLE_ADMIN')
 * @returns {boolean} True if user has the role
 */
export const hasRole = (role) => {
  const user = getUser();
  if (!user || !user.roles) return false;
  return user.roles.includes(role);
};

/**
 * Check if user has any of the specified roles
 * @param {Array<string>} roles - Array of roles to check
 * @returns {boolean} True if user has at least one role
 */
export const hasAnyRole = (roles) => {
  const user = getUser();
  if (!user || !user.roles) return false;
  return roles.some(role => user.roles.includes(role));
};

/**
 * Check if user is admin
 * @returns {boolean} True if user is admin
 */
export const isAdmin = () => {
  return hasRole('ROLE_ADMIN');
};

/**
 * Parse JWT token to extract payload
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    throw error;
  }
};

/**
 * Get user's display name
 * @returns {string} User's full name or username
 */
export const getUserDisplayName = () => {
  const user = getUser();
  return user?.fullName || user?.username || 'User';
};

/**
 * Get role display name (convert ROLE_ADMIN to "Administrator")
 * @param {string} role - Role string (e.g., "ROLE_ADMIN")
 * @returns {string} Display name
 */
export const getRoleDisplayName = (role) => {
  const roleNames = {
    'ROLE_ADMIN': 'Administrator',
    'ROLE_USER': 'User',
  };
  return roleNames[role] || role.replace('ROLE_', '');
};

/**
 * Refresh authentication state (useful after token refresh)
 */
export const refreshAuthState = async () => {
  if (!isAuthenticated()) {
    clearAuth();
    return null;
  }

  try {
    return await getCurrentUser();
  } catch (error) {
    clearAuth();
    return null;
  }
};

export default {
  login,
  register,
  logout,
  getCurrentUser,
  isAuthenticated,
  getToken,
  setToken,
  getUser,
  setUser,
  clearAuth,
  hasRole,
  hasAnyRole,
  isAdmin,
  getUserDisplayName,
  getRoleDisplayName,
  refreshAuthState,
};
