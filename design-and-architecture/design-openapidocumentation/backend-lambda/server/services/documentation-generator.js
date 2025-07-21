const UnifiedLambdaClient = require('./unified-lambda-client');
const { generateFallbackSecurityDocs } = require('./fallback-docs');

// Set this to true to use direct Lambda invocation instead of API Gateway
const USE_DIRECT_LAMBDA = true;

// The ARN of your Lambda function
const LAMBDA_FUNCTION_ARN = process.env.DOC_GENERATOR_FUNCTION_ARN || process.env.LAMBDA_FUNCTION_ARN;

/**
 * Generates comprehensive API documentation using the Lambda function
 * @param {Object} openApiSpec - The OpenAPI specification object
 * @param {Object} context - Additional context (userId, sessionId, projectName)
 * @returns {Promise<Object>} - The generated documentation
 */
async function generateOpenAPIDocumentation(openApiSpec, context = {}) {
  try {
    console.log('Generating OpenAPI documentation...');

    let result;

    if (USE_DIRECT_LAMBDA) {
      console.log('🚀 Using direct Lambda invocation...');
      console.log(`📋 Lambda ARN: ${LAMBDA_FUNCTION_ARN}`);

      // Validate Lambda ARN
      if (!LAMBDA_FUNCTION_ARN || !LAMBDA_FUNCTION_ARN.startsWith('arn:aws:lambda:')) {
        console.error('❌ Lambda ARN is not properly configured');
        console.error('💡 Please run: cd cdk && ./update-env.sh');
        throw new Error('Lambda ARN not properly configured. Please update environment variables.');
      }

      // Use direct Lambda invocation instead of API Gateway to avoid timeouts
      const lambdaClient = new UnifiedLambdaClient({
        lambdaArn: LAMBDA_FUNCTION_ARN,
        region: process.env.SERVER_REGION || process.env.AWS_REGION || 'eu-west-1',
        invocationType: 'direct'
      });

      // Call the Lambda function directly with the full OpenAPI spec and context
      console.log('📤 Invoking Lambda function directly...');
      console.log('📋 Context:', { userId: context.userId, sessionId: context.sessionId, projectName: context.projectName });
      
      // Create payload with spec and project context
      const payload = {
        openApiSpec: openApiSpec,
        context: {
          projectName: context.projectName
        }
      };
      
      try {
        result = await lambdaClient.invoke(payload);
        console.log('✅ Direct Lambda invocation completed');
        console.log('📊 Result type:', typeof result);
        console.log('📊 Result keys:', result ? Object.keys(result) : 'null');
      } catch (lambdaError) {
        console.error('❌ Direct Lambda invocation failed:', lambdaError.message);
        console.error('🔍 Lambda error name:', lambdaError.name);
        console.error('🔍 Lambda error code:', lambdaError.code);
        console.error('🔍 Lambda error stack:', lambdaError.stack);
        
        // Don't fall back - just throw the real error
        throw new Error(`Direct Lambda invocation failed: ${lambdaError.message}`);
      }

    } else {
      throw new Error('Direct Lambda invocation is disabled. This should not happen with current configuration.');
    }

    // Check if we got a fallback response
    if (result.fallback) {
      console.log('Using fallback documentation generator');
    } else {
      console.log('Successfully received documentation from Lambda');
    }

    // Process the result if needed
    console.log('Processing Lambda result...');

    // Log the structure of the result
    console.log('Result type:', typeof result);
    if (typeof result === 'object') {
      console.log('Result keys:', Object.keys(result));

      // If the result already has parsed_json, return it directly
      if (result.parsed_json) {
        console.log('Found parsed_json directly in result');
        return {
          success: true,
          parsed_json: result.parsed_json
        };
      }

      // If the result has combined results from step function approach
      if (result.securityDefinitions && result.policies && result.documentation && result.versioning) {
        console.log('Found combined results from step function approach');
        return {
          success: true,
          parsed_json: result
        };
      }
    }

    // Handle error responses
    if (result.statusCode && result.statusCode !== 200) {
      console.error(`Lambda returned status code ${result.statusCode}`);

      // Special handling for timeout errors (504)
      if (result.statusCode === 504) {
        console.error('Lambda function timed out - the OpenAPI spec may be too large');
        console.log('Falling back to local documentation generator');
        return {
          success: false,
          error: 'Lambda function timed out - using local documentation generator',
          fallback: true,
          ...generateFallbackSecurityDocs(openApiSpec)
        };
      }

      if (result.body) {
        try {
          const errorBody = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
          console.error('Error details:', errorBody);
          throw new Error(errorBody.error || `Error from Lambda function: ${result.statusCode}`);
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          throw new Error(`Error from Lambda function: ${result.statusCode}`);
        }
      }
      throw new Error(`Error from Lambda function: ${result.statusCode}`);
    }

    // Handle successful responses
    if (result.body) {
      try {
        // If the result has a body property, it might be a string that needs parsing
        const parsedBody = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
        console.log('Parsed body type:', typeof parsedBody);
        if (typeof parsedBody === 'object') {
          console.log('Parsed body keys:', Object.keys(parsedBody));
        }

        if (parsedBody.parsed_json) {
          console.log('Found parsed_json in Lambda response');
          return {
            success: true,
            parsed_json: parsedBody.parsed_json
          };
        } else if (parsedBody.message && parsedBody.message.includes('successfully')) {
          // Handle the new response format
          console.log('Found successful message in Lambda response');
          return {
            success: true,
            ...parsedBody
          };
        }
        return parsedBody;
      } catch (parseError) {
        console.error('Error parsing Lambda response body:', parseError);
        throw parseError;
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Error generating documentation:', error.message);
    console.error('🔍 Error details:', error);

    // If direct Lambda failed, provide specific guidance
    if (USE_DIRECT_LAMBDA) {
      console.error('💡 Direct Lambda invocation failed. Possible causes:');
      console.error('   1. Lambda function ARN is incorrect or outdated');
      console.error('   2. AWS credentials lack Lambda invoke permissions');
      console.error('   3. Lambda function does not exist or is not deployed');
      console.error('   4. Network connectivity issues');
      console.error('🔧 Try running: cd cdk && ./update-env.sh');
    }

    // Generate fallback documentation if the Lambda call fails completely
    return {
      success: false,
      error: error.message || 'Failed to generate documentation',
      fallback: true,
      ...generateFallbackSecurityDocs(openApiSpec)
    };
  }
}

module.exports = { generateOpenAPIDocumentation };