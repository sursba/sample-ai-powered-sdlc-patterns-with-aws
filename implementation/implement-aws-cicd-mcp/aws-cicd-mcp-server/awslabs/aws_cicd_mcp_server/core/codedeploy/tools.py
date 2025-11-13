"""
CodeDeploy tools for AWS CI/CD MCP Server with comprehensive functionality.

This module provides 7 tools for managing AWS CodeDeploy applications and deployments:
1. list_applications - List all CodeDeploy applications with pagination
2. get_application_details - Get detailed application information
3. create_deployment - Deploy with comprehensive validation and multiple revision types
4. get_deployment_status - Detailed deployment progress and instance status
5. list_deployment_groups - List deployment groups with configuration details
6. create_application - Create application with multi-platform support
7. create_deployment_group - Create deployment group with advanced targeting
"""

import boto3
from datetime import datetime
try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.ERROR)
from awslabs.aws_cicd_mcp_server.core.common.config import AWS_REGION
from awslabs.aws_cicd_mcp_server.core.common.decorators import handle_exceptions, require_write_mode
from awslabs.aws_cicd_mcp_server.core.common.utils import (
    get_paginated_results, validate_iam_role, validate_resource_name, 
    validate_s3_bucket, remove_null_values
)
from awslabs.aws_cicd_mcp_server.core.common.role_utils import get_or_create_role
from pydantic import Field
from typing import Annotated, Dict, List, Optional, Any

@handle_exceptions
async def list_applications(
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION,
    max_items: Annotated[Optional[int], Field(description="Maximum items to return (default: 100)")] = None
) -> Dict[str, Any]:
    """
    List all CodeDeploy applications in the specified region with pagination support.
    
    This tool provides a comprehensive list of CodeDeploy applications with metadata
    including compute platform, creation date, and linked resources.
    
    Args:
        region: AWS region to list applications from
        max_items: Maximum number of applications to return (pagination support)
        
    Returns:
        Dictionary containing applications list, count, and metadata
        
    Example:
        List all applications: list_applications()
        List first 10 applications: list_applications(max_items=10)
    """
    logger.info(f"Listing CodeDeploy applications in region: {region}")
    client = boto3.client('codedeploy', region_name=region)
    
    # Get paginated results with metadata
    result = get_paginated_results(
        client, 'list_applications', 'applications', max_items=max_items
    )
    
    # Enhance with additional metadata if applications exist
    if result['applications']:
        try:
            # Get detailed info for first few applications to provide richer data
            sample_size = min(5, len(result['applications']))
            sample_apps = result['applications'][:sample_size]
            
            app_stats = {
                'total_applications': result['count'],
                'sample_details': []
            }
            
            for app_name in sample_apps:
                try:
                    app_response = client.get_application(applicationName=app_name)
                    app_info = app_response.get('application', {})
                    
                    app_stats['sample_details'].append({
                        'name': app_info.get('applicationName'),
                        'application_id': app_info.get('applicationId'),
                        'compute_platform': app_info.get('computePlatform'),
                        'create_time': app_info.get('createTime'),
                        'linked_to_github': app_info.get('linkedToGitHub', False)
                    })
                except Exception as e:
                    logger.warning(f"Could not fetch details for application {app_name}: {e}")
            
            result['application_statistics'] = app_stats
            
        except Exception as e:
            logger.warning(f"Could not fetch detailed application statistics: {e}")
    
    result['region'] = region
    logger.info(f"Found {result['count']} CodeDeploy applications in {region}")
    
    return result

