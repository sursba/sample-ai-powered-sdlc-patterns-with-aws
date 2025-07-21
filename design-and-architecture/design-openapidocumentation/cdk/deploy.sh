#!/bin/bash

# OpenAPI Bedrock Agent Deployment Script
# This script automates the complete deployment of the OpenAPI Bedrock Agent system
# Now includes frontend deployment using the dedicated deploy-frontend.sh script
#
# Environment Variables:
#   ADMIN_EMAIL              - Admin user email (default: admin@example.com)
#   ADMIN_TEMP_PASSWORD      - Admin temporary password (default: HelloWorld123!)
#
# Usage:
#   ./deploy.sh              # Deploy complete infrastructure + frontend
#
# Deployment Features:
#   - Complete infrastructure deployment (OpenSearch, Storage, Bedrock, Lambda, Auth)
#   - S3 integration with structured user/session storage
#   - Frontend deployment using deploy-frontend.sh with all necessary environment variables
#   - Automatic admin user setup with password configuration
#   - Knowledge base ingestion and environment variable updates

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="."  # We're already in the CDK project directory
DOCS_DIR="../kb_docs"  # kb_docs is in the parent directory
# No longer need Python virtual environment

# Function to print colored output
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate environment variables
validate_environment_variables() {
    print_status "Validating environment variables..."
    
    # Check if .env file exists
    if [ ! -f "../.env" ]; then
        print_warning ".env file not found. Creating from template..."
        if [ -f "../.env.example" ]; then
            cp "../.env.example" "../.env"
            print_warning "Please edit ../.env with your actual values before continuing."
            print_error "Deployment stopped. Please configure environment variables."
            exit 1
        else
            print_error ".env.example template not found. Please create environment configuration."
            exit 1
        fi
    fi
    
    # Source the .env file
    set -a  # automatically export all variables
    source "../.env"
    set +a  # stop automatically exporting
    
    # Validate required variables
    local missing_vars=()
    
    # AWS Configuration
    [ -z "$AWS_REGION" ] && missing_vars+=("AWS_REGION")
    
    # Validate AWS_REGION format
    if [ -n "$AWS_REGION" ] && ! echo "$AWS_REGION" | grep -qE '^[a-z]{2}-[a-z]+-[0-9]$'; then
        print_error "Invalid AWS_REGION format: $AWS_REGION (expected format: us-east-1)"
        exit 1
    fi
    
    # Report missing variables
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        print_error "Please configure these variables in ../.env file"
        exit 1
    fi
    
    print_success "Environment variables validated!"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command_exists aws; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check Node.js
    if ! command_exists node; then
        print_error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    # Check npm
    if ! command_exists npm; then
        print_error "npm is not installed. Please install it first."
        exit 1
    fi
    
    # Check CDK
    if ! command_exists cdk; then
        print_error "AWS CDK is not installed. Please install it first: npm install -g aws-cdk"
        exit 1
    fi
    
    # Python is no longer required - we use Node.js for all scripts
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS credentials are not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Function to setup Node.js environment and AWS identity
setup_node_env() {
    print_status "Setting up Node.js environment..."
    
    # Ensure we have the required AWS SDK packages
    if [ ! -f "package.json" ]; then
        print_error "package.json not found. Please run from CDK directory."
        exit 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        npm install >/dev/null 2>&1
    fi
    
    print_success "Node.js environment ready!"
}

# Function to setup AWS identity for OpenSearch access
setup_aws_identity() {
    print_status "Setting up AWS identity for OpenSearch access..."
    
    # Check if CDK_IAM_USER_ARN is already set
    if [ -n "$CDK_IAM_USER_ARN" ]; then
        print_success "Using provided IAM ARN: $CDK_IAM_USER_ARN"
        return
    fi
    
    # Auto-detect current AWS identity
    print_status "Auto-detecting current AWS identity..."
    
    # Get the recommended ARN from the script
    DETECTED_ARN=$(node get-aws-identity.js --arn-only 2>/dev/null)
    
    if [ -n "$DETECTED_ARN" ]; then
        export CDK_IAM_USER_ARN="$DETECTED_ARN"
        print_success "Auto-detected IAM ARN: $CDK_IAM_USER_ARN"
    else
        print_warning "Could not auto-detect IAM ARN. Using account root (less secure)."
    fi
}

# Function to install Node.js dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    echo "Running npm install..."
    npm install
    
    echo "Running npm run build..."
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Dependencies installed and built!"
    else
        print_error "Build failed! See error messages above."
        exit 1
    fi
}

