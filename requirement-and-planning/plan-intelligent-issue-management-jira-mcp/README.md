# Intelligent Issue Management with Jira MCP

An AI-powered issue management system that integrates Jira with AWS services through **Model Context Protocol (MCP)**, enabling engineers and enterprises to manage issues using natural language with AI assistants like Claude Desktop.

## 🚀 **MCP Integration - The Key Differentiator**

This system provides a **true MCP server** that connects AI assistants directly to your Jira infrastructure with intelligent capabilities:

- **Natural Language Interface**: "Who should I assign this payment bug to?"
- **AI-Powered Recommendations**: Skill-based assignment with workload balancing
- **Duplicate Detection**: "Are there similar issues to this login error?"
- **Enterprise Ready**: Secure, scalable, production-grade implementation

## Architecture Overview

```
AI Assistant (Claude) → MCP Client → MCP Server → AWS API Gateway → Lambda Functions → Jira/AWS Services
```

### 4-Stage Pipeline:
1. **Stage 1**: Chat Orchestration - Natural language interface
2. **Stage 2**: Jira Integration - Direct Jira API integration via MCP
3. **Stage 3**: Assignment Intelligence - AI-powered assignment recommendations  
4. **Stage 4**: Duplicate Detection - Vector similarity search for duplicate issues

## Quick Start for Engineers

### 1. Deploy AWS Infrastructure
```bash
git clone <repository-url>
cd plan-intelligent-issue-management-jira-mcp
npm install
npm run build
npx cdk deploy --all --require-approval never
```

### 2. Setup MCP Server for Amazon Q Developer
```bash
./setup-mcp.sh
```

### 3. Configure Amazon Q Developer
Set the environment variable and run the MCP server:

```bash
export JIRA_MCP_API_BASE="https://your-api-gateway-url/prod"
cd mcp-server
./start-for-q.sh
```

### 4. Start Using with Amazon Q Developer
- "Create a bug report for login issues and assign to best developer"
- "Analyze these test results and create issues for failures"
- "Generate project health report for last 30 days"
- "Find and merge duplicate issues"
- "Prioritize open issues and assign to team members"

## Enterprise Value Proposition

### 🎯 **For Engineering Teams**
- **Reduce Assignment Time**: AI recommends best assignee in seconds
- **Prevent Duplicate Work**: Automatic duplicate detection before creating issues
- **Natural Language Interface**: No need to learn JQL or complex Jira workflows
- **Context-Aware**: AI understands team skills, workload, and priorities

### 🏢 **For Enterprises**
- **Scalable Architecture**: Serverless AWS infrastructure scales automatically
- **Security First**: Jira credentials in AWS Secrets Manager, encrypted data
- **Cost Effective**: Pay-per-use model, scales to zero when not in use
- **Integration Ready**: MCP standard works with any MCP-compatible AI assistant

## MCP Tools Available

| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `jira_search_issues` | Search with JQL | "Find all open bugs assigned to me" |
| `jira_create_issue` | Create new issues | "Create a bug report for login issues" |
| `assign_recommend` | AI assignment | "Who should handle this database issue?" |
| `dedupe_find_similar` | Duplicate detection | "Are there similar payment errors?" |
| `jira_add_comment` | Add comments | "Add deployment notes to PROJ-123" |
| `jira_transition_issue` | Change status | "Move PROJ-456 to In Progress" |

## Technology Stack

### AWS Services
- **API Gateway**: MCP-compatible REST interface
- **Lambda**: Serverless microservices
- **DynamoDB**: Team profiles and configuration
- **OpenSearch Serverless**: Vector similarity search
- **Bedrock**: AI embeddings (Cohere/Titan)
- **Secrets Manager**: Secure Jira credentials

### MCP Integration
- **MCP Server**: TypeScript implementation with stdio transport
- **Amazon Q Developer**: Primary AI assistant integration
- **Extensible**: Works with any MCP-compatible client

## Configuration

### Team Member Profiles
```json
[
  {
    "pk": "user#alice",
    "name": "Alice Nguyen", 
    "email": "alice@example.com",
    "skills": ["backend", "python", "payments"],
    "wipLimit": 3,
    "currentWip": 1,
    "timezone": "America/Los_Angeles"
  }
]
```

### Assignment Weights
```json
{
  "severity": 0.35,    // Issue severity impact
  "slaRisk": 0.25,     // SLA breach risk  
  "aging": 0.15,       // How long issue has been open
  "regression": 0.10,  // Regression issue penalty
  "arrImpact": 0.15    // Business impact
}
```

## Enterprise Deployment

### Prerequisites
- AWS Account with appropriate permissions
- Jira Cloud instance with API access
- Amazon Q Developer or other MCP-compatible AI assistant

### Security Considerations
- Jira credentials stored in AWS Secrets Manager
- Lambda functions use least-privilege IAM roles
- All data encrypted in transit and at rest
- OpenSearch Serverless with proper access policies

