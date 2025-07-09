const { EventBridgeClient, EnableRuleCommand, DisableRuleCommand } = require('@aws-sdk/client-eventbridge');
const { LambdaClient, UpdateFunctionConfigurationCommand, GetFunctionConfigurationCommand } = require('@aws-sdk/client-lambda');
const { CloudWatchClient, EnableAlarmActionsCommand, DisableAlarmActionsCommand } = require('@aws-sdk/client-cloudwatch');
const AWSXRay = require('aws-xray-sdk-core');

// Initialize AWS SDK clients
const eventBridgeClient = AWSXRay.captureAWSv3Client(new EventBridgeClient());
const lambdaClient = AWSXRay.captureAWSv3Client(new LambdaClient());
const cloudwatchClient = AWSXRay.captureAWSv3Client(new CloudWatchClient());

exports.handler = async function(event, context) {
  try {
    const action = event.action;
    if (!action || !['start', 'stop'].includes(action)) {
      throw new Error('Invalid action. Must be either "start" or "stop"');
    }

    const targetLambdas = event.targetLambdas || ['ConnectionErrorLambda', 'ThrottlingErrorLambda', 'MissingRecordsLambda'];
    const ruleNameMapping = JSON.parse(process.env.RULE_NAME_MAPPING || '{}');
    
    for (const lambdaName of targetLambdas) {
      try {
        const ruleName = ruleNameMapping[lambdaName];
        if (!ruleName) {
          throw new Error(`Rule name not found for lambda ${lambdaName}`);
        }

        const functionArn = process.env[`${lambdaName}_ARN`];
        if (!functionArn) {
          throw new Error(`Function ARN not found for lambda ${lambdaName}`);
        }

        if (action === 'start') {
          await eventBridgeClient.send(new EnableRuleCommand({ Name: ruleName }));
        } else {
          await eventBridgeClient.send(new DisableRuleCommand({ Name: ruleName }));
        }

        const currentConfig = await lambdaClient.send(new GetFunctionConfigurationCommand({
          FunctionName: functionArn
        }));

        await lambdaClient.send(new UpdateFunctionConfigurationCommand({
          FunctionName: functionArn,
          Environment: {
            Variables: {
              ...currentConfig.Environment?.Variables,
              GENERATE_ERRORS: action === 'start' ? 'true' : 'false'
            }
          }
        }));

        // Get base alarm names for this lambda
        const alarmNames = [
          `${process.env.STACK_NAME}-${lambdaName}ErrorAlarm`,
          `${process.env.STACK_NAME}-${lambdaName}InvocationAlarm`
        ];

        // Add HTTP 500 alarm for MissingRecordsLambda
        if (lambdaName === 'MissingRecordsLambda') {
          alarmNames.push(`${process.env.STACK_NAME}-${lambdaName}Http500Alarm`);
        }

        if (action === 'start') {
          await cloudwatchClient.send(new EnableAlarmActionsCommand({ AlarmNames: alarmNames }));
        } else {
          await cloudwatchClient.send(new DisableAlarmActionsCommand({ AlarmNames: alarmNames }));
        }
      } catch (error) {
        console.error(`Error processing lambda ${lambdaName}: ${error.message}`);
        if (error.name === 'AccessDeniedException' || error.name === 'UnauthorizedOperation') {
          throw new Error(`Insufficient permissions to manage ${lambdaName}. Please check IAM roles and permissions.`);
        }
        throw error;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify(`Successfully ${action}ed error generation for ${targetLambdas.join(', ')}`)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error.name === 'Error' ? 400 : 500,
      body: JSON.stringify({ message: error.message, type: error.name })
    };
  }
};