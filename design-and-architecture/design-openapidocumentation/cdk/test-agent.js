#!/usr/bin/env node

/**
 * Test Bedrock Agent
 * JavaScript version of test_agent.py
 */

const { BedrockAgentRuntimeClient, InvokeAgentCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

// Configuration
const REGION = process.env.AWS_REGION || 'eu-west-1';
const STACK_NAME = 'BedrockStack';
const AGENT_ALIAS_ID = 'TSTALIASID';
const SESSION_ID = 'test-session-deployment';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Get Bedrock Agent ID from CloudFormation stack
 */
async function getAgentId() {
  try {
    const cfClient = new CloudFormationClient({ region: REGION });
    const command = new DescribeStacksCommand({ StackName: STACK_NAME });
    const response = await cfClient.send(command);

    const stack = response.Stacks[0];
    const agentIdOutput = stack.Outputs.find(output => output.OutputKey === 'AgentId');

    if (!agentIdOutput) {
      throw new Error('AgentId output not found in CloudFormation stack');
    }

    const agentId = agentIdOutput.OutputValue;
    log('blue', `Found Bedrock Agent ID: ${agentId}`);
    return agentId;
  } catch (error) {
    log('red', `Error getting agent ID: ${error.message}`);
    throw error;
  }
}

/**
 * Test Bedrock Agent
 */
async function testBedrockAgent() {
  try {
    log('blue', '🤖 Testing Bedrock Agent...');
    log('blue', '============================');

    // Get agent ID from CloudFormation
    const agentId = await getAgentId();

    // Create Bedrock Agent Runtime client
    const client = new BedrockAgentRuntimeClient({ region: REGION });

    // Test input
    const inputText = "Create a simple OpenAPI specification for a user management API with CRUD operations";

    log('blue', `📝 Input: ${inputText}`);
    log('blue', '⏳ Invoking agent...');

    // Invoke agent
    const command = new InvokeAgentCommand({
      agentId: agentId,
      agentAliasId: AGENT_ALIAS_ID,
      sessionId: SESSION_ID,
      inputText: inputText
    });

    const response = await client.send(command);

    // Process streaming response
    log('blue', '📤 Agent Response:');
    log('blue', '='.repeat(50));

    let fullResponse = '';

    if (response.completion && Symbol.asyncIterator in response.completion) {
      // Handle streaming response
      for await (const chunk of response.completion) {
        if (chunk.chunk?.bytes) {
          const text = Buffer.from(chunk.chunk.bytes).toString('utf-8');
          process.stdout.write(text);
          fullResponse += text;
        }
      }
    } else {
      // Handle non-streaming response
      const text = response.completion || 'No response received';
      console.log(text);
      fullResponse = text;
    }

    console.log('\n' + '='.repeat(50));

    // Validate response
    if (fullResponse.length > 0) {
      log('green', '✅ Agent test completed successfully!');

      // Check if response contains OpenAPI-like content
      if (fullResponse.toLowerCase().includes('openapi') ||
        fullResponse.toLowerCase().includes('swagger') ||
        fullResponse.toLowerCase().includes('paths')) {
        log('green', '🎉 Response appears to contain OpenAPI specification content!');
      }

      return true;
    } else {
      log('yellow', '⚠️  Agent responded but with empty content');
      return false;
    }

  } catch (error) {
    log('red', `❌ Error testing agent: ${error.message}`);

    // Provide helpful error messages
    if (error.name === 'AccessDeniedException') {
      log('yellow', '💡 Tip: Make sure your AWS credentials have Bedrock permissions');
    } else if (error.name === 'ResourceNotFoundException') {
      log('yellow', '💡 Tip: Make sure the Bedrock agent is deployed and active');
    } else if (error.name === 'ThrottlingException') {
      log('yellow', '💡 Tip: Bedrock service is throttling requests, try again in a moment');
    }

    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const success = await testBedrockAgent();

    if (success) {
      log('green', '🎉 Bedrock Agent test completed successfully!');
      log('blue', '💡 You can now use the agent to generate OpenAPI specifications');
      process.exit(0);
    } else {
      log('red', '❌ Bedrock Agent test failed');
      process.exit(1);
    }

  } catch (error) {
    log('red', `❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  testBedrockAgent,
  getAgentId
};