### Monitoring
- CloudWatch logs for all Lambda functions
- API Gateway request/response logging
- Bedrock usage metrics
- DynamoDB performance metrics

## Support & Contributing

### For Enterprises
- Production-ready reference architecture
- Comprehensive setup documentation
- Troubleshooting guides
- Security best practices

### For Developers
- Complete reference implementation
- Extensible MCP server architecture
- Sample configurations and seed data
- Automated deployment scripts

---

**Built for Engineers, Designed for Enterprises**
*AWS reference architecture for AI-powered issue management using Amazon Q Developer and the Model Context Protocol*

## Usage Examples

### Assignment Recommendations
```bash
curl -X POST "https://your-api-gateway-url/prod/mcp/assign" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "assign.compute_recommendation",
    "params": {
      "description": "Payment processing bug in checkout flow",
      "component": "payments",
      "labels": ["urgent", "backend"]
    }
  }'
```

### Duplicate Detection
```bash
curl -X POST "https://your-api-gateway-url/prod/mcp/dedupe" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "dedupe.find_similar",
    "params": {
      "description": "User login fails with 500 error",
      "title": "Login Error"
    }
  }'
```

### Jira Operations
```bash
# Search issues
curl -X POST "https://your-api-gateway-url/prod/mcp/jira" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "jira.search_issues",
    "params": {
      "jql": "project = YOUR-PROJECT AND status = Open"
    }
  }'

# Create issue
curl -X POST "https://your-api-gateway-url/prod/mcp/jira" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "jira.create_issue",
    "params": {
      "summary": "New bug report",
      "description": "Detailed description",
      "issueType": "Bug",
      "priority": "High"
    }
  }'
```

## Configuration

### Team Member Profiles
Edit `seed/people.json` to configure your team:

```json
[
  {
    "pk": "user#alice",
    "name": "Alice Nguyen",
    "email": "alice@example.com",
    "skills": ["backend", "python", "payments"],
    "wipLimit": 3,
    "currentWip": 1,
    "timezone": "America/Los_Angeles"
  }
]
```

### Assignment Weights
Customize assignment scoring in DynamoDB `issue-mgmt-Config` table:

```json
{
  "severity": 0.35,    // Issue severity impact
  "slaRisk": 0.25,     // SLA breach risk
  "aging": 0.15,       // How long issue has been open
  "regression": 0.10,  // Regression issue penalty
  "arrImpact": 0.15    // Business impact
}
```

## Monitoring and Troubleshooting

### CloudWatch Logs
- `/aws/lambda/IssueMgmtCoreStack-ChatOrchestratorFn*`
- `/aws/lambda/IssueMgmtCoreStack-JiraToolFn*`
- `/aws/lambda/IssueMgmtCoreStack-AssignToolFn*`
- `/aws/lambda/IssueMgmtCoreStack-DedupeToolFn*`

### Common Issues

**403 Forbidden on OpenSearch**
- Wait 5-10 minutes for permission propagation
- Verify Bedrock model access is enabled
- Check Lambda execution role permissions

**Jira Authentication Errors**
- Verify API token is valid
- Check base URL format (no trailing slash)
- Ensure email matches Jira account

**Assignment Recommendations Empty**
- Verify team data is loaded in DynamoDB
- Check skill matching configuration
- Review WIP limits and current workload

## Development

### Project Structure
```
├── cdk/                    # CDK infrastructure code
│   ├── lib/
│   │   ├── DataStack.ts    # DynamoDB, S3, OpenSearch
│   │   └── CoreStack.ts    # Lambda functions, API Gateway
│   └── app.ts              # CDK app entry point
├── lambdas/                # Lambda function code
│   ├── chat/               # Chat orchestrator
│   ├── mcp/                # MCP tool implementations
│   │   ├── jira_tool/      # Jira integration
│   │   ├── assign_tool/    # Assignment recommendations
│   │   └── dedupe_tool/    # Duplicate detection
│   └── indexer/            # Issue indexing for search
├── seed/                   # Sample data
└── prompts/                # AI prompts and templates
```

### Adding New MCP Tools
1. Create new Lambda function in `lambdas/mcp/your_tool/`
2. Add function to `CoreStack.ts`
3. Create API Gateway route
4. Update this README

### Extending Assignment Logic
- Modify `lambdas/mcp/assign_tool/handler.py`
- Update scoring weights in DynamoDB configuration
- Add new skill categories or team attributes

## Security Considerations

- Jira credentials stored in AWS Secrets Manager
- Lambda functions use least-privilege IAM roles
- API Gateway can be configured with authentication
- OpenSearch Serverless uses encryption at rest
- All data encrypted in transit

## Cost Optimization

- Serverless architecture scales to zero
- DynamoDB on-demand pricing
- OpenSearch Serverless automatic scaling
- Bedrock pay-per-use model
- CloudWatch log retention configured

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review CloudWatch logs
3. Open an issue in the repository
4. Contact the development team

---

**Built with ❤️ using AWS CDK, Lambda, and the Model Context Protocol**
