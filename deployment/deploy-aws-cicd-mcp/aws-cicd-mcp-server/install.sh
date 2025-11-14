#!/bin/bash
set -e

echo "Installing AWS CI/CD MCP Server..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate virtual environment and install
source venv/bin/activate
pip install -e .

# Add to MCP configuration
CURRENT_DIR=$(pwd)
MCP_CONFIG_FILE="$HOME/.aws/amazonq/mcp.json"
mkdir -p "$HOME/.aws/amazonq"

if [ -f "$MCP_CONFIG_FILE" ]; then
    cp "$MCP_CONFIG_FILE" "$MCP_CONFIG_FILE.backup.$(date +%s)"
    if command -v jq &> /dev/null; then
        jq --arg cwd "$CURRENT_DIR" \
        '.mcpServers["aws-cicd-mcp-server"] = {
            "command": "'$CURRENT_DIR'/venv/bin/python",
            "args": ["-m", "awslabs.aws_cicd_mcp_server.server_fixed"],
            "cwd": $cwd,
            "env": {
                "CICD_READ_ONLY_MODE": "false"
            }
        }' "$MCP_CONFIG_FILE" > "$MCP_CONFIG_FILE.tmp" && mv "$MCP_CONFIG_FILE.tmp" "$MCP_CONFIG_FILE"
    fi
else
    cat > "$MCP_CONFIG_FILE" << EOF
{
    "mcpServers": {
        "aws-cicd-mcp-server": {
            "command": "$CURRENT_DIR/venv/bin/python",
            "args": ["-m", "awslabs.aws_cicd_mcp_server.server_fixed"],
            "cwd": "$CURRENT_DIR",
            "env": {
                "CICD_READ_ONLY_MODE": "false"
            }
        }
    }
}
EOF
fi

echo "Installation complete. Restart Amazon Q CLI."
