import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AIOpsInvestigationGroup } from '../../lib/services/aiops-investigation-group';

describe('AIOpsInvestigationGroup', () => {
  test('creates investigation group with correct properties', () => {
    const stack = new Stack();
    
    new AIOpsInvestigationGroup(stack, 'TestGroup', {
      name: 'test-group',
      roleArn: 'arn:aws:iam::123456789012:role/TestRole',
      accountId: '123456789012',
      region: 'us-east-1'
    });

    const template = Template.fromStack(stack);
    
    template.hasResourceProperties('AWS::AIOps::InvestigationGroup', {
      Name: 'test-group',
      RoleArn: 'arn:aws:iam::123456789012:role/TestRole',
      InvestigationGroupPolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: {
            Service: 'aiops.alarms.cloudwatch.amazonaws.com'
          },
          Action: [
            'aiops:CreateInvestigation',
            'aiops:CreateInvestigationEvent'
          ],
          Resource: '*',
          Condition: {
            StringEquals: {
              'aws:SourceAccount': '123456789012'
            },
            ArnLike: {
              'aws:SourceArn': 'arn:aws:cloudwatch:us-east-1:123456789012:alarm:*'
            }
          }
        }]
      })
    });
  });
});