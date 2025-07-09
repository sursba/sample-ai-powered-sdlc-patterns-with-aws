import * as path from 'path';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class XrayLambdaLayer extends lambda.LayerVersion {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      code: lambda.Code.fromAsset(path.join(__dirname, '/lambda-handler/xray-layer')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Lambda Layer with aws-xray-sdk-core',
    });
  }
}