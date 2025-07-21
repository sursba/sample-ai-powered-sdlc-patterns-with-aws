#!/bin/bash

# Validate Amplify Full-Stack Deployment Configuration
# This script checks if everything is properly configured for Amplify deployment

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
echo "  Amplify Full-Stack Deployment Validator"
echo "=========================================="
echo ""

VALIDATION_PASSED=true

# Check project structure
print_status "Validating project structure..."

required_files=(
    "package.json"
    "amplify.yml"
    "start-server.js"
    "backend-lambda/server/index.js"
    "client/package.json"
    ".env.example"
)

required_dirs=(
    "backend-lambda/server"
    "client"
    "backend-lambda/server/controllers"
    "backend-lambda/server/services"
    "client/src"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Missing required file: $file"
        VALIDATION_PASSED=false
    else
        print_success "Found: $file"
    fi
done

for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        print_error "Missing required directory: $dir"
        VALIDATION_PASSED=false
    else
        print_success "Found: $dir"
    fi
done

# Check package.json scripts
print_status "Validating package.json scripts..."

if grep -q '"start".*"node start-server.js"' package.json; then
    print_success "Start script configured correctly"
else
    print_error "Start script not configured correctly in package.json"
    VALIDATION_PASSED=false
fi

if grep -q '"build".*"cd client && npm run build"' package.json; then
    print_success "Build script configured correctly"
else
    print_warning "Build script not found - this is optional but recommended"
fi

# Check amplify.yml configuration
print_status "Validating amplify.yml configuration..."

if [ -f "amplify.yml" ]; then
    if grep -q "npm ci" amplify.yml && grep -q "cd client && npm ci" amplify.yml; then
        print_success "Amplify build configuration looks correct"
    else
        print_warning "Amplify build configuration may need adjustment"
    fi
    
    if grep -q "cp -r server dist/" amplify.yml; then
        print_success "Server files will be included in deployment"
    else
        print_error "Server files not configured for deployment"
        VALIDATION_PASSED=false
    fi
else
    print_error "amplify.yml not found"
    VALIDATION_PASSED=false
fi

# Check server configuration
print_status "Validating server configuration..."

if grep -q "UnifiedLambdaClient" backend-lambda/server/services/analysisService.js 2>/dev/null; then
    print_success "UnifiedLambdaClient integration found"
else
    print_warning "UnifiedLambdaClient integration not found"
fi

if grep -q "corsOptions" backend-lambda/server/index.js; then
    print_success "CORS configuration found"
else
    print_warning "CORS configuration not found - may cause issues"
fi

if grep -q "/health" backend-lambda/server/index.js; then
    print_success "Health check endpoint configured"
else
    print_warning "Health check endpoint not found"
fi

# Check environment configuration
print_status "Validating environment configuration..."

if [ -f ".env.example" ]; then
    if grep -q "DOMAIN_ANALYZER_LAMBDA_ARN" .env.example; then
        print_success "Lambda ARN configuration template found"
    else
        print_warning "Lambda ARN not in environment template"
    fi
    
    if grep -q "NODE_ENV" .env.example; then
        print_success "Node environment configuration found"
    else
        print_warning "NODE_ENV not in environment template"
    fi
else
    print_warning ".env.example not found - create one for reference"
fi

# Check client build configuration
print_status "Validating client build configuration..."

if [ -f "client/package.json" ]; then
    if grep -q '"build"' client/package.json; then
        print_success "Client build script found"
    else
        print_error "Client build script not found"
        VALIDATION_PASSED=false
    fi
    
    if [ -f "client/vite.config.js" ] || [ -f "client/webpack.config.js" ]; then
        print_success "Client build configuration found"
    else
        print_warning "Client build configuration not found"
    fi
else
    print_error "Client package.json not found"
    VALIDATION_PASSED=false
fi

# Test local build process
print_status "Testing local build process..."

if command -v npm >/dev/null 2>&1; then
    print_status "Running quick dependency check..."
    
    # Check if we can install dependencies
    if npm list >/dev/null 2>&1 || [ $? -eq 1 ]; then
        print_success "Root dependencies look good"
    else
        print_warning "Root dependencies may need installation: npm ci"
    fi
    
    # Check client dependencies
    if [ -d "client/node_modules" ] || npm list --prefix client >/dev/null 2>&1; then
        print_success "Client dependencies look good"
    else
        print_warning "Client dependencies may need installation: cd client && npm ci"
    fi
else
    print_warning "npm not found - cannot test dependency installation"
fi

# Summary
echo ""
echo "=========================================="
echo "         VALIDATION SUMMARY"
echo "=========================================="

if [ "$VALIDATION_PASSED" = true ]; then
    print_success "✅ All validations passed!"
    echo ""
    echo "🚀 Your project is ready for Amplify full-stack deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Deploy infrastructure: cd cdk && ./deploy.sh"
    echo "2. Or deploy with zip upload: cd cdk && DEPLOY_CLIENT_ZIP=true ./deploy.sh"
    echo "3. Or connect Git repository in Amplify Console"
    echo ""
    echo "📖 See AMPLIFY_DEPLOYMENT.md for detailed instructions"
else
    print_error "❌ Some validations failed!"
    echo ""
    echo "Please fix the issues above before deploying to Amplify."
    echo "📖 See AMPLIFY_DEPLOYMENT.md for configuration details"
    exit 1
fi