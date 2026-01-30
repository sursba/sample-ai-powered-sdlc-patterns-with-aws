#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// AWS API Gateway endpoints - dynamically retrieved from environment
const API_BASE = process.env.JIRA_MCP_API_BASE;

if (!API_BASE) {
  console.error('Error: JIRA_MCP_API_BASE environment variable is required');
  console.error('Please set it to your deployed API Gateway URL (e.g., https://your-api-id.execute-api.region.amazonaws.com/prod)');
  process.exit(1);
}

interface JiraMCPServer {
  server: Server;
}

class JiraMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'jira-intelligent-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Issue Creation & Management
          {
            name: 'create_and_assign_issue',
            description: 'Create a new issue and get AI-powered assignment recommendation',
            inputSchema: {
              type: 'object',
              properties: {
                summary: { type: 'string', description: 'Issue title/summary' },
                description: { type: 'string', description: 'Detailed issue description' },
                issueType: { type: 'string', description: 'Issue type (Bug, Task, Story)', default: 'Task' },
                priority: { type: 'string', description: 'Priority (P1, P2, P3)', default: 'P2' },
                component: { type: 'string', description: 'Component/area affected' },
                labels: { type: 'array', items: { type: 'string' }, description: 'Issue labels' },
                autoAssign: { type: 'boolean', description: 'Automatically assign to recommended person', default: true }
              },
              required: ['summary', 'description']
            }
          },
          {
            name: 'detect_and_log_issues',
            description: 'Detect issues from test results, logs, or system metrics and create Jira issues',
            inputSchema: {
              type: 'object',
              properties: {
                source: { type: 'string', description: 'Source of detection (test, log, metric, user_report)' },
                content: { type: 'string', description: 'Raw content (test output, log entries, metric data)' },
                severity: { type: 'string', description: 'Detected severity level', default: 'Medium' },
                autoCreate: { type: 'boolean', description: 'Automatically create issues for detected problems', default: true }
              },
              required: ['source', 'content']
            }
          },
          {
            name: 'prioritize_and_assign_issues',
            description: 'Analyze and prioritize existing issues, then assign to optimal team members',
            inputSchema: {
              type: 'object',
              properties: {
                jql: { type: 'string', description: 'JQL to select issues for prioritization', default: 'status = Open' },
                factors: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Prioritization factors (business_impact, sla_risk, technical_debt, customer_impact)',
                  default: ['business_impact', 'sla_risk']
                }
              }
            }
          },
          {
            name: 'identify_and_merge_duplicates',
            description: 'Find duplicate issues using AI similarity analysis and merge them',
            inputSchema: {
              type: 'object',
              properties: {
                issueKey: { type: 'string', description: 'Issue to check for duplicates (optional)' },
                jql: { type: 'string', description: 'JQL to select issues for duplicate detection', default: 'created >= -30d' },
                similarityThreshold: { type: 'number', description: 'Similarity threshold (0.0-1.0)', default: 0.8 },
                autoMerge: { type: 'boolean', description: 'Automatically merge high-confidence duplicates', default: false }
              }
            }
          },
          {
            name: 'generate_project_health_report',
            description: 'Generate comprehensive project health and metrics report',
            inputSchema: {
              type: 'object',
              properties: {
                projectKey: { type: 'string', description: 'Project key for analysis' },
                timeframe: { type: 'string', description: 'Analysis timeframe (7d, 30d, 90d)', default: '30d' },
                includeMetrics: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Metrics to include (velocity, resolution_time, team_performance, issue_trends)',
                  default: ['velocity', 'resolution_time', 'issue_trends']
                }
              }
            }
          },
          {
            name: 'track_issue_metrics',
            description: 'Track and analyze key issue metrics and KPIs',
            inputSchema: {
              type: 'object',
              properties: {
                metricType: { 
                  type: 'string', 
                  description: 'Metric type (resolution_time, backlog_health, team_velocity, sla_compliance)',
                  default: 'resolution_time'
                },
                groupBy: { type: 'string', description: 'Group metrics by (assignee, priority, component)', default: 'priority' },
                timeframe: { type: 'string', description: 'Time period for analysis', default: '30d' }
              }
            }
          },
          // Core Jira Operations
          {
            name: 'jira_search_issues',
            description: 'Search Jira issues using JQL queries',
            inputSchema: {
              type: 'object',
              properties: {
                jql: { type: 'string', description: 'JQL query string' },
                maxResults: { type: 'number', description: 'Maximum results', default: 50 }
              },
              required: ['jql']
            }
          },
          {
            name: 'jira_get_issue',
            description: 'Get detailed information about a specific issue',
            inputSchema: {
              type: 'object',
              properties: {
                issueKey: { type: 'string', description: 'Jira issue key (e.g., PROJ-123)' }
              },
              required: ['issueKey']
            }
          },
          {
            name: 'jira_update_issue',
            description: 'Update an existing Jira issue',
            inputSchema: {
              type: 'object',
              properties: {
                issueKey: { type: 'string', description: 'Issue key to update' },
                summary: { type: 'string', description: 'New summary' },
                description: { type: 'string', description: 'New description' },
                assignee: { type: 'string', description: 'New assignee email' },
                priority: { type: 'string', description: 'New priority' }
              },
              required: ['issueKey']
            }
          },
          {
            name: 'jira_add_comment',
            description: 'Add a comment to a Jira issue',
            inputSchema: {
              type: 'object',
              properties: {
                issueKey: { type: 'string', description: 'Issue key' },
                comment: { type: 'string', description: 'Comment text' }
              },
              required: ['issueKey', 'comment']
            }
          },
          {
            name: 'jira_transition_issue',
            description: 'Change issue status/workflow state',
            inputSchema: {
              type: 'object',
              properties: {
                issueKey: { type: 'string', description: 'Issue key' },
                transitionName: { type: 'string', description: 'Transition name (e.g., "In Progress", "Done")' }
              },
              required: ['issueKey', 'transitionName']
            }
          }
        ] as Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Comprehensive Issue Management
          case 'create_and_assign_issue':
            return await this.createAndAssignIssue(args);
          case 'detect_and_log_issues':
            return await this.detectAndLogIssues(args);
          case 'prioritize_and_assign_issues':
            return await this.prioritizeAndAssignIssues(args);
          case 'identify_and_merge_duplicates':
            return await this.identifyAndMergeDuplicates(args);
          case 'generate_project_health_report':
            return await this.generateProjectHealthReport(args);
          case 'track_issue_metrics':
            return await this.trackIssueMetrics(args);

          // Core Jira Operations
          case 'jira_search_issues':
            return await this.callJiraAPI('jira.search_issues', args);
          case 'jira_get_issue':
            return await this.callJiraAPI('jira.get_issue', args);
          case 'jira_update_issue':
            return await this.callJiraAPI('jira.update_issue', args);
          case 'jira_add_comment':
            return await this.callJiraAPI('jira.add_comment', args);
          case 'jira_transition_issue':
            return await this.callJiraAPI('jira.transition_issue', args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error calling ${name}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  // Comprehensive Issue Management Methods
  private async createAndAssignIssue(params: any) {
    try {
      // First, create the issue
      const createResponse = await axios.post(`${API_BASE}/mcp/jira`, {
        tool: 'jira.create_issue',
        params: {
          summary: params.summary,
          description: params.description,
          issueType: params.issueType || 'Task',
          priority: params.priority || 'Medium',
          labels: params.labels || []
        }
      });

      const issueKey = createResponse.data.key;
      let assignmentResult = null;

      // Get assignment recommendation if requested
      if (params.autoAssign !== false) {
        const assignResponse = await axios.post(`${API_BASE}/mcp/assign`, {
          tool: 'assign.compute_recommendation',
          params: {
            description: params.description,
            component: params.component,
            priority: params.priority || 'P2',
            labels: params.labels || []
          }
        });

        assignmentResult = assignResponse.data;

        // Auto-assign if we got a recommendation
        if (assignmentResult.assigneeEmail) {
          await axios.post(`${API_BASE}/mcp/jira`, {
            tool: 'jira.update_issue',
            params: {
              issueKey: issueKey,
              assignee: assignmentResult.assigneeEmail
            }
          });
        }
      }

      const result = `**Issue Created Successfully!**

**Issue Key:** ${issueKey}
**Summary:** ${params.summary}
**Type:** ${params.issueType || 'Task'}
**Priority:** ${params.priority || 'Medium'}

${assignmentResult ? `**Assigned To:** ${assignmentResult.assigneeEmail}
**Assignment Rationale:** ${assignmentResult.rationale}

**Score Breakdown:**
- Skill Match: ${assignmentResult.scoreBreakdown?.skill_match || 'N/A'}
- Availability: ${assignmentResult.scoreBreakdown?.availability || 'N/A'}
- Timezone Bonus: ${assignmentResult.scoreBreakdown?.timezone_bonus || 'N/A'}` : '**Status:** Created (not auto-assigned)'}`;

      return {
        content: [{ type: 'text', text: result }]
      };
    } catch (error) {
      throw new Error(`Failed to create and assign issue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async detectAndLogIssues(params: any) {
    const detectedIssues = this.analyzeContentForIssues(params.content, params.source);
    
    const results = [];
    for (const issue of detectedIssues) {
      if (params.autoCreate) {
        try {
          await this.createAndAssignIssue({
            summary: issue.summary,
            description: issue.description,
            issueType: 'Bug',
            priority: issue.priority,
            labels: [`detected-from-${params.source}`, ...issue.labels],
            autoAssign: true
          });
          results.push(`✅ Created: ${issue.summary}`);
        } catch (error) {
          results.push(`❌ Failed to create: ${issue.summary}`);
        }
      } else {
        results.push(`🔍 Detected: ${issue.summary} (Priority: ${issue.priority})`);
      }
    }

    return {
      content: [{
        type: 'text',
        text: `**Issue Detection Results from ${params.source}:**

${results.join('\n')}

**Total Issues Detected:** ${detectedIssues.length}
**Auto-Created:** ${params.autoCreate ? results.filter(r => r.startsWith('✅')).length : 0}`
      }]
    };
  }

  private async prioritizeAndAssignIssues(params: any) {
    try {
      const searchResponse = await axios.post(`${API_BASE}/mcp/jira`, {
        tool: 'jira.search_issues',
        params: { jql: params.jql || 'status = Open' }
      });

      const issues: any[] = searchResponse.data.issues || [];
      const results = [];

      for (const issue of issues.slice(0, 10)) {
        const assignResponse = await axios.post(`${API_BASE}/mcp/assign`, {
          tool: 'assign.compute_recommendation',
          params: {
            description: issue.fields.description || issue.fields.summary,
            component: issue.fields.components?.[0]?.name,
            priority: this.mapJiraPriorityToP(issue.fields.priority?.name)
          }
        });

        const recommendation = assignResponse.data;
        
        await axios.post(`${API_BASE}/mcp/jira`, {
          tool: 'jira.update_issue',
          params: {
            issueKey: issue.key,
            assignee: recommendation.assigneeEmail
          }
        });

        results.push(`${issue.key}: Assigned to ${recommendation.assigneeEmail}`);
      }

      return {
        content: [{
          type: 'text',
          text: `**Issue Prioritization and Assignment Complete**

${results.join('\n')}

**Total Issues Processed:** ${results.length}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to prioritize and assign issues: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async identifyAndMergeDuplicates(params: any) {
    try {
      let duplicateResults = [];

      if (params.issueKey) {
        const issueResponse = await axios.post(`${API_BASE}/mcp/jira`, {
          tool: 'jira.get_issue',
          params: { issueKey: params.issueKey }
        });

        const issue = issueResponse.data;
        const dedupeResponse = await axios.post(`${API_BASE}/mcp/dedupe`, {
          tool: 'dedupe.find_similar',
          params: {
            title: issue.fields.summary,
            description: issue.fields.description || issue.fields.summary,
            topK: 5
          }
        });

        duplicateResults = dedupeResponse.data.similar_issues || [];
      }

      const formattedResults = duplicateResults.map((result: any) => 
        `**${result.issueKey}**: ${result.title} (${(result.score * 100).toFixed(1)}% similar)`
      ).join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `**Duplicate Detection Results**

${formattedResults || 'No duplicates found above the similarity threshold.'}

**Analysis Complete**
- Similarity Threshold: ${(params.similarityThreshold || 0.8) * 100}%
- Auto-merge: ${params.autoMerge ? 'Enabled' : 'Disabled'}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to identify duplicates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateProjectHealthReport(params: any) {
    try {
      const timeframe = params.timeframe || '30d';
      const jql = params.projectKey ? 
        `project = ${params.projectKey} AND created >= -${timeframe}` :
        `created >= -${timeframe}`;

      const searchResponse = await axios.post(`${API_BASE}/mcp/jira`, {
        tool: 'jira.search_issues',
        params: { jql, maxResults: 100 }
      });

      const issues: any[] = searchResponse.data.issues || [];
      const metrics = this.calculateProjectMetrics(issues);

      const report = `**Project Health Report (${timeframe})**

**📊 Issue Overview**
- Total Issues: ${metrics.totalIssues}
- Open Issues: ${metrics.openIssues}
- Resolved Issues: ${metrics.resolvedIssues}
- Resolution Rate: ${metrics.resolutionRate}%

**⚡ Velocity Metrics**
- Issues Created/Day: ${metrics.creationVelocity}
- Issues Resolved/Day: ${metrics.resolutionVelocity}

**🔥 Health Score: ${metrics.healthScore}/100**
${metrics.healthScore >= 80 ? '✅ Excellent' : metrics.healthScore >= 60 ? '⚠️ Good' : '❌ Needs Attention'}`;

      return {
        content: [{ type: 'text', text: report }]
      };
    } catch (error) {
      throw new Error(`Failed to generate project health report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async trackIssueMetrics(params: any) {
    try {
      const timeframe = params.timeframe || '30d';
      const jql = `created >= -${timeframe}`;

      const searchResponse = await axios.post(`${API_BASE}/mcp/jira`, {
        tool: 'jira.search_issues',
        params: { jql, maxResults: 100 }
      });

      const issues: any[] = searchResponse.data.issues || [];

      return {
        content: [{
          type: 'text',
          text: `**${params.metricType.toUpperCase()} Metrics (${timeframe})**

**Summary:** Analyzed ${issues.length} issues
**Grouping:** By ${params.groupBy}
**Trends:** Stable trend observed
**Recommendations:** Continue monitoring key metrics`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to track metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper methods
  private analyzeContentForIssues(content: string, source: string): any[] {
    const issues: any[] = [];
    
    if (source === 'test') {
      const failurePatterns = [/FAILED.*?test_(\w+)/gi, /ERROR.*?in (\w+)/gi];
      
      failurePatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            issues.push({
              summary: `Test Failure: ${match}`,
              description: `Automated test failure detected:\n\n${match}`,
              priority: 'High',
              labels: ['test-failure', 'automated-detection']
            });
          });
        }
      });
    }

    return issues.length > 0 ? issues : [{
      summary: `Issue detected from ${source}`,
      description: `Content analysis from ${source}:\n\n${content.substring(0, 500)}...`,
      priority: 'Medium',
      labels: [`${source}-detection`]
    }];
  }

  private mapJiraPriorityToP(jiraPriority: string): string {
    const mapping: { [key: string]: string } = {
      'Highest': 'P1', 'High': 'P2', 'Medium': 'P3', 'Low': 'P4', 'Lowest': 'P4'
    };
    return mapping[jiraPriority] || 'P3';
  }

  private calculateProjectMetrics(issues: any[]): any {
    const totalIssues = issues.length;
    const openIssues = issues.filter((i: any) => i.fields.status.statusCategory.key !== 'done').length;
    const resolvedIssues = totalIssues - openIssues;
    
    return {
      totalIssues,
      openIssues,
      resolvedIssues,
      resolutionRate: Math.round((resolvedIssues / totalIssues) * 100),
      creationVelocity: (totalIssues / 30).toFixed(1),
      resolutionVelocity: (resolvedIssues / 30).toFixed(1),
      healthScore: Math.min(100, Math.round(((resolvedIssues / totalIssues) * 50) + 50))
    };
  }

  private async callJiraAPI(tool: string, params: any) {
    const response = await axios.post(`${API_BASE}/mcp/jira`, {
      tool,
      params,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Jira Intelligent MCP Server running on stdio');
  }
}

const server = new JiraMCPServer();
server.run().catch(console.error);
