import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as aoss from 'aws-cdk-lib/aws-opensearchserverless';
import * as iam from 'aws-cdk-lib/aws-iam';

export class DataStack extends cdk.Stack {
readonly artifactsBucketName: string;
readonly promptsBucketName: string;
readonly issuesTableName: string;
readonly peopleTableName: string;
readonly configTableName: string;
readonly auditTableName: string;
readonly aossCollectionName: string;
readonly aossCollectionArn: string;
readonly aossCollectionEndpointParam: string;

constructor(scope: Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

const key = new kms.Key(this, 'DataKmsKey', {
enableKeyRotation: true,
alias: 'alias/issue-mgmt-data',
});

const artifacts = new s3.Bucket(this, 'ArtifactsBucket', {
encryption: s3.BucketEncryption.KMS,
encryptionKey: key,
enforceSSL: true,
blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
versioned: true,
});
this.artifactsBucketName = artifacts.bucketName;

const prompts = new s3.Bucket(this, 'PromptsBucket', {
encryption: s3.BucketEncryption.KMS,
encryptionKey: key,
enforceSSL: true,
blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
versioned: true,
});
this.promptsBucketName = prompts.bucketName;

const issues = new dynamodb.Table(this, 'IssuesTable', {
partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
encryptionKey: key,
pointInTimeRecovery: true,
tableName: `issue-mgmt-Issues`,
});
this.issuesTableName = issues.tableName;

const people = new dynamodb.Table(this, 'PeopleTable', {
partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
encryptionKey: key,
pointInTimeRecovery: true,
tableName: `issue-mgmt-People`,
});
this.peopleTableName = people.tableName;

const config = new dynamodb.Table(this, 'ConfigTable', {
partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
encryptionKey: key,
pointInTimeRecovery: true,
tableName: `issue-mgmt-Config`,
});
this.configTableName = config.tableName;

const audit = new dynamodb.Table(this, 'AuditTable', {
partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
encryptionKey: key,
pointInTimeRecovery: true,
tableName: `issue-mgmt-Audit`,
});
this.auditTableName = audit.tableName;

// Encryption policy (mandatory) - must be created first
const enc = new aoss.CfnSecurityPolicy(this, 'IssuesEncPolicy', {
name: 'issue-mgmt-enc',
type: 'encryption',
policy: JSON.stringify({
Rules: [{ 
ResourceType: 'collection',
Resource: ['collection/issue-mgmt-issues'] 
}],
AWSOwnedKey: true,
}),
});

// Network policy (allow public access for demo; tighten for VPC as needed)
const net = new aoss.CfnSecurityPolicy(this, 'IssuesNetPolicy', {
name: 'issue-mgmt-net',
type: 'network',
policy: JSON.stringify([
{
Rules: [{ ResourceType: 'collection', Resource: ['collection/issue-mgmt-issues'] }],
AllowFromPublic: true,
},
]),
});

// OpenSearch Serverless collection for vector + BM25
const collection = new aoss.CfnCollection(this, 'IssuesCollection', {
name: 'issue-mgmt-issues',
type: 'SEARCH',
description: 'Issue management vector + text search',
});

// Collection depends on policies
collection.node.addDependency(enc);
collection.node.addDependency(net);

// Data access policy: allow indexing/search from account principal (narrow later to Lambda roles)
const dataAccess = new aoss.CfnAccessPolicy(this, 'IssuesAccessPolicy', {
name: 'issue-mgmt-access',
type: 'data',
// Granting account-level principals for simplicity in sample
// You can replace with specific role ARNs from CoreStack later
policy: JSON.stringify([
{
Description: 'Allow data access from this account and Lambda roles',
Rules: [
{
ResourceType: 'index',
Resource: ['index/issue-mgmt-issues/*'],
Permission: ['aoss:*'],
},
{
ResourceType: 'collection',
Resource: ['collection/issue-mgmt-issues'],
Permission: ['aoss:*'],
},
],
Principal: [
`arn:aws:iam::${cdk.Stack.of(this).account}:root`,
`arn:aws:iam::${cdk.Stack.of(this).account}:role/IssueMgmtCoreStack-DedupeToolFnServiceRoleB561A185-lIMjI5R81XhX`,
`arn:aws:iam::${cdk.Stack.of(this).account}:role/IssueMgmtCoreStack-IssueIndexerFnServiceRole32C5431-nkc4sB75xmxP`
],
},
]),
});
dataAccess.node.addDependency(collection);

this.aossCollectionName = collection.name!;
this.aossCollectionArn = collection.attrArn;
// We cannot know the endpoint until runtime; pass collection name to Lambdas.
this.aossCollectionEndpointParam = this.aossCollectionName;

// NOTE: OpenSearch Serverless will be added in Stage 2 with proper access & encryption policies.
}
}