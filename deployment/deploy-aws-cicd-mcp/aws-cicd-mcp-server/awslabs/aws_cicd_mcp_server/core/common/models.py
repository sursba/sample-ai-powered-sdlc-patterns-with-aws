"""Pydantic models for AWS CI/CD MCP Server."""

from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime

class PipelineExecution(BaseModel):
    """CodePipeline execution details."""
    pipeline_execution_id: str
    pipeline_name: str
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

class BuildDetails(BaseModel):
    """CodeBuild build details."""
    build_id: str
    project_name: str
    build_status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    logs_location: Optional[str] = None

class DeploymentInfo(BaseModel):
    """CodeDeploy deployment information."""
    deployment_id: str
    application_name: str
    deployment_group_name: str
    status: str
    create_time: Optional[datetime] = None
    complete_time: Optional[datetime] = None
