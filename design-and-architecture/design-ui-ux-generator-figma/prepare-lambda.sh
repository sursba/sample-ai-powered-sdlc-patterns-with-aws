#!/bin/bash

# Script to prepare Lambda deployment package
# This script creates a deployment package for the Lambda function without using Docker

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

echo "Preparing Lambda deployment package..."

# Create a temporary directory for the package
TEMP_DIR="$SCRIPT_DIR/backend/lambda_package"
mkdir -p "$TEMP_DIR"

# Clean up any previous package
rm -rf "$TEMP_DIR/*"

# Install dependencies into the package directory
echo "Installing Python dependencies..."
cd "$SCRIPT_DIR/backend"
python3 -m pip install -r requirements.txt -t "$TEMP_DIR" --no-cache-dir

# Copy all Python files to the package directory
echo "Copying Python files..."
cp *.py "$TEMP_DIR/"

# Create a zip file of the package
echo "Creating deployment package..."
cd "$TEMP_DIR"
zip -r "../lambda_deployment.zip" .

# Clean up
echo "Cleaning up..."
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo "Lambda deployment package prepared at $SCRIPT_DIR/backend/lambda_deployment.zip"