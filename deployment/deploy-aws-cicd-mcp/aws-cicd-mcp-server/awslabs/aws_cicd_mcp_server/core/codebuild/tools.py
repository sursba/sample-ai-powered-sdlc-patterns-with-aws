"""
CodeBuild tools for AWS CI/CD MCP Server with comprehensive functionality.

This module provides 7 tools for managing AWS CodeBuild projects:
1. list_projects - List all CodeBuild projects with pagination
2. get_project_details - Get detailed project information
3. start_build - Start a build execution with validation
4. get_build_logs - Retrieve actual CloudWatch log content
5. create_project - Create new project with role management
6. update_project - Update existing project configuration
7. delete_project - Delete project with confirmation
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
    validate_codebuild_source, remove_null_values
)
from awslabs.aws_cicd_mcp_server.core.common.role_utils import get_or_create_role, list_policy_options
from pydantic import Field
from typing import Annotated, Dict, List, Optional, Any

@handle_exceptions
async def list_projects(
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION,
    max_items: Annotated[Optional[int], Field(description="Maximum items to return (default: 100)")] = None
) -> Dict[str, Any]:
    """
    List all CodeBuild projects in the specified region with pagination support.
    
    This tool provides a comprehensive list of CodeBuild projects with metadata
    including project status, creation date, and basic configuration details.
    
    Args:
        region: AWS region to list projects from
        max_items: Maximum number of projects to return (pagination support)
        
    Returns:
        Dictionary containing projects list, count, and metadata
        
    Example:
        List all CodeBuild projects: list_projects()
        List first 10 projects: list_projects(max_items=10)
    """
    logger.info(f"Listing CodeBuild projects in region: {region}")
    client = boto3.client('codebuild', region_name=region)
    
    # Get paginated results with metadata
    result = get_paginated_results(
        client, 'list_projects', 'projects', max_items=max_items
    )
    
    # Enhance with additional metadata if projects exist
    if result['projects']:
        try:
            # Get detailed info for first few projects to provide richer data
            sample_size = min(5, len(result['projects']))
            sample_projects = result['projects'][:sample_size]
            
            detailed_response = client.batch_get_projects(names=sample_projects)
            detailed_projects = detailed_response.get('projects', [])
            
            # Add summary statistics
            project_stats = {
                'total_projects': result['count'],
                'sample_details': []
            }
            
            for project in detailed_projects:
                project_stats['sample_details'].append({
                    'name': project.get('name'),
                    'created': project.get('created'),
                    'lastModified': project.get('lastModified'),
                    'source_type': project.get('source', {}).get('type'),
                    'environment_type': project.get('environment', {}).get('type')
                })
            
            result['project_statistics'] = project_stats
            
        except Exception as e:
            logger.warning(f"Could not fetch detailed project statistics: {e}")
    
    result['region'] = region
    logger.info(f"Found {result['count']} CodeBuild projects in {region}")
    
    return result

@handle_exceptions
async def get_project_details(
    project_name: Annotated[str, Field(description="Name of the CodeBuild project")],
    include_builds: Annotated[bool, Field(description="Include recent build history", default=False)] = False,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Get comprehensive information about a specific CodeBuild project.
    
    This tool provides detailed project configuration, environment settings,
    source configuration, and optionally recent build history.
    
    Args:
        project_name: Name of the CodeBuild project
        include_builds: Whether to include recent build history (last 10 builds)
        region: AWS region
        
    Returns:
        Dictionary containing detailed project information and optional build history
        
    Example:
        Get project details: get_project_details("my-project")
        Get project with builds: get_project_details("my-project", include_builds=True)
    """
    logger.info(f"Getting details for CodeBuild project: {project_name}")
    client = boto3.client('codebuild', region_name=region)
    
    # Get project details
    response = client.batch_get_projects(names=[project_name])
    projects = response.get('projects', [])
    
    if not projects:
        logger.warning(f"CodeBuild project not found: {project_name}")
        return {
            "error": f"Project '{project_name}' not found in region {region}",
            "error_type": "ResourceError",
            "suggestions": [
                "Verify the project name is correct",
                "Check if you're using the correct AWS region",
                "Ensure you have permissions to view CodeBuild projects"
            ]
        }
    
    project = projects[0]
    
    # Structure the response with organized information
    result = {
        "project_name": project_name,
        "region": region,
        "basic_info": {
            "name": project.get('name'),
            "arn": project.get('arn'),
            "description": project.get('description'),
            "created": project.get('created'),
            "last_modified": project.get('lastModified'),
            "service_role": project.get('serviceRole')
        },
        "source_configuration": {
            "type": project.get('source', {}).get('type'),
            "location": project.get('source', {}).get('location'),
            "git_clone_depth": project.get('source', {}).get('gitCloneDepth'),
            "buildspec": project.get('source', {}).get('buildspec'),
            "auth": project.get('source', {}).get('auth', {}).get('type') if project.get('source', {}).get('auth') else None
        },
        "environment": {
            "type": project.get('environment', {}).get('type'),
            "image": project.get('environment', {}).get('image'),
            "compute_type": project.get('environment', {}).get('computeType'),
            "privileged_mode": project.get('environment', {}).get('privilegedMode', False),
            "environment_variables": project.get('environment', {}).get('environmentVariables', [])
        },
        "artifacts": {
            "type": project.get('artifacts', {}).get('type'),
            "location": project.get('artifacts', {}).get('location'),
            "name": project.get('artifacts', {}).get('name'),
            "packaging": project.get('artifacts', {}).get('packaging')
        },
        "settings": {
            "timeout_in_minutes": project.get('timeoutInMinutes'),
            "queued_timeout_in_minutes": project.get('queuedTimeoutInMinutes'),
            "concurrent_build_limit": project.get('concurrentBuildLimit'),
            "badge_enabled": project.get('badge', {}).get('badgeEnabled', False) if project.get('badge') else False
        }
    }
    
    # Remove null values for cleaner output
    result = remove_null_values(result)
    
    # Include recent builds if requested
    if include_builds:
        try:
            logger.info(f"Fetching recent builds for project: {project_name}")
            builds_response = client.list_builds_for_project(
                projectName=project_name,
                sortOrder='DESCENDING'
            )
            
            build_ids = builds_response.get('ids', [])[:10]  # Last 10 builds
            
            if build_ids:
                builds_detail_response = client.batch_get_builds(ids=build_ids)
                builds = builds_detail_response.get('builds', [])
                
                result['recent_builds'] = []
                for build in builds:
                    result['recent_builds'].append({
                        'build_id': build.get('id'),
                        'build_status': build.get('buildStatus'),
                        'start_time': build.get('startTime'),
                        'end_time': build.get('endTime'),
                        'duration_minutes': _calculate_build_duration(build.get('startTime'), build.get('endTime')),
                        'source_version': build.get('sourceVersion'),
                        'initiator': build.get('initiator')
                    })
            else:
                result['recent_builds'] = []
                
        except Exception as e:
            logger.warning(f"Could not fetch build history for {project_name}: {e}")
            result['recent_builds_error'] = "Could not fetch build history"
    
    logger.info(f"Successfully retrieved details for CodeBuild project: {project_name}")
    return result


