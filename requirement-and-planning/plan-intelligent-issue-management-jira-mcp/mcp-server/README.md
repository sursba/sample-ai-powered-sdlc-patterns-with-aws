# Jira Intelligent MCP Server

A Model Context Protocol (MCP) server that provides AI-powered Jira issue management capabilities to Amazon Q Developer and other MCP-compatible AI assistants.

## Features

### 🎯 **Complete Issue Lifecycle Management**
- `create_and_assign_issue` - Create issues with AI-powered assignment
- `detect_and_log_issues` - Automatically detect issues from test results, logs, metrics
- `prioritize_and_assign_issues` - Intelligent prioritization and assignment
- `identify_and_merge_duplicates` - AI-powered duplicate detection and merging
- `generate_project_health_report` - Comprehensive project analytics
- `track_issue_metrics` - Real-time metrics and KPIs

### 🔧 **Core Jira Operations**
- `jira_search_issues` - Search issues with JQL
- `jira_get_issue` - Get issue details
- `jira_update_issue` - Update existing issues
- `jira_add_comment` - Add comments
- `jira_transition_issue` - Change issue status

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Configuration

### 1. Set API Endpoint
Update your API Gateway URL in the environment:

```bash
export JIRA_MCP_API_BASE="https://your-api-gateway-url/prod"
```

### 2. Amazon Q Developer Integration

Amazon Q Developer supports MCP servers. Configure your development environment:

```bash
# Set environment variable for your development session
export JIRA_MCP_API_BASE="https://your-api-gateway-url/prod"

# Run the MCP server
npm start
```

### 3. Other MCP Clients

For other MCP-compatible clients, the server runs on stdio:

```bash
node dist/index.js
```

## Usage Examples for Project Managers

Once connected to Amazon Q Developer, you can use natural language for comprehensive issue management:

### Issue Creation & Assignment
- "Create a bug report for the login issue and assign it to the best available developer"
- "Log this payment processing error and get assignment recommendation"
- "Create a high-priority task for the API performance problem"

### Automated Issue Detection
- "Analyze these test results and create issues for any failures"
- "Review this error log and detect any issues that need tracking"
- "Process these user reports and create appropriate tickets"

### Prioritization & Assignment
- "Prioritize all open bugs and assign them to appropriate team members"
- "Review unassigned issues and get assignment recommendations"
- "Balance workload across the team for current sprint issues"

### Duplicate Management
- "Check if this login error has been reported before"
- "Find and merge duplicate issues from the last month"
- "Identify similar issues to avoid duplicate work"

### Project Health & Metrics
- "Generate a project health report for the last 30 days"
- "Show me team velocity and resolution metrics"
- "Track issue trends and identify bottlenecks"
- "What's the current status of P1 issues?"

### Advanced Analytics
- "Show resolution time metrics by team member"
- "Track SLA compliance for customer-facing issues"
- "Generate executive summary of project health"

## Architecture

```
Amazon Q Developer → MCP Client → MCP Server → AWS API Gateway → Lambda Functions
```

The MCP server acts as a bridge between AI assistants and your AWS-deployed intelligent issue management system.

## Enterprise Use Cases

### 1. Automated Issue Detection
- **Test Automation**: Automatically create issues from failed tests
- **Log Analysis**: Detect errors in application logs and create tickets
- **Monitoring Integration**: Create issues from system alerts and metrics

### 2. Intelligent Assignment
- **Skill Matching**: Assign issues based on team member expertise
- **Workload Balancing**: Consider current workload and capacity
- **Timezone Optimization**: Assign to team members in optimal timezones

### 3. Duplicate Prevention
- **Semantic Analysis**: Use AI to detect similar issues before creation
- **Content Similarity**: Analyze descriptions and titles for duplicates
- **Automatic Merging**: Merge confirmed duplicates with confidence scores

### 4. Project Analytics
- **Health Scoring**: Overall project health based on multiple factors
- **Velocity Tracking**: Team and individual performance metrics
- **Trend Analysis**: Identify patterns in issue creation and resolution

### 5. Executive Reporting
- **Dashboard Generation**: Real-time project status for stakeholders
- **SLA Monitoring**: Track compliance with customer SLAs
- **Resource Planning**: Identify capacity needs and bottlenecks

## Development

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### Environment Variables
- `JIRA_MCP_API_BASE` - Your deployed API Gateway URL (required)

## Troubleshooting

### Connection Issues
- Verify API Gateway URL is correct and accessible
- Check AWS infrastructure is deployed and healthy
- Ensure Bedrock models are enabled in your AWS account

### Permission Errors
- Verify Jira credentials in AWS Secrets Manager
- Check Lambda execution role permissions
- Ensure OpenSearch Serverless permissions are configured

### Tool Errors
- Check MCP server logs for detailed error messages
- Verify tool names match exactly in requests
- Ensure required parameters are provided

## Production Deployment

This MCP server is designed for enterprise production use:

### Security
- No hardcoded credentials or URLs
- Environment-based configuration
- Secure communication with AWS services

### Scalability
- Serverless AWS backend scales automatically
- Stateless MCP server design
- Efficient API communication patterns

### Monitoring
- Comprehensive error handling and logging
- AWS CloudWatch integration
- Performance metrics tracking

### Customization
- Configurable team profiles and skills
- Adjustable assignment weights and priorities
- Extensible tool framework for custom workflows

Perfect for engineering teams, product managers, and enterprises using Jira with AWS infrastructure and Amazon Q Developer.
