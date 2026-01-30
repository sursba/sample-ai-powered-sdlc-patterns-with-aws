import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';

interface ObservabilityStackProps extends cdk.StackProps {
chatHandlerFn: string;
}

export class ObservabilityStack extends cdk.Stack {
constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
super(scope, id, props);

const fnMetric = new cw.Metric({
namespace: 'AWS/Lambda',
metricName: 'Errors',
dimensionsMap: { FunctionName: props.chatHandlerFn },
statistic: 'Sum',
period: cdk.Duration.minutes(5),
});

const dashboard = new cw.Dashboard(this, 'IssueMgmtDashboard', {
dashboardName: 'IssueMgmt-Operational',
});

dashboard.addWidgets(new cw.GraphWidget({
title: 'ChatOrchestrator Errors',
left: [fnMetric],
}));
}
}