@handle_exceptions
async def get_application_details(
    application_name: Annotated[str, Field(description="Name of the CodeDeploy application")],
    include_deployment_groups: Annotated[bool, Field(description="Include deployment groups information", default=False)] = False,
    include_recent_deployments: Annotated[bool, Field(description="Include recent deployment history", default=False)] = False,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Get comprehensive information about a specific CodeDeploy application.
    
    This tool provides detailed application configuration, deployment groups,
    and optionally recent deployment history.
    
    Args:
        application_name: Name of the CodeDeploy application
        include_deployment_groups: Whether to include deployment groups details
        include_recent_deployments: Whether to include recent deployment history
        region: AWS region
        
    Returns:
        Dictionary containing detailed application information
        
    Example:
        Get basic details: get_application_details("my-app")
        Get full details: get_application_details("my-app", include_deployment_groups=True, include_recent_deployments=True)
    """
    logger.info(f"Getting details for CodeDeploy application: {application_name}")
    client = boto3.client('codedeploy', region_name=region)
    
    # Get application details
    response = client.get_application(applicationName=application_name)
    application = response.get('application', {})
    
    if not application:
        logger.warning(f"CodeDeploy application not found: {application_name}")
        return {
            "error": f"Application '{application_name}' not found in region {region}",
            "error_type": "ResourceError",
            "suggestions": [
                "Verify the application name is correct",
                "Check if you're using the correct AWS region",
                "Ensure you have permissions to view CodeDeploy applications"
            ]
        }
    
    # Structure the response with organized information
    result = {
        "application_name": application_name,
        "region": region,
        "basic_info": {
            "name": application.get('applicationName'),
            "application_id": application.get('applicationId'),
            "compute_platform": application.get('computePlatform'),
            "create_time": application.get('createTime'),
            "linked_to_github": application.get('linkedToGitHub', False)
        }
    }
    
    # Include deployment groups if requested
    if include_deployment_groups:
        try:
            logger.info(f"Fetching deployment groups for application: {application_name}")
            dg_response = client.list_deployment_groups(applicationName=application_name)
            deployment_group_names = dg_response.get('deploymentGroups', [])
            
            if deployment_group_names:
                # Get detailed info for each deployment group
                dg_details_response = client.batch_get_deployment_groups(
                    applicationName=application_name,
                    deploymentGroupNames=deployment_group_names
                )
                
                result['deployment_groups'] = []
                for dg_info in dg_details_response.get('deploymentGroupsInfo', []):
                    dg_detail = {
                        'name': dg_info.get('deploymentGroupName'),
                        'deployment_group_id': dg_info.get('deploymentGroupId'),
                        'service_role_arn': dg_info.get('serviceRoleArn'),
                        'deployment_config_name': dg_info.get('deploymentConfigName'),
                        'auto_rollback_enabled': dg_info.get('autoRollbackConfiguration', {}).get('enabled', False),
                        'target_revision': dg_info.get('targetRevision'),
                        'ec2_tag_filters': dg_info.get('ec2TagFilters', []),
                        'auto_scaling_groups': dg_info.get('autoScalingGroups', []),
                        'load_balancer_info': dg_info.get('loadBalancerInfo', {}),
                        'last_successful_deployment': dg_info.get('lastSuccessfulDeployment'),
                        'last_attempted_deployment': dg_info.get('lastAttemptedDeployment')
                    }
                    result['deployment_groups'].append(remove_null_values(dg_detail))
            else:
                result['deployment_groups'] = []
                
        except Exception as e:
            logger.warning(f"Could not fetch deployment groups for {application_name}: {e}")
            result['deployment_groups_error'] = "Could not fetch deployment groups"
    
    # Include recent deployments if requested
    if include_recent_deployments:
        try:
            logger.info(f"Fetching recent deployments for application: {application_name}")
            deployments_response = client.list_deployments(
                applicationName=application_name,
                includeOnlyStatuses=['Created', 'Queued', 'InProgress', 'Succeeded', 'Failed', 'Stopped', 'Ready']
            )
            
            deployment_ids = deployments_response.get('deployments', [])[:10]  # Last 10 deployments
            
            if deployment_ids:
                deployments_detail_response = client.batch_get_deployments(deploymentIds=deployment_ids)
                
                result['recent_deployments'] = []
                for deployment in deployments_detail_response.get('deploymentsInfo', []):
                    deployment_detail = {
                        'deployment_id': deployment.get('deploymentId'),
                        'deployment_group_name': deployment.get('deploymentGroupName'),
                        'status': deployment.get('status'),
                        'create_time': deployment.get('createTime'),
                        'start_time': deployment.get('startTime'),
                        'complete_time': deployment.get('completeTime'),
                        'deployment_config_name': deployment.get('deploymentConfigName'),
                        'revision': deployment.get('revision'),
                        'description': deployment.get('description'),
                        'creator': deployment.get('creator'),
                        'ignore_application_stop_failures': deployment.get('ignoreApplicationStopFailures'),
                        'auto_rollback_configuration': deployment.get('autoRollbackConfiguration')
                    }
                    result['recent_deployments'].append(remove_null_values(deployment_detail))
            else:
                result['recent_deployments'] = []
                
        except Exception as e:
            logger.warning(f"Could not fetch deployment history for {application_name}: {e}")
            result['recent_deployments_error'] = "Could not fetch deployment history"
    
    logger.info(f"Successfully retrieved details for CodeDeploy application: {application_name}")
    return result

@handle_exceptions
async def list_deployment_groups(
    application_name: Annotated[str, Field(description="Name of the CodeDeploy application")],
    include_details: Annotated[bool, Field(description="Include detailed configuration for each deployment group", default=False)] = False,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    List deployment groups for a CodeDeploy application with optional detailed configuration.
    
    This tool lists all deployment groups for an application and optionally provides
    detailed configuration including target settings, load balancer configuration, and rollback settings.
    
    Args:
        application_name: Name of the CodeDeploy application
        include_details: Whether to include detailed configuration for each deployment group
        region: AWS region
        
    Returns:
        Dictionary containing deployment groups list and optional detailed configuration
        
    Example:
        List groups: list_deployment_groups("my-app")
        List with details: list_deployment_groups("my-app", include_details=True)
    """
    logger.info(f"Listing deployment groups for application: {application_name}")
    client = boto3.client('codedeploy', region_name=region)
    
    # Validate application exists
    try:
        app_response = client.get_application(applicationName=application_name)
        if not app_response.get('application'):
            return {
                "error": f"CodeDeploy application '{application_name}' not found in region {region}",
                "error_type": "ResourceError"
            }
    except Exception as e:
        logger.error(f"Error validating application {application_name}: {e}")
        return {
            "error": f"Failed to validate application: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # List deployment groups
    response = client.list_deployment_groups(applicationName=application_name)
    deployment_group_names = response.get('deploymentGroups', [])
    
    result = {
        "application_name": application_name,
        "region": region,
        "deployment_groups": deployment_group_names,
        "count": len(deployment_group_names)
    }
    
    # Include detailed configuration if requested
    if include_details and deployment_group_names:
        try:
            logger.info(f"Fetching detailed configuration for {len(deployment_group_names)} deployment groups")
            
            # Get detailed info for all deployment groups
            dg_details_response = client.batch_get_deployment_groups(
                applicationName=application_name,
                deploymentGroupNames=deployment_group_names
            )
            
            result['deployment_group_details'] = []
            for dg_info in dg_details_response.get('deploymentGroupsInfo', []):
                dg_detail = {
                    'basic_info': {
                        'deployment_group_name': dg_info.get('deploymentGroupName'),
                        'deployment_group_id': dg_info.get('deploymentGroupId'),
                        'application_name': dg_info.get('applicationName'),
                        'service_role_arn': dg_info.get('serviceRoleArn'),
                        'deployment_config_name': dg_info.get('deploymentConfigName')
                    },
                    'target_configuration': {
                        'ec2_tag_filters': dg_info.get('ec2TagFilters', []),
                        'on_premises_instance_tag_filters': dg_info.get('onPremisesInstanceTagFilters', []),
                        'auto_scaling_groups': dg_info.get('autoScalingGroups', []),
                        'ec2_tag_set': dg_info.get('ec2TagSet', {}),
                        'on_premises_tag_set': dg_info.get('onPremisesTagSet', {}),
                        'ecs_services': dg_info.get('ecsServices', [])
                    },
                    'load_balancer_info': dg_info.get('loadBalancerInfo', {}),
                    'rollback_configuration': {
                        'auto_rollback_configuration': dg_info.get('autoRollbackConfiguration', {}),
                        'rollback_info': dg_info.get('rollbackInfo', {})
                    },
                    'deployment_history': {
                        'last_successful_deployment': dg_info.get('lastSuccessfulDeployment'),
                        'last_attempted_deployment': dg_info.get('lastAttemptedDeployment')
                    },
                    'advanced_settings': {
                        'blue_green_deployment_configuration': dg_info.get('blueGreenDeploymentConfiguration', {}),
                        'deployment_style': dg_info.get('deploymentStyle', {}),
                        'alarm_configuration': dg_info.get('alarmConfiguration', {}),
                        'trigger_configurations': dg_info.get('triggerConfigurations', []),
                        'outdated_instances_strategy': dg_info.get('outdatedInstancesStrategy')
                    }
                }
                
                # Remove null values for cleaner output
                result['deployment_group_details'].append(remove_null_values(dg_detail))
                
        except Exception as e:
            logger.warning(f"Could not fetch detailed deployment group configuration: {e}")
            result['details_error'] = "Could not fetch detailed configuration"
    
    logger.info(f"Found {len(deployment_group_names)} deployment groups for application {application_name}")
    return result

@handle_exceptions
@require_write_mode
async def create_deployment(
    application_name: Annotated[str, Field(description="Name of the CodeDeploy application")],
    deployment_group_name: Annotated[str, Field(description="Name of the deployment group")],
    revision_type: Annotated[str, Field(description="Revision type (S3, GitHub, String)", default="S3")] = "S3",
    s3_bucket: Annotated[Optional[str], Field(description="S3 bucket containing deployment artifacts")] = None,
    s3_key: Annotated[Optional[str], Field(description="S3 key for deployment artifacts")] = None,
    s3_bundle_type: Annotated[Optional[str], Field(description="S3 bundle type (tar, tgz, zip)", default="zip")] = "zip",
    s3_etag: Annotated[Optional[str], Field(description="S3 ETag for version verification")] = None,
    s3_version: Annotated[Optional[str], Field(description="S3 version ID")] = None,
    github_repository: Annotated[Optional[str], Field(description="GitHub repository (owner/repo)")] = None,
    github_commit_id: Annotated[Optional[str], Field(description="GitHub commit ID")] = None,
    string_content: Annotated[Optional[str], Field(description="String content for deployment")] = None,
    string_sha256: Annotated[Optional[str], Field(description="SHA256 hash of string content")] = None,
    description: Annotated[Optional[str], Field(description="Deployment description")] = None,
    deployment_config_name: Annotated[Optional[str], Field(description="Deployment configuration name")] = None,
    auto_rollback_enabled: Annotated[bool, Field(description="Enable automatic rollback on failure", default=True)] = True,
    rollback_on_failure: Annotated[bool, Field(description="Rollback on deployment failure", default=True)] = True,
    rollback_on_alarm: Annotated[bool, Field(description="Rollback on CloudWatch alarm", default=False)] = False,
    ignore_application_stop_failures: Annotated[bool, Field(description="Ignore application stop failures", default=False)] = False,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Create a new CodeDeploy deployment with comprehensive configuration options.
    
    This tool creates a deployment with support for multiple revision types (S3, GitHub, String),
    automatic rollback configuration, and deployment validation.
    
    Args:
        application_name: Name of the CodeDeploy application
        deployment_group_name: Name of the deployment group
        revision_type: Type of revision (S3, GitHub, String)
        s3_bucket: S3 bucket for S3 revisions
        s3_key: S3 object key for S3 revisions
        s3_bundle_type: Bundle type for S3 (tar, tgz, zip)
        s3_etag: S3 ETag for version verification
        s3_version: S3 version ID for versioned buckets
        github_repository: GitHub repository in format "owner/repo"
        github_commit_id: GitHub commit ID or SHA
        string_content: Raw string content for String revisions
        string_sha256: SHA256 hash of string content
        description: Optional deployment description
        deployment_config_name: Custom deployment configuration
        auto_rollback_enabled: Enable automatic rollback
        rollback_on_failure: Rollback on deployment failure
        rollback_on_alarm: Rollback on CloudWatch alarm
        ignore_application_stop_failures: Continue deployment if app stop fails
        region: AWS region
        
    Returns:
        Dictionary containing deployment information and status
        
    Example:
        S3 deployment: create_deployment("my-app", "prod", s3_bucket="my-bucket", s3_key="app-v1.0.zip")
        GitHub deployment: create_deployment("my-app", "prod", revision_type="GitHub", github_repository="user/repo", github_commit_id="abc123")
    """
    logger.info(f"Creating deployment for application: {application_name}")
    client = boto3.client('codedeploy', region_name=region)
    
    # Validate application and deployment group exist
    try:
        app_response = client.get_application(applicationName=application_name)
        if not app_response.get('application'):
            return {
                "error": f"CodeDeploy application '{application_name}' not found in region {region}",
                "error_type": "ResourceError"
            }
    except Exception as e:
        logger.error(f"Error validating application {application_name}: {e}")
        return {
            "error": f"Failed to validate application: {str(e)}",
            "error_type": "ValidationError"
        }
    
    try:
        dg_response = client.get_deployment_group(
            applicationName=application_name,
            deploymentGroupName=deployment_group_name
        )
        if not dg_response.get('deploymentGroupInfo'):
            return {
                "error": f"Deployment group '{deployment_group_name}' not found in application '{application_name}'",
                "error_type": "ResourceError"
            }
    except Exception as e:
        logger.error(f"Error validating deployment group: {e}")
        return {
            "error": f"Failed to validate deployment group: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Build revision configuration based on type
    revision = {"revisionType": revision_type}
    
    if revision_type == "S3":
        if not s3_bucket or not s3_key:
            return {
                "error": "S3 bucket and key are required for S3 revision type",
                "error_type": "ValidationError"
            }
        
        # Validate S3 bucket accessibility
        if not await validate_s3_bucket(s3_bucket, region):
            return {
                "error": f"S3 bucket '{s3_bucket}' not found or not accessible",
                "error_type": "ValidationError"
            }
        
        s3_location = {
            "bucket": s3_bucket,
            "key": s3_key,
            "bundleType": s3_bundle_type
        }
        
        if s3_etag:
            s3_location["eTag"] = s3_etag
        if s3_version:
            s3_location["version"] = s3_version
            
        revision["s3Location"] = s3_location
        
    elif revision_type == "GitHub":
        if not github_repository or not github_commit_id:
            return {
                "error": "GitHub repository and commit ID are required for GitHub revision type",
                "error_type": "ValidationError"
            }
        
        revision["gitHubLocation"] = {
            "repository": github_repository,
            "commitId": github_commit_id
        }
        
    elif revision_type == "String":
        if not string_content:
            return {
                "error": "String content is required for String revision type",
                "error_type": "ValidationError"
            }
        
        string_location = {"content": string_content}
        if string_sha256:
            string_location["sha256"] = string_sha256
            
        revision["string"] = string_location
    
    else:
        return {
            "error": f"Invalid revision type: {revision_type}. Must be S3, GitHub, or String",
            "error_type": "ValidationError"
        }
    
    # Build deployment parameters
    deployment_params = {
        "applicationName": application_name,
        "deploymentGroupName": deployment_group_name,
        "revision": revision,
        "ignoreApplicationStopFailures": ignore_application_stop_failures
    }
    
    if description:
        deployment_params["description"] = description
    
    if deployment_config_name:
        deployment_params["deploymentConfigName"] = deployment_config_name
    
    # Configure auto rollback
    if auto_rollback_enabled:
        rollback_events = []
        if rollback_on_failure:
            rollback_events.append("DEPLOYMENT_FAILURE")
        if rollback_on_alarm:
            rollback_events.append("DEPLOYMENT_STOP_ON_ALARM")
        
        if rollback_events:
            deployment_params["autoRollbackConfiguration"] = {
                "enabled": True,
                "events": rollback_events
            }
    
    try:
        # Create the deployment
        logger.info(f"Creating deployment for {application_name}/{deployment_group_name}")
        response = client.create_deployment(**deployment_params)
        
        result = {
            "deployment_id": response['deploymentId'],
            "application_name": application_name,
            "deployment_group_name": deployment_group_name,
            "region": region,
            "status": "Created",
            "revision_type": revision_type,
            "deployment_configuration": {
                "auto_rollback_enabled": auto_rollback_enabled,
                "rollback_on_failure": rollback_on_failure,
                "rollback_on_alarm": rollback_on_alarm,
                "ignore_application_stop_failures": ignore_application_stop_failures,
                "custom_deployment_config": bool(deployment_config_name)
            }
        }
        
        # Add revision-specific information
        if revision_type == "S3":
            result["revision_info"] = {
                "s3_bucket": s3_bucket,
                "s3_key": s3_key,
                "bundle_type": s3_bundle_type
            }
        elif revision_type == "GitHub":
            result["revision_info"] = {
                "repository": github_repository,
                "commit_id": github_commit_id
            }
        
        logger.info(f"Successfully created deployment {response['deploymentId']}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to create deployment: {e}")
        raise

@handle_exceptions
@require_write_mode
async def create_application(
    application_name: Annotated[str, Field(description="Name of the CodeDeploy application (1-100 chars)")],
    compute_platform: Annotated[str, Field(description="Compute platform", default="Server")] = "Server",
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Create a new CodeDeploy application with multi-platform support.
    
    This tool creates a CodeDeploy application for the specified compute platform
    with proper validation and tagging.
    
    Args:
        application_name: Name for the new CodeDeploy application (1-100 characters)
        compute_platform: Target compute platform (Server, Lambda, ECS)
        region: AWS region
        
    Returns:
        Dictionary containing application creation details
        
    Example:
        Create EC2 app: create_application("my-web-app", "Server")
        Create Lambda app: create_application("my-lambda-app", "Lambda")
        Create ECS app: create_application("my-ecs-app", "ECS")
    """
    logger.info(f"Creating CodeDeploy application: {application_name}")
    
    # Validate application name
    if not validate_resource_name(application_name, 'codedeploy_application'):
        return {
            "error": f"Invalid application name '{application_name}'. Must be 1-100 characters, letters, numbers, periods, underscores, and hyphens only.",
            "error_type": "ValidationError",
            "guidance": "Use only letters, numbers, periods, underscores, and hyphens."
        }
    
    # Validate compute platform
    valid_platforms = ["Server", "Lambda", "ECS"]
    if compute_platform not in valid_platforms:
        return {
            "error": f"Invalid compute platform: {compute_platform}. Must be one of: {valid_platforms}",
            "error_type": "ValidationError"
        }
    
    client = boto3.client('codedeploy', region_name=region)
    
    try:
        # Create the application
        logger.info(f"Creating CodeDeploy application for {compute_platform} platform")
        response = client.create_application(
            applicationName=application_name,
            computePlatform=compute_platform,
            tags=[
                {
                    'Key': 'CreatedBy',
                    'Value': 'AWS-CICD-MCP-Server'
                },
                {
                    'Key': 'ComputePlatform',
                    'Value': compute_platform
                },
                {
                    'Key': 'Environment',
                    'Value': 'CodeDeploy'
                }
            ]
        )
        
        result = {
            "application_name": application_name,
            "application_id": response.get('applicationId'),
            "compute_platform": compute_platform,
            "region": region,
            "status": "Created",
            "platform_capabilities": _get_platform_capabilities(compute_platform)
        }
        
        logger.info(f"Successfully created CodeDeploy application: {application_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to create CodeDeploy application {application_name}: {e}")
        raise


def _get_platform_capabilities(compute_platform: str) -> Dict[str, Any]:
    """Get capabilities and features for each compute platform."""
    capabilities = {
        "Server": {
            "deployment_types": ["In-place", "Blue/green"],
            "supported_os": ["Amazon Linux", "Ubuntu", "RHEL", "Windows Server"],
            "load_balancer_support": ["Application Load Balancer", "Classic Load Balancer", "Network Load Balancer"],
            "auto_scaling_support": True,
            "rollback_support": True,
            "alarm_monitoring": True
        },
        "Lambda": {
            "deployment_types": ["Blue/green"],
            "supported_runtimes": ["All Lambda runtimes"],
            "traffic_shifting": ["Canary", "Linear", "All-at-once"],
            "alias_support": True,
            "rollback_support": True,
            "alarm_monitoring": True
        },
        "ECS": {
            "deployment_types": ["Blue/green"],
            "supported_services": ["ECS Services with Application Load Balancer"],
            "load_balancer_support": ["Application Load Balancer", "Network Load Balancer"],
            "capacity_providers": ["EC2", "Fargate"],
            "rollback_support": True,
            "alarm_monitoring": True
        }
    }
    
    return capabilities.get(compute_platform, {})

@handle_exceptions
@require_write_mode
async def create_deployment_group(
    application_name: Annotated[str, Field(description="Name of the CodeDeploy application")],
    deployment_group_name: Annotated[str, Field(description="Name of the deployment group")],
    service_role_arn: Annotated[Optional[str], Field(description="Service role ARN (auto-created if not provided)")] = None,
    ec2_tag_filters: Annotated[Optional[List[Dict[str, str]]], Field(description="EC2 tag filters for targeting instances")] = None,
    auto_scaling_groups: Annotated[Optional[List[str]], Field(description="Auto Scaling group names")] = None,
    deployment_config_name: Annotated[Optional[str], Field(description="Deployment configuration name")] = None,
    auto_rollback_enabled: Annotated[bool, Field(description="Enable automatic rollback", default=True)] = True,
    rollback_on_failure: Annotated[bool, Field(description="Rollback on deployment failure", default=True)] = True,
    rollback_on_alarm: Annotated[bool, Field(description="Rollback on CloudWatch alarm", default=False)] = False,
    load_balancer_name: Annotated[Optional[str], Field(description="Classic Load Balancer name")] = None,
    target_group_name: Annotated[Optional[str], Field(description="Application/Network Load Balancer target group name")] = None,
    auto_create_role: Annotated[bool, Field(description="Automatically create IAM service role", default=True)] = True,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Create a new deployment group with advanced targeting and configuration options.
    
    This tool creates a deployment group with comprehensive targeting options including
    EC2 tags, Auto Scaling groups, load balancer integration, and automatic rollback configuration.
    
    Args:
        application_name: Name of the CodeDeploy application
        deployment_group_name: Name for the new deployment group
        service_role_arn: IAM service role ARN (created automatically if not provided)
        ec2_tag_filters: List of EC2 tag filters [{"Key": "Environment", "Value": "Production", "Type": "KEY_AND_VALUE"}]
        auto_scaling_groups: List of Auto Scaling group names to target
        deployment_config_name: Custom deployment configuration
        auto_rollback_enabled: Enable automatic rollback
        rollback_on_failure: Rollback on deployment failure
        rollback_on_alarm: Rollback on CloudWatch alarm
        load_balancer_name: Classic Load Balancer name for traffic management
        target_group_name: ALB/NLB target group name for traffic management
        auto_create_role: Whether to create IAM role automatically
        region: AWS region
        
    Returns:
        Dictionary containing deployment group creation details
        
    Example:
        Basic group: create_deployment_group("my-app", "production", ec2_tag_filters=[{"Key": "Environment", "Value": "prod", "Type": "KEY_AND_VALUE"}])
        With ASG: create_deployment_group("my-app", "production", auto_scaling_groups=["my-asg"])
    """
    logger.info(f"Creating deployment group: {deployment_group_name} for application: {application_name}")
    client = boto3.client('codedeploy', region_name=region)
    
    # Validate application exists and get compute platform
    try:
        app_response = client.get_application(applicationName=application_name)
        application = app_response.get('application', {})
        if not application:
            return {
                "error": f"CodeDeploy application '{application_name}' not found in region {region}",
                "error_type": "ResourceError"
            }
        
        compute_platform = application.get('computePlatform', 'Server')
        
    except Exception as e:
        logger.error(f"Error validating application {application_name}: {e}")
        return {
            "error": f"Failed to validate application: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Handle IAM role - create if needed
    role_auto_created = False
    if not service_role_arn and auto_create_role:
        try:
            logger.info(f"Auto-creating IAM role for deployment group: {deployment_group_name}")
            role_name = f"CodeDeployServiceRole-{application_name}-{deployment_group_name}"
            
            # Select appropriate policy based on compute platform
            if compute_platform == "ECS":
                policy_type = "AWSCodeDeployRoleForECS"
            elif compute_platform == "Lambda":
                policy_type = "AWSCodeDeployRoleForLambda"
            else:
                policy_type = "AWSCodeDeployRole"
            
            service_role_arn = await get_or_create_role(
                role_name=role_name,
                service='codedeploy',
                policy_type=policy_type,
                region=region
            )
            role_auto_created = True
            logger.info(f"Created/retrieved IAM role: {service_role_arn}")
        except Exception as e:
            return {
                "error": f"Failed to create IAM service role: {str(e)}",
                "error_type": "IAMError",
                "guidance": "Ensure you have IAM permissions to create roles, or provide an existing service_role_arn"
            }
    elif service_role_arn:
        # Validate provided role
        if not await validate_iam_role(service_role_arn, region):
            return {
                "error": f"IAM role '{service_role_arn}' not found or not accessible",
                "error_type": "ValidationError",
                "guidance": "Verify the role ARN is correct and you have permission to use it"
            }
    else:
        return {
            "error": "Either provide service_role_arn or enable auto_create_role",
            "error_type": "ValidationError"
        }
    
    # Build deployment group configuration
    dg_config = {
        "applicationName": application_name,
        "deploymentGroupName": deployment_group_name,
        "serviceRoleArn": service_role_arn
    }
    
    # Add EC2 tag filters
    if ec2_tag_filters:
        # Validate tag filter format
        for tag_filter in ec2_tag_filters:
            if not all(key in tag_filter for key in ['Key', 'Value', 'Type']):
                return {
                    "error": "EC2 tag filters must include 'Key', 'Value', and 'Type' fields",
                    "error_type": "ValidationError",
                    "guidance": "Use format: [{'Key': 'Environment', 'Value': 'prod', 'Type': 'KEY_AND_VALUE'}]"
                }
        
        dg_config["ec2TagFilters"] = ec2_tag_filters
    
    # Add Auto Scaling groups
    if auto_scaling_groups:
        dg_config["autoScalingGroups"] = [{"name": asg} for asg in auto_scaling_groups]
    
    # Add deployment configuration
    if deployment_config_name:
        dg_config["deploymentConfigName"] = deployment_config_name
    
    # Configure auto rollback
    if auto_rollback_enabled:
        rollback_events = []
        if rollback_on_failure:
            rollback_events.append("DEPLOYMENT_FAILURE")
        if rollback_on_alarm:
            rollback_events.append("DEPLOYMENT_STOP_ON_ALARM")
        
        if rollback_events:
            dg_config["autoRollbackConfiguration"] = {
                "enabled": True,
                "events": rollback_events
            }
    
    # Configure load balancer
    load_balancer_info = {}
    if load_balancer_name:
        load_balancer_info["elbInfoList"] = [{"name": load_balancer_name}]
    
    if target_group_name:
        load_balancer_info["targetGroupInfoList"] = [{"name": target_group_name}]
    
    if load_balancer_info:
        dg_config["loadBalancerInfo"] = load_balancer_info
    
    # Add tags
    dg_config["tags"] = [
        {
            "Key": "CreatedBy",
            "Value": "AWS-CICD-MCP-Server"
        },
        {
            "Key": "Application",
            "Value": application_name
        },
        {
            "Key": "ComputePlatform",
            "Value": compute_platform
        }
    ]
    
    try:
        # Create the deployment group
        logger.info(f"Creating deployment group {deployment_group_name} for {compute_platform} platform")
        response = client.create_deployment_group(**dg_config)
        
        result = {
            "application_name": application_name,
            "deployment_group_name": deployment_group_name,
            "deployment_group_id": response.get('deploymentGroupId'),
            "region": region,
            "status": "Created",
            "compute_platform": compute_platform,
            "configuration": {
                "service_role_arn": service_role_arn,
                "role_auto_created": role_auto_created,
                "ec2_tag_filters_count": len(ec2_tag_filters) if ec2_tag_filters else 0,
                "auto_scaling_groups_count": len(auto_scaling_groups) if auto_scaling_groups else 0,
                "auto_rollback_enabled": auto_rollback_enabled,
                "load_balancer_configured": bool(load_balancer_name or target_group_name),
                "custom_deployment_config": bool(deployment_config_name)
            }
        }
        
        # Add role creation message if auto-created
        if role_auto_created:
            result["role_creation_notice"] = {
                "message": "IAM service role was automatically created since no custom role was provided",
                "role_name": f"CodeDeployServiceRole-{application_name}-{deployment_group_name}",
                "role_arn": service_role_arn,
                "security_note": "Auto-created role follows AWS security best practices with minimal required permissions",
                "recommendation": "Review and customize the role permissions if needed for your specific use case"
            }
        
        logger.info(f"Successfully created deployment group: {deployment_group_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to create deployment group {deployment_group_name}: {e}")
        raise


@handle_exceptions
@require_write_mode
async def delete_application(
    application_name: Annotated[str, Field(description="Name of the CodeDeploy application to delete")],
    force_delete: Annotated[bool, Field(description="Force delete even if deployment groups exist", default=False)] = False,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Delete a CodeDeploy application with safety checks and confirmation.
    
    This tool safely deletes a CodeDeploy application after performing validation
    and checking for existing deployment groups and active deployments.
    
    Args:
        application_name: Name of the CodeDeploy application to delete
        force_delete: Force deletion even if deployment groups exist
        region: AWS region
        
    Returns:
        Dictionary containing deletion results and application information
        
    Example:
        Delete application: delete_application("my-app")
        Force delete: delete_application("my-app", force_delete=True)
    """
    logger.info(f"Deleting CodeDeploy application: {application_name}")
    client = boto3.client('codedeploy', region_name=region)
    
    # First, verify the application exists and get its details
    try:
        app_response = client.get_application(applicationName=application_name)
        application = app_response.get('application', {})
        
        if not application:
            return {
                "error": f"CodeDeploy application '{application_name}' not found in region {region}",
                "error_type": "ResourceError",
                "suggestions": [
                    "Verify the application name is correct",
                    "Check if you're using the correct AWS region",
                    "The application may have already been deleted"
                ]
            }
        
    except Exception as e:
        logger.error(f"Error verifying application {application_name}: {e}")
        return {
            "error": f"Failed to verify application: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Check for existing deployment groups unless force_delete is True
    deployment_groups = []
    active_deployments = []
    
    if not force_delete:
        try:
            logger.info(f"Checking for deployment groups in application: {application_name}")
            dg_response = client.list_deployment_groups(applicationName=application_name)
            deployment_groups = dg_response.get('deploymentGroups', [])
            
            # Check for active deployments
            if deployment_groups:
                deployments_response = client.list_deployments(
                    applicationName=application_name,
                    includeOnlyStatuses=['Created', 'Queued', 'InProgress']
                )
                active_deployments = deployments_response.get('deployments', [])
            
        except Exception as e:
            logger.warning(f"Could not check for deployment groups and active deployments: {e}")
    
    # If there are deployment groups or active deployments and force_delete is False, warn the user
    if (deployment_groups or active_deployments) and not force_delete:
        error_details = []
        if deployment_groups:
            error_details.append(f"{len(deployment_groups)} deployment group(s)")
        if active_deployments:
            error_details.append(f"{len(active_deployments)} active deployment(s)")
        
        return {
            "error": f"Cannot delete application '{application_name}' - contains {', '.join(error_details)}",
            "error_type": "ResourceError",
            "deployment_groups": deployment_groups,
            "active_deployments": active_deployments,
            "guidance": "Delete deployment groups and wait for deployments to complete, or use force_delete=True",
            "suggestions": [
                "Delete all deployment groups first",
                "Wait for active deployments to complete",
                "Use force_delete=True to delete regardless of existing resources"
            ]
        }
    
    # Collect application information before deletion
    app_info = {
        "name": application.get('applicationName'),
        "application_id": application.get('applicationId'),
        "compute_platform": application.get('computePlatform'),
        "create_time": application.get('createTime'),
        "linked_to_github": application.get('linkedToGitHub', False)
    }
    
    try:
        # Perform the deletion
        logger.info(f"Deleting CodeDeploy application: {application_name}")
        client.delete_application(applicationName=application_name)
        
        result = {
            "application_name": application_name,
            "status": "Deleted",
            "region": region,
            "deletion_details": {
                "force_delete_used": force_delete,
                "deployment_groups_at_deletion": len(deployment_groups),
                "active_deployments_at_deletion": len(active_deployments),
                "deleted_at": datetime.now().isoformat()
            },
            "deleted_application_info": app_info
        }
        
        # Add warning if resources existed
        if deployment_groups or active_deployments:
            warnings = []
            if deployment_groups:
                warnings.append(f"{len(deployment_groups)} deployment groups were deleted")
            if active_deployments:
                warnings.append(f"{len(active_deployments)} active deployments may have been terminated")
            
            result["warning"] = f"Application deleted with existing resources: {', '.join(warnings)}"
            result["affected_resources"] = {
                "deployment_groups": deployment_groups,
                "active_deployments": active_deployments
            }
        
        logger.info(f"Successfully deleted CodeDeploy application: {application_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to delete CodeDeploy application {application_name}: {e}")
        raise

@handle_exceptions
async def get_deployment_status(
    deployment_id: Annotated[str, Field(description="ID of the deployment")],
    include_instance_details: Annotated[bool, Field(description="Include individual instance deployment status", default=False)] = False,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Get comprehensive status and details of a CodeDeploy deployment.
    
    This tool provides detailed deployment status, progress information,
    and optionally individual instance deployment details.
    
    Args:
        deployment_id: ID of the deployment
        include_instance_details: Whether to include per-instance deployment status
        region: AWS region
        
    Returns:
        Dictionary containing detailed deployment status and progress
        
    Example:
        Get basic status: get_deployment_status("d-1234567890")
        Get full details: get_deployment_status("d-1234567890", include_instance_details=True)
    """
    logger.info(f"Getting deployment status for: {deployment_id}")
    client = boto3.client('codedeploy', region_name=region)
    
    # Get deployment details
    response = client.get_deployment(deploymentId=deployment_id)
    deployment_info = response.get('deploymentInfo', {})
    
    if not deployment_info:
        logger.warning(f"Deployment not found: {deployment_id}")
        return {
            "error": f"Deployment '{deployment_id}' not found in region {region}",
            "error_type": "ResourceError",
            "suggestions": [
                "Verify the deployment ID is correct",
                "Check if you're using the correct AWS region",
                "Ensure you have permissions to view CodeDeploy deployments"
            ]
        }
    
    # Calculate deployment duration
    start_time = deployment_info.get('startTime')
    complete_time = deployment_info.get('completeTime')
    duration_minutes = None
    
    if start_time and complete_time:
        if isinstance(start_time, datetime) and isinstance(complete_time, datetime):
            duration = complete_time - start_time
            duration_minutes = round(duration.total_seconds() / 60, 2)
    
    # Structure the response with organized information
    result = {
        "deployment_id": deployment_id,
        "region": region,
        "basic_info": {
            "application_name": deployment_info.get('applicationName'),
            "deployment_group_name": deployment_info.get('deploymentGroupName'),
            "deployment_config_name": deployment_info.get('deploymentConfigName'),
            "status": deployment_info.get('status'),
            "error_information": deployment_info.get('errorInformation'),
            "creator": deployment_info.get('creator'),
            "description": deployment_info.get('description')
        },
        "timing": {
            "create_time": deployment_info.get('createTime'),
            "start_time": deployment_info.get('startTime'),
            "complete_time": deployment_info.get('completeTime'),
            "duration_minutes": duration_minutes
        },
        "revision": deployment_info.get('revision', {}),
        "deployment_overview": deployment_info.get('deploymentOverview', {}),
        "configuration": {
            "ignore_application_stop_failures": deployment_info.get('ignoreApplicationStopFailures', False),
            "auto_rollback_configuration": deployment_info.get('autoRollbackConfiguration', {}),
            "rollback_info": deployment_info.get('rollbackInfo', {}),
            "previous_revision": deployment_info.get('previousRevision'),
            "additional_deployment_status_info": deployment_info.get('additionalDeploymentStatusInfo')
        }
    }
    
    # Add deployment statistics if available
    overview = deployment_info.get('deploymentOverview', {})
    if overview:
        total_instances = (
            overview.get('Pending', 0) +
            overview.get('InProgress', 0) +
            overview.get('Succeeded', 0) +
            overview.get('Failed', 0) +
            overview.get('Skipped', 0) +
            overview.get('Ready', 0)
        )
        
        result['deployment_statistics'] = {
            'total_instances': total_instances,
            'pending': overview.get('Pending', 0),
            'in_progress': overview.get('InProgress', 0),
            'succeeded': overview.get('Succeeded', 0),
            'failed': overview.get('Failed', 0),
            'skipped': overview.get('Skipped', 0),
            'ready': overview.get('Ready', 0),
            'success_rate': round((overview.get('Succeeded', 0) / total_instances * 100), 2) if total_instances > 0 else 0
        }
    
    # Include instance details if requested
    if include_instance_details:
        try:
            logger.info(f"Fetching instance details for deployment: {deployment_id}")
            instances_response = client.list_deployment_instances(deploymentId=deployment_id)
            instance_ids = instances_response.get('instancesList', [])
            
            if instance_ids:
                instances_detail_response = client.batch_get_deployment_instances(
                    deploymentId=deployment_id,
                    instanceIds=instance_ids
                )
                
                result['instance_details'] = []
                for instance in instances_detail_response.get('instancesSummary', []):
                    instance_detail = {
                        'deployment_id': instance.get('deploymentId'),
                        'instance_id': instance.get('instanceId'),
                        'instance_type': instance.get('instanceType'),
                        'status': instance.get('status'),
                        'last_updated_at': instance.get('lastUpdatedAt'),
                        'lifecycle_events': []
                    }
                    
                    # Add lifecycle events
                    for event in instance.get('lifecycleEvents', []):
                        event_detail = {
                            'lifecycle_event_name': event.get('lifecycleEventName'),
                            'status': event.get('status'),
                            'start_time': event.get('startTime'),
                            'end_time': event.get('endTime'),
                            'diagnostics': event.get('diagnostics', {})
                        }
                        instance_detail['lifecycle_events'].append(remove_null_values(event_detail))
                    
                    result['instance_details'].append(remove_null_values(instance_detail))
            else:
                result['instance_details'] = []
                
        except Exception as e:
            logger.warning(f"Could not fetch instance details for deployment {deployment_id}: {e}")
            result['instance_details_error'] = "Could not fetch instance details"
    
    # Remove null values for cleaner output
    result = remove_null_values(result)
    
    logger.info(f"Successfully retrieved deployment status for: {deployment_id}")
    return result
