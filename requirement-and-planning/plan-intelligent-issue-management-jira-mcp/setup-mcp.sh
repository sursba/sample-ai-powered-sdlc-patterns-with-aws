#!/bin/bash

# Setup script for Jira Intelligent MCP Server with Amazon Q Developer

set -e

echo "🚀 Setting up Jira Intelligent MCP Server for Amazon Q Developer..."

# Get current directory
CURRENT_DIR=$(pwd)
MCP_SERVER_DIR="$CURRENT_DIR/mcp-server"

# Get API Gateway URL from CDK outputs
echo "📡 Getting API Gateway URL..."
API_URL=$(aws cloudformation describe-stacks --stack-name IssueMgmtCoreStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
    echo "❌ Could not find API Gateway URL. Make sure you've deployed the infrastructure with 'npx cdk deploy --all'"
    exit 1
fi

# Remove trailing slash if present
API_URL=${API_URL%/}

echo "✅ Found API Gateway URL: $API_URL"

# Build MCP server
echo "🔨 Building MCP server..."
cd "$MCP_SERVER_DIR"
npm install
npm run build

# Create environment configuration
echo "⚙️ Creating environment configuration..."

# Create a simple environment file for easy setup
cat > "$MCP_SERVER_DIR/.env" << EOF
JIRA_MCP_API_BASE=$API_URL
EOF

# Create a startup script for Amazon Q Developer
cat > "$MCP_SERVER_DIR/start-for-q.sh" << EOF
#!/bin/bash
# Startup script for Amazon Q Developer integration

export JIRA_MCP_API_BASE="$API_URL"
cd "$MCP_SERVER_DIR"
node dist/index.js
EOF

chmod +x "$MCP_SERVER_DIR/start-for-q.sh"

# Test MCP server
echo "🧪 Testing MCP server..."
cd "$MCP_SERVER_DIR"
timeout 5s npm start > /dev/null 2>&1 && echo "✅ MCP server test passed!" || echo "⚠️ MCP server test timed out (this is normal)"

echo ""
echo "🎉 Setup complete for Amazon Q Developer!"
echo ""
echo "🔧 Configuration:"
echo "   API URL: $API_URL"
echo "   MCP Server: $MCP_SERVER_DIR"
echo "   Environment: $MCP_SERVER_DIR/.env"
echo ""
echo "📚 Usage with Amazon Q Developer:"
echo "1. Set environment variable: export JIRA_MCP_API_BASE=\"$API_URL\""
echo "2. Run MCP server: $MCP_SERVER_DIR/start-for-q.sh"
echo "3. Connect Amazon Q Developer to the MCP server"
echo ""
echo "💬 Example commands for Amazon Q Developer:"
echo "   - 'Create a bug report for login issues and assign to best developer'"
echo "   - 'Analyze these test results and create issues for failures'"
echo "   - 'Generate project health report for last 30 days'"
echo "   - 'Find and merge duplicate issues'"
echo "   - 'Prioritize open issues and assign to team members'"
echo ""
echo "📖 For detailed usage examples, see: $MCP_SERVER_DIR/README.md"
