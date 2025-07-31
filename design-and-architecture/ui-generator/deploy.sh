#!/bin/bash

# Get the absolute path to the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check AWS credentials
echo "Checking AWS credentials..."
"$SCRIPT_DIR/aws-setup.sh" --test

# If the test fails, exit
if [ $? -ne 0 ]; then
  echo "AWS credentials check failed. Please run './aws-setup.sh --setup' to configure your credentials."
  exit 1
fi

# Prepare Lambda deployment package
echo "Preparing Lambda deployment package..."
"$SCRIPT_DIR/prepare-lambda.sh"

# If the preparation fails, exit
if [ $? -ne 0 ]; then
  echo "Lambda preparation failed. Please check the errors above."
  exit 1
fi

# Build frontend
echo "Building frontend..."
cd "$SCRIPT_DIR/frontend"
npm install
npm run build

if [ $? -ne 0 ]; then
  echo "Frontend build failed. Please check the errors above."
  exit 1
fi

echo "Frontend build completed successfully."
cd "$SCRIPT_DIR"

# Deploy with CDK
echo "Deploying with CDK..."
cd "$SCRIPT_DIR/cdk"

# Install dependencies
echo "Installing CDK dependencies..."
npm install

# Bootstrap CDK
echo "Bootstrapping CDK..."
npx cdk bootstrap

if [ $? -ne 0 ]; then
  echo "CDK bootstrap failed. Please check the errors above."
  exit 1
fi

# Deploy using CDK directly
echo "Deploying CDK stack..."
CDK_DEPLOY_ACCOUNT=$(aws sts get-caller-identity --query "Account" --output text)
CDK_DEPLOY_REGION=${AWS_REGION:-us-east-1}

npx cdk deploy \
  --require-approval never \
  --context account=${CDK_DEPLOY_ACCOUNT} \
  --context region=${CDK_DEPLOY_REGION}

if [ $? -ne 0 ]; then
  echo "CDK deployment failed. Please check the errors above."
  exit 1
fi

# Get the CloudFront distribution ID
CLOUDFRONT_ID=$(aws cloudformation describe-stacks --stack-name UiGeneratorStack --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)

# Invalidate CloudFront cache
if [ -n "$CLOUDFRONT_ID" ]; then
  echo "Invalidating CloudFront cache for distribution $CLOUDFRONT_ID..."
  aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_ID --paths "/*"
  
  if [ $? -ne 0 ]; then
    echo "Warning: Failed to invalidate CloudFront cache. You may need to do this manually."
  else
    echo "CloudFront cache invalidation initiated."
  fi
fi

echo "Deployment completed successfully!"
echo "You can access your application at the CloudFront URL printed above."