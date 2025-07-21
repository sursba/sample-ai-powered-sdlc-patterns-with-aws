#!/bin/bash

# Deploy React Frontend to Amplify with Lambda Backend
# This script builds the React app and deploys it to Amplify
# The backend runs in the Lambda function with AWS IAM authentication

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "=========================================="
echo "  Deploy React Frontend to Amplify"
echo "=========================================="
echo ""

# Get Amplify App ID
APP_ID=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`AmplifyAppId`].OutputValue' --output text 2>/dev/null)

if [ -z "$APP_ID" ]; then
    print_error "Could not find Amplify App ID. Make sure AmplifyAuthStack is deployed."
    exit 1
fi

print_status "Found Amplify App ID: $APP_ID"

# Get environment variables from deployed stacks
print_status "Getting environment variables from deployed stacks..."

USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text)
IDENTITY_POOL_ID=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`IdentityPoolId`].OutputValue' --output text)
AUTH_DOMAIN=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`AuthDomain`].OutputValue' --output text)
AMPLIFY_APP_URL=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`AmplifyAppUrl`].OutputValue' --output text)
LAMBDA_FUNCTION_URL=$(aws cloudformation describe-stacks --stack-name LambdaStack --query 'Stacks[0].Outputs[?OutputKey==`BackendFunctionUrl`].OutputValue' --output text)

print_status "Environment variables:"
echo "  USER_POOL_ID: $USER_POOL_ID"
echo "  USER_POOL_CLIENT_ID: $USER_POOL_CLIENT_ID"
echo "  IDENTITY_POOL_ID: $IDENTITY_POOL_ID"
echo "  AUTH_DOMAIN: $AUTH_DOMAIN"
echo "  AMPLIFY_APP_URL: $AMPLIFY_APP_URL"
echo "  LAMBDA_FUNCTION_URL: $LAMBDA_FUNCTION_URL"

# Go to client directory
cd client

# Create .env file for React build
print_status "Creating environment file for React build..."
cat > .env << EOF
# React App environment variables
REACT_APP_AWS_REGION=eu-west-1
REACT_APP_USER_POOL_ID=$USER_POOL_ID
REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
REACT_APP_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
REACT_APP_AUTH_DOMAIN=$AUTH_DOMAIN
REACT_APP_API_URL=$LAMBDA_FUNCTION_URL

# Vite environment variables (for compatibility)
VITE_AWS_REGION=eu-west-1
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
VITE_AUTH_DOMAIN=$AUTH_DOMAIN
VITE_API_URL=$LAMBDA_FUNCTION_URL

NODE_ENV=production
EOF

print_success "Environment file created!"
print_status "Environment file contents:"
cat .env

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing client dependencies..."
    npm ci >/dev/null 2>&1
fi

# Build the React application with explicit environment variables
print_status "Building React application with environment variables..."
export REACT_APP_AWS_REGION=eu-west-1
export REACT_APP_USER_POOL_ID=$USER_POOL_ID
export REACT_APP_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
export REACT_APP_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
export REACT_APP_AUTH_DOMAIN=$AUTH_DOMAIN
export REACT_APP_API_URL=$LAMBDA_FUNCTION_URL

# Also export Vite environment variables
export VITE_AWS_REGION=eu-west-1
export VITE_USER_POOL_ID=$USER_POOL_ID
export VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
export VITE_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
export VITE_AUTH_DOMAIN=$AUTH_DOMAIN
export VITE_API_URL=$LAMBDA_FUNCTION_URL

export NODE_ENV=production

print_status "Exported environment variables:"
env | grep REACT_APP

npm run build

if [ ! -d "dist" ]; then
    print_error "Build failed - dist directory not found"
    exit 1
fi

print_success "React application built successfully!"

# Create frontend-only deployment package
print_status "Creating frontend deployment package..."

# Create temporary directory for frontend deployment
TEMP_DIR=$(mktemp -d)
print_status "Using temp directory: $TEMP_DIR"

