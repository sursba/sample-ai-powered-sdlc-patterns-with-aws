import { EventBridgeClient, EnableRuleCommand, DisableRuleCommand } from '@aws-sdk/client-eventbridge';
import { Context, APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
import * as AWSXRay from 'aws-xray-sdk-core';

// Create AWS clients
const eventBridgeClient = AWSXRay.captureAWSv3Client(new EventBridgeClient({}));

interface ControlPayload {
  action: 'start' | 'stop';
  rules?: string[]; // Optional array of specific rules to control
  targetLambdas?: string[]; // Optional array of specific lambdas to control (alternative to rules)
  triggerAll?: boolean; // Optional flag to explicitly indicate triggering all rules
}

export const handler = async (
  event: APIGatewayEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Parse the payload - handle both API Gateway and direct Lambda invocation
    let payload: ControlPayload;
    
    if (event.body) {
      // API Gateway event
      payload = JSON.parse(event.body);
    } else {
      // Direct Lambda invocation
      payload = event as unknown as ControlPayload;
    }
    
    if (!payload.action || !['start', 'stop'].includes(payload.action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid action. Must be either "start" or "stop"'
        })
      };
    }

    // Get the rule name mapping from environment variables
    const ruleNameMapping = JSON.parse(process.env.RULE_NAME_MAPPING || '{}');
    
    // Determine which rules to process
    let rulesToProcess: string[];
    
    if (payload.rules || payload.targetLambdas) {
      // If specific rules or targetLambdas are provided, only process those
      if (payload.rules) {
        rulesToProcess = payload.rules.map(rule => ruleNameMapping[rule]).filter(Boolean);
      } else {
        rulesToProcess = payload.targetLambdas!.map(lambda => ruleNameMapping[lambda]).filter(Boolean);
      }
      console.log(`Processing specific rules: ${rulesToProcess.join(', ')}`);
    } else {
      // By default or if triggerAll is true, process all rules
      rulesToProcess = Object.values(ruleNameMapping);
      console.log(`Processing all ${rulesToProcess.length} rules in the stack`);
    }

    if (rulesToProcess.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'No valid rules specified. Check the rule names or use triggerAll: true to process all rules.',
          availableRules: Object.keys(ruleNameMapping)
        })
      };
    }

    // Process each rule
    const results = await Promise.all(
      rulesToProcess.map(async (ruleName) => {
        try {
          if (payload.action === 'start') {
            await eventBridgeClient.send(new EnableRuleCommand({ Name: ruleName }));
          } else {
            await eventBridgeClient.send(new DisableRuleCommand({ Name: ruleName }));
          }
          return { ruleName, status: 'success' };
        } catch (error) {
          console.error(`Error processing rule ${ruleName}:`, error);
          return { ruleName, status: 'error', error: (error as Error).message };
        }
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed ${payload.action} action`,
        totalRulesProcessed: rulesToProcess.length,
        isAllRules: payload.triggerAll || (!payload.rules && !payload.triggerAll),
        results
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: (error as Error).message
      })
    };
  }
};