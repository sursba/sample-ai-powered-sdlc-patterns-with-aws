#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListPromptsRequestSchema, GetPromptRequestSchema, ListToolsRequestSchema, CallToolRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { simpleGit } from 'simple-git';
import Handlebars from 'handlebars';
class OrganizationalPromptsServer {
    server;
    prompts = new Map();
    cacheDir;
    lastUpdate = 0;
    CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    owner;
    repo;
    constructor() {
        // Validate required environment variables
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        if (!owner || !repo) {
            throw new Error('GITHUB_OWNER and GITHUB_REPO environment variables are required');
        }
        // Validate owner and repo format (alphanumeric, hyphens, underscores only)
        const validNameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!validNameRegex.test(owner) || !validNameRegex.test(repo)) {
            throw new Error('GITHUB_OWNER and GITHUB_REPO must contain only alphanumeric characters, hyphens, and underscores');
        }
        this.owner = owner;
        this.repo = repo;
        this.cacheDir = path.join(os.tmpdir(), `mcp-prompts-${this.owner}-${this.repo}`);
        this.server = new Server({
            name: 'organizational-prompts',
            version: '1.0.0',
        }, {
            capabilities: {
                prompts: {
                    listChanged: true,
                },
                tools: {},
            },
        });
        this.setupHandlers();
    }
    setupHandlers() {
        // List all available prompts
        this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
            await this.ensurePromptsLoaded();
            return {
                prompts: Array.from(this.prompts.values()).map(prompt => ({
                    name: prompt.name,
                    description: `${prompt.team}: ${prompt.purpose}`,
                    arguments: prompt.arguments,
                })),
            };
        });
        // Get a specific prompt with rendered template
        this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
            await this.ensurePromptsLoaded();
            const promptName = request.params.name;
            // Validate prompt name format
            const validPromptNameRegex = /^[a-zA-Z0-9_-]+$/;
            if (!validPromptNameRegex.test(promptName)) {
                throw new Error('Invalid prompt name format');
            }
            const promptMetadata = this.prompts.get(promptName);
            if (!promptMetadata) {
                throw new Error(`Prompt not found`);
            }
            // Sanitize user arguments to prevent template injection
            const sanitizedArgs = {};
            if (request.params.arguments) {
                for (const [key, value] of Object.entries(request.params.arguments)) {
                    if (typeof value === 'string') {
                        // Escape HTML entities and Handlebars special characters
                        sanitizedArgs[key] = Handlebars.Utils.escapeExpression(value);
                    }
                }
            }
            // Render template with sanitized arguments
            const template = Handlebars.compile(promptMetadata.template);
            const renderedContent = template(sanitizedArgs);
            return {
                description: `${promptMetadata.team}: ${promptMetadata.purpose}`,
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: renderedContent,
                        },
                    },
                ],
            };
        });
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'refresh-prompts',
                        description: 'Force refresh prompts from GitHub repository. Use this to get the latest prompts without waiting for cache expiration.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                force: {
                                    type: 'boolean',
                                    description: 'If true, deletes the cached repository and re-clones fresh. Use when normal refresh does not pick up changes.',
                                },
                            },
                            required: [],
                        },
                    },
                ],
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;
            if (toolName === 'refresh-prompts') {
                try {
                    const args = request.params.arguments;
                    const forceClean = args?.force === true;
                    // Force reload by resetting lastUpdate
                    this.lastUpdate = 0;
                    await this.loadPrompts(forceClean);
                    // Send notification that prompts list has changed
                    await this.server.notification({
                        method: 'notifications/prompts/list_changed',
                    });
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Successfully refreshed prompts${forceClean ? ' (force clean)' : ''}. Loaded ${this.prompts.size} prompts from ${this.owner}/${this.repo}. Notification sent to client.`,
                            },
                        ],
                    };
                }
                catch (error) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Error refreshing prompts: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            },
                        ],
                        isError: true,
                    };
                }
            }
            throw new Error(`Unknown tool: ${toolName}`);
        });
    }
    async ensurePromptsLoaded() {
        const now = Date.now();
        if (this.prompts.size === 0 || now - this.lastUpdate > this.CACHE_DURATION) {
            await this.loadPrompts();
        }
    }
    async loadPrompts(forceClean = false) {
        try {
            const repoUrl = `https://github.com/${this.owner}/${this.repo}.git`;
            const repoPath = path.join(this.cacheDir, this.repo);
            // Force clean: delete cache and re-clone
            if (forceClean && fs.existsSync(repoPath)) {
                fs.rmSync(repoPath, { recursive: true, force: true });
            }
            // Clone or update repository using simple-git
            if (fs.existsSync(repoPath)) {
                const git = simpleGit(repoPath);
                await git.fetch('origin', 'main');
                await git.reset(['--hard', 'origin/main']);
            }
            else {
                fs.mkdirSync(this.cacheDir, { recursive: true });
                const git = simpleGit();
                await git.clone(repoUrl, repoPath);
            }
            // Clear and reload prompts
            this.prompts.clear();
            this.scanDirectory(repoPath);
            this.lastUpdate = Date.now();
        }
        catch (error) {
            console.error('Error loading prompts:', error);
            // Don't throw - allow server to continue with cached/empty prompts
        }
    }
    scanDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            return;
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            // Skip hidden directories like .git
            if (entry.name.startsWith('.')) {
                continue;
            }
            if (entry.isDirectory()) {
                this.scanDirectory(fullPath);
            }
            else if (entry.isFile() && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'readme.md') {
                this.loadPromptFile(fullPath);
            }
        }
    }
    loadPromptFile(filePath) {
        try {
            // Security: Validate file path is within cache directory
            const resolvedPath = path.resolve(filePath);
            const resolvedCacheDir = path.resolve(this.cacheDir);
            if (!resolvedPath.startsWith(resolvedCacheDir)) {
                console.error(`Security: Attempted to access file outside cache directory: ${filePath}`);
                return;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            const metadata = this.parsePromptFile(content, filePath);
            if (metadata) {
                this.prompts.set(metadata.name, metadata);
            }
        }
        catch (error) {
            console.error(`Error loading prompt file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    parsePromptFile(content, filePath) {
        const lines = content.split('\n');
        let team = '';
        let purpose = '';
        let usage = '';
        let templateStart = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('**Team**:')) {
                team = line.replace('**Team**:', '').trim();
            }
            else if (line.startsWith('**Purpose**:')) {
                purpose = line.replace('**Purpose**:', '').trim();
            }
            else if (line.startsWith('**Usage**:')) {
                usage = line.replace('**Usage**:', '').trim();
            }
            else if (line === '## Template') {
                templateStart = i + 1;
                break;
            }
        }
        // Skip files without proper metadata
        if (!team || !purpose || templateStart === -1) {
            return null;
        }
        const template = lines.slice(templateStart).join('\n').trim();
        const promptName = this.generatePromptName(filePath);
        const args = this.extractTemplateVariables(template);
        return {
            name: promptName,
            team,
            purpose,
            usage: usage || `/prompt ${promptName}`,
            template,
            filePath,
            arguments: args,
        };
    }
    generatePromptName(filePath) {
        const relativePath = path.relative(this.cacheDir, filePath);
        const parts = relativePath.split(path.sep);
        const filename = path.basename(parts[parts.length - 1], '.md');
        // If in teams directory, prefix with team name
        if (parts.includes('teams') && parts.length > 2) {
            const teamIndex = parts.indexOf('teams');
            const teamName = parts[teamIndex + 1];
            return `${teamName}-${filename}`;
        }
        return filename;
    }
    extractTemplateVariables(template) {
        const variables = [];
        const regex = /\{\{([^}]+)\}\}/g;
        const found = new Set();
        let match;
        while ((match = regex.exec(template)) !== null) {
            const variable = match[1].trim();
            // Skip Handlebars helpers and block expressions
            if (variable.startsWith('#') || variable.startsWith('/') || variable.includes(' ')) {
                continue;
            }
            if (!found.has(variable)) {
                variables.push({
                    name: variable,
                    description: `Value for ${variable}`,
                    required: true,
                });
                found.add(variable);
            }
        }
        return variables;
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Organizational Prompts MCP Server running on stdio');
    }
}
// Start the server
const server = new OrganizationalPromptsServer();
server.run().catch(console.error);
