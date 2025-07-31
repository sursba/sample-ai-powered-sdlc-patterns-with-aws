#!/bin/bash

# Master Test Runner Script for UI Generator
# This script runs both frontend and backend tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

print_section() {
    echo -e "${PURPLE}[SECTION]${NC} $1"
}

# Function to print banner
print_banner() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                        UI Generator Test Suite                               ║"
    echo "║                     Frontend (React) + Backend (Python)                     ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_section "Checking Prerequisites"
    
    # Check Node.js and npm
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 14+ first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3.8+ first."
        exit 1
    fi
    
    # Show versions
    node_version=$(node --version)
    npm_version=$(npm --version)
    python_version=$(python3 --version)
    
    print_status "Node.js: $node_version"
    print_status "npm: $npm_version"
    print_status "Python: $python_version"
    
    print_success "Prerequisites check passed"
}

# Function to run frontend tests
run_frontend_tests() {
    print_section "Running Frontend Tests"
    
    if [ ! -d "frontend" ]; then
        print_error "Frontend directory not found"
        return 1
    fi
    
    cd frontend
    
    # Check if test script exists
    if [ -f "test.sh" ]; then
        print_status "Using frontend test script..."
        ./test.sh "$FRONTEND_TEST_TYPE"
    else
        print_status "Using npm test commands..."
        
        # Install dependencies if needed
        if [ ! -d "node_modules" ]; then
            print_status "Installing frontend dependencies..."
            npm install
        fi
        
        # Run tests based on type
        case "$FRONTEND_TEST_TYPE" in
            "coverage")
                npm run test:coverage
                ;;
            "ci")
                npm run test:ci
                ;;
            *)
                npm test -- --watchAll=false
                ;;
        esac
    fi
    
    cd ..
    print_success "Frontend tests completed"
}

# Function to run backend tests
run_backend_tests() {
    print_section "Running Backend Tests"
    
    if [ ! -d "backend" ]; then
        print_error "Backend directory not found"
        return 1
    fi
    
    cd backend
    
    # Check if test script exists
    if [ -f "test.sh" ]; then
        print_status "Using backend test script..."
        ./test.sh "$BACKEND_TEST_TYPE"
    else
        print_status "Using pytest commands..."
        
        # Setup virtual environment if it doesn't exist
        if [ ! -d "venv" ]; then
            print_status "Creating virtual environment..."
            python3 -m venv venv
        fi
        
        # Activate virtual environment
        source venv/bin/activate
        
        # Install dependencies
        print_status "Installing backend dependencies..."
        pip install -r requirements.txt
        
        # Run tests based on type
        case "$BACKEND_TEST_TYPE" in
            "coverage")
                pytest --cov=. --cov-report=html --cov-report=term-missing
                ;;
            "unit")
                pytest tests/unit/ -v
                ;;
            "integration")
                pytest tests/integration/ -v
                ;;
            *)
                pytest -v
                ;;
        esac
    fi
    
    cd ..
    print_success "Backend tests completed"
}

# Function to generate combined coverage report
generate_combined_coverage() {
    print_section "Generating Combined Coverage Report"
    
    # Create coverage directory
    mkdir -p coverage-combined
    
    # Copy frontend coverage if available
    if [ -d "frontend/coverage" ]; then
        cp -r frontend/coverage coverage-combined/frontend-coverage
        print_status "Frontend coverage copied"
    fi
    
    # Copy backend coverage if available
    if [ -d "backend/htmlcov" ]; then
        cp -r backend/htmlcov coverage-combined/backend-coverage
        print_status "Backend coverage copied"
    fi
    
    # Create combined index
    cat > coverage-combined/index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>UI Generator - Combined Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .link { display: inline-block; margin: 10px; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 3px; }
        .link:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="header">
        <h1>UI Generator - Combined Coverage Report</h1>
        <p>Generated on: $(date)</p>
    </div>
    
    <div class="section">
        <h2>Frontend Coverage (React/Jest)</h2>
        <a href="frontend-coverage/lcov-report/index.html" class="link">View Frontend Coverage</a>
    </div>
    
    <div class="section">
        <h2>Backend Coverage (Python/pytest)</h2>
        <a href="backend-coverage/index.html" class="link">View Backend Coverage</a>
    </div>
</body>
</html>
EOF
    
    print_success "Combined coverage report generated: coverage-combined/index.html"
}

