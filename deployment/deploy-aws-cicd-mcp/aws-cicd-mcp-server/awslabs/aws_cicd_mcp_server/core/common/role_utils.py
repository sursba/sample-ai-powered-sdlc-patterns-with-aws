"""Enhanced role utilities with AWS managed policy selection and comprehensive role management."""

import boto3
import json
import time
from typing import Optional, Dict, Any, List
from botocore.exceptions import ClientError
try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.ERROR)
from .aws_managed_policies import get_available_policies, get_default_policy, CODEBUILD_CUSTOM_POLICY
from .config import AWS_REGION


async def create_service_role(
    role_name: str,
    service: str,
    policy_arn: str,
    region: str = AWS_REGION
) -> str:
    """
    Create IAM role with AWS managed policy following AWS API MCP server patterns.
    
    Args:
        role_name: Name for the new IAM role
        service: AWS service name (codebuild, codepipeline, codedeploy)
        policy_arn: ARN of the AWS managed policy to attach
        region: AWS region
        
    Returns:
        Role ARN of the created role
        
    Raises:
        ValueError: If role creation fails or parameters are invalid
    """
    if not role_name or not service or not policy_arn:
        raise ValueError("role_name, service, and policy_arn are required")
    
    # Validate service name
    valid_services = ['codebuild', 'codepipeline', 'codedeploy']
    if service not in valid_services:
        raise ValueError(f"Invalid service '{service}'. Must be one of: {valid_services}")
    
    iam = boto3.client('iam', region_name=region)
    
    # Create trust policy for the service
    trust_policy = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": f"{service}.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }
    
    try:
        # Create the IAM role
        logger.info(f"Creating IAM role: {role_name} for service: {service}")
        role_response = iam.create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=json.dumps(trust_policy),
            Description=f"Service role for AWS {service.title()} created by AWS CI/CD MCP Server",
            Tags=[
                {
                    'Key': 'CreatedBy',
                    'Value': 'AWS-CICD-MCP-Server'
                },
                {
                    'Key': 'Service',
                    'Value': service
                },
                {
                    'Key': 'Purpose',
                    'Value': 'CI/CD Operations'
                }
            ]
        )
        
        role_arn = role_response['Role']['Arn']
        logger.info(f"Successfully created IAM role: {role_arn}")
        
        # Attach the specified policy
        if policy_arn == "custom":
            # Handle custom policy for CodeBuild
            policy_name = f"{role_name}-CustomPolicy"
            logger.info(f"Attaching custom inline policy: {policy_name}")
            iam.put_role_policy(
                RoleName=role_name,
                PolicyName=policy_name,
                PolicyDocument=json.dumps(CODEBUILD_CUSTOM_POLICY)
            )
        else:
            # Attach AWS managed policy
            logger.info(f"Attaching AWS managed policy: {policy_arn}")
            iam.attach_role_policy(
                RoleName=role_name,
                PolicyArn=policy_arn
            )
        
        # Wait a moment for role to be available
        time.sleep(2)
        
        logger.info(f"Successfully created and configured IAM role: {role_name}")
        return role_arn
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        
        if error_code == 'EntityAlreadyExists':
            raise ValueError(f"IAM role '{role_name}' already exists. Choose a different name.")
        elif error_code == 'AccessDenied':
            raise ValueError(
                f"Access denied creating IAM role. Ensure you have permissions for:\n"
                f"- iam:CreateRole\n"
                f"- iam:AttachRolePolicy\n"
                f"- iam:PutRolePolicy\n"
                f"- iam:TagRole"
            )
        else:
            raise ValueError(f"Failed to create IAM role: {error_code} - {error_msg}")


async def get_or_create_role(
    role_name: str,
    service: str,
    policy_type: str,
    region: str = AWS_REGION
) -> str:
    """
    Get existing role or create new one with automatic policy selection.
    
    Args:
        role_name: Name of the IAM role
        service: AWS service name (codebuild, codepipeline, codedeploy)
        policy_type: Type of policy to use (default, full_access, minimal, etc.)
        region: AWS region
        
    Returns:
        Role ARN (existing or newly created)
        
    Raises:
        ValueError: If role operations fail
    """
    iam = boto3.client('iam', region_name=region)
    
    try:
        # Check if role already exists
        logger.info(f"Checking if IAM role exists: {role_name}")
        response = iam.get_role(RoleName=role_name)
        existing_role_arn = response['Role']['Arn']
        logger.info(f"Using existing IAM role: {existing_role_arn}")
        return existing_role_arn
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchEntity':
            # Role doesn't exist, create it
            logger.info(f"IAM role {role_name} not found, creating new role")
            
            # Get the appropriate policy ARN
            policy_arn = get_managed_policy_arn(service, policy_type)
            if not policy_arn:
                raise ValueError(f"No policy found for service '{service}' and type '{policy_type}'")
            
            return await create_service_role(role_name, service, policy_arn, region)
        else:
            raise ValueError(f"Error checking IAM role: {e}")


