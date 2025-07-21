"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
class LambdaStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyxpREFBaUQ7QUFDakQsMkNBQTJDO0FBYzNDLE1BQWEsV0FBWSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBTXhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBdUI7UUFDL0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsdUZBQXVGO1FBQ3ZGLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSwwQkFBMEIsRUFBRTtZQUN4RSxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsV0FBVyxFQUFFLHlGQUF5RjtTQUN2RyxDQUFDLENBQUM7UUFFSCwwRUFBMEU7UUFDMUUsa0JBQWtCLENBQUMsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUNyRCxNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLHNCQUFzQjtnQkFDdEIsbUJBQW1CO2FBQ3BCO1lBQ0QsU0FBUyxFQUFFO2dCQUNULGdCQUFnQixJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLDBCQUEwQjthQUN0RTtTQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUosNkVBQTZFO1FBQzdFLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDckQsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1AscUJBQXFCO2dCQUNyQixrQkFBa0I7Z0JBQ2xCLHVCQUF1QjthQUN4QjtZQUNELFNBQVMsRUFBRTtn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UUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7YUFDOUI7U0FDRixDQUFDLENBQUM7UUFFSCxzREFBc0Q7UUFDdEQscUVBQXFFO1FBRXJFLHlDQUF5QztRQUN6QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVc7WUFDdkMsV0FBVyxFQUFFLG9DQUFvQztZQUNqRCxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxxQkFBcUI7U0FDbkQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3QyxLQUFLLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxZQUFZO1lBQ3hDLFdBQVcsRUFBRSxxQ0FBcUM7WUFDbEQsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsc0JBQXNCO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLGtCQUFrQixDQUFDLEdBQUc7WUFDN0IsV0FBVyxFQUFFLDZDQUE2QztZQUMxRCxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxxQkFBcUI7U0FDbkQsQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELElBQUksQ0FBQyxrQkFBa0IsR0FBRyxrQkFBa0IsQ0FBQyxHQUFHLENBQUM7SUFDbkQsQ0FBQztDQUNGO0FBOVRELGtDQThUQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGFtYmRhU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZG9tYWluQW5hbHl6ZXJCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgYmVkcm9ja0FnZW50SWQ6IHN0cmluZztcbiAgYmVkcm9ja0FnZW50QWxpYXNJZDogc3RyaW5nO1xuICBrbm93bGVkZ2VCYXNlSWQ6IHN0cmluZztcbiAgdXNlclBvb2xJZD86IHN0cmluZztcbiAgdXNlclBvb2xDbGllbnRJZD86IHN0cmluZztcbiAgY29nbml0b0F1dGhlbnRpY2F0ZWRSb2xlQXJuPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTGFtYmRhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZG9tYWluQW5hbHl6ZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZG9jR2VuZXJhdG9yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGJhY2tlbmRGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYmFja2VuZEZ1bmN0aW9uVXJsOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IExhbWJkYVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgZG9tYWluIGFuYWx5emVyIExhbWJkYSBmdW5jdGlvbiB3aXRoIGxlYXN0LXByaXZpbGVnZSBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGRvbWFpbkFuYWx5emVyUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnRG9tYWluQW5hbHl6ZXJMYW1iZGFSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0lBTSByb2xlIGZvciBkb21haW4gYW5hbHl6ZXIgTGFtYmRhIGZ1bmN0aW9uIHdpdGggbGVhc3QtcHJpdmlsZWdlIEJlZHJvY2sgYW5kIFMzIGFjY2VzcydcbiAgICB9KTtcblxuICAgIC8vIEFkZCBDbG91ZFdhdGNoIExvZ3MgcGVybWlzc2lvbnMgKG1pbmltdW0gcmVxdWlyZWQgZm9yIExhbWJkYSBleGVjdXRpb24pXG4gICAgZG9tYWluQW5hbHl6ZXJSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLFxuICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmxvZ3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmxvZy1ncm91cDovYXdzL2xhbWJkYS8qYFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEFkZCBzcGVjaWZpYyBCZWRyb2NrIHBlcm1pc3Npb25zIGZvciBhZ2VudCBpbnZvY2F0aW9uIHdpdGggbGVhc3QgcHJpdmlsZWdlXG4gICAgZG9tYWluQW5hbHl6ZXJSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlQWdlbnQnLFxuICAgICAgICAnYmVkcm9jazpHZXRBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrOkdldEFnZW50QWxpYXMnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmFnZW50LyR7cHJvcHMuYmVkcm9ja0FnZW50SWR9YCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06YWdlbnQtYWxpYXMvJHtwcm9wcy5iZWRyb2NrQWdlbnRJZH0vJHtwcm9wcy5iZWRyb2NrQWdlbnRBbGlhc0lkfWBcbiAgICAgIF1cbiAgICB9KSk7XG5cbiAgICAvLyBBZGQgc2VwYXJhdGUgcG9saWN5IGZvciBtb2RlbCBpbnZvY2F0aW9uIHdpdGggc3BlY2lmaWMgbW9kZWxcbiAgICBkb21haW5BbmFseXplclJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCdcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoqOiR7dGhpcy5hY2NvdW50fTppbmZlcmVuY2UtcHJvZmlsZS9ldS5hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MGAsXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6ZXUtY2VudHJhbC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOS12MTowYCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazpldS13ZXN0LTE6OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLTctc29ubmV0LTIwMjUwMjE5LXYxOjBgLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOmV1LXdlc3QtMzo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MGAsXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6ZXUtbm9ydGgtMTo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MGBcbiAgICAgIF1cbiAgICB9KSk7XG5cbiAgICAvLyBBZGQgUzMgcGVybWlzc2lvbnMgZm9yIGRvbWFpbiBhbmFseXplciBidWNrZXQgd2l0aCBzcGVjaWZpYyBhY3Rpb25zXG4gICAgZG9tYWluQW5hbHl6ZXJSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICdzMzpQdXRPYmplY3QnLFxuICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgJ3MzOkxpc3RCdWNrZXQnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHByb3BzLmRvbWFpbkFuYWx5emVyQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgYCR7cHJvcHMuZG9tYWluQW5hbHl6ZXJCdWNrZXQuYnVja2V0QXJufS8qYFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEdyYW50IHRoZSBMYW1iZGEgcm9sZSBhY2Nlc3MgdG8gdGhlIFMzIGJ1Y2tldFxuICAgIHByb3BzLmRvbWFpbkFuYWx5emVyQnVja2V0LmdyYW50UmVhZFdyaXRlKGRvbWFpbkFuYWx5emVyUm9sZSk7XG5cbiAgICAvLyBDcmVhdGUgZG9tYWluIGFuYWx5emVyIExhbWJkYSBmdW5jdGlvblxuICAgIHRoaXMuZG9tYWluQW5hbHl6ZXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0RvbWFpbkFuYWx5emVyRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdkb21haW4tYW5hbHl6ZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2RvbWFpbi1hbmFseXplci1sYW1iZGEnKSxcbiAgICAgIHJvbGU6IGRvbWFpbkFuYWx5emVyUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVF9OQU1FOiBwcm9wcy5kb21haW5BbmFseXplckJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBCRURST0NLX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIE1PREVMX0lEOiAnZXUuYW50aHJvcGljLmNsYXVkZS0zLTctc29ubmV0LTIwMjUwMjE5LXYxOjAnLFxuICAgICAgICBCRURST0NLX0FHRU5UX0lEOiBwcm9wcy5iZWRyb2NrQWdlbnRJZCxcbiAgICAgICAgQkVEUk9DS19BR0VOVF9BTElBU19JRDogcHJvcHMuYmVkcm9ja0FnZW50QWxpYXNJZCxcbiAgICAgICAgQVVUSF9SRVFVSVJFRDogJ2ZhbHNlJyAvLyBEaXNhYmxlIGF1dGhlbnRpY2F0aW9uIGZvciBpbnRlcm5hbCBjYWxsc1xuICAgICAgfSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIGZ1bmN0aW9uIGZvciBkb21haW4gbW9kZWwgYW5hbHlzaXMgdXNpbmcgQmVkcm9jayBDbGF1ZGUgMy43IFNvbm5ldCdcbiAgICB9KTtcblxuICAgIC8vIEV4cG9ydCBMYW1iZGEgZnVuY3Rpb24gQVJOIGZvciBhcHBsaWNhdGlvbiB1c2VcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRG9tYWluQW5hbHl6ZXJGdW5jdGlvbkFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvbWFpbkFuYWx5emVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0FSTiBvZiB0aGUgZG9tYWluIGFuYWx5emVyIExhbWJkYSBmdW5jdGlvbicsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tRG9tYWluQW5hbHl6ZXJGdW5jdGlvbkFybmBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb21haW5BbmFseXplckZ1bmN0aW9uTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvbWFpbkFuYWx5emVyRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdOYW1lIG9mIHRoZSBkb21haW4gYW5hbHl6ZXIgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb21haW5BbmFseXplckZ1bmN0aW9uTmFtZWBcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBJQU0gcm9sZSBmb3IgZG9jIGdlbmVyYXRvciBMYW1iZGEgZnVuY3Rpb24gd2l0aCBsZWFzdC1wcml2aWxlZ2UgcGVybWlzc2lvbnNcbiAgICBjb25zdCBkb2NHZW5lcmF0b3JSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdEb2NHZW5lcmF0b3JMYW1iZGFSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0lBTSByb2xlIGZvciBkb2MgZ2VuZXJhdG9yIExhbWJkYSBmdW5jdGlvbiB3aXRoIG1pbmltYWwgQmVkcm9jayBhY2Nlc3MnXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgQ2xvdWRXYXRjaCBMb2dzIHBlcm1pc3Npb25zIChtaW5pbXVtIHJlcXVpcmVkIGZvciBMYW1iZGEgZXhlY3V0aW9uKVxuICAgIGRvY0dlbmVyYXRvclJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhLypgXG4gICAgICBdXG4gICAgfSkpO1xuXG4gICAgLy8gQWRkIG1pbmltYWwgQmVkcm9jayBwZXJtaXNzaW9ucyBmb3IgbW9kZWwgaW52b2NhdGlvbiBvbmx5XG4gICAgZG9jR2VuZXJhdG9yUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6JHt0aGlzLmFjY291bnR9OmluZmVyZW5jZS1wcm9maWxlL2V1LmFudGhyb3BpYy5jbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOS12MTowYCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazpldS1jZW50cmFsLTE6OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLTctc29ubmV0LTIwMjUwMjE5LXYxOjBgLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOmV1LXdlc3QtMTo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MGAsXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6ZXUtd2VzdC0zOjpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOS12MTowYCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazpldS1ub3J0aC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOS12MTowYFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEFkZCBTMyBwZXJtaXNzaW9ucyBmb3IgZG9tYWluIGFuYWx5emVyIGJ1Y2tldFxuICAgIGRvY0dlbmVyYXRvclJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAnczM6TGlzdEJ1Y2tldCdcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgcHJvcHMuZG9tYWluQW5hbHl6ZXJCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICBgJHtwcm9wcy5kb21haW5BbmFseXplckJ1Y2tldC5idWNrZXRBcm59LypgXG4gICAgICBdXG4gICAgfSkpO1xuXG4gICAgLy8gR3JhbnQgdGhlIExhbWJkYSByb2xlIGFjY2VzcyB0byB0aGUgUzMgYnVja2V0XG4gICAgcHJvcHMuZG9tYWluQW5hbHl6ZXJCdWNrZXQuZ3JhbnRSZWFkV3JpdGUoZG9jR2VuZXJhdG9yUm9sZSk7XG5cbiAgICAvLyBDcmVhdGUgZG9jIGdlbmVyYXRvciBMYW1iZGEgZnVuY3Rpb25cbiAgICB0aGlzLmRvY0dlbmVyYXRvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRG9jR2VuZXJhdG9yRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdkb2MtZ2VuLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9kb2MtZ2VuLWxhbWJkYScpLFxuICAgICAgcm9sZTogZG9jR2VuZXJhdG9yUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVF9OQU1FOiBwcm9wcy5kb21haW5BbmFseXplckJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBCRURST0NLX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIE1PREVMX0lEOiAnZXUuYW50aHJvcGljLmNsYXVkZS0zLTctc29ubmV0LTIwMjUwMjE5LXYxOjAnLFxuICAgICAgICBBVVRIX1JFUVVJUkVEOiAnZmFsc2UnIC8vIERpc2FibGUgYXV0aGVudGljYXRpb24gZm9yIGludGVybmFsIGNhbGxzXG4gICAgICB9LFxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgZnVuY3Rpb24gZm9yIEFQSSBkb2N1bWVudGF0aW9uIGdlbmVyYXRpb24gdXNpbmcgQmVkcm9jayBDbGF1ZGUgMy43IFNvbm5ldCdcbiAgICB9KTtcblxuICAgIC8vIEV4cG9ydCBkb2MgZ2VuZXJhdG9yIExhbWJkYSBmdW5jdGlvbiBBUk4gZm9yIGFwcGxpY2F0aW9uIHVzZVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb2NHZW5lcmF0b3JGdW5jdGlvbkFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRvY0dlbmVyYXRvckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBUk4gb2YgdGhlIGRvYyBnZW5lcmF0b3IgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb2NHZW5lcmF0b3JGdW5jdGlvbkFybmBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEb2NHZW5lcmF0b3JGdW5jdGlvbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kb2NHZW5lcmF0b3JGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ05hbWUgb2YgdGhlIGRvYyBnZW5lcmF0b3IgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Eb2NHZW5lcmF0b3JGdW5jdGlvbk5hbWVgXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgSUFNIHJvbGUgZm9yIGJhY2tlbmQgTGFtYmRhIGZ1bmN0aW9uIHdpdGggY29tcHJlaGVuc2l2ZSBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGJhY2tlbmRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdCYWNrZW5kTGFtYmRhUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdJQU0gcm9sZSBmb3IgYmFja2VuZCBFeHByZXNzIExhbWJkYSBmdW5jdGlvbiB3aXRoIFMzLCBCZWRyb2NrLCBhbmQgTGFtYmRhIGludm9rZSBwZXJtaXNzaW9ucydcbiAgICB9KTtcblxuICAgIC8vIEFkZCBDbG91ZFdhdGNoIExvZ3MgcGVybWlzc2lvbnMgKG1pbmltdW0gcmVxdWlyZWQgZm9yIExhbWJkYSBleGVjdXRpb24pXG4gICAgYmFja2VuZFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhLypgXG4gICAgICBdXG4gICAgfSkpO1xuXG4gICAgLy8gQWRkIEJlZHJvY2sgcGVybWlzc2lvbnMgZm9yIGFnZW50IGFuZCBtb2RlbCBpbnZvY2F0aW9uXG4gICAgYmFja2VuZFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnYmVkcm9jazpJbnZva2VBZ2VudCcsXG4gICAgICAgICdiZWRyb2NrOkdldEFnZW50JyxcbiAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnRBbGlhcycsXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW1xuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTphZ2VudC8ke3Byb3BzLmJlZHJvY2tBZ2VudElkfWAsXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmFnZW50LWFsaWFzLyR7cHJvcHMuYmVkcm9ja0FnZW50SWR9LyR7cHJvcHMuYmVkcm9ja0FnZW50QWxpYXNJZH1gLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOio6JHt0aGlzLmFjY291bnR9OmluZmVyZW5jZS1wcm9maWxlL2V1LmFudGhyb3BpYy5jbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOS12MTowYCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazpldS1jZW50cmFsLTE6OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLTctc29ubmV0LTIwMjUwMjE5LXYxOjBgLFxuICAgICAgICBgYXJuOmF3czpiZWRyb2NrOmV1LXdlc3QtMTo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MGAsXG4gICAgICAgIGBhcm46YXdzOmJlZHJvY2s6ZXUtd2VzdC0zOjpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOS12MTowYCxcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazpldS1ub3J0aC0xOjpmb3VuZGF0aW9uLW1vZGVsL2FudGhyb3BpYy5jbGF1ZGUtMy03LXNvbm5ldC0yMDI1MDIxOS12MTowYFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEFkZCBTMyBwZXJtaXNzaW9ucyBmb3IgZG9tYWluIGFuYWx5emVyIGJ1Y2tldFxuICAgIGJhY2tlbmRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICdzMzpQdXRPYmplY3QnLFxuICAgICAgICAnczM6RGVsZXRlT2JqZWN0JyxcbiAgICAgICAgJ3MzOkxpc3RCdWNrZXQnXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHByb3BzLmRvbWFpbkFuYWx5emVyQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgYCR7cHJvcHMuZG9tYWluQW5hbHl6ZXJCdWNrZXQuYnVja2V0QXJufS8qYFxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEFkZCBMYW1iZGEgaW52b2tlIHBlcm1pc3Npb25zIGZvciBvdGhlciBmdW5jdGlvbnNcbiAgICBiYWNrZW5kUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHRoaXMuZG9tYWluQW5hbHl6ZXJGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgICAgdGhpcy5kb2NHZW5lcmF0b3JGdW5jdGlvbi5mdW5jdGlvbkFyblxuICAgICAgXVxuICAgIH0pKTtcblxuICAgIC8vIEdyYW50IHRoZSBMYW1iZGEgcm9sZSBhY2Nlc3MgdG8gdGhlIFMzIGJ1Y2tldFxuICAgIHByb3BzLmRvbWFpbkFuYWx5emVyQnVja2V0LmdyYW50UmVhZFdyaXRlKGJhY2tlbmRSb2xlKTtcblxuICAgIC8vIENyZWF0ZSBiYWNrZW5kIExhbWJkYSBmdW5jdGlvblxuICAgIHRoaXMuYmFja2VuZEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQmFja2VuZEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgICBoYW5kbGVyOiAnbGFtYmRhLWhhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQtbGFtYmRhJyksXG4gICAgICByb2xlOiBiYWNrZW5kUm9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSwgLy8gTWF4aW11bSBMYW1iZGEgdGltZW91dFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgTk9ERV9FTlY6ICdwcm9kdWN0aW9uJyxcbiAgICAgICAgQlVDS0VUX05BTUU6IHByb3BzLmRvbWFpbkFuYWx5emVyQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIEJFRFJPQ0tfUkVHSU9OOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgTU9ERUxfSUQ6ICdldS5hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MCcsXG4gICAgICAgIEJFRFJPQ0tfQUdFTlRfSUQ6IHByb3BzLmJlZHJvY2tBZ2VudElkLFxuICAgICAgICBCRURST0NLX0FHRU5UX0FMSUFTX0lEOiBwcm9wcy5iZWRyb2NrQWdlbnRBbGlhc0lkLFxuICAgICAgICBET01BSU5fQU5BTFlaRVJfRlVOQ1RJT05fQVJOOiB0aGlzLmRvbWFpbkFuYWx5emVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIERPQ19HRU5FUkFUT1JfRlVOQ1RJT05fQVJOOiB0aGlzLmRvY0dlbmVyYXRvckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgICBVU0VSX1BPT0xfSUQ6IHByb3BzLnVzZXJQb29sSWQgfHwgJycsXG4gICAgICAgIFVTRVJfUE9PTF9DTElFTlRfSUQ6IHByb3BzLnVzZXJQb29sQ2xpZW50SWQgfHwgJydcbiAgICAgIH0sXG4gICAgICBkZXNjcmlwdGlvbjogJ0JhY2tlbmQgRXhwcmVzcyBMYW1iZGEgZnVuY3Rpb24gZm9yIEFQSSBlbmRwb2ludHMgd2l0aCBhdXRoZW50aWNhdGlvbidcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBMYW1iZGEgRnVuY3Rpb24gVVJMIHdpdGggSUFNIGF1dGhlbnRpY2F0aW9uIGZvciBDb2duaXRvIElkZW50aXR5IFBvb2wgYWNjZXNzXG4gICAgY29uc3QgYmFja2VuZEZ1bmN0aW9uVXJsID0gdGhpcy5iYWNrZW5kRnVuY3Rpb24uYWRkRnVuY3Rpb25Vcmwoe1xuICAgICAgYXV0aFR5cGU6IGxhbWJkYS5GdW5jdGlvblVybEF1dGhUeXBlLkFXU19JQU0sIC8vIFVzZSBJQU0gYXV0aGVudGljYXRpb24gd2l0aCBDb2duaXRvIElkZW50aXR5IFBvb2xcbiAgICAgIGNvcnM6IHtcbiAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLCAvLyBBbGxvdyBhbGwgb3JpZ2lucyBmb3IgZGV2ZWxvcG1lbnQgLSByZXN0cmljdCBpbiBwcm9kdWN0aW9uXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbbGFtYmRhLkh0dHBNZXRob2QuQUxMXSxcbiAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiBmYWxzZSxcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uaG91cnMoMSlcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIE5vIGFkZGl0aW9uYWwgcGVybWlzc2lvbnMgbmVlZGVkIGZvciBOT05FIGF1dGggdHlwZVxuICAgIC8vIEpXVCBhdXRoZW50aWNhdGlvbiBpcyBoYW5kbGVkIGludGVybmFsbHkgYnkgdGhlIEV4cHJlc3MgbWlkZGxld2FyZVxuXG4gICAgLy8gRXhwb3J0IGJhY2tlbmQgTGFtYmRhIGZ1bmN0aW9uIGRldGFpbHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmFja2VuZEZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYmFja2VuZEZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBUk4gb2YgdGhlIGJhY2tlbmQgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CYWNrZW5kRnVuY3Rpb25Bcm5gXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmFja2VuZEZ1bmN0aW9uTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmJhY2tlbmRGdW5jdGlvbi5mdW5jdGlvbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ05hbWUgb2YgdGhlIGJhY2tlbmQgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CYWNrZW5kRnVuY3Rpb25OYW1lYFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0JhY2tlbmRGdW5jdGlvblVybCcsIHtcbiAgICAgIHZhbHVlOiBiYWNrZW5kRnVuY3Rpb25VcmwudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdGdW5jdGlvbiBVUkwgb2YgdGhlIGJhY2tlbmQgTGFtYmRhIGZ1bmN0aW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1CYWNrZW5kRnVuY3Rpb25VcmxgXG4gICAgfSk7XG5cbiAgICAvLyBTdG9yZSB0aGUgZnVuY3Rpb24gVVJMIGZvciB1c2UgaW4gb3RoZXIgc3RhY2tzXG4gICAgdGhpcy5iYWNrZW5kRnVuY3Rpb25VcmwgPSBiYWNrZW5kRnVuY3Rpb25VcmwudXJsO1xuICB9XG59Il19