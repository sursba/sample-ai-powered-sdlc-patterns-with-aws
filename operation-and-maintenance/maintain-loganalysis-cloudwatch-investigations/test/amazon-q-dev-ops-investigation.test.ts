import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as AmazonQDevOpsInvestigation from '../lib/amazon-q-dev-ops-investigation-stack';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

describe('AmazonQDevOpsInvestigation Stack', () => {
  let template: Template;
  let stack: cdk.Stack;
  let app: cdk.App;

  beforeAll(() => {
    app = new cdk.App();
    stack = new AmazonQDevOpsInvestigation.AmazonQDevOpsInvestigationStack(app, 'MyTestStack');
    // Add the cdk-nag AwsSolutions Pack
    Aspects.of(app).add(new AwsSolutionsChecks());
    template = Template.fromStack(stack);
  });

  test('Creates three specialized Lambda functions and one control Lambda', () => {
    template.resourceCountIs('AWS::Lambda::Function', 4); // 3 specialized + 1 control
  });

  test('Creates DynamoDB table with encryption', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 1);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PROVISIONED',
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1
      },
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH'
        }
      ],
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S'
        }
      ],
      SSESpecification: {
        SSEEnabled: true,
        KMSMasterKeyId: Match.anyValue()
      },
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true
      }
    });
  });

  test('Lambda functions have X-Ray tracing and Lambda Insights configured', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      TracingConfig: {
        Mode: 'Active'
      }
    });

    // Verify Lambda Insights is enabled
    template.hasResourceProperties('AWS::Lambda::Function', {
      Layers: Match.arrayWith([Match.anyValue()])
    });

    // Verify X-Ray IAM permissions
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Effect: 'Allow',
            Action: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords'
            ],
            Resource: ['*']
          }
        ])
      }
    });
  });

  test('Creates CloudWatch Alarms for each Lambda and DynamoDB', () => {
    // We expect 10 alarms in total:
    // - 2 per Lambda (error and invocation) x 3 Lambdas = 6
    // - 4 DynamoDB alarms (read capacity, write capacity, read throttle, write throttle)
    template.resourceCountIs('AWS::CloudWatch::Alarm', 10);
  });

  test('Creates EventBridge rules for each Lambda', () => {
    // We expect 3 rules (one per Lambda)
    template.resourceCountIs('AWS::Events::Rule', 3);

    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(1 minute)',
      State: 'DISABLED'  // Rules should be initially disabled
    });
  });

  test('Lambda functions have correct configuration', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      Handler: 'handler',
      Timeout: 30,
      MemorySize: 256,
      ReservedConcurrentExecutions: 100,
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
          ERROR_CODE: Match.anyValue(),
          LAMBDA_NAME: Match.anyValue()
        })
      })
    });
  });

  test('Lambda functions have DynamoDB permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: [
              'dynamodb:BatchGetItem',
              'dynamodb:GetItem',
              'dynamodb:Query',
              'dynamodb:Scan',
              'dynamodb:BatchWriteItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem'
            ],
            Effect: 'Allow',
            Resource: {
              'Fn::GetAtt': [
                template.findResources('AWS::DynamoDB::Table')['ErrorSimulationTable'].logicalId,
                'Arn'
              ]
            }
          }
        ]
      }
    });
  });

  test('Control Lambda has correct configuration', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      Handler: 'handler',
      Timeout: 60,  // 1 minute timeout
      Environment: {
        Variables: Match.objectLike({
          STACK_NAME: {
            Ref: 'AWS::StackName'
          },
          RULE_NAME_MAPPING: Match.anyValue()
        })
      }
    });
  });

  test('Control Lambda has required IAM permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              'events:EnableRule',
              'events:DisableRule'
            ],
            Effect: 'Allow',
            Resource: Match.arrayWith([Match.anyValue()])
          }
        ])
      }
    });
  });

  test('CloudWatch Alarms have correct configuration', () => {
    // Test error alarm configuration
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      EvaluationPeriods: 1,
      Threshold: 1,
      ActionsEnabled: true
    });

    // Test invocation alarm configuration
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      EvaluationPeriods: 1,
      Threshold: 10,
      ActionsEnabled: true
    });

    // Test DynamoDB read capacity alarm configuration
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'ConsumedReadCapacityUnits',
      Namespace: 'AWS/DynamoDB',
      EvaluationPeriods: 1,
      Threshold: 100,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      AlarmDescription: 'DynamoDB table is reaching high read capacity consumption'
    });

    // Test DynamoDB write capacity alarm configuration
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'ConsumedWriteCapacityUnits',
      Namespace: 'AWS/DynamoDB',
      EvaluationPeriods: 1,
      Threshold: 100,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      AlarmDescription: 'DynamoDB table is reaching high write capacity consumption'
    });

    // Test DynamoDB throttle alarm configuration
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      EvaluationPeriods: 1,
      Threshold: 1,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      AlarmDescription: Match.stringLikeRegexp('.*throttling.*')
    });
  });

  test('Creates SNS Topic for alarms with encryption', () => {
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.hasResourceProperties('AWS::SNS::Topic', {
      DisplayName: 'CloudWatch Alarms Topic',
      KmsMasterKeyId: Match.anyValue()
    });
  });

  test('SNS Topic has correct policy for Amazon Q AIOps', () => {
    template.hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([{
          Sid: 'AIOPS-CHAT-PUBLISH',
          Effect: 'Allow',
          Principal: {
            Service: 'aiops.amazonaws.com'
          },
          Action: 'sns:Publish',
          Resource: Match.anyValue(),
          Condition: {
            StringEquals: {
              'aws:SourceAccount': { Ref: 'AWS::AccountId' }
            }
          }
        }])
      }
    });
  });

  test('Creates AIOps IAM role with correct permissions', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [{
          Effect: 'Allow',
          Principal: {
            Service: 'aiops.amazonaws.com'
          },
          Action: 'sts:AssumeRole'
        }]
      },
      ManagedPolicyArns: [{
        'Fn::Join': [
          '',
          [
            'arn:',
            { Ref: 'AWS::Partition' },
            ':iam::aws:policy/AIOpsAssistantPolicy'
          ]
        ]
      }],
      RoleName: 'AIOpsAssistantRole'
    });
  });

  test('Creates AIOps Investigation Group with correct configuration', () => {
    // Skip this test if investigation group ID is provided in context
    if (!app.node.tryGetContext('InvestigationGroupID')) {
      template.hasResourceProperties('Custom::AIOpsInvestigationGroup', {
        ServiceToken: Match.anyValue(),
        Name: 'DefaultInvestigationGroup',
        RoleArn: {
          'Fn::GetAtt': [
            Match.stringLikeRegexp('AIOpsAssistantRole.*'),
            'Arn'
          ]
        },
        AccountId: { Ref: 'AWS::AccountId' },
        Region: { Ref: 'AWS::Region' }
      });
    }
  });

  test('CloudWatch Alarms are connected to AIOps Investigation Group', () => {
    const investigationGroupId = app.node.tryGetContext('InvestigationGroupID');
    
    if (investigationGroupId) {
      // When investigation group ID is provided
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmActions: Match.arrayWith([{
          'Fn::Join': [
            '',
            [
              'arn:aws:aiops:',
              { Ref: 'AWS::Region' },
              ':',
              { Ref: 'AWS::AccountId' },
              ':investigation-group/',
              investigationGroupId
            ]
          ]
        }])
      });
    } else {
      // When using default investigation group
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmActions: Match.arrayWith([{
          'Fn::GetAtt': [
            Match.stringLikeRegexp('InvestigationGroup.*'),
            'Arn'
          ]
        }])
      });
    }
  });



  test('CloudWatch Alarms are connected to SNS Topic', () => {
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmActions: Match.arrayWith([Match.anyValue()])
    });
  });

  test('Stack complies with AWS Solutions security best practices', () => {
    // Verify Lambda functions have reserved concurrency
    template.hasResourceProperties('AWS::Lambda::Function', {
      ReservedConcurrentExecutions: 100
    });

    // Verify DynamoDB table has encryption enabled
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      SSESpecification: {
        SSEEnabled: true,
        KMSMasterKeyId: Match.anyValue()
      }
    });

    // Verify SNS topic has encryption enabled
    template.hasResourceProperties('AWS::SNS::Topic', {
      KmsMasterKeyId: Match.anyValue()
    });

    // Verify Lambda functions have appropriate timeout and memory settings
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: Match.numberGreaterThan(0),
      MemorySize: 256
    });

    // Verify KMS keys are created for encryption
    template.resourceCountIs('AWS::KMS::Key', 2); // One for DynamoDB, one for SNS
  });

  test('Creates and configures X-Ray Lambda Layer', () => {
    // Verify Lambda Layer is created
    template.hasResourceProperties('AWS::Lambda::LayerVersion', {
      Description: Match.stringLikeRegexp('.*X-Ray.*'),
      CompatibleRuntimes: Match.arrayWith(['nodejs20.x'])
    });

    // Verify all Lambda functions use the X-Ray Layer
    template.hasResourceProperties('AWS::Lambda::Function', {
      Layers: Match.arrayWith([{
        Ref: Match.stringLikeRegexp('XRaySdkLayer.*')
      }])
    });
  });

  test('Has correct NAG suppressions', () => {
    const stack = Template.fromStack(app.node.findChild('MyTestStack') as cdk.Stack);
    const suppressions = NagSuppressions.getStackSuppressions(stack);
    
    expect(suppressions).toContainEqual(expect.objectContaining({
      id: 'AwsSolutions-IAM4',
      reason: 'CloudWatch and X-Ray permissions require wildcard resources for proper functionality'
    }));

    expect(suppressions).toContainEqual(expect.objectContaining({
      id: 'AwsSolutions-IAM5',
      reason: 'Lambda role policies require specific service permissions'
    }));
  });
});