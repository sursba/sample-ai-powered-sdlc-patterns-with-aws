# Logger fix for AWS CI/CD MCP Server
import sys
try:
    from loguru import logger
    logger.remove()
    logger.add(sys.stderr, level="ERROR")
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.ERROR)
