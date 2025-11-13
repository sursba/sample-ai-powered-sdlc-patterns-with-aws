"""Decorators for AWS CI/CD MCP Server following ElastiCache MCP server patterns."""

from functools import wraps
from typing import Any, Callable, Dict
from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError
try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.ERROR)


def handle_exceptions(func: Callable) -> Callable:
    """
    Decorator to handle AWS exceptions with specific error messages and actionable guidance.
    
    Follows the error handling patterns from ElastiCache MCP server with CI/CD specific guidance.
    """
    
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Dict[str, Any]:
        try:
            return await func(*args, **kwargs)
            
        except NoCredentialsError:
            error_msg = (
                "AWS credentials not found. Please configure your AWS credentials using one of these methods:\n"
                "1. Run 'aws configure' to set up credentials\n"
                "2. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables\n"
                "3. Use an IAM role if running on EC2\n"
                "4. Set AWS_PROFILE environment variable to use a specific profile"
            )
            logger.error("NoCredentialsError: AWS credentials not configured")
            return {
                "error": error_msg,
                "error_type": "ConfigurationError",
                "documentation": "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html"
            }
            
        except EndpointConnectionError as e:
            error_msg = (
                f"Unable to connect to AWS endpoint. Please check:\n"
                f"1. Your internet connection\n"
                f"2. AWS region configuration (current region may be invalid)\n"
                f"3. VPC/firewall settings if running in a restricted environment\n"
                f"Original error: {str(e)}"
            )
            logger.error(f"EndpointConnectionError: {str(e)}")
            return {
                "error": error_msg,
                "error_type": "ConnectionError",
                "documentation": "https://docs.aws.amazon.com/general/latest/gr/rande.html"
            }
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_msg = e.response['Error']['Message']
            
            # Provide specific guidance for common CI/CD errors
            guidance, error_type, docs_url = _get_error_guidance(error_code, error_msg)
            
            full_error = f"{error_msg}\n\nGuidance: {guidance}"
            logger.error(f"AWS API Error [{error_code}]: {error_msg}")
            
            return {
                "error": full_error,
                "error_type": error_type,
                "error_code": error_code,
                "guidance": guidance,
                "documentation": docs_url
            }
            
        except ValueError as e:
            # Handle validation errors from our own code
            error_msg = f"Validation error: {str(e)}"
            logger.error(error_msg)
            return {
                "error": error_msg,
                "error_type": "ValidationError"
            }
            
        except Exception as e:
            # Handle unexpected errors
            error_msg = f"Unexpected error occurred: {str(e)}"
            logger.error(f"Unexpected error in {func.__name__}: {str(e)}", exc_info=True)
            return {
                "error": error_msg,
                "error_type": "InternalError"
            }
    
    return wrapper


def _get_error_guidance(error_code: str, error_msg: str) -> tuple[str, str, str]:
    """
    Get specific guidance for AWS error codes.
    
    Returns:
        Tuple of (guidance_message, error_type, documentation_url)
    """
    guidance_map = {
        'AccessDenied': (
            "Check IAM permissions. Ensure your user/role has the required permissions for CodeBuild, CodeDeploy, or CodePipeline services. "
            "You may need policies like AWSCodeBuildAdminAccess, AWSCodeDeployRole, or AWSCodePipeline_FullAccess.",
            "PermissionError",
            "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_examples.html"
        ),
        'UnauthorizedOperation': (
            "Your AWS credentials don't have permission to perform this operation. "
            "Contact your AWS administrator to grant the necessary IAM permissions.",
            "PermissionError",
            "https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_access-denied.html"
        ),
        'ResourceNotFoundException': (
            "The requested resource was not found. Verify:\n"
            "1. Resource name is correct and exists\n"
            "2. You're using the correct AWS region\n"
            "3. The resource hasn't been deleted",
            "ResourceError",
            "https://docs.aws.amazon.com/general/latest/gr/rande.html"
        ),
        'ValidationException': (
            "Parameter validation failed. Check:\n"
            "1. All required parameters are provided\n"
            "2. Parameter values match expected formats\n"
            "3. Resource names follow AWS naming conventions",
            "ValidationError",
            "https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html"
        ),
        'InvalidParameterException': (
            "One or more parameters are invalid. Review the parameter values and ensure they meet AWS requirements.",
            "ValidationError",
            "https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html"
        ),
        'ResourceAlreadyExistsException': (
            "A resource with this name already exists. Choose a different name or delete the existing resource first.",
            "ResourceError",
            "https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html"
        ),
        'LimitExceededException': (
            "You've reached the service limit for this resource type. "
            "Consider deleting unused resources or request a limit increase.",
            "ResourceError",
            "https://docs.aws.amazon.com/general/latest/gr/aws_service_limits.html"
        ),
        'ThrottlingException': (
            "Request rate exceeded. Wait a moment and try again. "
            "Consider implementing exponential backoff for repeated operations.",
            "ThrottlingError",
            "https://docs.aws.amazon.com/general/latest/gr/api-retries.html"
        ),
        'ServiceUnavailableException': (
            "AWS service is temporarily unavailable. Wait a few minutes and try again.",
            "ServiceError",
            "https://status.aws.amazon.com/"
        )
    }
    
    if error_code in guidance_map:
        return guidance_map[error_code]
    
    # Default guidance for unknown errors
    return (
        f"AWS returned error code '{error_code}'. Check the AWS documentation for this service and error code.",
        "UnknownError",
        "https://docs.aws.amazon.com/"
    )


def require_write_mode(func: Callable) -> Callable:
    """
    Decorator to check if write operations are allowed (read-only mode check).
    """
    @wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Dict[str, Any]:
        from .config import READ_ONLY_MODE
        
        if READ_ONLY_MODE:
            error_msg = (
                "Server is in read-only mode. Cannot perform write operations.\n"
                "To enable write operations, set the CICD_READ_ONLY_MODE environment variable to 'false'."
            )
            logger.warning(f"Write operation blocked in read-only mode: {func.__name__}")
            return {
                "error": error_msg,
                "error_type": "ReadOnlyError",
                "guidance": "Set CICD_READ_ONLY_MODE=false to enable write operations"
            }
        
        return await func(*args, **kwargs)
    
    return wrapper