# Function to deploy OpenSearch stack
deploy_opensearch_stack() {
    print_status "Deploying OpenSearch stack..."
    
    cdk deploy OpenSearchStack --require-approval never --no-validation
    
    print_success "OpenSearch stack deployed!"
}

# Function to get stack outputs
get_stack_outputs() {
    print_status "Retrieving stack outputs..."
    
    # Get OpenSearch collection details
    COLLECTION_ARN=$(aws cloudformation describe-stacks --stack-name OpenSearchStack --query 'Stacks[0].Outputs[?OutputKey==`CollectionArn`].OutputValue' --output text)
    BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name OpenSearchStack --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text)
    
    # Extract collection ID from ARN
    COLLECTION_ID=$(echo "$COLLECTION_ARN" | sed 's/.*collection\///')
    COLLECTION_ENDPOINT="${COLLECTION_ID}.eu-west-1.aoss.amazonaws.com"
    
    print_success "Stack outputs retrieved!"
    echo "  Collection Endpoint: $COLLECTION_ENDPOINT"
    echo "  S3 Bucket: $BUCKET_NAME"
}

# Function to upload documents to S3
upload_documents() {
    print_status "Uploading documents to S3..."
    
    if [ -d "$DOCS_DIR" ]; then
        aws s3 sync "$DOCS_DIR" "s3://$BUCKET_NAME/" --quiet
        print_success "Documents uploaded to S3!"
    else
        print_warning "No documents directory found. Skipping document upload."
    fi
}

# Function to create vector index
create_vector_index() {
    print_status "Creating vector index in OpenSearch..."
    
    # Use the JavaScript version instead of Python
    node create-index.js
    
    if [ $? -eq 0 ]; then
        print_success "Vector index created!"
    else
        print_error "Failed to create vector index!"
        exit 1
    fi
}

# Function to deploy Storage stack
deploy_storage_stack() {
    print_status "Deploying Storage stack..."
    
    cdk deploy StorageStack --require-approval never --no-validation
    
    print_success "Storage stack deployed!"
}

# Function to deploy Bedrock stack
deploy_bedrock_stack() {
    print_status "Deploying Bedrock stack..."
    
    cdk deploy BedrockStack --require-approval never --no-validation
    
    print_success "Bedrock stack deployed!"
}

# Function to deploy Lambda stack
deploy_lambda_stack() {
    print_status "Deploying Lambda stack..."
    
    cdk deploy LambdaStack --require-approval never
    
    print_success "Lambda stack deployed!"
}

