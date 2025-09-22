import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class SecretsStack extends cdk.Stack {
readonly jiraSecretArn: string;
constructor(scope: Construct, id: string, props?: cdk.StackProps) {
super(scope, id, props);

const jiraSecret = new secretsmanager.Secret(this, 'JiraSecret', {
secretName: 'issue-mgmt/jira',
description: 'Jira credentials for intelligent issue management sample',
generateSecretString: {
secretStringTemplate: JSON.stringify({
baseUrl: 'https://your-domain.atlassian.net',
projectKey: 'PAY',
email: 'you@company.com',
}),
generateStringKey: 'pat',
excludePunctuation: true,
},
});

this.jiraSecretArn = jiraSecret.secretArn;
}
}