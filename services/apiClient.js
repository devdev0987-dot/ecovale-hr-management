import axios from 'axios';

/**
 * Axios API Client for Ecovale HR Backend
 * Centralized HTTP client with interceptors for request/response handling
 */

// Get base URL from environment variables with fallback
// NOTE: Vite only exposes variables prefixed with VITE_ to client code
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000;

// Log configuration in development mode
if (import.meta.env.DEV) {
  console.log('🔧 API Client Configuration:');
  console.log('  Base URL:', API_BASE_URL);
  console.log('  Timeout:', API_TIMEOUT, 'ms');
}

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * Request Interceptor
 * Add JWT authorization token to all requests
 */
apiClient.interceptors.request.use(
  (config) => {
    // Log request for debugging in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method.toUpperCase()} ${config.url}`, config.data);
    }

    // Add JWT token from localStorage to Authorization header
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * Handle successful responses and errors globally (including JWT errors)
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log response for debugging in development
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.url}`, response.data);
    }

    // Extract data from standard API response format { success, message, data }
    if (response.data && response.data.success !== undefined) {
      return response.data; // Return { success, message, data }
    }

    return response.data; // Return raw data if not in standard format
  },
  (error) => {
    console.error('[API Response Error]', error);

    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status code
      const { status, data } = error.response;

      switch (status) {
        case 400:
          console.error('Bad Request:', data);
          break;
        
        case 401:
          // Unauthorized - JWT token is invalid, expired, or missing
          console.error('Unauthorized - Token invalid or expired');
          // Clear auth data and redirect to login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login') && 
              !window.location.pathname.includes('/') ||
              window.location.pathname.length > 1) {
            window.location.href = '/';
          }
          break;
        
        case 403:
          // Forbidden - User doesn't have required role/permission
          console.error('Forbidden - Insufficient permissions');
          break;
        
        case 404:
          console.error('Resource Not Found:', data);
          break;
        
        case 409:
          console.error('Conflict - Duplicate resource:', data);
          break;
        
        case 500:
          console.error('Server Error:', data);
          break;
        
        default:
          console.error('API Error:', data);
      }

      // Return standardized error
      return Promise.reject({
        success: false,
        message: data?.message || 'An error occurred',
        data: data?.data || null,
        status,
      });
    } else if (error.request) {
      // Request made but no response received
      console.error('Network Error - No response from server');
      return Promise.reject({
        success: false,
        message: 'Network error - Unable to reach server',
        data: null,
      });
    } else {
      // Something else happened
      console.error('Error:', error.message);
      return Promise.reject({
        success: false,
        message: error.message,
        data: null,
      });
    }
  }
);

/**
 * Generic API methods
 */
export const api = {
  /**
   * GET request
   * @param {string} url - API endpoint
   * @param {object} config - Axios config
   */
  get: async (url, config = {}) => {
    return await apiClient.get(url, config);
  },

  /**
   * POST request
   * @param {string} url - API endpoint
   * @param {object} data - Request body
   * @param {object} config - Axios config
   */
  post: async (url, data = {}, config = {}) => {
    return await apiClient.post(url, data, config);
  },

  /**
   * PUT request
   * @param {string} url - API endpoint
   * @param {object} data - Request body
   * @param {object} config - Axios config
   */
  put: async (url, data = {}, config = {}) => {
    return await apiClient.put(url, data, config);
  },

  /**
   * DELETE request
   * @param {string} url - API endpoint
   * @param {object} config - Axios config
   */
  delete: async (url, config = {}) => {
    return await apiClient.delete(url, config);
  },

  /**
   * PATCH request
   * @param {string} url - API endpoint
   * @param {object} data - Request body
   * @param {object} config - Axios config
   */
  patch: async (url, data = {}, config = {}) => {
    return await apiClient.patch(url, data, config);
  },
};

export default apiClient;
