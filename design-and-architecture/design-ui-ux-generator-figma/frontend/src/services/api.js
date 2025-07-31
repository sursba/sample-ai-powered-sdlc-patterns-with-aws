import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create axios instance with custom configuration
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 180000, // 180 seconds timeout (3 minutes) for Bedrock calls
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  // Don't send credentials with requests to avoid CORS preflight
  withCredentials: false
});

// Add request interceptor for debugging
axiosInstance.interceptors.request.use(
  config => {
    console.log(`Making ${config.method.toUpperCase()} request to ${config.url}`);
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
axiosInstance.interceptors.response.use(
  response => {
    console.log(`Received response from ${response.config.url}:`, response.status);
    return response;
  },
  error => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response error data:', error.response.data);
      console.error('Response error status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

const api = {
  generateMockup: async (prompt, width = 1024, height = 1024, quality = 'standard') => {
    try {
      const response = await axiosInstance.post('/generate-mockup', {
        prompt,
        width,
        height,
        quality
      });
      return response.data;
    } catch (error) {
      console.error('Error generating mockup:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  },

  generateMultipleMockups: async (prompt, numImages = 4, width = 1024, height = 1024, quality = 'standard') => {
    try {
      const response = await axiosInstance.post('/generate-multiple-mockups', {
        prompt,
        num_images: numImages,
        width,
        height,
        quality
      });
      return response.data;
    } catch (error) {
      console.error('Error generating multiple mockups:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  },

  downloadImage: async (filename) => {
    try {
      const response = await axiosInstance.get(`/download-image/${filename}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error) {
      console.error('Error downloading image:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  },

  generateDescription: async (prompt) => {
    try {
      const response = await axiosInstance.post('/generate-description', {
        prompt
      });
      return response.data;
    } catch (error) {
      console.error('Error generating description:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  },

  generateComponents: async (prompt) => {
    try {
      const response = await axiosInstance.post('/generate-components', {
        prompt
      });
      return response.data;
    } catch (error) {
      console.error('Error generating components:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  },

  checkAwsCredentials: async () => {
    try {
      console.log('Checking AWS credentials...');
      const response = await axiosInstance.get('/check-aws-credentials');
      console.log('AWS credentials response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error checking AWS credentials:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  },

  checkBedrockAccess: async () => {
    try {
      console.log('Checking Bedrock access...');
      const response = await axiosInstance.get('/check-bedrock-access');
      console.log('Bedrock access response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error checking Bedrock access:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  }
};

export default api;
