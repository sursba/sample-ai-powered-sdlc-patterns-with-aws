// Core dependencies
const fs = require('fs');
const path = require('path');

// External dependencies
const { v4: uuidv4 } = require('uuid');

// Services
const { generateOpenAPI } = require('../services/openapi-generator');
const { generateOpenAPIDocumentation } = require('../services/documentation-generator');
const s3Service = require('../services/s3Service');

// Utilities
const { ensureSpecsDirectory } = require('../utils/fileUtils');
const { sanitizeSpecId, sanitizeForLogging, createSafeFilePath } = require('../utils/security');

const getSpecsDirectory = () => ensureSpecsDirectory();

// Get latest OpenAPI spec
const getLatestOpenApi = (req, res) => {
  const specPath = process.env.AWS_LAMBDA_FUNCTION_NAME 
    ? '/tmp/generated_openapi.json'
    : path.join(__dirname, '../../static/generated_openapi.json');
  
  if (fs.existsSync(specPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(specPath, 'utf8'));
      
      // Fix OpenAPI version to ensure compatibility with Swagger UI
      if (data.openapi === '3.1.0') {
        data.openapi = '3.0.0';
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'inline; filename="openapi.json"');
      return res.send(JSON.stringify(data, null, 2));
    } catch (error) {
      return res.status(500).json({ error: 'Error reading OpenAPI specification' });
    }
  } else {
    return res.status(404).json({ error: 'No OpenAPI specification has been generated yet' });
  }
};

// Get specific OpenAPI spec by ID
const getOpenApiById = async (req, res) => {
  const { specId } = req.params;
  
  try {
    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';
    
    console.log('Looking for spec', sanitizeForLogging(specId), 'in project', sanitizeForLogging(projectName));
    
    // Try to get from S3
    const data = await s3Service.getSpec(projectName, specId);
    
    if (data) {
      console.log(`Successfully retrieved spec data from S3`);
      // Fix OpenAPI version to ensure compatibility with Swagger UI
      if (data.openapi === '3.1.0') {
        data.openapi = '3.0.0';
      }
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `inline; filename="openapi-${specId}.json"`);
      return res.send(JSON.stringify(data, null, 2));
    } else {
      console.log(`Spec ${specId} not found in S3 for project ${projectName}`);
    }
    
    // Fallback to file system for backward compatibility
    const sanitizedSpecId = sanitizeSpecId(specId);
    const specPath = createSafeFilePath(getSpecsDirectory(), sanitizedSpecId, '.json');
    
    if (fs.existsSync(specPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(specPath, 'utf8'));
        
        // Fix OpenAPI version to ensure compatibility with Swagger UI
        if (data.openapi === '3.1.0') {
          data.openapi = '3.0.0';
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `inline; filename="openapi-${specId}.json"`);
        return res.send(JSON.stringify(data, null, 2));
      } catch (error) {
        return res.status(500).json({ error: 'Error reading OpenAPI specification' });
      }
    }
    
    return res.status(404).json({ error: 'Specification not found' });
  } catch (error) {
    console.error('Error retrieving spec:', error);
    return res.status(500).json({ error: 'Error retrieving OpenAPI specification' });
  }
};