# Function to deploy Amplify Auth stack
deploy_amplify_auth_stack() {
    print_status "Deploying Amplify Auth stack..."
    
    # Set default values for admin user if not provided
    export ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@example.com"}
    export ADMIN_TEMP_PASSWORD=${ADMIN_TEMP_PASSWORD:-"HelloWorld123!"}
    
    print_status "Admin configuration:"
    echo "  Email: $ADMIN_EMAIL"
    echo "  Temp Password: $ADMIN_TEMP_PASSWORD"
    
    cdk deploy AmplifyAuthStack --require-approval never
    
    print_success "Amplify Auth stack deployed!"
    
    # Get the UserManagementFunction name for user reference
    USER_MGMT_FUNCTION=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserManagementFunctionName`].OutputValue' --output text 2>/dev/null || echo "N/A")
    
    # Set the admin password
    set_admin_password
    
    print_warning "Important: Admin password has been set to: $ADMIN_TEMP_PASSWORD"
    echo "  If you need to change it, run:"
    echo "  node user-management.js setPassword --username admin --password YourNewPassword123!"
}

# Function to deploy frontend using the dedicated deploy-frontend.sh script
deploy_frontend() {
    print_status "Deploying frontend using deploy-frontend.sh..."
    
    # Save current directory (should be cdk directory)
    ORIGINAL_CDK_DIR=$(pwd)
    
    # Go to project root where deploy-frontend.sh is located
    cd ".."
    
    # Check if deploy-frontend.sh exists
    if [ ! -f "deploy-frontend.sh" ]; then
        print_error "deploy-frontend.sh not found in project root"
        cd "$ORIGINAL_CDK_DIR"
        return 1
    fi
    
    # Make sure the script is executable
    chmod +x deploy-frontend.sh
    
    # Run the frontend deployment script
    print_status "Running deploy-frontend.sh..."
    if ./deploy-frontend.sh; then
        print_success "Frontend deployed successfully using deploy-frontend.sh!"
    else
        print_error "Frontend deployment failed"
        cd "$ORIGINAL_CDK_DIR"
        return 1
    fi
    
    # Go back to CDK directory
    cd "$ORIGINAL_CDK_DIR"
}

# Function to start ingestion job
start_ingestion() {
    print_status "Starting knowledge base ingestion..."
    
    # Get knowledge base and data source IDs
    KB_ID=$(aws cloudformation describe-stacks --stack-name BedrockStack --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
    DS_ID=$(aws bedrock-agent list-data-sources --knowledge-base-id "$KB_ID" --query 'dataSourceSummaries[0].dataSourceId' --output text)
    
    # Start ingestion job
    INGESTION_JOB=$(aws bedrock-agent start-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$DS_ID" --query 'ingestionJob.ingestionJobId' --output text)
    
    print_status "Waiting for ingestion to complete..."
    
    # Wait for ingestion to complete
    while true; do
        STATUS=$(aws bedrock-agent get-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$DS_ID" --ingestion-job-id "$INGESTION_JOB" --query 'ingestionJob.status' --output text)
        
        if [ "$STATUS" = "COMPLETE" ]; then
            print_success "Ingestion completed successfully!"
            break
        elif [ "$STATUS" = "FAILED" ]; then
            print_error "Ingestion failed!"
            exit 1
        else
            print_status "Ingestion status: $STATUS"
            sleep 10
        fi
    done
}

# Function to update environment variables
update_environment_variables() {
    print_status "Updating environment variables..."
    
    ./update-env.sh
    
    print_success "Environment variables updated!"
}

# Function to set admin password
set_admin_password() {
    print_status "Setting permanent admin password..."
    
    # Get the UserManagementFunction name
    USER_MGMT_FUNCTION=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserManagementFunctionName`].OutputValue' --output text 2>/dev/null || echo "N/A")
    
    if [ "$USER_MGMT_FUNCTION" = "N/A" ]; then
        print_error "Could not find UserManagementFunction. Admin password not set."
        return 1
    fi
    
    print_status "Using User Management Function: $USER_MGMT_FUNCTION"
    
    # Wait a few seconds to ensure the function is ready
    sleep 5
    
    # Set the admin password using the Lambda function directly
    RESPONSE=$(aws lambda invoke \
        --function-name "$USER_MGMT_FUNCTION" \
        --payload "{\"action\":\"setPassword\",\"username\":\"admin\",\"password\":\"$ADMIN_TEMP_PASSWORD\"}" \
        --cli-binary-format raw-in-base64-out \
        /tmp/lambda-output.json 2>/dev/null)
    
    # Check if the Lambda invocation was successful
    if [ $? -eq 0 ]; then
        # Parse the Lambda response
        LAMBDA_STATUS=$(cat /tmp/lambda-output.json | grep -o '"statusCode":200' || echo "")
        
        if [ -n "$LAMBDA_STATUS" ]; then
            print_success "Admin password set successfully!"
            return 0
        else
            print_warning "Lambda function returned an error. Check the response for details."
            cat /tmp/lambda-output.json
        fi
    else
        print_warning "Failed to invoke Lambda function. Admin password not set."
    fi
    
    print_warning "You may need to set the admin password manually using:"
    echo "  node user-management.js setPassword --username admin --password $ADMIN_TEMP_PASSWORD"
    
    return 1
}