def _calculate_build_duration(start_time, end_time) -> Optional[float]:
    """Calculate build duration in minutes."""
    if not start_time or not end_time:
        return None
    try:
        if isinstance(start_time, datetime) and isinstance(end_time, datetime):
            duration = end_time - start_time
            return round(duration.total_seconds() / 60, 2)
    except Exception:
        pass
    return None

@handle_exceptions
@require_write_mode
async def start_build(
    project_name: Annotated[str, Field(description="Name of the CodeBuild project")],
    source_version: Annotated[Optional[str], Field(description="Source version/branch to build (e.g., 'main', commit SHA)")] = None,
    environment_variables: Annotated[Optional[List[Dict[str, str]]], Field(description="Environment variables for the build")] = None,
    buildspec_override: Annotated[Optional[str], Field(description="Buildspec override content")] = None,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Start a CodeBuild project build with comprehensive configuration options.
    
    This tool starts a new build for the specified CodeBuild project with optional
    overrides for source version, environment variables, and buildspec.
    
    Args:
        project_name: Name of the CodeBuild project
        source_version: Git branch, tag, or commit SHA to build
        environment_variables: List of environment variables [{"name": "KEY", "value": "VALUE"}]
        buildspec_override: Custom buildspec content to override project buildspec
        region: AWS region
        
    Returns:
        Dictionary containing build information and status
        
    Example:
        Start basic build: start_build("my-project")
        Start with branch: start_build("my-project", source_version="develop")
        Start with env vars: start_build("my-project", environment_variables=[{"name": "ENV", "value": "prod"}])
    """
    logger.info(f"Starting build for CodeBuild project: {project_name}")
    client = boto3.client('codebuild', region_name=region)
    
    # Validate project exists first
    try:
        project_response = client.batch_get_projects(names=[project_name])
        if not project_response.get('projects'):
            return {
                "error": f"CodeBuild project '{project_name}' not found in region {region}",
                "error_type": "ResourceError",
                "suggestions": [
                    "Verify the project name is correct",
                    "Check if you're using the correct AWS region",
                    "Ensure the project exists and you have access to it"
                ]
            }
    except Exception as e:
        logger.error(f"Error validating project {project_name}: {e}")
        return {
            "error": f"Failed to validate project: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Build the start_build parameters
    build_params = {"projectName": project_name}
    
    if source_version:
        build_params["sourceVersion"] = source_version
        logger.info(f"Using source version: {source_version}")
    
    if environment_variables:
        # Validate environment variables format
        for env_var in environment_variables:
            if not isinstance(env_var, dict) or 'name' not in env_var or 'value' not in env_var:
                return {
                    "error": "Environment variables must be in format [{'name': 'KEY', 'value': 'VALUE'}]",
                    "error_type": "ValidationError"
                }
        
        build_params["environmentVariablesOverride"] = [
            {
                "name": env_var["name"],
                "value": env_var["value"],
                "type": env_var.get("type", "PLAINTEXT")
            }
            for env_var in environment_variables
        ]
        logger.info(f"Using {len(environment_variables)} environment variable overrides")
    
    if buildspec_override:
        build_params["buildspecOverride"] = buildspec_override
        logger.info("Using buildspec override")
    
    try:
        # Start the build
        response = client.start_build(**build_params)
        build = response['build']
        
        result = {
            "build_id": build['id'],
            "project_name": project_name,
            "build_number": build.get('buildNumber'),
            "build_status": build['buildStatus'],
            "start_time": build.get('startTime'),
            "arn": build['arn'],
            "region": region,
            "source_version": build.get('sourceVersion'),
            "initiator": build.get('initiator'),
            "build_configuration": {
                "environment_variables_override": bool(environment_variables),
                "buildspec_override": bool(buildspec_override),
                "custom_source_version": bool(source_version)
            }
        }
        
        # Add logs information if available
        if build.get('logs'):
            result["logs_info"] = {
                "group_name": build['logs'].get('groupName'),
                "stream_name": build['logs'].get('streamName'),
                "deep_link": build['logs'].get('deepLink')
            }
        
        logger.info(f"Successfully started build {build['id']} for project {project_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to start build for project {project_name}: {e}")
        raise

@handle_exceptions
async def get_build_logs(
    build_id: Annotated[str, Field(description="CodeBuild build ID (format: project-name:build-uuid)")],
    max_log_events: Annotated[int, Field(description="Maximum number of log events to retrieve", default=1000)] = 1000,
    include_build_details: Annotated[bool, Field(description="Include build status and details", default=True)] = True,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Get comprehensive build logs and details for a specific CodeBuild build.
    
    This tool retrieves actual CloudWatch log content along with build status,
    timing information, and phase details for troubleshooting and monitoring.
    
    Args:
        build_id: CodeBuild build ID (e.g., "my-project:12345678-1234-1234-1234-123456789012")
        max_log_events: Maximum number of log events to retrieve (default: 1000)
        include_build_details: Whether to include detailed build information
        region: AWS region
        
    Returns:
        Dictionary containing build logs, status, and detailed information
        
    Example:
        Get build logs: get_build_logs("my-project:12345678-1234-1234-1234-123456789012")
        Get limited logs: get_build_logs("my-project:12345", max_log_events=500)
    """
    logger.info(f"Getting build logs for build: {build_id}")
    client = boto3.client('codebuild', region_name=region)
    
    # Get build details
    response = client.batch_get_builds(ids=[build_id])
    builds = response.get('builds', [])
    
    if not builds:
        logger.warning(f"Build not found: {build_id}")
        return {
            "error": f"Build '{build_id}' not found in region {region}",
            "error_type": "ResourceError",
            "suggestions": [
                "Verify the build ID format (project-name:build-uuid)",
                "Check if the build exists and you have access to it",
                "Ensure you're using the correct AWS region"
            ]
        }
    
    build = builds[0]
    logs_info = build.get('logs', {})
    
    result = {
        "build_id": build_id,
        "region": region,
        "logs_metadata": {
            "group_name": logs_info.get('groupName'),
            "stream_name": logs_info.get('streamName'),
            "deep_link": logs_info.get('deepLink'),
            "s3_logs": logs_info.get('s3Logs', {}) if logs_info.get('s3Logs') else None
        }
    }
    
    # Include build details if requested
    if include_build_details:
        result["build_details"] = {
            "project_name": build.get('projectName'),
            "build_number": build.get('buildNumber'),
            "build_status": build.get('buildStatus'),
            "start_time": build.get('startTime'),
            "end_time": build.get('endTime'),
            "duration_minutes": _calculate_build_duration(build.get('startTime'), build.get('endTime')),
            "source_version": build.get('sourceVersion'),
            "initiator": build.get('initiator'),
            "current_phase": build.get('currentPhase')
        }
        
        # Add phase details if available
        if build.get('phases'):
            result["build_details"]["phases"] = []
            for phase in build.get('phases', []):
                phase_info = {
                    "phase_type": phase.get('phaseType'),
                    "phase_status": phase.get('phaseStatus'),
                    "start_time": phase.get('startTime'),
                    "end_time": phase.get('endTime'),
                    "duration_seconds": phase.get('durationInSeconds')
                }
                
                # Add context information if available
                if phase.get('contexts'):
                    phase_info["contexts"] = [
                        {
                            "status_code": ctx.get('statusCode'),
                            "message": ctx.get('message')
                        }
                        for ctx in phase.get('contexts', [])
                    ]
                
                result["build_details"]["phases"].append(phase_info)
    
    # Try to fetch actual log content from CloudWatch
    log_content = []
    log_fetch_error = None
    
    if logs_info.get('groupName') and logs_info.get('streamName'):
        try:
            logger.info(f"Fetching CloudWatch logs from {logs_info['groupName']}/{logs_info['streamName']}")
            logs_client = boto3.client('logs', region_name=region)
            
            # Get log events with pagination support
            log_response = logs_client.get_log_events(
                logGroupName=logs_info['groupName'],
                logStreamName=logs_info['streamName'],
                limit=min(max_log_events, 10000),  # CloudWatch limit
                startFromHead=True
            )
            
            events = log_response.get('events', [])
            log_content = []
            
            for event in events:
                log_content.append({
                    "timestamp": event.get('timestamp'),
                    "message": event.get('message', '').rstrip(),
                    "ingestion_time": event.get('ingestionTime')
                })
            
            logger.info(f"Retrieved {len(log_content)} log events")
            
        except Exception as e:
            log_fetch_error = str(e)
            logger.warning(f"Could not fetch CloudWatch logs: {e}")
    else:
        log_fetch_error = "CloudWatch logs information not available"
    
    result["logs"] = {
        "events": log_content,
        "total_events": len(log_content),
        "fetch_error": log_fetch_error,
        "truncated": len(log_content) >= max_log_events
    }
    
    # Add log summary if we have content
    if log_content:
        # Extract error/warning messages
        error_messages = []
        warning_messages = []
        
        for event in log_content:
            message = event.get('message', '').lower()
            if 'error' in message or 'failed' in message or 'exception' in message:
                error_messages.append(event.get('message', ''))
            elif 'warning' in message or 'warn' in message:
                warning_messages.append(event.get('message', ''))
        
        result["logs"]["summary"] = {
            "has_errors": len(error_messages) > 0,
            "has_warnings": len(warning_messages) > 0,
            "error_count": len(error_messages),
            "warning_count": len(warning_messages),
            "first_error": error_messages[0] if error_messages else None,
            "first_warning": warning_messages[0] if warning_messages else None
        }
    
    logger.info(f"Successfully retrieved build logs for {build_id}")
    return result

@handle_exceptions
@require_write_mode
async def create_project(
    project_name: Annotated[str, Field(description="Name of the CodeBuild project (2-255 chars, alphanumeric and hyphens)")],
    source_location: Annotated[str, Field(description="Source location (GitHub URL, CodeCommit repo, or S3 path)")],
    source_type: Annotated[str, Field(description="Source type", default="GITHUB")] = "GITHUB",
    service_role: Annotated[Optional[str], Field(description="IAM service role ARN (auto-created if not provided)")] = None,
    description: Annotated[Optional[str], Field(description="Project description")] = None,
    compute_type: Annotated[str, Field(description="Build compute type", default="BUILD_GENERAL1_SMALL")] = "BUILD_GENERAL1_SMALL",
    environment_image: Annotated[str, Field(description="Build environment image", default="aws/codebuild/amazonlinux2-x86_64-standard:5.0")] = "aws/codebuild/amazonlinux2-x86_64-standard:5.0",
    privileged_mode: Annotated[bool, Field(description="Enable privileged mode for Docker builds", default=False)] = False,
    timeout_minutes: Annotated[int, Field(description="Build timeout in minutes", default=60)] = 60,
    auto_create_role: Annotated[bool, Field(description="Automatically create IAM service role", default=True)] = True,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Create a new CodeBuild project with comprehensive configuration and automatic IAM role management.
    
    This tool creates a CodeBuild project with validation, automatic role creation,
    and best practices configuration. It supports various source types and build environments.
    
    **IAM Role Management:**
    - If service_role is provided: Uses the specified role (validates existence)
    - If service_role is not provided and auto_create_role=True: Automatically creates a secure service role
    - Auto-created roles follow AWS security best practices with minimal required permissions
    - Clear notification is provided when roles are auto-created
    
    Args:
        project_name: Name for the new CodeBuild project
        source_location: Source repository URL or S3 path
        source_type: Type of source (GITHUB, CODECOMMIT, S3, BITBUCKET, etc.)
        service_role: IAM role ARN (created automatically if not provided)
        description: Optional project description
        compute_type: Build instance size (BUILD_GENERAL1_SMALL/MEDIUM/LARGE)
        environment_image: Docker image for build environment
        privileged_mode: Enable Docker daemon access
        timeout_minutes: Build timeout (5-480 minutes)
        auto_create_role: Whether to create IAM role automatically
        region: AWS region
        
    Returns:
        Dictionary containing project creation details and configuration
        
    Example:
        Create GitHub project: create_project("my-project", "https://github.com/user/repo.git")
        Create with custom role: create_project("my-project", "https://github.com/user/repo.git", service_role="arn:aws:iam::123456789012:role/MyRole")
    """
    logger.info(f"Creating CodeBuild project: {project_name}")
    
    # Validate project name
    if not validate_resource_name(project_name, 'codebuild_project'):
        return {
            "error": f"Invalid project name '{project_name}'. Must be 2-255 characters, alphanumeric and hyphens only.",
            "error_type": "ValidationError",
            "guidance": "Use only letters, numbers, and hyphens. Must start and end with alphanumeric character."
        }
    
    # Validate source configuration
    if not await validate_codebuild_source(source_type, source_location):
        return {
            "error": f"Invalid source configuration: {source_type} - {source_location}",
            "error_type": "ValidationError",
            "guidance": "Ensure source type matches the location format (e.g., GITHUB requires https://github.com/ URL)"
        }
    
    # Validate timeout
    if not (5 <= timeout_minutes <= 480):
        return {
            "error": f"Invalid timeout: {timeout_minutes}. Must be between 5 and 480 minutes.",
            "error_type": "ValidationError"
        }
    
    client = boto3.client('codebuild', region_name=region)
    
    # Handle IAM role - create if needed
    role_auto_created = False
    if not service_role and auto_create_role:
        try:
            logger.info(f"Auto-creating IAM role for project: {project_name}")
            role_name = f"CodeBuildServiceRole-{project_name}"
            service_role = await get_or_create_role(
                role_name=role_name,
                service='codebuild',
                policy_type='default',
                region=region
            )
            role_auto_created = True
            logger.info(f"Created/retrieved IAM role: {service_role}")
        except Exception as e:
            return {
                "error": f"Failed to create IAM service role: {str(e)}",
                "error_type": "IAMError",
                "guidance": "Ensure you have IAM permissions to create roles, or provide an existing service_role ARN"
            }
    elif service_role:
        # Validate provided role
        if not await validate_iam_role(service_role, region):
            return {
                "error": f"IAM role '{service_role}' not found or not accessible",
                "error_type": "ValidationError",
                "guidance": "Verify the role ARN is correct and you have permission to use it"
            }
    else:
        return {
            "error": "Either provide service_role ARN or enable auto_create_role",
            "error_type": "ValidationError"
        }
    
    # Build project configuration
    project_config = {
        "name": project_name,
        "source": {
            "type": source_type,
            "location": source_location
        },
        "artifacts": {
            "type": "NO_ARTIFACTS"
        },
        "environment": {
            "type": "LINUX_CONTAINER",
            "image": environment_image,
            "computeType": compute_type,
            "privilegedMode": privileged_mode
        },
        "serviceRole": service_role,
        "timeoutInMinutes": timeout_minutes
    }
    
    # Add optional description
    if description:
        project_config["description"] = description
    
    # Add tags for better resource management
    project_config["tags"] = [
        {
            "key": "CreatedBy",
            "value": "AWS-CICD-MCP-Server"
        },
        {
            "key": "SourceType",
            "value": source_type
        },
        {
            "key": "Environment",
            "value": "CodeBuild"
        }
    ]
    
    try:
        # Create the project
        logger.info(f"Creating CodeBuild project with configuration: {project_name}")
        response = client.create_project(**project_config)
        project = response['project']
        
        result = {
            "project_name": project_name,
            "status": "Created",
            "arn": project['arn'],
            "region": region,
            "configuration": {
                "source_type": source_type,
                "source_location": source_location,
                "service_role": service_role,
                "compute_type": compute_type,
                "environment_image": environment_image,
                "privileged_mode": privileged_mode,
                "timeout_minutes": timeout_minutes,
                "role_auto_created": role_auto_created,
                "role_arn": service_role
            },
            "created_date": project.get('created'),
            "webhook_url": project.get('webhook', {}).get('url') if project.get('webhook') else None
        }
        
        # Add role creation message if auto-created
        if role_auto_created:
            result["role_creation_notice"] = {
                "message": "IAM service role was automatically created since no custom role was provided",
                "role_name": f"CodeBuildServiceRole-{project_name}",
                "role_arn": service_role,
                "security_note": "Auto-created role follows AWS security best practices with minimal required permissions",
                "recommendation": "Review and customize the role permissions if needed for your specific use case"
            }
        
        logger.info(f"Successfully created CodeBuild project: {project_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to create CodeBuild project {project_name}: {e}")
        raise

@handle_exceptions
@require_write_mode
async def update_project(
    project_name: Annotated[str, Field(description="Name of the CodeBuild project to update")],
    service_role: Annotated[Optional[str], Field(description="New IAM service role ARN")] = None,
    description: Annotated[Optional[str], Field(description="New project description")] = None,
    source_location: Annotated[Optional[str], Field(description="New source location")] = None,
    compute_type: Annotated[Optional[str], Field(description="New compute type")] = None,
    environment_image: Annotated[Optional[str], Field(description="New environment image")] = None,
    privileged_mode: Annotated[Optional[bool], Field(description="Enable/disable privileged mode")] = None,
    timeout_minutes: Annotated[Optional[int], Field(description="New timeout in minutes")] = None,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Update an existing CodeBuild project configuration with validation.
    
    This tool updates various aspects of a CodeBuild project including IAM role,
    environment settings, source configuration, and build parameters.
    
    Args:
        project_name: Name of the CodeBuild project to update
        service_role: New IAM service role ARN
        description: New project description
        source_location: New source repository location
        compute_type: New build compute type
        environment_image: New Docker image for build environment
        privileged_mode: Enable/disable Docker daemon access
        timeout_minutes: New build timeout (5-480 minutes)
        region: AWS region
        
    Returns:
        Dictionary containing update results and changed configuration
        
    Example:
        Update role: update_project("my-project", service_role="arn:aws:iam::123456789012:role/NewRole")
        Update timeout: update_project("my-project", timeout_minutes=120)
        Update multiple: update_project("my-project", compute_type="BUILD_GENERAL1_MEDIUM", timeout_minutes=90)
    """
    logger.info(f"Updating CodeBuild project: {project_name}")
    client = boto3.client('codebuild', region_name=region)
    
    # First, get current project configuration
    try:
        current_response = client.batch_get_projects(names=[project_name])
        current_projects = current_response.get('projects', [])
        
        if not current_projects:
            return {
                "error": f"CodeBuild project '{project_name}' not found in region {region}",
                "error_type": "ResourceError",
                "suggestions": [
                    "Verify the project name is correct",
                    "Check if you're using the correct AWS region",
                    "Ensure the project exists and you have access to it"
                ]
            }
        
        current_project = current_projects[0]
        
    except Exception as e:
        logger.error(f"Error fetching current project configuration: {e}")
        return {
            "error": f"Failed to fetch current project configuration: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Build update parameters starting with current configuration
    update_params = {
        "name": project_name,
        "source": current_project.get('source', {}),
        "artifacts": current_project.get('artifacts', {}),
        "environment": current_project.get('environment', {}),
        "serviceRole": current_project.get('serviceRole'),
        "timeoutInMinutes": current_project.get('timeoutInMinutes', 60)
    }
    
    # Track what's being changed
    changes = []
    
    # Update service role if provided
    if service_role:
        if not await validate_iam_role(service_role, region):
            return {
                "error": f"IAM role '{service_role}' not found or not accessible",
                "error_type": "ValidationError",
                "guidance": "Verify the role ARN is correct and you have permission to use it"
            }
        update_params["serviceRole"] = service_role
        changes.append(f"Service role: {current_project.get('serviceRole')} → {service_role}")
    
    # Update description if provided
    if description is not None:
        update_params["description"] = description
        changes.append(f"Description updated")
    
    # Update source location if provided
    if source_location:
        source_type = update_params["source"].get("type", "GITHUB")
        if not await validate_codebuild_source(source_type, source_location):
            return {
                "error": f"Invalid source location for type {source_type}: {source_location}",
                "error_type": "ValidationError"
            }
        update_params["source"]["location"] = source_location
        changes.append(f"Source location: {current_project.get('source', {}).get('location')} → {source_location}")
    
    # Update compute type if provided
    if compute_type:
        valid_compute_types = [
            "BUILD_GENERAL1_SMALL", "BUILD_GENERAL1_MEDIUM", "BUILD_GENERAL1_LARGE",
            "BUILD_GENERAL1_2XLARGE"
        ]
        if compute_type not in valid_compute_types:
            return {
                "error": f"Invalid compute type: {compute_type}. Valid options: {valid_compute_types}",
                "error_type": "ValidationError"
            }
        update_params["environment"]["computeType"] = compute_type
        changes.append(f"Compute type: {current_project.get('environment', {}).get('computeType')} → {compute_type}")
    
    # Update environment image if provided
    if environment_image:
        update_params["environment"]["image"] = environment_image
        changes.append(f"Environment image: {current_project.get('environment', {}).get('image')} → {environment_image}")
    
    # Update privileged mode if provided
    if privileged_mode is not None:
        update_params["environment"]["privilegedMode"] = privileged_mode
        changes.append(f"Privileged mode: {current_project.get('environment', {}).get('privilegedMode', False)} → {privileged_mode}")
    
    # Update timeout if provided
    if timeout_minutes is not None:
        if not (5 <= timeout_minutes <= 480):
            return {
                "error": f"Invalid timeout: {timeout_minutes}. Must be between 5 and 480 minutes.",
                "error_type": "ValidationError"
            }
        update_params["timeoutInMinutes"] = timeout_minutes
        changes.append(f"Timeout: {current_project.get('timeoutInMinutes', 60)} → {timeout_minutes} minutes")
    
    # Check if any changes were requested
    if not changes:
        return {
            "project_name": project_name,
            "status": "No changes requested",
            "message": "No update parameters provided. Project configuration unchanged."
        }
    
    try:
        # Perform the update
        logger.info(f"Updating CodeBuild project {project_name} with changes: {changes}")
        response = client.update_project(**update_params)
        updated_project = response['project']
        
        result = {
            "project_name": project_name,
            "status": "Updated",
            "region": region,
            "changes_applied": changes,
            "updated_configuration": {
                "service_role": updated_project.get('serviceRole'),
                "description": updated_project.get('description'),
                "source_location": updated_project.get('source', {}).get('location'),
                "compute_type": updated_project.get('environment', {}).get('computeType'),
                "environment_image": updated_project.get('environment', {}).get('image'),
                "privileged_mode": updated_project.get('environment', {}).get('privilegedMode', False),
                "timeout_minutes": updated_project.get('timeoutInMinutes')
            },
            "last_modified": updated_project.get('lastModified')
        }
        
        logger.info(f"Successfully updated CodeBuild project: {project_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to update CodeBuild project {project_name}: {e}")
        raise

@handle_exceptions
@require_write_mode
async def delete_project(
    project_name: Annotated[str, Field(description="Name of the CodeBuild project to delete")],
    force_delete: Annotated[bool, Field(description="Force delete even if builds are running", default=False)] = False,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Delete a CodeBuild project with safety checks and confirmation.
    
    This tool safely deletes a CodeBuild project after performing validation
    and checking for running builds. Provides detailed information about the deletion.
    
    Args:
        project_name: Name of the CodeBuild project to delete
        force_delete: Force deletion even if builds are currently running
        region: AWS region
        
    Returns:
        Dictionary containing deletion results and project information
        
    Example:
        Delete project: delete_project("my-project")
        Force delete: delete_project("my-project", force_delete=True)
    """
    logger.info(f"Deleting CodeBuild project: {project_name}")
    client = boto3.client('codebuild', region_name=region)
    
    # First, verify the project exists and get its details
    try:
        project_response = client.batch_get_projects(names=[project_name])
        projects = project_response.get('projects', [])
        
        if not projects:
            return {
                "error": f"CodeBuild project '{project_name}' not found in region {region}",
                "error_type": "ResourceError",
                "suggestions": [
                    "Verify the project name is correct",
                    "Check if you're using the correct AWS region",
                    "The project may have already been deleted"
                ]
            }
        
        project = projects[0]
        
    except Exception as e:
        logger.error(f"Error verifying project {project_name}: {e}")
        return {
            "error": f"Failed to verify project: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Check for running builds unless force_delete is True
    running_builds = []
    if not force_delete:
        try:
            logger.info(f"Checking for running builds in project: {project_name}")
            builds_response = client.list_builds_for_project(
                projectName=project_name,
                sortOrder='DESCENDING'
            )
            
            if builds_response.get('ids'):
                # Get details for recent builds to check status
                recent_builds = builds_response['ids'][:10]  # Check last 10 builds
                builds_detail_response = client.batch_get_builds(ids=recent_builds)
                
                for build in builds_detail_response.get('builds', []):
                    if build.get('buildStatus') == 'IN_PROGRESS':
                        running_builds.append({
                            'build_id': build.get('id'),
                            'start_time': build.get('startTime'),
                            'current_phase': build.get('currentPhase')
                        })
            
        except Exception as e:
            logger.warning(f"Could not check for running builds: {e}")
    
    # If there are running builds and force_delete is False, warn the user
    if running_builds and not force_delete:
        return {
            "error": f"Cannot delete project '{project_name}' - {len(running_builds)} build(s) currently running",
            "error_type": "ResourceError",
            "running_builds": running_builds,
            "guidance": "Wait for builds to complete or use force_delete=True to delete anyway",
            "suggestions": [
                "Wait for running builds to complete",
                "Stop running builds manually first",
                "Use force_delete=True to delete regardless of running builds"
            ]
        }
    
    # Collect project information before deletion
    project_info = {
        "name": project.get('name'),
        "arn": project.get('arn'),
        "created": project.get('created'),
        "last_modified": project.get('lastModified'),
        "service_role": project.get('serviceRole'),
        "source_type": project.get('source', {}).get('type'),
        "source_location": project.get('source', {}).get('location'),
        "environment_image": project.get('environment', {}).get('image'),
        "compute_type": project.get('environment', {}).get('computeType')
    }
    
    try:
        # Perform the deletion
        logger.info(f"Deleting CodeBuild project: {project_name}")
        client.delete_project(name=project_name)
        
        result = {
            "project_name": project_name,
            "status": "Deleted",
            "region": region,
            "deletion_details": {
                "force_delete_used": force_delete,
                "running_builds_at_deletion": len(running_builds),
                "deleted_at": datetime.now().isoformat()
            },
            "deleted_project_info": project_info
        }
        
        # Add warning if builds were running
        if running_builds:
            result["warning"] = f"Project deleted with {len(running_builds)} running build(s). These builds may fail."
            result["affected_builds"] = running_builds
        
        logger.info(f"Successfully deleted CodeBuild project: {project_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to delete CodeBuild project {project_name}: {e}")
        raise
