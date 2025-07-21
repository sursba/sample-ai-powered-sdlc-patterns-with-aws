"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmplifyAuthStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const amplify = require("@aws-cdk/aws-amplify-alpha");
const iam = require("aws-cdk-lib/aws-iam");
const lambda = require("aws-cdk-lib/aws-lambda");
const cdk_nag_1 = require("cdk-nag");
class AmplifyAuthStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        cdk_nag_1.NagSuppressions.addResourceSuppressions(amplifyServiceRole, [
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
        cdk_nag_1.NagSuppressions.addResourceSuppressions(updateCallbackUrlsRole, [
            {
                id: 'AwsSolutions-IAM5',
                reason: 'Wildcard permissions are necessary for CloudWatch Logs (Lambda runtime requirement)',
                appliesTo: [
                    'Resource::arn:aws:logs:eu-west-1:246217239581:log-group:/aws/lambda/*'
                ]
            }
        ], true); // Apply to all child resources including DefaultPolicy
        // Suppress cdk-nag warnings for UserManagementRole and its DefaultPolicy
        cdk_nag_1.NagSuppressions.addResourceSuppressions(userManagementRole, [
            {
                id: 'AwsSolutions-IAM5',
                reason: 'Wildcard permissions are necessary for CloudWatch Logs (Lambda runtime requirement)',
                appliesTo: [
                    'Resource::arn:aws:logs:eu-west-1:246217239581:log-group:/aws/lambda/*'
                ]
            }
        ], true); // Apply to all child resources including DefaultPolicy
        // Suppress cdk-nag warnings for Cognito User Pool
        cdk_nag_1.NagSuppressions.addResourceSuppressions(this.userPool, [
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
exports.AmplifyAuthStack = AmplifyAuthStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW1wbGlmeS1hdXRoLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYW1wbGlmeS1hdXRoLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyxtREFBbUQ7QUFDbkQsc0RBQXNEO0FBQ3RELDJDQUEyQztBQUMzQyxpREFBaUQ7QUFFakQscUNBQTBDO0FBVTFDLE1BQWEsZ0JBQWlCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFPN0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix3REFBd0Q7UUFDeEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQ2hFLFlBQVksRUFBRSx3QkFBd0I7WUFDdEMsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLDJCQUEyQjtZQUNyRCxHQUFHLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsc0NBQXNDO1lBQ2pFLGVBQWUsRUFBRTtnQkFDZixHQUFHLEVBQUUsS0FBSztnQkFDVixHQUFHLEVBQUUsSUFBSSxDQUFDLDJDQUEyQzthQUN0RDtZQUNELGFBQWEsRUFBRTtnQkFDYixRQUFRLEVBQUUsSUFBSTtnQkFDZCxLQUFLLEVBQUUsSUFBSTthQUNaO1lBQ0QsY0FBYyxFQUFFO2dCQUNkLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGFBQWEsRUFBRSxJQUFJO2dCQUNuQixjQUFjLEVBQUUsSUFBSTtnQkFDcEIsb0JBQW9CLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2FBQzNDO1lBQ0QsMERBQTBEO1lBQzFELGNBQWMsRUFBRTtnQkFDZCw0QkFBNEIsRUFBRSxJ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SUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN2QyxLQUFLLEVBQUUsYUFBYTtZQUNwQixXQUFXLEVBQUUsMERBQTBEO1lBQ3ZFLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLGdCQUFnQjtTQUM5QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNwQyxLQUFLLEVBQUUsVUFBVTtZQUNqQixXQUFXLEVBQUUsb0RBQW9EO1lBQ2pFLFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLGFBQWE7U0FDM0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsaUJBQWlCO1lBQ3hCLFdBQVcsRUFBRSx5RUFBeUU7WUFDdEYsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsb0JBQW9CO1NBQ2xELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXBvQkQsNENBb29CQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGFtcGxpZnkgZnJvbSAnQGF3cy1jZGsvYXdzLWFtcGxpZnktYWxwaGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBOYWdTdXBwcmVzc2lvbnMgfSBmcm9tICdjZGstbmFnJztcblxuZXhwb3J0IGludGVyZmFjZSBBbXBsaWZ5QXV0aFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGRvbWFpbkFuYWx5emVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgZG9jR2VuZXJhdG9yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgYmFja2VuZEZ1bmN0aW9uPzogbGFtYmRhLkZ1bmN0aW9uO1xuICBiYWNrZW5kRnVuY3Rpb25Vcmw/OiBzdHJpbmc7XG4gIGFwaUdhdGV3YXlVcmw6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEFtcGxpZnlBdXRoU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcbiAgcHVibGljIHJlYWRvbmx5IGlkZW50aXR5UG9vbDogY29nbml0by5DZm5JZGVudGl0eVBvb2w7XG4gIHB1YmxpYyByZWFkb25seSBhbXBsaWZ5QXBwOiBhbXBsaWZ5LkFwcDtcbiAgcHVibGljIHJlYWRvbmx5IGNvZ25pdG9Eb21haW46IGNvZ25pdG8uVXNlclBvb2xEb21haW47XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEFtcGxpZnlBdXRoU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gQ3JlYXRlIENvZ25pdG8gVXNlciBQb29sIHdpdGggc2VjdXJpdHkgYmVzdCBwcmFjdGljZXNcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ09wZW5BcGlEb2NzVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6ICdvcGVuYXBpLWRvY3MtdXNlci1wb29sJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiBmYWxzZSwgLy8gQWRtaW4tbWFuYWdlZCB1c2VycyBvbmx5XG4gICAgICBtZmE6IGNvZ25pdG8uTWZhLk9QVElPTkFMLCAvLyBPcHRpb25hbCBNRkEgZm9yIENESyBuYWcgY29tcGxpYW5jZVxuICAgICAgbWZhU2Vjb25kRmFjdG9yOiB7XG4gICAgICAgIHNtczogZmFsc2UsXG4gICAgICAgIG90cDogdHJ1ZSAvLyBUaW1lLWJhc2VkIE9uZS1UaW1lIFBhc3N3b3JkIChUT1RQKSBvbmx5XG4gICAgICB9LFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICB1c2VybmFtZTogdHJ1ZSxcbiAgICAgICAgZW1haWw6IHRydWVcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgICB0ZW1wUGFzc3dvcmRWYWxpZGl0eTogY2RrLkR1cmF0aW9uLmRheXMoNylcbiAgICAgIH0sXG4gICAgICAvLyBFbmFibGUgYWR2YW5jZWQgc2VjdXJpdHkgZmVhdHVyZXMgZm9yIGJldHRlciBjb21wbGlhbmNlXG4gICAgICBkZXZpY2VUcmFja2luZzoge1xuICAgICAgICBjaGFsbGVuZ2VSZXF1aXJlZE9uTmV3RGV2aWNlOiB0cnVlLFxuICAgICAgICBkZXZpY2VPbmx5UmVtZW1iZXJlZE9uVXNlclByb21wdDogZmFsc2VcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZIC8vIEZvciBkZXZlbG9wbWVudCAtIGNoYW5nZSB0byBSRVRBSU4gZm9yIHByb2R1Y3Rpb25cbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBDb2duaXRvIERvbWFpbiBmb3IgSG9zdGVkIFVJXG4gICAgdGhpcy5jb2duaXRvRG9tYWluID0gdGhpcy51c2VyUG9vbC5hZGREb21haW4oJ0NvZ25pdG9Eb21haW4nLCB7XG4gICAgICBjb2duaXRvRG9tYWluOiB7XG4gICAgICAgIGRvbWFpblByZWZpeDogYG9wZW5hcGktZG9jcy0ke3RoaXMuYWNjb3VudH0tJHt0aGlzLnJlZ2lvbn1gXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgSUFNIHJvbGUgZm9yIEFtcGxpZnkgc2VydmljZVxuICAgIGNvbnN0IGFtcGxpZnlTZXJ2aWNlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQW1wbGlmeVNlcnZpY2VSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2FtcGxpZnkuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdTZXJ2aWNlIHJvbGUgZm9yIEFXUyBBbXBsaWZ5IHdpdGggTGFtYmRhIGludm9rZSBwZXJtaXNzaW9ucycsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdBZG1pbmlzdHJhdG9yQWNjZXNzLUFtcGxpZnknKVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIExhbWJkYSBpbnZva2UgcGVybWlzc2lvbnMgZm9yIHRoZSBFeHByZXNzIHNlcnZlclxuICAgIGFtcGxpZnlTZXJ2aWNlUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdsYW1iZGE6SW52b2tlRnVuY3Rpb24nXG4gICAgICBdLFxuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgIHByb3BzLmRvbWFpbkFuYWx5emVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICAgIHByb3BzLmRvY0dlbmVyYXRvckZ1bmN0aW9uLmZ1bmN0aW9uQXJuXG4gICAgICBdXG4gICAgfSkpO1xuXG4gICAgLy8gU3VwcHJlc3MgY2RrLW5hZyB3YXJuaW5ncyBmb3IgQW1wbGlmeSBzZXJ2aWNlIHJvbGVcbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoYW1wbGlmeVNlcnZpY2VSb2xlLCBbXG4gICAgICB7XG4gICAgICAgIGlkOiAnQXdzU29sdXRpb25zLUlBTTQnLFxuICAgICAgICByZWFzb246ICdBV1MgbWFuYWdlZCBwb2xpY3kgQWRtaW5pc3RyYXRvckFjY2Vzcy1BbXBsaWZ5IGlzIHJlcXVpcmVkIGZvciBBbXBsaWZ5IHNlcnZpY2UgZnVuY3Rpb25hbGl0eSdcbiAgICAgIH1cbiAgICBdKTtcblxuICAgIC8vIENyZWF0ZSBBbXBsaWZ5IEFwcCBmb3IgUmVhY3QgZnJvbnRlbmQgZGVwbG95bWVudFxuICAgIHRoaXMuYW1wbGlmeUFwcCA9IG5ldyBhbXBsaWZ5LkFwcCh0aGlzLCAnT3BlbkFwaURvY3VtZW50YXRpb25BcHAnLCB7XG4gICAgICBhcHBOYW1lOiAnb3BlbmFwaS1kb2N1bWVudGF0aW9uLWFwcCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JlYWN0IEZyb250ZW5kIGZvciBPcGVuQVBJIERvY3VtZW50YXRpb24gd2l0aCBDb2duaXRvIEF1dGhlbnRpY2F0aW9uJyxcbiAgICAgIHJvbGU6IGFtcGxpZnlTZXJ2aWNlUm9sZSxcbiAgICAgIHBsYXRmb3JtOiBhbXBsaWZ5LlBsYXRmb3JtLldFQiwgLy8gU3RhdGljIHdlYiBhcHAgb25seVxuICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgLy8gUmVhY3QgYnVpbGQgY29uZmlndXJhdGlvblxuICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuXG4gICAgICAgIC8vIENvZ25pdG8gQ29uZmlndXJhdGlvblxuICAgICAgICBSRUFDVF9BUFBfQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIFJFQUNUX0FQUF9VU0VSX1BPT0xfSUQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgICAgUkVBQ1RfQVBQX1VTRVJfUE9PTF9DTElFTlRfSUQ6ICcnLCAvLyBXaWxsIGJlIHVwZGF0ZWQgYWZ0ZXIgY2xpZW50IGNyZWF0aW9uXG4gICAgICAgIFJFQUNUX0FQUF9BVVRIX0RPTUFJTjogYCR7dGhpcy5jb2duaXRvRG9tYWluLmRvbWFpbk5hbWV9LmF1dGguJHt0aGlzLnJlZ2lvbn0uYW1hem9uY29nbml0by5jb21gLFxuXG4gICAgICAgIC8vIEFQSSBDb25maWd1cmF0aW9uIC0gVXNlIExhbWJkYSBGdW5jdGlvbiBVUkwgZGlyZWN0bHlcbiAgICAgICAgUkVBQ1RfQVBQX0FQSV9VUkw6IHByb3BzLmJhY2tlbmRGdW5jdGlvblVybCB8fCAnaHR0cHM6Ly9wbGFjZWhvbGRlci1hcGktdXJsLmNvbSdcbiAgICAgIH0sXG4gICAgICBjdXN0b21SdWxlczogW1xuICAgICAgICAvLyBTUEEgcm91dGluZyAtIHJlZGlyZWN0IGFsbCByb3V0ZXMgdG8gaW5kZXguaHRtbCBmb3IgY2xpZW50LXNpZGUgcm91dGluZ1xuICAgICAgICB7XG4gICAgICAgICAgc291cmNlOiAnLzwqPicsXG4gICAgICAgICAgdGFyZ2V0OiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgIHN0YXR1czogYW1wbGlmeS5SZWRpcmVjdFN0YXR1cy5OT1RfRk9VTkRfUkVXUklURVxuICAgICAgICB9XG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgVXNlciBQb29sIENsaWVudCB3aXRoIE9BdXRoIGNvbmZpZ3VyYXRpb24gKGFmdGVyIEFtcGxpZnkgQXBwKVxuICAgIHRoaXMudXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnT3BlbkFwaURvY3NVc2VyUG9vbENsaWVudCcsIHtcbiAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgdXNlclBvb2xDbGllbnROYW1lOiAnb3BlbmFwaS1kb2NzLWNsaWVudCcsXG4gICAgICBnZW5lcmF0ZVNlY3JldDogZmFsc2UsIC8vIFJlcXVpcmVkIGZvciB3ZWIgYXBwbGljYXRpb25zXG4gICAgICBvQXV0aDoge1xuICAgICAgICBmbG93czoge1xuICAgICAgICAgIGF1dGhvcml6YXRpb25Db2RlR3JhbnQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgc2NvcGVzOiBbXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLlBST0ZJTEVcbiAgICAgICAgXSxcbiAgICAgICAgY2FsbGJhY2tVcmxzOiBbXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsIC8vIEZvciBsb2NhbCBkZXZlbG9wbWVudFxuICAgICAgICAgIC8vIFByb2R1Y3Rpb24gVVJMIHdpbGwgYmUgdXBkYXRlZCBhZnRlciBkZXBsb3ltZW50XG4gICAgICAgIF0sXG4gICAgICAgIGxvZ291dFVybHM6IFtcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwJywgLy8gRm9yIGxvY2FsIGRldmVsb3BtZW50XG4gICAgICAgICAgLy8gUHJvZHVjdGlvbiBVUkwgd2lsbCBiZSB1cGRhdGVkIGFmdGVyIGRlcGxveW1lbnRcbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHN1cHBvcnRlZElkZW50aXR5UHJvdmlkZXJzOiBbXG4gICAgICAgIGNvZ25pdG8uVXNlclBvb2xDbGllbnRJZGVudGl0eVByb3ZpZGVyLkNPR05JVE9cbiAgICAgIF0sXG4gICAgICBhY2Nlc3NUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uaG91cnMoMSksXG4gICAgICBpZFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIHJlZnJlc2hUb2tlblZhbGlkaXR5OiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgICBhZG1pblVzZXJQYXNzd29yZDogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHByZXZlbnRVc2VyRXhpc3RlbmNlRXJyb3JzOiB0cnVlXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgQ29nbml0byBJZGVudGl0eSBQb29sIGZvciBBV1MgY3JlZGVudGlhbHNcbiAgICB0aGlzLmlkZW50aXR5UG9vbCA9IG5ldyBjb2duaXRvLkNmbklkZW50aXR5UG9vbCh0aGlzLCAnT3BlbkFwaURvY3NJZGVudGl0eVBvb2wnLCB7XG4gICAgICBpZGVudGl0eVBvb2xOYW1lOiAnb3BlbmFwaS1kb2NzLWlkZW50aXR5LXBvb2wnLFxuICAgICAgYWxsb3dVbmF1dGhlbnRpY2F0ZWRJZGVudGl0aWVzOiBmYWxzZSxcbiAgICAgIGNvZ25pdG9JZGVudGl0eVByb3ZpZGVyczogW3tcbiAgICAgICAgY2xpZW50SWQ6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgICAgcHJvdmlkZXJOYW1lOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sUHJvdmlkZXJOYW1lXG4gICAgICB9XVxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIElBTSByb2xlcyBmb3IgYXV0aGVudGljYXRlZCB1c2Vyc1xuICAgIGNvbnN0IGF1dGhlbnRpY2F0ZWRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdDb2duaXRvQXV0aGVudGljYXRlZFJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uRmVkZXJhdGVkUHJpbmNpcGFsKCdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb20nLCB7XG4gICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YXVkJzogdGhpcy5pZGVudGl0eVBvb2wucmVmXG4gICAgICAgIH0sXG4gICAgICAgICdGb3JBbnlWYWx1ZTpTdHJpbmdMaWtlJzoge1xuICAgICAgICAgICdjb2duaXRvLWlkZW50aXR5LmFtYXpvbmF3cy5jb206YW1yJzogJ2F1dGhlbnRpY2F0ZWQnXG4gICAgICAgIH1cbiAgICAgIH0sICdzdHM6QXNzdW1lUm9sZVdpdGhXZWJJZGVudGl0eScpLFxuICAgICAgZGVzY3JpcHRpb246ICdSb2xlIGZvciBhdXRoZW50aWNhdGVkIENvZ25pdG8gdXNlcnMgd2l0aCBMYW1iZGEgRnVuY3Rpb24gVVJMIGFjY2VzcydcbiAgICB9KTtcblxuICAgIC8vIEFkZCBwZXJtaXNzaW9ucyB0byBpbnZva2UgTGFtYmRhIEZ1bmN0aW9uIFVSTFxuICAgIGNvbnN0IGxhbWJkYVJlc291cmNlcyA9IFtcbiAgICAgIHByb3BzLmRvbWFpbkFuYWx5emVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBwcm9wcy5kb2NHZW5lcmF0b3JGdW5jdGlvbi5mdW5jdGlvbkFyblxuICAgIF07XG5cbiAgICBpZiAocHJvcHMuYmFja2VuZEZ1bmN0aW9uKSB7XG4gICAgICBsYW1iZGFSZXNvdXJjZXMucHVzaChwcm9wcy5iYWNrZW5kRnVuY3Rpb24uZnVuY3Rpb25Bcm4pO1xuICAgIH1cblxuICAgIGF1dGhlbnRpY2F0ZWRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2xhbWJkYTpJbnZva2VGdW5jdGlvblVybCdcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IGxhbWJkYVJlc291cmNlc1xuICAgIH0pKTtcblxuICAgIC8vIEF0dGFjaCByb2xlIHRvIElkZW50aXR5IFBvb2xcbiAgICBuZXcgY29nbml0by5DZm5JZGVudGl0eVBvb2xSb2xlQXR0YWNobWVudCh0aGlzLCAnSWRlbnRpdHlQb29sUm9sZUF0dGFjaG1lbnQnLCB7XG4gICAgICBpZGVudGl0eVBvb2xJZDogdGhpcy5pZGVudGl0eVBvb2wucmVmLFxuICAgICAgcm9sZXM6IHtcbiAgICAgICAgYXV0aGVudGljYXRlZDogYXV0aGVudGljYXRlZFJvbGUucm9sZUFyblxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gVXBkYXRlIEFtcGxpZnkgQXBwIGVudmlyb25tZW50IHZhcmlhYmxlcyB3aXRoIFVzZXIgUG9vbCBDbGllbnQgSUQgYW5kIElkZW50aXR5IFBvb2wgSURcbiAgICB0aGlzLmFtcGxpZnlBcHAuYWRkRW52aXJvbm1lbnQoJ1JFQUNUX0FQUF9VU0VSX1BPT0xfQ0xJRU5UX0lEJywgdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkKTtcbiAgICB0aGlzLmFtcGxpZnlBcHAuYWRkRW52aXJvbm1lbnQoJ1JFQUNUX0FQUF9JREVOVElUWV9QT09MX0lEJywgdGhpcy5pZGVudGl0eVBvb2wucmVmKTtcblxuICAgIC8vIENyZWF0ZSBhIGN1c3RvbSByZXNvdXJjZSB0byB1cGRhdGUgY2FsbGJhY2sgVVJMcyBhZnRlciBkZXBsb3ltZW50XG4gICAgY29uc3QgdXBkYXRlQ2FsbGJhY2tVcmxzUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnVXBkYXRlQ2FsbGJhY2tVcmxzUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdSb2xlIGZvciBMYW1iZGEgZnVuY3Rpb24gdG8gdXBkYXRlIENvZ25pdG8gY2FsbGJhY2sgVVJMcydcbiAgICB9KTtcblxuICAgIHVwZGF0ZUNhbGxiYWNrVXJsc1JvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhLypgXG4gICAgICBdXG4gICAgfSkpO1xuXG4gICAgdXBkYXRlQ2FsbGJhY2tVcmxzUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgICdjb2duaXRvLWlkcDpVcGRhdGVVc2VyUG9vbENsaWVudCdcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFt0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuXVxuICAgIH0pKTtcblxuICAgIGNvbnN0IHVwZGF0ZUNhbGxiYWNrVXJsc0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVXBkYXRlQ2FsbGJhY2tVcmxzRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHJvbGU6IHVwZGF0ZUNhbGxiYWNrVXJsc1JvbGUsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgeyBDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCwgVXBkYXRlVXNlclBvb2xDbGllbnRDb21tYW5kIH0gPSByZXF1aXJlKCdAYXdzLXNkay9jbGllbnQtY29nbml0by1pZGVudGl0eS1wcm92aWRlcicpO1xuICAgICAgICBcbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ0V2ZW50OicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgY2xpZW50ID0gbmV3IENvZ25pdG9JZGVudGl0eVByb3ZpZGVyQ2xpZW50KHsgcmVnaW9uOiBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIH0pO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQuUmVxdWVzdFR5cGUgPT09ICdDcmVhdGUnIHx8IGV2ZW50LlJlcXVlc3RUeXBlID09PSAnVXBkYXRlJykge1xuICAgICAgICAgICAgICBjb25zdCB7IFVzZXJQb29sSWQsIENsaWVudElkLCBBbXBsaWZ5QXBwSWQgfSA9IGV2ZW50LlJlc291cmNlUHJvcGVydGllcztcbiAgICAgICAgICAgICAgY29uc3QgYW1wbGlmeVVybCA9IFxcYGh0dHBzOi8vbWFpbi5cXCR7QW1wbGlmeUFwcElkfS5hbXBsaWZ5YXBwLmNvbVxcYDtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgVXBkYXRlVXNlclBvb2xDbGllbnRDb21tYW5kKHtcbiAgICAgICAgICAgICAgICBVc2VyUG9vbElkOiBVc2VyUG9vbElkLFxuICAgICAgICAgICAgICAgIENsaWVudElkOiBDbGllbnRJZCxcbiAgICAgICAgICAgICAgICBDYWxsYmFja1VSTHM6IFtcbiAgICAgICAgICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxuICAgICAgICAgICAgICAgICAgYW1wbGlmeVVybFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgTG9nb3V0VVJMczogW1xuICAgICAgICAgICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAgICAgICAgICAgICBhbXBsaWZ5VXJsXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBTdXBwb3J0ZWRJZGVudGl0eVByb3ZpZGVyczogWydDT0dOSVRPJ10sXG4gICAgICAgICAgICAgICAgQWxsb3dlZE9BdXRoRmxvd3M6IFsnY29kZSddLFxuICAgICAgICAgICAgICAgIEFsbG93ZWRPQXV0aFNjb3BlczogWydvcGVuaWQnLCAnZW1haWwnLCAncHJvZmlsZSddLFxuICAgICAgICAgICAgICAgIEFsbG93ZWRPQXV0aEZsb3dzVXNlclBvb2xDbGllbnQ6IHRydWVcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBhd2FpdCBjbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXFxgVXBkYXRlZCBjYWxsYmFjayBVUkxzIHRvIGluY2x1ZGU6IFxcJHthbXBsaWZ5VXJsfVxcYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFNlbmQgc3VjY2VzcyByZXNwb25zZVxuICAgICAgICAgICAgYXdhaXQgc2VuZFJlc3BvbnNlKGV2ZW50LCAnU1VDQ0VTUycsIHsgTWVzc2FnZTogJ0NhbGxiYWNrIFVSTHMgdXBkYXRlZCBzdWNjZXNzZnVsbHknIH0pO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGRhdGluZyBjYWxsYmFjayBVUkxzOicsIGVycm9yKTtcbiAgICAgICAgICAgIGF3YWl0IHNlbmRSZXNwb25zZShldmVudCwgJ0ZBSUxFRCcsIHsgRXJyb3I6IGVycm9yLm1lc3NhZ2UgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgYXN5bmMgZnVuY3Rpb24gc2VuZFJlc3BvbnNlKGV2ZW50LCBzdGF0dXMsIGRhdGEpIHtcbiAgICAgICAgICBjb25zdCByZXNwb25zZUJvZHkgPSB7XG4gICAgICAgICAgICBTdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgICAgIFJlYXNvbjogZGF0YS5FcnJvciB8fCAnT3BlcmF0aW9uIGNvbXBsZXRlZCcsXG4gICAgICAgICAgICBQaHlzaWNhbFJlc291cmNlSWQ6IGV2ZW50LkxvZ2ljYWxSZXNvdXJjZUlkLFxuICAgICAgICAgICAgU3RhY2tJZDogZXZlbnQuU3RhY2tJZCxcbiAgICAgICAgICAgIFJlcXVlc3RJZDogZXZlbnQuUmVxdWVzdElkLFxuICAgICAgICAgICAgTG9naWNhbFJlc291cmNlSWQ6IGV2ZW50LkxvZ2ljYWxSZXNvdXJjZUlkLFxuICAgICAgICAgICAgRGF0YTogZGF0YVxuICAgICAgICAgIH07XG4gICAgICAgICAgXG4gICAgICAgICAgY29uc3QgaHR0cHMgPSByZXF1aXJlKCdodHRwcycpO1xuICAgICAgICAgIGNvbnN0IHVybCA9IHJlcXVpcmUoJ3VybCcpO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSB1cmwucGFyc2UoZXZlbnQuUmVzcG9uc2VVUkwpO1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgaG9zdG5hbWU6IHBhcnNlZFVybC5ob3N0bmFtZSxcbiAgICAgICAgICAgICAgcG9ydDogNDQzLFxuICAgICAgICAgICAgICBwYXRoOiBwYXJzZWRVcmwucGF0aCxcbiAgICAgICAgICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnJyxcbiAgICAgICAgICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBKU09OLnN0cmluZ2lmeShyZXNwb25zZUJvZHkpLmxlbmd0aFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCByZXEgPSBodHRwcy5yZXF1ZXN0KG9wdGlvbnMsIChyZXMpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1Jlc3BvbnNlIHN0YXR1czonLCByZXMuc3RhdHVzQ29kZSk7XG4gICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXEub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzZW5kaW5nIHJlc3BvbnNlOicsIGVycik7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJlcS53cml0ZShKU09OLnN0cmluZ2lmeShyZXNwb25zZUJvZHkpKTtcbiAgICAgICAgICAgIHJlcS5lbmQoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgYCksXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiB0byB1cGRhdGUgQ29nbml0byBjYWxsYmFjayBVUkxzIHdpdGggQW1wbGlmeSBVUkwnXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgY3VzdG9tIHJlc291cmNlIHRvIHRyaWdnZXIgdGhlIGNhbGxiYWNrIFVSTCB1cGRhdGVcbiAgICBuZXcgY2RrLkN1c3RvbVJlc291cmNlKHRoaXMsICdVcGRhdGVDYWxsYmFja1VybHMnLCB7XG4gICAgICBzZXJ2aWNlVG9rZW46IHVwZGF0ZUNhbGxiYWNrVXJsc0Z1bmN0aW9uLmZ1bmN0aW9uQXJuLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBVc2VyUG9vbElkOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIENsaWVudElkOiB0aGlzLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIEFtcGxpZnlBcHBJZDogdGhpcy5hbXBsaWZ5QXBwLmFwcElkXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgbWFpbiBicmFuY2ggZm9yIFJlYWN0IGZyb250ZW5kIGRlcGxveW1lbnRcbiAgICB0aGlzLmFtcGxpZnlBcHAuYWRkQnJhbmNoKCdtYWluJywge1xuICAgICAgYnJhbmNoTmFtZTogJ21haW4nLFxuICAgICAgYXV0b0J1aWxkOiB0cnVlLFxuICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgQU1QTElGWV9ESUZGX0RFUExPWTogJ2ZhbHNlJ1xuICAgICAgICAvLyBSZW1vdmVkIEFNUExJRllfTU9OT1JFUE9fQVBQX1JPT1Qgc2luY2Ugd2UncmUgdXNpbmcgY2xpZW50LW9ubHkgc3RydWN0dXJlXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBbHRlcm5hdGl2ZTogRGVwbG95IGZyb20gUzMgemlwICh1bmNvbW1lbnQgdG8gdXNlKVxuICAgIC8vIE5vdGU6IFRoaXMgcmVxdWlyZXMgcHJlLWJ1aWxkaW5nIGFuZCB1cGxvYWRpbmcgdGhlIGNsaWVudCBhcHAgdG8gUzNcbiAgICAvKlxuICAgIGNvbnN0IGRlcGxveW1lbnRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBbXBsaWZ5RGVwbG95bWVudEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBhbXBsaWZ5LWRlcGxveW1lbnQtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZVxuICAgIH0pO1xuXG4gICAgLy8gVXBsb2FkIGJ1aWx0IGNsaWVudCBhcHAgdG8gUzMgKHdvdWxkIG5lZWQgdG8gYmUgZG9uZSBzZXBhcmF0ZWx5KVxuICAgIGNvbnN0IGRlcGxveW1lbnQgPSBuZXcgczNkZXBsb3kuQnVja2V0RGVwbG95bWVudCh0aGlzLCAnRGVwbG95Q2xpZW50QXBwJywge1xuICAgICAgc291cmNlczogW3MzZGVwbG95LlNvdXJjZS5hc3NldCgnLi4vY2xpZW50L2Rpc3QnKV0sIC8vIFByZS1idWlsdCBjbGllbnRcbiAgICAgIGRlc3RpbmF0aW9uQnVja2V0OiBkZXBsb3ltZW50QnVja2V0LFxuICAgICAgZGVzdGluYXRpb25LZXlQcmVmaXg6ICdjbGllbnQtYXBwJ1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGJyYW5jaCB3aXRoIFMzIHNvdXJjZVxuICAgIHRoaXMuYW1wbGlmeUFwcC5hZGRCcmFuY2goJ21haW4nLCB7XG4gICAgICBicmFuY2hOYW1lOiAnbWFpbicsXG4gICAgICBhdXRvQnVpbGQ6IGZhbHNlLCAvLyBObyBidWlsZCBuZWVkZWQsIGFscmVhZHkgYnVpbHRcbiAgICAgIHNvdXJjZUNvZGVQcm92aWRlcjoge1xuICAgICAgICBzMzoge1xuICAgICAgICAgIGJ1Y2tldDogZGVwbG95bWVudEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAgIGtleTogJ2NsaWVudC1hcHAnXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICAqL1xuXG4gICAgLy8gQ3JlYXRlIGFkbWluIHVzZXIgd2l0aCBjb25maWd1cmFibGUgY3JlZGVudGlhbHNcbiAgICBjb25zdCBhZG1pblVzZXJuYW1lID0gcHJvY2Vzcy5lbnYuQURNSU5fVVNFUk5BTUUgfHwgJ2FkbWluJztcbiAgICBjb25zdCBhZG1pbkVtYWlsID0gcHJvY2Vzcy5lbnYuQURNSU5fRU1BSUwgfHwgJ2FkbWluQGV4YW1wbGUuY29tJztcbiAgICBjb25zdCBhZG1pblRlbXBQYXNzd29yZCA9IHByb2Nlc3MuZW52LkFETUlOX1RFTVBfUEFTU1dPUkQgfHwgJ1RlbXBQYXNzMTIzISc7XG5cbiAgICBuZXcgY29nbml0by5DZm5Vc2VyUG9vbFVzZXIodGhpcywgJ0FkbWluVXNlcicsIHtcbiAgICAgIHVzZXJQb29sSWQ6IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCxcbiAgICAgIHVzZXJuYW1lOiBhZG1pblVzZXJuYW1lLFxuICAgICAgdXNlckF0dHJpYnV0ZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdlbWFpbCcsXG4gICAgICAgICAgdmFsdWU6IGFkbWluRW1haWxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6ICdlbWFpbF92ZXJpZmllZCcsXG4gICAgICAgICAgdmFsdWU6ICd0cnVlJ1xuICAgICAgICB9XG4gICAgICBdLFxuICAgICAgbWVzc2FnZUFjdGlvbjogJ1NVUFBSRVNTJywgLy8gRG9uJ3Qgc2VuZCB3ZWxjb21lIGVtYWlsXG4gICAgICBmb3JjZUFsaWFzQ3JlYXRpb246IGZhbHNlXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIHVzZXIgbWFuYWdlbWVudCBvcGVyYXRpb25zICh0byBiZSB1c2VkIHBvc3QtZGVwbG95bWVudClcbiAgICBjb25zdCB1c2VyTWFuYWdlbWVudFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ1VzZXJNYW5hZ2VtZW50TGFtYmRhUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgZGVzY3JpcHRpb246ICdSb2xlIGZvciBMYW1iZGEgZnVuY3Rpb24gdG8gbWFuYWdlIENvZ25pdG8gdXNlcnMnXG4gICAgfSk7XG5cbiAgICB1c2VyTWFuYWdlbWVudFJvbGUuYWRkVG9Qb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICdsb2dzOkNyZWF0ZUxvZ1N0cmVhbScsXG4gICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cydcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06bG9nLWdyb3VwOi9hd3MvbGFtYmRhLypgXG4gICAgICBdXG4gICAgfSkpO1xuXG4gICAgdXNlck1hbmFnZW1lbnRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluU2V0VXNlclBhc3N3b3JkJyxcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQ3JlYXRlVXNlcicsXG4gICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkRlbGV0ZVVzZXInLFxuICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJ1xuICAgICAgXSxcbiAgICAgIHJlc291cmNlczogW3RoaXMudXNlclBvb2wudXNlclBvb2xBcm5dXG4gICAgfSkpO1xuXG4gICAgY29uc3QgdXNlck1hbmFnZW1lbnRGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1VzZXJNYW5hZ2VtZW50RnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMjJfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIHJvbGU6IHVzZXJNYW5hZ2VtZW50Um9sZSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkXG4gICAgICB9LFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IHsgQ29nbml0b0lkZW50aXR5UHJvdmlkZXJDbGllbnQsIEFkbWluU2V0VXNlclBhc3N3b3JkQ29tbWFuZCwgQWRtaW5DcmVhdGVVc2VyQ29tbWFuZCwgQWRtaW5EZWxldGVVc2VyQ29tbWFuZCwgQWRtaW5HZXRVc2VyQ29tbWFuZCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWNvZ25pdG8taWRlbnRpdHktcHJvdmlkZXInKTtcbiAgICAgICAgXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNsaWVudCA9IG5ldyBDb2duaXRvSWRlbnRpdHlQcm92aWRlckNsaWVudCh7IHJlZ2lvbjogcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB9KTtcbiAgICAgICAgICBjb25zdCB1c2VyUG9vbElkID0gcHJvY2Vzcy5lbnYuVVNFUl9QT09MX0lEO1xuICAgICAgICAgIFxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGFjdGlvbiwgdXNlcm5hbWUsIHBhc3N3b3JkLCBlbWFpbCB9ID0gZXZlbnQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHN3aXRjaCAoYWN0aW9uKSB7XG4gICAgICAgICAgICAgIGNhc2UgJ3NldFBhc3N3b3JkJzpcbiAgICAgICAgICAgICAgICBpZiAoIXVzZXJuYW1lIHx8ICFwYXNzd29yZCkge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVc2VybmFtZSBhbmQgcGFzc3dvcmQgYXJlIHJlcXVpcmVkIGZvciBzZXRQYXNzd29yZCBhY3Rpb24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3Qgc2V0UGFzc3dvcmRDb21tYW5kID0gbmV3IEFkbWluU2V0VXNlclBhc3N3b3JkQ29tbWFuZCh7XG4gICAgICAgICAgICAgICAgICBVc2VyUG9vbElkOiB1c2VyUG9vbElkLFxuICAgICAgICAgICAgICAgICAgVXNlcm5hbWU6IHVzZXJuYW1lLFxuICAgICAgICAgICAgICAgICAgUGFzc3dvcmQ6IHBhc3N3b3JkLFxuICAgICAgICAgICAgICAgICAgUGVybWFuZW50OiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgYXdhaXQgY2xpZW50LnNlbmQoc2V0UGFzc3dvcmRDb21tYW5kKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogXFxgUGFzc3dvcmQgc2V0IHN1Y2Nlc3NmdWxseSBmb3IgdXNlcjogXFwke3VzZXJuYW1lfVxcYFxuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBjYXNlICdjcmVhdGVVc2VyJzpcbiAgICAgICAgICAgICAgICBpZiAoIXVzZXJuYW1lIHx8ICFlbWFpbCkge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVc2VybmFtZSBhbmQgZW1haWwgYXJlIHJlcXVpcmVkIGZvciBjcmVhdGVVc2VyIGFjdGlvbicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVVc2VyQ29tbWFuZCA9IG5ldyBBZG1pbkNyZWF0ZVVzZXJDb21tYW5kKHtcbiAgICAgICAgICAgICAgICAgIFVzZXJQb29sSWQ6IHVzZXJQb29sSWQsXG4gICAgICAgICAgICAgICAgICBVc2VybmFtZTogdXNlcm5hbWUsXG4gICAgICAgICAgICAgICAgICBVc2VyQXR0cmlidXRlczogW1xuICAgICAgICAgICAgICAgICAgICB7IE5hbWU6ICdlbWFpbCcsIFZhbHVlOiBlbWFpbCB9LFxuICAgICAgICAgICAgICAgICAgICB7IE5hbWU6ICdlbWFpbF92ZXJpZmllZCcsIFZhbHVlOiAndHJ1ZScgfVxuICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgIFRlbXBvcmFyeVBhc3N3b3JkOiBwYXNzd29yZCB8fCAnVGVtcFBhc3MxMjMhJyxcbiAgICAgICAgICAgICAgICAgIE1lc3NhZ2VBY3Rpb246ICdTVVBQUkVTUydcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBhd2FpdCBjbGllbnQuc2VuZChjcmVhdGVVc2VyQ29tbWFuZCk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IFxcYFVzZXIgY3JlYXRlZCBzdWNjZXNzZnVsbHk6IFxcJHt1c2VybmFtZX1cXGBcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgY2FzZSAnZGVsZXRlVXNlcic6XG4gICAgICAgICAgICAgICAgaWYgKCF1c2VybmFtZSkge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVc2VybmFtZSBpcyByZXF1aXJlZCBmb3IgZGVsZXRlVXNlciBhY3Rpb24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgZGVsZXRlVXNlckNvbW1hbmQgPSBuZXcgQWRtaW5EZWxldGVVc2VyQ29tbWFuZCh7XG4gICAgICAgICAgICAgICAgICBVc2VyUG9vbElkOiB1c2VyUG9vbElkLFxuICAgICAgICAgICAgICAgICAgVXNlcm5hbWU6IHVzZXJuYW1lXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgYXdhaXQgY2xpZW50LnNlbmQoZGVsZXRlVXNlckNvbW1hbmQpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBcXGBVc2VyIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5OiBcXCR7dXNlcm5hbWV9XFxgXG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGNhc2UgJ2dldFVzZXInOlxuICAgICAgICAgICAgICAgIGlmICghdXNlcm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVXNlcm5hbWUgaXMgcmVxdWlyZWQgZm9yIGdldFVzZXIgYWN0aW9uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IGdldFVzZXJDb21tYW5kID0gbmV3IEFkbWluR2V0VXNlckNvbW1hbmQoe1xuICAgICAgICAgICAgICAgICAgVXNlclBvb2xJZDogdXNlclBvb2xJZCxcbiAgICAgICAgICAgICAgICAgIFVzZXJuYW1lOiB1c2VybmFtZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGNvbnN0IHVzZXJSZXNwb25zZSA9IGF3YWl0IGNsaWVudC5zZW5kKGdldFVzZXJDb21tYW5kKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBcbiAgICAgICAgICAgICAgICAgICAgdXNlcjoge1xuICAgICAgICAgICAgICAgICAgICAgIHVzZXJuYW1lOiB1c2VyUmVzcG9uc2UuVXNlcm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgdXNlclN0YXR1czogdXNlclJlc3BvbnNlLlVzZXJTdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogdXNlclJlc3BvbnNlLkVuYWJsZWQsXG4gICAgICAgICAgICAgICAgICAgICAgdXNlckF0dHJpYnV0ZXM6IHVzZXJSZXNwb25zZS5Vc2VyQXR0cmlidXRlc1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxcYFVua25vd24gYWN0aW9uOiBcXCR7YWN0aW9ufVxcYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluIHVzZXIgbWFuYWdlbWVudCBvcGVyYXRpb246JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlLFxuICAgICAgICAgICAgICAgIGFjdGlvbjogZXZlbnQuYWN0aW9uIHx8ICd1bmtub3duJ1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIGZ1bmN0aW9uIGZvciBDb2duaXRvIHVzZXIgbWFuYWdlbWVudCBvcGVyYXRpb25zJ1xuICAgIH0pO1xuXG4gICAgLy8gU3VwcHJlc3MgY2RrLW5hZyB3YXJuaW5ncyBmb3IgVXBkYXRlQ2FsbGJhY2tVcmxzUm9sZSBhbmQgaXRzIERlZmF1bHRQb2xpY3lcbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnModXBkYXRlQ2FsbGJhY2tVcmxzUm9sZSwgW1xuICAgICAge1xuICAgICAgICBpZDogJ0F3c1NvbHV0aW9ucy1JQU01JyxcbiAgICAgICAgcmVhc29uOiAnV2lsZGNhcmQgcGVybWlzc2lvbnMgYXJlIG5lY2Vzc2FyeSBmb3IgQ2xvdWRXYXRjaCBMb2dzIChMYW1iZGEgcnVudGltZSByZXF1aXJlbWVudCknLFxuICAgICAgICBhcHBsaWVzVG86IFtcbiAgICAgICAgICAnUmVzb3VyY2U6OmFybjphd3M6bG9nczpldS13ZXN0LTE6MjQ2MjE3MjM5NTgxOmxvZy1ncm91cDovYXdzL2xhbWJkYS8qJ1xuICAgICAgICBdXG4gICAgICB9XG4gICAgXSwgdHJ1ZSk7IC8vIEFwcGx5IHRvIGFsbCBjaGlsZCByZXNvdXJjZXMgaW5jbHVkaW5nIERlZmF1bHRQb2xpY3lcblxuXG5cbiAgICAvLyBTdXBwcmVzcyBjZGstbmFnIHdhcm5pbmdzIGZvciBVc2VyTWFuYWdlbWVudFJvbGUgYW5kIGl0cyBEZWZhdWx0UG9saWN5XG4gICAgTmFnU3VwcHJlc3Npb25zLmFkZFJlc291cmNlU3VwcHJlc3Npb25zKHVzZXJNYW5hZ2VtZW50Um9sZSwgW1xuICAgICAge1xuICAgICAgICBpZDogJ0F3c1NvbHV0aW9ucy1JQU01JyxcbiAgICAgICAgcmVhc29uOiAnV2lsZGNhcmQgcGVybWlzc2lvbnMgYXJlIG5lY2Vzc2FyeSBmb3IgQ2xvdWRXYXRjaCBMb2dzIChMYW1iZGEgcnVudGltZSByZXF1aXJlbWVudCknLFxuICAgICAgICBhcHBsaWVzVG86IFtcbiAgICAgICAgICAnUmVzb3VyY2U6OmFybjphd3M6bG9nczpldS13ZXN0LTE6MjQ2MjE3MjM5NTgxOmxvZy1ncm91cDovYXdzL2xhbWJkYS8qJ1xuICAgICAgICBdXG4gICAgICB9XG4gICAgXSwgdHJ1ZSk7IC8vIEFwcGx5IHRvIGFsbCBjaGlsZCByZXNvdXJjZXMgaW5jbHVkaW5nIERlZmF1bHRQb2xpY3lcblxuXG5cbiAgICAvLyBTdXBwcmVzcyBjZGstbmFnIHdhcm5pbmdzIGZvciBDb2duaXRvIFVzZXIgUG9vbFxuICAgIE5hZ1N1cHByZXNzaW9ucy5hZGRSZXNvdXJjZVN1cHByZXNzaW9ucyh0aGlzLnVzZXJQb29sLCBbXG4gICAgICB7XG4gICAgICAgIGlkOiAnQXdzU29sdXRpb25zLUNPRzInLFxuICAgICAgICByZWFzb246ICdNRkEgaXMgY29uZmlndXJlZCBhcyBPUFRJT05BTCB0byBiYWxhbmNlIHNlY3VyaXR5IGFuZCB1c2FiaWxpdHkuIFVzZXJzIGNhbiBlbmFibGUgTUZBIChTTVMvVE9UUCkgYnV0IGl0IGlzIG5vdCBtYW5kYXRvcnkgZm9yIHRoaXMgYXBwbGljYXRpb24uJ1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaWQ6ICdBd3NTb2x1dGlvbnMtQ09HMycsXG4gICAgICAgIHJlYXNvbjogJ0FkdmFuY2VkIFNlY3VyaXR5IE1vZGUgaXMgaW50ZW50aW9uYWxseSBkaXNhYmxlZCB0byBhdm9pZCBhZGRpdGlvbmFsIGNvc3RzIGluIGRldmVsb3BtZW50IGVudmlyb25tZW50LiBJbiBwcm9kdWN0aW9uLCBjb25zaWRlciBlbmFibGluZyBFTkZPUkNFRCBtb2RlIGZvciB0aHJlYXQgZGV0ZWN0aW9uLidcbiAgICAgIH1cbiAgICBdKTtcblxuICAgIC8vIFN0YWNrIG91dHB1dHMgZm9yIGZyb250ZW5kIGNvbmZpZ3VyYXRpb25cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Vc2VyUG9vbElkYFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LVVzZXJQb29sQ2xpZW50SWRgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnSWRlbnRpdHlQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5pZGVudGl0eVBvb2wucmVmLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIElkZW50aXR5IFBvb2wgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUlkZW50aXR5UG9vbElkYFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F1dGhEb21haW4nLCB7XG4gICAgICB2YWx1ZTogYCR7dGhpcy5jb2duaXRvRG9tYWluLmRvbWFpbk5hbWV9LmF1dGguJHt0aGlzLnJlZ2lvbn0uYW1hem9uY29nbml0by5jb21gLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIEF1dGggRG9tYWluJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BdXRoRG9tYWluYFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FtcGxpZnlBcHBJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFtcGxpZnlBcHAuYXBwSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FtcGxpZnkgQXBwIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1BbXBsaWZ5QXBwSWRgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQW1wbGlmeUFwcFVybCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly9tYWluLiR7dGhpcy5hbXBsaWZ5QXBwLmFwcElkfS5hbXBsaWZ5YXBwLmNvbWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FtcGxpZnkgQXBwIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQW1wbGlmeUFwcFVybGBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyTWFuYWdlbWVudEZ1bmN0aW9uTmFtZScsIHtcbiAgICAgIHZhbHVlOiB1c2VyTWFuYWdlbWVudEZ1bmN0aW9uLmZ1bmN0aW9uTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIGZ1bmN0aW9uIG5hbWUgZm9yIHVzZXIgbWFuYWdlbWVudCBvcGVyYXRpb25zJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Vc2VyTWFuYWdlbWVudEZ1bmN0aW9uTmFtZWBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyTWFuYWdlbWVudEZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHVzZXJNYW5hZ2VtZW50RnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBmdW5jdGlvbiBBUk4gZm9yIHVzZXIgbWFuYWdlbWVudCBvcGVyYXRpb25zJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Vc2VyTWFuYWdlbWVudEZ1bmN0aW9uQXJuYFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FkbWluVXNlcm5hbWUnLCB7XG4gICAgICB2YWx1ZTogYWRtaW5Vc2VybmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4gdXNlcm5hbWUgKGNvbmZpZ3VyYWJsZSB2aWEgQURNSU5fVVNFUk5BTUUgZW52IHZhciknLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFkbWluVXNlcm5hbWVgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWRtaW5FbWFpbCcsIHtcbiAgICAgIHZhbHVlOiBhZG1pbkVtYWlsLFxuICAgICAgZGVzY3JpcHRpb246ICdBZG1pbiBlbWFpbCAoY29uZmlndXJhYmxlIHZpYSBBRE1JTl9FTUFJTCBlbnYgdmFyKScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tQWRtaW5FbWFpbGBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZG1pblRlbXBQYXNzd29yZCcsIHtcbiAgICAgIHZhbHVlOiBhZG1pblRlbXBQYXNzd29yZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVGVtcG9yYXJ5IGFkbWluIHBhc3N3b3JkIChjb25maWd1cmFibGUgdmlhIEFETUlOX1RFTVBfUEFTU1dPUkQgZW52IHZhciknLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUFkbWluVGVtcFBhc3N3b3JkYFxuICAgIH0pO1xuICB9XG59Il19