# User Management Guide

This guide explains how to manage users in the OpenAPI Documentation application using AWS Cognito.

## Overview

The application uses AWS Cognito User Pool for authentication. An admin user is automatically created during CDK deployment, and additional users can be managed through the provided Lambda function and CLI tools.

## Admin User Creation

### Automatic Creation

During CDK deployment, an admin user is automatically created with configurable credentials:

- **Username**: Configurable via `ADMIN_USERNAME` environment variable (default: `admin`)
- **Email**: Configurable via `ADMIN_EMAIL` environment variable (default: `admin@example.com`)
- **Temporary Password**: Configurable via `ADMIN_TEMP_PASSWORD` environment variable (default: `TempPass123!`)

### Configuration

Set environment variables before deployment to customize the admin user:

```bash
export ADMIN_USERNAME="myadmin"
export ADMIN_EMAIL="admin@mycompany.com"
export ADMIN_TEMP_PASSWORD="MyTempPass123!"

# Deploy the stack
npm run deploy
```

## User Management Operations

### Using the CLI Script

The `user-management.js` script provides a command-line interface for managing users:

#### Set Permanent Password

```bash
node user-management.js setPassword --username admin --password NewPassword123!
```

#### Create New User

```bash
node user-management.js createUser --username john --email john@example.com --password TempPass123!
```

#### Delete User

```bash
node user-management.js deleteUser --username olduser
```

#### Get User Information

```bash
node user-management.js getUser --username admin
```

### Using the Setup Script

The `setup-admin-user.sh` script provides an interactive way to set up the admin user after deployment:

```bash
./setup-admin-user.sh
```

This script will:
1. Check if the CDK stack is deployed
2. Verify the admin user status
3. Provide instructions for setting up the permanent password
4. Show available management commands

## Environment Variables

### For CDK Deployment

- `ADMIN_USERNAME`: Admin username (default: `admin`)
- `ADMIN_EMAIL`: Admin email address (default: `admin@example.com`)
- `ADMIN_TEMP_PASSWORD`: Temporary password (default: `TempPass123!`)

### For Management Scripts

- `AWS_REGION`: AWS region where the stack is deployed (default: `us-east-1`)
- `STACK_NAME`: Name of the CDK stack (default: `AmplifyAuthStack`)

## Password Requirements

Cognito enforces the following password policy:

- Minimum 8 characters
- At least one lowercase letter
- At least one uppercase letter
- At least one number
- At least one special character

## User Lifecycle

### New User Creation

1. User is created with a temporary password
2. User must change password on first login
3. User status changes from `FORCE_CHANGE_PASSWORD` to `CONFIRMED`

### Password Management

- Temporary passwords expire after 7 days
- Permanent passwords can be set via the management function
- Users can change their own passwords through the web interface

## Security Considerations

### Admin User

- The admin user is created with administrative privileges
- Use a strong, unique password
- Consider rotating the password regularly
- Monitor admin user activity through CloudTrail

### User Management Function

- The Lambda function has minimal required permissions
- Only allows operations on the specific User Pool
- Logs all operations to CloudWatch
- Should only be invoked by authorized administrators

### Access Control

- Users are managed through Cognito User Pool
- No self-registration is allowed (admin-managed only)
- Email verification is automatically set to true for created users
- Device tracking is enabled for additional security

## Troubleshooting

### Common Issues

#### Stack Not Found

```
❌ Stack 'AmplifyAuthStack' not found in region 'us-east-1'
```

**Solution**: Ensure the CDK stack is deployed:
```bash
cd openapi-documentation/cdk
npm run deploy
```

#### Function Not Found

```
❌ UserManagementFunctionName output not found in stack
```

**Solution**: Redeploy the stack to ensure all outputs are created:
```bash
npm run deploy
```

#### Invalid Password

```
❌ Error: Password does not conform to policy
```

**Solution**: Ensure password meets the requirements (8+ chars, uppercase, lowercase, number, special character)

#### User Already Exists

```
❌ Error: User already exists
```

**Solution**: Use `setPassword` instead of `createUser`, or delete the existing user first

### Getting Help

1. Check the CloudWatch logs for the UserManagementFunction
2. Verify AWS credentials and permissions
3. Ensure the CDK stack is properly deployed
4. Check the Cognito User Pool in the AWS Console

## AWS Console Management

You can also manage users directly through the AWS Console:

1. Go to AWS Cognito service
2. Select "User pools"
3. Find your user pool (named `openapi-docs-user-pool`)
4. Use the "Users" tab to manage users manually

## Integration with Application

The user management system integrates with the main application:

- Users authenticate through Cognito Hosted UI
- JWT tokens are used for API authentication
- User sessions are managed automatically
- Password changes can be done through the web interface

## Best Practices

1. **Use Strong Passwords**: Always use passwords that meet or exceed the policy requirements
2. **Regular Rotation**: Consider rotating admin passwords regularly
3. **Principle of Least Privilege**: Only create users that need access
4. **Monitor Access**: Use CloudTrail to monitor user management operations
5. **Backup Strategy**: Document user accounts and consider backup procedures
6. **Environment Separation**: Use different User Pools for different environments