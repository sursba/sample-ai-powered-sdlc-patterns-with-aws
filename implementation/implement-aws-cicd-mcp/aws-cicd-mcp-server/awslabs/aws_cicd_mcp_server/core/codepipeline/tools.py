"""
CodePipeline tools for AWS CI/CD MCP Server with comprehensive functionality.

This module provides 7 tools for managing AWS CodePipeline pipelines:
1. list_pipelines - List all CodePipeline pipelines with pagination and status
2. get_pipeline_details - Get detailed pipeline configuration and current state
3. start_pipeline_execution - Start pipeline execution with comprehensive options
4. get_pipeline_execution_history - Detailed execution history with stage information
5. create_pipeline - Create pipeline with multi-stage support and validation
6. update_pipeline - Update pipeline configuration with change tracking
7. delete_pipeline - Delete pipeline with safety checks and confirmation
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
    get_paginated_results, validate_iam_role, validate_s3_bucket, 
    validate_resource_name, remove_null_values
)
from awslabs.aws_cicd_mcp_server.core.common.role_utils import get_or_create_role
from pydantic import Field
from typing import Annotated, Dict, List, Optional, Any

@handle_exceptions
async def list_pipelines(
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION,
    max_items: Annotated[Optional[int], Field(description="Maximum items to return (default: 100)")] = None,
    include_execution_status: Annotated[bool, Field(description="Include current execution status for each pipeline", default=False)] = False
) -> Dict[str, Any]:
    """
    List all CodePipeline pipelines in the specified region with pagination and optional execution status.
    
    This tool provides a comprehensive list of CodePipeline pipelines with metadata
    including creation date, version, and optionally current execution status.
    
    Args:
        region: AWS region to list pipelines from
        max_items: Maximum number of pipelines to return (pagination support)
        include_execution_status: Whether to include current execution status for each pipeline
        
    Returns:
        Dictionary containing pipelines list, count, and metadata
        
    Example:
        List all pipelines: list_pipelines()
        List with status: list_pipelines(include_execution_status=True)
        List first 10: list_pipelines(max_items=10)
    """
    logger.info(f"Listing CodePipeline pipelines in region: {region}")
    client = boto3.client('codepipeline', region_name=region)
    
    # Get paginated results with metadata
    result = get_paginated_results(
        client, 'list_pipelines', 'pipelines', max_items=max_items
    )
    
    # Process pipeline data
    pipeline_summaries = []
    for pipeline in result['pipelines']:
        pipeline_summary = {
            'name': pipeline.get('name'),
            'version': pipeline.get('version'),
            'created': pipeline.get('created'),
            'updated': pipeline.get('updated')
        }
        
        # Include execution status if requested
        if include_execution_status:
            try:
                state_response = client.get_pipeline_state(name=pipeline['name'])
                pipeline_summary['current_status'] = {
                    'pipeline_version': state_response.get('pipelineVersion'),
                    'stage_states': []
                }
                
                # Get summary of stage states
                for stage_state in state_response.get('stageStates', []):
                    stage_summary = {
                        'stage_name': stage_state.get('stageName'),
                        'latest_execution': stage_state.get('latestExecution', {}).get('status') if stage_state.get('latestExecution') else None
                    }
                    pipeline_summary['current_status']['stage_states'].append(stage_summary)
                    
            except Exception as e:
                logger.warning(f"Could not fetch execution status for pipeline {pipeline['name']}: {e}")
                pipeline_summary['current_status'] = 'Unable to fetch status'
        
        pipeline_summaries.append(remove_null_values(pipeline_summary))
    
    # Update result with processed data
    result['pipelines'] = pipeline_summaries
    result['region'] = region
    
    # Add pipeline statistics
    if pipeline_summaries:
        result['pipeline_statistics'] = {
            'total_pipelines': result['count'],
            'with_execution_status': include_execution_status,
            'oldest_pipeline': min(p.get('created') for p in pipeline_summaries if p.get('created')),
            'newest_pipeline': max(p.get('created') for p in pipeline_summaries if p.get('created'))
        }
    
    logger.info(f"Found {result['count']} CodePipeline pipelines in {region}")
    return result

@handle_exceptions
async def get_pipeline_details(
    pipeline_name: Annotated[str, Field(description="Name of the CodePipeline pipeline")],
    include_execution_history: Annotated[bool, Field(description="Include recent execution history", default=False)] = False,
    include_stage_details: Annotated[bool, Field(description="Include detailed stage and action information", default=True)] = True,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Get comprehensive information about a specific CodePipeline pipeline.
    
    This tool provides detailed pipeline configuration, current state, stage information,
    and optionally recent execution history.
    
    Args:
        pipeline_name: Name of the CodePipeline pipeline
        include_execution_history: Whether to include recent execution history (last 10 executions)
        include_stage_details: Whether to include detailed stage and action configuration
        region: AWS region
        
    Returns:
        Dictionary containing detailed pipeline information and current state
        
    Example:
        Get basic details: get_pipeline_details("my-pipeline")
        Get full details: get_pipeline_details("my-pipeline", include_execution_history=True)
    """
    logger.info(f"Getting details for CodePipeline pipeline: {pipeline_name}")
    client = boto3.client('codepipeline', region_name=region)
    
    try:
        # Get pipeline configuration
        pipeline_response = client.get_pipeline(name=pipeline_name)
        pipeline = pipeline_response.get('pipeline', {})
        
        if not pipeline:
            logger.warning(f"CodePipeline pipeline not found: {pipeline_name}")
            return {
                "error": f"Pipeline '{pipeline_name}' not found in region {region}",
                "error_type": "ResourceError",
                "suggestions": [
                    "Verify the pipeline name is correct",
                    "Check if you're using the correct AWS region",
                    "Ensure you have permissions to view CodePipeline pipelines"
                ]
            }
        
        # Get current pipeline state
        state_response = client.get_pipeline_state(name=pipeline_name)
        
    except Exception as e:
        logger.error(f"Error fetching pipeline details for {pipeline_name}: {e}")
        raise
    
    # Structure the response with organized information
    result = {
        "pipeline_name": pipeline_name,
        "region": region,
        "basic_info": {
            "name": pipeline.get('name'),
            "version": pipeline.get('version'),
            "role_arn": pipeline.get('roleArn'),
            "created": pipeline_response.get('metadata', {}).get('created'),
            "updated": pipeline_response.get('metadata', {}).get('updated'),
            "pipeline_arn": pipeline_response.get('metadata', {}).get('pipelineArn')
        },
        "artifact_store": pipeline.get('artifactStore', {}),
        "current_state": {
            "pipeline_name": state_response.get('pipelineName'),
            "pipeline_version": state_response.get('pipelineVersion'),
            "created": state_response.get('created'),
            "updated": state_response.get('updated')
        }
    }
    
    # Include detailed stage information if requested
    if include_stage_details:
        result['stages'] = []
        
        # Process pipeline stages configuration
        for stage in pipeline.get('stages', []):
            stage_detail = {
                'stage_name': stage.get('name'),
                'actions': []
            }
            
            # Process actions in the stage
            for action in stage.get('actions', []):
                action_detail = {
                    'action_name': action.get('name'),
                    'action_type': action.get('actionTypeId', {}),
                    'configuration': action.get('configuration', {}),
                    'input_artifacts': action.get('inputArtifacts', []),
                    'output_artifacts': action.get('outputArtifacts', []),
                    'region': action.get('region'),
                    'namespace': action.get('namespace'),
                    'run_order': action.get('runOrder', 1)
                }
                stage_detail['actions'].append(remove_null_values(action_detail))
            
            result['stages'].append(stage_detail)
        
        # Process current stage states
        result['stage_states'] = []
        for stage_state in state_response.get('stageStates', []):
            stage_state_detail = {
                'stage_name': stage_state.get('stageName'),
                'latest_execution': stage_state.get('latestExecution'),
                'action_states': []
            }
            
            # Process action states
            for action_state in stage_state.get('actionStates', []):
                action_state_detail = {
                    'action_name': action_state.get('actionName'),
                    'current_revision': action_state.get('currentRevision'),
                    'latest_execution': action_state.get('latestExecution'),
                    'entity_url': action_state.get('entityUrl'),
                    'revision_url': action_state.get('revisionUrl')
                }
                stage_state_detail['action_states'].append(remove_null_values(action_state_detail))
            
            result['stage_states'].append(remove_null_values(stage_state_detail))
    
    # Include execution history if requested
    if include_execution_history:
        try:
            logger.info(f"Fetching execution history for pipeline: {pipeline_name}")
            executions_response = client.list_pipeline_executions(pipelineName=pipeline_name)
            
            execution_summaries = executions_response.get('pipelineExecutionSummaries', [])[:10]  # Last 10 executions
            
            result['execution_history'] = []
            for execution in execution_summaries:
                execution_detail = {
                    'pipeline_execution_id': execution.get('pipelineExecutionId'),
                    'status': execution.get('status'),
                    'start_time': execution.get('startTime'),
                    'last_update_time': execution.get('lastUpdateTime'),
                    'source_revisions': execution.get('sourceRevisions', []),
                    'trigger': execution.get('trigger', {}),
                    'stop_trigger': execution.get('stopTrigger', {}),
                    'execution_mode': execution.get('executionMode'),
                    'execution_type': execution.get('executionType')
                }
                result['execution_history'].append(remove_null_values(execution_detail))
                
        except Exception as e:
            logger.warning(f"Could not fetch execution history for {pipeline_name}: {e}")
            result['execution_history_error'] = "Could not fetch execution history"
    
    # Remove null values for cleaner output
    result = remove_null_values(result)
    
    logger.info(f"Successfully retrieved details for CodePipeline pipeline: {pipeline_name}")
    return result