# Function to show test summary
show_test_summary() {
    print_section "Test Summary"
    
    echo "=================================="
    echo "UI Generator Test Results Summary"
    echo "=================================="
    
    # Frontend summary
    echo ""
    echo "Frontend Tests:"
    if [ -f "frontend/coverage/lcov-report/index.html" ]; then
        echo "  ✓ Coverage report: frontend/coverage/lcov-report/index.html"
    fi
    
    # Backend summary
    echo ""
    echo "Backend Tests:"
    if [ -f "backend/htmlcov/index.html" ]; then
        echo "  ✓ Coverage report: backend/htmlcov/index.html"
    fi
    
    # Combined summary
    echo ""
    echo "Combined Reports:"
    if [ -f "coverage-combined/index.html" ]; then
        echo "  ✓ Combined coverage: coverage-combined/index.html"
    fi
    
    echo ""
    echo "Test execution completed successfully!"
}

# Function to cleanup test artifacts
cleanup_artifacts() {
    print_section "Cleaning up test artifacts"
    
    # Frontend cleanup
    if [ -d "frontend" ]; then
        cd frontend
        rm -rf coverage .nyc_output 2>/dev/null || true
        cd ..
    fi
    
    # Backend cleanup
    if [ -d "backend" ]; then
        cd backend
        rm -rf htmlcov .coverage coverage.xml .pytest_cache 2>/dev/null || true
        find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find . -type f -name "*.pyc" -delete 2>/dev/null || true
        cd ..
    fi
    
    # Combined cleanup
    rm -rf coverage-combined 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Main execution function
main() {
    print_banner
    
    # Parse command line arguments
    FRONTEND_TEST_TYPE=${1:-"all"}
    BACKEND_TEST_TYPE=${2:-"all"}
    GENERATE_COVERAGE=${3:-"true"}
    RUN_CLEANUP=${4:-"false"}
    
    # Check prerequisites
    check_prerequisites
    
    # Track start time
    start_time=$(date +%s)
    
    # Initialize success flags
    frontend_success=true
    backend_success=true
    
    # Run frontend tests
    if ! run_frontend_tests; then
        frontend_success=false
        print_error "Frontend tests failed"
    fi
    
    # Run backend tests
    if ! run_backend_tests; then
        backend_success=false
        print_error "Backend tests failed"
    fi
    
    # Generate combined coverage if requested
    if [ "$GENERATE_COVERAGE" = "true" ]; then
        generate_combined_coverage
    fi
    
    # Calculate execution time
    end_time=$(date +%s)
    execution_time=$((end_time - start_time))
    
    # Show summary
    show_test_summary
    
    print_status "Total execution time: ${execution_time} seconds"
    
    # Check overall success
    if [ "$frontend_success" = true ] && [ "$backend_success" = true ]; then
        print_success "All tests passed successfully!"
        exit 0
    else
        print_error "Some tests failed. Please check the output above."
        exit 1
    fi
}

# Help function
show_help() {
    echo "Master Test Runner for UI Generator"
    echo ""
    echo "Usage: $0 [FRONTEND_TYPE] [BACKEND_TYPE] [GENERATE_COVERAGE] [RUN_CLEANUP]"
    echo ""
    echo "FRONTEND_TYPE options:"
    echo "  all       - Run all frontend tests (default)"
    echo "  coverage  - Run frontend tests with coverage"
    echo "  ci        - Run frontend tests in CI mode"
    echo ""
    echo "BACKEND_TYPE options:"
    echo "  all         - Run all backend tests (default)"
    echo "  unit        - Run backend unit tests only"
    echo "  integration - Run backend integration tests only"
    echo "  coverage    - Run backend tests with coverage"
    echo ""
    echo "GENERATE_COVERAGE options:"
    echo "  true      - Generate combined coverage report (default)"
    echo "  false     - Skip combined coverage generation"
    echo ""
    echo "RUN_CLEANUP options:"
    echo "  true      - Clean up test artifacts after completion"
    echo "  false     - Keep test artifacts (default)"
    echo ""
    echo "Examples:"
    echo "  $0                          # Run all tests with coverage"
    echo "  $0 coverage coverage        # Run both with coverage"
    echo "  $0 ci unit false true       # CI frontend, unit backend, no coverage, cleanup"
    echo ""
    echo "Additional commands:"
    echo "  $0 cleanup                  # Clean up test artifacts only"
    echo ""
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    show_help
    exit 0
fi

# Check for cleanup command
if [ "$1" = "cleanup" ]; then
    cleanup_artifacts
    exit 0
fi

# Run main function
main "$@"
