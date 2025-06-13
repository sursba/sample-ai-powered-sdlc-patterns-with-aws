
# SA Tool Function CDK Project
This CDK project deploys the SA Tool Function along with its dependent services:

1. **Lambda Function**: Containerized function that serves as the backend for the Bedrock agent
2. **ECR Repository**: Stores the Docker image for the Lambda function
3. **S3 Bucket**: Stores assets needed by the function
4. **Bedrock Agent**: AI agent that uses the Lambda function to answer Well-Architected Framework questions and generate code

## Prerequisites

- AWS CLI configured with appropriate permissions
- Docker installed and running
- Python 3.8 or later
- Node.js 14 or later (for CDK)
- npm install -g aws-cdk@latest

- Before moving to cdk setup; In the functions/drawing_function folder, run below commands: 
``` bash

        #chmod +x make_pil_layer.sh
        #chmod +x make_request_layer.sh
        #./make_pil_layer.sh
        #./make_request_layer.sh

```

## Setup

1. Create and activate a virtual environment:

```
$ python3 -m venv .venv
$ source .venv/bin/activate
```

2. Install dependencies:

```
$ pip install -r requirements.txt
```

3. Bootstrap your AWS environment (if not already done):

```
$ cdk bootstrap
```

## Deployment

To deploy the stack:

```
$ cdk deploy
```

This will:
- Build and push the Docker image to ECR
- Create the Lambda function
- Set up the S3 bucket
- Create the Bedrock agent with the OpenAPI schema

## Useful commands

 * `cdk ls`          list all stacks in the app
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk docs`        open CDK documentation

## Architecture

The architecture consists of:

1. A containerized Lambda function that implements the tool functionality
2. A Bedrock agent that uses the Lambda function as an action group
3. An S3 bucket for storing any necessary assets
4. An ECR repository for the Docker image

