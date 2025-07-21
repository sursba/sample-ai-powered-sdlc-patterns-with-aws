import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly knowledgeBaseBucket: s3.Bucket;
  public readonly domainAnalyzerBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 bucket for knowledge base data storage with enhanced security
    this.knowledgeBaseBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
      bucketName: `openapi-knowledge-base-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      serverAccessLogsPrefix: 'access-logs/',
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          id: 'TransitionOldVersions',
          noncurrentVersionTransitions: [{
            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
            transitionAfter: cdk.Duration.days(30)
          }]
        }
      ]
    });

    // S3 bucket for domain analyzer output with enhanced security
    this.domainAnalyzerBucket = new s3.Bucket(this, 'DomainAnalyzerBucket', {
      bucketName: `openapi-domain-analyzer-${this.account}-${this.region}`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      serverAccessLogsPrefix: 'access-logs/',
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'DeleteOldAnalyzerResults',
          expiration: cdk.Duration.days(30),
        },
        {
          id: 'DeleteIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        }
      ]
    });

    // Grant Lambda service access to domain analyzer bucket
    this.domainAnalyzerBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DomainAnalyzerLambdaAccess',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
          's3:ListBucket'
        ],
        resources: [
          this.domainAnalyzerBucket.bucketArn,
          `${this.domainAnalyzerBucket.bucketArn}/*`
        ],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': this.account
          }
        }
      })
    );

    // Grant Bedrock service access to knowledge base bucket
    this.knowledgeBaseBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'BedrockKnowledgeBaseAccess',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('bedrock.amazonaws.com')],
        actions: [
          's3:GetObject',
          's3:ListBucket'
        ],
        resources: [
          this.knowledgeBaseBucket.bucketArn,
          `${this.knowledgeBaseBucket.bucketArn}/*`
        ],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': this.account
          }
        }
      })
    );

    // Export bucket names as stack outputs
    new cdk.CfnOutput(this, 'KnowledgeBaseBucketName', {
      value: this.knowledgeBaseBucket.bucketName,
      description: 'S3 bucket name for knowledge base data storage',
      exportName: `${this.stackName}-KnowledgeBaseBucketName`
    });

    new cdk.CfnOutput(this, 'DomainAnalyzerBucketName', {
      value: this.domainAnalyzerBucket.bucketName,
      description: 'S3 bucket name for domain analyzer output',
      exportName: `${this.stackName}-DomainAnalyzerBucketName`
    });
  }
}