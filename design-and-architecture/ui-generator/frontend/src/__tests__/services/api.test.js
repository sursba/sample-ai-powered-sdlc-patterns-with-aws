import api from '../../services/api';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create to return the mocked axios instance
    mockedAxios.create.mockReturnValue(mockedAxios);
    
    // Mock interceptors
    mockedAxios.interceptors = {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    };
  });

  describe('generateMockup', () => {
    test('makes correct API call with default parameters', async () => {
      const mockResponse = {
        data: {
          success: true,
          image_url: 'http://localhost:8000/api/assets/test.png',
          filename: 'test.png'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await api.generateMockup('Create a login form');

      expect(mockedAxios.post).toHaveBeenCalledWith('/generate-mockup', {
        prompt: 'Create a login form',
        width: 1024,
        height: 1024,
        quality: 'standard'
      });

      expect(result).toEqual(mockResponse.data);
    });

    test('makes correct API call with custom parameters', async () => {
      const mockResponse = {
        data: { success: true, image_url: 'test.png', filename: 'test.png' }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await api.generateMockup('Create a dashboard', 800, 600, 'high');

      expect(mockedAxios.post).toHaveBeenCalledWith('/generate-mockup', {
        prompt: 'Create a dashboard',
        width: 800,
        height: 600,
        quality: 'high'
      });
    });

    test('handles API errors gracefully', async () => {
      const errorResponse = {
        response: {
          data: { error: 'Generation failed' }
        }
      };

      mockedAxios.post.mockRejectedValue(errorResponse);

      const result = await api.generateMockup('Test prompt');

      expect(result).toEqual({
        success: false,
        error: 'Generation failed'
      });
    });

    test('handles network errors', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.post.mockRejectedValue(networkError);

      const result = await api.generateMockup('Test prompt');

      expect(result).toEqual({
        success: false,
        error: 'Network Error'
      });
    });
  });

  describe('generateMultipleMockups', () => {
    test('makes correct API call with default parameters', async () => {
      const mockResponse = {
        data: {
          success: true,
          images: [
            { filename: 'image1.png', image_url: 'http://localhost:8000/api/assets/image1.png' },
            { filename: 'image2.png', image_url: 'http://localhost:8000/api/assets/image2.png' }
          ]
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await api.generateMultipleMockups('Create multiple designs');

      expect(mockedAxios.post).toHaveBeenCalledWith('/generate-multiple-mockups', {
        prompt: 'Create multiple designs',
        num_images: 4,
        width: 1024,
        height: 1024,
        quality: 'standard'
      });

      expect(result).toEqual(mockResponse.data);
    });

    test('makes correct API call with custom parameters', async () => {
      const mockResponse = {
        data: { success: true, images: [] }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await api.generateMultipleMockups('Test prompt', 6, 800, 600, 'high');

      expect(mockedAxios.post).toHaveBeenCalledWith('/generate-multiple-mockups', {
        prompt: 'Test prompt',
        num_images: 6,
        width: 800,
        height: 600,
        quality: 'high'
      });
    });
  });

  describe('downloadImage', () => {
    test('downloads image successfully', async () => {
      const mockBlob = new Blob(['mock image data']);
      const mockResponse = { data: mockBlob };

      mockedAxios.get.mockResolvedValue(mockResponse);

      // Mock DOM methods
      const mockLink = {
        href: '',
        setAttribute: jest.fn(),
        click: jest.fn(),
        remove: jest.fn()
      };

      global.document.createElement = jest.fn(() => mockLink);
      global.document.body.appendChild = jest.fn();
      global.URL.createObjectURL = jest.fn(() => 'mock-blob-url');
      global.URL.revokeObjectURL = jest.fn();

      const result = await api.downloadImage('test.png');

      expect(mockedAxios.get).toHaveBeenCalledWith('/download-image/test.png', {
        responseType: 'blob'
      });

      expect(result).toEqual({ success: true });
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
    });

    test('handles download errors', async () => {
      const errorResponse = {
        response: { data: { error: 'File not found' } }
      };

      mockedAxios.get.mockRejectedValue(errorResponse);

      const result = await api.downloadImage('nonexistent.png');

      expect(result).toEqual({
        success: false,
        error: 'File not found'
      });
    });
  });

  describe('generateDescription', () => {
    test('makes correct API call', async () => {
      const mockResponse = {
        data: {
          success: true,
          description: 'Generated UI description'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await api.generateDescription('Create a form');

      expect(mockedAxios.post).toHaveBeenCalledWith('/generate-description', {
        prompt: 'Create a form'
      });

      expect(result).toEqual(mockResponse.data);
    });

    test('handles errors gracefully', async () => {
      const errorResponse = {
        response: { data: { error: 'Description generation failed' } }
      };

      mockedAxios.post.mockRejectedValue(errorResponse);

      const result = await api.generateDescription('Test prompt');

      expect(result).toEqual({
        success: false,
        error: 'Description generation failed'
      });
    });
  });

  describe('generateComponents', () => {
    test('makes correct API call', async () => {
      const mockResponse = {
        data: {
          success: true,
          components: 'Generated component specifications'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await api.generateComponents('Create components');

      expect(mockedAxios.post).toHaveBeenCalledWith('/generate-components', {
        prompt: 'Create components'
      });

      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('checkAwsCredentials', () => {
    test('makes correct API call', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'AWS credentials are valid'
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await api.checkAwsCredentials();

      expect(mockedAxios.get).toHaveBeenCalledWith('/check-aws-credentials');
      expect(result).toEqual(mockResponse.data);
    });

    test('handles credential check errors', async () => {
      const errorResponse = {
        response: { data: { error: 'Invalid credentials' } }
      };

      mockedAxios.get.mockRejectedValue(errorResponse);

      const result = await api.checkAwsCredentials();

      expect(result).toEqual({
        success: false,
        error: 'Invalid credentials'
      });
    });
  });

  describe('checkBedrockAccess', () => {
    test('makes correct API call', async () => {
      const mockResponse = {
        data: {
          success: true,
          models: ['claude-3-sonnet', 'nova-canvas']
        }
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await api.checkBedrockAccess();

      expect(mockedAxios.get).toHaveBeenCalledWith('/check-bedrock-access');
      expect(result).toEqual(mockResponse.data);
    });

    test('handles Bedrock access errors', async () => {
      const errorResponse = {
        response: { data: { error: 'Bedrock access denied' } }
      };

      mockedAxios.get.mockRejectedValue(errorResponse);

      const result = await api.checkBedrockAccess();

      expect(result).toEqual({
        success: false,
        error: 'Bedrock access denied'
      });
    });
  });

  describe('Error handling', () => {
    test('handles errors without response data', async () => {
      const error = new Error('Unknown error');
      mockedAxios.post.mockRejectedValue(error);

      const result = await api.generateMockup('Test prompt');

      expect(result).toEqual({
        success: false,
        error: 'Unknown error'
      });
    });

    test('handles errors with empty response', async () => {
      const errorResponse = {
        response: { data: null }
      };

      mockedAxios.post.mockRejectedValue(errorResponse);

      const result = await api.generateMockup('Test prompt');

      expect(result).toEqual({
        success: false,
        error: 'Unknown error'
      });
    });

    test('handles request timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 180000ms exceeded'
      };

      mockedAxios.post.mockRejectedValue(timeoutError);

      const result = await api.generateMockup('Test prompt');

      expect(result).toEqual({
        success: false,
        error: 'timeout of 180000ms exceeded'
      });
    });
  });

  describe('Axios configuration', () => {
    test('creates axios instance with correct configuration', () => {
      // The module should have called axios.create during import
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8000/api',
        timeout: 180000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        withCredentials: false
      });
    });

    test('sets up request and response interceptors', () => {
      // The module should have set up interceptors
      expect(mockedAxios.interceptors.request.use).toHaveBeenCalled();
      expect(mockedAxios.interceptors.response.use).toHaveBeenCalled();
    });
  });
});
