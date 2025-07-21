#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { OpenSearchStack } from '../lib/stacks/opensearch-stack';
import { BedrockStack } from '../lib/stacks/bedrock-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { LambdaStack } from '../lib/stacks/lambda-stack';
import { AmplifyAuthStack } from '../lib/stacks/amplify-auth-stack';


const app = new cdk.App();

// Deploy OpenSearch Stack first
const opensearchStack = new OpenSearchStack(app, 'OpenSearchStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

// Deploy Storage Stack second
const storageStack = new StorageStack(app, 'StorageStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  }
});

// Deploy Bedrock Stack third
const bedrockStack = new BedrockStack(app, 'BedrockStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  collectionArn: opensearchStack.collection.attrArn,
  bucketArn: opensearchStack.s3Bucket.attrArn,
  bedrockRoleArn: opensearchStack.bedrockRole.attrArn
});

// Deploy Lambda Stack fourth (depends on Bedrock and Storage)
const lambdaStack = new LambdaStack(app, 'LambdaStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  domainAnalyzerBucket: storageStack.domainAnalyzerBucket,
  bedrockAgentId: bedrockStack.agentId,
  bedrockAgentAliasId: 'TSTALIASID', // Default test alias ID
  knowledgeBaseId: bedrockStack.knowledgeBaseId
});



// Deploy Amplify Auth Stack fifth (depends on Lambda functions)
const amplifyAuthStack = new AmplifyAuthStack(app, 'AmplifyAuthStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
  },
  domainAnalyzerFunction: lambdaStack.domainAnalyzerFunction,
  docGeneratorFunction: lambdaStack.docGeneratorFunction,
  backendFunction: lambdaStack.backendFunction,
  backendFunctionUrl: lambdaStack.backendFunctionUrl,
  apiGatewayUrl: '' // No API Gateway needed - using Lambda Function URL
});

// Add dependencies to ensure proper deployment order
storageStack.addDependency(opensearchStack);
bedrockStack.addDependency(storageStack);
lambdaStack.addDependency(bedrockStack);
amplifyAuthStack.addDependency(lambdaStack);

app.synth();
