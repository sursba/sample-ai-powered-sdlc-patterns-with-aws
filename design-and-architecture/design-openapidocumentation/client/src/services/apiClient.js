/**
 * Authenticated API client for backend communication
 * Communicates with Lambda Function URL using AWS IAM authentication via Cognito Identity Pool
 */

import axios from 'axios';
import authService from './authService';
import awsClient from './awsClient';

class ApiClient {
  constructor() {
    // Use Lambda Function URL for backend API
    this.baseURL = process.env.REACT_APP_API_URL ||
      'https://dcd3olvneixfqeylzz2qpqprxa0favmv.lambda-url.eu-west-1.on.aws';
    this.client = null;
    this.isRefreshing = false;
    this.failedQueue = [];
    this.sessionId = this.getOrCreateSessionId();

    // Initialize project management
    this.currentProject = this.getStoredProject() || 'default-project';


    this.initializeClient();
  }

  /**
   * Get existing session ID from localStorage or create a new one
   */
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('api-session-id');
    if (!sessionId) {
      sessionId = this.generateUUID();
      localStorage.setItem('api-session-id', sessionId);
    }
    return sessionId;
  }

  /**
   * Generate a simple UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get current session ID
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Create a new session
   */
  createNewSession() {
    this.sessionId = this.generateUUID();
    localStorage.setItem('api-session-id', this.sessionId);
    return this.sessionId;
  }

  /**
   * Convert file to base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove data:image/jpeg;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }



  /**
   * Initialize the axios client with interceptors
   */
  initializeClient() {
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 300000, // 5 minutes for long-running operations
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add JWT authentication token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          // Handle FormData requests by converting to base64 JSON
          if (config.data instanceof FormData) {

            // Convert FormData to a signable JSON format
            const formDataObj = {};
            for (let [key, value] of config.data.entries()) {
              if (value instanceof File) {
                // Convert file to base64
                const base64 = await this.fileToBase64(value);
                formDataObj[key] = {
                  name: value.name,
                  type: value.type,
                  size: value.size,
                  data: base64
                };
              } else {
                formDataObj[key] = value;
              }
            }

            // Replace FormData with JSON
            config.data = JSON.stringify(formDataObj);
            config.headers['Content-Type'] = 'application/json';
          }

          // Add JWT token for authentication
          const token = await authService.getAuthToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          // Add session ID to headers
          config.headers['X-Session-ID'] = this.sessionId;

          // Add user information for IAM authentication
          const user = authService.getCurrentUser();
          if (user) {
            config.headers['X-User-Email'] = user.email;
            config.headers['X-User-ID'] = user.sub;
            config.headers['X-User-Username'] = user.username;
          }

          return config;
        } catch (error) {
          return config; // Continue without auth if it fails
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401/403 errors (unauthorized/forbidden)
        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue the request
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(() => {
              return this.client(originalRequest);
            }).catch(err => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            // Refresh AWS credentials by reinitializing
            this.signer = null;
            this.credentials = null;

            const refreshedTokens = await authService.refreshToken();

            if (refreshedTokens) {
              // Process queued requests
              this.processQueue(null);

              // Retry original request (will be signed with new credentials)
              return this.client(originalRequest);
            } else {
              // Refresh failed, redirect to login
              this.processQueue(new Error('Token refresh failed'));
              this.handleAuthenticationFailure();
              return Promise.reject(error);
            }
          } catch (refreshError) {
            this.processQueue(refreshError);
            this.handleAuthenticationFailure();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Process queued requests after token refresh
   * @private
   */
  processQueue(error, token = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });

    this.failedQueue = [];
  }

  /**
   * Handle authentication failure
   * @private
   */
  handleAuthenticationFailure() {
    // Clear authentication state and redirect to login
    authService.signOut();
  }

  /**
   * GET request - tries AWS IAM authentication first, falls back to JWT
   */
  async get(url, config = {}) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        console.log('User not authenticated, redirecting to login');
        authService.login();
        throw new Error('User not authenticated');
      }

      // Add project name as query parameter for GET requests
      const urlWithProject = this.addProjectToUrl(url);

      const tokens = authService.getTokens();

      // Convert problematic GET requests to POST requests for AWS IAM compatibility
      const problematicGetEndpoints = [
        '/api/specs',
        '/api/openapi',
        '/api/image-status',
        '/api/analysis-content',
        '/api/projects',
        '/api/documentation'
      ];
      
      const shouldConvertToPost = problematicGetEndpoints.some(endpoint => 
        urlWithProject.includes(endpoint)
      );
      
      if (shouldConvertToPost) {
        // Use POST with project information in body instead of query params
        const projectName = this.currentProject;
        
        // For URLs with path parameters, we need to preserve them
        // Extract any path parameters from the original URL
        const urlObj = new URL(urlWithProject, 'https://example.com');
        const pathWithParams = urlObj.pathname + urlObj.search.replace(/[?&]projectName=[^&]*/g, '').replace(/^&/, '?').replace(/\?$/, '');
        
        return await awsClient.post(pathWithParams, { projectName });
      }
      
      // For other GET requests, try AWS IAM authentication
      try {
        return await awsClient.get(urlWithProject);
      } catch (awsError) {
        throw awsError;
      }
    } catch (error) {
      console.error('GET request error:', error);

      // Handle authentication errors
      if (error.message.includes('User must be authenticated') ||
        error.message.includes('No valid ID token') ||
        error.message.includes('Unauthenticated access') ||
        error.message.includes('NotAuthorizedException')) {
        console.log('Authentication error detected, redirecting to login');
        authService.login();
        throw new Error('Authentication required');
      }

      // Try token refresh if we have authentication issues
      if (error.message.includes('credentials') ||
        error.message.includes('authentication') ||
        error.response?.status === 401 ||
        error.response?.status === 403) {
        try {
          console.log('Attempting to refresh tokens for GET...');
          const refreshedTokens = await authService.refreshToken();

          if (refreshedTokens) {
            console.log('Tokens refreshed, retrying GET request with JWT...');
            const urlWithProject = this.addProjectToUrl(url);
            const response = await this.client.get(urlWithProject, {
              ...config,
              headers: {
                ...config.headers,
                'Authorization': `Bearer ${refreshedTokens.idToken}`,
                'Content-Type': 'application/json'
              }
            });
            return response.data;
          } else {
            throw new Error('Token refresh failed');
          }
        } catch (retryError) {
          console.error('Token refresh and retry failed for GET:', retryError);
          authService.login();
          throw new Error('Authentication required');
        }
      }

      throw this.handleError(error);
    }
  }

  /**
   * POST request - tries AWS IAM authentication first, falls back to JWT
   */
  async post(url, data = {}, config = {}) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        console.log('User not authenticated, redirecting to login');
        authService.login();
        throw new Error('User not authenticated');
      }

      // Add project information to request body
      const requestData = {
        ...data,
        projectName: this.currentProject
      };

      const tokens = authService.getTokens();

      // Try AWS IAM authentication first
      try {
        console.log('Attempting AWS IAM authentication for POST...');
        return await awsClient.post(url, requestData);
      } catch (awsError) {
        console.warn('AWS IAM authentication failed for POST:', awsError.message);

        // If AWS IAM fails, try direct JWT authentication
        console.log('Falling back to JWT authentication for POST...');

        if (!tokens || !tokens.idToken) {
          throw new Error('No JWT tokens available for fallback authentication');
        }

        // Make direct request with JWT token
        const response = await this.client.post(url, requestData, {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${tokens.idToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('JWT authentication successful for POST');
        return response.data;
      }
    } catch (error) {
      console.error('POST request error:', error);

      // Handle authentication errors
      if (error.message.includes('User must be authenticated') ||
        error.message.includes('No valid ID token') ||
        error.message.includes('Unauthenticated access') ||
        error.message.includes('NotAuthorizedException')) {
        console.log('Authentication error detected, redirecting to login');
        authService.login();
        throw new Error('Authentication required');
      }

      // Try token refresh if we have authentication issues
      if (error.message.includes('credentials') ||
        error.message.includes('authentication') ||
        error.response?.status === 401 ||
        error.response?.status === 403) {
        try {
          console.log('Attempting to refresh tokens for POST...');
          const refreshedTokens = await authService.refreshToken();

          if (refreshedTokens) {
            console.log('Tokens refreshed, retrying POST request with JWT...');
            const response = await this.client.post(url, requestData, {
              ...config,
              headers: {
                ...config.headers,
                'Authorization': `Bearer ${refreshedTokens.idToken}`,
                'Content-Type': 'application/json'
              }
            });
            return response.data;
          } else {
            throw new Error('Token refresh failed');
          }
        } catch (retryError) {
          console.error('Token refresh and retry failed for POST:', retryError);
          authService.login();
          throw new Error('Authentication required');
        }
      }

      throw this.handleError(error);
    }
  }

  /**
   * PUT request - tries AWS IAM authentication first, falls back to JWT
   */
  async put(url, data = {}, config = {}) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        console.log('User not authenticated, redirecting to login');
        authService.login();
        throw new Error('User not authenticated');
      }

      // Add project information to request body
      const requestData = {
        ...data,
        projectName: this.currentProject
      };

      const tokens = authService.getTokens();

      // Try AWS IAM authentication first
      try {
        console.log('Attempting AWS IAM authentication for PUT...');
        return await awsClient.put(url, requestData);
      } catch (awsError) {
        console.warn('AWS IAM authentication failed for PUT:', awsError.message);

        // If AWS IAM fails, try direct JWT authentication
        console.log('Falling back to JWT authentication for PUT...');

        if (!tokens || !tokens.idToken) {
          throw new Error('No JWT tokens available for fallback authentication');
        }

        // Make direct request with JWT token
        const response = await this.client.put(url, requestData, {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${tokens.idToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('JWT authentication successful for PUT');
        return response.data;
      }
    } catch (error) {
      console.error('PUT request error:', error);

      // Handle authentication errors
      if (error.message.includes('User must be authenticated') ||
        error.message.includes('No valid ID token') ||
        error.message.includes('Unauthenticated access') ||
        error.message.includes('NotAuthorizedException')) {
        console.log('Authentication error detected, redirecting to login');
        authService.login();
        throw new Error('Authentication required');
      }

      // Try token refresh if we have authentication issues
      if (error.message.includes('credentials') ||
        error.message.includes('authentication') ||
        error.response?.status === 401 ||
        error.response?.status === 403) {
        try {
          console.log('Attempting to refresh tokens for PUT...');
          const refreshedTokens = await authService.refreshToken();

          if (refreshedTokens) {
            console.log('Tokens refreshed, retrying PUT request with JWT...');
            const response = await this.client.put(url, requestData, {
              ...config,
              headers: {
                ...config.headers,
                'Authorization': `Bearer ${refreshedTokens.idToken}`,
                'Content-Type': 'application/json'
              }
            });
            return response.data;
          } else {
            throw new Error('Token refresh failed');
          }
        } catch (retryError) {
          console.error('Token refresh and retry failed for PUT:', retryError);
          authService.login();
          throw new Error('Authentication required');
        }
      }

      throw this.handleError(error);
    }
  }

  /**
   * DELETE request - tries AWS IAM authentication first, falls back to JWT
   */
  async delete(url, config = {}) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        console.log('User not authenticated, redirecting to login');
        authService.login();
        throw new Error('User not authenticated');
      }

      const tokens = authService.getTokens();

      // Try AWS IAM authentication first
      try {
        console.log('Attempting AWS IAM authentication for DELETE...');
        return await awsClient.delete(url);
      } catch (awsError) {
        console.warn('AWS IAM authentication failed for DELETE:', awsError.message);

        // If AWS IAM fails, try direct JWT authentication
        console.log('Falling back to JWT authentication for DELETE...');

        if (!tokens || !tokens.idToken) {
          throw new Error('No JWT tokens available for fallback authentication');
        }

        // Make direct request with JWT token
        const response = await this.client.delete(url, {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${tokens.idToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('JWT authentication successful for DELETE');
        return response.data;
      }
    } catch (error) {
      console.error('DELETE request error:', error);

      // Handle authentication errors
      if (error.message.includes('User must be authenticated') ||
        error.message.includes('No valid ID token') ||
        error.message.includes('Unauthenticated access') ||
        error.message.includes('NotAuthorizedException')) {
        console.log('Authentication error detected, redirecting to login');
        authService.login();
        throw new Error('Authentication required');
      }

      // Try token refresh if we have authentication issues
      if (error.message.includes('credentials') ||
        error.message.includes('authentication') ||
        error.response?.status === 401 ||
        error.response?.status === 403) {
        try {
          console.log('Attempting to refresh tokens for DELETE...');
          const refreshedTokens = await authService.refreshToken();

          if (refreshedTokens) {
            console.log('Tokens refreshed, retrying DELETE request with JWT...');
            const response = await this.client.delete(url, {
              ...config,
              headers: {
                ...config.headers,
                'Authorization': `Bearer ${refreshedTokens.idToken}`,
                'Content-Type': 'application/json'
              }
            });
            return response.data;
          } else {
            throw new Error('Token refresh failed');
          }
        } catch (retryError) {
          console.error('Token refresh and retry failed for DELETE:', retryError);
          authService.login();
          throw new Error('Authentication required');
        }
      }

      throw this.handleError(error);
    }
  }

  /**
   * PATCH request - tries AWS IAM authentication first, falls back to JWT
   */
  async patch(url, data = {}, config = {}) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        console.log('User not authenticated, redirecting to login');
        authService.login();
        throw new Error('User not authenticated');
      }

      // Add project information to request body
      const requestData = {
        ...data,
        projectName: this.currentProject
      };

      const tokens = authService.getTokens();

      // Try AWS IAM authentication first
      try {
        console.log('Attempting AWS IAM authentication for PATCH...');
        return await awsClient.patch(url, requestData);
      } catch (awsError) {
        console.warn('AWS IAM authentication failed for PATCH:', awsError.message);

        // If AWS IAM fails, try direct JWT authentication
        console.log('Falling back to JWT authentication for PATCH...');

        if (!tokens || !tokens.idToken) {
          throw new Error('No JWT tokens available for fallback authentication');
        }

        // Make direct request with JWT token
        const response = await this.client.patch(url, requestData, {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': `Bearer ${tokens.idToken}`,
            'Content-Type': 'application/json'
          }
        });

        console.log('JWT authentication successful for PATCH');
        return response.data;
      }
    } catch (error) {
      console.error('PATCH request error:', error);

      // Handle authentication errors
      if (error.message.includes('User must be authenticated') ||
        error.message.includes('No valid ID token') ||
        error.message.includes('Unauthenticated access') ||
        error.message.includes('NotAuthorizedException')) {
        console.log('Authentication error detected, redirecting to login');
        authService.login();
        throw new Error('Authentication required');
      }

      // Try token refresh if we have authentication issues
      if (error.message.includes('credentials') ||
        error.message.includes('authentication') ||
        error.response?.status === 401 ||
        error.response?.status === 403) {
        try {
          console.log('Attempting to refresh tokens for PATCH...');
          const refreshedTokens = await authService.refreshToken();

          if (refreshedTokens) {
            console.log('Tokens refreshed, retrying PATCH request with JWT...');
            const response = await this.client.patch(url, requestData, {
              ...config,
              headers: {
                ...config.headers,
                'Authorization': `Bearer ${refreshedTokens.idToken}`,
                'Content-Type': 'application/json'
              }
            });
            return response.data;
          } else {
            throw new Error('Token refresh failed');
          }
        } catch (retryError) {
          console.error('Token refresh and retry failed for PATCH:', retryError);
          authService.login();
          throw new Error('Authentication required');
        }
      }

      throw this.handleError(error);
    }
  }

  /**
   * Upload file with progress tracking - uses AWS IAM authentication
   */
  async uploadFile(url, file, onProgress = null) {
    try {
      // Check if user is authenticated
      if (!authService.isAuthenticated()) {
        throw new Error('User not authenticated');
      }

      // Use AWS client for authenticated file uploads with project information
      return await awsClient.uploadFile(url, file, 'image', { projectName: this.currentProject });
    } catch (error) {
      // Fallback to axios for backward compatibility
      if (error.message.includes('credentials') || error.message.includes('authentication')) {
        try {
          await awsClient.refreshCredentials();
          return await awsClient.uploadFile(url, file, 'image', { projectName: this.currentProject });
        } catch (retryError) {
          console.error('AWS client file upload retry failed, falling back to axios:', retryError);

          // Fallback to original FormData approach
          const formData = new FormData();
          formData.append('image', file);

          const config = {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          };

          if (onProgress) {
            config.onUploadProgress = (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onProgress(percentCompleted);
            };
          }

          const response = await this.client.post(url, formData, config);
          return response.data;
        }
      }
      throw this.handleError(error);
    }
  }

  /**
   * Make a request without authentication (for public endpoints)
   */
  async publicRequest(method, url, data = null, config = {}) {
    try {
      const publicClient = axios.create({
        baseURL: this.baseURL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await publicClient.request({
        method,
        url,
        data,
        ...config,
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle and format errors
   * @private
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      return {
        status,
        message: data?.message || data?.error || `HTTP ${status} Error`,
        details: data?.details || null,
        isNetworkError: false,
        isAuthError: status === 401 || status === 403,
      };
    } else if (error.request) {
      // Network error
      return {
        status: 0,
        message: 'Network error. Please check your connection.',
        details: null,
        isNetworkError: true,
        isAuthError: false,
      };
    } else {
      // Other error
      return {
        status: 0,
        message: error.message || 'An unexpected error occurred',
        details: null,
        isNetworkError: false,
        isAuthError: false,
      };
    }
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured() {
    return !!this.baseURL;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      baseURL: this.baseURL,
      timeout: this.client?.defaults?.timeout || 30000,
    };
  }

  /**
   * Update base URL
   */
  setBaseURL(url) {
    this.baseURL = url;
    if (this.client) {
      this.client.defaults.baseURL = url;
    }
  }

  /**
   * Add custom request interceptor
   */
  addRequestInterceptor(onFulfilled, onRejected) {
    return this.client.interceptors.request.use(onFulfilled, onRejected);
  }

  /**
   * Add custom response interceptor
   */
  addResponseInterceptor(onFulfilled, onRejected) {
    return this.client.interceptors.response.use(onFulfilled, onRejected);
  }

  /**
   * Remove interceptor
   */
  removeInterceptor(type, interceptorId) {
    if (type === 'request') {
      this.client.interceptors.request.eject(interceptorId);
    } else if (type === 'response') {
      this.client.interceptors.response.eject(interceptorId);
    }
  }

  // Project Management Methods

  /**
   * Get stored project from localStorage
   * @private
   */
  getStoredProject() {
    return localStorage.getItem('current-project');
  }

  /**
   * Store project in localStorage
   * @private
   */
  setStoredProject(projectName) {
    localStorage.setItem('current-project', projectName);
  }

  /**
   * Get current project name
   */
  getProjectName() {
    return this.currentProject;
  }

  /**
   * Get current project (alias for getProjectName)
   */
  getCurrentProject() {
    return this.currentProject;
  }

  /**
   * Set current project
   */
  setCurrentProject(projectName) {
    if (!projectName || typeof projectName !== 'string') {
      console.warn('Invalid project name provided:', projectName);
      return this.currentProject;
    }

    const safeProjectName = projectName.trim();
    this.currentProject = safeProjectName;
    this.setStoredProject(safeProjectName);

    console.log('Project set to:', safeProjectName);
    return safeProjectName;
  }

  /**
   * Reset project to default
   */
  resetProject() {
    return this.setCurrentProject('default-project');
  }

  /**
   * Add project name as query parameter to URL
   * @private
   */
  addProjectToUrl(url) {
    if (!this.currentProject) {
      return url;
    }

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}projectName=${encodeURIComponent(this.currentProject)}`;
  }
}

// Create and export singleton instance
const apiClient = new ApiClient();
export default apiClient;