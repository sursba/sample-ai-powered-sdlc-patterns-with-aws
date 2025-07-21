#!/bin/bash

# OpenAPI Bedrock Agent Cleanup Script
# This script removes all resources created by the deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="."  # We're already in the CDK project directory

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

# Function to clean up Bedrock resources
cleanup_bedrock_resources() {
    print_status "Cleaning up Bedrock resources..."
    
    # List and delete knowledge bases
    KB_LIST=$(aws bedrock-agent list-knowledge-bases --query 'knowledgeBaseSummaries[?contains(name, `openapi-kb`)].knowledgeBaseId' --output text 2>/dev/null || echo "")
    
    if [ -n "$KB_LIST" ]; then
        for KB_ID in $KB_LIST; do
            if [ "$KB_ID" != "None" ] && [ -n "$KB_ID" ]; then
                print_status "Found Knowledge Base: $KB_ID"
                
                # List and delete data sources first
                DS_LIST=$(aws bedrock-agent list-data-sources --knowledge-base-id "$KB_ID" --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null || echo "")
                
                if [ -n "$DS_LIST" ]; then
                    for DS_ID in $DS_LIST; do
                        if [ "$DS_ID" != "None" ] && [ -n "$DS_ID" ]; then
                            print_status "Deleting data source: $DS_ID"
                            aws bedrock-agent delete-data-source --knowledge-base-id "$KB_ID" --data-source-id "$DS_ID" 2>/dev/null || true
                        fi
                    done
                fi
                
                # Wait a bit for data sources to be deleted
                sleep 5
                
                # Delete the knowledge base
                print_status "Deleting Knowledge Base: $KB_ID"
                aws bedrock-agent delete-knowledge-base --knowledge-base-id "$KB_ID" 2>/dev/null || true
            fi
        done
        print_success "Bedrock Knowledge Bases cleaned up!"
    else
        print_status "No Bedrock Knowledge Bases found to clean up."
    fi
}

# Function to empty and delete S3 buckets
empty_and_delete_s3_buckets() {
    print_status "Cleaning up S3 buckets..."
    
    # Get current AWS account ID and region
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    REGION=${AWS_REGION:-$(aws configure get region)}
    
    # List of potential bucket names to clean up (using current account ID)
    BUCKET_PATTERNS=(
        "openapi-kb-${ACCOUNT_ID}"
        "openapi-knowledge-base-${ACCOUNT_ID}-${REGION}"
        "openapi-domain-analyzer-${ACCOUNT_ID}-${REGION}"
    )
    
    for BUCKET_PATTERN in "${BUCKET_PATTERNS[@]}"; do
        # Check if bucket exists
        if aws s3api head-bucket --bucket "$BUCKET_PATTERN" 2>/dev/null; then
            print_status "Found bucket: $BUCKET_PATTERN"
            
            # Empty the bucket first
            print_status "Emptying bucket: $BUCKET_PATTERN"
            aws s3 rm "s3://$BUCKET_PATTERN" --recursive --quiet 2>/dev/null || true
            
            # Delete all versions if versioning is enabled
            aws s3api delete-objects --bucket "$BUCKET_PATTERN" \
                --delete "$(aws s3api list-object-versions --bucket "$BUCKET_PATTERN" \
                --query '{Objects: Versions[].{Key: Key, VersionId: VersionId}}' \
                --output json 2>/dev/null || echo '{\"Objects\": []}')" 2>/dev/null || true
            
            # Delete delete markers
            aws s3api delete-objects --bucket "$BUCKET_PATTERN" \
                --delete "$(aws s3api list-object-versions --bucket "$BUCKET_PATTERN" \
                --query '{Objects: DeleteMarkers[].{Key: Key, VersionId: VersionId}}' \
                --output json 2>/dev/null || echo '{\"Objects\": []}')" 2>/dev/null || true
            
            # Now delete the bucket
            print_status "Deleting bucket: $BUCKET_PATTERN"
            aws s3api delete-bucket --bucket "$BUCKET_PATTERN" 2>/dev/null || true
            
            print_success "Bucket $BUCKET_PATTERN cleaned up!"
        fi
    done
    
    # Also try to get bucket names from CloudFormation stacks
    for STACK in OpenSearchStack StorageStack; do
        BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name "$STACK" \
            --query 'Stacks[0].Outputs[?contains(OutputKey, `Bucket`)].OutputValue' \
            --output text 2>/dev/null || echo "")
        
        if [ -n "$BUCKET_NAME" ] && [ "$BUCKET_NAME" != "None" ]; then
            for BUCKET in $BUCKET_NAME; do
                if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
                    print_status "Found CloudFormation bucket: $BUCKET"
                    aws s3 rm "s3://$BUCKET" --recursive --quiet 2>/dev/null || true
                    
                    # Delete versions and delete markers
                    aws s3api delete-objects --bucket "$BUCKET" \
                        --delete "$(aws s3api list-object-versions --bucket "$BUCKET" \
                        --query '{Objects: Versions[].{Key: Key, VersionId: VersionId}}' \
                        --output json 2>/dev/null || echo '{\"Objects\": []}')" 2>/dev/null || true
                    
                    aws s3api delete-objects --bucket "$BUCKET" \
                        --delete "$(aws s3api list-object-versions --bucket "$BUCKET" \
                        --query '{Objects: DeleteMarkers[].{Key: Key, VersionId: VersionId}}' \
                        --output json 2>/dev/null || echo '{\"Objects\": []}')" 2>/dev/null || true
                    
                    aws s3api delete-bucket --bucket "$BUCKET" 2>/dev/null || true
                    print_success "CloudFormation bucket $BUCKET cleaned up!"
                fi
            done
        fi
    done
}

