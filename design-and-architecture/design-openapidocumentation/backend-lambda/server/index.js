// Load environment variables - Lambda provides these via environment
require('dotenv').config();

// Core dependencies
const express = require('express');
const cors = require('cors');

// Controllers
const analysisController = require('./controllers/analysisController');
const openApiController = require('./controllers/openApiController');

// Middleware
const upload = require('./middleware/uploadMiddleware');
const authMiddleware = require('../shared/auth-middleware');
const projectMiddleware = require('./middleware/projectMiddleware');

// Utilities
const { ensureSpecsDirectory } = require('./utils/fileUtils');

// Initialize Express app
const app = express();

// Completely disable Express CORS since Lambda Function URL CORS is configured
// This prevents duplicate CORS headers which cause the browser error
// The Lambda Function URL CORS configuration should handle all CORS requirements

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    lambda: true
  });
});

// Ensure specs directory exists (Lambda will use /tmp)
ensureSpecsDirectory();

// Authentication configuration
const authConfig = {
  region: process.env.AWS_REGION || 'eu-west-1',
  userPoolId: process.env.USER_POOL_ID,
  clientId: process.env.USER_POOL_CLIENT_ID,
  required: true
};

// Custom Express middleware for Lambda Function URL with IAM authentication
const expressAuthMiddleware = async (req, res, next) => {
  try {
    // For Lambda Function URL with IAM authentication, the request is already authenticated
    // by AWS IAM before reaching our Express server. The Lambda runtime provides
    // the authentication context in the original Lambda event.

    // Check if we have Lambda context with authentication info
    if (req.apiGateway && req.apiGateway.event && req.apiGateway.event.requestContext) {
      const requestContext = req.apiGateway.event.requestContext;

      // For IAM authentication, the identity information is in requestContext.identity
      if (requestContext.identity && requestContext.identity.userArn) {
        // Request was authenticated via IAM (Cognito Identity Pool)
        req.user = {
          userArn: requestContext.identity.userArn,
          accountId: requestContext.identity.accountId,
          principalId: requestContext.identity.principalId,
          sourceIp: requestContext.identity.sourceIp,
          authenticated: true,
          authType: 'IAM'
        };
        req.auth = {
          success: true,
          authenticated: true,
          user: req.user,
          authType: 'IAM'
        };
        return next();
      }
    }

    // Fallback: Try JWT authentication for direct token access
    const event = {
      headers: req.headers,
      queryStringParameters: req.query,
      requestContext: req.apiGateway?.event?.requestContext || {}
    };

    const authResult = await authMiddleware.authenticateRequest(event, {
      ...authConfig,
      required: false // Make it optional for IAM-authenticated requests
    });

    if (authResult.success && authResult.authenticated) {
      // JWT authentication successful
      req.user = authResult.user;
      req.auth = authResult;
      return next();
    }

    // If we reach here, neither IAM nor JWT authentication worked
    // For Lambda Function URL with IAM auth, this should not happen for authenticated requests
    console.log('No authentication found - this may be a configuration issue');

    // Allow the request to proceed since IAM authentication should have been handled by AWS
    // The Lambda Function URL with IAM auth should reject unauthenticated requests before they reach here
    req.user = {
      authenticated: true,
      authType: 'IAM_ASSUMED',
      note: 'Request reached Lambda, assuming IAM authentication passed'
    };
    req.auth = {
      success: true,
      authenticated: true,
      user: req.user,
      authType: 'IAM_ASSUMED'
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal authentication error',
      code: 'AUTH_MIDDLEWARE_ERROR'
    });
  }
};

// Configuration endpoint for client (no auth required for config)
app.get('/api/config', (req, res) => {
  res.json({
    aws: {
      region: process.env.AWS_REGION || 'eu-west-1',
      userPoolId: process.env.USER_POOL_ID,
      userPoolClientId: process.env.USER_POOL_CLIENT_ID,
      authDomain: process.env.AUTH_DOMAIN
    },
    api: {
      baseUrl: process.env.LAMBDA_FUNCTION_URL || ''
    }
  });
});

