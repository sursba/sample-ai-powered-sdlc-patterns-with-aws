"""AWS CI/CD MCP Server implementation with improved error handling."""

import sys
import os
from awslabs.aws_cicd_mcp_server.core.common.config import FASTMCP_LOG_LEVEL
from loguru import logger

# Configure logging
logger.remove()
logger.add(sys.stderr, level=FASTMCP_LOG_LEVEL)

def create_mcp_server():
    """Create MCP server with version compatibility handling."""
    try:
        from mcp.server.fastmcp import FastMCP
        
        # Create MCP server with minimal dependencies to avoid version conflicts
        mcp = FastMCP(
            'awslabs.aws-cicd-mcp-server',
            instructions='AWS CI/CD MCP Server provides comprehensive tools for managing AWS CodeBuild, CodeDeploy, and CodePipeline services.',
        )
        return mcp
    except Exception as e:
        logger.error(f"Failed to create FastMCP server: {e}")
        # Try alternative initialization
        try:
            from mcp.server import Server
            from mcp.server.stdio import stdio_server
            
            server = Server("awslabs.aws-cicd-mcp-server")
            return server
        except Exception as e2:
            logger.error(f"Failed to create alternative MCP server: {e2}")
            raise e

# Create MCP server
mcp = create_mcp_server()

def _register_tools():
    """Register tools with improved error handling."""
    try:
        logger.info("Starting tool registration...")
        
        # Import tools with error handling
        try:
            from awslabs.aws_cicd_mcp_server.core.codepipeline import tools as pipeline_tools
            logger.info("✓ CodePipeline tools imported")
        except ImportError as e:
            logger.error(f"Failed to import CodePipeline tools: {e}")
            return False
            
        try:
            from awslabs.aws_cicd_mcp_server.core.codebuild import tools as build_tools
            logger.info("✓ CodeBuild tools imported")
        except ImportError as e:
            logger.error(f"Failed to import CodeBuild tools: {e}")
            return False
            
        try:
            from awslabs.aws_cicd_mcp_server.core.codedeploy import tools as deploy_tools
            logger.info("✓ CodeDeploy tools imported")
        except ImportError as e:
            logger.error(f"Failed to import CodeDeploy tools: {e}")
            return False
        
        # Register tools with error handling
        tools_to_register = [
            # CodePipeline tools
            (pipeline_tools.list_pipelines, "list_pipelines"),
            (pipeline_tools.get_pipeline_details, "get_pipeline_details"),
            (pipeline_tools.start_pipeline_execution, "start_pipeline_execution"),
            (pipeline_tools.get_pipeline_execution_history, "get_pipeline_execution_history"),
            (pipeline_tools.create_pipeline, "create_pipeline"),
            (pipeline_tools.update_pipeline, "update_pipeline"),
            (pipeline_tools.delete_pipeline, "delete_pipeline"),
            
            # CodeBuild tools
            (build_tools.list_projects, "list_projects"),
            (build_tools.get_project_details, "get_project_details"),
            (build_tools.start_build, "start_build"),
            (build_tools.get_build_logs, "get_build_logs"),
            (build_tools.create_project, "create_project"),
            (build_tools.update_project, "update_project"),
            (build_tools.delete_project, "delete_project"),
            
            # CodeDeploy tools
            (deploy_tools.list_applications, "list_applications"),
            (deploy_tools.get_application_details, "get_application_details"),
            (deploy_tools.create_deployment, "create_deployment"),
            (deploy_tools.get_deployment_status, "get_deployment_status"),
            (deploy_tools.list_deployment_groups, "list_deployment_groups"),
            (deploy_tools.create_application, "create_application"),
            (deploy_tools.create_deployment_group, "create_deployment_group"),
            (deploy_tools.delete_application, "delete_application"),
        ]
        
        registered_count = 0
        for tool_func, tool_name in tools_to_register:
            try:
                if hasattr(mcp, 'tool'):
                    mcp.tool()(tool_func)
                else:
                    # Alternative registration method
                    mcp.register_tool(tool_name, tool_func)
                registered_count += 1
            except Exception as e:
                logger.warning(f"Failed to register tool {tool_name}: {e}")
        
        logger.info(f"Successfully registered {registered_count}/{len(tools_to_register)} CI/CD tools")
        return registered_count > 0
        
    except Exception as e:
        logger.error(f"Failed to register tools: {e}")
        return False

def main() -> None:
    """Run the MCP server with improved error handling."""
    try:
        logger.info("Starting AWS CI/CD MCP Server...")
        
        if not _register_tools():
            logger.error("Failed to register tools, exiting")
            sys.exit(1)
        
        logger.info("Tools registered successfully, starting server...")
        
        # Run server with error handling
        if hasattr(mcp, 'run'):
            mcp.run()
        else:
            # Alternative server run method
            import asyncio
            from mcp.server.stdio import stdio_server
            
            async def run_server():
                async with stdio_server() as (read_stream, write_stream):
                    await mcp.run(read_stream, write_stream, mcp.create_initialization_options())
            
            asyncio.run(run_server())
            
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server failed to start: {e}")
        logger.error(f"Error type: {type(e).__name__}")
        sys.exit(1)

if __name__ == '__main__':
    main()