"""Configuration management for AWS CI/CD MCP Server."""

import os
from pathlib import Path

# Logging configuration
FASTMCP_LOG_LEVEL = os.getenv('FASTMCP_LOG_LEVEL', 'INFO')

# AWS configuration
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
AWS_PROFILE = os.getenv('AWS_PROFILE')

# Read-only mode
READ_ONLY_MODE = os.getenv('CICD_READ_ONLY_MODE', 'true').lower() == 'true'

# Pagination defaults
DEFAULT_MAX_ITEMS = 100
DEFAULT_PAGE_SIZE = 50

def get_server_directory() -> Path:
    """Get the server directory for logs and cache."""
    return Path.home() / '.aws-cicd-mcp-server'
