import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class CloudWatchService extends Construct {
  public readonly rules: { [key: string]: events.Rule } = {};
  public readonly alarms: { [key: string]: cloudwatch.Alarm } = {};

  constructor(
    scope: Construct, 
    id: string, 
    functions: { [key: string]: lambda.Function }, 
    alarmTopic: sns.Topic,
    dynamoTable?: dynamodb.Table,
    customAlarmAction?: cloudwatch.IAlarmAction
  ) {
    super(scope, id);

    Object.entries(functions).forEach(([name, fn]) => {
      // Create EventBridge rule to trigger the Lambda every minute
      const rule = new events.Rule(this, `${name}ScheduleRule`, {
        schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
        targets: [new targets.LambdaFunction(fn)],
        enabled: false  // Initially disabled
      });
      
      this.rules[name] = rule;

      // Create CloudWatch Alarm for errors
      const errors = fn.metricErrors({
        period: cdk.Duration.minutes(1),
        statistic: 'sum',
      });

      const invocationAlarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
        metric: errors,
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        alarmDescription: `Error alarm for ${name}`,
        actionsEnabled: false,
      });

      // Add SNS action to invocation alarm
      invocationAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

      // Add custom alarm action if provided
      if (customAlarmAction) {
        invocationAlarm.addAlarmAction(customAlarmAction);
      }

    });

    // Create DynamoDB alarms if table is provided
    if (dynamoTable) {
      //ReadCapacity Alarm
      const readCapacityMetric = dynamoTable.metricConsumedReadCapacityUnits({
        period: cdk.Duration.minutes(1),
        statistic: 'sum',
      });

      const readCapacityAlarm = new cloudwatch.Alarm(this, 'DynamoDBReadCapacityAlarm', {
        metric: readCapacityMetric,
        threshold: 100, // Alert when reaching 100 consumed RCUs for on-demand tables
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'DynamoDB table is reaching high read capacity consumption',
      });
      readCapacityAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
      if (customAlarmAction) {
        readCapacityAlarm.addAlarmAction(customAlarmAction);
      }
      this.alarms['DynamoDBReadCapacity'] = readCapacityAlarm;

      //Write Capacity Alarm
      const writeCapacityMetric = dynamoTable.metricConsumedWriteCapacityUnits({
        period: cdk.Duration.minutes(1),
        statistic: 'sum',
      });

      const writeCapacityAlarm = new cloudwatch.Alarm(this, 'DynamoDBWriteCapacityAlarm', {
        metric: writeCapacityMetric,
        threshold: 100, // Alert when reaching 100 consumed WCUs for on-demand tables
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        alarmDescription: 'DynamoDB table is reaching high write capacity consumption',
        actionsEnabled: true,  // Initially disabled
      });
      writeCapacityAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));
      if (customAlarmAction) {
        writeCapacityAlarm.addAlarmAction(customAlarmAction);
      }
      this.alarms['DynamoDBWriteCapacity'] = writeCapacityAlarm;
     
    }
  }
}