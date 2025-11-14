"""Utility functions for AWS CI/CD MCP Server."""

import boto3
from typing import Dict, List, Optional
from botocore.exceptions import ClientError
try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.ERROR)
from .config import AWS_REGION, DEFAULT_MAX_ITEMS, DEFAULT_PAGE_SIZE
from .role_utils import create_service_role_with_policy, list_policy_options


def paginate_results(client, operation: str, result_key: str, max_items: Optional[int] = None, **kwargs) -> List:
    """
    Generic pagination helper using boto3 paginators following AWS MCP server patterns.
    
    Args:
        client: boto3 client instance
        operation: AWS API operation name (e.g., 'list_projects')
        result_key: Key in response containing the list of results
        max_items: Maximum number of items to return (defaults to DEFAULT_MAX_ITEMS)
        **kwargs: Additional parameters to pass to the API operation
        
    Returns:
        List of results from paginated API calls
        
    Raises:
        ClientError: AWS API errors are re-raised for handling by decorators
    """
    try:
        # Try to get paginator for the operation
        paginator = client.get_paginator(operation)
        
        # Configure pagination
        page_config = {
            'MaxItems': max_items or DEFAULT_MAX_ITEMS,
            'PageSize': DEFAULT_PAGE_SIZE
        }
        
        # Remove max_items from kwargs if present to avoid duplicate parameter
        kwargs.pop('max_items', None)
        
        results = []
        for page in paginator.paginate(PaginationConfig=page_config, **kwargs):
            page_results = page.get(result_key, [])
            results.extend(page_results)
            
            # Early exit if we've reached max_items
            if max_items and len(results) >= max_items:
                results = results[:max_items]
                break
        
        return results
        
    except ClientError:
        # Re-raise ClientError so it can be handled by the decorator
        raise
    except Exception as e:
        # Fallback to single call if pagination not supported
        logger.debug(f"Pagination not supported for {operation}, falling back to single call: {e}")
        try:
            response = getattr(client, operation)(**kwargs)
            results = response.get(result_key, [])
            
            # Apply max_items limit to fallback results
            if max_items and len(results) > max_items:
                results = results[:max_items]
                
            return results
        except ClientError:
            # Re-raise ClientError from fallback call
            raise


def get_paginated_results(client, operation: str, result_key: str, max_items: Optional[int] = None, **kwargs) -> Dict:
    """
    Get paginated results with metadata following CloudWatch Logs MCP server pattern.
    
    Args:
        client: boto3 client instance
        operation: AWS API operation name
        result_key: Key in response containing the list of results
        max_items: Maximum number of items to return
        **kwargs: Additional parameters to pass to the API operation
        
    Returns:
        Dictionary containing results and metadata
    """
    results = paginate_results(client, operation, result_key, max_items, **kwargs)
    
    return {
        result_key: results,
        'count': len(results),
        'truncated': max_items is not None and len(results) == max_items,
        'max_items': max_items or DEFAULT_MAX_ITEMS
    }


async def validate_iam_role(role_arn: str, region: str = AWS_REGION) -> bool:
    """
    Validate IAM role exists and is assumable.
    
    Args:
        role_arn: Full ARN of the IAM role or just the role name
        region: AWS region for the IAM client
        
    Returns:
        True if role exists and is accessible, False otherwise
    """
    try:
        iam = boto3.client('iam', region_name=region)
        
        # Extract role name from ARN if full ARN provided
        if role_arn.startswith('arn:aws:iam::'):
            role_name = role_arn.split('/')[-1]
        else:
            role_name = role_arn
            
        # Check if role exists
        response = iam.get_role(RoleName=role_name)
        
        # Additional validation: check if role has a trust policy
        trust_policy = response.get('Role', {}).get('AssumeRolePolicyDocument')
        if not trust_policy:
            logger.warning(f"Role {role_name} exists but has no trust policy")
            return False
            
        logger.debug(f"Successfully validated IAM role: {role_name}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NoSuchEntity':
            logger.debug(f"IAM role not found: {role_name}")
        else:
            logger.warning(f"Error validating IAM role {role_name}: {error_code}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error validating IAM role {role_arn}: {e}")
        return False


async def validate_s3_bucket(bucket_name: str, region: str = AWS_REGION) -> bool:
    """
    Validate S3 bucket exists and is accessible.
    
    Args:
        bucket_name: Name of the S3 bucket
        region: AWS region for the S3 client
        
    Returns:
        True if bucket exists and is accessible, False otherwise
    """
    try:
        s3 = boto3.client('s3', region_name=region)
        
        # Check if bucket exists and is accessible
        s3.head_bucket(Bucket=bucket_name)
        
        # Additional check: verify we can list objects (basic read permission)
        try:
            s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1)
            logger.debug(f"Successfully validated S3 bucket: {bucket_name}")
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'AccessDenied':
                logger.warning(f"S3 bucket {bucket_name} exists but access denied for listing objects")
                # Bucket exists but we don't have list permissions - still valid for artifact storage
                return True
            raise
            
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code in ['NoSuchBucket', '404']:
            logger.debug(f"S3 bucket not found: {bucket_name}")
        elif error_code == 'AccessDenied':
            logger.warning(f"Access denied to S3 bucket: {bucket_name}")
        else:
            logger.warning(f"Error validating S3 bucket {bucket_name}: {error_code}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error validating S3 bucket {bucket_name}: {e}")
        return False


