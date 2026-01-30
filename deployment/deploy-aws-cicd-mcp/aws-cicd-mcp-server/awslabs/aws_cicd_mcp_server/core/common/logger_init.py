# Global logger initialization for AWS CI/CD MCP Server
import sys
import os

# Initialize logger globally
try:
    from loguru import logger
    logger.remove()
    log_level = os.getenv('FASTMCP_LOG_LEVEL', 'ERROR')
    logger.add(sys.stderr, level=log_level)
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.ERROR)

# Make logger available globally
__all__ = ['logger']
