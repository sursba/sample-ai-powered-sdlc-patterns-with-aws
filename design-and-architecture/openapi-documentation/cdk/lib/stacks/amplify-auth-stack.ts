import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

export interface AmplifyAuthStackProps extends cdk.StackProps {
  domainAnalyzerFunction: lambda.Function;
  docGeneratorFunction: lambda.Function;
  backendFunction?: lambda.Function;
  backendFunctionUrl?: string;
  apiGatewayUrl: string;
}

export class AmplifyAuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly amplifyApp: amplify.App;
  public readonly cognitoDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AmplifyAuthStackProps) {
    super(scope, id, props);

    // Create Cognito User Pool with security best practices
    this.userPool = new cognito.UserPool(this, 'OpenApiDocsUserPool', {
      userPoolName: 'openapi-docs-user-pool',
      selfSignUpEnabled: false, // Admin-managed users only
      mfa: cognito.Mfa.OPTIONAL, // Optional MFA for CDK nag compliance
      mfaSecondFactor: {
        sms: false,
        otp: true // Time-based One-Time Password (TOTP) only
      },
      signInAliases: {
        username: true,
        email: true
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7)
      },
      // Enable advanced security features for better compliance
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: false
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY // For development - change to RETAIN for production
    });

    // Create Cognito Domain for Hosted UI
    this.cognitoDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `openapi-docs-${this.account}-${this.region}`
      }
    });

    // Create IAM role for Amplify service
    const amplifyServiceRole = new iam.Role(this, 'AmplifyServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      description: 'Service role for AWS Amplify with Lambda invoke permissions',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify')
      ]
    });

    // Add Lambda invoke permissions for the Express server
    amplifyServiceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunction'
      ],
      resources: [
        props.domainAnalyzerFunction.functionArn,
        props.docGeneratorFunction.functionArn
      ]
    }));

    // Suppress cdk-nag warnings for Amplify service role
    NagSuppressions.addResourceSuppressions(amplifyServiceRole, [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'AWS managed policy AdministratorAccess-Amplify is required for Amplify service functionality'
      }
    ]);

    // Create Amplify App for React frontend deployment
    this.amplifyApp = new amplify.App(this, 'OpenApiDocumentationApp', {
      appName: 'openapi-documentation-app',
      description: 'React Frontend for OpenAPI Documentation with Cognito Authentication',
      role: amplifyServiceRole,
      platform: amplify.Platform.WEB, // Static web app only
      environmentVariables: {
        // React build configuration
        NODE_ENV: 'production',

        // Cognito Configuration
        REACT_APP_AWS_REGION: this.region,
        REACT_APP_USER_POOL_ID: this.userPool.userPoolId,
        REACT_APP_USER_POOL_CLIENT_ID: '', // Will be updated after client creation
        REACT_APP_AUTH_DOMAIN: `${this.cognitoDomain.domainName}.auth.${this.region}.amazoncognito.com`,

        // API Configuration - Use Lambda Function URL directly
        REACT_APP_API_URL: props.backendFunctionUrl || 'https://placeholder-api-url.com'
      },
      customRules: [
        // SPA routing - redirect all routes to index.html for client-side routing
        {
          source: '/<*>',
          target: '/index.html',
          status: amplify.RedirectStatus.NOT_FOUND_REWRITE
        }
      ]
    });

    // Create User Pool Client with OAuth configuration (after Amplify App)
    this.userPoolClient = new cognito.UserPoolClient(this, 'OpenApiDocsUserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: 'openapi-docs-client',
      generateSecret: false, // Required for web applications
      oAuth: {
        flows: {
          authorizationCodeGrant: true
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE
        ],
        callbackUrls: [
          'http://localhost:3000', // For local development
          // Production URL will be updated after deployment
        ],
        logoutUrls: [
          'http://localhost:3000', // For local development
          // Production URL will be updated after deployment
        ]
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO
      ],
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true
      },
      preventUserExistenceErrors: true
    });

    // Create Cognito Identity Pool for AWS credentials
    this.identityPool = new cognito.CfnIdentityPool(this, 'OpenApiDocsIdentityPool', {
      identityPoolName: 'openapi-docs-identity-pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: this.userPoolClient.userPoolClientId,
        providerName: this.userPool.userPoolProviderName
      }]
    });

    // Create IAM roles for authenticated users
    const authenticatedRole = new iam.Role(this, 'CognitoAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': this.identityPool.ref
        },
        'ForAnyValue:StringLike': {
          'cognito-identity.amazonaws.com:amr': 'authenticated'
        }
      }, 'sts:AssumeRoleWithWebIdentity'),
      description: 'Role for authenticated Cognito users with Lambda Function URL access'
    });

    // Add permissions to invoke Lambda Function URL
    const lambdaResources = [
      props.domainAnalyzerFunction.functionArn,
      props.docGeneratorFunction.functionArn
    ];

    if (props.backendFunction) {
      lambdaResources.push(props.backendFunction.functionArn);
    }

    authenticatedRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:InvokeFunctionUrl'
      ],
      resources: lambdaResources
    }));

    // Attach role to Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn
      }
    });

    // Update Amplify App environment variables with User Pool Client ID and Identity Pool ID
    this.amplifyApp.addEnvironment('REACT_APP_USER_POOL_CLIENT_ID', this.userPoolClient.userPoolClientId);
    this.amplifyApp.addEnvironment('REACT_APP_IDENTITY_POOL_ID', this.identityPool.ref);

    // Create a custom resource to update callback URLs after deployment
    const updateCallbackUrlsRole = new iam.Role(this, 'UpdateCallbackUrlsRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Lambda function to update Cognito callback URLs'
    });

    updateCallbackUrlsRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
      ]
    }));

    updateCallbackUrlsRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:UpdateUserPoolClient'
      ],
      resources: [this.userPool.userPoolArn]
    }));

    const updateCallbackUrlsFunction = new lambda.Function(this, 'UpdateCallbackUrlsFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      role: updateCallbackUrlsRole,
      timeout: cdk.Duration.seconds(30),
      code: lambda.Code.fromInline(`
        const { CognitoIdentityProviderClient, UpdateUserPoolClientCommand } = require('@aws-sdk/client-cognito-identity-provider');
        
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
          
          try {
            if (event.RequestType === 'Create' || event.RequestType === 'Update') {
              const { UserPoolId, ClientId, AmplifyAppId } = event.ResourceProperties;
              const amplifyUrl = \`https://main.\${AmplifyAppId}.amplifyapp.com\`;
              
              const command = new UpdateUserPoolClientCommand({
                UserPoolId: UserPoolId,
                ClientId: ClientId,
                CallbackURLs: [
                  'http://localhost:3000',
                  amplifyUrl
                ],
                LogoutURLs: [
                  'http://localhost:3000',
                  amplifyUrl
                ],
                SupportedIdentityProviders: ['COGNITO'],
                AllowedOAuthFlows: ['code'],
                AllowedOAuthScopes: ['openid', 'email', 'profile'],
                AllowedOAuthFlowsUserPoolClient: true
              });
              
              await client.send(command);
              console.log(\`Updated callback URLs to include: \${amplifyUrl}\`);
            }
            
            // Send success response
            await sendResponse(event, 'SUCCESS', { Message: 'Callback URLs updated successfully' });
          } catch (error) {
            console.error('Error updating callback URLs:', error);
            await sendResponse(event, 'FAILED', { Error: error.message });
          }
        };
        
        async function sendResponse(event, status, data) {
          const responseBody = {
            Status: status,
            Reason: data.Error || 'Operation completed',
            PhysicalResourceId: event.LogicalResourceId,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: data
          };
          
          const https = require('https');
          const url = require('url');
          
          return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(event.ResponseURL);
            const options = {
              hostname: parsedUrl.hostname,
              port: 443,
              path: parsedUrl.path,
              method: 'PUT',
              headers: {
                'Content-Type': '',
                'Content-Length': JSON.stringify(responseBody).length
              }
            };
            
            const req = https.request(options, (res) => {
              console.log('Response status:', res.statusCode);
              resolve();
            });
            
            req.on('error', (err) => {
              console.error('Error sending response:', err);
              reject(err);
            });
            
            req.write(JSON.stringify(responseBody));
            req.end();
          });
        }
      `),
      description: 'Lambda function to update Cognito callback URLs with Amplify URL'
    });

    // Create custom resource to trigger the callback URL update
    new cdk.CustomResource(this, 'UpdateCallbackUrls', {
      serviceToken: updateCallbackUrlsFunction.functionArn,
      properties: {
        UserPoolId: this.userPool.userPoolId,
        ClientId: this.userPoolClient.userPoolClientId,
        AmplifyAppId: this.amplifyApp.appId
      }
    });

    // Create main branch for React frontend deployment
    this.amplifyApp.addBranch('main', {
      branchName: 'main',
      autoBuild: true,
      environmentVariables: {
        AMPLIFY_DIFF_DEPLOY: 'false'
        // Removed AMPLIFY_MONOREPO_APP_ROOT since we're using client-only structure
      }
    });

    // Alternative: Deploy from S3 zip (uncomment to use)
    // Note: This requires pre-building and uploading the client app to S3
    /*
    const deploymentBucket = new s3.Bucket(this, 'AmplifyDeploymentBucket', {
      bucketName: `amplify-deployment-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Upload built client app to S3 (would need to be done separately)
    const deployment = new s3deploy.BucketDeployment(this, 'DeployClientApp', {
      sources: [s3deploy.Source.asset('../client/dist')], // Pre-built client
      destinationBucket: deploymentBucket,
      destinationKeyPrefix: 'client-app'
    });

    // Create branch with S3 source
    this.amplifyApp.addBranch('main', {
      branchName: 'main',
      autoBuild: false, // No build needed, already built
      sourceCodeProvider: {
        s3: {
          bucket: deploymentBucket.bucketName,
          key: 'client-app'
        }
      }
    });
    */

    // Create admin user with configurable credentials
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminTempPassword = process.env.ADMIN_TEMP_PASSWORD || 'TempPass123!';

    new cognito.CfnUserPoolUser(this, 'AdminUser', {
      userPoolId: this.userPool.userPoolId,
      username: adminUsername,
      userAttributes: [
        {
          name: 'email',
          value: adminEmail
        },
        {
          name: 'email_verified',
          value: 'true'
        }
      ],
      messageAction: 'SUPPRESS', // Don't send welcome email
      forceAliasCreation: false
    });

    // Lambda function for user management operations (to be used post-deployment)
    const userManagementRole = new iam.Role(this, 'UserManagementLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Lambda function to manage Cognito users'
    });

    userManagementRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ],
      resources: [
        `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/*`
      ]
    }));

    userManagementRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:AdminGetUser'
      ],
      resources: [this.userPool.userPoolArn]
    }));

    const userManagementFunction = new lambda.Function(this, 'UserManagementFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      role: userManagementRole,
      timeout: cdk.Duration.seconds(30),
      environment: {
        USER_POOL_ID: this.userPool.userPoolId
      },
      code: lambda.Code.fromInline(`
        const { CognitoIdentityProviderClient, AdminSetUserPasswordCommand, AdminCreateUserCommand, AdminDeleteUserCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
        
        exports.handler = async (event) => {
          const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
          const userPoolId = process.env.USER_POOL_ID;
          
          try {
            const { action, username, password, email } = event;
            
            switch (action) {
              case 'setPassword':
                if (!username || !password) {
                  throw new Error('Username and password are required for setPassword action');
                }
                
                const setPasswordCommand = new AdminSetUserPasswordCommand({
                  UserPoolId: userPoolId,
                  Username: username,
                  Password: password,
                  Permanent: true
                });
                
                await client.send(setPasswordCommand);
                
                return {
                  statusCode: 200,
                  body: JSON.stringify({ 
                    message: \`Password set successfully for user: \${username}\`
                  })
                };
                
              case 'createUser':
                if (!username || !email) {
                  throw new Error('Username and email are required for createUser action');
                }
                
                const createUserCommand = new AdminCreateUserCommand({
                  UserPoolId: userPoolId,
                  Username: username,
                  UserAttributes: [
                    { Name: 'email', Value: email },
                    { Name: 'email_verified', Value: 'true' }
                  ],
                  TemporaryPassword: password || 'TempPass123!',
                  MessageAction: 'SUPPRESS'
                });
                
                await client.send(createUserCommand);
                
                return {
                  statusCode: 200,
                  body: JSON.stringify({ 
                    message: \`User created successfully: \${username}\`
                  })
                };
                
              case 'deleteUser':
                if (!username) {
                  throw new Error('Username is required for deleteUser action');
                }
                
                const deleteUserCommand = new AdminDeleteUserCommand({
                  UserPoolId: userPoolId,
                  Username: username
                });
                
                await client.send(deleteUserCommand);
                
                return {
                  statusCode: 200,
                  body: JSON.stringify({ 
                    message: \`User deleted successfully: \${username}\`
                  })
                };
                
              case 'getUser':
                if (!username) {
                  throw new Error('Username is required for getUser action');
                }
                
                const getUserCommand = new AdminGetUserCommand({
                  UserPoolId: userPoolId,
                  Username: username
                });
                
                const userResponse = await client.send(getUserCommand);
                
                return {
                  statusCode: 200,
                  body: JSON.stringify({ 
                    user: {
                      username: userResponse.Username,
                      userStatus: userResponse.UserStatus,
                      enabled: userResponse.Enabled,
                      userAttributes: userResponse.UserAttributes
                    }
                  })
                };
                
              default:
                throw new Error(\`Unknown action: \${action}\`);
            }
          } catch (error) {
            console.error('Error in user management operation:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ 
                error: error.message,
                action: event.action || 'unknown'
              })
            };
          }
        };
      `),
      description: 'Lambda function for Cognito user management operations'
    });

    // Suppress cdk-nag warnings for UpdateCallbackUrlsRole and its DefaultPolicy
    NagSuppressions.addResourceSuppressions(updateCallbackUrlsRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are necessary for CloudWatch Logs (Lambda runtime requirement)',
        appliesTo: [
          'Resource::arn:aws:logs:eu-west-1:246217239581:log-group:/aws/lambda/*'
        ]
      }
    ], true); // Apply to all child resources including DefaultPolicy



    // Suppress cdk-nag warnings for UserManagementRole and its DefaultPolicy
    NagSuppressions.addResourceSuppressions(userManagementRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Wildcard permissions are necessary for CloudWatch Logs (Lambda runtime requirement)',
        appliesTo: [
          'Resource::arn:aws:logs:eu-west-1:246217239581:log-group:/aws/lambda/*'
        ]
      }
    ], true); // Apply to all child resources including DefaultPolicy



    // Suppress cdk-nag warnings for Cognito User Pool
    NagSuppressions.addResourceSuppressions(this.userPool, [
      {
        id: 'AwsSolutions-COG2',
        reason: 'MFA is configured as OPTIONAL to balance security and usability. Users can enable MFA (SMS/TOTP) but it is not mandatory for this application.'
      },
      {
        id: 'AwsSolutions-COG3',
        reason: 'Advanced Security Mode is intentionally disabled to avoid additional costs in development environment. In production, consider enabling ENFORCED mode for threat detection.'
      }
    ]);

    // Stack outputs for frontend configuration
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${this.stackName}-UserPoolId`
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${this.stackName}-UserPoolClientId`
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `${this.stackName}-IdentityPoolId`
    });

    new cdk.CfnOutput(this, 'AuthDomain', {
      value: `${this.cognitoDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Auth Domain',
      exportName: `${this.stackName}-AuthDomain`
    });

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.amplifyApp.appId,
      description: 'Amplify App ID',
      exportName: `${this.stackName}-AmplifyAppId`
    });

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: `https://main.${this.amplifyApp.appId}.amplifyapp.com`,
      description: 'Amplify App URL',
      exportName: `${this.stackName}-AmplifyAppUrl`
    });

    new cdk.CfnOutput(this, 'UserManagementFunctionName', {
      value: userManagementFunction.functionName,
      description: 'Lambda function name for user management operations',
      exportName: `${this.stackName}-UserManagementFunctionName`
    });

    new cdk.CfnOutput(this, 'UserManagementFunctionArn', {
      value: userManagementFunction.functionArn,
      description: 'Lambda function ARN for user management operations',
      exportName: `${this.stackName}-UserManagementFunctionArn`
    });

    new cdk.CfnOutput(this, 'AdminUsername', {
      value: adminUsername,
      description: 'Admin username (configurable via ADMIN_USERNAME env var)',
      exportName: `${this.stackName}-AdminUsername`
    });

    new cdk.CfnOutput(this, 'AdminEmail', {
      value: adminEmail,
      description: 'Admin email (configurable via ADMIN_EMAIL env var)',
      exportName: `${this.stackName}-AdminEmail`
    });

    new cdk.CfnOutput(this, 'AdminTempPassword', {
      value: adminTempPassword,
      description: 'Temporary admin password (configurable via ADMIN_TEMP_PASSWORD env var)',
      exportName: `${this.stackName}-AdminTempPassword`
    });
  }
}