#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { UiGeneratorStack } from '../lib/ui-generator-stack';
import { config } from '../lib/config';

const app = new cdk.App();
new UiGeneratorStack(app, 'UiGeneratorStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: config.region || process.env.CDK_DEFAULT_REGION 
  },
  description: 'UI/UX Generator application using AWS Bedrock',
  tags: {
    Application: 'UiGenerator',
    Environment: config.environment,
  },
});