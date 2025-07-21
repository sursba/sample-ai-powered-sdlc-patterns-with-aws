import * as cdk from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { OpenSearchStack } from '../lib/stacks/opensearch-stack';
import { BedrockStack } from '../lib/stacks/bedrock-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { LambdaStack } from '../lib/stacks/lambda-stack';
import { AmplifyAuthStack } from '../lib/stacks/amplify-auth-stack';

describe('CDK NAG Tests', () => {
  let app: cdk.App;

  beforeEach(() => {
    app = new cdk.App();
    // Add CDK NAG to the app
    cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
  });

  test('OpenSearch Stack passes CDK NAG checks', () => {
    const stack = new OpenSearchStack(app, 'TestOpenSearchStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });

    const annotations = Annotations.fromStack(stack);
    const errors = annotations.findError('*', Match.anyValue());
    const warnings = annotations.findWarning('*', Match.anyValue());

    console.log('OpenSearch Stack Errors:', errors);
    console.log('OpenSearch Stack Warnings:', warnings);

    // Should have no CDK NAG errors
    expect(errors).toHaveLength(0);
  });

  test('Storage Stack passes CDK NAG checks', () => {
    const stack = new StorageStack(app, 'TestStorageStack', {
      env: { account: '123456789012', region: 'us-east-1' }
    });

    const annotations = Annotations.fromStack(stack);
    const errors = annotations.findError('*', Match.anyValue());
    const warnings = annotations.findWarning('*', Match.anyValue());

    console.log('Storage Stack Errors:', errors);
    console.log('Storage Stack Warnings:', warnings);

    expect(errors).toHaveLength(0);
  });

  test('Bedrock Stack passes CDK NAG checks', () => {
    // Create dependencies first
    const opensearchStack = new OpenSearchStack(app, 'TestOpenSearchStackForBedrock', {
      env: { account: '123456789012', region: 'us-east-1' }
    });

    const stack = new BedrockStack(app, 'TestBedrockStack', {
      env: { account: '123456789012', region: 'us-east-1' },
      collectionArn: opensearchStack.collection.attrArn,
      bucketArn: opensearchStack.s3Bucket.attrArn,
      bedrockRoleArn: opensearchStack.bedrockRole.attrArn
    });

    const annotations = Annotations.fromStack(stack);
    const errors = annotations.findError('*', Match.anyValue());
    const warnings = annotations.findWarning('*', Match.anyValue());

    console.log('Bedrock Stack Errors:', errors);
    console.log('Bedrock Stack Warnings:', warnings);

    expect(errors).toHaveLength(0);
  });

  test('Lambda Stack passes CDK NAG checks', () => {
    // Create dependencies
    const storageStack = new StorageStack(app, 'TestStorageStackForLambda', {
      env: { account: '123456789012', region: 'us-east-1' }
    });

    const stack = new LambdaStack(app, 'TestLambdaStack', {
      env: { account: '123456789012', region: 'us-east-1' },
      domainAnalyzerBucket: storageStack.domainAnalyzerBucket,
      bedrockAgentId: 'test-agent-id',
      bedrockAgentAliasId: 'TSTALIASID',
      knowledgeBaseId: 'test-kb-id'
    });

    const annotations = Annotations.fromStack(stack);
    const errors = annotations.findError('*', Match.anyValue());
    const warnings = annotations.findWarning('*', Match.anyValue());

    console.log('Lambda Stack Errors:', errors);
    console.log('Lambda Stack Warnings:', warnings);

    expect(errors).toHaveLength(0);
  });

  test('Amplify Auth Stack passes CDK NAG checks', () => {
    // Create dependencies
    const storageStack = new StorageStack(app, 'TestStorageStackForAmplify', {
      env: { account: '123456789012', region: 'us-east-1' }
    });

    const lambdaStack = new LambdaStack(app, 'TestLambdaStackForAmplify', {
      env: { account: '123456789012', region: 'us-east-1' },
      domainAnalyzerBucket: storageStack.domainAnalyzerBucket,
      bedrockAgentId: 'test-agent-id',
      bedrockAgentAliasId: 'TSTALIASID',
      knowledgeBaseId: 'test-kb-id'
    });

    const stack = new AmplifyAuthStack(app, 'TestAmplifyAuthStack', {
      env: { account: '123456789012', region: 'us-east-1' },
      domainAnalyzerFunction: lambdaStack.domainAnalyzerFunction,
      docGeneratorFunction: lambdaStack.docGeneratorFunction,
      backendFunction: lambdaStack.backendFunction,
      backendFunctionUrl: lambdaStack.backendFunctionUrl,
      apiGatewayUrl: '' // No API Gateway needed
    });

    const annotations = Annotations.fromStack(stack);
    const errors = annotations.findError('*', Match.anyValue());
    const warnings = annotations.findWarning('*', Match.anyValue());

    console.log('Amplify Auth Stack Errors:', errors);
    console.log('Amplify Auth Stack Warnings:', warnings);

    expect(errors).toHaveLength(0);
  });

  test('All stacks together pass CDK NAG checks', () => {
    // Create all stacks in dependency order
    const opensearchStack = new OpenSearchStack(app, 'TestOpenSearchStackAll', {
      env: { account: '123456789012', region: 'us-east-1' }
    });

    const storageStack = new StorageStack(app, 'TestStorageStackAll', {
      env: { account: '123456789012', region: 'us-east-1' }
    });

    const bedrockStack = new BedrockStack(app, 'TestBedrockStackAll', {
      env: { account: '123456789012', region: 'us-east-1' },
      collectionArn: opensearchStack.collection.attrArn,
      bucketArn: opensearchStack.s3Bucket.attrArn,
      bedrockRoleArn: opensearchStack.bedrockRole.attrArn
    });

    const lambdaStack = new LambdaStack(app, 'TestLambdaStackAll', {
      env: { account: '123456789012', region: 'us-east-1' },
      domainAnalyzerBucket: storageStack.domainAnalyzerBucket,
      bedrockAgentId: bedrockStack.agentId,
      bedrockAgentAliasId: 'TSTALIASID',
      knowledgeBaseId: bedrockStack.knowledgeBaseId
    });

    const amplifyAuthStack = new AmplifyAuthStack(app, 'TestAmplifyAuthStackAll', {
      env: { account: '123456789012', region: 'us-east-1' },
      domainAnalyzerFunction: lambdaStack.domainAnalyzerFunction,
      docGeneratorFunction: lambdaStack.docGeneratorFunction,
      backendFunction: lambdaStack.backendFunction,
      backendFunctionUrl: lambdaStack.backendFunctionUrl,
      apiGatewayUrl: ''
    });

    // Check all stacks for errors
    const stacks = [opensearchStack, storageStack, bedrockStack, lambdaStack, amplifyAuthStack];
    
    stacks.forEach((stack, index) => {
      const stackNames = ['OpenSearch', 'Storage', 'Bedrock', 'Lambda', 'AmplifyAuth'];
      const annotations = Annotations.fromStack(stack);
      const errors = annotations.findError('*', Match.anyValue());
      const warnings = annotations.findWarning('*', Match.anyValue());

      console.log(`${stackNames[index]} Stack Errors:`, errors);
      console.log(`${stackNames[index]} Stack Warnings:`, warnings);

      expect(errors).toHaveLength(0);
    });
  });
});