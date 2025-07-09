import { handler } from '../lib/services/control-lambda';

// Example test events
export const startEvent = {
  action: 'start',
  rules: ['ConnectionErrorLambda', 'ThrottlingErrorLambda', 'MissingRecordsLambda']
};

export const stopEvent = {
  action: 'stop',
  rules: ['ConnectionErrorLambda', 'ThrottlingErrorLambda', 'MissingRecordsLambda']
};

export const startSingleLambdaEvent = {
  action: 'start',
  rules: ['ConnectionErrorLambda']
};

export const stopSingleLambdaEvent = {
  action: 'stop',
  rules: ['ConnectionErrorLambda']
};

export const startMissingRecordsLambdaEvent = {
  action: 'start',
  rules: ['MissingRecordsLambda']
};

export const invalidActionEvent = {
  action: 'invalid',
  rules: ['ConnectionErrorLambda']
};

export const missingActionEvent = {
  rules: ['ConnectionErrorLambda']
};

// Mock AWS X-Ray SDK
jest.mock('aws-xray-sdk-core', () => ({
  captureAWSv3Client: jest.fn(client => client)
}));

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  EnableRuleCommand: jest.fn(),
  DisableRuleCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({
      Environment: {
        Variables: {
          EXISTING_VAR: 'value'
        }
      }
    })
  })),
  UpdateFunctionConfigurationCommand: jest.fn(),
  GetFunctionConfigurationCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  EnableAlarmActionsCommand: jest.fn(),
  DisableAlarmActionsCommand: jest.fn()
}));