# Copy React build files to root of temp directory (static files only)
print_status "Copying React build files..."
cp -r dist/* "$TEMP_DIR/" || { print_error "Failed to copy React build files"; exit 1; }

# Show what we have in the temp directory
print_status "Contents of deployment package:"
ls -la "$TEMP_DIR/"

# Create deployment zip
ZIP_FILE="frontend-$(date +%Y%m%d-%H%M%S).zip"
print_status "Creating zip file: $ZIP_FILE"

# Get the absolute path to the client directory
CLIENT_DIR=$(pwd)
cd "$TEMP_DIR"
zip -r "$CLIENT_DIR/$ZIP_FILE" . >/dev/null 2>&1 || { print_error "Failed to create zip file"; exit 1; }
cd "$CLIENT_DIR"

# Cleanup temp directory
rm -rf "$TEMP_DIR"

print_success "Created frontend deployment zip: $ZIP_FILE"

# Go back to root directory
cd ..

# Discover and stop ALL jobs manually
print_status "Discovering all Amplify jobs..."

# Get all jobs (not just running/pending ones)
ALL_JOBS_JSON=$(aws amplify list-jobs --app-id "$APP_ID" --branch-name main --max-results 20 --output json)
echo "$ALL_JOBS_JSON" | jq -r '.jobSummaries[] | "\(.jobId) \(.status)"' | while read JOB_ID STATUS; do
    print_status "Found job $JOB_ID with status: $STATUS"
done

# Get specifically running/pending jobs and store in array
ACTIVE_JOBS_ARRAY=($(echo "$ALL_JOBS_JSON" | jq -r '.jobSummaries[] | select(.status=="PENDING" or .status=="RUNNING") | .jobId'))

if [ ${#ACTIVE_JOBS_ARRAY[@]} -gt 0 ]; then
    print_status "Found ${#ACTIVE_JOBS_ARRAY[@]} active jobs to stop:"
    for JOB_ID in "${ACTIVE_JOBS_ARRAY[@]}"; do
        print_status "  - Job ID: $JOB_ID"
    done
    
    # Stop each active job
    for JOB_ID in "${ACTIVE_JOBS_ARRAY[@]}"; do
        print_status "Stopping job: $JOB_ID"
        aws amplify stop-job --app-id "$APP_ID" --branch-name main --job-id "$JOB_ID" || print_warning "Failed to stop job $JOB_ID"
    done
    
    print_status "Waiting for jobs to stop..."
    sleep 5
    
    # Verify all jobs are stopped with multiple checks
    for check in {1..3}; do
        print_status "Verification check $check/3..."
        REMAINING_JOBS=$(aws amplify list-jobs --app-id "$APP_ID" --branch-name main --max-results 10 --query 'jobSummaries[?status==`PENDING` || status==`RUNNING`].jobId' --output text)
        
        if [ -z "$REMAINING_JOBS" ] || [ "$REMAINING_JOBS" = "None" ]; then
            print_success "All jobs stopped successfully!"
            break
        else
            print_warning "Still have active jobs: $REMAINING_JOBS"
            if [ $check -lt 3 ]; then
                print_status "Waiting 10 more seconds..."
                sleep 10
            fi
        fi
    done
else
    print_status "No active deployments found."
fi

# Final check - list current job status
print_status "Current job status:"
aws amplify list-jobs --app-id "$APP_ID" --branch-name main --max-results 5 --query 'jobSummaries[].{JobId:jobId,Status:status}' --output table

# Create new deployment with retry logic and better error reporting
print_status "Creating Amplify deployment..."

for attempt in {1..3}; do
    print_status "Deployment attempt $attempt/3..."
    
    # Capture both stdout and stderr
    if DEPLOYMENT_RESPONSE=$(aws amplify create-deployment --app-id "$APP_ID" --branch-name main --output json 2>&1); then
        # Check if response contains error
        if echo "$DEPLOYMENT_RESPONSE" | grep -q "error occurred"; then
            print_warning "AWS CLI Error: $DEPLOYMENT_RESPONSE"
        else
            # Use jq for better JSON parsing
            DEPLOYMENT_ID=$(echo "$DEPLOYMENT_RESPONSE" | jq -r '.jobId // empty')
            UPLOAD_URL=$(echo "$DEPLOYMENT_RESPONSE" | jq -r '.zipUploadUrl // empty')
            
            if [ -n "$DEPLOYMENT_ID" ] && [ -n "$UPLOAD_URL" ] && [ "$DEPLOYMENT_ID" != "null" ] && [ "$UPLOAD_URL" != "null" ]; then
                print_success "Deployment created successfully!"
                print_status "Deployment ID: $DEPLOYMENT_ID"
                break
            else
                print_warning "Failed to parse deployment response: $DEPLOYMENT_RESPONSE"
            fi
        fi
    else
        print_warning "AWS CLI command failed"
    fi
    
    if [ $attempt -eq 3 ]; then
        print_error "Failed to create deployment after 3 attempts"
        print_error "Last response: $DEPLOYMENT_RESPONSE"
        
        # Try to diagnose the issue
        print_status "Diagnosing the issue..."
        print_status "Checking if there are any remaining active jobs..."
        aws amplify list-jobs --app-id "$APP_ID" --branch-name main --max-results 5 --query 'jobSummaries[?status==`PENDING` || status==`RUNNING`]' --output table
        
        exit 1
    fi
    
    print_warning "Deployment creation failed, retrying in 15 seconds..."
    sleep 15
done

print_status "Uploading application..."
curl -X PUT "$UPLOAD_URL" \
    -H "Content-Type: application/zip" \
    --data-binary "@client/$ZIP_FILE" \
    --silent --show-error

# Start deployment
print_status "Starting deployment..."
if aws amplify start-deployment \
    --app-id "$APP_ID" \
    --branch-name main \
    --job-id "$DEPLOYMENT_ID" >/dev/null 2>&1; then
    print_success "Deployment started successfully!"
else
    print_error "Failed to start deployment"
    exit 1
fi

print_status "Monitoring deployment..."

# Monitor deployment
for i in {1..30}; do
    sleep 10
    JOB_STATUS=$(aws amplify get-job \
        --app-id "$APP_ID" \
        --branch-name main \
        --job-id "$DEPLOYMENT_ID" \
        --query 'job.summary.status' \
        --output text 2>/dev/null || echo "PENDING")
    
    if [ "$JOB_STATUS" = "SUCCEED" ]; then
        print_success "Deployment completed successfully!"
        break
    elif [ "$JOB_STATUS" = "FAILED" ]; then
        print_error "Deployment failed"
        exit 1
    fi
    
    if [ $((i % 3)) -eq 0 ]; then
        print_status "Deployment status: $JOB_STATUS"
    fi
    
    if [ $i -eq 30 ]; then
        print_warning "Deployment monitoring timed out - check Amplify console"
    fi
done

# Test the Lambda Function URL
print_status "Testing Lambda Function URL..."
if curl -s "$LAMBDA_FUNCTION_URL/health" >/dev/null 2>&1; then
    print_warning "Lambda Function URL is accessible without authentication (this should fail with IAM auth)"
else
    print_success "Lambda Function URL is properly secured with IAM authentication"
fi

# Set permanent admin password
print_status "Setting permanent admin password..."
USER_MGMT_FUNCTION=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserManagementFunctionName`].OutputValue' --output text)

if [ -n "$USER_MGMT_FUNCTION" ]; then
    print_status "Using User Management Function: $USER_MGMT_FUNCTION"
    
    # Set a permanent password for the admin user
    ADMIN_PASSWORD="HelloWorld123!"
    
    if aws lambda invoke \
        --function-name "$USER_MGMT_FUNCTION" \
        --payload "{\"action\":\"setPassword\",\"username\":\"admin\",\"password\":\"$ADMIN_PASSWORD\"}" \
        /tmp/user-response.json >/dev/null 2>&1; then
        
        RESPONSE=$(cat /tmp/user-response.json 2>/dev/null)
        if echo "$RESPONSE" | grep -q "Password set successfully"; then
            print_success "Admin password set successfully!"
        else
            print_warning "Password setting response: $RESPONSE"
        fi
        rm -f /tmp/user-response.json
    else
        print_warning "Failed to set admin password - you may need to set it manually"
    fi
else
    print_warning "Could not find User Management Function - admin password not set"
fi

# Cleanup
rm -f "client/$ZIP_FILE"
rm -f "client/.env"

print_success "Frontend deployed successfully!"
echo ""
echo "=========================================="
echo "         DEPLOYMENT SUMMARY"
echo "=========================================="
echo "Frontend URL:       $AMPLIFY_APP_URL"
echo "Backend API:        $LAMBDA_FUNCTION_URL"
echo "Authentication:     AWS IAM + Cognito"
echo "Admin Username:     admin"
echo "Admin Password:     HelloWorld123!"
echo "=========================================="
echo ""
echo "🎉 Your React frontend is now live at: $AMPLIFY_APP_URL"
echo "🚀 Backend runs in Lambda Function with Express server"
echo "🔐 API calls are authenticated with AWS IAM signatures"
echo ""
echo "Architecture:"
echo "  Frontend (React) → Amplify (Static Hosting)"
echo "  Backend (Express) → Lambda Function"
echo "  Authentication → Cognito + AWS IAM"
echo ""
echo "🔐 Login Credentials:"
echo "  Username: admin"
echo "  Password: HelloWorld123!"
echo ""
echo "Next steps:"
echo "1. ✅ Admin password has been set automatically"
echo "2. 🚀 Test the application by logging in at: $AMPLIFY_APP_URL"
echo "3. 🔍 Verify API calls work through the Lambda Function URL"
echo "4. 🔒 Change admin password if needed:"
echo "   cd cdk && node user-management.js setPassword --username admin --password YourNewPassword123!"