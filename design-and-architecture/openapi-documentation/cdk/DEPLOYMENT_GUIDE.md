# Deployment Guide - Amplify Cognito Integration

This guide walks you through deploying the OpenAPI Documentation application with Amplify hosting and Cognito authentication.

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **Node.js 18+** installed
3. **CDK CLI** installed (`npm install -g aws-cdk`)
4. **Git repository** connected to your AWS account (for Amplify)

## Deployment Steps

### 1. Install Dependencies

```bash
cd openapi-documentation/cdk
npm install
```

### 2. Bootstrap CDK (if not done before)

```bash
npx cdk bootstrap
```

### 3. Deploy All Stacks

Deploy all stacks in the correct order:

```bash
# Deploy all stacks
npx cdk deploy --all --require-approval never
```

Or deploy individually in order:

```bash
# 1. OpenSearch Stack
npx cdk deploy OpenSearchStack

# 2. Storage Stack  
npx cdk deploy StorageStack

# 3. Bedrock Stack
npx cdk deploy BedrockStack

# 4. Lambda Stack
npx cdk deploy LambdaStack

# 5. Amplify Auth Stack
npx cdk deploy AmplifyAuthStack
```

### 4. Configure Admin User

After deployment, set up the admin user:

```bash
# Set permanent admin password (optional - done automatically during deployment)
node user-management.js setPassword --username admin --password YourNewPassword123!
```

### 5. Deploy Client Application

You have two options for deploying the React client:

#### Option A: Zip Upload (Automated)
```bash
# Deploy with automatic client build and zip upload
DEPLOY_CLIENT_ZIP=true ./deploy.sh
```

#### Option B: Git Repository (Manual)
```bash
# Deploy infrastructure only
./deploy.sh

# Then manually connect Git repository:
# 1. Go to AWS Amplify Console
# 2. Find your app: openapi-documentation-app
# 3. Connect your Git repository
# 4. Configure build settings (amplify.yml is already configured)
```

## Environment Variables

You can customize the deployment by setting these environment variables:

```bash
# Deployment options
export DEPLOY_CLIENT_ZIP=true              # Deploy client via zip (default: false)

# Admin user configuration
export ADMIN_USERNAME="myadmin"
export ADMIN_EMAIL="admin@mycompany.com"
export ADMIN_TEMP_PASSWORD="MyTempPass123!"

# AWS configuration
export AWS_REGION="us-east-1"
export CDK_DEFAULT_REGION="us-east-1"
export CDK_DEFAULT_ACCOUNT="123456789012"

# Deploy with custom settings
DEPLOY_CLIENT_ZIP=true ADMIN_EMAIL="admin@mycompany.com" ./deploy.sh
```

## Post-Deployment

### 1. Get Stack Outputs

```bash
# Get all outputs
aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs'

# Get specific values
aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`AmplifyAppUrl`].OutputValue' --output text
```

### 2. Test Authentication

1. Visit the Amplify app URL
2. You should be redirected to Cognito login
3. Login with admin credentials
4. Test the application functionality

### 3. User Management

```bash
# Create additional users
node user-management.js createUser --username john --email john@example.com

# Manage existing users
node user-management.js getUser --username admin
node user-management.js setPassword --username john --password NewPass123!
```

## Troubleshooting

### Common Issues

#### 1. Stack Dependencies

If you get dependency errors, deploy stacks in order:
```bash
npx cdk deploy OpenSearchStack StorageStack BedrockStack LambdaStack AmplifyAuthStack
```

#### 2. Amplify Build Fails

Check the build logs in Amplify Console:
- Ensure environment variables are set correctly
- Verify the monorepo path: `openapi-documentation/client`
- Check that all dependencies are installed

#### 3. Authentication Fails

- Verify callback URLs in Cognito User Pool Client
- Check that the Amplify app URL matches the callback URL
- Ensure admin user has a permanent password set

#### 4. Lambda Function Errors

Check CloudWatch logs for the UserManagementFunction:
```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/AmplifyAuthStack-UserManagementFunction"
```

### Cleanup

To remove all resources:

```bash
# Delete all stacks (in reverse order)
npx cdk destroy AmplifyAuthStack LambdaStack BedrockStack StorageStack OpenSearchStack
```

## Security Considerations

1. **Change Default Passwords**: Always change the default admin password
2. **Use Strong Passwords**: Follow the password policy requirements
3. **Monitor Access**: Use CloudTrail to monitor authentication events
4. **Regular Updates**: Keep dependencies and CDK versions updated
5. **Environment Separation**: Use different stacks for dev/staging/prod

## Next Steps

After successful deployment:

1. Set up monitoring and alerting
2. Configure custom domain (optional)
3. Set up CI/CD pipeline for automatic deployments
4. Add additional users as needed
5. Configure backup and disaster recovery

## Support

For issues:
1. Check CloudWatch logs
2. Review CDK deployment logs
3. Verify AWS permissions
4. Check the troubleshooting section above