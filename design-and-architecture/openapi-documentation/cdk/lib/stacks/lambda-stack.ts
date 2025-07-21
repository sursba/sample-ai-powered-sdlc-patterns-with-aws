import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface LambdaStackProps extends cdk.StackProps {
  domainAnalyzerBucket: s3.Bucket;
  bedrockAgentId: string;
  bedrockAgentAliasId: string;
  knowledgeBaseId: string;
  userPoolId?: string;
  userPoolClientId?: string;
  cognitoAuthenticatedRoleArn?: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly domainAnalyzerFunction: lambda.Function;
  public readonly docGeneratorFunction: lambda.Function;
  public readonly backendFunction: lambda.Function;
  public readonly backendFunctionUrl: string;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Create IAM role for domain analyzer Lambda function with least-privilege permissions
    const domainAnalyzerRole = new iam.Role(this, 'DomainAnalyzerLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for domain analyzer Lambda function with least-privilege Bedrock and S3 access'
    });

    // Add CloudWatch Logs permissions (minimum required for Lambda execution)
    domainAnalyzerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
      ]
    }));

    // Add specific Bedrock permissions for agent invocation with least privilege
    domainAnalyzerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeAgent',
        'bedrock:GetAgent',
        'bedrock:GetAgentAlias'
      ],
      resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:agent/${props.bedrockAgentId}`,
        `arn:aws:bedrock:${this.region}:${this.account}:agent-alias/${props.bedrockAgentId}/${props.bedrockAgentAliasId}`
      ]
    }));

    // Add separate policy for model invocation with specific model
    domainAnalyzerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [
        `arn:aws:bedrock:*:${this.account}:inference-profile/eu.anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-west-3::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-north-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`
      ]
    }));

    // Add S3 permissions for domain analyzer bucket with specific actions
    domainAnalyzerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket'
      ],
      resources: [
        props.domainAnalyzerBucket.bucketArn,
        `${props.domainAnalyzerBucket.bucketArn}/*`
      ]
    }));

    // Grant the Lambda role access to the S3 bucket
    props.domainAnalyzerBucket.grantReadWrite(domainAnalyzerRole);

    // Create domain analyzer Lambda function
    this.domainAnalyzerFunction = new lambda.Function(this, 'DomainAnalyzerFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'domain-analyzer.handler',
      code: lambda.Code.fromAsset('../domain-analyzer-lambda'),
      role: domainAnalyzerRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: props.domainAnalyzerBucket.bucketName,
        BEDROCK_REGION: this.region,
        MODEL_ID: 'eu.anthropic.claude-3-7-sonnet-20250219-v1:0',
        BEDROCK_AGENT_ID: props.bedrockAgentId,
        BEDROCK_AGENT_ALIAS_ID: props.bedrockAgentAliasId,
        AUTH_REQUIRED: 'false' // Disable authentication for internal calls
      },
      description: 'Lambda function for domain model analysis using Bedrock Claude 3.7 Sonnet'
    });

    // Export Lambda function ARN for application use
    new cdk.CfnOutput(this, 'DomainAnalyzerFunctionArn', {
      value: this.domainAnalyzerFunction.functionArn,
      description: 'ARN of the domain analyzer Lambda function',
      exportName: `${this.stackName}-DomainAnalyzerFunctionArn`
    });

    new cdk.CfnOutput(this, 'DomainAnalyzerFunctionName', {
      value: this.domainAnalyzerFunction.functionName,
      description: 'Name of the domain analyzer Lambda function',
      exportName: `${this.stackName}-DomainAnalyzerFunctionName`
    });

    // Create IAM role for doc generator Lambda function with least-privilege permissions
    const docGeneratorRole = new iam.Role(this, 'DocGeneratorLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for doc generator Lambda function with minimal Bedrock access'
    });

    // Add CloudWatch Logs permissions (minimum required for Lambda execution)
    docGeneratorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
      ]
    }));

    // Add minimal Bedrock permissions for model invocation only
    docGeneratorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [
        `arn:aws:bedrock:*:${this.account}:inference-profile/eu.anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-west-3::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-north-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`
      ]
    }));

    // Add S3 permissions for domain analyzer bucket
    docGeneratorRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket'
      ],
      resources: [
        props.domainAnalyzerBucket.bucketArn,
        `${props.domainAnalyzerBucket.bucketArn}/*`
      ]
    }));

    // Grant the Lambda role access to the S3 bucket
    props.domainAnalyzerBucket.grantReadWrite(docGeneratorRole);

    // Create doc generator Lambda function
    this.docGeneratorFunction = new lambda.Function(this, 'DocGeneratorFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'doc-gen.handler',
      code: lambda.Code.fromAsset('../doc-gen-lambda'),
      role: docGeneratorRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        BUCKET_NAME: props.domainAnalyzerBucket.bucketName,
        BEDROCK_REGION: this.region,
        MODEL_ID: 'eu.anthropic.claude-3-7-sonnet-20250219-v1:0',
        AUTH_REQUIRED: 'false' // Disable authentication for internal calls
      },
      description: 'Lambda function for API documentation generation using Bedrock Claude 3.7 Sonnet'
    });

    // Export doc generator Lambda function ARN for application use
    new cdk.CfnOutput(this, 'DocGeneratorFunctionArn', {
      value: this.docGeneratorFunction.functionArn,
      description: 'ARN of the doc generator Lambda function',
      exportName: `${this.stackName}-DocGeneratorFunctionArn`
    });

    new cdk.CfnOutput(this, 'DocGeneratorFunctionName', {
      value: this.docGeneratorFunction.functionName,
      description: 'Name of the doc generator Lambda function',
      exportName: `${this.stackName}-DocGeneratorFunctionName`
    });

    // Create IAM role for backend Lambda function with comprehensive permissions
    const backendRole = new iam.Role(this, 'BackendLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for backend Express Lambda function with S3, Bedrock, and Lambda invoke permissions'
    });

    // Add CloudWatch Logs permissions (minimum required for Lambda execution)
    backendRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
      ]
    }));

    // Add Bedrock permissions for agent and model invocation
    backendRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeAgent',
        'bedrock:GetAgent',
        'bedrock:GetAgentAlias',
        'bedrock:InvokeModel'
      ],
      resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:agent/${props.bedrockAgentId}`,
        `arn:aws:bedrock:${this.region}:${this.account}:agent-alias/${props.bedrockAgentId}/${props.bedrockAgentAliasId}`,
        `arn:aws:bedrock:*:${this.account}:inference-profile/eu.anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-west-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-west-3::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`,
        `arn:aws:bedrock:eu-north-1::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0`
      ]
    }));

    // Add S3 permissions for domain analyzer bucket
    backendRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket'
      ],
      resources: [
        props.domainAnalyzerBucket.bucketArn,
        `${props.domainAnalyzerBucket.bucketArn}/*`
      ]
    }));

    // Add Lambda invoke permissions for other functions
    backendRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction'
      ],
      resources: [
        this.domainAnalyzerFunction.functionArn,
        this.docGeneratorFunction.functionArn
      ]
    }));

    // Grant the Lambda role access to the S3 bucket
    props.domainAnalyzerBucket.grantReadWrite(backendRole);

    // Create backend Lambda function
    this.backendFunction = new lambda.Function(this, 'BackendFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'lambda-handler.handler',
      code: lambda.Code.fromAsset('../backend-lambda'),
      role: backendRole,
      timeout: cdk.Duration.minutes(15), // Maximum Lambda timeout
      memorySize: 512,
      environment: {
        NODE_ENV: 'production',
        BUCKET_NAME: props.domainAnalyzerBucket.bucketName,
        BEDROCK_REGION: this.region,
        MODEL_ID: 'eu.anthropic.claude-3-7-sonnet-20250219-v1:0',
        BEDROCK_AGENT_ID: props.bedrockAgentId,
        BEDROCK_AGENT_ALIAS_ID: props.bedrockAgentAliasId,
        DOMAIN_ANALYZER_FUNCTION_ARN: this.domainAnalyzerFunction.functionArn,
        DOC_GENERATOR_FUNCTION_ARN: this.docGeneratorFunction.functionArn,
        USER_POOL_ID: props.userPoolId || '',
        USER_POOL_CLIENT_ID: props.userPoolClientId || ''
      },
      description: 'Backend Express Lambda function for API endpoints with authentication'
    });

    // Create Lambda Function URL with IAM authentication for Cognito Identity Pool access
    const backendFunctionUrl = this.backendFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM, // Use IAM authentication with Cognito Identity Pool
      cors: {
        allowedOrigins: ['*'], // Allow all origins for development - restrict in production
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['*'],
        allowCredentials: false,
        maxAge: cdk.Duration.hours(1)
      }
    });

    // No additional permissions needed for NONE auth type
    // JWT authentication is handled internally by the Express middleware

    // Export backend Lambda function details
    new cdk.CfnOutput(this, 'BackendFunctionArn', {
      value: this.backendFunction.functionArn,
      description: 'ARN of the backend Lambda function',
      exportName: `${this.stackName}-BackendFunctionArn`
    });

    new cdk.CfnOutput(this, 'BackendFunctionName', {
      value: this.backendFunction.functionName,
      description: 'Name of the backend Lambda function',
      exportName: `${this.stackName}-BackendFunctionName`
    });

    new cdk.CfnOutput(this, 'BackendFunctionUrl', {
      value: backendFunctionUrl.url,
      description: 'Function URL of the backend Lambda function',
      exportName: `${this.stackName}-BackendFunctionUrl`
    });

    // Store the function URL for use in other stacks
    this.backendFunctionUrl = backendFunctionUrl.url;
  }
}