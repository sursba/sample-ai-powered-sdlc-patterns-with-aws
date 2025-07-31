#!/bin/bash

# Backend Test Runner Script for UI Generator
# This script runs all backend tests with various options

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

# Function to check if Python is installed
check_python() {
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3.8+ first."
        exit 1
    fi
    
    # Check Python version
    python_version=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    print_status "Using Python $python_version"
}

# Function to setup virtual environment
setup_venv() {
    if [ ! -d "venv" ]; then
        print_status "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    print_status "Activating virtual environment..."
    source venv/bin/activate
    
    print_status "Upgrading pip..."
    pip install --upgrade pip
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    pip install -r requirements.txt
    print_success "Dependencies installed successfully"
}

# Function to run tests
run_tests() {
    local test_type=$1
    
    case $test_type in
        "unit")
            print_status "Running unit tests..."
            pytest tests/unit/ -v
            ;;
        "integration")
            print_status "Running integration tests..."
            pytest tests/integration/ -v
            ;;
        "coverage")
            print_status "Running tests with coverage..."
            pytest --cov=. --cov-report=html --cov-report=term-missing --cov-report=xml
            ;;
        "fast")
            print_status "Running fast tests (excluding slow tests)..."
            pytest -m "not slow" -v
            ;;
        "slow")
            print_status "Running slow tests..."
            pytest -m "slow" -v
            ;;
        "aws")
            print_status "Running AWS integration tests..."
            pytest -m "aws" -v
            ;;
        "no-aws")
            print_status "Running tests without AWS dependencies..."
            pytest -m "not aws" -v
            ;;
        *)
            print_status "Running all tests..."
            pytest -v
            ;;
    esac
}

# Function to run linting
lint_code() {
    print_status "Running code linting..."
    
    # Check if flake8 is installed
    if pip show flake8 &> /dev/null; then
        print_status "Running flake8..."
        flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
        flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics
    else
        print_warning "flake8 not installed, skipping linting"
    fi
    
    # Check if black is installed
    if pip show black &> /dev/null; then
        print_status "Checking code formatting with black..."
        black --check --diff .
    else
        print_warning "black not installed, skipping format check"
    fi
}

# Function to run security checks
security_check() {
    print_status "Running security checks..."
    
    # Check if bandit is installed
    if pip show bandit &> /dev/null; then
        print_status "Running bandit security check..."
        bandit -r . -f json -o bandit-report.json || true
        bandit -r . --severity-level medium
    else
        print_warning "bandit not installed, skipping security check"
    fi
    
    # Check if safety is installed
    if pip show safety &> /dev/null; then
        print_status "Running safety check for known vulnerabilities..."
        safety check
    else
        print_warning "safety not installed, skipping vulnerability check"
    fi
}

# Function to show test results summary
show_summary() {
    print_status "Test Summary:"
    echo "=============="
    
    if [ -f "htmlcov/index.html" ]; then
        print_success "Coverage report generated: htmlcov/index.html"
    fi
    
    if [ -f "coverage.xml" ]; then
        print_success "Coverage XML report: coverage.xml"
    fi
    
    if [ -f "bandit-report.json" ]; then
        print_success "Security report generated: bandit-report.json"
    fi
    
    # Show coverage summary if available
    if [ -f ".coverage" ]; then
        print_status "Coverage Summary:"
        coverage report --show-missing | tail -n 5
    fi
}

# Function to clean up test artifacts
cleanup() {
    print_status "Cleaning up test artifacts..."
    
    # Remove Python cache
    find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true
    
    # Remove test artifacts
    rm -f .coverage 2>/dev/null || true
    rm -f coverage.xml 2>/dev/null || true
    rm -f bandit-report.json 2>/dev/null || true
    rm -rf htmlcov 2>/dev/null || true
    rm -rf .pytest_cache 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Main execution
main() {
    print_status "Starting Backend Test Suite for UI Generator"
    print_status "============================================"
    
    # Check prerequisites
    check_python
    
    # Parse command line arguments
    TEST_TYPE=${1:-"all"}
    SETUP_VENV=${2:-"true"}
    INSTALL_DEPS=${3:-"true"}
    RUN_LINT=${4:-"true"}
    RUN_SECURITY=${5:-"false"}
    
    # Setup virtual environment if requested
    if [ "$SETUP_VENV" = "true" ]; then
        setup_venv
    fi
    
    # Install dependencies if requested
    if [ "$INSTALL_DEPS" = "true" ]; then
        install_dependencies
    fi
    
    # Run linting if requested
    if [ "$RUN_LINT" = "true" ]; then
        lint_code
    fi
    
    # Run security checks if requested
    if [ "$RUN_SECURITY" = "true" ]; then
        security_check
    fi
    
    # Run tests
    run_tests "$TEST_TYPE"
    
    # Show summary
    show_summary
    
    print_success "Backend tests completed successfully!"
}

# Help function
show_help() {
    echo "Backend Test Runner for UI Generator"
    echo ""
    echo "Usage: $0 [TEST_TYPE] [SETUP_VENV] [INSTALL_DEPS] [RUN_LINT] [RUN_SECURITY]"
    echo ""
    echo "TEST_TYPE options:"
    echo "  all         - Run all tests (default)"
    echo "  unit        - Run unit tests only"
    echo "  integration - Run integration tests only"
    echo "  coverage    - Run tests with coverage report"
    echo "  fast        - Run fast tests (exclude slow tests)"
    echo "  slow        - Run slow tests only"
    echo "  aws         - Run AWS integration tests"
    echo "  no-aws      - Run tests without AWS dependencies"
    echo ""
    echo "SETUP_VENV options:"
    echo "  true        - Setup/activate virtual environment (default)"
    echo "  false       - Skip virtual environment setup"
    echo ""
    echo "INSTALL_DEPS options:"
    echo "  true        - Install dependencies (default)"
    echo "  false       - Skip dependency installation"
    echo ""
    echo "RUN_LINT options:"
    echo "  true        - Run code linting (default)"
    echo "  false       - Skip linting"
    echo ""
    echo "RUN_SECURITY options:"
    echo "  true        - Run security checks"
    echo "  false       - Skip security checks (default)"
    echo ""
    echo "Examples:"
    echo "  $0                              # Run all tests with full setup"
    echo "  $0 coverage                     # Run tests with coverage"
    echo "  $0 unit false false false       # Run unit tests without setup"
    echo "  $0 integration true true true true  # Full integration test with security"
    echo ""
    echo "Additional commands:"
    echo "  $0 cleanup                      # Clean up test artifacts"
    echo ""
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Check for cleanup command
if [ "$1" = "cleanup" ]; then
    cleanup
    exit 0
fi

# Run main function
main "$@"
