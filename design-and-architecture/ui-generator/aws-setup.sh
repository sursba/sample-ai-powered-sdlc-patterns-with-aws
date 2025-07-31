#!/bin/bash

# AWS setup script for UI Generator
# This script helps set up and test AWS credentials

# Get the absolute path to the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function show_help {
  echo "AWS Setup Tool"
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --setup      Set up AWS credentials"
  echo "  --test       Test AWS credentials and Bedrock access"
  echo "  --help       Show this help message"
  echo ""
  echo "If no options are provided, the script will run in interactive mode."
}

function setup_credentials {
  echo "Setting up AWS credentials..."
  cd "$SCRIPT_DIR/backend"
  python3 -m venv venv 2>/dev/null || true
  source venv/bin/activate
  pip install -q boto3
  python aws_credentials_helper.py
}

function test_credentials {
  echo "Testing AWS configuration..."
  cd "$SCRIPT_DIR/backend"
  python3 -m venv venv 2>/dev/null || true
  source venv/bin/activate
  pip install -q -r requirements.txt
  
  # Run a simple test using the server's health check
  python -c "
import boto3
import json

def test_aws():
    try:
        # Create a session
        session = boto3.Session()
        
        # Get credentials
        credentials = session.get_credentials()
        if credentials:
            print(f'✅ AWS credentials found using provider: {credentials.method}')
            
            # Try to get caller identity
            sts = session.client('sts')
            identity = sts.get_caller_identity()
            print(f'✅ AWS identity: {identity[\"Arn\"]}')
            
            # Try to create a bedrock client
            bedrock = session.client('bedrock')
            
            # List foundation models
            response = bedrock.list_foundation_models()
            
            # Check for required models
            models = response.get('modelSummaries', [])
            model_ids = [model.get('modelId') for model in models]
            
            required_models = [
                'anthropic.claude-3-sonnet-20240229-v1:0',
                'amazon.nova-canvas-v1:0'
            ]
            
            available_required_models = [model for model in required_models if model in model_ids]
            missing_models = [model for model in required_models if model not in model_ids]
            
            if missing_models:
                print('❌ Missing required Bedrock models:')
                for model in missing_models:
                    print(f'  - {model}')
                print('Please request access to these models in the Amazon Bedrock console.')
            else:
                print('✅ All required Bedrock models are accessible')
            
            return True
        else:
            print('❌ No AWS credentials found')
            return False
    except Exception as e:
        print(f'❌ Error: {str(e)}')
        return False

test_aws()
"
}

# Interactive mode if no arguments provided
if [ $# -eq 0 ]; then
  echo "AWS Setup Tool"
  echo "=============="
  echo ""
  echo "Please select an option:"
  echo "1) Set up AWS credentials"
  echo "2) Test AWS credentials and Bedrock access"
  echo "3) Exit"
  echo ""
  read -p "Enter your choice (1-3): " choice
  
  case $choice in
    1) setup_credentials ;;
    2) test_credentials ;;
    3) exit 0 ;;
    *) echo "Invalid choice. Exiting."; exit 1 ;;
  esac
  exit 0
fi

# Parse command line arguments
while [ $# -gt 0 ]; do
  case "$1" in
    --setup) setup_credentials; shift ;;
    --test) test_credentials; shift ;;
    --help) show_help; exit 0 ;;
    *) echo "Unknown option: $1"; show_help; exit 1 ;;
  esac
done