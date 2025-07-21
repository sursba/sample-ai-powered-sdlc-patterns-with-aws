/**
 * Direct Lambda invocation client for long-running processes
 * Uses AWS SDK to invoke Lambda functions directly with Cognito credentials
 */

import authService from './authService';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

class LambdaClient {
  constructor() {
    this.region = import.meta.env.VITE_AWS_REGION || process.env.REACT_APP_AWS_REGION || 'eu-west-1';
    this.domainAnalyzerFunction = import.meta.env.VITE_DOMAIN_ANALYZER_FUNCTION_ARN || process.env.REACT_APP_DOMAIN_ANALYZER_FUNCTION_ARN;
    this.docGeneratorFunction = import.meta.env.VITE_DOC_GENERATOR_FUNCTION_ARN || process.env.REACT_APP_DOC_GENERATOR_FUNCTION_ARN;
    this.backendFunction = import.meta.env.VITE_BACKEND_FUNCTION_ARN || process.env.REACT_APP_BACKEND_FUNCTION_ARN;
    this.lambdaClient = null;
    this.credentials = null;
  }

  /**
   * Initialize AWS SDK and credentials
   */
  async initialize() {
    try {
      // Get authentication tokens
      const tokens = await authService.getTokens();
      if (!tokens || !tokens.idToken) {
        throw new Error('No valid authentication tokens available');
      }

      // Get configuration
      const userPoolId = import.meta.env.VITE_USER_POOL_ID || process.env.REACT_APP_USER_POOL_ID;
      const identityPoolId = import.meta.env.VITE_IDENTITY_POOL_ID || process.env.REACT_APP_IDENTITY_POOL_ID;

      if (!userPoolId || !identityPoolId) {
        throw new Error('Missing Cognito configuration');
      }

      // Create credentials provider using Cognito Identity Pool
      const credentials = fromCognitoIdentityPool({
        client: new CognitoIdentityClient({ region: this.region }),
        identityPoolId: identityPoolId,
        logins: {
          [`cognito-idp.${this.region}.amazonaws.com/${userPoolId}`]: tokens.idToken
        }
      });

      // Create Lambda client with Cognito credentials
      this.lambdaClient = new LambdaClient({
        region: this.region,
        credentials: credentials
      });

      return true;
    } catch (error) {
      console.error('Failed to initialize Lambda client:', error);
      return false;
    }
  }

  /**
   * Invoke backend Lambda function (for API calls)
   */
  async invokeBackend(endpoint, method = 'GET', payload = null) {
    try {
      const backendPayload = {
        httpMethod: method,
        path: endpoint,
        headers: {
          'Content-Type': 'application/json'
        },
        body: payload ? JSON.stringify(payload) : null
      };

      return await this.invokeLambda(this.backendFunction, backendPayload);
    } catch (error) {
      console.error('Backend invocation error:', error);
      throw error;
    }
  }

  /**
   * Invoke Lambda function directly
   */
  async invokeLambda(functionArn, payload, options = {}) {
    try {
      if (!this.lambdaClient) {
        const initialized = await this.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize Lambda client');
        }
      }

      const command = new InvokeCommand({
        FunctionName: functionArn,
        Payload: JSON.stringify(payload),
        InvocationType: options.async ? 'Event' : 'RequestResponse'
      });

      const result = await this.lambdaClient.send(command);

      if (result.StatusCode === 200) {
        const responsePayload = new TextDecoder().decode(result.Payload);
        return JSON.parse(responsePayload);
      } else {
        throw new Error(`Lambda invocation failed with status ${result.StatusCode}`);
      }
    } catch (error) {
      console.error('Lambda invocation error:', error);
      throw error;
    }
  }

  /**
   * Analyze domain model using domain analyzer function
   */
  async analyzeDomain(payload, onProgress = null) {
    try {
      if (onProgress) onProgress('Initializing analysis...');

      const result = await this.invokeLambda(this.domainAnalyzerFunction, payload);

      if (onProgress) onProgress('Analysis complete');

      return result;
    } catch (error) {
      console.error('Domain analysis error:', error);
      throw error;
    }
  }

  /**
   * Generate documentation using doc generator function
   */
  async generateDocumentation(payload, onProgress = null) {
    try {
      if (onProgress) onProgress('Starting documentation generation...');

      const result = await this.invokeLambda(this.docGeneratorFunction, payload);

      if (onProgress) onProgress('Documentation generation complete');

      return result;
    } catch (error) {
      console.error('Documentation generation error:', error);
      throw error;
    }
  }

  /**
   * Upload image and analyze (combines upload + analysis)
   */
  async uploadAndAnalyze(file, options = {}, onProgress = null) {
    try {
      if (onProgress) onProgress('Converting image...');

      // Convert file to base64
      const base64 = await this.fileToBase64(file);

      if (onProgress) onProgress('Starting analysis...');

      const payload = {
        imageBase64: base64,
        analysisType: options.analysisType || 'domain',
        prompt: options.prompt || '',
        businessContext: options.businessContext || ''
      };

      return await this.analyzeDomain(payload, onProgress);
    } catch (error) {
      console.error('Upload and analyze error:', error);
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
   * Check if client is properly configured
   */
  isConfigured() {
    return !!(this.domainAnalyzerFunction && this.docGeneratorFunction && this.region);
  }

  /**
   * Get configuration info
   */
  getConfig() {
    return {
      region: this.region,
      domainAnalyzerFunction: this.domainAnalyzerFunction,
      docGeneratorFunction: this.docGeneratorFunction,
      backendFunction: this.backendFunction,
      configured: this.isConfigured()
    };
  }
}

// Create and export singleton instance
const lambdaClient = new LambdaClient();
export default lambdaClient;