// List all generated specifications
const listSpecs = async (req, res) => {
  try {
    console.log('Starting listSpecs function...');
    const specs = [];
    
    console.log('Listing specs from ALL projects');
    
    // Get specs from ALL projects in S3 with timeout
    try {
      console.log('Attempting to fetch specs from ALL projects in S3...');
      
      // Add timeout to prevent long waits
      const s3Promise = s3Service.listAllSpecs();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('S3 query timeout')), 15000) // 15 second timeout for all projects
      );
      
      let s3Specs = await Promise.race([s3Promise, timeoutPromise]);
      console.log(`Found ${s3Specs.length} specs in S3 across all projects`);
      
      for (const s3Spec of s3Specs) {
        try {
          console.log(`Processing S3 spec: ${s3Spec.id} from project: ${s3Spec.projectName}`);
          
          // Get the actual spec data to extract title (with timeout)
          const specPromise = s3Service.getSpec(s3Spec.projectName, s3Spec.id);
          const specTimeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Spec fetch timeout')), 5000) // 5 second timeout per spec
          );
          
          const specData = await Promise.race([specPromise, specTimeoutPromise]);
          const title = specData?.info?.title || 'Untitled API';
          
          specs.push({
            id: s3Spec.id,
            title: title,
            created: s3Spec.lastModified,
            source: 's3',
            projectName: s3Spec.projectName
          });
          console.log(`Added S3 spec: ${s3Spec.id} - ${title} (${s3Spec.projectName})`);
        } catch (error) {
          console.error(`Error reading S3 spec ${s3Spec.id} from project ${s3Spec.projectName}:`, error);
          // Add spec with basic info even if we can't read the content
          specs.push({
            id: s3Spec.id,
            title: 'Untitled API',
            created: s3Spec.lastModified,
            source: 's3',
            projectName: s3Spec.projectName
          });
        }
      }
    } catch (error) {
      console.error('Error listing S3 specs from all projects:', error);
    }
    
    // Get specs from file system for backward compatibility
    const specsDir = getSpecsDirectory();
    if (fs.existsSync(specsDir)) {
      fs.readdirSync(specsDir).forEach(filename => {
        if (filename.endsWith('.json') && !filename.endsWith('-docs.json')) {
          const specId = filename.replace('.json', '');
          const specPath = path.join(specsDir, filename);
          
          try {
            const specData = JSON.parse(fs.readFileSync(specPath, 'utf8'));
            const title = specData.info?.title || 'Untitled API';
            const stats = fs.statSync(specPath);
            
            // Only add if not already in S3 specs
            if (!specs.find(s => s.id === specId)) {
              specs.push({
                id: specId,
                title: title,
                created: stats.birthtime,
                source: 'filesystem'
              });
            }
          } catch (error) {
            // Skip invalid files
          }
        }
      });
    }
    
    // Sort by creation time (newest first)
    specs.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    return res.json(specs);
  } catch (error) {
    console.error('Error listing specifications:', error);
    return res.status(500).json({ error: 'Error listing specifications' });
  }
};

