const { sendSignedRequest } = require('./aws-auth');
const { sanitizeForLogging } = require('../utils/security');

// API Gateway URL for the OpenAPI documentation generator Lambda (DEPRECATED)
// This is now deprecated in favor of direct Lambda invocation
const DOCS_GENERATOR_API_URL = process.env.DOCS_GENERATOR_API_URL || null;

if (DOCS_GENERATOR_API_URL) {
  console.log(`⚠️  WARNING: Using deprecated API Gateway URL: ${DOCS_GENERATOR_API_URL}`);
  console.log(`💡 Consider switching to direct Lambda invocation for better performance`);
} else {
  console.log(`❌ ERROR: API Gateway URL not configured and direct Lambda invocation should be used instead`);
  console.log(`💡 This fallback method should not be used with the current CDK deployment`);
}

/**
 * Proxy function to call the Lambda with direct OpenAPI spec input
 * @param {Object} openApiSpec - The OpenAPI specification object
 * @returns {Promise<Object>} - The generated documentation
 */
async function callDocumentationLambda(openApiSpec) {
    try {
        console.log('⚠️  WARNING: Using deprecated API Gateway approach for documentation Lambda...');
        
        // Check if API Gateway URL is configured
        if (!DOCS_GENERATOR_API_URL) {
            throw new Error('API Gateway URL not configured. This method is deprecated. Use direct Lambda invocation instead.');
        }

        // Use the full OpenAPI spec without truncation
        const requestBody = openApiSpec;

        // Log what we're sending
        console.log('Sending complete OpenAPI spec directly without nesting');
        console.log('Request body type:', typeof requestBody);
        if (typeof requestBody === 'object') {
            console.log('Request body keys:', Object.keys(requestBody));
        }

        console.log(`Calling Lambda at ${DOCS_GENERATOR_API_URL} with region eu-west-1`);
        console.log(`OpenAPI spec size: ${JSON.stringify(openApiSpec).length} characters`);

        // Use the AWS authentication to send a signed request with increased timeout
        console.log('Sending complete OpenAPI spec to Lambda');

        // Execute all tasks in parallel
        console.log('Executing all tasks in parallel...');

        const tasks = [
            { name: 'security', description: 'Generating security definitions' },
            { name: 'governance', description: 'Generating governance policies' },
            { name: 'documentation', description: 'Generating API documentation' },
            { name: 'versioning', description: 'Generating versioning strategy' }
        ];

        // Create an array of promises for parallel execution
        const promises = tasks.map(task => {
            console.log(`Starting task: ${task.description}...`);
            return sendSignedRequest(
                DOCS_GENERATOR_API_URL,
                'POST',
                { ...requestBody, task: task.name },
                'eu-west-1'
            ).catch(error => {
                console.error('Error in task', sanitizeForLogging(task.name), ':', error.message);
                // Return a fallback result for this specific task
                return {
                    success: false,
                    error: error.message,
                    task: task.name,
                    fallback: true
                };
            });
        });

        // Wait for all promises to resolve
        const results = await Promise.allSettled(promises);

        // Extract results
        const securityResult = results[0].status === 'fulfilled' ? results[0].value : { fallback: true };
        const governanceResult = results[1].status === 'fulfilled' ? results[1].value : { fallback: true };
        const documentationResult = results[2].status === 'fulfilled' ? results[2].value : { fallback: true };
        const versioningResult = results[3].status === 'fulfilled' ? results[3].value : { fallback: true };

        // Parse all results
        const securityData = parseResult(securityResult);
        const governanceData = parseResult(governanceResult);
        const documentationData = parseResult(documentationResult);
        const versioningData = parseResult(versioningResult);

        // Check for errors in any of the results
        const hasErrors = [
            securityData?.error,
            governanceData?.error,
            documentationData?.error,
            versioningData?.error
        ].some(error => error !== undefined);

        // Log any errors for debugging
        if (hasErrors) {
            console.log('Some Lambda functions returned errors:');
            if (securityData?.error) console.log('Security:', securityData.error);
            if (governanceData?.error) console.log('Governance:', governanceData.error);
            if (documentationData?.error) console.log('Documentation:', documentationData.error);
            if (versioningData?.error) console.log('Versioning:', versioningData.error);
        }

        // Log the parsed results for debugging
        console.log('Security data:', JSON.stringify(securityData).substring(0, 200));
        console.log('Governance data:', JSON.stringify(governanceData).substring(0, 200));
        console.log('Documentation data:', JSON.stringify(documentationData).substring(0, 200));
        console.log('Versioning data:', JSON.stringify(versioningData).substring(0, 200));

        // Combine all results - use the documentation as is without trying to parse it further
        const combinedResult = {
            success: !hasErrors,
            parsed_json: {
                securityDefinitions: securityData?.result?.securityDefinitions || {},
                policies: governanceData?.result?.policies || {},
                documentation: documentationData?.result?.documentation || {},
                versioning: versioningData?.result?.versioning || {}
            }
        };

        // Add error information if any Lambda function failed
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

        // Log the combined result for debugging
        console.log('Combined result structure:', Object.keys(combinedResult));
        console.log('Parsed JSON structure:', Object.keys(combinedResult.parsed_json));
        console.log('Security definitions:', combinedResult.parsed_json.securityDefinitions ?
            (typeof combinedResult.parsed_json.securityDefinitions === 'object' ?
                Object.keys(combinedResult.parsed_json.securityDefinitions) : 'Not an object') : 'Not defined');
        console.log('Versioning:', combinedResult.parsed_json.versioning ?
            (typeof combinedResult.parsed_json.versioning === 'object' ?
                Object.keys(combinedResult.parsed_json.versioning) : 'Not an object') : 'Not defined');

        console.log('All steps completed successfully');
        return combinedResult;
    } catch (error) {
        console.error('Error calling documentation Lambda:', error);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }

        // Return a fallback response if the Lambda call fails
        return {
            success: false,
            error: error.message || 'Failed to generate documentation',
            fallback: true,
            securityDefinitions: generateFallbackSecurityDocs(openApiSpec)
        };
    }
}

