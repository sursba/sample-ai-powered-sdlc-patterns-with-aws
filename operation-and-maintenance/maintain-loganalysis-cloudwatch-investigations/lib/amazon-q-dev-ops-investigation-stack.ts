import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SnsService } from './services/sns-service';
import { DynamodbService } from './services/dynamodb-service';
import { ErrorLambda } from './services/error-lambda';
import { CloudWatchService } from './services/cloudwatch-service';
import { ControlLambda } from './services/control-lambda';
import { XrayLambdaLayer } from './services/xray-lambda-layer';
import { AiOpsActions } from './services/aiops-actions';
import { NagSuppressions } from 'cdk-nag';

export class AmazonQDevOpsInvestigationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const investigationGroupId = this.node.tryGetContext('InvestigationGroupID');

    // Create SNS service with encryption
    const snsService = new SnsService(this, 'SnsService');

    // Create DynamoDB service with encryption
    const dynamodbService = new DynamodbService(this, 'DynamodbService');

    // Create Lambda Layer 
    const xrayLayer = new XrayLambdaLayer(this, 'XRaySdkLayer');

    // Create Lambda service with enhanced security
    const lambdaService = new ErrorLambda(this, 'LambdaService', dynamodbService.table, xrayLayer);

    // Create AiOps Actions
    const aiopsActions = investigationGroupId
      ? new AiOpsActions(this, 'AiOpsActions', investigationGroupId)
      : new AiOpsActions(this, 'AiOpsActions');

    // Create CloudWatch service
    const cloudwatchService = new CloudWatchService(
      this,
      'CloudWatchService',
      lambdaService.functions,
      snsService.alarmTopic,
      dynamodbService.table,
      aiopsActions.alarmAction
    );

    const controlLambdaService = new ControlLambda(this, 'ControlLambdaService', {
      rules: cloudwatchService.rules,
      functions: lambdaService.functions,
      alarms: cloudwatchService.alarms,
      xrayLayer: xrayLayer
    });

    // Add CDK NAG suppressions for acceptable deviations
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'CloudWatch and X-Ray permissions require wildcard resources for proper functionality'
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Lambda role policies require specific service permissions'
      }
    ]);
  }
}
