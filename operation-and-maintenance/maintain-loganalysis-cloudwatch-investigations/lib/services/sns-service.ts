import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export class SnsService extends Construct {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create KMS key for SNS topic encryption
    const key = new kms.Key(this, 'TopicKey', {
      enableKeyRotation: true,
      description: 'KMS key for CloudWatch Alarms SNS Topic encryption',
      alias: `${cdk.Stack.of(this).stackName}-alarm-topic-key`
    });

    // Create SNS topic for CloudWatch alarms with encryption
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'CloudWatch Alarms Topic',
      masterKey: key,
      topicName: `${cdk.Stack.of(this).stackName}-alarms`
    });

    // Add policy to allow Amazon Q AIOps to publish to the topic
    this.alarmTopic.addToResourcePolicy(new cdk.aws_iam.PolicyStatement({
      sid: 'AIOPS-CHAT-PUBLISH',
      effect: cdk.aws_iam.Effect.ALLOW,
      principals: [new cdk.aws_iam.ServicePrincipal('aiops.amazonaws.com')],
      actions: ['sns:Publish'],
      resources: [this.alarmTopic.topicArn],
      conditions: {
        StringEquals: {
          'aws:SourceAccount': cdk.Stack.of(this).account
        }
      }
    }));

    // Add CDK NAG suppressions for acceptable deviations
    NagSuppressions.addResourceSuppressions(
      this.alarmTopic,
      [
        {
          id: 'AwsSolutions-SNS2',
          reason: 'Topic encryption is enabled with a customer-managed KMS key'
        },
        {
          id: 'AwsSolutions-SNS3',
          reason: 'Topic policy is required for Amazon Q AIOps integration'
        }
      ],
      true
    );
  }
}