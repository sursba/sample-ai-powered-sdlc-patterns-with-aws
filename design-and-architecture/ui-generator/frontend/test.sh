#!/bin/bash

# Frontend Test Runner Script for UI Generator
# This script runs all frontend tests with various options

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install Node.js and npm first."
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed successfully"
}

# Function to run tests
run_tests() {
    local test_type=$1
    
    case $test_type in
        "unit")
            print_status "Running unit tests..."
            npm test -- --watchAll=false --testPathPattern="__tests__"
            ;;
        "coverage")
            print_status "Running tests with coverage..."
            npm run test:coverage
            ;;
        "watch")
            print_status "Running tests in watch mode..."
            npm run test:watch
            ;;
        "ci")
            print_status "Running tests in CI mode..."
            npm run test:ci
            ;;
        "debug")
            print_status "Running tests in debug mode..."
            npm run test:debug
            ;;
        *)
            print_status "Running all tests..."
            npm test -- --watchAll=false
            ;;
    esac
}

# Function to lint code
lint_code() {
    print_status "Running ESLint..."
    if npm run lint 2>/dev/null; then
        print_success "Linting passed"
    else
        print_warning "Linting not configured or failed"
    fi
}

# Function to show test results summary
show_summary() {
    print_status "Test Summary:"
    echo "=============="
    
    if [ -f "coverage/lcov-report/index.html" ]; then
        print_success "Coverage report generated: coverage/lcov-report/index.html"
    fi
    
    if [ -f "coverage/coverage-final.json" ]; then
        print_success "Coverage data available: coverage/coverage-final.json"
    fi
}

# Main execution
main() {
    print_status "Starting Frontend Test Suite for UI Generator"
    print_status "=============================================="
    
    # Check prerequisites
    check_npm
    
    # Parse command line arguments
    TEST_TYPE=${1:-"all"}
    INSTALL_DEPS=${2:-"true"}
    
    # Install dependencies if requested
    if [ "$INSTALL_DEPS" = "true" ]; then
        install_dependencies
    fi
    
    # Run linting
    lint_code
    
    # Run tests
    run_tests "$TEST_TYPE"
    
    # Show summary
    show_summary
    
    print_success "Frontend tests completed successfully!"
}

# Help function
show_help() {
    echo "Frontend Test Runner for UI Generator"
    echo ""
    echo "Usage: $0 [TEST_TYPE] [INSTALL_DEPS]"
    echo ""
    echo "TEST_TYPE options:"
    echo "  all       - Run all tests (default)"
    echo "  unit      - Run unit tests only"
    echo "  coverage  - Run tests with coverage report"
    echo "  watch     - Run tests in watch mode"
    echo "  ci        - Run tests in CI mode"
    echo "  debug     - Run tests in debug mode"
    echo ""
    echo "INSTALL_DEPS options:"
    echo "  true      - Install dependencies before running tests (default)"
    echo "  false     - Skip dependency installation"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all tests with dependency installation"
    echo "  $0 coverage           # Run tests with coverage"
    echo "  $0 unit false         # Run unit tests without installing dependencies"
    echo "  $0 watch              # Run tests in watch mode"
    echo ""
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Run main function
main "$@"
