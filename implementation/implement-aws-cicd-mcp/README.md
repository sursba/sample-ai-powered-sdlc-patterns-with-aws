# AWS CI/CD MCP Server

A comprehensive Model Context Protocol (MCP) server for AWS CI/CD services (CodePipeline, CodeBuild, CodeDeploy) with 22 specialized tools, automatic IAM management, and production-ready security features.


## Demo

![CICD MCP Server Demo](./demo-cicd-mcp-server.mp4)

## Features

- **22 Comprehensive CI/CD Tools**: 7+ tools each for CodePipeline, CodeBuild, and CodeDeploy
- **Security First**: Read-only mode by default with comprehensive validation
- **Automatic IAM Management**: Creates and manages service roles with AWS managed policies
- **Rich Data Retrieval**: CloudWatch logs, deployment details, and execution history
- **Pagination Support**: Efficient handling of large result sets
- **Advanced Features**: Source overrides, environment variables, multi-platform support
- **Robust Error Handling**: Detailed error messages with actionable guidance

## Prerequisites

- **Python 3.10+** installed
- **AWS CLI configured** with appropriate credentials
- **Required AWS permissions** for CI/CD services

## Quick Setup

### Option 1: Automated Installation (Recommended)

```bash
# Clone and install with automatic MCP configuration
git clone <repository-url>
cd aws-cicd-mcp-server
./install.sh
```

The install script will:
- Install the package and dependencies
- Verify installation works
- Check AWS credentials
- Automatically add MCP configuration to `~/.aws/amazonq/mcp.json`

### Option 2: Manual MCP Configuration

If you prefer to manually add the MCP server configuration, add this to your `~/.aws/amazonq/mcp.json`:

```json
{
  "mcpServers": {
    "aws-cicd-mcp-server": {
      "command": "python3",
      "args": [
        "-m",
        "awslabs.aws_cicd_mcp_server.server_fixed"
      ],
      "cwd": "/absolute/path/to/aws-cicd-mcp-server",
      "env": {
        "AWS_PROFILE": "default",
        "AWS_REGION": "us-west-2",      # change to your region
        "CICD_READ_ONLY_MODE": "false", # keep false for write operations
        "FASTMCP_LOG_LEVEL": "DEBUG",   # can be ERROR, INFO, DEBUG
        "PYTHONPATH": "/absolute/path/to/aws-cicd-mcp-server"
      },
      "autoApprove": [],
      "disabled": false
    }
  }
}
```

**Note**: Replace `/absolute/path/to/aws-cicd-mcp-server` with your actual path.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_PROFILE` | AWS credentials profile | default |
| `AWS_REGION` | AWS region | us-west-2 |
| `CICD_READ_ONLY_MODE` | Enable read-only mode | false |
| `FASTMCP_LOG_LEVEL` | Logging level (ERROR/INFO/DEBUG) | DEBUG |

## Available Tools

### CodeBuild (7 tools)
- `list_projects` - List all projects with pagination
- `get_project_details` - Get detailed project info with build history
- `start_build` - Start builds with environment overrides
- `get_build_logs` - Retrieve CloudWatch logs with error analysis
- `create_project` - Create projects with auto IAM role
- `update_project` - Update configuration with change tracking
- `delete_project` - Safe deletion with running build checks

### CodePipeline (7 tools)
- `list_pipelines` - List pipelines with execution status
- `get_pipeline_details` - Get configuration with stage details
- `start_pipeline_execution` - Start with source overrides
- `get_pipeline_execution_history` - Detailed execution history
- `create_pipeline` - Create multi-stage pipelines
- `update_pipeline` - Update configuration
- `delete_pipeline` - Safe deletion with execution checks

### CodeDeploy (8 tools)
- `list_applications` - List applications with platform details
- `get_application_details` - Get info with deployment groups
- `create_deployment` - Multi-revision deployments with rollback
- `get_deployment_status` - Detailed progress with instance details
- `list_deployment_groups` - Groups with configuration
- `create_application` - Multi-platform creation (EC2/Lambda/ECS)
- `create_deployment_group` - Advanced targeting with ASG/ALB
- `delete_application` - Safe deletion with dependency checks

## Verification

Test the server responds to MCP protocol:

```bash
python3 -m awslabs.aws_cicd_mcp_server.server_fixed
```

## Troubleshooting

### Installation Issues
```bash
# Reinstall dependencies
cd /path/to/aws-cicd-mcp-server
pip install -e .
```

### Server Won't Start
```bash
# Check logs with debug mode
FASTMCP_LOG_LEVEL=DEBUG python3 -m awslabs.aws_cicd_mcp_server.server_fixed
```

### AWS Credentials Issues
```bash
# Verify credentials
aws sts get-caller-identity

# Check region
aws configure get region
```

## Sample Usage Examples


### CodeBuild

- Use aws-cicd-mcp-server and List all CodeBuild projects in my AWS account
- Show me detailed information about the CodeBuild project named  "SampleProject”
- Create a new CodeBuild project called "test-project” with GitHub source from https://github.com/aws-samples/automated-devops-ai-toolkit
- Update the CodeBuild project "test-project"  to use BUILD_GENERAL1_MEDIUM compute type
- Delete the CodeBuild project named "test-project"
- Start a build for the CodeBuild project "test-project" using the main branch
- Get the build logs for build "test-project" 
   
### CodePipeline

- List all CodePipeline pipelines in my account
- Show me detailed configuration of the pipeline named "test-pipeline"
- Create a new CodePipeline called  "test-pipeline" with CodeCommit source from "test-sample-project-repo"
- Update the pipeline "test-pipeline" to use a different S3 bucket for artifacts
- Delete the CodePipeline named "test-pipeline"
- Start execution of the pipeline "test-pipeline"
- Show me the execution history for pipeline "my-pipeline"

### CodeDeploy

- List all CodeDeploy applications in my account
- Show me details of the CodeDeploy application "DevAppDeployment"
- Create a new CodeDeploy application called "DevAppDeployment” for EC2/On-premises
- Delete the CodeDeploy application "DevAppDeployment” 
- List all deployment groups for the application "DevAppDeployment"
- Create a deployment group "production" for application "DevAppDeployment” targeting EC2 instances with tag Environment=prod
- Create a deployment for application "DevAppDeployment” using deployment group "production" with S3 revision from bucket (create bucket first) and then assign the  key "app.zip"
- Check the status of deployment ID "d-KHXYMIF2F"

## Security Best Practices

1. **Use Read-Only Mode** for exploration and testing
2. **Create Minimal IAM Roles** with only required permissions
3. **Use AWS Managed Policies** when possible
4. **Regularly Rotate** AWS access keys
5. **Monitor CloudTrail** for CI/CD API activity

## Contributing

See the main repository [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
