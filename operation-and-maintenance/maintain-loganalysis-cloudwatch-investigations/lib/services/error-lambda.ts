import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { LambdaInsightsVersion } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { NagSuppressions } from 'cdk-nag';
import * as logs from 'aws-cdk-lib/aws-logs';

export class ErrorLambda extends Construct {
  public readonly functions: { [key: string]: lambda.Function } = {};

  constructor(scope: Construct, id: string, table: dynamodb.Table, xrayLayer: lambda.ILayerVersion) {
    super(scope, id);

   

    // Create specialized Lambda functions for each error type
    const createLambdaFunction = (name: string, errorCode: string) => {
      const fn = new NodejsFunction(this, name, {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        bundling: {
          externalModules: ['aws-xray-sdk-core', 'aws-sdk'], // because you're using a Lambda Layer
          sourceMap: true, // enable source maps for better debugging
          minify: true // minify code for better performance
        },
        layers: [xrayLayer],
        tracing: lambda.Tracing.ACTIVE, // Enable X-Ray tracing
        insightsVersion: LambdaInsightsVersion.VERSION_1_0_119_0, // Enable Lambda Insights
        entry: path.join(__dirname, 'lambda-handler/error-lambda/index.ts'),
        timeout: cdk.Duration.seconds(30),
        memorySize: 256, // Specify minimum memory for better performance
        deadLetterQueueEnabled: false,
        reservedConcurrentExecutions: 100, // Limit concurrent executions
        environment: {
          TABLE_NAME: table.tableName,
          ERROR_CODE: errorCode,
          LAMBDA_NAME: name,
          NODE_OPTIONS: '--enable-source-maps' // Enable source maps in Node.js
        }
      });
      
      // Grant DynamoDB permissions to the Lambda
      table.grantReadWriteData(fn);
      fn.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'))
      // Add CDK NAG suppressions for acceptable deviations
      NagSuppressions.addResourceSuppressions(
        fn,
        [
          {
            id: 'AwsSolutions-SQS3',
            reason: 'DLQ not required for this sample.',
          },
          {
          id: 'AwsSolutions-SQS4',
          reason: 'SQS is not used in this sample',
          },
          {
          id: 'AwsSolutions-L1',
          reason: 'Runtime specified in "lambda.Runtime.NODEJS_20_X"',
          },
        ],
        true
      );
      
      return fn;
    };

    // Create specialized lambdas for each error type
    this.functions['WritingThrottlingLambda'] = createLambdaFunction('WritingThrottlingLambda', 'WRITE-THROTTLING');
    this.functions['ReadThrottlingErrorLambda'] = createLambdaFunction('ReadThrottlingErrorLambda', 'READ-THROTTLING');
  }
}