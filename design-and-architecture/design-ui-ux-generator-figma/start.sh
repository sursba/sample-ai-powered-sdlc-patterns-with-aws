#!/bin/bash

# Startup script for UI Generator
# This script starts the application in production mode

# Get the absolute path to the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function show_help {
  echo "UI Generator Starter"
  echo "Usage: $0 [options]"
  echo ""
  echo "Options:"
  echo "  --help        Show this help message"
  echo ""
  echo "This script builds the frontend and serves it from the backend on port 8000."
}

# Parse command line arguments
while [ $# -gt 0 ]; do
  case "$1" in
    --help) show_help; exit 0 ;;
    *) echo "Unknown option: $1"; show_help; exit 1 ;;
  esac
done

# Function to handle script termination
cleanup() {
  echo "Shutting down server..."
  if [ -n "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null
  fi
  exit 0
}

# Register the cleanup function for script termination
trap cleanup INT TERM

# Create the assets directory if it doesn't exist
echo "Creating assets directory..."
mkdir -p "$SCRIPT_DIR/frontend/src/assets/generated"

# Set environment variables for production
export FLASK_ENV=production
export NODE_ENV=production

echo "Starting in PRODUCTION mode..."

# Build the frontend
echo "Building frontend for production..."
cd "$SCRIPT_DIR/frontend"

# Set up the environment file for production
echo "Setting up environment for production..."
echo "REACT_APP_API_URL=/api" > "$SCRIPT_DIR/frontend/.env"

npm install
npm run build

# Start the backend server
echo "Starting backend server in production mode..."
cd "$SCRIPT_DIR/backend"
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -q --disable-pip-version-check -r requirements.txt
echo "Backend server starting..."
python server.py &
BACKEND_PID=$!
echo "Backend server started with PID: $BACKEND_PID"

echo ""
echo "✅ Production environment started successfully!"
echo "🌐 Application: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop the server."

# Wait for user to press Ctrl+C
wait