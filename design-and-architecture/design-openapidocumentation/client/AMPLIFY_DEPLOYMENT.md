# Amplify Deployment Configuration

This document describes the AWS Amplify deployment configuration for the OpenAPI Documentation application with Cognito authentication.

## Build Configuration

The `amplify.yml` file configures the build process for AWS Amplify:

### Build Phases

1. **preBuild**: Install dependencies and validate environment variables
2. **build**: Build the React application using Vite

### Environment Variables

The following environment variables are automatically injected by the CDK stack:

- `REACT_APP_AWS_REGION`: AWS region where resources are deployed
- `REACT_APP_USER_POOL_ID`: Cognito User Pool ID
- `REACT_APP_USER_POOL_CLIENT_ID`: Cognito User Pool Client ID
- `REACT_APP_AUTH_DOMAIN`: Cognito authentication domain
- `REACT_APP_DOMAIN_ANALYZER_FUNCTION`: Domain analyzer Lambda function name
- `REACT_APP_DOC_GENERATOR_FUNCTION`: Document generator Lambda function name

### Custom Headers

Security headers are automatically applied to all responses:

- `Strict-Transport-Security`: Enforces HTTPS
- `X-Content-Type-Options`: Prevents MIME type sniffing
- `X-Frame-Options`: Prevents clickjacking
- `X-XSS-Protection`: Enables XSS filtering
- `Referrer-Policy`: Controls referrer information

### Caching Strategy

- **Static Assets** (JS/CSS): Long-term caching (1 year) with immutable flag
- **HTML Files**: No caching to ensure fresh content delivery
- **Dependencies**: Cached in `node_modules` for faster builds

## Routing Configuration

The Amplify app is configured with custom routing rules in the CDK stack:

1. **API Routes** (`/api/<*>`): Rewritten for Lambda proxy integration
2. **SPA Routes** (`/<*>`): All non-API routes redirect to `index.html` for client-side routing

## Monorepo Configuration

The application is configured as a monorepo with the client code in the `openapi-documentation/client` directory:

- `AMPLIFY_MONOREPO_APP_ROOT`: Set to `openapi-documentation/client`
- Build artifacts are generated in the `dist` directory

## Deployment Process

1. **Infrastructure**: Deploy the CDK stack to create Cognito and Amplify resources
2. **Source Connection**: Connect Amplify app to the Git repository
3. **Automatic Builds**: Amplify automatically builds and deploys on code changes
4. **Environment Injection**: CDK outputs are automatically injected as environment variables

## Validation

The build process includes environment variable validation:

- Required variables are checked during the preBuild phase
- Configuration format is validated
- Build fails if critical environment variables are missing

## Security Considerations

- Environment variables are injected at build time, not runtime
- Sensitive values are not exposed in the client bundle
- Security headers are applied to all responses
- HTTPS is enforced through HSTS headers

## Troubleshooting

### Build Failures

1. Check that all required environment variables are set in the CDK stack
2. Verify the monorepo app root configuration
3. Ensure Node.js dependencies are compatible

### Authentication Issues

1. Verify Cognito configuration in CDK outputs
2. Check callback URLs match the Amplify domain
3. Ensure CORS is properly configured for API endpoints

### Performance Issues

1. Review bundle size and chunk splitting configuration
2. Check caching headers are properly applied
3. Monitor build times and optimize dependencies if needed