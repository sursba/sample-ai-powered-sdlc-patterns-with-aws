import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AiOpsActions } from '../lib/services/aiops-actions';

describe('AiOpsActions', () => {
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    stack = new cdk.Stack();
    const aiopsActions = new AiOpsActions(stack, 'TestAiOpsActions');
    template = Template.fromStack(stack);
  });

  test('creates IAM role with AIOpsAssistantPolicy', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'aiops.amazonaws.com'
            }
          }
        ],
        Version: '2012-10-17'
      },
      ManagedPolicyArns: [
        'arn:aws:iam::aws:policy/AIOpsAssistantPolicy'
      ],
      RoleName: 'AIOpsAssistantRole'
    });
  });

  test('creates AIOps Investigation Group', () => {
    template.hasResourceProperties('AWS::AIOps::InvestigationGroup', {
      Name: 'TestInvestigationGroup1'
    });
  });

  test('Investigation Group uses the created IAM role', () => {
    const roleRef = { Ref: 'TestAiOpsActionsAIOpsAssistantRole1234567' }; // The exact suffix will be different
    template.hasResourceProperties('AWS::AIOps::InvestigationGroup', {
      RoleArn: {
        'Fn::GetAtt': [
          template.findResources('AWS::IAM::Role')['TestAiOpsActionsAIOpsAssistantRole1234567'].Properties.RoleName,
          'Arn'
        ]
      }
    });
  });
});