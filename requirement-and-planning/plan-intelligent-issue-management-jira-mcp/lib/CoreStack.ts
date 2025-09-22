import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';

interface CoreStackProps extends cdk.StackProps {
artifactsBucket: string;
promptsBucket: string;
issuesTableName: string;
peopleTableName: string;
configTableName: string;
auditTableName: string;
jiraSecretArn: string;
aossCollectionName: string;
aossCollectionArn: string;
}

export class CoreStack extends cdk.Stack {
readonly chatHandlerName: string;
constructor(scope: Construct, id: string, props: CoreStackProps) {
super(scope, id, props);

const chatHandler = new lambda.Function(this, 'ChatOrchestratorFn', {
runtime: lambda.Runtime.PYTHON_3_11,
handler: 'handler.lambda_handler',
code: lambda.Code.fromAsset('lambdas/orchestrator'),
timeout: cdk.Duration.seconds(10),
memorySize: 256,
tracing: lambda.Tracing.ACTIVE,
environment: {
ISSUES_TABLE: props.issuesTableName,
PEOPLE_TABLE: props.peopleTableName,
CONFIG_TABLE: props.configTableName,
AUDIT_TABLE: props.auditTableName,
ARTIFACTS_BUCKET: props.artifactsBucket,
PROMPTS_BUCKET: props.promptsBucket,
JIRA_SECRET_ARN: props.jiraSecretArn,
},
});
this.chatHandlerName = chatHandler.functionName;

// Jira MCP tool Lambda
const jiraTool = new lambda.Function(this, 'JiraToolFn', {
runtime: lambda.Runtime.PYTHON_3_11,
handler: 'handler.lambda_handler',
code: lambda.Code.fromAsset('lambdas/mcp/jira_tool'),
timeout: cdk.Duration.seconds(15),
memorySize: 256,
tracing: lambda.Tracing.ACTIVE,
environment: {
JIRA_SECRET_ARN: props.jiraSecretArn,
},
logRetention: logs.RetentionDays.ONE_WEEK,
});

// Allow it to read ONLY the Jira secret
jiraTool.addToRolePolicy(new iam.PolicyStatement({
actions: ['secretsmanager:GetSecretValue'],
resources: [props.jiraSecretArn],
}));

// Assignment MCP tool Lambda
const assignTool = new lambda.Function(this, 'AssignToolFn', {
runtime: lambda.Runtime.PYTHON_3_11,
handler: 'handler.lambda_handler',
code: lambda.Code.fromAsset('lambdas/mcp/assign_tool'),
timeout: cdk.Duration.seconds(15),
memorySize: 256,
tracing: lambda.Tracing.ACTIVE,
environment: {
PEOPLE_TABLE: props.peopleTableName,
CONFIG_TABLE: props.configTableName,
},
logRetention: logs.RetentionDays.ONE_WEEK,
});

// Allow it to read People and Config tables
assignTool.addToRolePolicy(new iam.PolicyStatement({
actions: ['dynamodb:GetItem', 'dynamodb:Scan'],
resources: [
`arn:aws:dynamodb:${this.region}:${this.account}:table/${props.peopleTableName}`,
`arn:aws:dynamodb:${this.region}:${this.account}:table/${props.configTableName}`,
],
}));

// Allow KMS decrypt for DynamoDB encryption
assignTool.addToRolePolicy(new iam.PolicyStatement({
actions: ['kms:Decrypt'],
resources: ['*'], // DynamoDB tables use customer-managed KMS keys
}));

// Dedupe MCP tool Lambda (vector search)
const dedupeTool = new lambda.Function(this, 'DedupeToolFn', {
runtime: lambda.Runtime.PYTHON_3_11,
handler: 'handler.lambda_handler',
code: lambda.Code.fromAsset('lambdas/mcp/dedupe_tool'),
timeout: cdk.Duration.seconds(20),
memorySize: 512,
tracing: lambda.Tracing.ACTIVE,
environment: {
AOSS_COLLECTION: 'issue-mgmt-issues',
BEDROCK_REGION: cdk.Stack.of(this).region,
},
logRetention: logs.RetentionDays.ONE_WEEK,
});

// Indexer Lambda: pull Jira issues → embed → index
const indexer = new lambda.Function(this, 'IssueIndexerFn', {
runtime: lambda.Runtime.PYTHON_3_11,
handler: 'handler.lambda_handler',
code: lambda.Code.fromAsset('lambdas/indexer'),
timeout: cdk.Duration.seconds(60),
memorySize: 768,
tracing: lambda.Tracing.ACTIVE,
environment: {
AOSS_COLLECTION: 'issue-mgmt-issues',
BEDROCK_REGION: cdk.Stack.of(this).region,
JIRA_SECRET_ARN: props.jiraSecretArn,
},
logRetention: logs.RetentionDays.ONE_WEEK,
});

// Permissions: Secrets for indexer; Bedrock for both; AOSS data-plane via OpenSearch SigV4
indexer.addToRolePolicy(new iam.PolicyStatement({
actions: ['secretsmanager:GetSecretValue'],
resources: [props.jiraSecretArn],
}));

const bedrockInvoke = new iam.PolicyStatement({
actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
resources: ['*'], // tighten to specific embedding model ARN if desired
});

indexer.addToRolePolicy(bedrockInvoke);
dedupeTool.addToRolePolicy(bedrockInvoke);

// AOSS permissions
const aossPermissions = new iam.PolicyStatement({
actions: [
'aoss:APIAccessAll',
'aoss:BatchGetCollection',
'aoss:DescribeCollectionItems',
'aoss:CreateIndex',
'aoss:DescribeIndex',
'aoss:WriteDocument',
'aoss:ReadDocument'
],
resources: ['*'],
});

indexer.addToRolePolicy(aossPermissions);
dedupeTool.addToRolePolicy(aossPermissions);

// Minimal permissions (expand in later stages)
chatHandler.addToRolePolicy(new iam.PolicyStatement({
actions: ['secretsmanager:GetSecretValue'],
resources: [props.jiraSecretArn],
}));

// Allow read to buckets (tighten to prefixes later)
chatHandler.addToRolePolicy(new iam.PolicyStatement({
actions: ['s3:GetObject', 's3:ListBucket'],
resources: [
`arn:aws:s3:::${props.artifactsBucket}`,
`arn:aws:s3:::${props.artifactsBucket}/*`,
`arn:aws:s3:::${props.promptsBucket}`,
`arn:aws:s3:::${props.promptsBucket}/*`,
],
}));

const api = new apigw.RestApi(this, 'IssueMgmtApi', {
deployOptions: {
stageName: 'prod',
tracingEnabled: true,
metricsEnabled: true,
loggingLevel: apigw.MethodLoggingLevel.INFO,
},
defaultCorsPreflightOptions: {
allowOrigins: apigw.Cors.ALL_ORIGINS,
allowMethods: ['GET', 'POST', 'OPTIONS'],
},
});

const chat = api.root.addResource('chat');
chat.addMethod('POST', new apigw.LambdaIntegration(chatHandler, { proxy: true }));

// /mcp/jira endpoint
const mcp = api.root.addResource('mcp');
const jira = mcp.addResource('jira');
jira.addMethod('POST', new apigw.LambdaIntegration(jiraTool, { proxy: true }));

// /mcp/assign endpoint
const assign = mcp.addResource('assign');
assign.addMethod('POST', new apigw.LambdaIntegration(assignTool, { proxy: true }));

// /mcp/dedupe endpoint
const dedupe = mcp.addResource('dedupe');
dedupe.addMethod('POST', new apigw.LambdaIntegration(dedupeTool, { proxy: true }));

// /admin endpoint for indexing
const admin = api.root.addResource('admin');
admin.addMethod('POST', new apigw.LambdaIntegration(indexer, { proxy: true }));

new cdk.CfnOutput(this, 'ApiUrl', {
value: api.url,
description: 'API Gateway URL',
});

new cdk.CfnOutput(this, 'DedupeEndpoint', { 
value: api.url + 'mcp/dedupe' 
});

new cdk.CfnOutput(this, 'AdminIndexerEndpoint', { 
value: api.url + 'admin' 
});
}
}
