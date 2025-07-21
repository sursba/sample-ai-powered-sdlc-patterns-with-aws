#!/usr/bin/env node

/**
 * User Management Script for OpenAPI Documentation App
 * 
 * This script provides a command-line interface for managing Cognito users
 * through the deployed Lambda function.
 * 
 * Usage:
 *   node user-management.js setPassword --username admin --password NewPassword123!
 *   node user-management.js createUser --username newuser --email user@example.com --password TempPass123!
 *   node user-management.js deleteUser --username olduser
 *   node user-management.js getUser --username admin
 * 
 * Environment Variables:
 *   AWS_REGION - AWS region where the stack is deployed
 *   STACK_NAME - Name of the CDK stack (defaults to 'AmplifyAuthStack')
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

class UserManager {
  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.stackName = process.env.STACK_NAME || 'AmplifyAuthStack';
    this.lambdaClient = new LambdaClient({ region: this.region });
    this.cfnClient = new CloudFormationClient({ region: this.region });
    this.functionName = null;
  }

  async getFunctionName() {
    if (this.functionName) {
      return this.functionName;
    }

    try {
      const command = new DescribeStacksCommand({ StackName: this.stackName });
      const response = await this.cfnClient.send(command);
      
      const stack = response.Stacks[0];
      const functionOutput = stack.Outputs.find(output => 
        output.OutputKey === 'UserManagementFunctionName'
      );
      
      if (!functionOutput) {
        throw new Error(`UserManagementFunctionName output not found in stack ${this.stackName}`);
      }
      
      this.functionName = functionOutput.OutputValue;
      return this.functionName;
    } catch (error) {
      throw new Error(`Failed to get function name from stack: ${error.message}`);
    }
  }

  async invokeUserManagement(payload) {
    const functionName = await this.getFunctionName();
    
    const command = new InvokeCommand({
      FunctionName: functionName,
      Payload: JSON.stringify(payload)
    });

    try {
      const response = await this.lambdaClient.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.Payload));
      
      if (result.statusCode === 200) {
        const body = JSON.parse(result.body);
        return { success: true, data: body };
      } else {
        const body = JSON.parse(result.body);
        return { success: false, error: body.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setPassword(username, password) {
    console.log(`Setting permanent password for user: ${username}`);
    
    const result = await this.invokeUserManagement({
      action: 'setPassword',
      username,
      password
    });

    if (result.success) {
      console.log('✅', result.data.message);
    } else {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }
  }

  async createUser(username, email, password = 'TempPass123!') {
    console.log(`Creating user: ${username} with email: ${email}`);
    
    const result = await this.invokeUserManagement({
      action: 'createUser',
      username,
      email,
      password
    });

    if (result.success) {
      console.log('✅', result.data.message);
      console.log(`📧 Temporary password: ${password}`);
      console.log('🔄 User will need to change password on first login');
    } else {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }
  }

  async deleteUser(username) {
    console.log(`Deleting user: ${username}`);
    
    const result = await this.invokeUserManagement({
      action: 'deleteUser',
      username
    });

    if (result.success) {
      console.log('✅', result.data.message);
    } else {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }
  }

  async getUser(username) {
    console.log(`Getting user information: ${username}`);
    
    const result = await this.invokeUserManagement({
      action: 'getUser',
      username
    });

    if (result.success) {
      console.log('✅ User found:');
      console.log('📋 Username:', result.data.user.username);
      console.log('📊 Status:', result.data.user.userStatus);
      console.log('🔓 Enabled:', result.data.user.enabled);
      console.log('📧 Attributes:');
      result.data.user.userAttributes.forEach(attr => {
        console.log(`   ${attr.Name}: ${attr.Value}`);
      });
    } else {
      console.error('❌ Error:', result.error);
      process.exit(1);
    }
  }

  printUsage() {
    console.log(`
User Management Script for OpenAPI Documentation App

Usage:
  node user-management.js <command> [options]

Commands:
  setPassword    Set permanent password for a user
    --username   Username (required)
    --password   New password (required)

  createUser     Create a new user
    --username   Username (required)
    --email      Email address (required)
    --password   Temporary password (optional, defaults to TempPass123!)

  deleteUser     Delete a user
    --username   Username (required)

  getUser        Get user information
    --username   Username (required)

Environment Variables:
  AWS_REGION     AWS region (defaults to us-east-1)
  STACK_NAME     CDK stack name (defaults to AmplifyAuthStack)

Examples:
  node user-management.js setPassword --username admin --password NewPassword123!
  node user-management.js createUser --username john --email john@example.com
  node user-management.js deleteUser --username olduser
  node user-management.js getUser --username admin
`);
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};

  for (let i = 1; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      options[key] = value;
    }
  }

  return { command, options };
}

// Main execution
async function main() {
  const { command, options } = parseArgs();
  const userManager = new UserManager();

  try {
    switch (command) {
      case 'setPassword':
        if (!options.username || !options.password) {
          console.error('❌ Error: --username and --password are required for setPassword');
          process.exit(1);
        }
        await userManager.setPassword(options.username, options.password);
        break;

      case 'createUser':
        if (!options.username || !options.email) {
          console.error('❌ Error: --username and --email are required for createUser');
          process.exit(1);
        }
        await userManager.createUser(options.username, options.email, options.password);
        break;

      case 'deleteUser':
        if (!options.username) {
          console.error('❌ Error: --username is required for deleteUser');
          process.exit(1);
        }
        await userManager.deleteUser(options.username);
        break;

      case 'getUser':
        if (!options.username) {
          console.error('❌ Error: --username is required for getUser');
          process.exit(1);
        }
        await userManager.getUser(options.username);
        break;

      default:
        userManager.printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { UserManager };