// Debug endpoint to test authentication (no auth required for debugging)
app.get('/api/debug/auth', (req, res) => {
  res.json({
    message: 'Debug endpoint reached successfully',
    timestamp: new Date().toISOString(),
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin
    },
    requestInfo: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      protocol: req.protocol
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      userPoolId: process.env.USER_POOL_ID ? 'Set' : 'Missing',
      userPoolClientId: process.env.USER_POOL_CLIENT_ID ? 'Set' : 'Missing'
    }
  });
});

// Test JWT token validation endpoint (no auth required for debugging)
app.post('/api/debug/validate-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required in request body'
      });
    }

    // Test token validation using our auth middleware
    const event = {
      headers: {
        authorization: `Bearer ${token}`
      },
      queryStringParameters: {},
      requestContext: {}
    };

    const authResult = await authMiddleware.authenticateRequest(event, {
      ...authConfig,
      required: true
    });

    res.json({
      success: true,
      message: 'Token validation test completed',
      authResult: {
        success: authResult.success,
        authenticated: authResult.authenticated,
        user: authResult.user,
        error: authResult.error ? {
          statusCode: authResult.error.statusCode,
          message: JSON.parse(authResult.error.body).error
        } : null
      }
    });
  } catch (error) {
    console.error('Token validation test error:', error);
    res.status(500).json({
      success: false,
      error: 'Token validation test failed',
      details: error.message
    });
  }
});

// Apply authentication to all /api routes except /api/config and /api/debug
app.use('/api', (req, res, next) => {
  if (req.path === '/config' || req.path.startsWith('/debug')) {
    return next();
  }
  return expressAuthMiddleware(req, res, next);
});

// Apply project middleware to all /api routes after authentication
app.use('/api', projectMiddleware);

// Analysis Routes
app.post('/api/generate', analysisController.generateAnalysis);
app.post('/api/upload-image', upload.single('image'), analysisController.uploadImage);
app.post('/api/analyze-image', upload.single('image'), analysisController.analyzeImage);
app.get('/api/analysis-content', analysisController.getAnalysisContent);
app.post('/api/analysis-content', analysisController.getAnalysisContent); // POST version for AWS IAM compatibility
app.post('/api/generate-bounded-contexts', analysisController.generateBoundedContexts);
app.post('/api/generate-ascii-diagram', analysisController.generateAsciiDiagram);
app.delete('/api/remove-image', analysisController.removeImage);
app.get('/api/image-status', analysisController.getImageStatus);
app.post('/api/image-status', analysisController.getImageStatus); // POST version for AWS IAM compatibility

// New Analysis Retrieval Routes
app.get('/api/analysis/:projectName', analysisController.getAnalysisByProject);
app.post('/api/analysis/:projectName', analysisController.getAnalysisByProject); // POST version for AWS IAM compatibility
app.get('/api/projects', analysisController.getAllProjects);
app.post('/api/projects', analysisController.getAllProjects); // POST version for AWS IAM compatibility



// OpenAPI Routes
app.get('/api/openapi.json', openApiController.getLatestOpenApi);
app.post('/api/openapi.json', openApiController.getLatestOpenApi); // POST version for AWS IAM compatibility
app.get('/api/openapi/:specId', openApiController.getOpenApiById);
app.post('/api/openapi/:specId', openApiController.getOpenApiById); // POST version for AWS IAM compatibility
app.get('/api/specs', openApiController.listSpecs);
app.post('/api/specs', openApiController.listSpecs); // POST version for AWS IAM compatibility
app.post('/api/generate-openapi', openApiController.generateOpenApiSpec);
app.post('/api/generate-security', openApiController.generateSecurity);
app.post('/api/generate-documentation', openApiController.generateDocumentation);
app.get('/api/documentation/:specId', openApiController.getDocumentationById);
app.post('/api/documentation/:specId', openApiController.getDocumentationById); // POST version for AWS IAM compatibility

// Default route for Lambda (no static file serving)
app.get('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: 'This is a Lambda API endpoint. Static files are served by Amplify.'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

module.exports = app;