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

module.exports = { generateFallbackSecurityDocs };