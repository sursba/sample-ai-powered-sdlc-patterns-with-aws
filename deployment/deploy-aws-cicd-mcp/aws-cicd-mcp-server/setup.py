#!/usr/bin/env python3

from setuptools import setup, find_packages

setup(
    name="awslabs-aws-cicd-mcp-server",
    version="0.1.0",
    description="AWS CI/CD MCP Server for CodeBuild, CodeDeploy, and CodePipeline",
    author="AWS Labs",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "boto3>=1.34.0",
        "botocore>=1.34.0", 
        "fastmcp>=0.1.0",
        "pydantic>=2.0.0",
        "loguru>=0.7.0",
        "typing-extensions>=4.0.0"
    ],
    entry_points={
        "console_scripts": [
            "aws-cicd-mcp-server=awslabs.aws_cicd_mcp_server.server_fixed:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
)
