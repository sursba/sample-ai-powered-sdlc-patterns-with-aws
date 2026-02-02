## Introduction

This pattern demonstrates **centralized prompt management** for organizations using AI-assisted development tools. Instead of each developer maintaining their own prompts, organizations can:

- **Manage prompts centrally** in a single GitHub repository
- **Distribute automatically** to all team members via MCP
- **Update once, deploy everywhere** - changes propagate to all users
- **Enforce consistency** across teams with standardized templates
- **Maintain governance** through Git workflows and access controls

The MCP server acts as a bridge between your central prompt repository and Kiro CLI, ensuring every team member has access to the latest organizational prompts without manual configuration.


## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Solution Architecture                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│                  │      │                  │      │                  │
│  GitHub Repo     │─────▶│   MCP Server     │─────▶│    Kiro CLI      │
│  (Prompts)       │      │   (Node.js)      │      │   (End Users)    │
│                  │      │                  │      │                  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
        │                         │                         │
        │                         │                         │
        ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ • Team prompts   │      │ • Clone/sync     │      │ • /prompts list  │
│ • Shared prompts │      │ • 5-min cache    │      │ • @prompt-name   │
│ • Version control│      │ • Template render│      │ • Auto-refresh   │
└──────────────────┘      └──────────────────┘      └──────────────────┘
```

### How It Works

1. **Prompt Storage**: Teams maintain prompt templates in a GitHub repository organized by team (engineering, product, design) and shared prompts
2. **MCP Server**: A Node.js application bridges GitHub with Kiro using the Model Context Protocol, automatically syncing prompts every 5 minutes
3. **Kiro Integration**: End users access prompts via `/prompts list` and invoke them with `@prompt-name` syntax - zero configuration required
4. **Dynamic Updates**: When prompts are updated in GitHub, changes propagate automatically to all users without restart
5. **On-Demand Refresh**: Users can prompt Kiro to "refresh the organizational prompts" to immediately sync the latest changes from GitHub without waiting for the cache to expire

## Repository Structure

```
sdlc-centralized-promptmanagement-kiro-mcp/
├── README.md                    # This file
├── mcp-server/                  # MCP server implementation
│   ├── index.js                 # Server code
│   └── package.json             # Dependencies
└── example-prompts-repo/        # Example prompts repository (use as template)
    ├── README.md
    ├── shared/                  # Cross-team prompts
    │   ├── daily-checklist.md
    │   ├── meeting-notes.md
    │   ├── retrospective.md
    │   └── standup.md
    └── teams/                   # Team-specific prompts
        ├── design/
        ├── engineering/
        └── product/
```

## Prerequisites

- **Node.js** 18 or later
- **Git** configured with GitHub authentication
- **GitHub repository** for storing organizational prompts
- **Kiro CLI** installed

## Deployment Instructions

### Step 1: Create Your Prompts Repository

Create a GitHub repository for your organizational prompts. You can use the included `example-prompts-repo/` as a template:

```bash
# Option A: Copy the example to your own GitHub repo
cp -r example-prompts-repo/ /path/to/your-org-prompts/

# Option B: Create from scratch with this structure
your-org-prompts/
├── README.md
├── teams/
│   ├── engineering/
│   │   ├── code-review.md
│   │   └── architecture-review.md
│   ├── product/
│   │   └── user-story.md
│   └── design/
│       └── ui-review.md
└── shared/
    └── meeting-notes.md
```

Push your prompts repository to GitHub.

### Step 2: Create Prompt Templates

Each prompt file must follow this format:

```markdown
# Prompt Title

**Team**: [Team Name]  
**Purpose**: [Brief description]  
**Usage**: `/prompt [command-name]`

## Template

Your prompt content with {{variables}} for user input.

{{#if optional_variable}}
Optional content when {{optional_variable}} is provided.
{{/if}}
```

### Step 3: Deploy the MCP Server

```bash
cd mcp-server
npm install
```

### Step 4: Configure Kiro

Create or update `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "org-prompts": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "GITHUB_OWNER": "your-github-org",
        "GITHUB_REPO": "your-prompts-repo"
      },
      "disabled": false,
      "autoApprove": ["prompts/list", "prompts/get"]
    }
  }
}
```

**Configuration Locations:**
- **User-level**: `~/.kiro/settings/mcp.json` (applies to all workspaces)

### Step 5: Restart Kiro

Restart Kiro CLI to load the new MCP server configuration.

## Test

### List Available Prompts

```bash
/prompts list
```

### Use a Prompt

Use the `@` syntax followed by the prompt name and arguments:

```bash
@<prompt-name> arg1="value1" arg2="value2"
```

### Examples

**Simple prompt (no parameters):**
```bash
@daily-checklist
```

**Code Review:**
```bash
@engineering-code-review developer_name="John" language="TypeScript" branch_name="feature/auth" files_changed="src/auth.ts"
```

**User Story:**
```bash
@product-user-story feature_name="Password Reset" user_type="registered user" functionality="reset password via email" benefit="regain account access"
```

### Refresh Prompts

To get newly added prompts without restarting, ask Kiro:
> "refresh the organizational prompts"

## Clean Up

To remove the deployed resources:

1. **Remove MCP Configuration**: Delete the `org-prompts` entry from your `.kiro/settings/mcp.json` file

2. **Remove MCP Server**: Delete the MCP server directory
   ```bash
   rm -rf mcp-server/node_modules
   ```

3. **Clear Cache**: Remove the cached prompts repository
   ```bash
   rm -rf /tmp/mcp-prompts-*
   ```

4. **Delete GitHub Repository** (optional): If you no longer need the prompts repository, delete it from GitHub

## License

This library is licensed under the MIT-0 License. 

## Disclaimer

The solution architecture sample code is provided without any guarantees, and you're not recommended to use it for production-grade workloads. The intention is to provide content to build and learn. Be sure of reading the licensing terms.