@handle_exceptions
@require_write_mode
async def start_pipeline_execution(
    pipeline_name: Annotated[str, Field(description="Name of the CodePipeline pipeline to start")],
    client_request_token: Annotated[Optional[str], Field(description="Unique client request token for idempotency")] = None,
    source_revisions: Annotated[Optional[List[Dict[str, str]]], Field(description="Source revisions to override")] = None,
    variables: Annotated[Optional[List[Dict[str, str]]], Field(description="Pipeline variables to override")] = None,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Start execution of a CodePipeline pipeline with comprehensive configuration options.
    
    This tool starts a pipeline execution with optional source revision overrides,
    pipeline variables, and idempotency support.
    
    Args:
        pipeline_name: Name of the CodePipeline pipeline to start
        client_request_token: Unique token for idempotent execution requests
        source_revisions: List of source revisions to override [{"actionName": "Source", "revisionType": "COMMIT_ID", "revisionValue": "abc123"}]
        variables: List of pipeline variables [{"name": "ENVIRONMENT", "value": "production"}]
        region: AWS region
        
    Returns:
        Dictionary containing execution information and status
        
    Example:
        Start basic execution: start_pipeline_execution("my-pipeline")
        Start with overrides: start_pipeline_execution("my-pipeline", source_revisions=[{"actionName": "Source", "revisionType": "COMMIT_ID", "revisionValue": "abc123"}])
    """
    logger.info(f"Starting execution for CodePipeline pipeline: {pipeline_name}")
    client = boto3.client('codepipeline', region_name=region)
    
    # Validate pipeline exists first
    try:
        pipeline_response = client.get_pipeline(name=pipeline_name)
        if not pipeline_response.get('pipeline'):
            return {
                "error": f"CodePipeline pipeline '{pipeline_name}' not found in region {region}",
                "error_type": "ResourceError",
                "suggestions": [
                    "Verify the pipeline name is correct",
                    "Check if you're using the correct AWS region",
                    "Ensure the pipeline exists and you have access to it"
                ]
            }
    except Exception as e:
        logger.error(f"Error validating pipeline {pipeline_name}: {e}")
        return {
            "error": f"Failed to validate pipeline: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Build the start execution parameters
    execution_params = {"name": pipeline_name}
    
    if client_request_token:
        execution_params["clientRequestToken"] = client_request_token
        logger.info(f"Using client request token: {client_request_token}")
    
    if source_revisions:
        # Validate source revisions format
        for revision in source_revisions:
            required_fields = ['actionName', 'revisionType', 'revisionValue']
            if not all(field in revision for field in required_fields):
                return {
                    "error": "Source revisions must include 'actionName', 'revisionType', and 'revisionValue' fields",
                    "error_type": "ValidationError",
                    "guidance": "Use format: [{'actionName': 'Source', 'revisionType': 'COMMIT_ID', 'revisionValue': 'abc123'}]"
                }
        
        execution_params["sourceRevisions"] = source_revisions
        logger.info(f"Using {len(source_revisions)} source revision overrides")
    
    if variables:
        # Validate variables format
        for variable in variables:
            if not all(key in variable for key in ['name', 'value']):
                return {
                    "error": "Pipeline variables must include 'name' and 'value' fields",
                    "error_type": "ValidationError",
                    "guidance": "Use format: [{'name': 'ENVIRONMENT', 'value': 'production'}]"
                }
        
        execution_params["variables"] = variables
        logger.info(f"Using {len(variables)} pipeline variable overrides")
    
    try:
        # Start the pipeline execution
        response = client.start_pipeline_execution(**execution_params)
        
        result = {
            "pipeline_execution_id": response['pipelineExecutionId'],
            "pipeline_name": pipeline_name,
            "region": region,
            "status": "Started",
            "execution_configuration": {
                "client_request_token_used": bool(client_request_token),
                "source_revisions_override": bool(source_revisions),
                "variables_override": bool(variables),
                "source_revisions_count": len(source_revisions) if source_revisions else 0,
                "variables_count": len(variables) if variables else 0
            }
        }
        
        # Add override details if provided
        if source_revisions:
            result["source_revision_overrides"] = source_revisions
        
        if variables:
            result["variable_overrides"] = variables
        
        logger.info(f"Successfully started pipeline execution {response['pipelineExecutionId']} for {pipeline_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to start pipeline execution for {pipeline_name}: {e}")
        raise

@handle_exceptions
async def get_pipeline_execution_history(
    pipeline_name: Annotated[str, Field(description="Name of the CodePipeline pipeline")],
    max_items: Annotated[Optional[int], Field(description="Maximum items to return (default: 100)")] = None,
    include_stage_details: Annotated[bool, Field(description="Include detailed stage execution information", default=False)] = False,
    filter_status: Annotated[Optional[str], Field(description="Filter by execution status (InProgress, Stopped, Stopping, Succeeded, Superseded, Failed)")] = None,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Get comprehensive execution history for a CodePipeline pipeline with detailed stage information.
    
    This tool provides detailed execution history including stage-level details,
    timing information, and execution statistics.
    
    Args:
        pipeline_name: Name of the CodePipeline pipeline
        max_items: Maximum number of executions to return (pagination support)
        include_stage_details: Whether to include detailed stage execution information
        filter_status: Filter executions by status
        region: AWS region
        
    Returns:
        Dictionary containing execution history with detailed information
        
    Example:
        Get basic history: get_pipeline_execution_history("my-pipeline")
        Get detailed history: get_pipeline_execution_history("my-pipeline", include_stage_details=True)
        Get failed executions: get_pipeline_execution_history("my-pipeline", filter_status="Failed")
    """
    logger.info(f"Getting execution history for CodePipeline pipeline: {pipeline_name}")
    client = boto3.client('codepipeline', region_name=region)
    
    # Validate pipeline exists
    try:
        pipeline_response = client.get_pipeline(name=pipeline_name)
        if not pipeline_response.get('pipeline'):
            return {
                "error": f"CodePipeline pipeline '{pipeline_name}' not found in region {region}",
                "error_type": "ResourceError"
            }
    except Exception as e:
        logger.error(f"Error validating pipeline {pipeline_name}: {e}")
        return {
            "error": f"Failed to validate pipeline: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Get paginated execution results
    result = get_paginated_results(
        client, 'list_pipeline_executions', 'pipelineExecutionSummaries',
        max_items=max_items, pipelineName=pipeline_name
    )
    
    # Process and enhance execution data
    enhanced_executions = []
    execution_statistics = {
        'total_executions': result['count'],
        'status_breakdown': {},
        'average_duration_minutes': None,
        'success_rate': 0
    }
    
    total_duration = 0
    duration_count = 0
    
    for execution in result['pipelineExecutionSummaries']:
        # Filter by status if specified
        if filter_status and execution.get('status') != filter_status:
            continue
        
        # Calculate execution duration
        start_time = execution.get('startTime')
        last_update_time = execution.get('lastUpdateTime')
        duration_minutes = None
        
        if start_time and last_update_time:
            if isinstance(start_time, datetime) and isinstance(last_update_time, datetime):
                duration = last_update_time - start_time
                duration_minutes = round(duration.total_seconds() / 60, 2)
                total_duration += duration_minutes
                duration_count += 1
        
        execution_detail = {
            'pipeline_execution_id': execution.get('pipelineExecutionId'),
            'status': execution.get('status'),
            'start_time': execution.get('startTime'),
            'last_update_time': execution.get('lastUpdateTime'),
            'duration_minutes': duration_minutes,
            'source_revisions': execution.get('sourceRevisions', []),
            'trigger': execution.get('trigger', {}),
            'stop_trigger': execution.get('stopTrigger', {}),
            'execution_mode': execution.get('executionMode'),
            'execution_type': execution.get('executionType'),
            'rollback_metadata': execution.get('rollbackMetadata', {})
        }
        
        # Include detailed stage information if requested
        if include_stage_details:
            try:
                stage_details_response = client.get_pipeline_execution(
                    pipelineName=pipeline_name,
                    pipelineExecutionId=execution['pipelineExecutionId']
                )
                
                execution_detail['pipeline_execution_details'] = {
                    'pipeline_name': stage_details_response.get('pipelineExecution', {}).get('pipelineName'),
                    'pipeline_version': stage_details_response.get('pipelineExecution', {}).get('pipelineVersion'),
                    'pipeline_execution_id': stage_details_response.get('pipelineExecution', {}).get('pipelineExecutionId'),
                    'status': stage_details_response.get('pipelineExecution', {}).get('status'),
                    'status_summary': stage_details_response.get('pipelineExecution', {}).get('statusSummary'),
                    'artifact_revisions': stage_details_response.get('pipelineExecution', {}).get('artifactRevisions', []),
                    'variables': stage_details_response.get('pipelineExecution', {}).get('variables', [])
                }
                
            except Exception as e:
                logger.warning(f"Could not fetch detailed stage information for execution {execution['pipelineExecutionId']}: {e}")
                execution_detail['stage_details_error'] = "Could not fetch stage details"
        
        # Update status breakdown
        status = execution.get('status', 'Unknown')
        execution_statistics['status_breakdown'][status] = execution_statistics['status_breakdown'].get(status, 0) + 1
        
        enhanced_executions.append(remove_null_values(execution_detail))
    
    # Calculate statistics
    if duration_count > 0:
        execution_statistics['average_duration_minutes'] = round(total_duration / duration_count, 2)
    
    succeeded_count = execution_statistics['status_breakdown'].get('Succeeded', 0)
    if result['count'] > 0:
        execution_statistics['success_rate'] = round((succeeded_count / result['count']) * 100, 2)
    
    # Apply status filter to results
    if filter_status:
        enhanced_executions = [e for e in enhanced_executions if e.get('status') == filter_status]
        result['count'] = len(enhanced_executions)
        result['filtered_by_status'] = filter_status
    
    # Update result with enhanced data
    result['pipeline_name'] = pipeline_name
    result['region'] = region
    result['executions'] = enhanced_executions
    result['execution_statistics'] = execution_statistics
    result['includes_stage_details'] = include_stage_details
    
    logger.info(f"Retrieved {result['count']} pipeline executions for {pipeline_name}")
    return result

@handle_exceptions
@require_write_mode
async def create_pipeline(
    pipeline_name: Annotated[str, Field(description="Name of the pipeline to create (1-100 chars)")],
    artifact_store_bucket: Annotated[str, Field(description="S3 bucket for pipeline artifacts")],
    source_location: Annotated[str, Field(description="Source repository name or URL")],
    source_provider: Annotated[str, Field(description="Source provider", default="CodeCommit")] = "CodeCommit",
    source_branch: Annotated[str, Field(description="Source branch", default="main")] = "main",
    role_arn: Annotated[Optional[str], Field(description="IAM role ARN (auto-created if not provided)")] = None,
    stages: Annotated[Optional[List[Dict[str, Any]]], Field(description="Custom pipeline stages configuration")] = None,
    auto_create_role: Annotated[bool, Field(description="Automatically create IAM service role", default=True)] = True,
    enable_build_stage: Annotated[bool, Field(description="Add a CodeBuild stage", default=False)] = False,
    build_project_name: Annotated[Optional[str], Field(description="CodeBuild project name for build stage")] = None,
    enable_deploy_stage: Annotated[bool, Field(description="Add a CodeDeploy stage", default=False)] = False,
    deploy_application_name: Annotated[Optional[str], Field(description="CodeDeploy application name")] = None,
    deploy_deployment_group: Annotated[Optional[str], Field(description="CodeDeploy deployment group name")] = None,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Create a new CodePipeline pipeline with comprehensive multi-stage support and validation.
    
    This tool creates a CodePipeline with automatic IAM role management, multiple source providers,
    and optional build and deploy stages.
    
    Args:
        pipeline_name: Name for the new pipeline (1-100 characters)
        artifact_store_bucket: S3 bucket for storing pipeline artifacts
        source_provider: Source provider (CodeCommit, GitHub, S3, ECR)
        source_location: Repository name, URL, or S3 location
        source_branch: Source branch or version
        role_arn: IAM service role ARN (created automatically if not provided)
        stages: Custom stages configuration (overrides default stages)
        auto_create_role: Whether to create IAM role automatically
        enable_build_stage: Add a CodeBuild stage after source
        build_project_name: CodeBuild project name for build stage
        enable_deploy_stage: Add a CodeDeploy stage after build
        deploy_application_name: CodeDeploy application name
        deploy_deployment_group: CodeDeploy deployment group name
        region: AWS region
        
    Returns:
        Dictionary containing pipeline creation details and configuration
        
    Example:
        Basic pipeline: create_pipeline("my-pipeline", "my-artifacts-bucket", source_location="my-repo")
        Full CI/CD: create_pipeline("my-pipeline", "my-artifacts-bucket", source_location="my-repo", enable_build_stage=True, build_project_name="my-build", enable_deploy_stage=True, deploy_application_name="my-app", deploy_deployment_group="production")
    """
    logger.info(f"Creating CodePipeline pipeline: {pipeline_name}")
    
    # Validate pipeline name
    if not validate_resource_name(pipeline_name, 'codepipeline'):
        return {
            "error": f"Invalid pipeline name '{pipeline_name}'. Must be 1-100 characters, alphanumeric and hyphens only.",
            "error_type": "ValidationError",
            "guidance": "Use only letters, numbers, and hyphens."
        }
    
    # Validate artifact store bucket
    if not await validate_s3_bucket(artifact_store_bucket, region):
        return {
            "error": f"S3 bucket '{artifact_store_bucket}' not found or not accessible",
            "error_type": "ValidationError",
            "guidance": "Ensure the S3 bucket exists and you have access to it"
        }
    
    client = boto3.client('codepipeline', region_name=region)
    
    # Handle IAM role - create if needed
    role_auto_created = False
    if not role_arn and auto_create_role:
        try:
            logger.info(f"Auto-creating IAM role for pipeline: {pipeline_name}")
            role_name = f"CodePipelineServiceRole-{pipeline_name}"
            role_arn = await get_or_create_role(
                role_name=role_name,
                service='codepipeline',
                policy_type='default',
                region=region
            )
            role_auto_created = True
            logger.info(f"Created/retrieved IAM role: {role_arn}")
        except Exception as e:
            return {
                "error": f"Failed to create IAM service role: {str(e)}",
                "error_type": "IAMError",
                "guidance": "Ensure you have IAM permissions to create roles, or provide an existing role_arn"
            }
    elif role_arn:
        # Validate provided role
        if not await validate_iam_role(role_arn, region):
            return {
                "error": f"IAM role '{role_arn}' not found or not accessible",
                "error_type": "ValidationError",
                "guidance": "Verify the role ARN is correct and you have permission to use it"
            }
    else:
        return {
            "error": "Either provide role_arn or enable auto_create_role",
            "error_type": "ValidationError"
        }
    
    # Build pipeline definition
    pipeline_definition = {
        "name": pipeline_name,
        "roleArn": role_arn,
        "artifactStore": {
            "type": "S3",
            "location": artifact_store_bucket
        }
    }
    
    # Use custom stages if provided, otherwise build default stages
    if stages:
        pipeline_definition["stages"] = stages
        logger.info(f"Using {len(stages)} custom stages")
    else:
        # Build default stages
        pipeline_stages = []
        
        # Source stage
        source_stage = _build_source_stage(source_provider, source_location, source_branch)
        if 'error' in source_stage:
            return source_stage
        pipeline_stages.append(source_stage)
        
        # Optional build stage
        if enable_build_stage:
            if not build_project_name:
                return {
                    "error": "build_project_name is required when enable_build_stage is True",
                    "error_type": "ValidationError"
                }
            
            build_stage = _build_codebuild_stage(build_project_name)
            pipeline_stages.append(build_stage)
        
        # Optional deploy stage
        if enable_deploy_stage:
            if not deploy_application_name or not deploy_deployment_group:
                return {
                    "error": "deploy_application_name and deploy_deployment_group are required when enable_deploy_stage is True",
                    "error_type": "ValidationError"
                }
            
            deploy_stage = _build_codedeploy_stage(deploy_application_name, deploy_deployment_group)
            pipeline_stages.append(deploy_stage)
        
        pipeline_definition["stages"] = pipeline_stages
    
    # Add tags
    pipeline_definition["tags"] = [
        {
            "key": "CreatedBy",
            "value": "AWS-CICD-MCP-Server"
        },
        {
            "key": "SourceProvider",
            "value": source_provider
        },
        {
            "key": "Environment",
            "value": "CodePipeline"
        }
    ]
    
    try:
        # Create the pipeline
        logger.info(f"Creating CodePipeline with {len(pipeline_definition['stages'])} stages")
        response = client.create_pipeline(pipeline=pipeline_definition)
        
        result = {
            "pipeline_name": pipeline_name,
            "status": "Created",
            "region": region,
            "configuration": {
                "role_arn": role_arn,
                "role_auto_created": role_auto_created,
                "artifact_store_bucket": artifact_store_bucket,
                "source_provider": source_provider,
                "source_location": source_location,
                "source_branch": source_branch,
                "stages_count": len(pipeline_definition['stages']),
                "has_build_stage": enable_build_stage,
                "has_deploy_stage": enable_deploy_stage,
                "custom_stages_used": bool(stages)
            },
            "pipeline_metadata": response.get('metadata', {}),
            "created_stages": [stage['name'] for stage in pipeline_definition['stages']]
        }
        
        # Add role creation message if auto-created
        if role_auto_created:
            result["role_creation_notice"] = {
                "message": "IAM service role was automatically created since no custom role was provided",
                "role_name": f"CodePipelineServiceRole-{pipeline_name}",
                "role_arn": role_arn,
                "security_note": "Auto-created role follows AWS security best practices with minimal required permissions",
                "recommendation": "Review and customize the role permissions if needed for your specific use case"
            }
        
        logger.info(f"Successfully created CodePipeline pipeline: {pipeline_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to create CodePipeline pipeline {pipeline_name}: {e}")
        raise


def _build_source_stage(provider: str, location: str, branch: str) -> Dict[str, Any]:
    """Build source stage configuration based on provider."""
    if provider == "CodeCommit":
        return {
            "name": "Source",
            "actions": [{
                "name": "SourceAction",
                "actionTypeId": {
                    "category": "Source",
                    "owner": "AWS",
                    "provider": "CodeCommit",
                    "version": "1"
                },
                "configuration": {
                    "RepositoryName": location,
                    "BranchName": branch
                },
                "outputArtifacts": [{"name": "SourceOutput"}]
            }]
        }
    elif provider == "GitHub":
        return {
            "name": "Source",
            "actions": [{
                "name": "SourceAction",
                "actionTypeId": {
                    "category": "Source",
                    "owner": "ThirdParty",
                    "provider": "GitHub",
                    "version": "1"
                },
                "configuration": {
                    "Owner": location.split('/')[0] if '/' in location else location,
                    "Repo": location.split('/')[1] if '/' in location else location,
                    "Branch": branch
                },
                "outputArtifacts": [{"name": "SourceOutput"}]
            }]
        }
    elif provider == "S3":
        return {
            "name": "Source",
            "actions": [{
                "name": "SourceAction",
                "actionTypeId": {
                    "category": "Source",
                    "owner": "AWS",
                    "provider": "S3",
                    "version": "1"
                },
                "configuration": {
                    "S3Bucket": location.split('/')[0] if '/' in location else location,
                    "S3ObjectKey": '/'.join(location.split('/')[1:]) if '/' in location else branch
                },
                "outputArtifacts": [{"name": "SourceOutput"}]
            }]
        }
    else:
        return {
            "error": f"Unsupported source provider: {provider}. Supported providers: CodeCommit, GitHub, S3",
            "error_type": "ValidationError"
        }


def _build_codebuild_stage(project_name: str) -> Dict[str, Any]:
    """Build CodeBuild stage configuration."""
    return {
        "name": "Build",
        "actions": [{
            "name": "BuildAction",
            "actionTypeId": {
                "category": "Build",
                "owner": "AWS",
                "provider": "CodeBuild",
                "version": "1"
            },
            "configuration": {
                "ProjectName": project_name
            },
            "inputArtifacts": [{"name": "SourceOutput"}],
            "outputArtifacts": [{"name": "BuildOutput"}]
        }]
    }


def _build_codedeploy_stage(application_name: str, deployment_group: str) -> Dict[str, Any]:
    """Build CodeDeploy stage configuration."""
    return {
        "name": "Deploy",
        "actions": [{
            "name": "DeployAction",
            "actionTypeId": {
                "category": "Deploy",
                "owner": "AWS",
                "provider": "CodeDeploy",
                "version": "1"
            },
            "configuration": {
                "ApplicationName": application_name,
                "DeploymentGroupName": deployment_group
            },
            "inputArtifacts": [{"name": "BuildOutput"}] if application_name else [{"name": "SourceOutput"}]
        }]
    }

@handle_exceptions
@require_write_mode
async def update_pipeline(
    pipeline_name: Annotated[str, Field(description="Name of the pipeline to update")],
    role_arn: Annotated[Optional[str], Field(description="New IAM role ARN for the pipeline")] = None,
    artifact_store_bucket: Annotated[Optional[str], Field(description="New S3 bucket for artifacts")] = None,
    stages: Annotated[Optional[List[Dict[str, Any]]], Field(description="New stages configuration")] = None,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Update an existing CodePipeline pipeline configuration with validation and change tracking.
    
    This tool updates various aspects of a CodePipeline including IAM role,
    artifact store, and stage configuration with comprehensive validation.
    
    Args:
        pipeline_name: Name of the pipeline to update
        role_arn: New IAM role ARN for the pipeline
        artifact_store_bucket: New S3 bucket for pipeline artifacts
        stages: New stages configuration (replaces all existing stages)
        region: AWS region
        
    Returns:
        Dictionary containing update results and changed configuration
        
    Example:
        Update role: update_pipeline("my-pipeline", role_arn="arn:aws:iam::123456789012:role/NewRole")
        Update bucket: update_pipeline("my-pipeline", artifact_store_bucket="new-artifacts-bucket")
        Update stages: update_pipeline("my-pipeline", stages=[...])
    """
    logger.info(f"Updating CodePipeline pipeline: {pipeline_name}")
    client = boto3.client('codepipeline', region_name=region)
    
    # First, get current pipeline configuration
    try:
        existing_response = client.get_pipeline(name=pipeline_name)
        existing_pipeline = existing_response.get('pipeline', {})
        
        if not existing_pipeline:
            return {
                "error": f"CodePipeline pipeline '{pipeline_name}' not found in region {region}",
                "error_type": "ResourceError",
                "suggestions": [
                    "Verify the pipeline name is correct",
                    "Check if you're using the correct AWS region",
                    "Ensure the pipeline exists and you have access to it"
                ]
            }
        
    except Exception as e:
        logger.error(f"Error fetching current pipeline configuration: {e}")
        return {
            "error": f"Failed to fetch current pipeline configuration: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Track what's being changed
    changes = []
    updated_pipeline = existing_pipeline.copy()
    
    # Update IAM role if provided
    if role_arn:
        if not await validate_iam_role(role_arn, region):
            return {
                "error": f"IAM role '{role_arn}' not found or not accessible",
                "error_type": "ValidationError",
                "guidance": "Verify the role ARN is correct and you have permission to use it"
            }
        
        old_role = existing_pipeline.get('roleArn')
        updated_pipeline['roleArn'] = role_arn
        changes.append(f"IAM role: {old_role} → {role_arn}")
    
    # Update artifact store bucket if provided
    if artifact_store_bucket:
        if not await validate_s3_bucket(artifact_store_bucket, region):
            return {
                "error": f"S3 bucket '{artifact_store_bucket}' not found or not accessible",
                "error_type": "ValidationError",
                "guidance": "Ensure the S3 bucket exists and you have access to it"
            }
        
        old_bucket = existing_pipeline.get('artifactStore', {}).get('location')
        if 'artifactStore' not in updated_pipeline:
            updated_pipeline['artifactStore'] = {"type": "S3"}
        updated_pipeline['artifactStore']['location'] = artifact_store_bucket
        changes.append(f"Artifact store bucket: {old_bucket} → {artifact_store_bucket}")
    
    # Update stages if provided
    if stages:
        old_stages = [stage.get('name') for stage in existing_pipeline.get('stages', [])]
        new_stages = [stage.get('name') for stage in stages]
        updated_pipeline['stages'] = stages
        changes.append(f"Stages: {old_stages} → {new_stages}")
    
    # Check if any changes were requested
    if not changes:
        return {
            "pipeline_name": pipeline_name,
            "status": "No changes requested",
            "message": "No update parameters provided. Pipeline configuration unchanged."
        }
    
    try:
        # Perform the update
        logger.info(f"Updating CodePipeline {pipeline_name} with changes: {changes}")
        response = client.update_pipeline(pipeline=updated_pipeline)
        
        result = {
            "pipeline_name": pipeline_name,
            "status": "Updated",
            "region": region,
            "changes_applied": changes,
            "updated_configuration": {
                "role_arn": updated_pipeline.get('roleArn'),
                "artifact_store_bucket": updated_pipeline.get('artifactStore', {}).get('location'),
                "stages_count": len(updated_pipeline.get('stages', [])),
                "stage_names": [stage.get('name') for stage in updated_pipeline.get('stages', [])]
            },
            "pipeline_metadata": response.get('metadata', {})
        }
        
        logger.info(f"Successfully updated CodePipeline pipeline: {pipeline_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to update CodePipeline pipeline {pipeline_name}: {e}")
        raise


@handle_exceptions
@require_write_mode
async def delete_pipeline(
    pipeline_name: Annotated[str, Field(description="Name of the pipeline to delete")],
    force_delete: Annotated[bool, Field(description="Force delete even if executions are running", default=False)] = False,
    region: Annotated[str, Field(description="AWS region", default=AWS_REGION)] = AWS_REGION
) -> Dict[str, Any]:
    """
    Delete a CodePipeline pipeline with safety checks and confirmation.
    
    This tool safely deletes a CodePipeline after performing validation
    and checking for running executions.
    
    Args:
        pipeline_name: Name of the pipeline to delete
        force_delete: Force deletion even if executions are currently running
        region: AWS region
        
    Returns:
        Dictionary containing deletion results and pipeline information
        
    Example:
        Delete pipeline: delete_pipeline("my-pipeline")
        Force delete: delete_pipeline("my-pipeline", force_delete=True)
    """
    logger.info(f"Deleting CodePipeline pipeline: {pipeline_name}")
    client = boto3.client('codepipeline', region_name=region)
    
    # First, verify the pipeline exists and get its details
    try:
        pipeline_response = client.get_pipeline(name=pipeline_name)
        pipeline = pipeline_response.get('pipeline', {})
        
        if not pipeline:
            return {
                "error": f"CodePipeline pipeline '{pipeline_name}' not found in region {region}",
                "error_type": "ResourceError",
                "suggestions": [
                    "Verify the pipeline name is correct",
                    "Check if you're using the correct AWS region",
                    "The pipeline may have already been deleted"
                ]
            }
        
    except Exception as e:
        logger.error(f"Error verifying pipeline {pipeline_name}: {e}")
        return {
            "error": f"Failed to verify pipeline: {str(e)}",
            "error_type": "ValidationError"
        }
    
    # Check for running executions unless force_delete is True
    running_executions = []
    if not force_delete:
        try:
            logger.info(f"Checking for running executions in pipeline: {pipeline_name}")
            executions_response = client.list_pipeline_executions(pipelineName=pipeline_name)
            
            # Check recent executions for running status
            for execution in executions_response.get('pipelineExecutionSummaries', [])[:5]:  # Check last 5 executions
                if execution.get('status') == 'InProgress':
                    running_executions.append({
                        'pipeline_execution_id': execution.get('pipelineExecutionId'),
                        'start_time': execution.get('startTime'),
                        'status': execution.get('status')
                    })
            
        except Exception as e:
            logger.warning(f"Could not check for running executions: {e}")
    
    # If there are running executions and force_delete is False, warn the user
    if running_executions and not force_delete:
        return {
            "error": f"Cannot delete pipeline '{pipeline_name}' - {len(running_executions)} execution(s) currently running",
            "error_type": "ResourceError",
            "running_executions": running_executions,
            "guidance": "Wait for executions to complete or use force_delete=True to delete anyway",
            "suggestions": [
                "Wait for running executions to complete",
                "Stop running executions manually first",
                "Use force_delete=True to delete regardless of running executions"
            ]
        }
    
    # Collect pipeline information before deletion
    pipeline_info = {
        "name": pipeline.get('name'),
        "version": pipeline.get('version'),
        "role_arn": pipeline.get('roleArn'),
        "artifact_store": pipeline.get('artifactStore', {}),
        "stages_count": len(pipeline.get('stages', [])),
        "stage_names": [stage.get('name') for stage in pipeline.get('stages', [])],
        "created": pipeline_response.get('metadata', {}).get('created'),
        "updated": pipeline_response.get('metadata', {}).get('updated')
    }
    
    try:
        # Perform the deletion
        logger.info(f"Deleting CodePipeline pipeline: {pipeline_name}")
        client.delete_pipeline(name=pipeline_name)
        
        result = {
            "pipeline_name": pipeline_name,
            "status": "Deleted",
            "region": region,
            "deletion_details": {
                "force_delete_used": force_delete,
                "running_executions_at_deletion": len(running_executions),
                "deleted_at": datetime.now().isoformat()
            },
            "deleted_pipeline_info": pipeline_info
        }
        
        # Add warning if executions were running
        if running_executions:
            result["warning"] = f"Pipeline deleted with {len(running_executions)} running execution(s). These executions may fail."
            result["affected_executions"] = running_executions
        
        logger.info(f"Successfully deleted CodePipeline pipeline: {pipeline_name}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to delete CodePipeline pipeline {pipeline_name}: {e}")
        raise


