import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { AIOpsInvestigationGroup } from './aiops-investigation-group';

class CustomAlarmAction implements cloudwatch.IAlarmAction {
  constructor(private readonly actionArn: string) {}

  bind(_scope: Construct, _alarm: cloudwatch.Alarm): cloudwatch.AlarmActionConfig {
    return {
      alarmActionArn: this.actionArn,
    };
  }
}

export class AiOpsActions extends Construct {
  public readonly alarmAction: cloudwatch.IAlarmAction;
  public readonly alarmActionArn: string;

  constructor(scope: Construct, id: string, investgationGroupId?: string) {
    super(scope, id);

    if (investgationGroupId){
      this.alarmAction = new CustomAlarmAction(`arn:aws:aiops:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:investigation-group/${investgationGroupId}`);
    }
    else {
      // Create IAM role for AIOps
      const aiopsRole = new iam.Role(this, 'AIOpsAssistantRole', {
        assumedBy: new iam.ServicePrincipal('aiops.amazonaws.com'),
        roleName: 'AIOpsAssistantRole',
        managedPolicies: [
          iam.ManagedPolicy.fromManagedPolicyArn(
            this,
            'AIOpsAssistantPolicy',
            'arn:aws:iam::aws:policy/AIOpsAssistantPolicy'
          )
        ]
      });

      const investigationGroup = new AIOpsInvestigationGroup(this, 'InvestigationGroup', {
        name: 'DefaultInvestigationGroup',
        roleArn: aiopsRole.roleArn,
        accountId: cdk.Stack.of(this).account,
        region: cdk.Stack.of(this).region
      });
    
      this.alarmAction = new CustomAlarmAction(investigationGroup.getArn());
    }
  }
}
