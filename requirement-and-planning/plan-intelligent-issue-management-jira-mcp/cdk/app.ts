import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { SecretsStack } from '../lib/SecretsStack';
import { DataStack } from '../lib/DataStack';
import { CoreStack } from '../lib/CoreStack';
import { ObservabilityStack } from '../lib/ObservabilityStack';

const app = new App();

const env = {
account: process.env.CDK_DEFAULT_ACCOUNT,
region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const secrets = new SecretsStack(app, 'IssueMgmtJiraSecretsStack', { env });
const data = new DataStack(app, 'IssueMgmtDataStack', { env });
const core = new CoreStack(app, 'IssueMgmtCoreStack', {
env,
artifactsBucket: data.artifactsBucketName,
promptsBucket: data.promptsBucketName,
issuesTableName: data.issuesTableName,
peopleTableName: data.peopleTableName,
configTableName: data.configTableName,
auditTableName: data.auditTableName,
jiraSecretArn: secrets.jiraSecretArn,
aossCollectionName: data.aossCollectionName,
aossCollectionArn: data.aossCollectionArn,
});
core.addDependency(secrets);
core.addDependency(data);

new ObservabilityStack(app, 'IssueMgmtObservabilityStack', {
env,
chatHandlerFn: core.chatHandlerName,
});
