/**
 * Unit tests for ApiClient
 * Tests authenticated HTTP client functionality
 */

import axios from 'axios';

// Mock axios
jest.mock('axios');

// Mock authService
jest.mock('../authService', () => ({
  getAuthToken: jest.fn(),
  refreshToken: jest.fn(),
  signOut: jest.fn(),
}));

const mockedAxios = axios;

describe('ApiClient', () => {
  let mockAxiosInstance;
  let apiClient;
  let authService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
          eject: jest.fn(),
        },
        response: {
          use: jest.fn(),
          eject: jest.fn(),
        },
      },
      defaults: {
        baseURL: 'http://localhost:3001',
        timeout: 30000,
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Mock environment variables
    process.env.REACT_APP_API_ENDPOINT = 'http://localhost:3001';
    
    // Import modules after setting up mocks
    authService = require('../authService').default;
    apiClient = require('../apiClient').default;
  });

  describe('initialization', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3001',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should set up request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('request interceptor', () => {
    let requestInterceptor;

    beforeEach(() => {
      // Get the request interceptor function
      requestInterceptor = mockAxiosInstance.interceptors.request.use.mock.calls[0][0];
    });

    it('should add Authorization header when token is available', async () => {
      const mockToken = 'mock-access-token';
      authService.getAuthToken.mockResolvedValue(mockToken);

      const config = { headers: {} };
      const result = await requestInterceptor(config);

      expect(authService.getAuthToken).toHaveBeenCalled();
      expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should not add Authorization header when no token is available', async () => {
      authService.getAuthToken.mockResolvedValue(null);

      const config = { headers: {} };
      const result = await requestInterceptor(config);

      expect(authService.getAuthToken).toHaveBeenCalled();
      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor', () => {
    let responseInterceptor;
    let responseErrorHandler;

    beforeEach(() => {
      // Get the response interceptor functions
      const interceptorCall = mockAxiosInstance.interceptors.response.use.mock.calls[0];
      responseInterceptor = interceptorCall[0];
      responseErrorHandler = interceptorCall[1];
    });

    it('should pass through successful responses', () => {
      const mockResponse = { data: 'test data' };
      const result = responseInterceptor(mockResponse);
      expect(result).toBe(mockResponse);
    });

    it('should handle 401 errors with token refresh', async () => {
      const mockError = {
        response: { status: 401 },
        config: { headers: {} },
      };

      const mockRefreshedTokens = {
        accessToken: 'new-access-token',
        idToken: 'new-id-token',
        refreshToken: 'new-refresh-token',
      };

      authService.refreshToken.mockResolvedValue(mockRefreshedTokens);
      mockAxiosInstance.request.mockResolvedValue({ data: 'success' });

      const result = await responseErrorHandler(mockError);

      expect(authService.refreshToken).toHaveBeenCalled();
      expect(mockError.config.headers.Authorization).toBe('Bearer new-access-token');
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(mockError.config);
    });

    it('should handle failed token refresh by signing out', async () => {
      const mockError = {
        response: { status: 401 },
        config: { headers: {} },
      };

      authService.refreshToken.mockResolvedValue(null);
      authService.signOut.mockResolvedValue();

      await expect(responseErrorHandler(mockError)).rejects.toBe(mockError);
      expect(authService.signOut).toHaveBeenCalled();
    });

    it('should pass through non-401 errors', async () => {
      const mockError = {
        response: { status: 500 },
        config: { headers: {} },
      };

      await expect(responseErrorHandler(mockError)).rejects.toBe(mockError);
      expect(authService.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      // Reset the mock to avoid interference from constructor calls
      jest.clearAllMocks();
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
    });

    it('should make GET requests correctly', async () => {
      const mockResponse = { data: 'test data' };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await apiClient.get('/test');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', {});
      expect(result).toBe('test data');
    });

    it('should make POST requests correctly', async () => {
      const mockResponse = { data: 'created' };
      const postData = { name: 'test' };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiClient.post('/test', postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', postData, {});
      expect(result).toBe('created');
    });

    it('should make PUT requests correctly', async () => {
      const mockResponse = { data: 'updated' };
      const putData = { id: 1, name: 'updated' };
      mockAxiosInstance.put.mockResolvedValue(mockResponse);

      const result = await apiClient.put('/test/1', putData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test/1', putData, {});
      expect(result).toBe('updated');
    });

    it('should make DELETE requests correctly', async () => {
      const mockResponse = { data: 'deleted' };
      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      const result = await apiClient.delete('/test/1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test/1', {});
      expect(result).toBe('deleted');
    });

    it('should make PATCH requests correctly', async () => {
      const mockResponse = { data: 'patched' };
      const patchData = { name: 'patched' };
      mockAxiosInstance.patch.mockResolvedValue(mockResponse);

      const result = await apiClient.patch('/test/1', patchData);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/test/1', patchData, {});
      expect(result).toBe('patched');
    });
  });

  describe('file upload', () => {
    it('should upload files with progress tracking', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const mockResponse = { data: 'uploaded' };
      const mockProgressCallback = jest.fn();

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await apiClient.uploadFile('/upload', mockFile, mockProgressCallback);

      expect(mockAxiosInstance.post).toHaveBeenCalled();
      const [url, formData, config] = mockAxiosInstance.post.mock.calls[0];
      
      expect(url).toBe('/upload');
      expect(formData).toBeInstanceOf(FormData);
      expect(config.headers['Content-Type']).toBe('multipart/form-data');
      expect(config.onUploadProgress).toBeDefined();
      expect(result).toBe('uploaded');
    });
  });

  describe('public requests', () => {
    it('should make public requests without authentication', async () => {
      const mockPublicClient = {
        request: jest.fn().mockResolvedValue({ data: 'public data' }),
      };
      
      mockedAxios.create.mockReturnValue(mockPublicClient);

      const result = await apiClient.publicRequest('GET', '/public');

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:3001',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      expect(mockPublicClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/public',
        data: null,
      });
      expect(result).toBe('public data');
    });
  });

  describe('error handling', () => {
    it('should handle response errors correctly', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { message: 'Bad Request', details: 'Invalid input' },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(apiClient.get('/test')).rejects.toEqual({
        status: 400,
        message: 'Bad Request',
        details: 'Invalid input',
        isNetworkError: false,
        isAuthError: false,
      });
    });

    it('should handle network errors correctly', async () => {
      const mockError = {
        request: {},
        message: 'Network Error',
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(apiClient.get('/test')).rejects.toEqual({
        status: 0,
        message: 'Network error. Please check your connection.',
        details: null,
        isNetworkError: true,
        isAuthError: false,
      });
    });

    it('should identify auth errors correctly', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(apiClient.get('/test')).rejects.toEqual({
        status: 401,
        message: 'Unauthorized',
        details: null,
        isNetworkError: false,
        isAuthError: true,
      });
    });
  });

  describe('configuration methods', () => {
    it('should check if client is configured', () => {
      expect(apiClient.isConfigured()).toBe(true);
    });

    it('should get current configuration', () => {
      const config = apiClient.getConfig();
      expect(config).toEqual({
        baseURL: 'http://localhost:3001',
        timeout: 30000,
      });
    });

    it('should update base URL', () => {
      apiClient.setBaseURL('http://new-api.com');
      expect(apiClient.baseURL).toBe('http://new-api.com');
    });
  });

  describe('interceptor management', () => {
    it('should add custom request interceptor', () => {
      const mockInterceptor = jest.fn();
      const mockErrorHandler = jest.fn();
      
      mockAxiosInstance.interceptors.request.use.mockReturnValue(123);
      
      const interceptorId = apiClient.addRequestInterceptor(mockInterceptor, mockErrorHandler);
      
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledWith(
        mockInterceptor,
        mockErrorHandler
      );
      expect(interceptorId).toBe(123);
    });

    it('should add custom response interceptor', () => {
      const mockInterceptor = jest.fn();
      const mockErrorHandler = jest.fn();
      
      mockAxiosInstance.interceptors.response.use.mockReturnValue(456);
      
      const interceptorId = apiClient.addResponseInterceptor(mockInterceptor, mockErrorHandler);
      
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(
        mockInterceptor,
        mockErrorHandler
      );
      expect(interceptorId).toBe(456);
    });

    it('should remove request interceptor', () => {
      mockAxiosInstance.interceptors.request.eject = jest.fn();
      
      apiClient.removeInterceptor('request', 123);
      
      expect(mockAxiosInstance.interceptors.request.eject).toHaveBeenCalledWith(123);
    });

    it('should remove response interceptor', () => {
      mockAxiosInstance.interceptors.response.eject = jest.fn();
      
      apiClient.removeInterceptor('response', 456);
      
      expect(mockAxiosInstance.interceptors.response.eject).toHaveBeenCalledWith(456);
    });
  });
});