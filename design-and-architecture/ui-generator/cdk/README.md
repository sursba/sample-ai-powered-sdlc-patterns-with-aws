# UI Generator CDK

This directory contains the AWS CDK infrastructure code for deploying the UI Generator application.

## Prerequisites

- AWS CLI installed and configured with appropriate permissions
- Node.js 14+ installed
- AWS CDK v2 installed globally (`npm install -g aws-cdk`)

## Useful commands

* `npm install`     Install dependencies
* `npm run build`   Compile TypeScript to JS
* `npm run watch`   Watch for changes and compile
* `npm run test`    Perform the jest unit tests
* `cdk deploy`      Deploy this stack to your default AWS account/region
* `cdk diff`        Compare deployed stack with current state
* `cdk synth`       Emits the synthesized CloudFormation template

## Deployment Steps

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Bootstrap CDK (first time only)**:
   ```bash
   cdk bootstrap
   ```

4. **Deploy the stack**:
   ```bash
   cdk deploy
   ```

5. **Clean up when done**:
   ```bash
   cdk destroy
   ```

## Configuration

The deployment configuration is defined in `lib/config.ts`. You can modify this file to customize:

- AWS region
- Environment name
- Frontend settings (CloudFront, domain, etc.)
- Backend settings (Lambda, API Gateway, etc.)

## Architecture

This CDK stack deploys:

1. **Frontend**:
   - S3 bucket for hosting the React application
   - CloudFront distribution for content delivery

2. **Backend**:
   - Lambda function for the Flask application
   - API Gateway for REST API endpoints
   - IAM roles with Bedrock permissions

3. **Integration**:
   - CloudFront origin routing to API Gateway
   - S3 deployment for frontend assets