import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { LambdaInsightsVersion } from 'aws-cdk-lib/aws-lambda';
import { NagSuppressions } from 'cdk-nag';
import * as path from 'path';

export class ControlLambda extends Construct {
  public readonly controlLambda: lambda.Function;

  constructor(
    scope: Construct,
    id: string,
    props: {
      rules: { [key: string]: events.Rule },
      functions: { [key: string]: lambda.Function },
      alarms: { [key: string]: cloudwatch.Alarm }
      xrayLayer: lambda.LayerVersion
    }
  ) {
    super(scope, id);

    const { rules, functions, alarms } = props;

    // Create a mapping of lambda names to their rule names
    const ruleNameMapping = Object.entries(rules).reduce((acc, [key, rule]) => {
      acc[key] = rule.ruleName;
      return acc;
    }, {} as { [key: string]: string });

    this.controlLambda = new NodejsFunction(this, 'ControlLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      bundling: {
        externalModules: ['aws-xray-sdk-core', 'aws-sdk'], // because you're using a Lambda Layer
      },
      layers: [props.xrayLayer],
      tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
      insightsVersion: LambdaInsightsVersion.VERSION_1_0_119_0, // Enable Lambda Insights
      entry: path.join(__dirname, 'lambda-handler/control-lambda/index.ts'),
              
      timeout: cdk.Duration.minutes(1),
      environment: {
        STACK_NAME: cdk.Stack.of(scope).stackName,
        RULE_NAME_MAPPING: JSON.stringify(ruleNameMapping),
        ...Object.entries(functions).reduce((acc, [name, fn]) => ({
          ...acc,
          [`${name}_ARN`]: fn.functionArn
        }), {})
      }  

    });

  
     this.controlLambda.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'))

    this.controlLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'events:EnableRule',
        'events:DisableRule'
      ],
      resources: [
        ...Object.values(rules).map(rule => rule.ruleArn)
      ]
    }));

      NagSuppressions.addResourceSuppressions(
            this.controlLambda,
            [
              {
                id: 'AwsSolutions-L1',
                reason: 'Runtime specified in "lambda.Runtime.NODEJS_20_X"',
                },
            ],
            true
          );

  }
}