def get_managed_policy_arn(service: str, policy_type: str) -> Optional[str]:
    """
    Get AWS managed policy ARN for service and type.
    
    Args:
        service: AWS service name
        policy_type: Policy type (default, full_access, minimal, etc.)
        
    Returns:
        Policy ARN or None if not found
    """
    available_policies = get_available_policies(service)
    
    # If policy_type is 'default', get the default policy
    if policy_type == 'default':
        default_policy_name = get_default_policy(service)
        policy = next((p for p in available_policies if p["name"] == default_policy_name), None)
        return policy["arn"] if policy else None
    
    # Look for exact match first
    policy = next((p for p in available_policies if p["name"] == policy_type), None)
    if policy:
        return policy["arn"]
    
    # Look for partial matches
    for policy in available_policies:
        if policy_type.lower() in policy["name"].lower():
            return policy["arn"]
    
    return None


def create_service_role_with_policy(
    service: str,
    policy_name: Optional[str] = None,
    role_name: Optional[str] = None,
    region: str = AWS_REGION
) -> str:
    """
    Create service role with selected AWS managed policy (legacy function for backward compatibility).
    
    Args:
        service: Service name (codebuild, codepipeline, codedeploy)
        policy_name: Selected policy name (uses default if None)
        role_name: Custom role name (auto-generated if None)
        region: AWS region
        
    Returns:
        Role ARN
    """
    # Generate role name if not provided
    if not role_name:
        timestamp = int(time.time())
        role_name = f"{service}-service-role-{timestamp}"
    
    # Get policy selection
    available_policies = get_available_policies(service)
    if not available_policies:
        raise ValueError(f"No managed policies available for service: {service}")
    
    selected_policy_name = policy_name or get_default_policy(service)
    selected_policy = next((p for p in available_policies if p["name"] == selected_policy_name), None)
    
    if not selected_policy:
        raise ValueError(f"Policy '{selected_policy_name}' not found for service: {service}")
    
    # Use the async function (run synchronously for backward compatibility)
    import asyncio
    return asyncio.run(create_service_role(role_name, service, selected_policy["arn"], region))


def list_policy_options(service: str) -> Dict[str, Any]:
    """
    List available policy options for a service.
    
    Args:
        service: AWS service name
        
    Returns:
        Dictionary containing policy information
    """
    policies = get_available_policies(service)
    default = get_default_policy(service)
    
    return {
        "service": service,
        "available_policies": policies,
        "default_policy": default,
        "total_options": len(policies),
        "policy_descriptions": {p["name"]: p["description"] for p in policies}
    }


async def validate_role_permissions(role_arn: str, service: str, region: str = AWS_REGION) -> Dict[str, Any]:
    """
    Validate that a role has the necessary permissions for a service.
    
    Args:
        role_arn: ARN of the IAM role to validate
        service: AWS service name
        region: AWS region
        
    Returns:
        Dictionary containing validation results
    """
    iam = boto3.client('iam', region_name=region)
    
    try:
        # Extract role name from ARN
        role_name = role_arn.split('/')[-1]
        
        # Get role details
        role_response = iam.get_role(RoleName=role_name)
        role = role_response['Role']
        
        # Check trust policy
        trust_policy = role.get('AssumeRolePolicyDocument', {})
        has_service_trust = False
        
        if 'Statement' in trust_policy:
            for statement in trust_policy['Statement']:
                principal = statement.get('Principal', {})
                if isinstance(principal, dict) and 'Service' in principal:
                    services = principal['Service']
                    if isinstance(services, str):
                        services = [services]
                    if f"{service}.amazonaws.com" in services:
                        has_service_trust = True
                        break
        
        # Get attached policies
        attached_policies = []
        try:
            policies_response = iam.list_attached_role_policies(RoleName=role_name)
            attached_policies = policies_response.get('AttachedPolicies', [])
        except ClientError:
            pass
        
        # Get inline policies
        inline_policies = []
        try:
            inline_response = iam.list_role_policies(RoleName=role_name)
            inline_policies = inline_response.get('PolicyNames', [])
        except ClientError:
            pass
        
        return {
            "role_arn": role_arn,
            "role_name": role_name,
            "service": service,
            "has_service_trust_policy": has_service_trust,
            "attached_policies": attached_policies,
            "inline_policies": inline_policies,
            "total_policies": len(attached_policies) + len(inline_policies),
            "created_date": role.get('CreateDate'),
            "last_used": role.get('RoleLastUsed', {}).get('LastUsedDate'),
            "validation_passed": has_service_trust and (len(attached_policies) > 0 or len(inline_policies) > 0)
        }
        
    except ClientError as e:
        return {
            "role_arn": role_arn,
            "service": service,
            "validation_passed": False,
            "error": f"Failed to validate role: {e.response['Error']['Code']} - {e.response['Error']['Message']}"
        }


def get_service_trust_policy(service: str) -> Dict[str, Any]:
    """
    Get the trust policy document for a specific AWS service.
    
    Args:
        service: AWS service name
        
    Returns:
        Trust policy document
    """
    return {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": f"{service}.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }
