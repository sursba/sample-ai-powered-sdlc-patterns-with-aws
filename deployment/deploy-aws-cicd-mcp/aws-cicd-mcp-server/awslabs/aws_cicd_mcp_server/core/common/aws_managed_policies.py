"""
AWS Managed Policies for CI/CD Services with comprehensive policy definitions and usage guidance.

This module provides a centralized definition of AWS managed policies for CodeBuild, CodeDeploy, 
and CodePipeline services, including custom policies where appropriate.
"""

from typing import Dict, List, Any, Optional

# Comprehensive AWS managed policies for CI/CD services
AWS_MANAGED_POLICIES = {
    "codebuild": {
        "policies": [
            {
                "name": "AWSCodeBuildAdminAccess",
                "arn": "arn:aws:iam::aws:policy/AWSCodeBuildAdminAccess",
                "description": "Provides full access to AWS CodeBuild via the AWS Management Console",
                "use_case": "For users who need complete administrative access to CodeBuild",
                "permissions": ["Full CodeBuild access", "CloudWatch Logs access", "S3 access for artifacts"]
            },
            {
                "name": "AWSCodeBuildReadOnlyAccess",
                "arn": "arn:aws:iam::aws:policy/AWSCodeBuildReadOnlyAccess",
                "description": "Provides read-only access to AWS CodeBuild",
                "use_case": "For users who need to view CodeBuild projects and builds without modification",
                "permissions": ["Read-only CodeBuild access", "CloudWatch Logs read access"]
            },
            {
                "name": "Custom-CodeBuildServiceRole",
                "arn": "custom",
                "description": "Custom policy with minimum required permissions for CodeBuild service role",
                "use_case": "Minimal permissions for CodeBuild projects (CloudWatch Logs, S3, ECR, CodeCommit)",
                "permissions": ["CloudWatch Logs", "S3 artifacts", "ECR access", "CodeCommit access"]
            }
        ],
        "default": "Custom-CodeBuildServiceRole",
        "service_principal": "codebuild.amazonaws.com"
    },
    "codepipeline": {
        "policies": [
            {
                "name": "AWSCodePipeline_FullAccess",
                "arn": "arn:aws:iam::aws:policy/AWSCodePipeline_FullAccess",
                "description": "Provides full access to AWS CodePipeline and related services",
                "use_case": "For users who need complete access to create and manage pipelines",
                "permissions": ["Full CodePipeline access", "S3 artifacts", "IAM pass role", "CloudWatch Events"]
            },
            {
                "name": "AWSCodePipeline_ReadOnlyAccess",
                "arn": "arn:aws:iam::aws:policy/AWSCodePipeline_ReadOnlyAccess",
                "description": "Provides read-only access to AWS CodePipeline",
                "use_case": "For users who need to view pipeline configurations and executions",
                "permissions": ["Read-only CodePipeline access", "CloudWatch Logs read access"]
            },
            {
                "name": "AWSCodePipelineServiceRole",
                "arn": "arn:aws:iam::aws:policy/service-role/AWSCodePipelineServiceRole",
                "description": "Service role policy for AWS CodePipeline",
                "use_case": "Standard service role for CodePipeline with necessary permissions",
                "permissions": ["Pipeline execution", "S3 artifacts", "CloudWatch Events", "SNS notifications"]
            }
        ],
        "default": "AWSCodePipelineServiceRole",
        "service_principal": "codepipeline.amazonaws.com"
    },
    "codedeploy": {
        "policies": [
            {
                "name": "AWSCodeDeployRole",
                "arn": "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole",
                "description": "Service role for AWS CodeDeploy for EC2/On-Premises deployments",
                "use_case": "Standard deployments to EC2 instances and on-premises servers",
                "permissions": ["EC2 instance management", "Auto Scaling", "ELB management", "SNS notifications"]
            },
            {
                "name": "AWSCodeDeployRoleForECS",
                "arn": "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRoleForECS",
                "description": "Service role for AWS CodeDeploy for Amazon ECS deployments",
                "use_case": "Blue/green deployments for ECS services",
                "permissions": ["ECS service management", "Application Load Balancer", "CloudWatch", "SNS"]
            },
            {
                "name": "AWSCodeDeployRoleForLambda",
                "arn": "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRoleForLambda",
                "description": "Service role for AWS CodeDeploy for AWS Lambda deployments",
                "use_case": "Gradual deployments for Lambda functions",
                "permissions": ["Lambda function management", "CloudWatch alarms", "SNS notifications"]
            },
            {
                "name": "AWSCodeDeployRoleForECSLimited",
                "arn": "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRoleForECSLimited",
                "description": "Limited service role for AWS CodeDeploy for Amazon ECS",
                "use_case": "Restricted ECS deployments with minimal permissions",
                "permissions": ["Limited ECS access", "CloudWatch read-only", "SNS notifications"]
            }
        ],
        "default": "AWSCodeDeployRole",
        "service_principal": "codedeploy.amazonaws.com"
    }
}

# Custom policy definitions for services that need minimal permissions
CODEBUILD_CUSTOM_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "CloudWatchLogsPolicy",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:GetLogEvents",
                "logs:GetLogStream"
            ],
            "Resource": [
                "arn:aws:logs:*:*:log-group:/aws/codebuild/*",
                "arn:aws:logs:*:*:log-group:/aws/codebuild/*:*"
            ]
        },
        {
            "Sid": "S3ArtifactsPolicy",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:PutObject",
                "s3:GetBucketAcl",
                "s3:GetBucketLocation",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::codepipeline-*",
                "arn:aws:s3:::codepipeline-*/*",
                "arn:aws:s3:::aws-codebuild-*",
                "arn:aws:s3:::aws-codebuild-*/*"
            ]
        },
        {
            "Sid": "ECRPolicy",
            "Effect": "Allow",
            "Action": [
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:GetAuthorizationToken"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CodeCommitPolicy",
            "Effect": "Allow",
            "Action": [
                "codecommit:GitPull",
                "codecommit:GetBranch",
                "codecommit:GetCommit",
                "codecommit:GetRepository",
                "codecommit:ListBranches",
                "codecommit:ListRepositories"
            ],
            "Resource": "*"
        },
        {
            "Sid": "ReportsPolicy",
            "Effect": "Allow",
            "Action": [
                "codebuild:CreateReportGroup",
                "codebuild:CreateReport",
                "codebuild:UpdateReport",
                "codebuild:BatchPutTestCases",
                "codebuild:BatchPutCodeCoverages"
            ],
            "Resource": [
                "arn:aws:codebuild:*:*:report-group/*"
            ]
        }
    ]
}

# Additional custom policies for other services if needed
CODEPIPELINE_CUSTOM_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3ArtifactStore",
            "Effect": "Allow",
            "Action": [
                "s3:GetBucketVersioning",
                "s3:GetObject",
                "s3:GetObjectVersion",
                "s3:PutObject",
                "s3:GetBucketLocation",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::codepipeline-*",
                "arn:aws:s3:::codepipeline-*/*"
            ]
        },
        {
            "Sid": "CodeBuildIntegration",
            "Effect": "Allow",
            "Action": [
                "codebuild:BatchGetBuilds",
                "codebuild:StartBuild"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CodeDeployIntegration",
            "Effect": "Allow",
            "Action": [
                "codedeploy:CreateDeployment",
                "codedeploy:GetApplication",
                "codedeploy:GetApplicationRevision",
                "codedeploy:GetDeployment",
                "codedeploy:GetDeploymentConfig",
                "codedeploy:RegisterApplicationRevision"
            ],
            "Resource": "*"
        }
    ]
}


def get_available_policies(service: str) -> List[Dict[str, Any]]:
    """
    Get available managed policies for a service.
    
    Args:
        service: AWS service name (codebuild, codepipeline, codedeploy)
        
    Returns:
        List of policy dictionaries with name, ARN, description, and metadata
    """
    return AWS_MANAGED_POLICIES.get(service, {}).get("policies", [])


def get_default_policy(service: str) -> str:
    """
    Get default policy name for a service.
    
    Args:
        service: AWS service name
        
    Returns:
        Default policy name for the service
    """
    return AWS_MANAGED_POLICIES.get(service, {}).get("default", "")


def get_service_principal(service: str) -> str:
    """
    Get the service principal for a given AWS service.
    
    Args:
        service: AWS service name
        
    Returns:
        Service principal (e.g., 'codebuild.amazonaws.com')
    """
    return AWS_MANAGED_POLICIES.get(service, {}).get("service_principal", f"{service}.amazonaws.com")


def get_policy_by_name(service: str, policy_name: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific policy by name for a service.
    
    Args:
        service: AWS service name
        policy_name: Name of the policy to retrieve
        
    Returns:
        Policy dictionary or None if not found
    """
    policies = get_available_policies(service)
    return next((p for p in policies if p["name"] == policy_name), None)


def get_custom_policy_document(service: str, policy_name: str) -> Optional[Dict[str, Any]]:
    """
    Get custom policy document for services that use inline policies.
    
    Args:
        service: AWS service name
        policy_name: Name of the custom policy
        
    Returns:
        Policy document dictionary or None if not found
    """
    custom_policies = {
        "codebuild": {
            "Custom-CodeBuildServiceRole": CODEBUILD_CUSTOM_POLICY
        },
        "codepipeline": {
            "Custom-CodePipelineServiceRole": CODEPIPELINE_CUSTOM_POLICY
        }
    }
    
    return custom_policies.get(service, {}).get(policy_name)


def list_all_policies() -> Dict[str, List[Dict[str, Any]]]:
    """
    List all available policies for all services.
    
    Returns:
        Dictionary mapping service names to their available policies
    """
    return {service: data["policies"] for service, data in AWS_MANAGED_POLICIES.items()}


def get_policy_recommendations(service: str, use_case: str = "standard") -> List[Dict[str, Any]]:
    """
    Get policy recommendations based on service and use case.
    
    Args:
        service: AWS service name
        use_case: Use case (standard, minimal, full_access, read_only)
        
    Returns:
        List of recommended policies
    """
    policies = get_available_policies(service)
    
    if use_case == "minimal":
        # Prefer custom policies with minimal permissions
        return [p for p in policies if "Custom" in p["name"] or "Limited" in p["name"]]
    elif use_case == "read_only":
        # Prefer read-only policies
        return [p for p in policies if "ReadOnly" in p["name"] or "ReadOnlyAccess" in p["name"]]
    elif use_case == "full_access":
        # Prefer full access policies
        return [p for p in policies if "FullAccess" in p["name"] or "AdminAccess" in p["name"]]
    else:
        # Standard use case - return default policy first
        default_policy_name = get_default_policy(service)
        default_policy = get_policy_by_name(service, default_policy_name)
        if default_policy:
            return [default_policy] + [p for p in policies if p["name"] != default_policy_name]
        return policies
