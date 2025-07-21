// AWS SDK dependencies
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// Internal services
const { sendSignedRequest } = require('./aws-auth');

/**
 * Unified Lambda client that supports both direct invocation and API Gateway patterns
 */
class UnifiedLambdaClient {
  /**
   * Create a new Unified Lambda client
   * @param {Object} config - Configuration object
   * @param {string} config.lambdaArn - The ARN of the Lambda function (for direct invocation)
   * @param {string} config.apiGatewayUrl - The API Gateway URL (for API Gateway invocation)
   * @param {string} config.region - AWS region
   * @param {string} config.invocationType - 'direct' or 'apigateway'
   */
  constructor(config) {
    this.lambdaArn = config.lambdaArn;
    this.apiGatewayUrl = config.apiGatewayUrl;
    this.region = config.region || 'eu-west-1';
    this.invocationType = config.invocationType || 'direct';

    if (this.invocationType === 'direct' && this.lambdaArn) {
      // Extract the function name from the ARN
      const arnParts = this.lambdaArn.split(':');
      this.functionName = arnParts[arnParts.length - 1];
      
      // Initialize the Lambda client
      this.lambda = new LambdaClient({ region: this.region });
    }
  }

  /**
   * Invoke a Lambda function with the configured method
   * @param {Object} payload - The payload to send to the Lambda function
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - The Lambda response
   */
  async invoke(payload, options = {}) {
    if (this.invocationType === 'direct') {
      return this._invokeDirect(payload, options);
    } else {
      return this._invokeApiGateway(payload, options);
    }
  }

