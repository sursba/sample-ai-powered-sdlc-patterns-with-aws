import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface AIOpsInvestigationGroupProps {
  readonly name: string;
  readonly roleArn: string;
  readonly accountId: string;
  readonly region: string;
}

export class AIOpsInvestigationGroup extends Construct {
  private readonly investigationGroupArn: string;

  constructor(scope: Construct, id: string, props: AIOpsInvestigationGroupProps) {
    super(scope, id);

    const investigationGroup = new cdk.CfnResource(this, 'InvestigationGroup', {
      type: 'AWS::AIOps::InvestigationGroup',
      properties: {
        Name: props.name,
        RoleArn: props.roleArn,
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
                'aws:SourceAccount': props.accountId
              },
              ArnLike: {
                'aws:SourceArn': `arn:aws:cloudwatch:${props.region}:${props.accountId}:alarm:*`
              }
            }
          }]
        })
      }
    });

    this.investigationGroupArn = investigationGroup.ref;
  }

  /**
   * Returns the ARN of the investigation group
   */
  public getArn(): string {
    return this.investigationGroupArn;
  }
}