def validate_resource_name(name: str, resource_type: str) -> bool:
    """
    Validate resource name format according to AWS naming conventions.
    
    Args:
        name: Resource name to validate
        resource_type: Type of resource (codebuild_project, codedeploy_app, codepipeline)
        
    Returns:
        True if name format is valid, False otherwise
    """
    if not name or not isinstance(name, str):
        return False
    
    # Common AWS naming rules
    if len(name) < 1 or len(name) > 255:
        return False
    
    # Resource-specific validation
    if resource_type == 'codebuild_project':
        # CodeBuild project names: 2-255 chars, alphanumeric and hyphens
        if len(name) < 2:
            return False
        import re
        return bool(re.match(r'^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]$', name))
        
    elif resource_type == 'codedeploy_application':
        # CodeDeploy application names: 1-100 chars, letters, numbers, periods, underscores, hyphens
        if len(name) > 100:
            return False
        import re
        return bool(re.match(r'^[a-zA-Z0-9\.\-_]+$', name))
        
    elif resource_type == 'codepipeline':
        # CodePipeline names: 1-100 chars, alphanumeric and hyphens
        if len(name) > 100:
            return False
        import re
        return bool(re.match(r'^[a-zA-Z0-9\-]+$', name))
        
    elif resource_type == 'iam_role':
        # IAM role names: 1-64 chars, alphanumeric and specific special chars
        if len(name) > 64:
            return False
        import re
        return bool(re.match(r'^[a-zA-Z0-9+=,.@\-_]+$', name))
        
    elif resource_type == 's3_bucket':
        # S3 bucket names: 3-63 chars, lowercase, numbers, hyphens, periods
        if len(name) < 3 or len(name) > 63:
            return False
        import re
        return bool(re.match(r'^[a-z0-9][a-z0-9\-\.]*[a-z0-9]$', name))
    
    # Default validation for unknown resource types
    import re
    return bool(re.match(r'^[a-zA-Z0-9\-_]+$', name))


def validate_aws_region(region: str) -> bool:
    """
    Validate AWS region format.
    
    Args:
        region: AWS region string
        
    Returns:
        True if region format is valid, False otherwise
    """
    if not region or not isinstance(region, str):
        return False
    
    # AWS region format: us-east-1, eu-west-1, ap-southeast-2, etc.
    import re
    return bool(re.match(r'^[a-z]{2,}-[a-z]+-\d+$', region))


async def validate_codebuild_source(source_type: str, source_location: str) -> bool:
    """
    Validate CodeBuild source configuration.
    
    Args:
        source_type: Type of source (CODECOMMIT, GITHUB, S3, etc.)
        source_location: Source location URL or path
        
    Returns:
        True if source configuration is valid, False otherwise
    """
    if not source_type or not source_location:
        return False
    
    valid_source_types = [
        'CODECOMMIT', 'CODEPIPELINE', 'GITHUB', 'S3', 'BITBUCKET', 
        'GITHUB_ENTERPRISE', 'NO_SOURCE'
    ]
    
    if source_type not in valid_source_types:
        logger.warning(f"Invalid CodeBuild source type: {source_type}")
        return False
    
    # Validate source location format based on type
    if source_type == 'GITHUB':
        return source_location.startswith('https://github.com/')
    elif source_type == 'S3':
        return source_location.startswith('s3://')
    elif source_type == 'CODECOMMIT':
        return 'codecommit' in source_location
    
    # For other types, basic validation
    return len(source_location) > 0


def remove_null_values(data: Dict) -> Dict:
    """Remove None values from dictionary."""
    return {k: v for k, v in data.items() if v is not None}


def get_or_create_service_role(
    service: str,
    role_arn: Optional[str] = None,
    policy_name: Optional[str] = None,
    region: str = AWS_REGION
) -> str:
    """
    Get existing role ARN or create new role with managed policy.
    
    Args:
        service: Service name (codebuild, codepipeline, codedeploy)
        role_arn: Existing role ARN (if provided, validates and returns)
        policy_name: Policy to use for new role creation
        region: AWS region
        
    Returns:
        Role ARN (existing or newly created)
    """
    if role_arn:
        # Validate existing role
        if validate_iam_role(role_arn, region):
            return role_arn
        else:
            raise ValueError(f"Provided role ARN is invalid: {role_arn}")
    
    # Create new role with selected policy
    return create_service_role_with_policy(service, policy_name, region=region)
