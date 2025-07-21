// Amplify configuration for Cognito authentication
// Environment variables are injected by AWS Amplify during build

const config = {
  aws_project_region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  aws_cognito_region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  aws_user_pools_id: process.env.REACT_APP_USER_POOL_ID,
  aws_user_pools_web_client_id: process.env.REACT_APP_USER_POOL_CLIENT_ID,
  oauth: {
    domain: process.env.REACT_APP_AUTH_DOMAIN,
    scope: ['phone', 'email', 'openid', 'profile'],
    redirectSignIn: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    redirectSignOut: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    responseType: 'code'
  },
  federationTarget: 'COGNITO_USER_POOLS',
  // API configuration
  api: {
    domainAnalyzerFunction: process.env.REACT_APP_DOMAIN_ANALYZER_FUNCTION,
    docGeneratorFunction: process.env.REACT_APP_DOC_GENERATOR_FUNCTION
  }
};

// Validate required configuration
const requiredEnvVars = [
  'REACT_APP_AWS_REGION',
  'REACT_APP_USER_POOL_ID',
  'REACT_APP_USER_POOL_CLIENT_ID',
  'REACT_APP_AUTH_DOMAIN'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('Missing required environment variables:', missingVars);
  console.warn('Authentication may not work properly');
}

// Log configuration in development (without sensitive data)
if (process.env.NODE_ENV === 'development') {
  console.log('Amplify Configuration:', {
    region: config.aws_project_region,
    userPoolId: config.aws_user_pools_id ? '***configured***' : 'missing',
    clientId: config.aws_user_pools_web_client_id ? '***configured***' : 'missing',
    authDomain: config.oauth.domain ? '***configured***' : 'missing',
    redirectSignIn: config.oauth.redirectSignIn,
    redirectSignOut: config.oauth.redirectSignOut
  });
}

export default config;