  /**
   * Direct Lambda invocation using AWS SDK
   * @private
   */
  async _invokeDirect(payload, options = {}) {
    try {
      const command = new InvokeCommand({
        FunctionName: this.functionName,
        Payload: JSON.stringify(payload),
        InvocationType: 'RequestResponse'
      });

      const response = await this.lambda.send(command);

      if (response.FunctionError) {
        const errorPayload = Buffer.from(response.Payload).toString();
        throw new Error(`Lambda function error: ${response.FunctionError} - ${errorPayload}`);
      }

      // Parse the response payload
      const responseText = Buffer.from(response.Payload).toString();

      try {
        const parsedResponse = JSON.parse(responseText);
        
        // Handle API Gateway format responses
        if (parsedResponse.statusCode && parsedResponse.body) {
          try {
            const body = typeof parsedResponse.body === 'string' ? 
              JSON.parse(parsedResponse.body) : parsedResponse.body;
            return body;
          } catch (bodyParseError) {
            // If body parsing fails, return the raw body
            return { success: true, data: parsedResponse.body };
          }
        }
        
        return parsedResponse;
      } catch (parseError) {
        // If JSON parsing fails, return as plain text
        return { success: true, data: responseText };
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * API Gateway invocation using signed requests
   * @private
   */
  async _invokeApiGateway(payload, options = {}) {
    try {
      const response = await sendSignedRequest(
        this.apiGatewayUrl,
        'POST',
        payload,
        this.region
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Invoke multiple Lambda functions in parallel
   * @param {Array} requests - Array of request objects with payload and optional config
   * @returns {Promise<Array>} - Array of responses
   */
  async invokeParallel(requests) {
    const promises = requests.map(request => {
      return this.invoke(request.payload, request.options).catch(error => {
        return {
          success: false,
          error: error.message,
          fallback: true
        };
      });
    });

    return await Promise.all(promises);
  }

  /**
   * Domain-specific method: Analyze domain model with an image
   * @param {Buffer} imageBuffer - The image buffer to analyze
   * @param {string} analysisType - Type of analysis ('domain', 'bounded', or 'full')
   * @param {string} prompt - Optional additional prompt text
   * @param {string} sessionId - Optional session ID for tracking
   * @returns {Promise<Object>} The analysis result
   */
  async analyzeDomainModel(imageBuffer, analysisType = 'domain', prompt = '', sessionId = null) {
    const imageBase64 = imageBuffer.toString('base64');
    
    const payload = {
      imageBase64: imageBase64,
      analysisType: analysisType,
      prompt: prompt
    };

    // Add session ID if provided
    if (sessionId) {
      payload.sessionId = sessionId;
    }

    const result = await this.invoke(payload);
    
    // Normalize the response format
    const normalizedResult = this._normalizeAnalysisResult(result);
    
    // If we requested 'full' analysis but don't have business context, generate it separately
    if (analysisType === 'full' && normalizedResult.success && normalizedResult.domainAnalysis && 
        !normalizedResult.businessContextAnalysis && !normalizedResult.boundedContextAnalysis) {
      
      const businessResponse = await this.generateBusinessContexts(normalizedResult.domainAnalysis);
      
      return {
        ...normalizedResult,
        businessContextAnalysis: businessResponse.businessContextAnalysis || businessResponse.boundedContextAnalysis,
        boundedContextAnalysis: businessResponse.businessContextAnalysis || businessResponse.boundedContextAnalysis
      };
    }
    
    return normalizedResult;
  }

  /**
   * Domain-specific method: Generate business contexts from domain analysis
   * @param {string} domainAnalysisText - The domain analysis text
   * @returns {Promise<Object>} The business context analysis result
   */
  async generateBusinessContexts(domainAnalysisText) {
    const payload = {
      prompt: domainAnalysisText,
      analysisType: 'bounded'
    };

    const result = await this.invoke(payload);
    return this._normalizeAnalysisResult(result);
  }

  /**
   * Domain-specific method: Generate ASCII diagram
   * @param {string} inputText - The input text for diagram generation
   * @returns {Promise<Object>} The ASCII diagram result
   */
  async generateAsciiDiagram(inputText) {
    const payload = {
      analysisType: 'ascii',
      prompt: inputText
    };

    const result = await this.invoke(payload);
    return this._normalizeAnalysisResult(result);
  }

  /**
   * Documentation-specific method: Generate documentation with parallel tasks
   * @param {Object} openApiSpec - The OpenAPI specification
   * @param {string} docsApiUrl - The documentation API URL
   * @returns {Promise<Object>} The combined documentation result
   */
  async generateDocumentation(openApiSpec, docsApiUrl) {
    // Create a temporary client for documentation API
    const docsClient = new UnifiedLambdaClient({
      apiGatewayUrl: docsApiUrl,
      region: this.region,
      invocationType: 'apigateway'
    });

    const tasks = [
      { name: 'security', description: 'Generating security definitions' },
      { name: 'governance', description: 'Generating governance policies' },
      { name: 'documentation', description: 'Generating API documentation' },
      { name: 'versioning', description: 'Generating versioning strategy' }
    ];

    const requests = tasks.map(task => ({
      payload: { ...openApiSpec, task: task.name }
    }));

    try {
      const results = await docsClient.invokeParallel(requests);
      
      // Parse and combine results
      const [securityResult, governanceResult, documentationResult, versioningResult] = results;
      
      const securityData = this._parseDocumentationResult(securityResult);
      const governanceData = this._parseDocumentationResult(governanceResult);
      const documentationData = this._parseDocumentationResult(documentationResult);
      const versioningData = this._parseDocumentationResult(versioningResult);

      const hasErrors = [securityData?.error, governanceData?.error, documentationData?.error, versioningData?.error]
        .some(error => error !== undefined);

      const combinedResult = {
        success: !hasErrors,
        parsed_json: {
          securityDefinitions: securityData?.result?.securityDefinitions || {},
          policies: governanceData?.result?.policies || {},
          documentation: documentationData?.result?.documentation || {},
          versioning: versioningData?.result?.versioning || {}
        }
      };

      if (hasErrors) {
        combinedResult.parsed_json.error = 'One or more Lambda functions failed';
        combinedResult.parsed_json.type = 'LambdaExecutionError';
        combinedResult.parsed_json.details = {
          security: securityData?.error,
          governance: governanceData?.error,
          documentation: documentationData?.error,
          versioning: versioningData?.error
        };
      }

      return combinedResult;
    } catch (error) {
      // Return fallback documentation
      return {
        success: false,
        error: error.message || 'Failed to generate documentation',
        fallback: true,
        securityDefinitions: this._generateFallbackSecurityDocs(openApiSpec)
      };
    }
  }

  /**
   * Normalize analysis results to a consistent format
   * @private
   */
  _normalizeAnalysisResult(result) {
    if (!result) return { success: false, error: 'No result received' };
    
    // If result already has the expected structure, return it
    if (result.success !== undefined) {
      // Ensure both property names are set for compatibility
      if (result.businessContextAnalysis && !result.boundedContextAnalysis) {
        result.boundedContextAnalysis = result.businessContextAnalysis;
      } else if (result.boundedContextAnalysis && !result.businessContextAnalysis) {
        result.businessContextAnalysis = result.boundedContextAnalysis;
      }
      return result;
    }
    
    // Handle plain text responses
    if (typeof result === 'string') {
      if (result.includes('# Domain Model Analysis') || result.includes('## ENTITIES')) {
        return { success: true, domainAnalysis: result, format: 'plain-text' };
      } else if (result.includes('# Business Context Analysis')) {
        return { 
          success: true, 
          businessContextAnalysis: result, 
          boundedContextAnalysis: result,
          format: 'plain-text' 
        };
      }
      return { success: true, data: result };
    }
    
    // Handle object responses
    if (typeof result === 'object') {
      const normalized = { success: true, ...result };
      
      // Ensure both property names are set for compatibility
      if (normalized.businessContextAnalysis && !normalized.boundedContextAnalysis) {
        normalized.boundedContextAnalysis = normalized.businessContextAnalysis;
      } else if (normalized.boundedContextAnalysis && !normalized.businessContextAnalysis) {
        normalized.businessContextAnalysis = normalized.boundedContextAnalysis;
      }
      
      return normalized;
    }
    
    return { success: false, error: 'Unexpected result format' };
  }

  /**
   * Parse documentation generation results
   * @private
   */
  _parseDocumentationResult(result) {
    if (result && result.body) {
      try {
        if (typeof result.body !== 'string') {
          return result.body;
        }

        if (result.body.includes('"error"') && result.body.includes('JSONDecodeError')) {
          const errorObj = JSON.parse(result.body);
          return {
            error: errorObj.error,
            type: errorObj.type,
            message: 'The Lambda function encountered a JSON parsing error.'
          };
        }

        return JSON.parse(result.body);
      } catch (error) {
        return {
          error: `Failed to parse Lambda response: ${error.message}`,
          type: error.name,
          raw: result.body.substring(0, 200) + '...'
        };
      }
    }
    return null;
  }

  /**
   * Generate fallback security documentation
   * @private
   */
  _generateFallbackSecurityDocs(openApiSpec) {
    try {
      const securitySchemes = openApiSpec.components?.securitySchemes || {};
      const securityRequirements = openApiSpec.security || [];
      const paths = openApiSpec.paths || {};

      // Generate basic policies
      const rateLimiting = {};
      const caching = {};
      const validation = {};
      const endpointDocs = {};

      for (const path in paths) {
        rateLimiting[path] = {
          limit: '100 requests per minute',
          burst: '150 requests',
          cost: 1
        };

        const pathItem = paths[path];
        if (pathItem.get) {
          caching[path] = {
            ttl: '300 seconds',
            strategy: 'Cache-Control header',
            varyBy: ['Accept', 'Authorization']
          };
        }

        endpointDocs[path] = {};
        for (const method in pathItem) {
          if (method !== 'parameters' && method !== 'servers') {
            const operation = pathItem[method];
            if (operation.requestBody) {
              validation[`${path}.${method}`] = {
                requestBody: 'Validated against schema',
                required: operation.requestBody.required || false
              };
            }

            endpointDocs[path][method] = {
              summary: operation.summary || '',
              description: operation.description || '',
              tags: operation.tags || []
            };
          }
        }
      }

      return {
        securityDefinitions: {
          schemes: securitySchemes,
          requirements: securityRequirements,
          summary: 'Security schemes extracted from the OpenAPI specification'
        },
        policies: { rateLimiting, caching, validation },
        documentation: { endpoints: endpointDocs },
        versioning: {
          strategy: 'semantic',
          current: openApiSpec.info?.version || '1.0.0',
          supported: [openApiSpec.info?.version || '1.0.0']
        }
      };
    } catch (error) {
      return {
        error: 'Could not generate fallback documentation',
        message: 'Please try again later'
      };
    }
  }
}

/**
 * Standalone function for direct Lambda invocation (backward compatibility)
 * @param {string} lambdaArn - The ARN of the Lambda function
 * @param {Object} payload - The payload to send to the Lambda function
 * @param {string} region - AWS region
 * @returns {Promise<Object>} - The Lambda response
 */
async function invokeLambda(lambdaArn, payload, region = 'eu-west-1') {
  const client = new UnifiedLambdaClient({
    lambdaArn,
    region,
    invocationType: 'direct'
  });
  
  return client.invoke(payload);
}

/**
 * Standalone function for parallel Lambda invocation (backward compatibility)
 * @param {string} lambdaArn - The ARN of the Lambda function
 * @param {Object} basePayload - The base payload to send to all Lambda functions
 * @param {string[]} tasks - Array of task names to execute in parallel
 * @param {string} region - AWS region
 * @returns {Promise<Object[]>} - Array of Lambda responses
 */
async function invokeParallelLambdas(lambdaArn, basePayload, tasks, region = 'eu-west-1') {
  const client = new UnifiedLambdaClient({
    lambdaArn,
    region,
    invocationType: 'direct'
  });

  const requests = tasks.map(task => ({
    payload: { ...basePayload, task }
  }));

  return client.invokeParallel(requests);
}

module.exports = UnifiedLambdaClient;
module.exports.invokeLambda = invokeLambda;
module.exports.invokeParallelLambdas = invokeParallelLambdas;