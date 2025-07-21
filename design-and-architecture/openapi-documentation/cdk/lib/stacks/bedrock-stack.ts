import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';
import { CONFIG } from '../config';
import { NagSuppressions } from 'cdk-nag';

interface BedrockStackProps extends cdk.StackProps {
  collectionArn: string;
  bucketArn: string;
  bedrockRoleArn: string;
}

export class BedrockStack extends cdk.Stack {
  public readonly agentId: string;
  public readonly knowledgeBaseId: string;

  constructor(scope: Construct, id: string, props: BedrockStackProps) {
    super(scope, id, props);

    // Agent Role
    const agentRole = new iam.CfnRole(this, 'AgentRole', {
      roleName: 'AmazonBedrockExecutionRoleForAgents_cdk',
      assumeRolePolicyDocument: {
        Statement: [{
          Effect: 'Allow',
          Principal: {
            Service: 'bedrock.amazonaws.com'
          },
          Action: 'sts:AssumeRole'
        }]
      },
      managedPolicyArns: ['arn:aws:iam::aws:policy/AmazonBedrockFullAccess']
    });

    // Knowledge Base
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: `${CONFIG.collectionName}-kb`,
      description: 'Answers on basis of data in knowledge base',
      roleArn: props.bedrockRoleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`
        }
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: props.collectionArn,
          vectorIndexName: CONFIG.indexName,
          fieldMapping: {
            vectorField: 'vector',
            textField: 'text',
            metadataField: 'metadata'
          }
        }
      }
    });

    // Data Source
    new bedrock.CfnDataSource(this, 'DataSource', {
      knowledgeBaseId: knowledgeBase.ref,
      name: `${CONFIG.collectionName}-datasource`,
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: props.bucketArn
        }
      }
    });



    const agent = new bedrock.CfnAgent(this, 'Agent', {
      agentName: 'openapi-architect-agent',
      agentResourceRoleArn: agentRole.attrArn,
      autoPrepare: true,
      foundationModel: 'eu.anthropic.claude-3-7-sonnet-20250219-v1:0',
      instruction: `You are an AWS Solutions Architect, guided by the Well-Architected Principles and the cloud-native excellence practices. Your task is to translate user defined business application domains and specifications into OpenAPI (latest documented version) definitions in code, make sure to include domain events in the form of API webhooks. You have access to the knowledge base with the latest data. Only output yaml, openapi code.`,
      description: 'AWS Solutions Architect for OpenAPI Generation',
      idleSessionTtlInSeconds: 900,
      knowledgeBases: [{
        knowledgeBaseId: knowledgeBase.ref,
        description: 'Knowledge base contains the latest OpenAPI specifications and instructions.',
        knowledgeBaseState: 'ENABLED'
      }]
    });

    // Set public properties for other stacks to reference
    this.agentId = agent.ref;
    this.knowledgeBaseId = knowledgeBase.ref;

    // Outputs
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: knowledgeBase.ref
    });

    new cdk.CfnOutput(this, 'AgentId', {
      value: agent.ref
    });

    // CDK NAG suppressions for AWS managed policy usage
    NagSuppressions.addResourceSuppressions(agentRole, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AmazonBedrockFullAccess managed policy is the AWS-recommended approach for Bedrock agents. This policy is maintained by AWS and includes the necessary permissions that evolve with the Bedrock service. Creating a custom policy would require constant maintenance to keep up with service updates.',
        appliesTo: ['Policy::arn:aws:iam::aws:policy/AmazonBedrockFullAccess']
      }
    ]);
  }
}
