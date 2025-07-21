"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockStack = void 0;
const cdk = require("aws-cdk-lib");
const iam = require("aws-cdk-lib/aws-iam");
const bedrock = require("aws-cdk-lib/aws-bedrock");
const config_1 = require("../config");
const cdk_nag_1 = require("cdk-nag");
class BedrockStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Agent Role
        const agentRole = new iam.CfnRole(this, 'AgentRole', {
            roleName: 'AmazonBedrockExecutionRoleForAgents_cdk',
            assumeRolePolicyDocument: {
                Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'bedrock.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
            },
            managedPolicyArns: ['arn:aws:iam::aws:policy/AmazonBedrockFullAccess']
        });
        // Knowledge Base
        const knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
            name: `${config_1.CONFIG.collectionName}-kb`,
            description: 'Answers on basis of data in knowledge base',
            roleArn: props.bedrockRoleArn,
            knowledgeBaseConfiguration: {
                type: 'VECTOR',
                vectorKnowledgeBaseConfiguration: {
                    embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`
                }
            },
            storageConfiguration: {
                type: 'OPENSEARCH_SERVERLESS',
                opensearchServerlessConfiguration: {
                    collectionArn: props.collectionArn,
                    vectorIndexName: config_1.CONFIG.indexName,
                    fieldMapping: {
                        vectorField: 'vector',
                        textField: 'text',
                        metadataField: 'metadata'
                    }
                }
            }
        });
        // Data Source
        new bedrock.CfnDataSource(this, 'DataSource', {
            knowledgeBaseId: knowledgeBase.ref,
            name: `${config_1.CONFIG.collectionName}-datasource`,
            dataSourceConfiguration: {
                type: 'S3',
                s3Configuration: {
                    bucketArn: props.bucketArn
                }
            }
        });
        const agent = new bedrock.CfnAgent(this, 'Agent', {
            agentName: 'openapi-architect-agent',
            agentResourceRoleArn: agentRole.attrArn,
            autoPrepare: true,
            foundationModel: 'eu.anthropic.claude-3-7-sonnet-20250219-v1:0',
            instruction: `You are an AWS Solutions Architect, guided by the Well-Architected Principles and the cloud-native excellence practices. Your task is to translate user defined business application domains and specifications into OpenAPI (latest documented version) definitions in code, make sure to include domain events in the form of API webhooks. You have access to the knowledge base with the latest data. Only output yaml, openapi code.`,
            description: 'AWS Solutions Architect for OpenAPI Generation',
            idleSessionTtlInSeconds: 900,
            knowledgeBases: [{
                    knowledgeBaseId: knowledgeBase.ref,
                    description: 'Knowledge base contains the latest OpenAPI specifications and instructions.',
                    knowledgeBaseState: 'ENABLED'
                }]
        });
        // Set public properties for other stacks to reference
        this.agentId = agent.ref;
        this.knowledgeBaseId = knowledgeBase.ref;
        // Outputs
        new cdk.CfnOutput(this, 'KnowledgeBaseId', {
            value: knowledgeBase.ref
        });
        new cdk.CfnOutput(this, 'AgentId', {
            value: agent.ref
        });
        // CDK NAG suppressions for AWS managed policy usage
        cdk_nag_1.NagSuppressions.addResourceSuppressions(agentRole, [
            {
                id: 'AwsSolutions-IAM4',
                reason: 'AmazonBedrockFullAccess managed policy is the AWS-recommended approach for Bedrock agents. This policy is maintained by AWS and includes the necessary permissions that evolve with the Bedrock service. Creating a custom policy would require constant maintenance to keep up with service updates.',
                appliesTo: ['Policy::arn:aws:iam::aws:policy/AmazonBedrockFullAccess']
            }
        ]);
    }
}
exports.BedrockStack = BedrockStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLDJDQUEyQztBQUMzQyxtREFBbUQ7QUFFbkQsc0NBQW1DO0FBQ25DLHFDQUEwQztBQVExQyxNQUFhLFlBQWEsU0FBUSxHQUFHLENBQUMsS0FBSztJQUl6QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXdCO1FBQ2hFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLGFBQWE7UUFDYixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNuRCxRQUFRLEVBQUUseUNBQXlDO1lBQ25ELHdCQUF3QixFQUFFO2dCQUN4QixTQUFTLEVBQUUsQ0FBQzt3QkFDVixNQUFNLEVBQUUsT0FBTzt3QkFDZixTQUFTLEVBQUU7NEJBQ1QsT0FBTyxFQUFFLHVCQUF1Qjt5QkFDakM7d0JBQ0QsTUFBTSxFQUFFLGdCQUFnQjtxQkFDekIsQ0FBQzthQUNIO1lBQ0QsaUJBQWlCLEVBQUUsQ0FBQyxpREFBaUQsQ0FBQztTQUN2RSxDQUFDLENBQUM7UUFFSCxpQkFBaUI7UUFDakIsTUFBTSxhQUFhLEdBQUcsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUN4RSxJQUFJLEVBQUUsR0FBRyxlQUFNLENBQUMsY0FBYyxLQUFLO1lBQ25DLFdBQVcsRUFBRSw0Q0FBNEM7WUFDekQsT0FBTyxFQUFFLEtBQUssQ0FBQyxjQUFjO1lBQzdCLDBCQUEwQixFQUFFO2dCQUMxQixJQUFJLEVBQUUsUUFBUTtnQkFDZCxnQ0FBZ0MsRUFBRTtvQkFDaEMsaUJBQWlCLEVBQUUsbUJBQW1CLElBQUksQ0FBQyxNQUFNLGlEQUFpRDtpQkFDbkc7YUFDRjtZQUNELG9CQUFvQixFQUFFO2dCQUNwQixJQUFJLEVBQUUsdUJBQXVCO2dCQUM3QixpQ0FBaUMsRUFBRTtvQkFDakMsYUFBYSxFQUFFLEtBQUssQ0FBQyxhQUFhO29CQUNsQyxlQUFlLEVBQUUsZUFBTSxDQUFDLFNBQVM7b0JBQ2pDLFlBQVksRUFBRTt3QkFDWixXQUFXLEVBQUUsUUFBUTt3QkFDckIsU0FBUyxFQUFFLE1BQU07d0JBQ2pCLGFBQWEsRUFBRSxVQUFVO3FCQUMxQjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsY0FBYztRQUNkLElBQUksT0FBTyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQzVDLGVBQWUsRUFBRSxhQUFhLENBQUMsR0FBRztZQUNsQyxJQUFJLEVBQUUsR0FBRyxlQUFNLENBQUMsY0FBYyxhQUFhO1lBQzNDLHVCQUF1QixFQUFFO2dCQUN2QixJQUFJLEVBQUUsSUFBSTtnQkFDVixlQUFlLEVBQUU7b0JBQ2YsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTO2lCQUMzQjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBSUgsTUFBTSxLQUFLLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDaEQsU0FBUyxFQUFFLHlCQUF5QjtZQUNwQyxvQkFBb0IsRUFBRSxTQUFTLENBQUMsT0FBTztZQUN2QyxXQUFXLEVBQUUsSUFBSTtZQUNqQixlQUFlLEVBQUUsOENBQThDO1lBQy9ELFdBQVcsRUFBRSwyYUFBMmE7WUFDeGIsV0FBVyxFQUFFLGdEQUFnRDtZQUM3RCx1QkFBdUIsRUFBRSxHQUFHO1lBQzVCLGNBQWMsRUFBRSxDQUFDO29CQUNmLGVBQWUsRUFBRSxhQUFhLENBQUMsR0FBRztvQkFDbEMsV0FBVyxFQUFFLDZFQUE2RTtvQkFDMUYsa0JBQWtCLEVBQUUsU0FBUztpQkFDOUIsQ0FBQztTQUNILENBQUMsQ0FBQztRQUVILHNEQUFzRDtRQUN0RCxJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUM7UUFDekIsSUFBSSxDQUFDLGVBQWUsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDO1FBRXpDLFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxhQUFhLENBQUMsR0FBRztTQUN6QixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUNqQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUc7U0FDakIsQ0FBQyxDQUFDO1FBRUgsb0RBQW9EO1FBQ3BELHlCQUFlLENBQUMsdUJBQXVCLENBQUMsU0FBUyxFQUFFO1lBQ2pEO2dCQUNFLEVBQUUsRUFBRSxtQkFBbUI7Z0JBQ3ZCLE1BQU0sRUFBRSx1U0FBdVM7Z0JBQy9TLFNBQVMsRUFBRSxDQUFDLHlEQUF5RCxDQUFDO2FBQ3ZFO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbEdELG9DQWtHQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgQ09ORklHIH0gZnJvbSAnLi4vY29uZmlnJztcbmltcG9ydCB7IE5hZ1N1cHByZXNzaW9ucyB9IGZyb20gJ2Nkay1uYWcnO1xuXG5pbnRlcmZhY2UgQmVkcm9ja1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGNvbGxlY3Rpb25Bcm46IHN0cmluZztcbiAgYnVja2V0QXJuOiBzdHJpbmc7XG4gIGJlZHJvY2tSb2xlQXJuOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBCZWRyb2NrU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYWdlbnRJZDogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkga25vd2xlZGdlQmFzZUlkOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJlZHJvY2tTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBBZ2VudCBSb2xlXG4gICAgY29uc3QgYWdlbnRSb2xlID0gbmV3IGlhbS5DZm5Sb2xlKHRoaXMsICdBZ2VudFJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogJ0FtYXpvbkJlZHJvY2tFeGVjdXRpb25Sb2xlRm9yQWdlbnRzX2NkaycsXG4gICAgICBhc3N1bWVSb2xlUG9saWN5RG9jdW1lbnQ6IHtcbiAgICAgICAgU3RhdGVtZW50OiBbe1xuICAgICAgICAgIEVmZmVjdDogJ0FsbG93JyxcbiAgICAgICAgICBQcmluY2lwYWw6IHtcbiAgICAgICAgICAgIFNlcnZpY2U6ICdiZWRyb2NrLmFtYXpvbmF3cy5jb20nXG4gICAgICAgICAgfSxcbiAgICAgICAgICBBY3Rpb246ICdzdHM6QXNzdW1lUm9sZSdcbiAgICAgICAgfV1cbiAgICAgIH0sXG4gICAgICBtYW5hZ2VkUG9saWN5QXJuczogWydhcm46YXdzOmlhbTo6YXdzOnBvbGljeS9BbWF6b25CZWRyb2NrRnVsbEFjY2VzcyddXG4gICAgfSk7XG5cbiAgICAvLyBLbm93bGVkZ2UgQmFzZVxuICAgIGNvbnN0IGtub3dsZWRnZUJhc2UgPSBuZXcgYmVkcm9jay5DZm5Lbm93bGVkZ2VCYXNlKHRoaXMsICdLbm93bGVkZ2VCYXNlJywge1xuICAgICAgbmFtZTogYCR7Q09ORklHLmNvbGxlY3Rpb25OYW1lfS1rYmAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Fuc3dlcnMgb24gYmFzaXMgb2YgZGF0YSBpbiBrbm93bGVkZ2UgYmFzZScsXG4gICAgICByb2xlQXJuOiBwcm9wcy5iZWRyb2NrUm9sZUFybixcbiAgICAgIGtub3dsZWRnZUJhc2VDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIHR5cGU6ICdWRUNUT1InLFxuICAgICAgICB2ZWN0b3JLbm93bGVkZ2VCYXNlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgIGVtYmVkZGluZ01vZGVsQXJuOiBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYyOjBgXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzdG9yYWdlQ29uZmlndXJhdGlvbjoge1xuICAgICAgICB0eXBlOiAnT1BFTlNFQVJDSF9TRVJWRVJMRVNTJyxcbiAgICAgICAgb3BlbnNlYXJjaFNlcnZlcmxlc3NDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgY29sbGVjdGlvbkFybjogcHJvcHMuY29sbGVjdGlvbkFybixcbiAgICAgICAgICB2ZWN0b3JJbmRleE5hbWU6IENPTkZJRy5pbmRleE5hbWUsXG4gICAgICAgICAgZmllbGRNYXBwaW5nOiB7XG4gICAgICAgICAgICB2ZWN0b3JGaWVsZDogJ3ZlY3RvcicsXG4gICAgICAgICAgICB0ZXh0RmllbGQ6ICd0ZXh0JyxcbiAgICAgICAgICAgIG1ldGFkYXRhRmllbGQ6ICdtZXRhZGF0YSdcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIERhdGEgU291cmNlXG4gICAgbmV3IGJlZHJvY2suQ2ZuRGF0YVNvdXJjZSh0aGlzLCAnRGF0YVNvdXJjZScsIHtcbiAgICAgIGtub3dsZWRnZUJhc2VJZDoga25vd2xlZGdlQmFzZS5yZWYsXG4gICAgICBuYW1lOiBgJHtDT05GSUcuY29sbGVjdGlvbk5hbWV9LWRhdGFzb3VyY2VgLFxuICAgICAgZGF0YVNvdXJjZUNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgdHlwZTogJ1MzJyxcbiAgICAgICAgczNDb25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgYnVja2V0QXJuOiBwcm9wcy5idWNrZXRBcm5cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG5cblxuICAgIGNvbnN0IGFnZW50ID0gbmV3IGJlZHJvY2suQ2ZuQWdlbnQodGhpcywgJ0FnZW50Jywge1xuICAgICAgYWdlbnROYW1lOiAnb3BlbmFwaS1hcmNoaXRlY3QtYWdlbnQnLFxuICAgICAgYWdlbnRSZXNvdXJjZVJvbGVBcm46IGFnZW50Um9sZS5hdHRyQXJuLFxuICAgICAgYXV0b1ByZXBhcmU6IHRydWUsXG4gICAgICBmb3VuZGF0aW9uTW9kZWw6ICdldS5hbnRocm9waWMuY2xhdWRlLTMtNy1zb25uZXQtMjAyNTAyMTktdjE6MCcsXG4gICAgICBpbnN0cnVjdGlvbjogYFlvdSBhcmUgYW4gQVdTIFNvbHV0aW9ucyBBcmNoaXRlY3QsIGd1aWRlZCBieSB0aGUgV2VsbC1BcmNoaXRlY3RlZCBQcmluY2lwbGVzIGFuZCB0aGUgY2xvdWQtbmF0aXZlIGV4Y2VsbGVuY2UgcHJhY3RpY2VzLiBZb3VyIHRhc2sgaXMgdG8gdHJhbnNsYXRlIHVzZXIgZGVmaW5lZCBidXNpbmVzcyBhcHBsaWNhdGlvbiBkb21haW5zIGFuZCBzcGVjaWZpY2F0aW9ucyBpbnRvIE9wZW5BUEkgKGxhdGVzdCBkb2N1bWVudGVkIHZlcnNpb24pIGRlZmluaXRpb25zIGluIGNvZGUsIG1ha2Ugc3VyZSB0byBpbmNsdWRlIGRvbWFpbiBldmVudHMgaW4gdGhlIGZvcm0gb2YgQVBJIHdlYmhvb2tzLiBZb3UgaGF2ZSBhY2Nlc3MgdG8gdGhlIGtub3dsZWRnZSBiYXNlIHdpdGggdGhlIGxhdGVzdCBkYXRhLiBPbmx5IG91dHB1dCB5YW1sLCBvcGVuYXBpIGNvZGUuYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVdTIFNvbHV0aW9ucyBBcmNoaXRlY3QgZm9yIE9wZW5BUEkgR2VuZXJhdGlvbicsXG4gICAgICBpZGxlU2Vzc2lvblR0bEluU2Vjb25kczogOTAwLFxuICAgICAga25vd2xlZGdlQmFzZXM6IFt7XG4gICAgICAgIGtub3dsZWRnZUJhc2VJZDoga25vd2xlZGdlQmFzZS5yZWYsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnS25vd2xlZGdlIGJhc2UgY29udGFpbnMgdGhlIGxhdGVzdCBPcGVuQVBJIHNwZWNpZmljYXRpb25zIGFuZCBpbnN0cnVjdGlvbnMuJyxcbiAgICAgICAga25vd2xlZGdlQmFzZVN0YXRlOiAnRU5BQkxFRCdcbiAgICAgIH1dXG4gICAgfSk7XG5cbiAgICAvLyBTZXQgcHVibGljIHByb3BlcnRpZXMgZm9yIG90aGVyIHN0YWNrcyB0byByZWZlcmVuY2VcbiAgICB0aGlzLmFnZW50SWQgPSBhZ2VudC5yZWY7XG4gICAgdGhpcy5rbm93bGVkZ2VCYXNlSWQgPSBrbm93bGVkZ2VCYXNlLnJlZjtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnS25vd2xlZGdlQmFzZUlkJywge1xuICAgICAgdmFsdWU6IGtub3dsZWRnZUJhc2UucmVmXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWdlbnRJZCcsIHtcbiAgICAgIHZhbHVlOiBhZ2VudC5yZWZcbiAgICB9KTtcblxuICAgIC8vIENESyBOQUcgc3VwcHJlc3Npb25zIGZvciBBV1MgbWFuYWdlZCBwb2xpY3kgdXNhZ2VcbiAgICBOYWdTdXBwcmVzc2lvbnMuYWRkUmVzb3VyY2VTdXBwcmVzc2lvbnMoYWdlbnRSb2xlLCBbXG4gICAgICB7XG4gICAgICAgIGlkOiAnQXdzU29sdXRpb25zLUlBTTQnLFxuICAgICAgICByZWFzb246ICdBbWF6b25CZWRyb2NrRnVsbEFjY2VzcyBtYW5hZ2VkIHBvbGljeSBpcyB0aGUgQVdTLXJlY29tbWVuZGVkIGFwcHJvYWNoIGZvciBCZWRyb2NrIGFnZW50cy4gVGhpcyBwb2xpY3kgaXMgbWFpbnRhaW5lZCBieSBBV1MgYW5kIGluY2x1ZGVzIHRoZSBuZWNlc3NhcnkgcGVybWlzc2lvbnMgdGhhdCBldm9sdmUgd2l0aCB0aGUgQmVkcm9jayBzZXJ2aWNlLiBDcmVhdGluZyBhIGN1c3RvbSBwb2xpY3kgd291bGQgcmVxdWlyZSBjb25zdGFudCBtYWludGVuYW5jZSB0byBrZWVwIHVwIHdpdGggc2VydmljZSB1cGRhdGVzLicsXG4gICAgICAgIGFwcGxpZXNUbzogWydQb2xpY3k6OmFybjphd3M6aWFtOjphd3M6cG9saWN5L0FtYXpvbkJlZHJvY2tGdWxsQWNjZXNzJ11cbiAgICAgIH1cbiAgICBdKTtcbiAgfVxufVxuIl19