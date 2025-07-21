/**
 * AWS Client for Lambda Function URL invocation with Cognito Identity Pool credentials
 * Uses AWS SDK v3 with SigV4 signing for IAM authentication
 */

import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import authService from './authService';

class AwsClient {
  constructor() {
    this.credentials = null;
    this.region = 'eu-west-1';
    this.lambdaFunctionUrl = null;
    this.initialized = false;
  }

  /**
   * Initialize AWS client with Cognito Identity Pool credentials
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // Load configuration
      await authService.loadConfig();
      const config = authService.cognitoConfig;

      if (!config.userPoolId || !config.userPoolClientId) {
        console.error('Cognito configuration missing');
        return false;
      }

      // Get Identity Pool ID from environment
      const identityPoolId = import.meta.env.VITE_IDENTITY_POOL_ID ||
        process.env.REACT_APP_IDENTITY_POOL_ID;

      if (!identityPoolId) {
        console.error('Identity Pool ID not configured');
        return false;
      }

      // Get Lambda Function URL from environment
      this.lambdaFunctionUrl = import.meta.env.VITE_API_URL ||
        process.env.REACT_APP_API_URL;

      if (!this.lambdaFunctionUrl) {
        console.error('Lambda Function URL not configured');
        return false;
      }

      // Store configuration but don't set up credentials yet
      this.identityPoolId = identityPoolId;
      this.cognitoConfig = config;

      this.initialized = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get or create credentials for authenticated user
   */
  async getCredentials() {
    if (!this.initialized) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Failed to initialize AWS client');
      }
    }

    // Check if user is authenticated
    if (!authService.isAuthenticated()) {
      throw new Error('User must be authenticated to access AWS resources');
    }

    // Get current tokens
    const tokens = authService.getTokens();
    if (!tokens || !tokens.idToken) {
      throw new Error('No valid ID token available - user may need to re-authenticate');
    }

    // Always create fresh credentials to avoid stale token issues
    const providerName = `cognito-idp.${this.region}.amazonaws.com/${this.cognitoConfig.userPoolId}`;

    // Validate the ID token format before using it
    if (!tokens.idToken || typeof tokens.idToken !== 'string' || tokens.idToken.split('.').length !== 3) {
      throw new Error('Invalid ID token format - token may be corrupted');
    }

    // Parse and validate the ID token payload
    let validToken = tokens.idToken;
    try {
      const payload = authService.parseTokenPayload(tokens.idToken);

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp <= now) {
        const refreshedTokens = await authService.refreshToken();
        if (refreshedTokens && refreshedTokens.idToken) {
          validToken = refreshedTokens.idToken;
        } else {
          throw new Error('ID token expired and refresh failed');
        }
      }
    } catch (parseError) {
      throw new Error('Invalid ID token - unable to parse payload');
    }

    try {
      // Try with ID token first (recommended for Identity Pool)
      this.credentials = fromCognitoIdentityPool({
        client: new CognitoIdentityClient({
          region: this.region,
          maxAttempts: 3,
          retryMode: 'adaptive'
        }),
        identityPoolId: this.identityPoolId,
        logins: {
          [providerName]: validToken
        },
        clientConfig: {
          region: this.region
        }
      });
    } catch (credentialsError) {
      // Try with access token as fallback
      if (tokens.accessToken) {
        try {
          this.credentials = fromCognitoIdentityPool({
            client: new CognitoIdentityClient({
              region: this.region,
              maxAttempts: 3,
              retryMode: 'adaptive'
            }),
            identityPoolId: this.identityPoolId,
            logins: {
              [providerName]: tokens.accessToken
            },
            clientConfig: {
              region: this.region
            }
          });
        } catch (accessTokenError) {
          throw new Error(`Credentials creation failed with both tokens: ID token error: ${credentialsError.message}, Access token error: ${accessTokenError.message}`);
        }
      } else {
        throw new Error(`Credentials creation failed: ${credentialsError.message}`);
      }
    }

    return this.credentials;
  }

  /**
   * Sign HTTP request using AWS Signature Version 4
   */
  async signRequest(request) {
    try {
      // Get credentials (this will create them if needed)
      const credentials = await this.getCredentials();

      const signer = new SignatureV4({
        credentials: credentials,
        region: this.region,
        service: 'lambda',
        sha256: Sha256
      });

      const signedRequest = await signer.sign(request);

      return signedRequest;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Make authenticated request to Lambda Function URL
   */
  async makeRequest(method, path, body = null, headers = {}) {
    try {
      // Ensure client is initialized
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) {
          throw new Error('Failed to initialize AWS client');
        }
      }

      // Construct full URL
      const url = new URL(path, this.lambdaFunctionUrl);

      // Prepare request headers - only include headers that should be signed
      const cleanHeaders = {
        'Host': url.hostname
      };

      // Only add Content-Type for requests that actually have a body
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        cleanHeaders['Content-Type'] = 'application/json';
      }

      // Ensure all header values are strings (SigV4 requires this)
      const stringifiedHeaders = {};
      for (const [key, value] of Object.entries(cleanHeaders)) {
        if (value !== null && value !== undefined) {
          stringifiedHeaders[key] = String(value);
        }
      }

      const request = {
        method: method.toUpperCase(),
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: stringifiedHeaders
      };

      // Add body only for methods that should have one
      if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        if (typeof body === 'object') {
          request.body = JSON.stringify(body);
        } else {
          request.body = String(body);
        }

        // Calculate content length using UTF-8 byte length, not character length
        const bodyBytes = new TextEncoder().encode(request.body);
        request.headers['Content-Length'] = String(bodyBytes.length);
      } else {
        // For GET/DELETE requests, no body at all
        request.body = undefined;
      }

      // Sign the request
      const signedRequest = await this.signRequest(request);

      // Debug logging for signature issues
      if (body) {
        console.log('Request body length (chars):', request.body.length);
        console.log('Request body length (bytes):', new TextEncoder().encode(request.body).length);
        console.log('Content-Length header:', signedRequest.headers['Content-Length']);
      }

      // Debug: Log exactly what we're sending to help debug signature issues
      console.log('Final request details:', {
        url: url.toString(),
        method: signedRequest.method,
        signedHeaders: signedRequest.headers,
        body: signedRequest.body,
        bodyLength: signedRequest.body ? signedRequest.body.length : 0
      });



      // Make the HTTP request
      const response = await fetch(url.toString(), {
        method: signedRequest.method,
        headers: signedRequest.headers,
        body: signedRequest.body
      });

      // Handle response
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      // Parse JSON response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }

    } catch (error) {
      // If this is a credentials error, clear them so they get recreated
      if (error.message.includes('credentials') || error.message.includes('Unauthenticated')) {
        this.credentials = null;
      }

      throw error;
    }
  }

  /**
   * GET request
   */
  async get(path, headers = {}) {
    return this.makeRequest('GET', path, null, headers);
  }

  /**
   * POST request
   */
  async post(path, body = null, headers = {}) {
    return this.makeRequest('POST', path, body, headers);
  }

  /**
   * PUT request
   */
  async put(path, body = null, headers = {}) {
    return this.makeRequest('PUT', path, body, headers);
  }

  /**
   * DELETE request
   */
  async delete(path, headers = {}) {
    return this.makeRequest('DELETE', path, null, headers);
  }

  /**
   * PATCH request
   */
  async patch(path, body = null, headers = {}) {
    return this.makeRequest('PATCH', path, body, headers);
  }

  /**
   * Upload file with multipart form data
   */
  async uploadFile(path, file, fieldName = 'image', additionalFields = {}) {
    try {
      // Ensure client is initialized
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) {
          throw new Error('Failed to initialize AWS client');
        }
      }

      // For file uploads, we'll convert to base64 and send as JSON
      // This is because signing multipart/form-data is complex
      const base64Data = await this.fileToBase64(file);

      const body = {
        [fieldName]: {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data
        },
        ...additionalFields
      };

      return this.post(path, body);
    } catch (error) {
      throw error;
    }
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
   * Refresh credentials (useful when tokens expire)
   */
  async refreshCredentials() {
    this.credentials = null;

    // Also refresh the auth tokens
    try {
      await authService.refreshToken();
    } catch (error) {
      // Ignore refresh errors
    }

    // Don't reset initialized flag, just clear credentials
    // The next request will create new credentials
    return true;
  }

  /**
   * Check if client is properly configured
   */
  isConfigured() {
    return this.initialized && !!this.credentials && !!this.lambdaFunctionUrl;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      region: this.region,
      lambdaFunctionUrl: this.lambdaFunctionUrl,
      initialized: this.initialized
    };
  }
}

// Create and export singleton instance
const awsClient = new AwsClient();
export default awsClient;