// Generate OpenAPI specification after user approval
const generateOpenApiSpec = async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  
  try {
    // Generate OpenAPI spec without writing to file (we'll handle that here)
    const openApiSpec = await generateOpenAPI(prompt);
    
    if (openApiSpec.error) {
      return res.status(500).json({ error: openApiSpec.error });
    }
    
    const specId = uuidv4();
    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';
    
    console.log(`generateOpenApiSpec - projectName: ${projectName}, specId: ${specId}`);
    
    // Store in S3 with project context
    const s3Result = await s3Service.storeSpec(projectName, specId, openApiSpec);
    
    if (s3Result.success) {
      console.log(`Spec stored in S3: ${s3Result.s3Key}`);
      
      // Update project metadata
      await s3Service.updateProjectMetadata(projectName, {
        lastActivity: new Date().toISOString(),
        specCount: 1, // You might want to increment this
        prompt: prompt.substring(0, 200) // Store truncated prompt for reference
      });
    } else {
      console.error('Failed to store spec in S3:', s3Result.error);
    }
    
    // Also save to file system for backward compatibility
    const sanitizedSpecId = sanitizeSpecId(specId);
    const specPath = createSafeFilePath(getSpecsDirectory(), sanitizedSpecId, '.json');
    fs.writeFileSync(specPath, JSON.stringify(openApiSpec, null, 2));
    
    // Also save as the default spec for compatibility
    const defaultSpecPath = process.env.AWS_LAMBDA_FUNCTION_NAME 
      ? '/tmp/generated_openapi.json'
      : path.join(__dirname, '../../static/generated_openapi.json');
    fs.writeFileSync(defaultSpecPath, JSON.stringify(openApiSpec, null, 2));
    
    return res.json({
      success: true,
      message: 'OpenAPI specification generated successfully',
      specId: specId,
      projectName: projectName,
      s3Stored: s3Result.success,
      openApiSpec: openApiSpec
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Generate security specifications
const generateSecurity = async (req, res) => {
  const { specId, options } = req.body;
  
  if (!specId) {
    return res.status(400).json({ error: 'Specification ID is required' });
  }
  
  try {
    const sanitizedSpecId = sanitizeSpecId(specId);
    const specPath = createSafeFilePath(getSpecsDirectory(), sanitizedSpecId, '.json');
    
    if (!fs.existsSync(specPath)) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    
    const openApiSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    
    // Add security schemes based on options
    if (!openApiSpec.components) {
      openApiSpec.components = {};
    }
    
    if (!openApiSpec.components.securitySchemes) {
      openApiSpec.components.securitySchemes = {};
    }
    
    // Add selected security schemes
    if (options.apiKey) {
      openApiSpec.components.securitySchemes.apiKey = {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication'
      };
    }
    
    if (options.jwt) {
      openApiSpec.components.securitySchemes.bearerAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for authentication'
      };
    }
    
    if (options.basic) {
      openApiSpec.components.securitySchemes.basicAuth = {
        type: 'http',
        scheme: 'basic',
        description: 'Basic authentication'
      };
    }
    
    if (options.oauth2) {
      openApiSpec.components.securitySchemes.oauth2 = {
        type: 'oauth2',
        flows: {
          implicit: {
            authorizationUrl: 'https://example.com/oauth/authorize',
            scopes: {
              'read': 'Read access',
              'write': 'Write access'
            }
          }
        },
        description: 'OAuth 2.0 authentication'
      };
    }
    
    // Apply security to all endpoints
    const security = [];
    
    if (options.apiKey) {
      security.push({ apiKey: [] });
    }
    
    if (options.jwt) {
      security.push({ bearerAuth: [] });
    }
    
    if (options.basic) {
      security.push({ basicAuth: [] });
    }
    
    if (options.oauth2) {
      security.push({ oauth2: ['read', 'write'] });
    }
    
    if (security.length > 0) {
      openApiSpec.security = security;
    }
    
    // Add rate limiting info if selected
    if (options.rateLimit) {
      if (!openApiSpec.info.description) {
        openApiSpec.info.description = '';
      }
      
      openApiSpec.info.description += '\n\n## Rate Limiting\n\nThis API implements rate limiting to protect against abuse. Clients are limited to 100 requests per minute. Rate limit headers are included in responses.';
      
      // Add rate limit headers to responses
      for (const path in openApiSpec.paths) {
        for (const method in openApiSpec.paths[path]) {
          if (typeof openApiSpec.paths[path][method] === 'object') {
            if (!openApiSpec.paths[path][method].responses) {
              openApiSpec.paths[path][method].responses = {};
            }
            
            if (!openApiSpec.paths[path][method].responses['429']) {
              openApiSpec.paths[path][method].responses['429'] = {
                description: 'Too Many Requests',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        error: {
                          type: 'string',
                          example: 'Rate limit exceeded'
                        }
                      }
                    }
                  }
                }
              };
            }
          }
        }
      }
    }
    
    // Add CORS info if selected
    if (options.cors) {
      if (!openApiSpec.info.description) {
        openApiSpec.info.description = '';
      }
      
      openApiSpec.info.description += '\n\n## CORS\n\nThis API supports Cross-Origin Resource Sharing (CORS) for browser-based clients. The server includes appropriate CORS headers in responses.';
    }
    
    // Save the updated spec
    fs.writeFileSync(specPath, JSON.stringify(openApiSpec, null, 2));
    
    return res.json({
      success: true,
      message: 'Security specifications added successfully',
      securitySchemes: openApiSpec.components.securitySchemes,
      security: openApiSpec.security
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Generate comprehensive API documentation using the Lambda function
const generateDocumentation = async (req, res) => {
  const { specId, openApiSpec: providedSpec } = req.body;
  
  if (!specId && !providedSpec) {
    return res.status(400).json({ error: 'Specification ID or OpenAPI spec is required' });
  }
  
  try {
    let openApiSpec = providedSpec;
    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';
    
    // If no spec provided, try to load from S3 first, then file system
    if (!openApiSpec && specId) {
      // Try to get from S3
      openApiSpec = await s3Service.getSpec(projectName, specId);
      
      // Fallback to file system
      if (!openApiSpec) {
        const sanitizedSpecId = sanitizeSpecId(specId);
        const specPath = createSafeFilePath(getSpecsDirectory(), sanitizedSpecId, '.json');
        
        if (fs.existsSync(specPath)) {
          openApiSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
        } else {
          // Try to load from the default location
          const defaultSpecPath = process.env.AWS_LAMBDA_FUNCTION_NAME 
            ? '/tmp/generated_openapi.json'
            : path.join(__dirname, '../../static/generated_openapi.json');
            
          if (fs.existsSync(defaultSpecPath)) {
            openApiSpec = JSON.parse(fs.readFileSync(defaultSpecPath, 'utf8'));
          } else {
            return res.status(404).json({ 
              error: 'Specification not found. Please regenerate the OpenAPI specification first.' 
            });
          }
        }
      }
    }
    
    if (!openApiSpec) {
      return res.status(400).json({ error: 'No OpenAPI specification available' });
    }
    
    const context = {
      projectName: projectName
    };
    
    const documentation = await generateOpenAPIDocumentation(openApiSpec, context);
    
    // Store documentation in S3
    const s3Result = await s3Service.storeDocs(projectName, specId, documentation);
    if (s3Result.success) {
      console.log(`Documentation stored in S3: ${s3Result.s3Key}`);
    } else {
      console.error('Failed to store documentation in S3:', s3Result.error);
    }
    
    // Also save the documentation to file system for backward compatibility
    const sanitizedSpecId = sanitizeSpecId(specId);
    const docsPath = createSafeFilePath(getSpecsDirectory(), sanitizedSpecId, '-docs.json');
    fs.writeFileSync(docsPath, JSON.stringify(documentation, null, 2));
    
    return res.json({
      success: true,
      message: documentation.fallback 
        ? 'Basic API documentation generated successfully'
        : 'Comprehensive API documentation generated successfully',
      documentation: documentation,
      s3Stored: s3Result.success
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Get existing documentation for a specific spec ID
const getDocumentationById = async (req, res) => {
  const { specId } = req.params;
  
  try {
    // Use project name from project middleware
    const projectName = req.projectName || 'default-project';
    
    console.log(`Looking for documentation for spec ${specId} in project ${projectName}`);
    
    // Try to get from S3
    const docsData = await s3Service.getDocs(projectName, specId);
    
    if (docsData) {
      console.log(`Successfully retrieved documentation from S3`);
      return res.json({
        success: true,
        documentation: docsData.documentation || docsData,
        source: 's3'
      });
    } else {
      console.log(`Documentation not found in S3 for spec ${specId} in project ${projectName}`);
    }
    
    // Fallback to file system for backward compatibility
    const sanitizedSpecId = sanitizeSpecId(specId);
    const docsPath = createSafeFilePath(getSpecsDirectory(), sanitizedSpecId, '-docs.json');
    
    if (fs.existsSync(docsPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
        console.log(`Found documentation in filesystem`);
        return res.json({
          success: true,
          documentation: data,
          source: 'filesystem'
        });
      } catch (error) {
        console.error('Error reading documentation from filesystem:', error);
        return res.status(500).json({ error: 'Error reading documentation' });
      }
    }
    
    return res.status(404).json({ error: 'Documentation not found' });
  } catch (error) {
    console.error('Error retrieving documentation:', error);
    return res.status(500).json({ error: 'Error retrieving documentation' });
  }
};

module.exports = {
  getLatestOpenApi,
  getOpenApiById,
  listSpecs,
  generateOpenApiSpec,
  generateSecurity,
  generateDocumentation,
  getDocumentationById
};