# Function to destroy CDK stacks
destroy_stacks() {
    print_status "Destroying CDK stacks..."
    
    # Destroy stacks in reverse order of dependencies
    
    # Try to destroy Lambda stack first
    if aws cloudformation describe-stacks --stack-name LambdaStack >/dev/null 2>&1; then
        print_status "Destroying Lambda stack..."
        cdk destroy LambdaStack --force || print_warning "Failed to destroy Lambda stack cleanly"
    else
        print_status "Lambda stack not found or already deleted."
    fi
    
    # Try to destroy Bedrock stack second
    if aws cloudformation describe-stacks --stack-name BedrockStack >/dev/null 2>&1; then
        print_status "Destroying Bedrock stack..."
        cdk destroy BedrockStack --force || print_warning "Failed to destroy Bedrock stack cleanly"
    else
        print_status "Bedrock stack not found or already deleted."
    fi
    
    # Try to destroy Storage stack third
    if aws cloudformation describe-stacks --stack-name StorageStack >/dev/null 2>&1; then
        print_status "Destroying Storage stack..."
        cdk destroy StorageStack --force || print_warning "Failed to destroy Storage stack cleanly"
    else
        print_status "Storage stack not found or already deleted."
    fi
    
    # Then destroy OpenSearch stack last
    if aws cloudformation describe-stacks --stack-name OpenSearchStack >/dev/null 2>&1; then
        print_status "Destroying OpenSearch stack..."
        cdk destroy OpenSearchStack --force || print_warning "Failed to destroy OpenSearch stack cleanly"
    else
        print_status "OpenSearch stack not found or already deleted."
    fi
    
    print_success "CDK stacks destroyed!"
}

# Function to clean up local files
cleanup_local_files() {
    print_status "Cleaning up local files..."
    
    # Remove temporary files
    rm -f create_index.py ../test_agent.py create_index_temp.py test_agent_temp.py 2>/dev/null || true
    
    # Remove Python virtual environment
    rm -rf ../venv 2>/dev/null || true
    
    # Clean up CDK outputs
    if [ -d "cdk.out" ]; then
        rm -rf cdk.out
    fi
    
    print_success "Local files cleaned up!"
}

# Function to verify cleanup
verify_cleanup() {
    print_status "Verifying cleanup..."
    
    # Check if stacks still exist
    if aws cloudformation describe-stacks --stack-name LambdaStack >/dev/null 2>&1; then
        print_warning "LambdaStack still exists. You may need to delete it manually from the AWS Console."
    fi
    
    if aws cloudformation describe-stacks --stack-name BedrockStack >/dev/null 2>&1; then
        print_warning "BedrockStack still exists. You may need to delete it manually from the AWS Console."
    fi
    
    if aws cloudformation describe-stacks --stack-name StorageStack >/dev/null 2>&1; then
        print_warning "StorageStack still exists. You may need to delete it manually from the AWS Console."
    fi
    
    if aws cloudformation describe-stacks --stack-name OpenSearchStack >/dev/null 2>&1; then
        print_warning "OpenSearchStack still exists. You may need to delete it manually from the AWS Console."
    fi
    
    print_success "Cleanup verification completed!"
}

# Main cleanup function
main() {
    echo "=========================================="
    echo "  OpenAPI Bedrock Agent Cleanup"
    echo "=========================================="
    echo ""
    
    print_warning "This will delete ALL resources created by the deployment."
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleanup cancelled."
        exit 0
    fi
    
    print_status "Starting cleanup process..."
    
    # Run cleanup steps
    cleanup_bedrock_resources
    empty_and_delete_s3_buckets
    destroy_stacks
    cleanup_local_files
    verify_cleanup
    
    print_success "Cleanup completed! 🧹"
    echo ""
    echo "All resources have been removed."
    echo "Note: Some resources may take a few minutes to be fully deleted from AWS."
}

# Run main function
main "$@"