"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageStack = void 0;
const cdk = require("aws-cdk-lib");
const s3 = require("aws-cdk-lib/aws-s3");
const iam = require("aws-cdk-lib/aws-iam");
class StorageStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // S3 bucket for knowledge base data storage with enhanced security
        this.knowledgeBaseBucket = new s3.Bucket(this, 'KnowledgeBaseBucket', {
            bucketName: `openapi-knowledge-base-${this.account}-${this.region}`,
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            serverAccessLogsPrefix: 'access-logs/',
            enforceSSL: true,
            lifecycleRules: [
                {
                    id: 'DeleteIncompleteMultipartUploads',
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
                },
                {
                    id: 'TransitionOldVersions',
                    noncurrentVersionTransitions: [{
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30)
                        }]
                }
            ]
        });
        // S3 bucket for domain analyzer output with enhanced security
        this.domainAnalyzerBucket = new s3.Bucket(this, 'DomainAnalyzerBucket', {
            bucketName: `openapi-domain-analyzer-${this.account}-${this.region}`,
            versioned: false,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            serverAccessLogsPrefix: 'access-logs/',
            enforceSSL: true,
            lifecycleRules: [
                {
                    id: 'DeleteOldAnalyzerResults',
                    expiration: cdk.Duration.days(30),
                },
                {
                    id: 'DeleteIncompleteMultipartUploads',
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
                }
            ]
        });
        // Grant Lambda service access to domain analyzer bucket
        this.domainAnalyzerBucket.addToResourcePolicy(new iam.PolicyStatement({
            sid: 'DomainAnalyzerLambdaAccess',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
            actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket'
            ],
            resources: [
                this.domainAnalyzerBucket.bucketArn,
                `${this.domainAnalyzerBucket.bucketArn}/*`
            ],
            conditions: {
                StringEquals: {
                    'aws:SourceAccount': this.account
                }
            }
        }));
        // Grant Bedrock service access to knowledge base bucket
        this.knowledgeBaseBucket.addToResourcePolicy(new iam.PolicyStatement({
            sid: 'BedrockKnowledgeBaseAccess',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('bedrock.amazonaws.com')],
            actions: [
                's3:GetObject',
                's3:ListBucket'
            ],
            resources: [
                this.knowledgeBaseBucket.bucketArn,
                `${this.knowledgeBaseBucket.bucketArn}/*`
            ],
            conditions: {
                StringEquals: {
                    'aws:SourceAccount': this.account
                }
            }
        }));
        // Export bucket names as stack outputs
        new cdk.CfnOutput(this, 'KnowledgeBaseBucketName', {
            value: this.knowledgeBaseBucket.bucketName,
            description: 'S3 bucket name for knowledge base data storage',
            exportName: `${this.stackName}-KnowledgeBaseBucketName`
        });
        new cdk.CfnOutput(this, 'DomainAnalyzerBucketName', {
            value: this.domainAnalyzerBucket.bucketName,
            description: 'S3 bucket name for domain analyzer output',
            exportName: `${this.stackName}-DomainAnalyzerBucketName`
        });
    }
}
exports.StorageStack = StorageStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLHlDQUF5QztBQUN6QywyQ0FBMkM7QUFHM0MsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixtRUFBbUU7UUFDbkUsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDcEUsVUFBVSxFQUFFLDBCQUEwQixJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDbkUsU0FBUyxFQUFFLElBQUk7WUFDZixVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtZQUN2QyxzQkFBc0IsRUFBRSxjQUFjO1lBQ3RDLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxFQUFFLEVBQUUsa0NBQWtDO29CQUN0QyxtQ0FBbUMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7aUJBQzFEO2dCQUNEO29CQUNFLEVBQUUsRUFBRSx1QkFBdUI7b0JBQzNCLDRCQUE0QixFQUFFLENBQUM7NEJBQzdCLFlBQVksRUFBRSxFQUFFLENBQUMsWUFBWSxDQUFDLGlCQUFpQjs0QkFDL0MsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzt5QkFDdkMsQ0FBQztpQkFD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LEVBQUUsMkNBQTJDO1lBQ3hELFVBQVUsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLDJCQUEyQjtTQUN6RCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUEvR0Qsb0NBK0dDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGNsYXNzIFN0b3JhZ2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBrbm93bGVkZ2VCYXNlQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkb21haW5BbmFseXplckJ1Y2tldDogczMuQnVja2V0O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIFMzIGJ1Y2tldCBmb3Iga25vd2xlZGdlIGJhc2UgZGF0YSBzdG9yYWdlIHdpdGggZW5oYW5jZWQgc2VjdXJpdHlcbiAgICB0aGlzLmtub3dsZWRnZUJhc2VCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdLbm93bGVkZ2VCYXNlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYG9wZW5hcGkta25vd2xlZGdlLWJhc2UtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBzZXJ2ZXJBY2Nlc3NMb2dzUHJlZml4OiAnYWNjZXNzLWxvZ3MvJyxcbiAgICAgIGVuZm9yY2VTU0w6IHRydWUsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkcycsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdUcmFuc2l0aW9uT2xkVmVyc2lvbnMnLFxuICAgICAgICAgIG5vbmN1cnJlbnRWZXJzaW9uVHJhbnNpdGlvbnM6IFt7XG4gICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoMzApXG4gICAgICAgICAgfV1cbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuXG4gICAgLy8gUzMgYnVja2V0IGZvciBkb21haW4gYW5hbHl6ZXIgb3V0cHV0IHdpdGggZW5oYW5jZWQgc2VjdXJpdHlcbiAgICB0aGlzLmRvbWFpbkFuYWx5emVyQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRG9tYWluQW5hbHl6ZXJCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgb3BlbmFwaS1kb21haW4tYW5hbHl6ZXItJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIHZlcnNpb25lZDogZmFsc2UsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHNlcnZlckFjY2Vzc0xvZ3NQcmVmaXg6ICdhY2Nlc3MtbG9ncy8nLFxuICAgICAgZW5mb3JjZVNTTDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZU9sZEFuYWx5emVyUmVzdWx0cycsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMzApLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkcycsXG4gICAgICAgICAgYWJvcnRJbmNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDEpLFxuICAgICAgICB9XG4gICAgICBdXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBMYW1iZGEgc2VydmljZSBhY2Nlc3MgdG8gZG9tYWluIGFuYWx5emVyIGJ1Y2tldFxuICAgIHRoaXMuZG9tYWluQW5hbHl6ZXJCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgc2lkOiAnRG9tYWluQW5hbHl6ZXJMYW1iZGFBY2Nlc3MnLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyldLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgICAgJ3MzOkxpc3RCdWNrZXQnXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgIHRoaXMuZG9tYWluQW5hbHl6ZXJCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgIGAke3RoaXMuZG9tYWluQW5hbHl6ZXJCdWNrZXQuYnVja2V0QXJufS8qYFxuICAgICAgICBdLFxuICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgICAnYXdzOlNvdXJjZUFjY291bnQnOiB0aGlzLmFjY291bnRcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEdyYW50IEJlZHJvY2sgc2VydmljZSBhY2Nlc3MgdG8ga25vd2xlZGdlIGJhc2UgYnVja2V0XG4gICAgdGhpcy5rbm93bGVkZ2VCYXNlQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIHNpZDogJ0JlZHJvY2tLbm93bGVkZ2VCYXNlQWNjZXNzJyxcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdiZWRyb2NrLmFtYXpvbmF3cy5jb20nKV0sXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnczM6R2V0T2JqZWN0JyxcbiAgICAgICAgICAnczM6TGlzdEJ1Y2tldCdcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgdGhpcy5rbm93bGVkZ2VCYXNlQnVja2V0LmJ1Y2tldEFybixcbiAgICAgICAgICBgJHt0aGlzLmtub3dsZWRnZUJhc2VCdWNrZXQuYnVja2V0QXJufS8qYFxuICAgICAgICBdLFxuICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgICAnYXdzOlNvdXJjZUFjY291bnQnOiB0aGlzLmFjY291bnRcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEV4cG9ydCBidWNrZXQgbmFtZXMgYXMgc3RhY2sgb3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdLbm93bGVkZ2VCYXNlQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmtub3dsZWRnZUJhc2VCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IG5hbWUgZm9yIGtub3dsZWRnZSBiYXNlIGRhdGEgc3RvcmFnZScsXG4gICAgICBleHBvcnROYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tS25vd2xlZGdlQmFzZUJ1Y2tldE5hbWVgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRG9tYWluQW5hbHl6ZXJCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZG9tYWluQW5hbHl6ZXJCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IG5hbWUgZm9yIGRvbWFpbiBhbmFseXplciBvdXRwdXQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LURvbWFpbkFuYWx5emVyQnVja2V0TmFtZWBcbiAgICB9KTtcbiAgfVxufSJdfQ==