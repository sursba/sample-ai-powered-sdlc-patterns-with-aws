# Deployment Guide

This guide provides instructions for deploying the UI/UX Generator application to AWS.

## AWS Deployment Options

### Option 1: AWS Elastic Beanstalk (Recommended for Beginners)

AWS Elastic Beanstalk provides the easiest way to deploy, manage, and scale the application.

#### Prerequisites

- AWS CLI installed and configured
- EB CLI installed (`pip install awsebcli`)

#### Steps

1. **Initialize Elastic Beanstalk**:
   ```bash
   cd ui-generator
   eb init -p python-3.8 ui-generator
   ```

2. **Create an environment**:
   ```bash
   eb create ui-generator-env
   ```

3. **Configure environment variables**:
   ```bash
   eb setenv FLASK_ENV=production AWS_REGION=us-east-1
   ```

4. **Deploy the application**:
   ```bash
   eb deploy
   ```

5. **Open the application**:
   ```bash
   eb open
   ```

### Option 2: AWS Lambda with API Gateway

This serverless approach is suitable for applications with variable traffic.

#### Prerequisites

- AWS CLI installed and configured
- AWS SAM CLI installed

#### Steps

1. **Create a SAM template** (`template.yaml`):
   ```yaml
   AWSTemplateFormatVersion: '2010-09-09'
   Transform: AWS::Serverless-2016-10-31
   Resources:
     UIGeneratorFunction:
       Type: AWS::Serverless::Function
       Properties:
         CodeUri: ./backend/
         Handler: lambda_handler.handler
         Runtime: python3.8
         Timeout: 30
         MemorySize: 1024
         Environment:
           Variables:
             FLASK_ENV: production
         Events:
           ApiEvent:
             Type: Api
             Properties:
               Path: /{proxy+}
               Method: ANY
   ```

2. **Create a Lambda handler** (`backend/lambda_handler.py`):
   ```python
   import awsgi
   from server import app

   def handler(event, context):
       return awsgi.response(app, event, context)
   ```

3. **Build and deploy**:
   ```bash
   sam build
   sam deploy --guided
   ```

### Option 3: Amazon ECS with Fargate

This approach is suitable for containerized applications.

#### Prerequisites

- Docker installed
- AWS CLI installed and configured

#### Steps

1. **Create a Dockerfile**:
   ```dockerfile
   FROM python:3.8-slim

   WORKDIR /app

   COPY backend/requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   COPY backend/ .
   COPY frontend/build/ ./static/

   ENV FLASK_ENV=production

   EXPOSE 8000

   CMD ["python", "server.py"]
   ```

2. **Build and push the Docker image**:
   ```bash
   aws ecr create-repository --repository-name ui-generator
   docker build -t ui-generator .
   docker tag ui-generator:latest <your-account-id>.dkr.ecr.<region>.amazonaws.com/ui-generator:latest
   aws ecr get-login-password | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.<region>.amazonaws.com
   docker push <your-account-id>.dkr.ecr.<region>.amazonaws.com/ui-generator:latest
   ```

3. **Create an ECS cluster, task definition, and service** using the AWS Console or AWS CLI.

## Frontend Deployment

### Option 1: Amazon S3 with CloudFront

This approach is suitable for static websites.

#### Steps

1. **Build the frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Create an S3 bucket**:
   ```bash
   aws s3 mb s3://ui-generator-frontend
   ```

3. **Configure the bucket for static website hosting**:
   ```bash
   aws s3 website s3://ui-generator-frontend --index-document index.html --error-document index.html
   ```

4. **Upload the build files**:
   ```bash
   aws s3 sync build/ s3://ui-generator-frontend
   ```

5. **Create a CloudFront distribution** for the S3 bucket using the AWS Console.

### Option 2: AWS Amplify

This approach provides a simplified deployment process with CI/CD.

#### Steps

1. **Install the Amplify CLI**:
   ```bash
   npm install -g @aws-amplify/cli
   ```

2. **Initialize Amplify**:
   ```bash
   amplify init
   ```

3. **Add hosting**:
   ```bash
   amplify add hosting
   ```

4. **Publish the frontend**:
   ```bash
   amplify publish
   ```

## Connecting Frontend to Backend

1. **Update the API URL** in the frontend environment file:
   ```
   REACT_APP_API_URL=https://your-api-endpoint.com/api
   ```

2. **Rebuild the frontend**:
   ```bash
   npm run build
   ```

3. **Deploy the updated frontend**.

## Setting Up a Custom Domain

1. **Register a domain** using Amazon Route 53 or another domain registrar.

2. **Create an SSL certificate** using AWS Certificate Manager.

3. **Configure your CloudFront distribution** or API Gateway to use the custom domain and SSL certificate.

4. **Update DNS settings** to point to your AWS resources.

## Monitoring and Logging

1. **Set up CloudWatch Alarms** for monitoring application performance.

2. **Configure CloudWatch Logs** for centralized logging.

3. **Set up X-Ray** for distributed tracing.

## Scaling Considerations

1. **Auto Scaling**: Configure auto-scaling for your ECS service or Elastic Beanstalk environment.

2. **Database Scaling**: If you add a database, consider using Amazon RDS with read replicas.

3. **Content Delivery**: Use CloudFront to cache and deliver content globally.

## Security Best Practices

1. **IAM Roles**: Use IAM roles with least privilege principle.

2. **Security Groups**: Restrict inbound and outbound traffic.

3. **Secrets Management**: Use AWS Secrets Manager for sensitive information.

4. **Regular Updates**: Keep dependencies and OS packages updated.

5. **WAF**: Consider using AWS WAF to protect against common web exploits.