/**
 * Parse the result from a Lambda invocation
 * @param {Object} result - The result from the Lambda invocation
 * @returns {Object} - The parsed result
 */
function parseResult(result) {
    if (result && result.body) {
        try {
            // If it's already an object, return it
            if (typeof result.body !== 'string') {
                return result.body;
            }

            // Log the raw response for debugging
            console.log('Raw Lambda response body:', result.body.substring(0, 200) + '...');

            // Check if the response is an error message
            if (result.body.includes('"error"') && result.body.includes('JSONDecodeError')) {
                const errorObj = JSON.parse(result.body);
                console.error('Lambda returned JSONDecodeError:', errorObj);
                return {
                    error: errorObj.error,
                    type: errorObj.type,
                    message: 'The Lambda function encountered a JSON parsing error.'
                };
            }

            // Try to parse the JSON response
            return JSON.parse(result.body);
        } catch (error) {
            console.error('Error parsing result:', error);
            console.error('Failed to parse body:', result.body.substring(0, 500) + '...');
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
 * Generate fallback security documentation if the Lambda call fails
 * @param {Object} openApiSpec - The OpenAPI specification
 * @returns {Object} - Basic security documentation
 */
function generateFallbackSecurityDocs(openApiSpec) {
    try {
        console.log('Generating enhanced fallback documentation...');

        // Extract security schemes from the OpenAPI spec
        const securitySchemes = openApiSpec.components?.securitySchemes || {};
        const securityRequirements = openApiSpec.security || [];
        const paths = openApiSpec.paths || {};

        // Generate rate limiting policies for each endpoint
        const rateLimiting = {};
        for (const path in paths) {
            rateLimiting[path] = {
                limit: '100 requests per minute',
                burst: '150 requests',
                cost: 1
            };
        }

        // Generate caching policies for GET endpoints
        const caching = {};
        for (const path in paths) {
            const pathItem = paths[path];
            if (pathItem.get) {
                caching[path] = {
                    ttl: '300 seconds', // 5 minutes
                    strategy: 'Cache-Control header',
                    varyBy: ['Accept', 'Authorization']
                };
            }
        }

        // Generate validation rules based on schemas
        const validation = {};
        for (const path in paths) {
            const pathItem = paths[path];
            for (const method in pathItem) {
                if (method !== 'parameters' && method !== 'servers') {
                    const operation = pathItem[method];
                    if (operation.requestBody) {
                        validation[`${path}.${method}`] = {
                            requestBody: 'Validated against schema',
                            required: operation.requestBody.required || false
                        };
                    }

                    if (operation.parameters) {
                        validation[`${path}.${method}.parameters`] = {
                            count: operation.parameters.length,
                            required: operation.parameters.filter(p => p.required).length
                        };
                    }
                }
            }
        }

        // Generate detailed endpoint documentation
        const endpointDocs = {};
        for (const path in paths) {
            const pathItem = paths[path];
            endpointDocs[path] = {};

            for (const method in pathItem) {
                if (method !== 'parameters' && method !== 'servers') {
                    const operation = pathItem[method];
                    endpointDocs[path][method] = {
                        summary: operation.summary || '',
                        description: operation.description || '',
                        tags: operation.tags || [],
                        parameters: operation.parameters ? operation.parameters.map(p => {
                            return {
                                name: p.name || p.$ref,
                                required: p.required || false,
                                location: p.in || 'unknown'
                            };
                        }) : [],
                        requestBody: operation.requestBody ? {
                            required: operation.requestBody.required || false,
                            contentTypes: Object.keys(operation.requestBody.content || {})
                        } : null,
                        responses: Object.keys(operation.responses || {}).map(code => ({
                            code,
                            description: operation.responses[code].description || ''
                        }))
                    };
                }
            }
        }

        return {
            securityDefinitions: {
                schemes: securitySchemes,
                requirements: securityRequirements,
                summary: 'Security schemes extracted from the OpenAPI specification',
                recommendations: {
                    authentication: Object.keys(securitySchemes).length > 0 ?
                        'The API already has security schemes defined' :
                        'Consider adding JWT or API Key authentication',
                    authorization: 'Implement role-based access control (RBAC) for different user types'
                }
            },
            policies: {
                rateLimiting,
                caching,
                validation,
                recommendations: {
                    rateLimiting: 'Implement token bucket algorithm for rate limiting',
                    caching: 'Use ETags for cache validation',
                    validation: 'Implement request validation middleware'
                }
            },
            documentation: {
                endpoints: endpointDocs,
                summary: 'API documentation generated from OpenAPI spec',
                recommendations: {
                    examples: 'Add request and response examples for each endpoint',
                    descriptions: 'Ensure all parameters have clear descriptions'
                }
            },
            versioning: {
                strategy: 'semantic',
                current: openApiSpec.info?.version || '1.0.0',
                supported: [openApiSpec.info?.version || '1.0.0'],
                recommendations: {
                    headers: 'Use Accept-Version header for API versioning',
                    deprecation: 'Include Sunset headers for deprecated endpoints'
                }
            }
        };
    } catch (error) {
        console.error('Error generating fallback documentation:', error);
        return {
            error: 'Could not generate fallback documentation',
            message: 'Please try again later'
        };
    }
}

module.exports = { callDocumentationLambda, generateFallbackSecurityDocs };