// Test cases demonstrating usage of the events
describe('Control Lambda Tests', () => {
  beforeEach(() => {
    process.env.STACK_NAME = 'TestStack';
    process.env.RULE_NAME_MAPPING = JSON.stringify({
      'ConnectionErrorLambda': 'TestStack-CloudWatchServiceConnectionErrorLambdaS-NLuaTO09Fk4O',
      'ThrottlingErrorLambda': 'TestStack-CloudWatchServiceThrottlingErrorLambdaS-XXXXXXXXXXXXX',
      'MissingRecordsLambda': 'TestStack-CloudWatchServiceMissingRecordsLambdaS-XXXXXXXXXXXXX'
    });
    process.env.ConnectionErrorLambda_ARN = 'arn:aws:lambda:region:account:function:ConnectionErrorLambda';
    process.env.ThrottlingErrorLambda_ARN = 'arn:aws:lambda:region:account:function:ThrottlingErrorLambda';
    process.env.MissingRecordsLambda_ARN = 'arn:aws:lambda:region:account:function:MissingRecordsLambda';

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.STACK_NAME;
    delete process.env.RULE_NAME_MAPPING;
    delete process.env.ConnectionErrorLambda_ARN;
    delete process.env.ThrottlingErrorLambda_ARN;
    delete process.env.MissingRecordsLambda_ARN;
  });

  it('should handle start event correctly', async () => {
    const response = await handler(startEvent, {} as any);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Successfully processed start action');
    expect(body.totalRulesProcessed).toBe(3);
    expect(body.results).toHaveLength(3);
    expect(body.results[0].status).toBe('success');
  });

  it('should handle stop event correctly', async () => {
    const response = await handler(stopEvent, {} as any);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Successfully processed stop action');
    expect(body.totalRulesProcessed).toBe(3);
    expect(body.results).toHaveLength(3);
    expect(body.results[0].status).toBe('success');
  });

  it('should use DisableRuleCommand for stop action', async () => {
    const { DisableRuleCommand } = require('@aws-sdk/client-eventbridge');
    await handler(stopEvent, {} as any);
    expect(DisableRuleCommand).toHaveBeenCalledWith({
      Name: 'TestStack-CloudWatchServiceConnectionErrorLambdaS-NLuaTO09Fk4O'
    });
  });

  it('should use EnableRuleCommand for start action', async () => {
    const { EnableRuleCommand } = require('@aws-sdk/client-eventbridge');
    await handler(startEvent, {} as any);
    expect(EnableRuleCommand).toHaveBeenCalledWith({
      Name: 'TestStack-CloudWatchServiceConnectionErrorLambdaS-NLuaTO09Fk4O'
    });
  });

  it('should handle invalid action', async () => {
    const response = await handler(invalidActionEvent, {} as any);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Invalid action');
  });

  it('should handle missing action', async () => {
    const response = await handler(missingActionEvent, {} as any);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('Invalid action');
  });

  it('should handle missing rule name mapping', async () => {
    delete process.env.RULE_NAME_MAPPING;
    const response = await handler(startEvent, {} as any);
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).message).toContain('Rule name not found');
  });

  it('should handle invalid lambda name', async () => {
    const invalidLambdaEvent = {
      action: 'start',
      rules: ['NonExistentLambda']
    };
    const response = await handler(invalidLambdaEvent, {} as any);
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('No valid rules specified. Check the rule names or use triggerAll: true to process all rules.');
    expect(body.availableRules).toEqual([
      'ConnectionErrorLambda',
      'ThrottlingErrorLambda',
      'MissingRecordsLambda'
    ]);
  });

  it('should handle CloudWatch alarm actions correctly for start of regular lambda', async () => {
    const { EnableAlarmActionsCommand } = require('@aws-sdk/client-cloudwatch');
    await handler(startSingleLambdaEvent, {} as any);
    expect(EnableAlarmActionsCommand).toHaveBeenCalledWith({
      AlarmNames: [
        'TestStack-ConnectionErrorLambdaErrorAlarm',
        'TestStack-ConnectionErrorLambdaInvocationAlarm'
      ]
    });
  });

  it('should handle CloudWatch alarm actions correctly for MissingRecordsLambda start', async () => {
    const { EnableAlarmActionsCommand } = require('@aws-sdk/client-cloudwatch');
    await handler(startMissingRecordsLambdaEvent, {} as any);
    expect(EnableAlarmActionsCommand).toHaveBeenCalledWith({
      AlarmNames: [
        'TestStack-MissingRecordsLambdaErrorAlarm',
        'TestStack-MissingRecordsLambdaInvocationAlarm',
        'TestStack-MissingRecordsLambdaHttp500Alarm'
      ]
    });
  });

  it('should handle CloudWatch alarm actions correctly for stop', async () => {
    const { DisableAlarmActionsCommand } = require('@aws-sdk/client-cloudwatch');
    await handler(stopEvent, {} as any);
    expect(DisableAlarmActionsCommand).toHaveBeenCalledWith({
      AlarmNames: [
        'TestStack-ConnectionErrorLambdaErrorAlarm',
        'TestStack-ConnectionErrorLambdaInvocationAlarm'
      ]
    });
  });

  it('should handle triggerAll flag correctly', async () => {
    const triggerAllEvent = {
      action: 'start',
      triggerAll: true
    };
    const response = await handler(triggerAllEvent, {} as any);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.isAllRules).toBe(true);
    expect(body.totalRulesProcessed).toBe(3); // Based on the mock RULE_NAME_MAPPING
  });

  it('should process all rules when no specific rules are provided', async () => {
    const noRulesEvent = {
      action: 'start'
    };
    const response = await handler(noRulesEvent, {} as any);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.isAllRules).toBe(true);
    expect(body.totalRulesProcessed).toBe(3);
  });

  it('should include available rules in error response when invalid rules are specified', async () => {
    const invalidRulesEvent = {
      action: 'start',
      rules: ['NonExistentRule']
    };
    const response = await handler(invalidRulesEvent, {} as any);
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.availableRules).toEqual([
      'ConnectionErrorLambda',
      'ThrottlingErrorLambda',
      'MissingRecordsLambda'
    ]);
  });