# Function to display deployment summary
display_summary() {
    print_success "Deployment completed successfully!"
    
    AGENT_ID=$(aws cloudformation describe-stacks --stack-name BedrockStack --query 'Stacks[0].Outputs[?OutputKey==`AgentId`].OutputValue' --output text 2>/dev/null || echo "N/A")
    KB_ID=$(aws cloudformation describe-stacks --stack-name BedrockStack --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null || echo "N/A")
    AMPLIFY_APP_URL=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`AmplifyAppUrl`].OutputValue' --output text 2>/dev/null || echo "N/A")
    USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name AmplifyAuthStack --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null || echo "N/A")
    
    echo ""
    echo "=========================================="
    echo "         DEPLOYMENT SUMMARY"
    echo "=========================================="
    echo "Agent ID:           $AGENT_ID"
    echo "Knowledge Base ID:  $KB_ID"
    echo "S3 Bucket:          $BUCKET_NAME"
    echo "Collection:         $COLLECTION_ENDPOINT"
    echo "Amplify App URL:    $AMPLIFY_APP_URL"
    echo "User Pool ID:       $USER_POOL_ID"
    echo "Admin Username:     admin"
    echo "Region:             eu-west-1"
    echo "=========================================="
    echo ""
    echo "🎉 You can now use the agent to generate OpenAPI specifications!"
    echo "🔐 Access the authenticated app at: $AMPLIFY_APP_URL"
    echo "🚀 Start local development with: cd .. && npm run dev:all"
    echo ""
    echo "📝 Next steps:"
    echo "1. ✅ Frontend deployed automatically using deploy-frontend.sh"
    echo "2. 🚀 Test your application at: $AMPLIFY_APP_URL"
    echo "3. 🔐 Login with admin credentials (password set automatically)"
    echo "4. 🔍 Test API endpoints and S3 integration features"
    echo "5. 🎯 Generate OpenAPI specs and verify S3 storage structure"
    echo ""
    echo "🔧 Optional: Change admin password if needed:"
    echo "   cd cdk && node user-management.js setPassword --username admin --password YourNewPassword123!"
}

# Function to cleanup on failure
cleanup_on_failure() {
    print_error "Deployment failed. Cleaning up..."
    
    # Try to destroy stacks if they exist (in reverse order)
    cdk destroy AmplifyAuthStack --force 2>/dev/null || true
    cdk destroy LambdaStack --force 2>/dev/null || true
    cdk destroy BedrockStack --force 2>/dev/null || true
    cdk destroy StorageStack --force 2>/dev/null || true
    cdk destroy OpenSearchStack --force 2>/dev/null || true
    
    # No temporary files to clean up (using permanent Node.js scripts)
}

# Main deployment function
main() {
    echo "=========================================="
    echo "  OpenAPI Bedrock Agent Deployment"
    echo "=========================================="
    echo ""
    
    # Set up error handling
    trap cleanup_on_failure ERR
    
    # Run deployment steps
    check_prerequisites
    validate_environment_variables
    setup_node_env
    setup_aws_identity
    install_dependencies
    deploy_opensearch_stack
    get_stack_outputs
    upload_documents
    create_vector_index
    deploy_storage_stack
    deploy_bedrock_stack
    deploy_lambda_stack
    deploy_amplify_auth_stack
    deploy_frontend
    start_ingestion
    update_environment_variables
    display_summary
    
    print_success "All done! 🎉"
}

# Run main function
main "$@"