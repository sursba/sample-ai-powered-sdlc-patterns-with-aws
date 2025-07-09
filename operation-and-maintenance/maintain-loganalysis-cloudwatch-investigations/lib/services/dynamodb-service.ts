import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export class DynamodbService extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

 
    // Create DynamoDB table with enhanced security
    this.table = new dynamodb.Table(this, 'ErrorSimulationTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      maxReadRequestUnits: 1,
      maxWriteRequestUnits: 1,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For testing purposes
      timeToLiveAttribute: 'ttl', // Enable TTL for data lifecycle management
      contributorInsightsEnabled: true // Enable advanced monitoring
    });

    // Add CDK NAG suppressions for acceptable deviations
    NagSuppressions.addResourceSuppressions(
      this.table,
      [
        {
          id: 'AwsSolutions-DDB3',
          reason: 'Point-in-time recovery is not required'
        }
      ],
      true
    );
  }
}